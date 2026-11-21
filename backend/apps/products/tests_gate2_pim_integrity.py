# apps/products/tests_gate2_pim_integrity.py
"""
LEVELPRO OS V4.0 — GATE 2: Suite de Integridad PIM (PIM-01 .. PIM-05)
Pruebas reales sobre PostgreSQL 16 incluyendo concurrencia transaccional.
"""

import io
import threading
from decimal import Decimal
from django.test import TransactionTestCase, TestCase
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.db import IntegrityError, close_old_connections, transaction
from rest_framework.test import APIClient

from apps.products.models import (
    Category,
    Product,
    ProductVariant,
    BundleItem,
    SkuRegistry,
)
from apps.products.bulk_operations import apply_bulk_update
from apps.products.pim_io import process_pim_import
from apps.orders.models import Order, OrderItem, OrderStatus
from apps.orders.inventory import prepare_inventory, deduct_inventory, restore_inventory, InventoryError
from core.rbac.constants import ROLE_SUPER_ADMIN

User = get_user_model()


class Gate2PIMConcurrencyPostgresTests(TransactionTestCase):
    """Pruebas de concurrencia real sobre PostgreSQL 16 (PIM-01 y reservas/ediciones)."""

    def setUp(self):
        call_command("setup_rbac")
        self.admin = User.objects.create_user(
            username="conc_admin",
            email="conc_admin@levelproaudio.com",
            password="PasswordSegura123!",
            is_staff=True,
            is_superuser=True,
        )
        self.admin.groups.add(Group.objects.get(name=ROLE_SUPER_ADMIN))
        self.cat = Category.objects.create(name="Monitores", slug="monitores-conc")
        self.master = Product.objects.create(
            name="Monitor Base",
            slug="monitor-base-conc",
            sku="MON-BASE-001",
            category=self.cat,
            price=Decimal("250000"),
            stock=10,
        )

    def test_pim01_concurrent_master_and_variant_same_sku_exactly_one_wins(self):
        """Creación concurrente de Product y ProductVariant con mismo SKU: exactamente uno gana."""
        target_sku = "CONC-SKU-999"
        barrier = threading.Barrier(2)
        results = []
        lock = threading.Lock()

        def create_product():
            close_old_connections()
            try:
                barrier.wait(timeout=5)
                p = Product.objects.create(
                    name="Prod Concurrente",
                    slug="prod-concurrente-sku",
                    sku=target_sku,
                    category=self.cat,
                    price=Decimal("100000"),
                    stock=5,
                )
                with lock:
                    results.append(("product_ok", str(p.id)))
            except IntegrityError as exc:
                with lock:
                    results.append(("product_err", str(exc)))
            finally:
                close_old_connections()

        def create_variant():
            close_old_connections()
            try:
                barrier.wait(timeout=5)
                v = ProductVariant.objects.create(
                    product=self.master,
                    sku=target_sku,
                    name="Variante Concurrente",
                    stock=5,
                )
                with lock:
                    results.append(("variant_ok", str(v.id)))
            except IntegrityError as exc:
                with lock:
                    results.append(("variant_err", str(exc)))
            finally:
                close_old_connections()

        t1 = threading.Thread(target=create_product)
        t2 = threading.Thread(target=create_variant)
        t1.start()
        t2.start()
        t1.join(timeout=10)
        t2.join(timeout=10)

        oks = [r for r in results if r[0].endswith("_ok")]
        errs = [r for r in results if r[0].endswith("_err")]
        self.assertEqual(len(oks), 1, f"Debe ganar exactamente uno: {results}")
        self.assertEqual(len(errs), 1, f"Debe fallar exactamente uno por IntegrityError: {results}")
        self.assertEqual(SkuRegistry.objects.filter(sku=target_sku).count(), 1)

    def test_concurrent_purchase_last_unit_on_variant(self):
        """Compras simultáneas sobre la última unidad disponible de una variante."""
        variant = ProductVariant.objects.create(
            product=self.master,
            sku="MON-LAST-1",
            name="Edición Única",
            stock=1,
        )
        barrier = threading.Barrier(2)
        outcomes = []
        lock = threading.Lock()

        def buy_once(idx):
            close_old_connections()
            try:
                barrier.wait(timeout=5)
                with transaction.atomic():
                    lines, demand = prepare_inventory([
                        {"product": str(self.master.id), "variant": str(variant.id), "quantity": 1}
                    ])
                    deduct_inventory(demand)
                with lock:
                    outcomes.append((idx, "ok"))
            except InventoryError as exc:
                with lock:
                    outcomes.append((idx, f"err:{exc}"))
            finally:
                close_old_connections()

        t1 = threading.Thread(target=buy_once, args=(1,))
        t2 = threading.Thread(target=buy_once, args=(2,))
        t1.start()
        t2.start()
        t1.join(timeout=10)
        t2.join(timeout=10)

        oks = [o for o in outcomes if o[1] == "ok"]
        errs = [o for o in outcomes if o[1].startswith("err:")]
        self.assertEqual(len(oks), 1, f"Solo 1 compra debe ganar: {outcomes}")
        self.assertEqual(len(errs), 1, f"La 2da compra debe fallar: {outcomes}")
        variant.refresh_from_db()
        self.assertEqual(variant.stock, 0)

    def test_bulk_edit_and_import_during_active_reservation_no_lost_update(self):
        """Edición masiva e importación de precio durante reserva activa no pierden descuento de stock."""
        variant = ProductVariant.objects.create(
            product=self.master,
            sku="MON-LOCK-10",
            name="Estudio 8\"",
            price=Decimal("250000"),
            stock=10,
        )
        barrier = threading.Barrier(2)
        errors = []

        def reserve_two():
            close_old_connections()
            try:
                barrier.wait(timeout=5)
                with transaction.atomic():
                    _, demand = prepare_inventory([
                        {"product": str(self.master.id), "variant": str(variant.id), "quantity": 2}
                    ])
                    deduct_inventory(demand)
            except Exception as exc:
                errors.append(str(exc))
            finally:
                close_old_connections()

        def bulk_raise_price():
            close_old_connections()
            try:
                barrier.wait(timeout=5)
                apply_bulk_update(
                    self.admin,
                    {
                        "target_scope": "variants",
                        "variant_ids": [str(variant.id)],
                        "operation": "price_set",
                        "params": {"currency": "CLP", "amount": "275000"},
                    },
                )
            except Exception as exc:
                errors.append(str(exc))
            finally:
                close_old_connections()

        t1 = threading.Thread(target=reserve_two)
        t2 = threading.Thread(target=bulk_raise_price)
        t1.start()
        t2.start()
        t1.join(timeout=10)
        t2.join(timeout=10)

        self.assertEqual(errors, [])
        variant.refresh_from_db()
        self.assertEqual(variant.stock, 8)
        self.assertEqual(variant.price, Decimal("275000.00"))

        # Ahora importar nuevo precio USD por CSV mientras otra reserva descuenta 3 unidades
        csv_bytes = (
            "sku,parent_sku,precio_usd\n"
            "MON-LOCK-10,MON-BASE-001,299.00\n"
        ).encode("utf-8")

        barrier2 = threading.Barrier(2)

        def reserve_three():
            close_old_connections()
            try:
                barrier2.wait(timeout=5)
                with transaction.atomic():
                    _, demand = prepare_inventory([
                        {"product": str(self.master.id), "variant": str(variant.id), "quantity": 3}
                    ])
                    deduct_inventory(demand)
            except Exception as exc:
                errors.append(str(exc))
            finally:
                close_old_connections()

        def import_usd():
            close_old_connections()
            try:
                barrier2.wait(timeout=5)
                process_pim_import(self.admin, csv_bytes, "upd_usd.csv", dry_run=False)
            except Exception as exc:
                errors.append(str(exc))
            finally:
                close_old_connections()

        t3 = threading.Thread(target=reserve_three)
        t4 = threading.Thread(target=import_usd)
        t3.start()
        t4.start()
        t3.join(timeout=10)
        t4.join(timeout=10)

        self.assertEqual(errors, [])
        variant.refresh_from_db()
        self.assertEqual(variant.stock, 5)
        self.assertEqual(variant.price_usd, Decimal("299.00"))


