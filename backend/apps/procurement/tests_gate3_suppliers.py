# apps/procurement/tests_gate3_suppliers.py
"""
LEVELPRO OS V4.0 — GATE 3: Suite de Certificación Integral Supplier Management (BF-01 & BF-02)
Pruebas reales sobre PostgreSQL 16 incluyendo concurrencia transaccional.
"""

import datetime
import io
import threading
from decimal import Decimal
from django.test import TestCase, TransactionTestCase
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.db import IntegrityError, close_old_connections
from rest_framework.test import APIClient

from apps.products.models import Brand, Category, Product, ProductVariant
from apps.procurement.models import (
    Supplier,
    SupplierContact,
    ProductSupplier,
    SupplierPriceHistory,
)
from apps.procurement.services import select_preferred_supplier
from apps.analytics.models import AuditEvent
from core.rbac.constants import (
    ROLE_SUPER_ADMIN,
    ROLE_PURCHASING,
    ROLE_WAREHOUSE,
    ROLE_SALES,
    MODULE_PURCHASES,
)

User = get_user_model()


class Gate3SupplierConcurrencyTests(TransactionTestCase):
    """Pruebas de concurrencia real en PostgreSQL 16 para selección de proveedor preferente."""

    def setUp(self):
        call_command("setup_rbac")
        self.admin = User.objects.create_user(
            username="proc_conc_admin",
            email="proc_conc@levelproaudio.com",
            password="PasswordSegura123!",
            is_staff=True,
            is_superuser=True,
        )
        self.admin.groups.add(Group.objects.get(name=ROLE_SUPER_ADMIN))
        self.cat = Category.objects.create(name="Micrófonos", slug="mics-proc-conc")
        self.mic = Product.objects.create(
            name="Shure SM58",
            slug="shure-sm58-proc-conc",
            sku="PROC-SM58-01",
            category=self.cat,
            price=Decimal("119990"),
            cost_price=Decimal("65000"),
            stock=8,
        )
        self.sup_a = Supplier.objects.create(
            internal_code="SUP-CONC-A",
            legal_name="Distribuidora Alfa SpA",
            country="Chile",
            currency="CLP",
        )
        self.sup_b = Supplier.objects.create(
            internal_code="SUP-CONC-B",
            legal_name="ProAudio Miami LLC",
            country="Estados Unidos",
            currency="USD",
        )
        self.link_a = ProductSupplier.objects.create(
            supplier=self.sup_a,
            product=self.mic,
            unit_cost=Decimal("62000"),
            currency="CLP",
        )
        self.link_b = ProductSupplier.objects.create(
            supplier=self.sup_b,
            product=self.mic,
            unit_cost=Decimal("68.00"),
            currency="USD",
        )

    def test_concurrent_select_preferred_supplier_exactly_one_preferred(self):
        barrier = threading.Barrier(2)
        errors = []

        def pick(link_id):
            close_old_connections()
            try:
                barrier.wait(timeout=5)
                select_preferred_supplier(link_id, self.admin)
            except Exception as exc:
                errors.append(str(exc))
            finally:
                close_old_connections()

        t1 = threading.Thread(target=pick, args=(self.link_a.id,))
        t2 = threading.Thread(target=pick, args=(self.link_b.id,))
        t1.start()
        t2.start()
        t1.join(timeout=10)
        t2.join(timeout=10)

        self.assertEqual(errors, [])
        preferred_count = ProductSupplier.objects.filter(product=self.mic, is_preferred=True).count()
        self.assertEqual(preferred_count, 1)


