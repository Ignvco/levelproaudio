# apps/orders/tests_multicurrency.py
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.products.models import Category, Product
from apps.site_settings.models import SiteSettings

User = get_user_model()


class OrderMultiCurrencyTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="mc@test.com", username="mc", password="x")
        self.cat = Category.objects.create(name="Audio", slug="audio-omc")
        # Producto con precios manuales en las 3 monedas
        self.product = Product.objects.create(
            name="Interfaz", slug="interfaz-omc", category=self.cat,
            price=Decimal("100000"), price_usd=Decimal("105"),
            price_ars=Decimal("120000"), stock=10, is_active=True)
        SiteSettings.objects.create(usd_to_clp=Decimal("950"), usd_to_ars=Decimal("1000"))
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _order_payload(self, currency):
        return {
            "email": "mc@test.com",
            "shipping_address": "Calle 1",
            "currency": currency,
            "items": [{"product": str(self.product.id), "product_name": "Interfaz",
                       "price": "999", "quantity": 1}],  # price mandado se ignora
        }

    def test_order_in_clp_uses_clp_price(self):
        resp = self.client.post("/api/v1/orders/", self._order_payload("CLP"), format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["currency"], "CLP")
        self.assertEqual(Decimal(resp.data["total"]), Decimal("100000"))

    def test_order_in_usd_uses_usd_price(self):
        resp = self.client.post("/api/v1/orders/", self._order_payload("USD"), format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["currency"], "USD")
        # Usa el precio USD manual (105), NO el que mandó el cliente (999)
        self.assertEqual(Decimal(resp.data["total"]), Decimal("105"))

    def test_order_in_ars_uses_ars_price(self):
        resp = self.client.post("/api/v1/orders/", self._order_payload("ARS"), format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(Decimal(resp.data["total"]), Decimal("120000"))

    def test_invalid_currency_defaults_clp(self):
        resp = self.client.post("/api/v1/orders/", self._order_payload("XXX"), format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["currency"], "CLP")

    def test_usd_calculated_when_no_manual_price(self):
        # Producto sin precio USD manual → se calcula con la tasa
        p2 = Product.objects.create(
            name="Cable", slug="cable-omc", category=self.cat,
            price=Decimal("95000"), stock=5, is_active=True)
        payload = {
            "email": "mc@test.com", "shipping_address": "Calle 1", "currency": "USD",
            "items": [{"product": str(p2.id), "product_name": "Cable",
                       "price": "1", "quantity": 1}],
        }
        resp = self.client.post("/api/v1/orders/", payload, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        # 95000 / 950 = 100 USD
        self.assertEqual(Decimal(resp.data["total"]), Decimal("100.00"))


class PayoneerPaymentTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="pay@test.com", username="pay", password="x")
        self.cat = Category.objects.create(name="Audio", slug="audio-pay")
        self.product = Product.objects.create(
            name="Mic", slug="mic-pay", category=self.cat,
            price=Decimal("100000"), price_usd=Decimal("105"), stock=10, is_active=True)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_payoneer_creates_pending_payment(self):
        from apps.payments.models import Payment
        order_resp = self.client.post("/api/v1/orders/", {
            "email": "pay@test.com", "shipping_address": "Calle 1", "currency": "USD",
            "items": [{"product": str(self.product.id), "product_name": "Mic",
                       "price": "105", "quantity": 1}],
        }, format="json")
        order_id = order_resp.data["id"]
        resp = self.client.post("/api/v1/payments/create/", {
            "order_id": order_id, "provider": "payoneer",
        }, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["status"], "pending")
        payment = Payment.objects.get(order_id=order_id, provider="payoneer")
        self.assertEqual(payment.currency, "USD")
