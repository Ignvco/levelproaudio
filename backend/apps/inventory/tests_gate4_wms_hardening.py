import threading
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import connection
from django.test import TransactionTestCase

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
    receive_stock_into_warehouse,
    release_order_reservations,
    reserve_stock_for_order,
    set_product_serialization_mode,
    sync_target_stock_to_wms,
)
from apps.orders.inventory import restore_inventory
from apps.orders.models import Order, OrderItem
from apps.payments.models import Payment, PaymentStatus
from apps.products.models import Brand, BundleItem, Category, Product, ProductVariant
from apps.analytics.models import AuditEvent

User = get_user_model()


class Gate4WMSHardeningTest(TransactionTestCase):
    """
    Pruebas de reproducción y verificación WMS-06..WMS-09 sobre PostgreSQL 16 real.
    """

    def setUp(self):
        self.admin = User.objects.create_user(
            username="wms_hard_admin",
            email="wms_hard_admin@levelpro.cl",
            password="TestPassword123!",
            is_staff=True,
            is_superuser=True,
        )
        self.customer = User.objects.create_user(
            username="wms_hard_cust",
            email="wms_hard_cust@levelpro.cl",
            password="TestPassword123!",
        )
        self.cat = Category.objects.create(name="Consolas Hardening", slug="consolas-hard")
        self.brand = Brand.objects.create(name="MidasHard", slug="midas-hard")

    def _make_product(self, sku, name, product_type="stock", serialization_mode="none"):
        return Product.objects.create(
            name=name,
            slug=f"{sku.lower()}-slug",
            sku=sku,
            category=self.cat,
            brand=self.brand,
            price=Decimal("300000"),
            stock=0,
            product_type=product_type,
            serialization_mode=serialization_mode,
            is_active=True,
        )

    def _make_order(self, status="pending", stock_deductions=None, items=None):
        order = Order.objects.create(
            user=self.customer,
            total=Decimal("300000"),
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
    # WMS-06: Ciclo de vida e idempotencia de reservas
    # ------------------------------------------------------------------
    def test_wms06_expiration_then_cancellation_preserves_physical_and_late_payment_in_review(self):
        wh = get_default_warehouse()
        p = self._make_product("HARD-06-01", "Consola WMS06")
        adjust_stock(
            warehouse=wh,
            product=p,
            delta_physical=10,
            movement_type=InventoryMovement.MovementType.OPENING,
            reason="Apertura 10",
            actor=self.admin,
        )

        # 1. Reserva 2 -> expira -> cancela: físico final DEBE ser 10 (no 12!)
        o1 = self._make_order("pending", stock_deductions={str(p.id): 2}, items=[(p, None, 2)])
        reserve_stock_for_order(o1, {p.id: 2}, ttl_minutes=-5, actor=self.admin)
        self.assertEqual(expire_stale_reservations(), 1)
        self.assertEqual(StockReservation.objects.get(order=o1).status, StockReservation.Status.EXPIRED)

        o1.status = "cancelled"
        o1.save()
        # Repetir restore_inventory manualmente
        restore_inventory(o1, reason="Reintento")
        ws = WarehouseStock.objects.get(warehouse=wh, product=p, variant=None)
        self.assertEqual(ws.physical_quantity, 10)
        self.assertEqual(ws.reserved_quantity, 0)
        self.assertEqual(ws.available_quantity, 10)

        # 2. Pago tardío después de expirar reserva -> Payment pasa a IN_REVIEW y Order NO avanza a PAID
        o2 = self._make_order("pending", stock_deductions={str(p.id): 2}, items=[(p, None, 2)])
        reserve_stock_for_order(o2, {p.id: 2}, ttl_minutes=-5, actor=self.admin)
        expire_stale_reservations()

        pay = Payment.objects.create(
            order=o2,
            provider="mercadopago",
            amount=Decimal("300000"),
            currency="CLP",
            status=PaymentStatus.APPROVED,
        )
        self.assertEqual(pay.status, PaymentStatus.IN_REVIEW)
        o2.refresh_from_db()
        self.assertEqual(o2.status, "pending")
        with self.assertRaises(ValidationError):
            o2.status = "paid"
            o2.save()

        # 3. Cancelación autorizada antes de despacho en orden PAID -> libera reserva CONSOLIDATED explícitamente
        o3 = self._make_order("pending", stock_deductions={str(p.id): 2}, items=[(p, None, 2)])
        reserve_stock_for_order(o3, {p.id: 2}, ttl_minutes=30, actor=self.admin)
        o3.status = "paid"
        o3.save()
        ws.refresh_from_db()
        self.assertEqual(ws.reserved_quantity, 2)
        release_order_reservations(o3, reason="Cancelación autorizada antes de despacho", actor=self.admin)
        o3.status = "cancelled"
        o3.save()
        ws.refresh_from_db()
        self.assertEqual(ws.reserved_quantity, 0)
        self.assertEqual(ws.physical_quantity, 10)
        self.assertEqual(StockReservation.objects.get(order=o3).status, StockReservation.Status.RELEASED)

        # 4. Reembolso posterior al despacho (SHIPPED -> CANCELLED) no auto-restituye físico
        o4 = self._make_order("paid", stock_deductions={str(p.id): 1}, items=[(p, None, 1)])
        reserve_stock_for_order(o4, {p.id: 1}, ttl_minutes=30, actor=self.admin)
        consolidate_order_reservations(o4)
        o4.status = "shipped"
        o4.save()
        ws.refresh_from_db()
        self.assertEqual(ws.physical_quantity, 9)
        o4.status = "cancelled"
        o4.save()
        ws.refresh_from_db()
        self.assertEqual(ws.physical_quantity, 9)
        self.assertEqual(StockReservation.objects.get(order=o4).status, StockReservation.Status.CONSUMED)

        # 5. Orden histórica BUNDLE sin stock_deductions no muta componentes actuales y registra discrepancia
        bundle = self._make_product("HARD-06-BND", "Bundle Histórico", product_type="bundle")
        BundleItem.objects.create(bundle=bundle, component=p, quantity=3)
        o_hist = self._make_order("pending", stock_deductions=None, items=[(bundle, None, 1)])
        o_hist.status = "cancelled"
        o_hist.save()
        ws.refresh_from_db()
        self.assertEqual(ws.physical_quantity, 9)
        self.assertTrue(
            AuditEvent.objects.filter(
                action="LEGACY_BUNDLE_DISCREPANCY_PENDING", resource_id=str(o_hist.id)
            ).exists()
        )

    # ------------------------------------------------------------------
    # WMS-07: Consistencia dimensional multi-bodega
    # ------------------------------------------------------------------
    def test_wms07_multiwarehouse_dimensional_projection_and_concurrent_updates(self):
        wh_central = get_default_warehouse()
        wh_show = Warehouse.objects.create(
            code="BOD-SHOW-07",
            name="Showroom 07",
            warehouse_type=Warehouse.WarehouseType.SHOWROOM,
            is_active=True,
            is_sellable_online=True,
            fulfillment_priority=20,
        )
        wh_transit = Warehouse.objects.create(
            code="BOD-TRN-07",
            name="Tránsito 07",
            warehouse_type=Warehouse.WarehouseType.TRANSIT,
            is_active=True,
            is_sellable_online=False,
            fulfillment_priority=99,
        )
        p = self._make_product("HARD-07-01", "Monitor Multi-Bodega")

        adjust_stock(warehouse=wh_central, product=p, delta_physical=5, delta_non_sellable=1, reason="Central", actor=self.admin)
        adjust_stock(warehouse=wh_show, product=p, delta_physical=5, reason="Showroom", actor=self.admin)
        adjust_stock(warehouse=wh_transit, product=p, delta_physical=7, reason="Tránsito", actor=self.admin)
        # Central avail=4 (5-1 non_sellable), Showroom avail=5, Transit not sellable -> global=9
        p.refresh_from_db()
        self.assertEqual(p.stock, 9)

        # Ajuste global a 9 NO debe sumar +4 ni producir 13
        sync_target_stock_to_wms(product=p, target_stock=9, reason="Sync 9", actor=self.admin)
        p.refresh_from_db()
        self.assertEqual(p.stock, 9)

        # Ajuste global distinto sin bodega explícita sobre SKU multi-bodega debe rechazarse
        with self.assertRaises(InventoryServiceError):
            sync_target_stock_to_wms(product=p, target_stock=12, reason="Ambiguo", actor=self.admin)

        # Ajuste con bodega explícita modifica solo esa bodega
        sync_target_stock_to_wms(product=p, target_stock=8, warehouse=wh_show, reason="Showroom a 8", actor=self.admin)
        p.refresh_from_db()
        self.assertEqual(p.stock, 12)  # 4 + 8

        # Concurrencia multi-bodega sobre el mismo SKU mantiene proyección exacta
        barrier = threading.Barrier(2)

        def adj_central():
            try:
                barrier.wait(timeout=5)
                adjust_stock(warehouse=wh_central, product=p, delta_physical=2, reason="C+2", actor=self.admin)
            finally:
                connection.close()

        def adj_show():
            try:
                barrier.wait(timeout=5)
                adjust_stock(warehouse=wh_show, product=p, delta_physical=3, reason="S+3", actor=self.admin)
            finally:
                connection.close()

        t1 = threading.Thread(target=adj_central)
        t2 = threading.Thread(target=adj_show)
        t1.start()
        t2.start()
        t1.join(timeout=10)
        t2.join(timeout=10)
        p.refresh_from_db()
        self.assertEqual(p.stock, 17)  # 12 + 2 + 3

    # ------------------------------------------------------------------
    # WMS-08: Integridad de serialización REQUIRED & contrato Gate 5
    # ------------------------------------------------------------------
    def test_wms08_required_serialization_atomic_entry_exit_and_idempotency_conflict(self):
        wh = get_default_warehouse()
        p = self._make_product("HARD-08-01", "Interface Serializada", serialization_mode="required")

        # Entrada REQUIRED sin seriales -> rechazo y rollback completo
        kardex_before = InventoryMovement.objects.count()
        with self.assertRaises(InventoryServiceError):
            adjust_stock(warehouse=wh, product=p, delta_physical=2, reason="Sin seriales", actor=self.admin)
        self.assertFalse(WarehouseStock.objects.filter(warehouse=wh, product=p, physical_quantity__gt=0).exists())
        self.assertEqual(InventoryMovement.objects.count(), kardex_before)

        # Entrada REQUIRED vía contrato reutilizable Gate 5 con seriales válidos -> atómico
        ws, mov1 = receive_stock_into_warehouse(
            warehouse=wh,
            product=p,
            quantity=2,
            serial_numbers=["SN-H08-1", "SN-H08-2"],
            source_document_id="REC-001",
            actor=self.admin,
            idempotency_key="rec-001",
        )
        self.assertEqual(ws.physical_quantity, 2)
        self.assertEqual(
            SerialNumberTrack.objects.filter(product=p, warehouse=wh, status=SerialNumberTrack.Status.IN_STOCK).count(),
            2,
        )

        # Replay idempotente con misma clave y mismo payload -> OK
        _, mov_replay = receive_stock_into_warehouse(
            warehouse=wh,
            product=p,
            quantity=2,
            serial_numbers=["SN-H08-1", "SN-H08-2"],
            source_document_id="REC-001",
            actor=self.admin,
            idempotency_key="rec-001",
        )
        self.assertEqual(mov1.id, mov_replay.id)

        # Conflicto de idempotencia (misma clave, payload diferente) -> rechazo
        with self.assertRaises(InventoryServiceError):
            receive_stock_into_warehouse(
                warehouse=wh,
                product=p,
                quantity=3,
                serial_numbers=["SN-H08-1", "SN-H08-2", "SN-H08-3"],
                source_document_id="REC-001",
                actor=self.admin,
                idempotency_key="rec-001",
            )

        # Ajuste negativo REQUIRED sin serial -> rechazo; con serial -> DECOMMISSIONED
        with self.assertRaises(InventoryServiceError):
            adjust_stock(warehouse=wh, product=p, delta_physical=-1, reason="Baja sin serial", actor=self.admin)
        adjust_stock(
            warehouse=wh,
            product=p,
            delta_physical=-1,
            serial_numbers=["SN-H08-2"],
            reason="Baja por daño",
            actor=self.admin,
        )
        self.assertEqual(SerialNumberTrack.objects.get(serial_number="SN-H08-2").status, SerialNumberTrack.Status.DECOMMISSIONED)
        ws.refresh_from_db()
        self.assertEqual(ws.physical_quantity, 1)

    # ------------------------------------------------------------------
    # WMS-09: Despachos y asignación de seriales
    # ------------------------------------------------------------------
    def test_wms09_dispatch_guards_duplicate_serials_distributed_and_preorder(self):
        wh_central = get_default_warehouse()
        wh_show = Warehouse.objects.create(
            code="BOD-SHOW-09",
            name="Showroom 09",
            warehouse_type=Warehouse.WarehouseType.SHOWROOM,
            is_active=True,
            is_sellable_online=True,
            fulfillment_priority=20,
        )
        p = self._make_product("HARD-09-01", "Preamp Despacho", serialization_mode="required")
        receive_stock_into_warehouse(
            warehouse=wh_central, product=p, quantity=1, serial_numbers=["SN-09-A"], actor=self.admin
        )
        receive_stock_into_warehouse(
            warehouse=wh_show, product=p, quantity=1, serial_numbers=["SN-09-B"], actor=self.admin
        )

        # 1. Despacho de 2 unidades distribuidas con serial repetido -> rechazo y rollback
        o_dist = self._make_order("paid", stock_deductions={str(p.id): 2}, items=[(p, None, 2)])
        reservations = reserve_stock_for_order(o_dist, {p.id: 2}, ttl_minutes=30, actor=self.admin)
        consolidate_order_reservations(o_dist)
        self.assertEqual(len(reservations), 2)

        with self.assertRaises(InventoryServiceError):
            dispatch_order_reservations(
                o_dist,
                serial_assignments={
                    str(reservations[0].id): ["SN-09-A"],
                    str(reservations[1].id): ["SN-09-A"],
                },
                actor=self.admin,
            )
        # Verificar rollback completo
        self.assertEqual(StockReservation.objects.filter(order=o_dist, status=StockReservation.Status.CONSOLIDATED).count(), 2)

        # Despacho distribuido válido usando IDs de reserva
        movs = dispatch_order_reservations(
            o_dist,
            serial_assignments={
                str(reservations[0].id): ["SN-09-A"] if reservations[0].warehouse_id == wh_central.id else ["SN-09-B"],
                str(reservations[1].id): ["SN-09-B"] if reservations[1].warehouse_id == wh_show.id else ["SN-09-A"],
            },
            actor=self.admin,
        )
        self.assertEqual(len(movs), 2)
        # Replay idempotente del despacho ya confirmado
        movs_replay = dispatch_order_reservations(o_dist, actor=self.admin)
        self.assertEqual(len(movs_replay), 2)

        # 2. Orden con demanda física sin reserva -> rechazo al intentar avanzar a SHIPPED
        o_no_res = self._make_order("paid", stock_deductions={str(p.id): 1}, items=[(p, None, 1)])
        with self.assertRaises(ValidationError):
            o_no_res.status = "shipped"
            o_no_res.save()

        # 3. Productos PREORDER y ON_DEMAND preservan despacho sin reserva física
        p_pre = self._make_product("HARD-09-PRE", "Preorder Item", product_type="preorder")
        o_pre = self._make_order("paid", stock_deductions={}, items=[(p_pre, None, 1)])
        o_pre.status = "shipped"
        o_pre.save()
        o_pre.refresh_from_db()
        self.assertEqual(o_pre.status, "shipped")