class Gate2PIMIntegrityTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("setup_rbac")

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username="int_admin",
            email="int_admin@levelproaudio.com",
            password="PasswordSegura123!",
            is_staff=True,
            is_superuser=True,
        )
        self.admin.groups.add(Group.objects.get(name=ROLE_SUPER_ADMIN))
        self.buyer = User.objects.create_user(
            username="int_buyer",
            email="int_buyer@levelproaudio.com",
            password="PasswordSegura123!",
        )
        self.cat = Category.objects.create(name="Audífonos", slug="audifonos-int")
        self.master = Product.objects.create(
            name="Beyerdynamic DT770",
            slug="dt770-int",
            sku="DT770-MASTER",
            category=self.cat,
            price=Decimal("180000"),
            price_usd=Decimal("190.00"),
            price_ars=Decimal("200000"),
            stock=0,
        )
        self.v80 = ProductVariant.objects.create(
            product=self.master,
            sku="DT770-80",
            name="80 Ohm",
            attributes={"impedance": "80 Ohm"},
            stock=5,
            is_default=True,
        )
        self.v250 = ProductVariant.objects.create(
            product=self.master,
            sku="DT770-250",
            name="250 Ohm",
            attributes={"impedance": "250 Ohm"},
            price=Decimal("195000"),
            price_usd=Decimal("210.00"),
            price_ars=Decimal("230000"),
            stock=4,
        )
        self.simple_cable = Product.objects.create(
            name="Cable Extensión",
            slug="cable-ext-int",
            sku="CAB-EXT-01",
            category=self.cat,
            price=Decimal("15000"),
            stock=10,
        )

    def test_pim01_sku_collisions_across_all_write_routes(self):
        """Colisiones de SKU en creación/edición de producto, variante e importación masiva."""
        self.client.force_authenticate(user=self.admin)

        # 1. Crear producto con SKU de variante existente -> 400
        r1 = self.client.post("/api/v1/admin/products/", {
            "name": "Otro",
            "sku": "DT770-80",
            "price": 10000,
            "stock": 1,
        }, format="json")
        self.assertEqual(r1.status_code, 400)

        # 2. Crear variante con SKU de producto maestro -> 400
        r2 = self.client.post(f"/api/v1/admin/products/{self.master.id}/variants/", {
            "sku": "DT770-MASTER",
            "name": "Colisión Maestro",
            "stock": 1,
        }, format="json")
        self.assertEqual(r2.status_code, 400)

        # 3. Editar producto para tomar SKU de variante -> 400
        r3 = self.client.patch(f"/api/v1/admin/products/{self.simple_cable.id}/", {
            "sku": "DT770-250",
        }, format="json")
        self.assertEqual(r3.status_code, 400)

        # 4. Importación CSV intentando crear variante con SKU de producto maestro -> rechazada
        csv_bytes = (
            "sku,parent_sku,variant_name,stock\n"
            "CAB-EXT-01,DT770-MASTER,Colisión Import,2\n"
        ).encode("utf-8")
        res_imp = process_pim_import(self.admin, csv_bytes, "colision.csv", dry_run=False)
        self.assertEqual(res_imp["summary"]["rejected"], 1)
        # SKU original preservado intacto
        self.simple_cable.refresh_from_db()
        self.assertEqual(self.simple_cable.sku, "CAB-EXT-01")

    def test_pim02_variant_logical_deactivation_preserves_order_and_restitution(self):
        """Desactivar variante con pedido pendiente: no se puede volver a comprar, pero sí cancelar y restituir."""
        self.client.force_authenticate(user=self.buyer)
        order_resp = self.client.post("/api/v1/orders/", {
            "email": self.buyer.email,
            "first_name": "Test",
            "last_name": "Buyer",
            "phone": "+56911111111",
            "shipping_address": "Av 1",
            "shipping_city": "Santiago",
            "shipping_country": "CL",
            "currency": "CLP",
            "payment_method": "transfer",
            "items": [{"product": str(self.master.id), "variant": str(self.v80.id), "quantity": 2}],
        }, format="json")
        self.assertEqual(order_resp.status_code, 201, order_resp.content)
        order_id = order_resp.json()["id"]
        order = Order.objects.get(pk=order_id)
        self.v80.refresh_from_db()
        self.assertEqual(self.v80.stock, 3)

        # Desactivar variante vía DELETE endpoint
        self.client.force_authenticate(user=self.admin)
        del_resp = self.client.delete(f"/api/v1/admin/products/{self.master.id}/variants/{self.v80.id}/")
        self.assertEqual(del_resp.status_code, 200)
        self.v80.refresh_from_db()
        self.assertFalse(self.v80.is_active)

        # No puede comprarse nuevamente
        with self.assertRaises(InventoryError):
            prepare_inventory([{"product": str(self.master.id), "variant": str(self.v80.id), "quantity": 1}])

        # Intentar eliminar el producto maestro tampoco lo destruye (desactivación lógica)
        del_master = self.client.delete(f"/api/v1/admin/products/{self.master.id}/")
        self.assertEqual(del_master.status_code, 200)
        self.assertTrue(Product.objects.filter(pk=self.master.id).exists())
        self.assertTrue(ProductVariant.objects.filter(pk=self.v80.id).exists())

        # Cancelar el pedido anterior restituye stock a la variante desactivada
        self.client.force_authenticate(user=self.buyer)
        cancel_resp = self.client.delete(f"/api/v1/orders/{order_id}/")
        self.assertEqual(cancel_resp.status_code, 200, cancel_resp.content)
        self.v80.refresh_from_db()
        self.assertEqual(self.v80.stock, 5)
        order_item = order.items.first()
        self.assertEqual(order_item.variant_id, self.v80.id)

    def test_pim03_variant_ars_persistence_and_inheritance(self):
        """Persistencia independiente de ARS y herencia correcta de CLP/USD/ARS."""
        self.client.force_authenticate(user=self.admin)

        # Variante sin precios propios -> hereda CLP, USD y ARS del maestro
        r_inherit = self.client.post(f"/api/v1/admin/products/{self.master.id}/variants/", {
            "sku": "DT770-32",
            "name": "32 Ohm",
            "stock": 2,
        }, format="json")
        self.assertEqual(r_inherit.status_code, 201)
        data_inh = r_inherit.json()
        self.assertEqual(Decimal(data_inh["prices"]["CLP"]), Decimal("180000"))
        self.assertEqual(Decimal(data_inh["prices"]["USD"]), Decimal("190.00"))
        self.assertEqual(Decimal(data_inh["prices"]["ARS"]), Decimal("200000"))

        # Variante con ARS explícito -> persiste y se presenta correctamente
        vid = data_inh["id"]
        r_ars = self.client.patch(f"/api/v1/admin/products/{self.master.id}/variants/{vid}/", {
            "price_ars": "245000",
        }, format="json")
        self.assertEqual(r_ars.status_code, 200)
        self.assertEqual(Decimal(r_ars.json()["price_ars"]), Decimal("245000"))
        self.assertEqual(Decimal(r_ars.json()["prices"]["ARS"]), Decimal("245000"))

    def test_pim05_bundle_variant_compatibility_purchase_and_restitution(self):
        """Bundles con componentes simples + variantes explícitas, bloqueo de maestro ambiguo y restitución."""
        # 1. Bundle ambiguo (apunta a self.master que tiene variantes, sin variant_id) -> rechazado
        ambiguous_bundle = Product.objects.create(
            name="Kit Ambiguo",
            slug="kit-ambiguo-int",
            sku="KIT-AMB-01",
            category=self.cat,
            product_type=Product.ProductType.BUNDLE,
            price=Decimal("190000"),
        )
        BundleItem.objects.create(bundle=ambiguous_bundle, component=self.master, quantity=1)
        self.assertFalse(ambiguous_bundle.in_stock)
        self.assertEqual(ambiguous_bundle.effective_stock, 0)
        with self.assertRaises(InventoryError):
            prepare_inventory([{"product": str(ambiguous_bundle.id), "quantity": 1}])

        # 2. Bundle determinista: 1x DT770-250 (variante) + 2x Cable Extensión (simple)
        valid_bundle = Product.objects.create(
            name="Kit Estudio 250 Ohm",
            slug="kit-estudio-250-int",
            sku="KIT-250-01",
            category=self.cat,
            product_type=Product.ProductType.BUNDLE,
            price=Decimal("215000"),
        )
        BundleItem.objects.create(bundle=valid_bundle, component=self.master, variant=self.v250, quantity=1)
        BundleItem.objects.create(bundle=valid_bundle, component=self.simple_cable, quantity=2)
        self.assertTrue(valid_bundle.in_stock)
        self.assertEqual(valid_bundle.effective_stock, 4)

        self.client.force_authenticate(user=self.buyer)
        order_resp = self.client.post("/api/v1/orders/", {
            "email": self.buyer.email,
            "first_name": "Kit",
            "last_name": "Buyer",
            "phone": "+56922222222",
            "shipping_address": "Av 2",
            "shipping_city": "Santiago",
            "shipping_country": "CL",
            "currency": "CLP",
            "payment_method": "transfer",
            "items": [{"product": str(valid_bundle.id), "quantity": 1}],
        }, format="json")
        self.assertEqual(order_resp.status_code, 201, order_resp.content)
        order_id = order_resp.json()["id"]
        self.v250.refresh_from_db()
        self.simple_cable.refresh_from_db()
        self.master.refresh_from_db()
        self.assertEqual(self.v250.stock, 3)
        self.assertEqual(self.simple_cable.stock, 8)
        self.assertEqual(self.master.stock, 0)

        # Cancelar bundle restituye tanto la variante como el componente simple
        cancel_resp = self.client.delete(f"/api/v1/orders/{order_id}/")
        self.assertEqual(cancel_resp.status_code, 200, cancel_resp.content)
        self.v250.refresh_from_db()
        self.simple_cable.refresh_from_db()
        self.assertEqual(self.v250.stock, 4)
        self.assertEqual(self.simple_cable.stock, 10)
