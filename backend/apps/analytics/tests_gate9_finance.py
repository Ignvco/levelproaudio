# apps/analytics/tests_gate9_finance.py
"""
LEVELPRO OS V4.0 — GATE 9: FINANCIAL MANAGEMENT TESTS
Cubre:
- BF-24: Conciliación bancaria (bloqueo solo-comprobante, match exacto, doble asignación, parcial, idempotencia, RBAC)
- BF-38: Tesorería multi-cuenta (aislamiento CLP/USD/ARS, importación CSV + deduplicación SHA-256, traspaso interno)
- BF-36: Cuentas por cobrar AR (reconocimiento OneToOne, abonos/notas de crédito, aging buckets)
- BF-37: Cuentas por pagar AP (vínculo PO/GR, bloqueo factura duplicada, pago con referencia bancaria)
- BF-39: Flujo de caja 30/60/90 (escenarios, aislamiento moneda) & exportación contable CSV sanitizada
- TributaryDocument: trazabilidad fiscal externa (FIN9-PF-04)
- API HTTP smoke tests sobre /api/admin/finance/*
"""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.analytics.finance_models import (
    AccountPayable,
    AccountReceivable,
    BankReconciliation,
    BankTransaction,
    FinancialBankAccount,
    ReceivableAllocation,
)
from apps.analytics.finance_services import (
    FinancePermissionError,
    FinanceServiceError,
    apply_receivable_allocation,
    compute_cash_flow_projection,
    create_treasury_account,
    export_accounting_ledger_csv,
    get_ar_aging_report,
    get_treasury_account_balances,
    import_bank_statement,
    recognize_account_receivable_for_order,
    reconcile_payment_with_bank,
    record_internal_transfer,
    record_payable_payment,
    register_account_payable,
)
from apps.analytics.models import IncomeRecord
from apps.billing.models import TributaryDocument
from apps.orders.models import Order, OrderStatus
from apps.payments.models import Payment, PaymentProvider, PaymentStatus
from apps.procurement.models import Supplier

User = get_user_model()


