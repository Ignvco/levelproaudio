# apps/products/tests_badges_and_cost_leak.py
#
# Dos cosas encontradas y arregladas mientras se armaba el sistema de
# badges de producto:
#
#   1. cost_price (lo que LevelPro paga por cada producto) se filtraba
#      en el endpoint PÚBLICO de detalle de producto — cualquiera sin
#      login podía ver el margen de ganancia exacto. El admin real
#      sigue viéndolo bien, por un serializer separado.
#
#   2. Nuevo campo badge (Best Seller / Recomienda / etc.) + is_low_stock
#      calculado — nunca revela el umbral real de stock mínimo, solo
#      si o no.

from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.products.models import Category, Product

User = get_user_model()


class CostPriceNotLeakedPubliclyTest(TestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Test", slug="test-costleak")
        self.product = Product.objects.create(
            name="Mic de prueba", slug="mic-prueba-costleak", category=self.category,
            price=Decimal("100000"), cost_price=Decimal("40000"),
        )
        self.client = APIClient()

    def test_cost_price_not_in_public_detail(self):
        resp = self.client.get(f"/api/v1/products/{self.product.slug}/")
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn("cost_price", resp.data)

    def test_cost_price_not_in_public_list(self):
        resp = self.client.get("/api/v1/products/")
        self.assertEqual(resp.status_code, 200)
        for item in resp.data["results"]:
            self.assertNotIn("cost_price", item)

    def test_admin_can_still_see_cost_price(self):
        admin = User.objects.create_superuser(
            email="costadmin@test.com", username="costadmin", password="x")
        self.client.force_authenticate(user=admin)
        resp = self.client.get(f"/api/v1/admin/products/{self.product.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(Decimal(str(resp.data["cost_price"])), Decimal("40000"))


class ProductBadgeTest(TestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Test", slug="test-badge")
        self.client = APIClient()

    def test_badge_and_display_in_public_response(self):
        p = Product.objects.create(
            name="Mic Best Seller", slug="mic-best-seller", category=self.category,
            price=Decimal("50000"), badge=Product.Badge.BEST_SELLER,
        )
        resp = self.client.get(f"/api/v1/products/{p.slug}/")
        self.assertEqual(resp.data["badge"], "best_seller")
        self.assertIn("Best Seller", resp.data["badge_display"])

    def test_invalid_badge_rejected_by_admin_endpoint(self):
        admin = User.objects.create_superuser(
            email="badgeadmin@test.com", username="badgeadmin", password="x")
        self.client.force_authenticate(user=admin)
        resp = self.client.post("/api/v1/admin/products/", {
            "name": "Test", "price": "1000", "category": str(self.category.id),
            "badge": "not-a-real-badge",
        }, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_is_low_stock_true_when_stock_at_or_below_minimum(self):
        p = Product.objects.create(
            name="Poco stock", slug="poco-stock-badge", category=self.category,
            price=Decimal("1000"), stock=2, stock_min=5,
            product_type=Product.ProductType.STOCK,
        )
        resp = self.client.get(f"/api/v1/products/{p.slug}/")
        self.assertTrue(resp.data["is_low_stock"])
        # El umbral real (stock_min) nunca se expone públicamente
        self.assertNotIn("stock_min", resp.data)

    def test_is_low_stock_false_with_healthy_stock(self):
        p = Product.objects.create(
            name="Stock sano", slug="stock-sano-badge", category=self.category,
            price=Decimal("1000"), stock=50, stock_min=5,
            product_type=Product.ProductType.STOCK,
        )
        resp = self.client.get(f"/api/v1/products/{p.slug}/")
        self.assertFalse(resp.data["is_low_stock"])

    def test_is_low_stock_false_when_out_of_stock(self):
        """Sin stock es 'agotado', no 'últimas unidades' — son mensajes distintos."""
        p = Product.objects.create(
            name="Agotado", slug="agotado-badge", category=self.category,
            price=Decimal("1000"), stock=0, stock_min=5,
            product_type=Product.ProductType.STOCK,
        )
        resp = self.client.get(f"/api/v1/products/{p.slug}/")
        self.assertFalse(resp.data["is_low_stock"])
