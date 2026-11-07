"""Regresión V3.2.1 LOTE4: Rewards no mezcla CLP, USD y ARS."""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.orders.models import Order, OrderStatus
from apps.rewards.models import Campaign, CampaignStatus, Entry


class RewardsCurrencyDashboardTest(TestCase):
    def setUp(self):
        users = get_user_model()
        self.admin = users.objects.create_superuser(
            email="rewards-currency-admin@example.test",
            username="rewards-currency-admin", password="x",
        )
        self.buyer = users.objects.create_user(
            email="rewards-currency-buyer@example.test",
            username="rewards-currency-buyer", password="x",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        now = timezone.now()
        self.campaign = Campaign.objects.create(
            name="Campaña moneda aislada", main_prize="Premio de prueba",
            status=CampaignStatus.ACTIVE,
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=7),
            draw_date=now + timedelta(days=8),
        )

    def add_order(self, currency, total, code, status=OrderStatus.PAID):
        order = Order.objects.create(
            user=self.buyer, email=self.buyer.email,
            shipping_address="Prueba", currency=currency,
            total=Decimal(total), status=status,
        )
        Entry.objects.create(
            user=self.buyer, campaign=self.campaign,
            order=order, product=None, unique_code=code,
        )
        return order

    def test_related_orders_are_counted_once_in_their_original_currency(self):
        clp = self.add_order("CLP", "100000", "LPR-CLP")
        self.add_order("USD", "90.50", "LPR-USD")
        self.add_order("ARS", "70000", "LPR-ARS")
        self.add_order("CLP", "5000", "LPR-PENDING", status=OrderStatus.PENDING)
        Entry.objects.create(
            user=self.buyer, campaign=self.campaign, order=clp,
            product=None, unique_code="LPR-CLP-2",
        )

        expected = {"CLP": 100000, "USD": 90.50, "ARS": 70000}
        for currency, revenue in expected.items():
            with self.subTest(currency=currency):
                response = self.client.get(
                    "/api/v1/admin/rewards/dashboard/", {"currency": currency}
                )
                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual(response.data["currency"], currency)
                self.assertEqual(response.data["totals"]["related_revenue"], revenue)
                self.assertEqual(response.data["related_revenue_by_currency"], expected)
                self.assertEqual(response.data["totals"]["entries"], 5)

        default_response = self.client.get("/api/v1/admin/rewards/dashboard/")
        self.assertEqual(default_response.data["currency"], "CLP")
        self.assertEqual(default_response.data["totals"]["related_revenue"], 100000)

    def test_invalid_currency_and_customer_access_are_rejected(self):
        invalid = self.client.get(
            "/api/v1/admin/rewards/dashboard/", {"currency": "EUR"}
        )
        self.assertEqual(invalid.status_code, 400)
        self.client.force_authenticate(user=self.buyer)
        denied = self.client.get("/api/v1/admin/rewards/dashboard/")
        self.assertEqual(denied.status_code, 403)

    def test_csv_respects_search_in_addition_to_campaign_filter(self):
        self.add_order("CLP", "100000", "LPR-CLP")
        self.add_order("USD", "90.50", "LPR-USD")
        response = self.client.get(
            "/api/v1/admin/rewards/entries/export/",
            {"campaign": str(self.campaign.id), "search": "LPR-CLP"},
        )
        self.assertEqual(response.status_code, 200)
        csv_text = response.content.decode("utf-8")
        self.assertIn("LPR-CLP", csv_text)
        self.assertNotIn("LPR-USD", csv_text)
