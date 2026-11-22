# apps/inventory/tests_gate4_wms.py
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal
import pytest
from django.contrib.auth.models import Group
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.management import call_command
from django.db import close_old_connections, connection, transaction
from django.db.utils import DatabaseError
from django.test import TransactionTestCase
from django.utils import timezone
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
    create_and_dispatch_transfer,
    dispatch_order_reservations,
    expire_stale_reservations,
    receive_transfer,
    register_serials,
    release_order_reservations,
    reserve_stock_for_order,
    set_product_serialization_mode,
)
from apps.orders.inventory import InventoryError, deduct_inventory, prepare_inventory
from apps.orders.models import Order, OrderItem, OrderStatus
from apps.products.models import Brand, BundleItem, Category, Product, ProductVariant
from apps.users.models import User
from core.rbac.constants import ROLE_SALES, ROLE_SUPER_ADMIN, ROLE_WAREHOUSE


class Gate4WMSConcurrencyTests(TransactionTestCase):
    """Pruebas de concurrencia real en PostgreSQL 16 para última unidad disponible."""

    def setUp(self):
        call_command("setup_rbac")
        self.user1 = User.objects.create_user(
            username="conc_u1", email="conc_u1@test.local", password="PasswordSegura123!"
        )
        self.user2 = User.objects.create_user(
            username="conc_u2", email="conc_u2@test.local", password="PasswordSegura123!"
        )
        self.cat = Category.objects.create(name="Interfaces", slug="interfaces-conc")
        self.wh, _ = Warehouse.objects.get_or_create(
            code="BOD-CENTRAL",
            defaults={"name": "Bodega Central", "warehouse_type": "central", "is_sellable_online": True, "is_default": True},
        )
        self.prod = Product.objects.create(
            name="Audio Interface 2x2",
            slug="audio-interface-2x2-conc",
            sku="LPA-INT-2X2",
            price=Decimal("199990"),
            stock=1,
            category=self.cat,
            is_active=True,
        )
        adjust_stock(
            warehouse=self.wh,
            product=self.prod,
            delta_physical=1,
            movement_type=InventoryMovement.MovementType.OPENING,
            reason="Stock inicial concurrencia",
        )

    def test_concurrent_last_unit_reservation_only_one_succeeds(self):
        results = []

        def _try_buy(user):
            close_old_connections()
            try:
                with transaction.atomic():
                    lines, demand = prepare_inventory([{"product": str(self.prod.id), "quantity": 1}])
                    order = Order.objects.create(
                        user=user,
                        total=Decimal("199990"),
                        stock_deductions={str(k): v for k, v in demand.items()},
                    )
                    deduct_inventory(demand, order=order, actor=user)
                return "OK"
            except (InventoryError, InventoryServiceError):
                return "REJECTED"
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            f1 = pool.submit(_try_buy, self.user1)
            f2 = pool.submit(_try_buy, self.user2)
            results = [f1.result(), f2.result()]

        assert results.count("OK") == 1
        assert results.count("REJECTED") == 1
        ws = WarehouseStock.objects.get(warehouse=self.wh, product=self.prod)
        assert ws.physical_quantity == 1
        assert ws.reserved_quantity == 1
        assert ws.available_quantity == 0
        self.prod.refresh_from_db()
        assert self.prod.stock == 0