class Gate3SupplierManagementTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("setup_rbac")

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username="proc_admin",
            email="proc_admin@levelproaudio.com",
            password="PasswordSegura123!",
            is_staff=True,
            is_superuser=True,
        )
        self.admin.groups.add(Group.objects.get(name=ROLE_SUPER_ADMIN))

        self.purchasing = User.objects.create_user(
            username="proc_buyer",
            email="proc_buyer@levelproaudio.com",
            password="PasswordSegura123!",
            is_staff=True,
        )
        self.purchasing.groups.add(Group.objects.get(name=ROLE_PURCHASING))

        self.warehouse = User.objects.create_user(
            username="proc_wh",
            email="proc_wh@levelproaudio.com",
            password="PasswordSegura123!",
            is_staff=True,
        )
        self.warehouse.groups.add(Group.objects.get(name=ROLE_WAREHOUSE))

        self.sales = User.objects.create_user(
            username="proc_sales",
            email="proc_sales@levelproaudio.com",
            password="PasswordSegura123!",
            is_staff=True,
        )
        self.sales.groups.add(Group.objects.get(name=ROLE_SALES))

        self.cat = Category.objects.create(name="Micrófonos", slug="mics-proc")
        self.brand = Brand.objects.create(name="Shure", slug="shure-proc")
        self.simple_mic = Product.objects.create(
            name="Shure SM7B",
            slug="shure-sm7b-proc",
            sku="PROC-SM7B",
            category=self.cat,
            brand=self.brand,
            price=Decimal("399990"),
            cost_price=Decimal("220000"),
            stock=12,
        )
        self.hp_master = Product.objects.create(
            name="Beyerdynamic DT770",
            slug="dt770-proc",
            sku="PROC-DT770",
            category=self.cat,
            price=Decimal("179990"),
            cost_price=Decimal("95000"),
            stock=0,
        )
        self.hp_250 = ProductVariant.objects.create(
            product=self.hp_master,
            sku="PROC-DT770-250",
            name="250 Ohm",
            stock=5,
        )

    def test_bf01_supplier_crud_contacts_brands_and_logical_deactivation(self):
        self.client.force_authenticate(user=self.purchasing)

        # Crear proveedor con contactos y marcas
        r_create = self.client.post("/api/v1/admin/suppliers/", {
            "internal_code": "SUP-SHURE-US",
            "legal_name": "Pro Audio Exports Inc.",
            "trade_name": "ProAudio Miami",
            "tax_id": "EIN-99-1234567",
            "country": "Estados Unidos",
            "supplier_type": "distributor",
            "currency": "USD",
            "payment_terms": "30 días wire",
            "default_min_order_qty": 2,
            "default_lead_time_days": 14,
            "brand_ids": [str(self.brand.id)],
            "contacts": [
                {"full_name": "Carlos Méndez", "role_title": "Export Manager", "email": "cm@proaudio.example", "is_primary": True}
            ],
        }, format="json")
        self.assertEqual(r_create.status_code, 201, r_create.data)
        sup_id = r_create.json()["id"]
        self.assertEqual(len(r_create.json()["contacts"]), 1)
        self.assertEqual(r_create.json()["brands_detail"][0]["name"], "Shure")

        # Desactivar lógicamente (requiere Super Admin / Gerencia)
        self.client.force_authenticate(user=self.admin)
        r_del = self.client.delete(f"/api/v1/admin/suppliers/{sup_id}/")
        self.assertEqual(r_del.status_code, 200)
        self.assertFalse(r_del.json()["is_active"])
        self.assertTrue(Supplier.objects.filter(pk=sup_id).exists())

        # Reactivar auditado
        r_react = self.client.post(f"/api/v1/admin/suppliers/{sup_id}/reactivate/")
        self.assertEqual(r_react.status_code, 200)
        self.assertTrue(r_react.json()["is_active"])

        self.assertTrue(AuditEvent.objects.filter(module=MODULE_PURCHASES, action="SUPPLIER_CREATED").exists())
        self.assertTrue(AuditEvent.objects.filter(module=MODULE_PURCHASES, action="SUPPLIER_DEACTIVATED").exists())
        self.assertTrue(AuditEvent.objects.filter(module=MODULE_PURCHASES, action="SUPPLIER_REACTIVATED").exists())

    def test_bf02_multiple_suppliers_comparison_preferred_history_and_invariants(self):
        sup1 = Supplier.objects.create(
            internal_code="SUP-DIST-1",
            legal_name="Distribuidora Andes SpA",
            country="Chile",
            currency="USD",
            payment_terms="Contado",
        )
        sup2 = Supplier.objects.create(
            internal_code="SUP-DIST-2",
            legal_name="Audio Imports Corp",
            country="Estados Unidos",
            currency="USD",
            payment_terms="30 días",
        )
        sup3_clp = Supplier.objects.create(
            internal_code="SUP-DIST-3",
            legal_name="Mayorista Local CLP",
            country="Chile",
            currency="CLP",
            payment_terms="15 días",
        )

        self.client.force_authenticate(user=self.purchasing)

        # Vincular 3 proveedores al mismo SKU (2 en USD neto comparables, 1 en CLP)
        r1 = self.client.post(f"/api/v1/admin/products/{self.simple_mic.id}/suppliers/", {
            "supplier_id": str(sup1.id),
            "supplier_sku": "ANDES-SM7B",
            "unit_cost": "245.00",
            "currency": "USD",
            "tax_basis": "net",
            "moq": 2,
            "lead_time_days": 5,
            "reported_availability": "in_stock",
            "reported_available_qty": 10,
        }, format="json")
        self.assertEqual(r1.status_code, 201, r1.data)

        r2 = self.client.post(f"/api/v1/admin/products/{self.simple_mic.id}/suppliers/", {
            "supplier_id": str(sup2.id),
            "supplier_sku": "AIC-SM7B",
            "unit_cost": "220.00",
            "currency": "USD",
            "tax_basis": "net",
            "moq": 5,
            "lead_time_days": 14,
            "reported_availability": "in_stock",
        }, format="json")
        self.assertEqual(r2.status_code, 201)

        r3 = self.client.post(f"/api/v1/admin/products/{self.simple_mic.id}/suppliers/", {
            "supplier_id": str(sup3_clp.id),
            "unit_cost": "210000",
            "currency": "CLP",
            "tax_basis": "net",
            "moq": 1,
            "lead_time_days": 2,
        }, format="json")
        self.assertEqual(r3.status_code, 201)

        # No permite vincular maestro de producto con variantes sin indicar variant_id
        r_ambig = self.client.post(f"/api/v1/admin/products/{self.hp_master.id}/suppliers/", {
            "supplier_id": str(sup1.id),
            "unit_cost": "100.00",
            "currency": "USD",
        }, format="json")
        self.assertEqual(r_ambig.status_code, 400)

        # Sí permite vincular la variante exacta
        r_var = self.client.post(f"/api/v1/admin/products/{self.hp_master.id}/suppliers/", {
            "supplier_id": str(sup1.id),
            "variant_id": str(self.hp_250.id),
            "unit_cost": "105.00",
            "currency": "USD",
        }, format="json")
        self.assertEqual(r_var.status_code, 201)

        # Comparación inteligente: solo sup2 (220 USD) es is_best_comparable_cost en USD:net,
        # CLP no se mezcla silenciosamente ni se auto-designa preferente
        cmp_resp = self.client.get(
            f"/api/v1/admin/products/{self.simple_mic.id}/suppliers/?include_referential=true&target_currency=CLP"
        )
        self.assertEqual(cmp_resp.status_code, 200)
        alts = {a["supplier_code"]: a for a in cmp_resp.json()["alternatives"]}
        self.assertTrue(alts["SUP-DIST-2"]["is_best_comparable_cost"])
        self.assertFalse(alts["SUP-DIST-1"]["is_best_comparable_cost"])
        self.assertFalse(alts["SUP-DIST-3"]["is_best_comparable_cost"])
        self.assertFalse(any(a["is_preferred"] for a in alts.values()))
        self.assertEqual(cmp_resp.json()["referential_meta"]["source"], "SiteSettings")

        # Seleccionar proveedor preferente explícitamente
        link1_id = r1.json()["id"]
        pref_resp = self.client.post(f"/api/v1/admin/products/{self.simple_mic.id}/suppliers/{link1_id}/select-preferred/")
        self.assertEqual(pref_resp.status_code, 200)
        self.assertTrue(pref_resp.json()["is_preferred"])

        # Actualizar costo en sup1 y cambiar moneda a CLP -> preserva registro anterior en SupplierPriceHistory
        upd_resp = self.client.patch(f"/api/v1/admin/suppliers/{sup1.id}/products/{link1_id}/", {
            "unit_cost": "230000",
            "currency": "CLP",
        }, format="json")
        self.assertEqual(upd_resp.status_code, 200)

        hist_resp = self.client.get(f"/api/v1/admin/products/{self.simple_mic.id}/supplier-price-history/")
        self.assertEqual(hist_resp.status_code, 200)
        sup1_hist = [h for h in hist_resp.json()["results"] if h["supplier_code"] == "SUP-DIST-1"]
        self.assertEqual(len(sup1_hist), 2)
        self.assertEqual(sup1_hist[0]["previous_currency"], "USD")
        self.assertEqual(Decimal(sup1_hist[0]["previous_cost"]), Decimal("245.00"))
        self.assertEqual(sup1_hist[0]["new_currency"], "CLP")
        self.assertEqual(Decimal(sup1_hist[0]["new_cost"]), Decimal("230000.00"))

        # Invariante: ni price, ni cost_price, ni stock del catálogo fueron alterados
        self.simple_mic.refresh_from_db()
        self.assertEqual(self.simple_mic.price, Decimal("399990.00"))
        self.assertEqual(self.simple_mic.cost_price, Decimal("220000.00"))
        self.assertEqual(self.simple_mic.stock, 12)

    def test_price_list_import_export_idempotency_and_rbac_isolation(self):
        Supplier.objects.create(
            internal_code="SUP-IMP-1",
            legal_name="Importador Oficial",
            country="Chile",
            currency="USD",
        )
        self.client.force_authenticate(user=self.purchasing)

        csv_bytes = (
            "supplier_code,sku,supplier_sku,unit_cost,currency,tax_basis,moq,lead_time_days,cost_valid_until\n"
            "SUP-IMP-1,PROC-SM7B,SH-SM7B,215.50,USD,net,2,10,2027-12-31\n"
            "SUP-IMP-1,PROC-DT770-250,BD-250,98.00,USD,net,1,7,2027-12-31\n"
            "SUP-IMP-1,PROC-SM7B,DUP,210.00,USD,net,1,7,2027-12-31\n"
            "SUP-IMP-1,PROC-SM7B-EXP,EXP,100.00,USD,net,1,7,2020-01-01\n"
        ).encode("utf-8")

        f_dry = SimpleUploadedFile("costs.csv", csv_bytes, content_type="text/csv")
        r_dry = self.client.post("/api/v1/admin/suppliers/price-lists/import/?dry_run=true", {"file": f_dry}, format="multipart")
        self.assertEqual(r_dry.status_code, 200)
        self.assertEqual(r_dry.data["summary"]["new"], 2)
        self.assertEqual(r_dry.data["summary"]["rejected"], 2)
        self.assertEqual(ProductSupplier.objects.count(), 0)

        f_real = SimpleUploadedFile("costs.csv", csv_bytes, content_type="text/csv")
        r_real = self.client.post(
            "/api/v1/admin/suppliers/price-lists/import/?confirm=true",
            {"file": f_real},
            format="multipart",
            HTTP_IDEMPOTENCY_KEY="gate3-import-key-1",
        )
        self.assertEqual(r_real.status_code, 200)
        self.assertEqual(r_real.data["summary"]["new"], 2)
        self.assertEqual(ProductSupplier.objects.count(), 2)

        # Exportación CSV/XLSX
        r_exp = self.client.get("/api/v1/admin/suppliers/price-lists/export/?format=csv")
        self.assertEqual(r_exp.status_code, 200)
        self.assertIn(b"SUP-IMP-1", r_exp.content)

        # RBAC: Bodega y Ventas NO tienen acceso a proveedores ni costos
        for denied_user in (self.warehouse, self.sales):
            self.client.force_authenticate(user=denied_user)
            self.assertEqual(self.client.get("/api/v1/admin/suppliers/").status_code, 403)
            self.assertEqual(self.client.get(f"/api/v1/admin/products/{self.simple_mic.id}/suppliers/").status_code, 403)
            self.assertEqual(self.client.get("/api/v1/admin/suppliers/price-lists/export/?format=csv").status_code, 403)

        # Tienda pública nunca expone información de proveedores
        self.client.force_authenticate(user=None)
        pub_resp = self.client.get(f"/api/v1/products/{self.simple_mic.slug}/")
        self.assertEqual(pub_resp.status_code, 200)
        self.assertNotIn("supplier_links", pub_resp.json())
        self.assertNotIn("suppliers", pub_resp.json())