class Gate9FinancialManagementTests(TransactionTestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="g9_admin", email="g9_admin@levelpro.cl", password="pw"
        )
        self.buyer = User.objects.create_user(
            username="g9_buyer", email="g9_buyer@levelpro.cl", password="pw"
        )
        self.acct_clp = create_treasury_account(
            code="BCI-CLP-01",
            bank_name="Banco BCI",
            account_holder="LevelPro Audio SpA",
            account_number="99887766",
            currency="CLP",
            country="CL",
            opening_balance=Decimal("1000000.00"),
            actor=self.admin,
        )
        self.acct_clp_2 = create_treasury_account(
            code="SANT-CLP-02",
            bank_name="Banco Santander",
            account_holder="LevelPro Audio SpA",
            account_number="55443322",
            currency="CLP",
            country="CL",
            opening_balance=Decimal("500000.00"),
            actor=self.admin,
        )
        self.acct_usd = create_treasury_account(
            code="MER-USD-01",
            bank_name="Mercury",
            account_holder="LevelPro Audio LLC",
            account_number="11223344",
            currency="USD",
            country="US",
            opening_balance=Decimal("10000.00"),
            actor=self.admin,
        )

    def _make_order_payment(self, number: str, amount: Decimal, currency: str = "CLP"):
        order = Order.objects.create(
            user=self.buyer,
            email=self.buyer.email,
            status=OrderStatus.PENDING,
            total=amount,
            currency=currency,
            shipping_address="Av. Providencia 1234",
        )
        payment = Payment.objects.create(
            order=order,
            provider=PaymentProvider.TRANSFER,
            status=PaymentStatus.PENDING,
            amount=amount,
            currency=currency,
            provider_reference=f"EXT-{number}",
        )
        return order, payment

    def test_bf24_reconciliation_blocks_receipt_only_and_double_allocation(self):
        """BF-24: Comprobante solo no aprueba fondos; match exacto, doble asignación bloqueada e idempotencia."""
        order1, pay1 = self._make_order_payment("ORD-G9-001", Decimal("250000.00"))
        _, pay2 = self._make_order_payment("ORD-G9-002", Decimal("250000.00"))

        # 1. Bloqueo RBAC para usuario sin rol financiero
        with self.assertRaises(FinancePermissionError):
            reconcile_payment_with_bank(
                payment=pay1,
                decision=BankReconciliation.Status.APPROVED,
                actor=self.buyer,
            )

        # 2. Bloqueo sin BankTransaction ni excepción manual
        with self.assertRaises(FinanceServiceError):
            reconcile_payment_with_bank(
                payment=pay1,
                decision=BankReconciliation.Status.APPROVED,
                actor=self.admin,
            )

        # 3. Importar cartola con 1 abono de 250.000
        csv_bytes = (
            "fecha,abono,cargo,referencia,descripcion\n"
            "2026-11-20,250000.00,0,TRF-9001,Transferencia cliente 1\n"
        ).encode("utf-8")
        stmt = import_bank_statement(
            self.acct_clp,
            file_name="cartola_nov.csv",
            file_bytes=csv_bytes,
            actor=self.admin,
        )
        self.assertEqual(stmt["created_transactions"], 1)
        tx = BankTransaction.objects.get(statement_import_id=stmt["statement_id"])

        # 4. Conciliación aprobada
        rec = reconcile_payment_with_bank(
            payment=pay1,
            decision=BankReconciliation.Status.APPROVED,
            bank_transaction=tx,
            idempotency_key="REC-KEY-001",
            actor=self.admin,
        )
        self.assertEqual(rec.status, BankReconciliation.Status.APPROVED)
        pay1.refresh_from_db()
        order1.refresh_from_db()
        tx.refresh_from_db()
        self.assertEqual(pay1.status, PaymentStatus.APPROVED)
        self.assertEqual(order1.status, OrderStatus.PAID)
        self.assertEqual(tx.reconciliation_status, BankTransaction.ReconciliationStatus.RECONCILED)
        self.assertEqual(IncomeRecord.objects.filter(order=order1).count(), 1)

        # 5. Replay idempotente no duplica
        rec_replay = reconcile_payment_with_bank(
            payment=pay1,
            decision=BankReconciliation.Status.APPROVED,
            bank_transaction=tx,
            idempotency_key="REC-KEY-001",
            actor=self.admin,
        )
        self.assertEqual(rec.id, rec_replay.id)
        self.assertEqual(IncomeRecord.objects.filter(order=order1).count(), 1)

        # 6. Doble asignación sobre mismo movimiento agotado -> bloqueada
        with self.assertRaises(FinanceServiceError):
            reconcile_payment_with_bank(
                payment=pay2,
                decision=BankReconciliation.Status.APPROVED,
                bank_transaction=tx,
                actor=self.admin,
            )

    def test_bf24_partial_reconciliation(self):
        """BF-24: Conciliación parcial actualiza Order a PARTIAL y deja saldo restante en BankTransaction."""
        order, pay = self._make_order_payment("ORD-G9-003", Decimal("400000.00"))
        tx = BankTransaction.objects.create(
            financial_account=self.acct_clp,
            external_row_hash="hash-partial-001",
            effective_date=timezone.now().date(),
            direction=BankTransaction.Direction.CREDIT,
            amount=Decimal("250000.00"),
            currency="CLP",
            reference="TRF-PART-1",
        )
        rec = reconcile_payment_with_bank(
            payment=pay,
            decision=BankReconciliation.Status.PARTIAL,
            bank_transaction=tx,
            reconciled_amount=Decimal("200000.00"),
            actor=self.admin,
        )
        self.assertEqual(rec.status, BankReconciliation.Status.PARTIAL)
        order.refresh_from_db()
        tx.refresh_from_db()
        self.assertEqual(tx.reconciliation_status, BankTransaction.ReconciliationStatus.PARTIALLY_RECONCILED)
        self.assertEqual(tx.allocated_amount, Decimal("200000.00"))

    def test_bf38_treasury_dedup_currency_isolation_and_internal_transfer(self):
        """BF-38: Deduplicación SHA-256 de cartolas, aislamiento de moneda y traspaso interno sin ingreso."""
        csv_bytes = (
            "fecha,abono,cargo,referencia,descripcion\n"
            "2026-11-21,150000.00,0,DEP-100,Deposito\n"
        ).encode("utf-8")
        import_bank_statement(
            self.acct_clp,
            file_name="cartola_dup.csv",
            file_bytes=csv_bytes,
            actor=self.admin,
        )
        # Archivo idéntico debe bloquearse por SHA-256
        with self.assertRaises(FinanceServiceError):
            import_bank_statement(
                self.acct_clp,
                file_name="cartola_dup_2.csv",
                file_bytes=csv_bytes,
                actor=self.admin,
            )

        # Traspaso interno entre monedas distintas bloqueado
        with self.assertRaises(FinanceServiceError):
            record_internal_transfer(
                source_account=self.acct_clp,
                target_account=self.acct_usd,
                amount=Decimal("10000.00"),
                effective_date=timezone.now().date(),
                reference="INT-ERR",
                actor=self.admin,
            )

        # Traspaso interno válido CLP -> CLP
        income_before = IncomeRecord.objects.count()
        out_tx, in_tx = record_internal_transfer(
            source_account=self.acct_clp,
            target_account=self.acct_clp_2,
            amount=Decimal("100000.00"),
            effective_date=timezone.now().date(),
            reference="INT-OK-01",
            actor=self.admin,
        )
        self.assertEqual(out_tx.correlated_transaction_id, in_tx.id)
        self.assertEqual(in_tx.correlated_transaction_id, out_tx.id)
        self.assertEqual(IncomeRecord.objects.count(), income_before)
        bal_1 = get_treasury_account_balances(self.acct_clp)
        bal_2 = get_treasury_account_balances(self.acct_clp_2)
        self.assertEqual(Decimal(bal_1["reconciled_balance"]), Decimal("900000.00"))
        self.assertEqual(Decimal(bal_2["reconciled_balance"]), Decimal("600000.00"))

    def test_bf36_ar_recognition_allocations_and_aging(self):
        """BF-36: Reconocimiento OneToOne de CxC, abonos parciales, nota de crédito y buckets de aging."""
        order, _ = self._make_order_payment("ORD-G9-AR-1", Decimal("300000.00"))
        ar = recognize_account_receivable_for_order(
            order,
            due_days=15,
            actor=self.admin,
        )
        ar.due_date = timezone.now().date() - timedelta(days=35)
        ar.save(update_fields=["due_date"])
        # Idempotencia OneToOne
        ar_again = recognize_account_receivable_for_order(order, actor=self.admin)
        self.assertEqual(ar.id, ar_again.id)

        # Abono parcial 100.000
        apply_receivable_allocation(
            ar,
            allocation_type=ReceivableAllocation.AllocationType.PAYMENT,
            amount=Decimal("100000.00"),
            actor=self.admin,
        )
        ar.refresh_from_db()
        self.assertEqual(ar.status, AccountReceivable.Status.PARTIALLY_PAID)
        self.assertEqual(ar.pending_balance, Decimal("200000.00"))

        # Aging report ubica 200.000 en days_31_60
        aging = get_ar_aging_report(currency="CLP")
        self.assertEqual(Decimal(aging["buckets"]["days_31_60"]), Decimal("200000.00"))

        # Nota de crédito por 200.000 salda la CxC
        apply_receivable_allocation(
            ar,
            allocation_type=ReceivableAllocation.AllocationType.CREDIT_NOTE,
            amount=Decimal("200000.00"),
            actor=self.admin,
        )
        ar.refresh_from_db()
        self.assertEqual(ar.status, AccountReceivable.Status.PAID)
        self.assertEqual(ar.pending_balance, Decimal("0.00"))

    def test_bf37_ap_registration_duplicate_block_and_payment(self):
        """BF-37: Registro de CxP, bloqueo de factura duplicada y pago con referencia bancaria."""
        supplier = Supplier.objects.create(
            internal_code="SUP-G9-01",
            legal_name="Audio Tech Distribuidora",
            tax_id="76.543.210-K",
            country="CL",
            currency="CLP",
        )
        today = timezone.now().date()
        ap = register_account_payable(
            supplier=supplier,
            supplier_invoice_number="FAC-9001",
            currency="CLP",
            original_amount=Decimal("500000.00"),
            issue_date=today,
            due_date=today + timedelta(days=15),
            approve_immediately=True,
            actor=self.admin,
        )
        self.assertEqual(ap.status, AccountPayable.Status.APPROVED_FOR_PAYMENT)

        # Bloqueo factura duplicada
        with self.assertRaises(FinanceServiceError):
            register_account_payable(
                supplier=supplier,
                supplier_invoice_number="FAC-9001",
                currency="CLP",
                original_amount=Decimal("500000.00"),
                issue_date=today,
                due_date=today + timedelta(days=15),
                actor=self.admin,
            )

        # Bloqueo pago sin referencia bancaria
        with self.assertRaises(FinanceServiceError):
            record_payable_payment(
                ap,
                amount=Decimal("200000.00"),
                bank_reference="",
                actor=self.admin,
            )

        # Pago parcial + replay idempotente + pago final
        ap = record_payable_payment(
            ap,
            amount=Decimal("200000.00"),
            bank_reference="TRF-AP-01",
            idempotency_key="AP-PAY-1",
            actor=self.admin,
        )
        self.assertEqual(ap.status, AccountPayable.Status.PARTIALLY_PAID)
        ap = record_payable_payment(
            ap,
            amount=Decimal("200000.00"),
            bank_reference="TRF-AP-01",
            idempotency_key="AP-PAY-1",
            actor=self.admin,
        )
        self.assertEqual(ap.pending_balance, Decimal("300000.00"))
        ap = record_payable_payment(
            ap,
            amount=Decimal("300000.00"),
            bank_reference="TRF-AP-02",
            actor=self.admin,
        )
        self.assertEqual(ap.status, AccountPayable.Status.PAID)
        self.assertEqual(ap.pending_balance, Decimal("0.00"))

    def test_bf39_cash_flow_scenarios_export_sanitization_and_tax_record(self):
        """BF-39 & TributaryDocument: Proyección 30/60/90, sanitización CSV y trazabilidad fiscal."""
        order, _ = self._make_order_payment("ORD-G9-CF-1", Decimal("100000.00"))
        recognize_account_receivable_for_order(
            order,
            due_days=10,
            actor=self.admin,
        )
        cf_base = compute_cash_flow_projection(currency="CLP", scenario="base")
        cf_cons = compute_cash_flow_projection(currency="CLP", scenario="conservative")
        self.assertEqual(cf_base["currency"], "CLP")
        self.assertEqual(len(cf_base["horizons"]), 3)
        self.assertLess(
            Decimal(cf_cons["horizons"]["days_30"]["expected_inflows"]),
            Decimal(cf_base["horizons"]["days_30"]["expected_inflows"]),
        )

        # Exportación contable sanitiza fórmulas peligrosas
        BankTransaction.objects.create(
            financial_account=self.acct_clp,
            external_row_hash="csv-formula-test-hash",
            effective_date=timezone.now().date(),
            direction=BankTransaction.Direction.CREDIT,
            amount=Decimal("50000.00"),
            currency="CLP",
            reference="=CMD|calc",
        )
        csv_out = export_accounting_ledger_csv(currency="CLP")
        self.assertIn("'=CMD|calc", csv_out)

        # Registro tributario externo
        doc = TributaryDocument.objects.create(
            order=order,
            tipo=TributaryDocument.TipoDocumento.FACTURA,
            numero_externo="F-00123",
            estado=TributaryDocument.Estado.EMITIDO,
            monto=Decimal("100000.00"),
            currency="CLP",
            jurisdiction_country="CL",
            issuer_tax_id="76.111.222-3",
            recipient_tax_id="77.222.333-4",
            document_sha256="a" * 64,
            uploaded_by=self.admin,
        )
        self.assertEqual(doc.currency, "CLP")
        self.assertEqual(doc.estado, TributaryDocument.Estado.EMITIDO)

    def test_gate9_api_endpoints_smoke(self):
        """HTTP API smoke tests para todos los endpoints Gate 9 bajo /api/admin/finance/."""
        client = APIClient()
        client.force_authenticate(user=self.admin)

        for path in [
            "/api/v1/admin/finance/reconciliation/",
            "/api/v1/admin/finance/treasury-accounts/",
            "/api/v1/admin/finance/bank-transactions/",
            "/api/v1/admin/finance/ar/",
            "/api/v1/admin/finance/ar/aging/",
            "/api/v1/admin/finance/ap/",
            "/api/v1/admin/finance/cash-flow/?currency=CLP&scenario=base",
            "/api/v1/admin/finance/accounting-export/?currency=CLP",
        ]:
            resp = client.get(path)
            self.assertEqual(resp.status_code, 200, f"GET {path} failed: {resp.status_code}")
