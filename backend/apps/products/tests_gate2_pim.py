# apps/products/tests_gate2_pim.py
"""
LEVELPRO OS V4.0 — GATE 2: Suite de Certificación Integral PIM
Cubre BF-14 (Variantes), BF-15 (Edición Masiva), BF-16 (Import/Export CSV/Excel),
BF-44 (Catálogo Técnico Pro Audio), RBAC, Audit Trail e Inventario.
"""

import io
import csv
import openpyxl
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.products.models import (
    Category,
    Brand,
    Product,
    ProductVariant,
    TechnicalAttributeDefinition,
    ProductTechnicalSpec,
    BundleItem,
)
from apps.orders.models import Cart, CartItem, Order, OrderItem, OrderStatus
from apps.orders.inventory import prepare_inventory, deduct_inventory, InventoryError
from apps.analytics.models import AuditEvent
from django.core.management import call_command
from core.rbac.constants import ROLE_SUPER_ADMIN, ROLE_SALES, ROLE_WAREHOUSE
from core.contracts.inventory import InventoryContractService

User = get_user_model()


class Gate2PIMCertificationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("setup_rbac")

    def setUp(self):
        self.client = APIClient()

        self.super_admin = User.objects.create_user(
            username="admin_pim",
            email="admin_pim@levelproaudio.com",
            password="PasswordSegura123!",
            is_staff=True,
            is_superuser=True,
        )
        self.super_admin.groups.add(Group.objects.get(name=ROLE_SUPER_ADMIN))

        self.sales_user = User.objects.create_user(
            username="sales_pim",
            email="sales_pim@levelproaudio.com",
            password="PasswordSegura123!",
            is_staff=True,
        )
        self.sales_user.groups.add(Group.objects.get(name=ROLE_SALES))

        self.warehouse_user = User.objects.create_user(
            username="wh_pim",
            email="wh_pim@levelproaudio.com",
            password="PasswordSegura123!",
            is_staff=True,
        )
        self.warehouse_user.groups.add(Group.objects.get(name=ROLE_WAREHOUSE))

        self.buyer = User.objects.create_user(
            username="buyer_pim",
            email="buyer_pim@levelproaudio.com",
            password="PasswordSegura123!",
        )

        self.cat_mic = Category.objects.create(name="Micrófonos", slug="microfonos")
        self.cat_hp = Category.objects.create(name="Audífonos", slug="audifonos")
        self.brand = Brand.objects.create(name="Beyerdynamic", slug="beyerdynamic")

        self.master_hp = Product.objects.create(
            name="Beyerdynamic DT 770 PRO",
            slug="beyerdynamic-dt-770-pro",
            sku="DT770-MASTER",
            category=self.cat_hp,
            brand=self.brand,
            price=Decimal("169990.00"),
            price_usd=Decimal("179.00"),
            price_ars=Decimal("179000.00"),
            cost_price=Decimal("98000.00"),
            stock=0,
            weight=Decimal("0.35"),
            description="Audífono de referencia de estudio cerrado.",
            is_active=True,
        )

        self.v32 = ProductVariant.objects.create(
            product=self.master_hp,
            sku="DT770-32",
            barcode="4010118483668",
            name="32 Ohm / Negro",
            attributes={"impedance": "32 Ohm", "color": "Negro", "connection": "Mini Jack 3.5mm"},
            stock=5,
            is_default=True,
        )
        self.v80 = ProductVariant.objects.create(
            product=self.master_hp,
            sku="DT770-80",
            barcode="4010118474741",
            name="80 Ohm / Gris",
            attributes={"impedance": "80 Ohm", "color": "Gris", "connection": "Mini Jack 3.5mm"},
            price=Decimal("174990.00"),
            price_usd=Decimal("185.00"),
            stock=3,
        )
        self.v250 = ProductVariant.objects.create(
            product=self.master_hp,
            sku="DT770-250",
            barcode="4010118459045",
            name="250 Ohm / Estudio",
            attributes={"impedance": "250 Ohm", "color": "Negro", "connection": "Jack 6.3mm"},
            price=Decimal("179990.00"),
            stock=2,
        )

        self.legacy_mic = Product.objects.create(
            name="Shure SM58-LC",
            slug="shure-sm58-lc",
            sku="SHURE-SM58-LC",
            category=self.cat_mic,
            brand=self.brand,
            price=Decimal("119990.00"),
            cost_price=Decimal("65000.00"),
            stock=10,
            is_active=True,
        )

    # ── BF-14: Variantes, Herencia, Carrito y Checkout ───────────────────────

    def test_variants_inheritance_and_unique_sku(self):
        # Herencia controlada cuando price es None
        self.assertEqual(self.v32.effective_price, Decimal("169990.00"))
        self.assertEqual(self.v32.effective_weight, Decimal("0.35"))
        # Precio independiente en variante
        self.assertEqual(self.v80.effective_price, Decimal("174990.00"))
        self.assertEqual(self.v80.prices_by_currency()["USD"], Decimal("185.00"))
        # Stock agregado del maestro
        self.assertEqual(self.master_hp.effective_stock, 10)
        self.assertTrue(self.master_hp.in_stock)

        # Colisión con SKU del producto maestro rechazada
        bad = ProductVariant(product=self.master_hp, sku="SHURE-SM58-LC", name="Colisión", stock=1)
        with self.assertRaises(ValidationError):
            bad.full_clean()

    def test_cart_checkout_and_cancel_by_variant_without_double_deduction(self):
        self.client.force_authenticate(user=self.buyer)

        # No permite agregar maestro con variantes sin elegir variante
        resp_missing = self.client.post("/api/v1/cart/add_item/", {
            "product_id": str(self.master_hp.id),
            "quantity": 1,
        }, format="json")
        self.assertEqual(resp_missing.status_code, 400)

        # Agrega dos variantes distintas del mismo maestro al carrito
        resp_a = self.client.post("/api/v1/cart/add_item/", {
            "product_id": str(self.master_hp.id),
            "variant_id": str(self.v32.id),
            "quantity": 1,
        }, format="json")
        self.assertEqual(resp_a.status_code, 200)

        resp_b = self.client.post("/api/v1/cart/add_item/", {
            "product_id": str(self.master_hp.id),
            "variant_id": str(self.v80.id),
            "quantity": 2,
        }, format="json")
        self.assertEqual(resp_b.status_code, 200)
        self.assertEqual(len(resp_b.data["items"]), 2)

        # Checkout creando orden con variante v80 (qty 2) y producto legacy (qty 1)
        order_resp = self.client.post("/api/v1/orders/", {
            "email": self.buyer.email,
            "shipping_address": "Av. Providencia 1234, Santiago",
            "currency": "CLP",
            "items": [
                {"product": str(self.master_hp.id), "variant": str(self.v80.id), "quantity": 2},
                {"product": str(self.legacy_mic.id), "quantity": 1},
            ],
        }, format="json")
        self.assertEqual(order_resp.status_code, 201, order_resp.data)

        self.v80.refresh_from_db()
        self.v32.refresh_from_db()
        self.legacy_mic.refresh_from_db()
        self.assertEqual(self.v80.stock, 1)  # 3 - 2 = 1
        self.assertEqual(self.v32.stock, 5)  # intacta
        self.assertEqual(self.legacy_mic.stock, 9)  # 10 - 1 = 9

        order = Order.objects.get(id=order_resp.data["id"])
        expected_total = Decimal("174990.00") * 2 + Decimal("119990.00")
        self.assertEqual(order.total, expected_total)

        # Commit de pago (NO debe volver a descontar stock)
        InventoryContractService.commit_order_sale(order)
        self.v80.refresh_from_db()
        self.assertEqual(self.v80.stock, 1)

        # Cancelación de orden PENDING restaura exactamente la variante v80 y legacy_mic
        cancel_resp = self.client.delete(f"/api/v1/orders/{order.id}/")
        self.assertEqual(cancel_resp.status_code, 200)
        self.v80.refresh_from_db()
        self.legacy_mic.refresh_from_db()
        self.assertEqual(self.v80.stock, 3)
        self.assertEqual(self.legacy_mic.stock, 10)

    def test_bundle_compatibility_preserved(self):
        bundle = Product.objects.create(
            name="Kit Vocal Estudio",
            slug="kit-vocal-estudio",
            product_type=Product.ProductType.BUNDLE,
            price=Decimal("115000.00"),
            is_active=True,
        )
        BundleItem.objects.create(bundle=bundle, component=self.legacy_mic, quantity=2)
        self.assertTrue(bundle.in_stock)
        lines, demand = prepare_inventory([{"product": str(bundle.id), "quantity": 1}])
        self.assertEqual(demand[self.legacy_mic.id], 2)
        deduct_inventory(demand)
        self.legacy_mic.refresh_from_db()
        self.assertEqual(self.legacy_mic.stock, 8)

    # ── BF-44: Catálogo Técnico & Comparador ──────────────────────────────────

    def test_technical_specs_validation_and_comparator(self):
        self.client.force_authenticate(user=self.super_admin)

        # Guardar specs válidas en ambos productos
        r1 = self.client.put(f"/api/v1/admin/products/{self.master_hp.id}/technical-specs/", {
            "specs": [
                {"key": "frequency_response", "value": "5 Hz – 35 kHz"},
                {"key": "impedance_ohm", "value": "250"},
                {"key": "thd_percent", "value": "0.2"},
            ]
        }, format="json")
        self.assertEqual(r1.status_code, 200, r1.data)

        # Rechazar valor fuera de rango (SPL > 180 dB)
        r_bad = self.client.put(f"/api/v1/admin/products/{self.legacy_mic.id}/technical-specs/", {
            "specs": [{"key": "max_spl_db", "value": "250"}]
        }, format="json")
        self.assertEqual(r_bad.status_code, 400)

        r2 = self.client.put(f"/api/v1/admin/products/{self.legacy_mic.id}/technical-specs/", {
            "specs": [
                {"key": "frequency_response", "value": "50 Hz – 15 kHz"},
                {"key": "polar_pattern", "value": ["Cardioide"]},
                {"key": "max_spl_db", "value": "140"},
            ]
        }, format="json")
        self.assertEqual(r2.status_code, 200)

        # Comparador público devuelve dynamic_spec_rows + technical_specs
        self.client.force_authenticate(user=None)
        cmp_resp = self.client.post("/api/v1/products/compare/", {
            "product_ids": [str(self.master_hp.id), str(self.legacy_mic.id)],
            "currency": "CLP",
        }, format="json")
        self.assertEqual(cmp_resp.status_code, 200)
        row_keys = [r["key"] for r in cmp_resp.data["dynamic_spec_rows"]]
        self.assertIn("frequency_response", row_keys)
        self.assertIn("impedance_ohm", row_keys)
        self.assertIn("max_spl_db", row_keys)
        by_id = {p["id"]: p for p in cmp_resp.data["products"]}
        self.assertEqual(by_id[str(self.master_hp.id)]["technical_specs"]["frequency_response"], "5 Hz – 35 kHz")

    # ── BF-15: Edición Masiva, Preview, Idempotencia, RBAC & Audit ────────────

    def test_bulk_edit_preview_apply_rbac_and_audit(self):
        # Bodega NO puede modificar precios masivamente (403)
        self.client.force_authenticate(user=self.warehouse_user)
        r_forbidden = self.client.post("/api/v1/admin/products/bulk-preview/", {
            "product_ids": [str(self.legacy_mic.id)],
            "operation": "price_adjust_percent",
            "params": {"percent": "10", "currency": "CLP"},
        }, format="json")
        self.assertEqual(r_forbidden.status_code, 403)

        # Super Admin previsualiza +10% CLP sin mutar DB
        self.client.force_authenticate(user=self.super_admin)
        prev = self.client.post("/api/v1/admin/products/bulk-preview/", {
            "product_ids": [str(self.master_hp.id), str(self.legacy_mic.id)],
            "operation": "price_adjust_percent",
            "params": {"percent": "10", "currency": "CLP"},
        }, format="json")
        self.assertEqual(prev.status_code, 200)
        self.assertEqual(prev.data["valid_count"], 2)
        self.legacy_mic.refresh_from_db()
        self.assertEqual(self.legacy_mic.price, Decimal("119990.00"))

        # Aplicar con Idempotency-Key
        apply1 = self.client.post(
            "/api/v1/admin/products/bulk-apply/",
            {
                "product_ids": [str(self.master_hp.id), str(self.legacy_mic.id)],
                "operation": "price_adjust_percent",
                "params": {"percent": "10", "currency": "CLP"},
                "atomic_mode": "all_or_nothing",
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="bulk-test-key-001",
        )
        self.assertEqual(apply1.status_code, 200)
        self.assertEqual(apply1.data["applied_count"], 2)
        self.legacy_mic.refresh_from_db()
        self.master_hp.refresh_from_db()
        self.assertEqual(self.legacy_mic.price, Decimal("131989.00"))
        # Aislamiento monetario: price_usd no se alteró
        self.assertEqual(self.master_hp.price_usd, Decimal("179.00"))

        # Replay idempotente: no vuelve a subir 10%
        apply2 = self.client.post(
            "/api/v1/admin/products/bulk-apply/",
            {
                "product_ids": [str(self.master_hp.id), str(self.legacy_mic.id)],
                "operation": "price_adjust_percent",
                "params": {"percent": "10", "currency": "CLP"},
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="bulk-test-key-001",
        )
        self.assertTrue(apply2.data["idempotent_replay"])
        self.legacy_mic.refresh_from_db()
        self.assertEqual(self.legacy_mic.price, Decimal("131989.00"))
        self.assertTrue(AuditEvent.objects.filter(action="BULK_PRODUCTS_UPDATED").exists())

    # ── BF-16: Importación Dry-Run / Confirm & Exportación Segura ─────────────

    def test_pim_import_dry_run_confirm_empty_vs_zero_vs_clear(self):
        self.client.force_authenticate(user=self.super_admin)

        csv_content = (
            "sku,parent_sku,nombre,variant_name,precio_clp,precio_comparacion,stock,descripcion_corta\n"
            "SHURE-SM58-LC,,Shure SM58-LC,,119990,__CLEAR__,0,\n"
            "NEW-MIC-01,,Micrófono Sintético QA,,89990,,4,Descripción inicial\n"
            "NEW-MIC-01-BLK,NEW-MIC-01,,Negro XLR,89990,,2,\n"
            "NEW-MIC-01,,Duplicado,,50000,,1,\n"
            "BAD-PRICE-01,,Precio Negativo,,-500,,1,\n"
        ).encode("utf-8")

        from django.core.files.uploadedfile import SimpleUploadedFile

        # 1. Dry-run no modifica DB
        f_dry = SimpleUploadedFile("import_test.csv", csv_content, content_type="text/csv")
        r_dry = self.client.post("/api/v1/admin/products/import/?dry_run=true", {"file": f_dry}, format="multipart")
        self.assertEqual(r_dry.status_code, 200, r_dry.data)
        self.assertTrue(r_dry.data["dry_run"])
        self.assertEqual(r_dry.data["summary"]["updated"], 1)
        self.assertEqual(r_dry.data["summary"]["new"], 2)  # NEW-MIC-01 + NEW-MIC-01-BLK
        self.assertEqual(r_dry.data["summary"]["rejected"], 2)  # duplicado + precio negativo
        self.assertFalse(Product.objects.filter(sku="NEW-MIC-01").exists())

        # 2. Confirmar importación real
        f_real = SimpleUploadedFile("import_test.csv", csv_content, content_type="text/csv")
        r_real = self.client.post("/api/v1/admin/products/import/?confirm=true", {"file": f_real}, format="multipart")
        self.assertEqual(r_real.status_code, 200)
        self.legacy_mic.refresh_from_db()
        self.assertEqual(self.legacy_mic.stock, 0)  # 0 aplicado explícitamente
        self.assertIsNone(self.legacy_mic.compare_price)  # __CLEAR__ aplicado
        self.assertTrue(Product.objects.filter(sku="NEW-MIC-01").exists())
        self.assertTrue(ProductVariant.objects.filter(sku="NEW-MIC-01-BLK").exists())
        self.assertTrue(AuditEvent.objects.filter(action="BULK_PRODUCTS_IMPORTED").exists())

    def test_pim_export_rbac_cost_masking_and_formula_injection(self):
        # Producto con nombre potencialmente peligroso para Excel/CSV
        Product.objects.create(
            name="=CMD('calc') Audio Mixer",
            slug="cmd-audio-mixer",
            sku="+MIX-01",
            price=Decimal("250000.00"),
            cost_price=Decimal("120000.00"),
            stock=2,
            is_active=True,
        )

        # Ventas NO tiene PERM_EXPORT_DATA -> 403
        self.client.force_authenticate(user=self.sales_user)
        r_denied = self.client.get("/api/v1/admin/products/export/?format=csv")
        self.assertEqual(r_denied.status_code, 403)

        # Usuario con export_data pero SIN view_costs -> omite cost_price_clp
        from django.contrib.auth.models import Permission
        perm_export = Permission.objects.get(codename="export_data")
        self.sales_user.user_permissions.add(perm_export)
        r_no_cost = self.client.get("/api/v1/admin/products/export/?format=csv")
        self.assertEqual(r_no_cost.status_code, 200)
        csv_text = r_no_cost.content.decode("utf-8-sig")
        self.assertNotIn("cost_price_clp", csv_text)
        # Anti-formula injection: prefijado con '
        self.assertIn("'=CMD('calc') Audio Mixer", csv_text)
        self.assertIn("'+MIX-01", csv_text)

        # Super Admin exporta con cost_price_clp y formato xlsx válido
        self.client.force_authenticate(user=self.super_admin)
        r_xlsx = self.client.get("/api/v1/admin/products/export/?format=xlsx")
        self.assertEqual(r_xlsx.status_code, 200)
        wb = openpyxl.load_workbook(io.BytesIO(r_xlsx.content))
        ws = wb.active
        headers = [cell.value for cell in ws[1]]
        self.assertIn("cost_price_clp", headers)
        self.assertTrue(AuditEvent.objects.filter(action="CATALOG_EXPORTED").exists())
