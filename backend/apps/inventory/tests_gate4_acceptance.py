import importlib
import threading
from decimal import Decimal
from unittest.mock import patch

from django.apps import apps as django_apps
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from apps.inventory.models import (
    InventoryMovement,
    SerialNumberTrack,
    StockReservation,
    Warehouse,
    WarehouseStock,
)
from apps.inventory.services import (
    InventoryServiceError,
    adjust_stock,
    consolidate_order_reservations,
    dispatch_order_reservations,
    expire_stale_reservations,
    get_default_warehouse,
    register_serials,
    reserve_stock_for_order,
    set_product_serialization_mode,
)
from apps.orders.inventory import restore_inventory
from apps.orders.models import Order, OrderItem
from apps.products.bulk_operations import apply_bulk_update
from apps.products.models import Brand, BundleItem, Category, Product, ProductVariant
from apps.products.pim_io import process_pim_import

User = get_user_model()


class Gate4AcceptanceSuiteTest(TransactionTestCase):
    """
    Certificación final WMS-01..WMS-04 sobre PostgreSQL 16 real.
    """

    def setUp(self):
        self.admin = User.objects.create_user(
            username="wms_accept_admin",
            email="wms_accept_admin@levelpro.cl",
            password="TestPassword123!",
            is_staff=True,
            is_superuser=True,
        )
        self.customer = User.objects.create_user(
            username="wms_accept_cust",
            email="wms_accept_cust@levelpro.cl",
            password="TestPassword123!",
        )
        self.cat = Category.objects.create(name="Monitores Estudio", slug="monitores-estudio-acc")
        self.brand = Brand.objects.create(name="GenelecAcc", slug="genelec-acc")

    def _make_product(self, sku, name, stock=0, product_type="stock"):
        return Product.objects.create(
            name=name,
            slug=f"{sku.lower()}-slug",
            sku=sku,
            category=self.cat,
            brand=self.brand,
            price=Decimal("250000"),
            stock=stock,
            product_type=product_type,
            is_active=True,
        )

    def _make_order(self, status="pending", stock_deductions=None, items=None):
        order = Order.objects.create(
            user=self.customer,
            total=Decimal("250000"),
            status=status,
            stock_deductions=stock_deductions,
        )
        for p, v, qty in (items or []):
            OrderItem.objects.create(
                order=order,
                product=p,
                variant=v,
                product_name=p.name,
                price=p.price,
                quantity=qty,
            )
        return order

    # ------------------------------------------------------------------
    # WMS-01: Conciliación de inventario legacy & órdenes históricas
    # ------------------------------------------------------------------
    def test_wms01_synthetic_legacy_migration_and_historical_orders(self):
        mig_mod = importlib.import_module("apps.inventory.migrations.0003_legacy_inventory_reconciliation")

        # 1. Simple product (legacy available=5, pending order with deduction=2)
        p_simple = self._make_product("ACC-SIMP-01", "Monitor Simple", stock=5)
        # 2. Master with variants (legacy residual stock=99 on master MUST NOT migrate; variant=4)
        p_master = self._make_product("ACC-MAST-01", "Monitor Maestro", stock=99)
        v_var = ProductVariant.objects.create(
            product=p_master, sku="ACC-VAR-01", name="Negro", price=Decimal("250000"), stock=4
        )
        # 3. Bundle (product_type=bundle; component is p_simple)
        p_bundle = self._make_product("ACC-BUND-01", "Bundle Monitor", stock=0, product_type="bundle")
        BundleItem.objects.create(bundle=p_bundle, component=p_simple, quantity=1)

        # Orders representing all historical states:
        o_pend_snap = self._make_order("pending", stock_deductions={str(p_simple.id): 2}, items=[(p_simple, None, 2)])
        o_paid_snap = self._make_order("paid", stock_deductions={f"variant:{v_var.id}": 1}, items=[(p_master, v_var, 1)])
        o_pend_hist = self._make_order("pending", stock_deductions=None, items=[(p_simple, None, 1)])
        o_ship_hist = self._make_order("shipped", stock_deductions=None, items=[(p_simple, None, 1)])
        o_canc_hist = self._make_order("cancelled", stock_deductions=None, items=[(p_simple, None, 1)])

        mig_mod.reconcile_legacy_inventory(django_apps, None)

        wh = Warehouse.objects.get(code="BOD-CENTRAL")
        ws_simple = WarehouseStock.objects.get(warehouse=wh, product=p_simple, variant=None)
        ws_var = WarehouseStock.objects.get(warehouse=wh, product=p_master, variant=v_var)

        self.assertFalse(WarehouseStock.objects.filter(warehouse=wh, product=p_master, variant=None).exists())
        self.assertFalse(WarehouseStock.objects.filter(warehouse=wh, product=p_bundle, variant=None).exists())

        self.assertEqual(ws_simple.physical_quantity, 7)
        self.assertEqual(ws_simple.reserved_quantity, 2)
        self.assertEqual(ws_simple.available_quantity, 5)
        p_simple.refresh_from_db()
        self.assertEqual(p_simple.stock, 5)

        self.assertEqual(ws_var.physical_quantity, 5)
        self.assertEqual(ws_var.reserved_quantity, 1)
        self.assertEqual(ws_var.available_quantity, 4)

        self.assertEqual(StockReservation.objects.filter(order=o_pend_hist).count(), 0)
        self.assertEqual(StockReservation.objects.filter(order=o_ship_hist).count(), 0)
        self.assertEqual(StockReservation.objects.filter(order=o_canc_hist).count(), 0)
        self.assertTrue(StockReservation.objects.filter(order=o_pend_snap, status="temporary", quantity=2).exists())
        self.assertTrue(StockReservation.objects.filter(order=o_paid_snap, status="consolidated", quantity=1).exists())

        # Subsequent lifecycle on historical order WITHOUT stock_deductions:
        # Case A: Pago posterior -> consolidates without inventing reservations or double-deducting
        o_pend_hist.status = "paid"
        o_pend_hist.save()
        ws_simple.refresh_from_db()
        self.assertEqual(StockReservation.objects.filter(order=o_pend_hist).count(), 0)
        self.assertEqual(ws_simple.physical_quantity, 7)

        # Case B: Despacho posterior on historical paid order without stock_deductions -> no crash, no double-deduct
        o_pend_hist.status = "shipped"
        o_pend_hist.save()
        ws_simple.refresh_from_db()
        self.assertEqual(ws_simple.physical_quantity, 7)

        # Case C: Cancelación posterior on historical order without stock_deductions (idempotent restore)
        o_pend_hist2 = self._make_order("pending", stock_deductions=None, items=[(p_simple, None, 1)])
        o_pend_hist2.status = "cancelled"
        o_pend_hist2.save()
        ws_simple.refresh_from_db()
        self.assertEqual(ws_simple.physical_quantity, 8)
        from django.db import transaction
        with transaction.atomic():
            restore_inventory(o_pend_hist2, reason="Reintento cancelación")
        ws_simple.refresh_from_db()
        self.assertEqual(ws_simple.physical_quantity, 8)

        # Case D: Non-reconstructible discrepancy blocked by DB/model constraints
        with self.assertRaises((IntegrityError, ValidationError)):
            ws_simple.non_sellable_quantity = 999
            ws_simple.full_clean()

    # ------------------------------------------------------------------
    # WMS-02: Atomicidad de estados & concurrencia
    # ------------------------------------------------------------------
    def test_wms02_order_save_rollback_on_forced_exception(self):
        wh = get_default_warehouse()
        p = self._make_product("ACC-ATOM-01", "Interfaz Atómica", stock=0)
        adjust_stock(
            warehouse=wh,
            product=p,
            delta_physical=5,
            movement_type=InventoryMovement.MovementType.OPENING,
            reason="Apertura",
            actor=self.admin,
        )
        order = self._make_order("pending", items=[(p, None, 2)])
        reserve_stock_for_order(order, {p.id: 2}, ttl_minutes=30, actor=self.admin)

        kardex_before = InventoryMovement.objects.count()
        with patch("apps.inventory.services.consolidate_order_reservations", side_effect=RuntimeError("Fallo simulado")):
            with self.assertRaises(RuntimeError):
                order.status = "paid"
                order.save()

        order.refresh_from_db()
        self.assertEqual(order.status, "pending")
        res = StockReservation.objects.get(order=order)
        self.assertEqual(res.status, StockReservation.Status.TEMPORARY)
        ws = WarehouseStock.objects.get(warehouse=wh, product=p, variant=None)
        self.assertEqual(ws.physical_quantity, 5)
        self.assertEqual(ws.reserved_quantity, 2)
        self.assertEqual(InventoryMovement.objects.count(), kardex_before)

    def test_wms02_concurrency_expiration_vs_payment_and_cancel_vs_dispatch(self):
        wh = get_default_warehouse()
        p = self._make_product("ACC-CONC-01", "Micrófono Concurrencia", stock=0)
        adjust_stock(
            warehouse=wh,
            product=p,
            delta_physical=5,
            movement_type=InventoryMovement.MovementType.OPENING,
            reason="Apertura",
            actor=self.admin,
        )

        # 1. Expiration vs concurrent payment
        order_pay = self._make_order("pending", items=[(p, None, 1)])
        res = reserve_stock_for_order(order_pay, {p.id: 1}, ttl_minutes=-5, actor=self.admin)[0]

        barrier = threading.Barrier(2)
        errors = []

        def t_expire():
            try:
                barrier.wait(timeout=5)
                expire_stale_reservations()
            except Exception as e:
                errors.append(e)
            finally:
                connection.close()

        def t_pay():
            try:
                barrier.wait(timeout=5)
                o = Order.objects.get(pk=order_pay.pk)
                o.status = "paid"
                o.save()
            except Exception as e:
                errors.append(e)
            finally:
                connection.close()

        t1 = threading.Thread(target=t_expire)
        t2 = threading.Thread(target=t_pay)
        t1.start()
        t2.start()
        t1.join(timeout=10)
        t2.join(timeout=10)

        self.assertEqual(errors, [])
        order_pay.refresh_from_db()
        res.refresh_from_db()
        self.assertEqual(order_pay.status, "paid")
        self.assertEqual(res.status, StockReservation.Status.CONSOLIDATED)

        # 2. Cancellation vs dispatch on a pending order (both lock Order first)
        order_ship = self._make_order("pending", items=[(p, None, 1)])
        res2 = reserve_stock_for_order(order_ship, {p.id: 1}, ttl_minutes=30, actor=self.admin)[0]

        barrier2 = threading.Barrier(2)

        def t_cancel():
            from django.db import transaction

            try:
                barrier2.wait(timeout=5)
                with transaction.atomic():
                    o = Order.objects.select_for_update().get(pk=order_ship.pk)
                    if o.status == "pending":
                        o.status = "cancelled"
                        o.save()
            except Exception:
                pass
            finally:
                connection.close()

        def t_dispatch():
            from django.db import transaction

            try:
                barrier2.wait(timeout=5)
                with transaction.atomic():
                    o = Order.objects.select_for_update().get(pk=order_ship.pk)
                    if o.status in ("pending", "paid"):
                        o.status = "shipped"
                        o.save()
            except Exception:
                pass
            finally:
                connection.close()

        t3 = threading.Thread(target=t_cancel)
        t4 = threading.Thread(target=t_dispatch)
        t3.start()
        t4.start()
        t3.join(timeout=10)
        t4.join(timeout=10)

        order_ship.refresh_from_db()
        res2.refresh_from_db()
        self.assertIn(order_ship.status, ("cancelled", "shipped"))
        if order_ship.status == "cancelled":
            self.assertEqual(res2.status, StockReservation.Status.RELEASED)
        else:
            self.assertEqual(res2.status, StockReservation.Status.CONSUMED)

    # ------------------------------------------------------------------
    # WMS-03: Fuente única de verdad (Bulk Edit, PIM Import, Warehouse PATCH)
    # ------------------------------------------------------------------
    def test_wms03_bulk_edit_pim_import_and_warehouse_patch_sync(self):
        wh = get_default_warehouse()
        p = self._make_product("ACC-SSOT-01", "Producto SSOT", stock=0)
        adjust_stock(
            warehouse=wh,
            product=p,
            delta_physical=5,
            movement_type=InventoryMovement.MovementType.OPENING,
            reason="Apertura",
            actor=self.admin,
        )

        # 1. Bulk edit stock_set -> 12 must create Kardex movement & update WarehouseStock
        res_bulk = apply_bulk_update(
            self.admin,
            {
                "target_scope": "products",
                "target_ids": [str(p.id)],
                "operation": "stock_set",
                "params": {"stock": 12},
            },
        )
        self.assertEqual(res_bulk["applied_count"], 1)
        ws = WarehouseStock.objects.get(warehouse=wh, product=p, variant=None)
        self.assertEqual(ws.physical_quantity, 12)
        p.refresh_from_db()
        self.assertEqual(p.stock, 12)
        self.assertTrue(
            InventoryMovement.objects.filter(
                product=p, source_document_type="BULK_PIM", quantity=7
            ).exists()
        )

        # 2. PIM import CSV updating stock -> 9 must create Kardex movement & update WarehouseStock
        csv_bytes = b"sku,name,stock\nACC-SSOT-01,Producto SSOT,9\n"
        res_imp = process_pim_import(self.admin, csv_bytes, "update.csv", dry_run=False)
        self.assertEqual(res_imp["summary"]["updated"], 1)
        ws.refresh_from_db()
        self.assertEqual(ws.physical_quantity, 9)
        p.refresh_from_db()
        self.assertEqual(p.stock, 9)
        self.assertTrue(
            InventoryMovement.objects.filter(
                product=p, source_document_type="PIM_IMPORT"
            ).exists()
        )

        # 3. Warehouse PATCH is_sellable_online=False must drop public availability to 0 while preserving reservation
        order = self._make_order("pending", items=[(p, None, 2)])
        reserve_stock_for_order(order, {p.id: 2}, ttl_minutes=30, actor=self.admin)
        p.refresh_from_db()
        self.assertEqual(p.stock, 7)

        client = APIClient()
        client.force_authenticate(user=self.admin)
        resp = client.patch(
            f"/api/v1/admin/inventory/warehouses/{wh.id}/",
            {"is_sellable_online": False},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        p.refresh_from_db()
        self.assertEqual(p.stock, 0)
        self.assertEqual(StockReservation.objects.get(order=order).status, StockReservation.Status.TEMPORARY)

    # ------------------------------------------------------------------
    # WMS-04: Integridad de seriales en variantes
    # ------------------------------------------------------------------
    def test_wms04_multivariant_serial_integrity_and_dispatch_binding(self):
        wh = get_default_warehouse()
        p = self._make_product("ACC-SN-MAST", "Synth Multi", stock=0)
        v1 = ProductVariant.objects.create(product=p, sku="ACC-SN-V1", name="61 Teclas", price=Decimal("500000"), stock=0)
        v2 = ProductVariant.objects.create(product=p, sku="ACC-SN-V2", name="88 Teclas", price=Decimal("700000"), stock=0)
        set_product_serialization_mode(p, "required", actor=self.admin)

        adjust_stock(
            warehouse=wh,
            product=p,
            variant=v1,
            delta_physical=2,
            movement_type=InventoryMovement.MovementType.OPENING,
            reason="Ingreso V1",
            actor=self.admin,
        )
        register_serials(
            warehouse=wh,
            product=p,
            variant=v1,
            serial_numbers=["SN-V1-001", "SN-V1-002"],
            actor=self.admin,
        )
        adjust_stock(
            warehouse=wh,
            product=p,
            variant=v2,
            delta_physical=1,
            movement_type=InventoryMovement.MovementType.OPENING,
            reason="Ingreso V2",
            actor=self.admin,
        )
        register_serials(
            warehouse=wh,
            product=p,
            variant=v2,
            serial_numbers=["SN-V2-001"],
            actor=self.admin,
        )

        # Duplicate serial on same SKU/variant must be rejected
        with self.assertRaises(InventoryServiceError):
            register_serials(
                warehouse=wh,
                product=p,
                variant=v1,
                serial_numbers=["SN-V1-001"],
                actor=self.admin,
            )
        # Exceeding physical quantity in warehouse must be rejected
        with self.assertRaises(InventoryServiceError):
            register_serials(
                warehouse=wh,
                product=p,
                variant=v1,
                serial_numbers=["SN-V1-EXTRA"],
                actor=self.admin,
            )

        # Reserve, consolidate & dispatch exact serial on v1
        order = self._make_order("paid", items=[(p, v1, 1)])
        reserve_stock_for_order(order, {f"variant:{v1.id}": 1}, ttl_minutes=30, actor=self.admin)
        consolidate_order_reservations(order)
        dispatch_order_reservations(
            order,
            serial_assignments={f"variant:{v1.id}": ["SN-V1-001"]},
            actor=self.admin,
        )

        sn1 = SerialNumberTrack.objects.get(serial_number="SN-V1-001")
        self.assertEqual(sn1.status, SerialNumberTrack.Status.DISPATCHED)
        self.assertEqual(sn1.order_id, order.id)
        self.assertEqual(sn1.customer_id, self.customer.id)
        sn2 = SerialNumberTrack.objects.get(serial_number="SN-V1-002")
        self.assertEqual(sn2.status, SerialNumberTrack.Status.IN_STOCK)
