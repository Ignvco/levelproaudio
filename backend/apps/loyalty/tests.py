"""
apps/loyalty/tests.py — tests del flujo completo.
"""
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model

from apps.products.models import Product, Category
from apps.orders.models   import Order, OrderItem, OrderStatus
from apps.loyalty.models  import LoyaltyAccount, LoyaltyConfig, LoyaltyTransaction


User = get_user_model()


class LoyaltyFlowTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="ly@test.com", username="ly", password="x"
        )
        cat = Category.objects.create(name="Mics", slug="lm")
        self.product = Product.objects.create(
            name="SM7B", slug="sm7b-loyalty",
            price=Decimal("200000"), stock=5, category=cat,
        )
        # Config default: puntos_por_peso=0.01 (1 pto cada $100), peso_por_punto=1
        LoyaltyConfig.get()

    def _pay_order(self, user, total):
        order = Order.objects.create(
            user=user, email=user.email,
            shipping_address="dir", total=total,
            status=OrderStatus.PENDING,
        )
        OrderItem.objects.create(
            order=order, product=self.product,
            product_name=self.product.name,
            price=Decimal(total), quantity=1,
        )
        order.status = OrderStatus.PAID
        order.save()
        return order

    def test_points_awarded_on_purchase(self):
        self._pay_order(self.user, 200000)
        account = LoyaltyAccount.objects.get(user=self.user)
        # 200000 * 0.01 = 2000 puntos
        self.assertEqual(account.puntos_totales, 2000)
        self.assertEqual(account.nivel, "silver")  # ≥1000

    def test_points_idempotent(self):
        order = self._pay_order(self.user, 100000)
        # Simular re-save (no debe duplicar puntos)
        order.save()
        order.save()
        account = LoyaltyAccount.objects.get(user=self.user)
        self.assertEqual(account.puntos_totales, 1000)

    def test_redeem_points_directly(self):
        self._pay_order(self.user, 100000)   # +1000 pts
        account = LoyaltyAccount.objects.get(user=self.user)
        descuento = account.canjear_puntos(500, "Canje test")
        self.assertEqual(descuento, 500)  # 500 pts × $1 = $500
        self.assertEqual(account.puntos_disponibles, 500)

    def test_redeem_below_minimum_raises(self):
        self._pay_order(self.user, 100000)
        account = LoyaltyAccount.objects.get(user=self.user)
        with self.assertRaises(ValueError):
            account.canjear_puntos(100, "Muy poco")   # < mínimo 500

    def test_redeem_more_than_available_raises(self):
        self._pay_order(self.user, 50000)  # 500 pts totales
        account = LoyaltyAccount.objects.get(user=self.user)
        with self.assertRaises(ValueError):
            account.canjear_puntos(1000, "Excede")

    def test_level_progression(self):
        account, _ = LoyaltyAccount.objects.get_or_create(user=self.user)
        account.agregar_puntos(4000, "test")
        self.assertEqual(account.nivel, "silver")
        account.agregar_puntos(1500, "test")   # total 5500 → gold
        self.assertEqual(account.nivel, "gold")
        account.agregar_puntos(10000, "test")  # total 15500 → platinum
        self.assertEqual(account.nivel, "platinum")
