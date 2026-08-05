# apps/orders/tests_throttling.py
#
# Antes, crear una orden no tenía ningún límite de velocidad — y como
# crear una orden DESCUENTA STOCK de inmediato (antes de que se pague),
# alguien podía spamear pedidos falsos para agotar el stock de un
# producto y bloquear a clientes reales, sin pagar un peso. Confirma
# que ahora hay un límite real (20/hora por usuario).

from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.products.models import Category, Product

User = get_user_model()


class OrderCreateThrottleTest(TestCase):
    def setUp(self):
        cache.clear()  # el throttle comparte cache entre tests
        self.user = User.objects.create_user(
            email="throttlebuyer@test.com", username="throttlebuyer", password="x"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        category = Category.objects.create(name="Mics", slug="mics-throttle")
        self.product = Product.objects.create(
            name="Micrófono con poco stock", slug="mic-poco-stock", category=category,
            price=Decimal("50000"), stock=100, is_active=True,
        )

    def _create_order(self):
        return self.client.post("/api/v1/orders/", {
            "items": [{"product": str(self.product.id), "quantity": 1}],
            "shipping_address": "Test 123",
        }, format="json")

    def test_order_creation_gets_throttled_after_limit(self):
        """El límite real es 20/hora — confirma que efectivamente corta ahí."""
        statuses = [self._create_order().status_code for _ in range(22)]

        successful = [s for s in statuses if s == 201]
        throttled  = [s for s in statuses if s == 429]

        self.assertEqual(len(successful), 20)
        self.assertEqual(len(throttled), 2)

    def test_listing_own_orders_is_not_throttled(self):
        """El throttle debe aplicar SOLO a crear, no a listar/ver órdenes propias."""
        for _ in range(25):
            resp = self.client.get("/api/v1/orders/")
            self.assertEqual(resp.status_code, 200)
