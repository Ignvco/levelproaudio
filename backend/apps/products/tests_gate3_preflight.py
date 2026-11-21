# apps/products/tests_gate3_preflight.py
"""
LEVELPRO OS V4.0 — GATE 3: Preflight Técnico Acotado
Verifica consistencia SkuRegistry y bloqueo de stock residual de maestro cuando
todas sus variantes están desactivadas.
"""

from decimal import Decimal
from django.test import TestCase
from apps.products.models import Category, Product, ProductVariant, SkuRegistry
from apps.orders.inventory import prepare_inventory, InventoryError


class Gate3PreflightTests(TestCase):
    def setUp(self):
        self.cat = Category.objects.create(name="Interfaces", slug="interfaces-pf3")
        self.master = Product.objects.create(
            name="Interfaz Pro 2x2",
            slug="interfaz-pro-2x2-pf3",
            sku="INT-PRO-2X2",
            category=self.cat,
            price=Decimal("150000"),
            stock=15,  # stock residual del maestro
        )
        self.v1 = ProductVariant.objects.create(
            product=self.master,
            sku="INT-PRO-2X2-BLK",
            name="Negro",
            stock=4,
            is_active=True,
        )

    def test_sku_registry_consistent_for_master_and_variant(self):
        self.assertTrue(SkuRegistry.objects.filter(sku="INT-PRO-2X2", product=self.master).exists())
        self.assertTrue(SkuRegistry.objects.filter(sku="INT-PRO-2X2-BLK", variant=self.v1).exists())

    def test_deactivating_all_variants_blocks_residual_master_stock_sale(self):
        self.v1.is_active = False
        self.v1.save(update_fields=["is_active", "updated_at"])

        self.assertEqual(self.master.effective_stock, 0)
        self.assertFalse(self.master.in_stock)

        with self.assertRaises(InventoryError):
            prepare_inventory([{"product": str(self.master.id), "quantity": 1}])
