"""
backend/tests/test_f6_financial_consolidation.py
Certificación integral de Fase F6:
- #36 (FIN-01): Reportes financieros consolidados y aislados por divisa (CLP, USD, ARS).
- #37 (FIN-02): Diferido por decisión comercial (comprobación de aislamiento sin escrituras a Cloud SQL).
- #38 (FIN-04): Trazabilidad de márgenes y rentabilidad comercial con manejo seguro de costos nulos.
- #39 (FIN-05): Conciliación de transferencias bancarias manuales y ciclo de vida de pagos.
"""
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.users.models import User
from apps.products.models import Category, Product
from apps.orders.models import Order, OrderItem, OrderStatus
from apps.payments.models import (
    Payment,
    PaymentProvider,
    PaymentStatus,
    BankAccount,
    PaymentMethodConfig,
)
from apps.analytics.models import (
    DistributionCategory,
    IncomeRecord,
    IncomeDistribution,
    Withdrawal,
    WithdrawalDeletionLog,
)


class Fase6FinancialConsolidationCertificationTests(TestCase):
    def setUp(self):
        # 1. Usuarios
        self.admin = User.objects.create_superuser(
            email="admin.fin6@levelproaudio.test",
            username="admin_fin6",
            password="Password123!",
        )
        self.customer = User.objects.create_user(
            email="cliente.fin6@levelproaudio.test",
            username="cliente_fin6",
            password="Password123!",
        )

        # 2. Cliente autenticado como Admin
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

        # 3. Categorías contables base
        self.cat_fixed = DistributionCategory.objects.create(
            name="Costo Mercadería", cat_type="fixed", is_active=True, order=1
        )
        self.cat_percent = DistributionCategory.objects.create(
            name="Reserva Operativa", cat_type="percent", percentage=Decimal("10.0"),
            is_active=True, order=2
        )
        self.cat_remainder = DistributionCategory.objects.create(
            name="Utilidad Neta", cat_type="remainder", is_active=True, order=3
        )

        # 4. Catálogo de productos
        self.category = Category.objects.create(name="Pro Audio F6", slug="pro-audio-f6")
        self.product_with_cost = Product.objects.create(
            name="Interfaz Focusrite 2i2",
            slug="focusrite-2i2-f6",
            category=self.category,
            price=Decimal("150000"),
            cost_price=Decimal("90000"),
            stock=15,
            is_active=True,
        )
        self.product_without_cost = Product.objects.create(
            name="Plugin DSP Especial",
            slug="plugin-dsp-f6",
            category=self.category,
            price=Decimal("50000"),
            cost_price=None,  # Costo no disponible / nulo
            stock=99,
            is_active=True,
        )

    # ═══════════════════════════════════════════════════════════════
    # #36 (FIN-01): REPORTES FINANCIEROS Y RETIROS AISLADOS POR DIVISA
    # ═══════════════════════════════════════════════════════════════

    def test_fin01_currency_isolated_summary_reporting(self):
        """Los reportes financieros desglosan estrictamente por divisa sin mezclas implícitas."""
        # Crear ingresos en CLP, USD y ARS
        for curr, tot in [("CLP", Decimal("300000")), ("USD", Decimal("400.00")), ("ARS", Decimal("450000"))]:
            o = Order.objects.create(
                user=self.customer, email=self.customer.email, shipping_address="Dir",
                total=tot, currency=curr, status=OrderStatus.PAID
            )
            # En producción el signal crea el IncomeRecord
            IncomeRecord.objects.get_or_create(
                order=o, currency=curr, amount=tot,
                defaults={"description": f"Ingreso {curr}", "source": "payment"}
            )

        # Crear retiros en CLP y USD
        Withdrawal.objects.create(
            category=self.cat_percent, amount=Decimal("30000"),
            currency="CLP", destination="Banco Santander"
        )
        Withdrawal.objects.create(
            category=self.cat_percent, amount=Decimal("50.00"),
            currency="USD", destination="Payoneer Inc"
        )

        # Consultar reporte CLP
        resp_clp = self.client.get("/api/v1/admin/finance/summary/?currency=CLP")
        self.assertEqual(resp_clp.status_code, 200)
        self.assertEqual(resp_clp.data["currency"], "CLP")
        self.assertEqual(resp_clp.data["total_income"], 300000.0)
        self.assertEqual(resp_clp.data["total_withdrawn"], 30000.0)
        self.assertEqual(resp_clp.data["net_balance"], 270000.0)
        self.assertFalse(resp_clp.data["reconciliation_required"])

        # Consultar reporte USD
        resp_usd = self.client.get("/api/v1/admin/finance/summary/?currency=USD")
        self.assertEqual(resp_usd.status_code, 200)
        self.assertEqual(resp_usd.data["currency"], "USD")
        self.assertEqual(resp_usd.data["total_income"], 400.0)
        self.assertEqual(resp_usd.data["total_withdrawn"], 50.0)
        self.assertEqual(resp_usd.data["net_balance"], 350.0)

        # Moneda inválida rechazada con 400
        resp_invalid = self.client.get("/api/v1/admin/finance/summary/?currency=EUR")
        self.assertEqual(resp_invalid.status_code, 400)

    def test_fin01_unclassified_records_flag_reconciliation_and_nullify_net_balance(self):
        """Registros históricos sin moneda asignada activan la conciliación requerida y protegen saldo."""
        # Crear movimiento legado con moneda NULL
        Withdrawal.objects.create(
            category=self.cat_percent, amount=Decimal("15000"),
            currency=None, destination="Banco Antiguo"
        )

        resp = self.client.get("/api/v1/admin/finance/summary/?currency=CLP")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["reconciliation_required"])
        # net_balance no debe engañar al usuario mostrando una cifra falsamente definitiva
        self.assertIsNone(resp.data["net_balance"])
        self.assertIsNotNone(resp.data["net_balance_identified_only"])

        # Un retiro sobre una categoría no conciliada debe rechazarse con 409
        resp_with = self.client.post("/api/v1/admin/finance/withdrawals/", {
            "category_id": str(self.cat_percent.id),
            "amount": "1000",
            "currency": "CLP",
            "destination": "Cuenta Nueva",
        }, format="json")
        self.assertEqual(resp_with.status_code, 409)
        self.assertIn("sin moneda conciliada", resp_with.data["error"])

    def test_fin01_withdrawal_validation_and_audit_log_on_delete(self):
        """Validaciones financieras en retiros y auditoría indestructible al eliminar."""
        # Acreditar fondos a la categoría
        inc = IncomeRecord.objects.create(
            amount=Decimal("100000"), currency="CLP", source="payment", description="Depósito"
        )
        IncomeDistribution.objects.create(
            income_record=inc, category=self.cat_fixed, amount=Decimal("50000")
        )

        # 1. Retiro con monto negativo o inválido rechazado
        resp_neg = self.client.post("/api/v1/admin/finance/withdrawals/", {
            "category_id": str(self.cat_fixed.id), "amount": "-500", "currency": "CLP"
        }, format="json")
        self.assertEqual(resp_neg.status_code, 400)

        # 2. Retiro que supera saldo disponible rechazado
        resp_excess = self.client.post("/api/v1/admin/finance/withdrawals/", {
            "category_id": str(self.cat_fixed.id), "amount": "80000", "currency": "CLP"
        }, format="json")
        self.assertEqual(resp_excess.status_code, 400)
        self.assertIn("supera el saldo disponible", resp_excess.data["error"])

        # 3. Retiro válido creado exitosamente
        resp_ok = self.client.post("/api/v1/admin/finance/withdrawals/", {
            "category_id": str(self.cat_fixed.id), "amount": "20000",
            "currency": "CLP", "destination": "Proveedor Oficial"
        }, format="json")
        self.assertEqual(resp_ok.status_code, 201)
        wid = resp_ok.data["id"]

        # 4. Eliminación de retiro registra trazabilidad en WithdrawalDeletionLog
        resp_del = self.client.delete(f"/api/v1/admin/finance/withdrawals/{wid}/")
        self.assertEqual(resp_del.status_code, 200)
        self.assertTrue(WithdrawalDeletionLog.objects.filter(original_id=wid).exists())
        log = WithdrawalDeletionLog.objects.get(original_id=wid)
        self.assertEqual(log.amount, Decimal("20000"))
        self.assertEqual(log.deleted_by, self.admin)

    # ═══════════════════════════════════════════════════════════════
    # #38 (FIN-04): TRAZABILIDAD DE MÁRGENES Y RENTABILIDAD COMERCIAL
    # ═══════════════════════════════════════════════════════════════

    def test_fin04_margin_and_profitability_traceability_known_costs(self):
        """Cálculo certero de costo, utilidad y margen en órdenes CLP con costo conocido."""
        order = Order.objects.create(
            user=self.customer, email=self.customer.email, shipping_address="Dir",
            total=Decimal("300000"), currency="CLP", status=OrderStatus.PAID
        )
        OrderItem.objects.create(
            order=order, product=self.product_with_cost,
            product_name=self.product_with_cost.name,
            price=Decimal("150000"), quantity=2
        )

        resp = self.client.get("/api/v1/admin/finance/by-product/?currency=CLP")
        self.assertEqual(resp.status_code, 200)
        results = resp.data["results"]
        item = next(r for r in results if r["product_name"] == self.product_with_cost.name)

        # Revenue: 2 * 150.000 = 300.000
        # Cost: 2 * 90.000 = 180.000
        # Profit: 300.000 - 180.000 = 120.000
        # Margin: (120.000 / 300.000) * 100 = 40.0%
        self.assertEqual(item["total_revenue"], 300000.0)
        self.assertEqual(item["total_cost"], 180000.0)
        self.assertEqual(item["profit"], 120000.0)
        self.assertEqual(item["margin"], 40.0)

    def test_fin04_margin_and_profitability_safe_handling_of_null_costs(self):
        """Productos sin costo conocido no deben inventar margen del 100% ni costo cero."""
        order = Order.objects.create(
            user=self.customer, email=self.customer.email, shipping_address="Dir",
            total=Decimal("100000"), currency="CLP", status=OrderStatus.PAID
        )
        OrderItem.objects.create(
            order=order, product=self.product_without_cost,
            product_name=self.product_without_cost.name,
            price=Decimal("50000"), quantity=2
        )

        resp = self.client.get("/api/v1/admin/finance/by-product/?currency=CLP")
        self.assertEqual(resp.status_code, 200)
        results = resp.data["results"]
        item = next(r for r in results if r["product_name"] == self.product_without_cost.name)

        self.assertEqual(item["total_revenue"], 100000.0)
        # Costo nulo no debe fabricarse
        self.assertIsNone(item["total_cost"])
        self.assertIsNone(item["profit"])
        self.assertIsNone(item["margin"])

    def test_fin04_margin_and_profitability_international_currency_isolation(self):
        """Ventas en USD/ARS no calculan margen contra costos en CLP sin ledger FX explícito."""
        order_usd = Order.objects.create(
            user=self.customer, email=self.customer.email, shipping_address="Intl",
            total=Decimal("300.00"), currency="USD", status=OrderStatus.PAID
        )
        OrderItem.objects.create(
            order=order_usd, product=self.product_with_cost,
            product_name=self.product_with_cost.name,
            price=Decimal("150.00"), quantity=2
        )

        resp = self.client.get("/api/v1/admin/finance/by-product/?currency=USD")
        self.assertEqual(resp.status_code, 200)
        results = resp.data["results"]
        item = results[0]
        self.assertEqual(item["total_revenue"], 300.0)
        self.assertEqual(item["currency"], "USD")
        self.assertIsNone(item["total_cost"])
        self.assertIsNone(item["profit"])
        self.assertIsNone(item["margin"])

    # ═══════════════════════════════════════════════════════════════
    # #39 (FIN-05): CONCILIACIÓN DE TRANSFERENCIAS BANCARIAS MANUALES
    # ═══════════════════════════════════════════════════════════════

    def test_fin05_manual_bank_transfer_reconciliation_approved(self):
        """Conciliación y aprobación manual de transferencia bancaria actualiza orden e ingresos."""
        # 1. Cliente crea orden y selecciona transferencia
        order = Order.objects.create(
            user=self.customer, email=self.customer.email, shipping_address="Stgo",
            total=Decimal("150000"), currency="CLP", status=OrderStatus.PENDING
        )
        OrderItem.objects.create(
            order=order, product=self.product_with_cost,
            product_name=self.product_with_cost.name,
            price=Decimal("150000"), quantity=1
        )
        payment = Payment.objects.create(
            order=order, provider=PaymentProvider.TRANSFER,
            currency="CLP", amount=Decimal("150000"),
            status=PaymentStatus.PENDING,
        )

        self.assertEqual(order.status, OrderStatus.PENDING)
        self.assertEqual(IncomeRecord.objects.filter(order=order).count(), 0)

        # 2. Administrador verifica comprobante bancario y aprueba el pago
        resp = self.client.patch(
            f"/api/v1/admin/payments/{payment.id}/status/",
            {"status": "approved"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        payment.refresh_from_db()
        self.assertEqual(payment.status, PaymentStatus.APPROVED)
        self.assertIsNotNone(payment.paid_at)

        # 3. La orden pasa automáticamente a 'paid'
        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.PAID)

        # 4. Se genera el IncomeRecord y la distribución contable correspondiente
        self.assertTrue(IncomeRecord.objects.filter(order=order).exists())
        record = IncomeRecord.objects.get(order=order)
        self.assertEqual(record.amount, Decimal("150000"))
        self.assertEqual(record.currency, "CLP")
        self.assertTrue(record.distributions.filter(category=self.cat_fixed).exists())

    def test_fin05_manual_bank_transfer_reconciliation_rejected(self):
        """Rechazo administrativo de transferencia cancela la orden y revierte registros."""
        order = Order.objects.create(
            user=self.customer, email=self.customer.email, shipping_address="Stgo",
            total=Decimal("150000"), currency="CLP", status=OrderStatus.PENDING
        )
        payment = Payment.objects.create(
            order=order, provider=PaymentProvider.TRANSFER,
            currency="CLP", amount=Decimal("150000"),
            status=PaymentStatus.PENDING,
        )

        resp = self.client.patch(
            f"/api/v1/admin/payments/{payment.id}/status/",
            {"status": "rejected"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        payment.refresh_from_db()
        self.assertEqual(payment.status, PaymentStatus.REJECTED)

        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.CANCELLED)
        self.assertFalse(IncomeRecord.objects.filter(order=order).exists())

    def test_fin05_bank_account_crud_and_currency_filtering(self):
        """Gestión de cuentas bancarias de transferencia y consulta de instrucciones por moneda."""
        # 1. Admin crea cuenta bancaria en CLP
        resp_create = self.client.post("/api/v1/payments/admin/bank-accounts/", {
            "label": "Cuenta Corriente Banco Estado",
            "payment_method": "transfer",
            "bank_name": "Banco Estado",
            "account_type": "Cuenta Corriente",
            "account_number": "123-456-789",
            "holder_name": "LevelPro Audio SpA",
            "holder_id": "76.123.456-7",
            "email": "pagos@levelproaudio.com",
            "currency": "CLP",
            "instructions": "Transferir con RUT y número de orden.",
            "is_active": True,
            "order": 1,
        }, format="json")
        self.assertEqual(resp_create.status_code, 201)
        account_id = resp_create.data["id"]

        # Activar el método transfer para CLP
        PaymentMethodConfig.objects.update_or_create(
            method="transfer",
            defaults={"is_active": True, "currencies": "CLP"}
        )

        # 2. Crear orden pendiente en CLP con intento de pago por transferencia
        order = Order.objects.create(
            user=self.customer, email=self.customer.email, shipping_address="Stgo",
            total=Decimal("80000"), currency="CLP", status=OrderStatus.PENDING
        )
        Payment.objects.create(
            order=order, provider=PaymentProvider.TRANSFER,
            amount=Decimal("80000"), currency="CLP",
            status=PaymentStatus.PENDING,
        )

        # 3. Consultar instrucciones públicas de transferencia para la orden como el cliente dueño
        cust_client = APIClient()
        cust_client.force_authenticate(user=self.customer)
        resp_inst = cust_client.get(f"/api/v1/payments/transfer/{order.id}/")
        self.assertEqual(resp_inst.status_code, 200)
        self.assertEqual(resp_inst.data["currency"], "CLP")
        self.assertEqual(resp_inst.data["state"], "ready")
        self.assertTrue(len(resp_inst.data["bank_accounts"]) >= 1)
        account_match = next(a for a in resp_inst.data["bank_accounts"] if str(a["id"]) == str(account_id))
        self.assertEqual(account_match["bank_name"], "Banco Estado")
        self.assertEqual(account_match["account_number"], "123-456-789")
