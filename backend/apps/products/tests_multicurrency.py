# apps/products/tests_multicurrency.py
from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient

from apps.products.models import Category, Product
from apps.site_settings.models import SiteSettings


class PricesByCurrencyTest(TestCase):
    def setUp(self):
        self.cat = Category.objects.create(name="Audio", slug="audio-mc")

    def test_manual_prices_take_priority(self):
        p = Product.objects.create(
            name="Mic", slug="mic-mc", category=self.cat,
            price=Decimal("100000"), price_usd=Decimal("105"), price_ars=Decimal("120000"))
        prices = p.prices_by_currency(Decimal("950"), Decimal("1000"))
        # Los manuales mandan, no se calculan
        self.assertEqual(prices["CLP"], Decimal("100000"))
        self.assertEqual(prices["USD"], Decimal("105"))
        self.assertEqual(prices["ARS"], Decimal("120000"))

    def test_usd_calculated_when_missing(self):
        p = Product.objects.create(
            name="Cable", slug="cable-mc", category=self.cat,
            price=Decimal("95000"))  # sin USD ni ARS
        prices = p.prices_by_currency(Decimal("950"), Decimal("1000"))
        # USD = 95000 / 950 = 100
        self.assertEqual(prices["USD"], Decimal("100.00"))
        # ARS = 100 * 1000 = 100000
        self.assertEqual(prices["ARS"], Decimal("100000"))

    def test_ars_manual_but_usd_calculated(self):
        p = Product.objects.create(
            name="Amp", slug="amp-mc", category=self.cat,
            price=Decimal("950000"), price_ars=Decimal("900000"))
        prices = p.prices_by_currency(Decimal("950"), Decimal("1000"))
        self.assertEqual(prices["USD"], Decimal("1000.00"))  # calculado
        self.assertEqual(prices["ARS"], Decimal("900000"))   # manual


class PricesInApiTest(TestCase):
    def setUp(self):
        self.cat = Category.objects.create(name="Audio", slug="audio-api")
        SiteSettings.objects.create(usd_to_clp=Decimal("1000"), usd_to_ars=Decimal("1200"))
        self.client = APIClient()

    def test_list_exposes_prices(self):
        Product.objects.create(
            name="P1", slug="p1-api", category=self.cat,
            price=Decimal("50000"), is_active=True)
        resp = self.client.get("/api/v1/products/")
        results = resp.data.get("results", resp.data)
        self.assertTrue(len(results) >= 1)
        prices = results[0]["prices"]
        self.assertIn("CLP", prices)
        self.assertIn("USD", prices)
        self.assertIn("ARS", prices)
        # 50000 / 1000 = 50 USD
        self.assertEqual(prices["USD"], "50.00")

    def test_detail_exposes_prices(self):
        p = Product.objects.create(
            name="P2", slug="p2-api", category=self.cat,
            price=Decimal("120000"), price_usd=Decimal("125"), is_active=True)
        resp = self.client.get(f"/api/v1/products/{p.slug}/")
        self.assertEqual(resp.data["prices"]["USD"], "125.00")