@pytest.mark.django_db(transaction=True)
class TestGate4WarehouseManagement:
    def _setup(self):
        call_command("setup_rbac")
        admin = User.objects.create_user(
            username=f"wms_adm_{uuid.uuid4().hex[:5]}",
            email=f"wms_adm_{uuid.uuid4().hex[:5]}@test.local",
            password="PasswordSegura123!",
            is_staff=True,
            is_superuser=True,
        )
        admin.groups.add(Group.objects.get(name=ROLE_SUPER_ADMIN))

        wh_user = User.objects.create_user(
            username=f"wms_wh_{uuid.uuid4().hex[:5]}",
            email=f"wms_wh_{uuid.uuid4().hex[:5]}@test.local",
            password="PasswordSegura123!",
            is_staff=True,
        )
        wh_user.groups.add(Group.objects.get(name=ROLE_WAREHOUSE))

        sales_user = User.objects.create_user(
            username=f"wms_sal_{uuid.uuid4().hex[:5]}",
            email=f"wms_sal_{uuid.uuid4().hex[:5]}@test.local",
            password="PasswordSegura123!",
            is_staff=True,
        )
        sales_user.groups.add(Group.objects.get(name=ROLE_SALES))

        cat = Category.objects.create(name="Monitores", slug=f"mon-{uuid.uuid4().hex[:6]}")
        brand = Brand.objects.create(name="Genelec", slug=f"gen-{uuid.uuid4().hex[:6]}")
        wh_central, _ = Warehouse.objects.get_or_create(
            code="BOD-CENTRAL",
            defaults={
                "name": "Bodega Central",
                "warehouse_type": Warehouse.WarehouseType.CENTRAL,
                "is_sellable_online": True,
                "fulfillment_priority": 10,
                "is_default": True,
            },
        )
        wh_showroom = Warehouse.objects.create(
            code=f"SHOW-{uuid.uuid4().hex[:4].upper()}",
            name="Showroom Santiago",
            warehouse_type=Warehouse.WarehouseType.SHOWROOM,
            is_sellable_online=True,
            fulfillment_priority=20,
        )
        wh_transit = Warehouse.objects.create(
            code=f"TRN-{uuid.uuid4().hex[:4].upper()}",
            name="Tránsito Aduana",
            warehouse_type=Warehouse.WarehouseType.TRANSIT,
            is_sellable_online=False,
            fulfillment_priority=99,
        )
        return admin, wh_user, sales_user, cat, brand, wh_central, wh_showroom, wh_transit

    def test_transit_warehouse_never_sellable_and_dimensional_invariants(self):
        admin, _, _, cat, brand, wh_c, _, wh_t = self._setup()
        # Tránsito no puede marcarse como vendible online
        wh_t.is_sellable_online = True
        with pytest.raises(ValidationError):
            wh_t.full_clean()

        prod = Product.objects.create(
            name="Monitor Estudio", slug=f"mon-{uuid.uuid4().hex[:6]}",
            sku=f"SKU-{uuid.uuid4().hex[:6]}", price=Decimal("300000"), category=cat, brand=brand,
        )
        adjust_stock(warehouse=wh_c, product=prod, delta_physical=5, actor=admin)
        # Stock en tránsito NO suma a disponibilidad pública
        adjust_stock(warehouse=wh_t, product=prod, delta_physical=10, actor=admin)
        prod.refresh_from_db()
        assert prod.stock == 5

        # No permite stock negativo
        with pytest.raises(InventoryServiceError):
            adjust_stock(warehouse=wh_c, product=prod, delta_physical=-6, actor=admin)

    def test_kardex_append_only_orm_and_postgres_triggers(self):
        admin, _, _, cat, brand, wh_c, _, _ = self._setup()
        prod = Product.objects.create(
            name="Cable XLR", slug=f"xlr-{uuid.uuid4().hex[:6]}",
            sku=f"SKU-{uuid.uuid4().hex[:6]}", price=Decimal("15000"), category=cat, brand=brand,
        )
        _, mov = adjust_stock(warehouse=wh_c, product=prod, delta_physical=4, actor=admin)

        with pytest.raises(PermissionDenied):
            mov.quantity = 99
            mov.save()
        with pytest.raises(PermissionDenied):
            mov.delete()
        with pytest.raises(PermissionDenied):
            InventoryMovement.objects.filter(pk=mov.pk).update(quantity=99)

        if connection.vendor == "postgresql":
            with pytest.raises(DatabaseError):
                with transaction.atomic():
                    with connection.cursor() as cur:
                        cur.execute("UPDATE inventory_inventorymovement SET quantity = 99 WHERE id = %s", [str(mov.id)])
            with pytest.raises(DatabaseError):
                with transaction.atomic():
                    with connection.cursor() as cur:
                        cur.execute("DELETE FROM inventory_inventorymovement WHERE id = %s", [str(mov.id)])
            with pytest.raises(DatabaseError):
                with transaction.atomic():
                    with connection.cursor() as cur:
                        cur.execute("TRUNCATE TABLE inventory_inventorymovement")

    def test_reservations_ttl_never_expires_paid_orders_and_cancellation_releases(self):
        admin, _, _, cat, brand, wh_c, _, _ = self._setup()
        prod = Product.objects.create(
            name="Preamp", slug=f"pre-{uuid.uuid4().hex[:6]}",
            sku=f"SKU-{uuid.uuid4().hex[:6]}", price=Decimal("200000"), category=cat, brand=brand,
        )
        adjust_stock(warehouse=wh_c, product=prod, delta_physical=3, actor=admin)

        # Orden 1: se paga -> consolidada -> NUNCA expira
        o_paid = Order.objects.create(user=admin, total=Decimal("200000"))
        reserve_stock_for_order(o_paid, {prod.id: 1}, actor=admin, ttl_minutes=-5)
        o_paid.status = OrderStatus.PAID
        o_paid.save()

        # Orden 2: queda pending y vencida -> expira y libera
        o_exp = Order.objects.create(user=admin, total=Decimal("200000"))
        reserve_stock_for_order(o_exp, {prod.id: 1}, actor=admin, ttl_minutes=-5)

        released = expire_stale_reservations()
        assert released == 1

        ws = WarehouseStock.objects.get(warehouse=wh_c, product=prod)
        assert ws.physical_quantity == 3
        assert ws.reserved_quantity == 1
        assert ws.available_quantity == 2
        assert StockReservation.objects.get(order=o_paid).status == StockReservation.Status.CONSOLIDATED
        assert StockReservation.objects.get(order=o_exp).status == StockReservation.Status.EXPIRED

    def test_transfers_and_serial_tracking_and_regularization_bf46(self):
        admin, wh_user, sales_user, cat, brand, wh_c, wh_s, _ = self._setup()
        prod = Product.objects.create(
            name="Sintetizador Pro", slug=f"sint-{uuid.uuid4().hex[:6]}",
            sku=f"SKU-{uuid.uuid4().hex[:6]}", price=Decimal("900000"), category=cat, brand=brand,
            serialization_mode=Product.SerializationMode.NONE,
        )
        adjust_stock(warehouse=wh_c, product=prod, delta_physical=2, actor=admin)

        # No puede pasar a REQUIRED sin regularizar seriales
        with pytest.raises(InventoryServiceError):
            set_product_serialization_mode(prod, Product.SerializationMode.REQUIRED, actor=admin)

        # Regularizar 2 seriales reales sin crear stock adicional
        register_serials(
            warehouse=wh_c, product=prod, serial_numbers=["SN-1001", "SN-1002"], actor=wh_user
        )
        ws_c = WarehouseStock.objects.get(warehouse=wh_c, product=prod)
        assert ws_c.physical_quantity == 2

        # Duplicado bloqueado
        with pytest.raises(InventoryServiceError):
            register_serials(warehouse=wh_c, product=prod, serial_numbers=["SN-1001"], actor=wh_user)

        # Ahora sí permite pasar a REQUIRED
        set_product_serialization_mode(prod, Product.SerializationMode.REQUIRED, actor=admin)
        prod.refresh_from_db()
        assert prod.serialization_mode == Product.SerializationMode.REQUIRED

        # Transferir SN-1002 a Showroom (primero queda en tránsito, nunca en ambos)
        trf = create_and_dispatch_transfer(
            source_warehouse=wh_c,
            destination_warehouse=wh_s,
            items=[{"product_id": prod.id, "quantity": 1, "serial_numbers": ["SN-1002"]}],
            actor=wh_user,
        )
        sn2 = SerialNumberTrack.objects.get(serial_number="SN-1002", product=prod)
        assert sn2.status == SerialNumberTrack.Status.IN_TRANSIT
        assert sn2.warehouse is None

        receive_transfer(trf, actor=wh_user)
        sn2.refresh_from_db()
        assert sn2.status == SerialNumberTrack.Status.IN_STOCK
        assert sn2.warehouse_id == wh_s.id

        # Despacho de orden con producto REQUIRED: sin serial falla; con serial correcto vincula cliente
        order = Order.objects.create(user=admin, total=Decimal("900000"))
        reserve_stock_for_order(order, {prod.id: 1}, actor=admin)  # Toma de BOD-CENTRAL (prioridad 10)
        consolidate_order_reservations(order, actor=admin)

        with pytest.raises(InventoryServiceError):
            dispatch_order_reservations(order, serial_assignments={}, actor=wh_user)

        dispatch_order_reservations(
            order, serial_assignments={str(prod.id): ["SN-1001"]}, actor=wh_user
        )
        sn1 = SerialNumberTrack.objects.get(serial_number="SN-1001", product=prod)
        assert sn1.status == SerialNumberTrack.Status.DISPATCHED
        assert sn1.order_id == order.id
        assert sn1.customer_id == admin.id

        # RBAC API check: Sales recibe 403 en /api/v1/admin/inventory/stocks/, Warehouse 200
        c_sales = APIClient()
        c_sales.force_authenticate(user=sales_user)
        assert c_sales.get("/api/v1/admin/inventory/stocks/").status_code == 403

        c_wh = APIClient()
        c_wh.force_authenticate(user=wh_user)
        res_wh = c_wh.get("/api/v1/admin/inventory/stocks/")
        assert res_wh.status_code == 200

    def test_bundles_shared_component_prevents_overselling(self):
        admin, _, _, cat, brand, wh_c, _, _ = self._setup()
        mic = Product.objects.create(
            name="Mic Shared", slug=f"mic-sh-{uuid.uuid4().hex[:6]}",
            sku=f"SKU-{uuid.uuid4().hex[:6]}", price=Decimal("100000"), category=cat, brand=brand,
        )
        adjust_stock(warehouse=wh_c, product=mic, delta_physical=2, actor=admin)

        bundle = Product.objects.create(
            name="Kit Mic x2", slug=f"kit-{uuid.uuid4().hex[:6]}",
            sku=f"KIT-{uuid.uuid4().hex[:6]}", price=Decimal("190000"),
            product_type=Product.ProductType.BUNDLE, category=cat, brand=brand,
        )
        BundleItem.objects.create(bundle=bundle, component=mic, quantity=2)

        # Intentar comprar 1 mic suelto + 1 kit (demanda total = 3 > 2 disponibles) debe fallar
        with pytest.raises(InventoryError):
            with transaction.atomic():
                prepare_inventory([
                    {"product": str(mic.id), "quantity": 1},
                    {"product": str(bundle.id), "quantity": 1},
                ])
