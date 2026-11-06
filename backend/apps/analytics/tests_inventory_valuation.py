"""V3.2.1: a missing catalogue cost must not become fictional profit."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.products.models import Category, Product


class InventoryValuationIntegrityTest(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_superuser(
            email="inventory-v321@example.test", username="inventory-v321", password="test-only",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.category = Category.objects.create(name="Testing inventory", slug="inventory-v321")

    def create_product(self, name, cost, stock=2):
        return Product.objects.create(
            name=name, slug=name.lower().replace(" ", "-"),
            category=self.category, price=Decimal("100.00"),
            cost_price=cost, stock=stock, is_active=True,
        )

    def summary(self):
        response = self.client.get("/api/v1/admin/inventory/summary/")
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_missing_product_cost_makes_potential_profit_uncertified(self):
        self.create_product("Unknown Cost", None, 3)
        self.create_product("Known Cost", Decimal("40.00"), 2)
        data = self.summary()
        self.assertEqual(data["valor_venta"], 500)
        self.assertEqual(data["valor_inventario"], 80)
        self.assertEqual(data["cost_missing_count"], 1)
        self.assertFalse(data["profit_calculable"])
        self.assertIsNone(data["ganancia_potencial"])

    def test_complete_cost_coverage_preserves_existing_profit_calculation(self):
        self.create_product("Known Cost", Decimal("40.00"), 2)
        self.create_product("Zero Cost", Decimal("0.00"), 1)
        data = self.summary()
        self.assertEqual(data["cost_missing_count"], 0)
        self.assertTrue(data["profit_calculable"])
        self.assertEqual(data["valor_venta"], 300)
        self.assertEqual(data["valor_inventario"], 80)
        self.assertEqual(data["ganancia_potencial"], 220)

    def test_unknown_cost_on_no_stock_does_not_affect_current_profit(self):
        self.create_product("No Stock", None, 0)
        self.create_product("Known Cost", Decimal("20.00"), 1)
        data = self.summary()
        self.assertEqual(data["cost_missing_count"], 0)
        self.assertTrue(data["profit_calculable"])
        self.assertEqual(data["ganancia_potencial"], 80)
