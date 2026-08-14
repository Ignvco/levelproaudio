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


class AdminMultiCurrencyEditTest(TestCase):
    """El admin puede cargar precios USD/ARS por producto y editar las tasas."""
    def setUp(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        self.admin = User.objects.create_superuser(
            email="mcadmin@test.com", username="mcadmin", password="x")
        self.cat = Category.objects.create(name="Audio", slug="audio-mcedit")
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_admin_can_set_product_usd_ars(self):
        resp = self.client.post("/api/v1/admin/products/", {
            "name": "Mic Pro", "price": "100000", "category": str(self.cat.id),
            "price_usd": "105.00", "price_ars": "120000",
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        p = Product.objects.get(name="Mic Pro")
        self.assertEqual(p.price_usd, Decimal("105.00"))
        self.assertEqual(p.price_ars, Decimal("120000"))

    def test_admin_can_clear_usd_price(self):
        p = Product.objects.create(
            name="Clear", slug="clear-mc", category=self.cat,
            price=Decimal("50000"), price_usd=Decimal("60"))
        resp = self.client.patch(f"/api/v1/admin/products/{p.id}/", {
            "price_usd": "",
        }, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        p.refresh_from_db()
        self.assertIsNone(p.price_usd)  # vacío → null → se calculará con la tasa

    def test_admin_can_edit_exchange_rates(self):
        resp = self.client.patch("/api/v1/admin/site-settings/", {
            "usd_to_clp": "980", "usd_to_ars": "1150",
        }, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        from apps.site_settings.models import SiteSettings
        s = SiteSettings.objects.first()
        self.assertEqual(s.usd_to_clp, Decimal("980"))
        self.assertEqual(s.usd_to_ars, Decimal("1150"))
