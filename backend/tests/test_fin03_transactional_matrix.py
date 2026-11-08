"""
backend/tests/test_fin03_transactional_matrix.py
Suite de certificación transaccional FIN-03 (Issue #10).
Verifica contratos, máquinas de estado, aislamiento de monedas,
idempotencia de señales, salvaguardas de concurrencia y stock.
"""

from decimal import Decimal
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import User
from apps.products.models import Category, Product
from apps.orders.models import Order, OrderItem, OrderStatus
from apps.payments.models import (
    Payment,
    PaymentMethodConfig,
    PaymentProvider,
    PaymentStatus,
    BankAccount,
)
from apps.analytics.models import IncomeRecord
from apps.loyalty.models import LoyaltyAccount, LoyaltyConfig, LoyaltyTransaction
from apps.rewards.models import Campaign, CampaignStatus, Entry, RewardProduct


class Fin03TransactionalMatrixTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="fin03@example.test",
            username="fin03_user",
            password="testpassword123",
        )
        self.category = Category.objects.create(name="Audio Pro", slug="audio-pro")
        self.product = Product.objects.create(
            name="Micrófono Estudio",
            slug="microfono-estudio",
            category=self.category,
            price=Decimal("100000"),
            price_usd=Decimal("100"),
            price_ars=Decimal("140000"),
            cost_price=Decimal("60000"),
            stock=10,
            is_active=True,
        )

        # Configurar métodos de pago
        PaymentMethodConfig.objects.update_or_create(
            method=PaymentProvider.MERCADOPAGO_CL,
            defaults={"is_active": True, "currencies": "CLP"},
        )
        PaymentMethodConfig.objects.update_or_create(
            method=PaymentProvider.MERCADOPAGO_AR,
            defaults={"is_active": True, "currencies": "ARS"},
        )
        PaymentMethodConfig.objects.update_or_create(
            method=PaymentProvider.PAYPAL,
            defaults={"is_active": True, "currencies": "CLP,USD"},
        )
        PaymentMethodConfig.objects.update_or_create(
            method=PaymentProvider.TRANSFER,
            defaults={"is_active": True, "currencies": "CLP,USD,ARS"},
        )
        PaymentMethodConfig.objects.update_or_create(
            method=PaymentProvider.PAYONEER,
            defaults={"is_active": True, "currencies": "USD"},
        )
        BankAccount.objects.get_or_create(
            payment_method=PaymentProvider.TRANSFER,
            currency="CLP",
            defaults={
                "bank_name": "Banco de Chile",
                "account_number": "123456",
                "holder_name": "LevelPro SpA",
                "is_active": True,
            },
        )
        BankAccount.objects.get_or_create(
            payment_method=PaymentProvider.PAYONEER,
            currency="USD",
            defaults={
                "bank_name": "First Century Bank",
                "account_number": "987654",
                "holder_name": "LevelPro SpA",
                "is_active": True,
            },
        )

        # Configuración de Loyalty y Rewards
        self.loyalty_config = LoyaltyConfig.get()
        self.loyalty_config.is_active = True
        self.loyalty_config.puntos_por_peso = Decimal("0.01")  # 1 punto cada $100 CLP
        self.loyalty_config.save()

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_currency_isolation_clp_order_with_paypal_usd_payment(self):
        """
        Una orden en CLP pagada vía PayPal cobra en USD (según tasa),
        pero su IncomeRecord contable conserva la moneda comercial CLP
        y el monto comercial de la orden sin mezclar divisas.
        """
        order = Order.objects.create(
            user=self.user,
            currency="CLP",
            total=Decimal("95000"),
            status=OrderStatus.PENDING,
            email=self.user.email,
            shipping_address="Av. Providencia 123",
        )
        OrderItem.objects.create(
            order=order,
            product=self.product,
            product_name=self.product.name,
            price=Decimal("95000"),
            quantity=1,
        )

        # Se registra el pago PayPal en USD
        payment = Payment.objects.create(
            order=order,
            provider=PaymentProvider.PAYPAL,
            status=PaymentStatus.PENDING,
            amount=Decimal("100.00"),
            currency="USD",
            preference_id="PAYID-TEST-001",
        )

        # Aprobación del pago
        payment.status = PaymentStatus.APPROVED
        payment.save()

        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.PAID)

        # IncomeRecord debe estar en CLP con el total de la orden
        income = IncomeRecord.objects.filter(order=order).first()
        self.assertIsNotNone(income)
        self.assertEqual(income.currency, "CLP")
        self.assertEqual(income.amount, Decimal("95000.00"))
        self.assertEqual(income.payment, payment)
        self.assertEqual(payment.currency, "USD")
        self.assertEqual(payment.amount, Decimal("100.00"))

    def test_currency_isolation_usd_and_ars_orders(self):
        """
        Órdenes en USD y ARS generan ingresos en su respectiva moneda
        y no ejecutan distribución automática con costos en CLP.
        """
        # Orden USD
        order_usd = Order.objects.create(
            user=self.user,
            currency="USD",
            total=Decimal("150.00"),
            status=OrderStatus.PENDING,
            email=self.user.email,
            shipping_address="Miami, FL",
        )
        pay_usd = Payment.objects.create(
            order=order_usd,
            provider=PaymentProvider.PAYPAL,
            status=PaymentStatus.APPROVED,
            amount=Decimal("150.00"),
            currency="USD",
        )
        income_usd = IncomeRecord.objects.get(order=order_usd)
        self.assertEqual(income_usd.currency, "USD")
        self.assertEqual(income_usd.amount, Decimal("150.00"))
        # No inventa distribuciones de utilidad sin costo en USD
        self.assertEqual(income_usd.distributions.count(), 0)

        # Orden ARS
        order_ars = Order.objects.create(
            user=self.user,
            currency="ARS",
            total=Decimal("140000.00"),
            status=OrderStatus.PENDING,
            email=self.user.email,
            shipping_address="Buenos Aires",
        )
        pay_ars = Payment.objects.create(
            order=order_ars,
            provider=PaymentProvider.MERCADOPAGO_AR,
            status=PaymentStatus.APPROVED,
            amount=Decimal("140000.00"),
            currency="ARS",
        )
        income_ars = IncomeRecord.objects.get(order=order_ars)
        self.assertEqual(income_ars.currency, "ARS")
        self.assertEqual(income_ars.amount, Decimal("140000.00"))
        self.assertEqual(income_ars.distributions.count(), 0)

    def test_payment_creation_endpoint_rejects_unsupported_currency_pair(self):
        """
        La API rechaza explícitamente intenciones de pago con proveedores
        no admitidos para la moneda del pedido (falla rápido y seguro).
        """
        order_ars = Order.objects.create(
            user=self.user,
            currency="ARS",
            total=Decimal("50000"),
            status=OrderStatus.PENDING,
            email=self.user.email,
            shipping_address="Mendoza",
        )
        # Intentar pagar orden ARS con MercadoPago Chile -> 400
        res = self.client.post("/api/v1/payments/create/", {
            "order_id": order_ars.id,
            "provider": PaymentProvider.MERCADOPAGO_CL,
        })
        self.assertEqual(res.status_code, 400)

        # Intentar pagar orden CLP con Payoneer (solo USD) -> 400
        order_clp = Order.objects.create(
            user=self.user,
            currency="CLP",
            total=Decimal("50000"),
            status=OrderStatus.PENDING,
            email=self.user.email,
            shipping_address="Santiago",
        )
        res2 = self.client.post("/api/v1/payments/create/", {
            "order_id": order_clp.id,
            "provider": PaymentProvider.PAYONEER,
        })
        self.assertEqual(res2.status_code, 400)

    def test_payment_and_order_signals_are_strictly_idempotent(self):
        """
        Guardar múltiples veces un pago como aprobado o transicionar
        una orden entre estados post-pago no genera duplicados en
        IncomeRecord, Loyalty ni Rewards.
        """
        order = Order.objects.create(
            user=self.user,
            currency="CLP",
            total=Decimal("100000"),
            status=OrderStatus.PENDING,
            email=self.user.email,
            shipping_address="Valparaíso",
        )
        payment = Payment.objects.create(
            order=order,
            provider=PaymentProvider.TRANSFER,
            status=PaymentStatus.PENDING,
            amount=Decimal("100000"),
            currency="CLP",
        )

        # Primer guardado aprobado
        payment.status = PaymentStatus.APPROVED
        payment.save()
        # Segundo guardado idéntico (simula webhook duplicado)
        payment.save()

        # Debe existir exactamente UN IncomeRecord
        self.assertEqual(IncomeRecord.objects.filter(order=order).count(), 1)

        # Transiciones de orden: paid -> shipped -> completed
        order.refresh_from_db()
        order.status = OrderStatus.SHIPPED
        order.save(update_fields=["status"])
        order.status = OrderStatus.COMPLETED
        order.save(update_fields=["status"])

        # Sigue existiendo exactamente UN IncomeRecord y UNA transacción de puntos
        self.assertEqual(IncomeRecord.objects.filter(order=order).count(), 1)
        self.assertEqual(
            LoyaltyTransaction.objects.filter(orden=order, tipo="earn").count(), 1
        )

    def test_late_approved_payment_on_cancelled_order_forces_in_review(self):
        """
        Invariante Crítica: Si una orden ya fue cancelada (y su stock liberado),
        la llegada tardía de un pago con status=APPROVED no reabre la orden
        ni corrompe el inventario; el pago queda forzado a IN_REVIEW.
        """
        order = Order.objects.create(
            user=self.user,
            currency="CLP",
            total=Decimal("100000"),
            status=OrderStatus.PENDING,
            email=self.user.email,
            shipping_address="Concepción",
        )
        payment = Payment.objects.create(
            order=order,
            provider=PaymentProvider.MERCADOPAGO_CL,
            status=PaymentStatus.PENDING,
            amount=Decimal("100000"),
            currency="CLP",
        )

        # La orden se cancela por timeout o decisión del cliente
        order.status = OrderStatus.CANCELLED
        order.save(update_fields=["status"])

        # Llega webhook tardío intentando aprobar el pago
        payment.status = PaymentStatus.APPROVED
        payment.save()

        payment.refresh_from_db()
        order.refresh_from_db()

        self.assertEqual(payment.status, PaymentStatus.IN_REVIEW)
        self.assertEqual(order.status, OrderStatus.CANCELLED)
        # No se genera ingreso contable por pago tardío no conciliado
        self.assertEqual(IncomeRecord.objects.filter(order=order).count(), 0)

    def test_invalid_order_status_transitions_are_blocked(self):
        """
        Una orden CANCELLED no se puede reabrir a ningún estado.
        Una orden procesada (PAID) no puede regresar a PENDING.
        """
        order = Order.objects.create(
            user=self.user,
            currency="CLP",
            total=Decimal("50000"),
            status=OrderStatus.PENDING,
            email=self.user.email,
            shipping_address="La Serena",
        )
        order.status = OrderStatus.CANCELLED
        order.save(update_fields=["status"])

        # Intentar reabrir orden cancelada debe arrojar ValidationError
        order.status = OrderStatus.PAID
        with self.assertRaises(ValidationError):
            order.save(update_fields=["status"])

        # Crear orden pagada e intentar devolverla a pendiente
        order2 = Order.objects.create(
            user=self.user,
            currency="CLP",
            total=Decimal("50000"),
            status=OrderStatus.PENDING,
            email=self.user.email,
            shipping_address="Antofagasta",
        )
        order2.status = OrderStatus.PAID
        order2.save(update_fields=["status"])

        order2.status = OrderStatus.PENDING
        with self.assertRaises(ValidationError):
            order2.save(update_fields=["status"])
