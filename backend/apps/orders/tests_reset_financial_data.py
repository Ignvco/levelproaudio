# apps/orders/tests_reset_financial_data.py
#
# Valida el comando reset_test_financial_data de punta a punta: dry-run
# no toca nada, --confirm sí borra/restaura todo lo prometido.

from decimal import Decimal
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from apps.products.models import Category, Product
from apps.orders.models import Order, OrderItem, OrderStatus
from apps.payments.models import Payment, PaymentProvider, PaymentStatus
from apps.analytics.models import DistributionCategory, IncomeRecord, IncomeDistribution, Withdrawal
from apps.loyalty.models import LoyaltyAccount, LoyaltyTransaction

User = get_user_model()


class ResetTestFinancialDataTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="buyer@test.com", username="buyer", password="x")
        self.category = Category.objects.create(name="Mics", slug="mics-reset")
        self.product = Product.objects.create(
            name="SM7B", slug="sm7b-reset", category=self.category,
            price=Decimal("100000"), stock=2, is_active=True,
        )
        self.order = Order.objects.create(
            user=self.user, status=OrderStatus.PAID, total=Decimal("100000"),
            email=self.user.email, shipping_address="Test 123",
        )
        OrderItem.objects.create(
            order=self.order, product=self.product, product_name=self.product.name,
            price=self.product.price, quantity=3,  # compró 3, quedó con stock=2
        )
        self.payment = Payment.objects.create(
            order=self.order, provider=PaymentProvider.TRANSFER,
            status=PaymentStatus.APPROVED, amount=self.order.total,
        )
        self.fin_category = DistributionCategory.objects.create(
            name="IVA", cat_type="percent", percentage=Decimal("19")
        )
        self.income = IncomeRecord.objects.create(
            order=self.order, payment=self.payment, amount=self.order.total, source="payment"
        )
        IncomeDistribution.objects.create(
            income_record=self.income, category=self.fin_category, amount=Decimal("19000")
        )
        Withdrawal.objects.create(
            category=self.fin_category, amount=Decimal("5000"), destination="Banco Estado"
        )
        self.account, _ = LoyaltyAccount.objects.update_or_create(
            user=self.user,
            defaults=dict(puntos_totales=1000, puntos_canjeados=200, nivel="silver"),
        )
        LoyaltyTransaction.objects.create(
            account=self.account, tipo="earn", puntos=1000, orden=self.order,
        )

    def test_dry_run_changes_nothing(self):
        out = StringIO()
        call_command("reset_test_financial_data", stdout=out)

        self.assertTrue(Order.objects.filter(id=self.order.id).exists())
        self.assertTrue(Payment.objects.filter(id=self.payment.id).exists())
        self.assertTrue(IncomeRecord.objects.filter(id=self.income.id).exists())
        self.assertTrue(Withdrawal.objects.exists())
        self.account.refresh_from_db()
        self.assertEqual(self.account.puntos_totales, 1000)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 2)  # no restaurado todavía
        self.assertIn("dry-run", out.getvalue())

    def test_confirm_deletes_everything_and_restores_stock(self):
        call_command("reset_test_financial_data", "--confirm")

        self.assertFalse(Order.objects.exists())
        self.assertFalse(OrderItem.objects.exists())
        self.assertFalse(Payment.objects.exists())
        self.assertFalse(IncomeRecord.objects.exists())
        self.assertFalse(IncomeDistribution.objects.exists())
        self.assertFalse(Withdrawal.objects.exists())
        self.assertFalse(LoyaltyTransaction.objects.exists())

        self.account.refresh_from_db()
        self.assertEqual(self.account.puntos_totales, 0)
        self.assertEqual(self.account.puntos_canjeados, 0)
        self.assertEqual(self.account.nivel, "bronze")

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 5)  # 2 + 3 restaurados

    def test_distribution_category_itself_survives(self):
        """Solo se borran los MOVIMIENTOS, no la configuración de categorías."""
        call_command("reset_test_financial_data", "--confirm")
        self.assertTrue(DistributionCategory.objects.filter(id=self.fin_category.id).exists())

    def test_product_and_user_survive(self):
        """Solo se borran órdenes/pagos/finanzas — no el catálogo ni las cuentas de usuario."""
        call_command("reset_test_financial_data", "--confirm")
        self.assertTrue(Product.objects.filter(id=self.product.id).exists())
        self.assertTrue(User.objects.filter(id=self.user.id).exists())
        self.assertTrue(LoyaltyAccount.objects.filter(id=self.account.id).exists())
