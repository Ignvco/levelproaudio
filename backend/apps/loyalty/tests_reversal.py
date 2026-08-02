# apps/loyalty/tests_reversal.py
#
# Antes, cancelar/reembolsar una orden no le quitaba los puntos al cliente
# — podía comprar, ganar puntos, cancelar, y quedarse con los puntos.
# Estos tests cubren el signal reverse_points_on_cancellation.

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.products.models import Category, Product
from apps.orders.models import Order, OrderStatus
from apps.loyalty.models import LoyaltyAccount, LoyaltyConfig, LoyaltyTransaction

User = get_user_model()


class ReversePointsOnCancellationTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="rev@test.com", username="rev", password="x"
        )
        LoyaltyConfig.get()  # defaults: puntos_por_peso=0.01

    def _paid_order(self, total):
        return Order.objects.create(
            user=self.user, status=OrderStatus.PAID, total=Decimal(str(total)),
            email=self.user.email, shipping_address="Test 123",
        )

    def test_cancelling_order_reverses_its_points(self):
        order = self._paid_order(200000)  # gana 2000 pts (0.01 * 200000)
        account = LoyaltyAccount.objects.get(user=self.user)
        self.assertEqual(account.puntos_disponibles, 2000)

        order.status = OrderStatus.CANCELLED
        order.save()

        account.refresh_from_db()
        self.assertEqual(account.puntos_disponibles, 0)
        self.assertTrue(
            LoyaltyTransaction.objects.filter(
                orden=order, tipo="adjust", puntos=-2000
            ).exists()
        )

    def test_cancelling_unpaid_order_does_nothing(self):
        order = Order.objects.create(
            user=self.user, status=OrderStatus.PENDING, total=Decimal("50000"),
            email=self.user.email, shipping_address="Test 123",
        )
        order.status = OrderStatus.CANCELLED
        order.save()
        # Nunca ganó puntos, así que no debería existir ninguna cuenta ni movimiento.
        self.assertFalse(LoyaltyAccount.objects.filter(user=self.user).exists())

    def test_cancellation_reversal_is_idempotent(self):
        order = self._paid_order(200000)
        order.status = OrderStatus.CANCELLED
        order.save()
        order.save()  # dispara el signal de nuevo (post_save en cada save())

        account = LoyaltyAccount.objects.get(user=self.user)
        self.assertEqual(account.puntos_disponibles, 0)
        self.assertEqual(
            LoyaltyTransaction.objects.filter(orden=order, tipo="adjust").count(), 1
        )

    def test_reversal_does_not_go_below_zero_if_already_spent_elsewhere(self):
        order = self._paid_order(100000)  # gana 1000 pts
        account = LoyaltyAccount.objects.get(user=self.user)
        # El cliente ya gastó esos puntos en otra compra antes de la cancelación.
        account.canjear_puntos(1000, descripcion="gastados en otra orden")

        order.status = OrderStatus.CANCELLED
        order.save()

        account.refresh_from_db()
        # No puede quedar en negativo — el piso es 0.
        self.assertEqual(account.puntos_disponibles, 0)
