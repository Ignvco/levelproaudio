"""Regression coverage for the public checkout and payment creation contract."""
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.orders.models import Order
from apps.payments.models import BankAccount, Payment, PaymentMethodConfig


METHODS_URL = "/api/v1/payments/methods/"
CREATE_URL = "/api/v1/payments/create/"


class CheckoutPaymentAvailabilityTest(TestCase):
    def setUp(self):
        PaymentMethodConfig.objects.all().delete()
        self.user = get_user_model().objects.create_user(
            email="availability@example.test", username="availability", password="x"
        )
        self.order = Order.objects.create(
            user=self.user, email=self.user.email, shipping_address="Test",
            total=Decimal("25000"), currency="CLP", status="pending",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def enable(self, provider, currencies=""):
        return PaymentMethodConfig.objects.create(
            method=provider, is_active=True, currencies=currencies
        )

    def add_account(self, provider="transfer", currency="CLP", active=True):
        return BankAccount.objects.create(
            label="Test", bank_name="Test bank", account_number="123",
            holder_name="LevelPro", payment_method=provider, currency=currency,
            is_active=active,
        )

    def create(self, provider):
        return self.client.post(
            CREATE_URL, {"order_id": str(self.order.pk), "provider": provider},
            format="json",
        )

    def methods(self, currency):
        response = self.client.get(METHODS_URL, {"currency": currency})
        self.assertEqual(response.status_code, 200)
        return [entry["id"] for entry in response.data["methods"]]

    def test_inactive_provider_cannot_create_payment(self):
        PaymentMethodConfig.objects.create(method="paypal", is_active=False)
        self.assertNotIn("paypal", self.methods("CLP"))
        self.assertEqual(self.create("paypal").status_code, 400)
        self.assertFalse(Payment.objects.exists())

    def test_active_transfer_without_account_is_not_payable(self):
        self.enable("transfer", "CLP")
        self.assertNotIn("transfer", self.methods("CLP"))
        self.assertEqual(self.create("transfer").status_code, 400)
        self.assertFalse(Payment.objects.exists())

    def test_inactive_or_wrong_method_account_is_not_accepted(self):
        self.enable("transfer")
        self.add_account(active=False)
        self.add_account(provider="payoneer")
        self.assertNotIn("transfer", self.methods("CLP"))
        self.assertEqual(self.create("transfer").status_code, 400)
        self.assertFalse(Payment.objects.exists())

    def test_active_transfer_with_account_can_create_pending_payment(self):
        self.enable("transfer", "CLP")
        self.add_account()
        self.assertIn("transfer", self.methods("CLP"))
        response = self.create("transfer")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["status"], "pending")
        self.assertEqual(Payment.objects.get(order=self.order).currency, "CLP")

    def test_currency_restriction_cannot_be_bypassed_by_post(self):
        self.enable("transfer", "USD")
        self.add_account(currency="CLP")
        self.assertNotIn("transfer", self.methods("CLP"))
        self.assertEqual(self.create("transfer").status_code, 400)
        self.assertFalse(Payment.objects.exists())

    def test_payoneer_only_available_in_usd(self):
        self.enable("payoneer")
        self.add_account(provider="payoneer", currency="USD")
        self.assertNotIn("payoneer", self.methods("CLP"))
        self.assertIn("payoneer", self.methods("USD"))
        self.assertEqual(self.create("payoneer").status_code, 400)

    def test_paypal_ars_is_not_shown_even_with_unrestricted_admin_config(self):
        self.enable("paypal")
        self.order.currency = "ARS"
        self.order.save(update_fields=["currency"])
        self.assertNotIn("paypal", self.methods("ARS"))
        self.assertEqual(self.create("paypal").status_code, 400)
        self.assertFalse(Payment.objects.exists())

    def test_marketplace_country_currency_mismatch_is_rejected(self):
        self.enable("mercadopago_cl")
        self.order.currency = "ARS"
        self.order.save(update_fields=["currency"])
        self.assertNotIn("mercadopago_cl", self.methods("ARS"))
        self.assertEqual(self.create("mercadopago_cl").status_code, 400)

    def test_placeholder_dlocal_cannot_be_offered_as_operational(self):
        self.enable("dlocal")
        self.assertNotIn("dlocal", self.methods("CLP"))
        self.assertEqual(self.create("dlocal").status_code, 400)
        self.assertFalse(Payment.objects.exists())

    @override_settings(GLOBAL66_ALIAS="")
    def test_global66_without_alias_is_not_payable(self):
        self.enable("global66", "CLP")
        self.assertNotIn("global66", self.methods("CLP"))
        self.assertEqual(self.create("global66").status_code, 400)
        self.assertFalse(Payment.objects.exists())

    @override_settings(GLOBAL66_ALIAS="TEST-ALIAS")
    def test_global66_can_be_offered_only_when_configured(self):
        self.enable("global66", "CLP")
        self.assertIn("global66", self.methods("CLP"))
        self.assertNotIn("global66", self.methods("ARS"))

    def test_invalid_provider_never_calls_gateway(self):
        with patch("apps.payments.views.create_paypal_order") as gateway:
            response = self.create("cash")
        self.assertEqual(response.status_code, 400)
        gateway.assert_not_called()
