"""Regresiones: puntos CLP nunca se acreditan ni se canjean como USD/ARS."""
from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import User
from apps.orders.models import Order, OrderStatus
from apps.products.models import Category, Product
from apps.loyalty.models import LoyaltyAccount, LoyaltyTransaction


class LoyaltyCurrencyGuardTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="loyalty-currency@example.test", username="loyalty-currency", password="x"
        )
        category = Category.objects.create(name="Guard CLP", slug="guard-clp")
        self.product = Product.objects.create(
            name="Producto CLP", slug="producto-guard-clp",
            category=category, price=Decimal("50000"),
            price_usd=Decimal("50"), price_ars=Decimal("70000"),
            stock=10, is_active=True,
        )
        self.account = LoyaltyAccount.objects.create(
            user=self.user, puntos_totales=2000
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_foreign_paid_orders_never_accrue_peso_based_points(self):
        for currency, total in [("USD", "100"), ("ARS", "70000")]:
            with self.subTest(currency=currency):
                order = Order.objects.create(
                    user=self.user, currency=currency, total=Decimal(total),
                    status=OrderStatus.PENDING, email=self.user.email,
                    shipping_address="Prueba",
                )
                order.status = OrderStatus.PAID
                order.save(update_fields=["status"])
        self.account.refresh_from_db()
        self.assertEqual(self.account.puntos_totales, 2000)
        self.assertFalse(LoyaltyTransaction.objects.filter(tipo="earn").exists())

    def test_foreign_checkout_rejects_clp_points_before_writing_order(self):
        for currency in ("USD", "ARS"):
            with self.subTest(currency=currency):
                response = self.client.post("/api/v1/orders/", {
                    "items": [{"product": str(self.product.id), "quantity": 1}],
                    "shipping_address": "Test", "currency": currency,
                    "loyalty_points_redeemed": 500,
                }, format="json")
                self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(Order.objects.count(), 0)
        self.account.refresh_from_db()
        self.assertEqual(self.account.puntos_canjeados, 0)

    def test_foreign_checkout_without_redemption_remains_available(self):
        response = self.client.post("/api/v1/orders/", {
            "items": [{"product": str(self.product.id), "quantity": 1}],
            "shipping_address": "Test", "currency": "USD",
            "loyalty_points_redeemed": 0,
        }, format="json")
        self.assertEqual(response.status_code, 201, getattr(response, "data", None))
        order = Order.objects.get()
        self.assertEqual(order.currency, "USD")
        self.assertEqual(order.total, Decimal("50"))
        self.assertEqual(order.loyalty_discount, 0)
        self.account.refresh_from_db()
        self.assertEqual(self.account.puntos_canjeados, 0)
