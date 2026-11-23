# apps/analytics/tests_gate9_preflight.py
"""
LEVELPRO OS V4.0 — GATE 9 PREFLIGHT TESTS (FIN9-PF-01..04)
- FIN9-PF-01: Contrato centralizado de conciliación manual (evidencia obligatoria en modo estricto, idempotencia, sin duplicar IncomeRecord).
- FIN9-PF-02: Preservación del historial financiero (reversión compensatoria en lugar de borrar IncomeRecord confirmado).
- FIN9-PF-03: BankAccount de checkout separado de saldos de tesorería.
- FIN9-PF-04: Eliminación de emisores ficticios predeterminados y bandera api_ready_draft_only en DTE/AFIP.
"""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TransactionTestCase

from apps.analytics.finance_preflight import (
    FinancePreflightError,
    get_checkout_bank_account_reference,
    reconcile_manual_payment_approval,
)
from apps.analytics.models import IncomeRecord
from apps.billing.shipping_and_tax import generate_afip_invoice_payload, generate_sii_dte_payload
from apps.orders.models import Order, OrderStatus
from apps.payments.models import BankAccount, Payment, PaymentProvider, PaymentStatus

User = get_user_model()


class Gate9PreflightTests(TransactionTestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="g9pf_admin", email="g9pf_admin@levelpro.cl", password="pw"
        )
        self.buyer = User.objects.create_user(
            username="g9pf_buyer", email="g9pf_buyer@levelpro.cl", password="pw"
        )
        self.bank_clp = BankAccount.objects.create(
            payment_method="transfer",
            label="Cuenta Transferencias CLP",
            currency="CLP",
            bank_name="Banco Demo",
            account_number="000012345",
            holder_name="Titular Demo",
        )

    def test_fin9_pf_01_02_manual_reconciliation_evidence_idempotency_and_history_preservation(self):
        """
        FIN9-PF-01 & FIN9-PF-02:
        - Aprobación estricta sin evidencia bancaria -> rechazada.
        - Aprobación con evidencia + idempotency_key -> actualiza Payment, Order y crea 1 IncomeRecord (replay idempotente no duplica).
        - Reembolso posterior conserva IncomeRecord original y genera reversión compensatoria negativa.
        """
        order = Order.objects.create(
            user=self.buyer,
            email=self.buyer.email,
            shipping_address="Av. Demo 123",
            total=Decimal("100000.00"),
            currency="CLP",
            status=OrderStatus.PENDING,
        )
        payment = Payment.objects.create(
            order=order,
            provider=PaymentProvider.TRANSFER,
            status=PaymentStatus.PENDING,
            amount=Decimal("100000.00"),
            currency="CLP",
        )

        # Sin evidencia en modo estricto -> bloqueado
        with self.assertRaises(FinancePreflightError):
            reconcile_manual_payment_approval(
                payment,
                target_status=PaymentStatus.APPROVED,
                require_evidence=True,
                actor=self.admin,
            )

        # Con evidencia verificable -> aprobado e idempotente
        res1 = reconcile_manual_payment_approval(
            payment,
            target_status=PaymentStatus.APPROVED,
            bank_account_id=str(self.bank_clp.id),
            bank_reference="TRF-9001",
            effective_date="2026-11-23",
            verified_amount=Decimal("100000.00"),
            verified_currency="CLP",
            idempotency_key="idem-g9pf-01",
            require_evidence=True,
            actor=self.admin,
        )
        self.assertFalse(res1["idempotent_replay"])
        self.assertEqual(IncomeRecord.objects.filter(order=order).count(), 1)

        # Reintento con misma idempotency_key -> replay sin duplicar IncomeRecord
        res2 = reconcile_manual_payment_approval(
            payment,
            target_status=PaymentStatus.APPROVED,
            bank_account_id=str(self.bank_clp.id),
            bank_reference="TRF-9001",
            idempotency_key="idem-g9pf-01",
            require_evidence=True,
            actor=self.admin,
        )
        self.assertTrue(res2["idempotent_replay"])
        self.assertEqual(IncomeRecord.objects.filter(order=order).count(), 1)

        # Reembolso preserva el IncomeRecord original y crea reversión compensatoria (-100000.00)
        reconcile_manual_payment_approval(
            payment,
            target_status=PaymentStatus.REFUNDED,
            require_evidence=False,
            actor=self.admin,
        )
        records = list(IncomeRecord.objects.filter(order=order).order_by("created_at"))
        self.assertEqual(len(records), 2)
        self.assertEqual(records[0].amount, Decimal("100000.00"))
        self.assertEqual(records[1].amount, Decimal("-100000.00"))
        self.assertEqual(records[1].source, "refund_reversal")

    def test_fin9_pf_03_04_bank_vs_treasury_and_legacy_tax_emitter(self):
        """
        FIN9-PF-03 & FIN9-PF-04:
        - BankAccount aclara que no es libro de tesorería.
        - Payloads DTE/AFIP no devuelven RUT/CUIT ficticios y declaran api_ready_draft_only=True, is_legal_dte=False.
        """
        ref = get_checkout_bank_account_reference(self.bank_clp)
        self.assertEqual(ref["balance_source"], "not_a_treasury_ledger")

        order_clp = Order.objects.create(
            user=self.buyer, email=self.buyer.email, shipping_address="Santiago",
            total=Decimal("119000.00"), currency="CLP", status=OrderStatus.PAID,
        )
        dte = generate_sii_dte_payload(order_clp, buyer_tax_id="11.111.111-1", buyer_name="Cliente Demo")
        self.assertTrue(dte["api_ready_draft_only"])
        self.assertFalse(dte["dte_emitted"])
        self.assertFalse(dte["is_legal_dte"])
        self.assertFalse(dte["emisor"]["configured"])
        self.assertNotIn("77.890.123-4", str(dte))

        order_ars = Order.objects.create(
            user=self.buyer, email=self.buyer.email, shipping_address="Buenos Aires",
            total=Decimal("121000.00"), currency="ARS", status=OrderStatus.PAID,
        )
        afip = generate_afip_invoice_payload(order_ars, cuit="20-11111111-2", recipient_name="Cliente AR")
        self.assertTrue(afip["api_ready_draft_only"])
        self.assertFalse(afip["emisor"]["configured"])
        self.assertNotIn("30718901231", str(afip))
