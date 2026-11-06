"""Regression: financial dashboard, analytics and payment aggregates cannot mix currencies."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from apps.orders.models import Order, OrderStatus
from apps.payments.models import Payment, PaymentProvider, PaymentStatus


class CurrencyScopedReportingTest(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.admin = user_model.objects.create_superuser(
            email="currency-admin@example.test", username="currency-admin", password="x"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.orders = {}
        for code, amount in [("CLP", "1000"), ("USD", "25"), ("ARS", "3000")]:
            order = Order.objects.create(
                status=OrderStatus.PAID, total=Decimal(amount), currency=code,
                email=f"{code.lower()}@example.test", shipping_address="Test",
            )
            self.orders[code] = order
            Payment.objects.create(
                order=order, provider=PaymentProvider.TRANSFER,
                status=PaymentStatus.APPROVED, amount=Decimal(amount), currency=code,
            )

    def test_dashboard_currency_is_not_implicitly_converted_or_summed(self):
        for code, expected in [("CLP", 1000), ("USD", 25), ("ARS", 3000)]:
            response = self.client.get("/api/v1/admin/dashboard/", {"currency": code})
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data["currency"], code)
            self.assertEqual(response.data["revenue"]["total"], expected)
            self.assertEqual(response.data["revenue_by_currency"], {"CLP": 1000, "USD": 25, "ARS": 3000})
            self.assertTrue(all(row["total"] == expected for row in response.data["sales_chart"]))

    def test_analytics_scoped_kpis_series_providers_and_categories(self):
        for code, expected in [("CLP", 1000), ("USD", 25), ("ARS", 3000)]:
            response = self.client.get("/api/v1/admin/analytics/", {"currency": code})
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data["currency"], code)
            self.assertEqual(response.data["kpis"]["total_revenue"], expected)
            self.assertEqual(response.data["kpis"]["avg_order_value"], expected)
            self.assertEqual(sum(row["total"] for row in response.data["sales_by_month"]), expected)
            self.assertEqual(sum(row["total"] for row in response.data["revenue_by_provider"]), expected)

    def test_admin_payments_total_approved_is_currency_scoped(self):
        for code, expected in [("CLP", 1000), ("USD", 25), ("ARS", 3000)]:
            response = self.client.get("/api/v1/admin/payments/", {"currency": code})
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data["total_approved"], expected)
            self.assertEqual(response.data["currency"], code)
            self.assertTrue(all(row["currency"] == code for row in response.data["results"]))

    def test_invalid_currency_is_rejected(self):
        for endpoint in ("dashboard/", "analytics/", "payments/"):
            response = self.client.get(f"/api/v1/admin/{endpoint}", {"currency": "EUR"})
            self.assertEqual(response.status_code, 400)
            self.assertFalse("total" in response.data)

    def test_legacy_default_is_explicitly_clp_only(self):
        for endpoint in ("dashboard/", "analytics/", "payments/"):
            response = self.client.get(f"/api/v1/admin/{endpoint}")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["currency"], "CLP")
