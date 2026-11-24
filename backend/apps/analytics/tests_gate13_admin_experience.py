# apps/analytics/tests_gate13_admin_experience.py
"""
LEVELPRO OS V4.0 — GATE 13: ADMIN EXPERIENCE TEST SUITE
- Command Palette / Global Search: /api/v1/admin/search/global/
  - Multi-entity matching (Products, Variants/SKUs, Serials, Orders, Customers)
  - Minimum query length guard (len >= 2)
  - Multi-currency integrity (CLP / USD / ARS preserved without conversion)
  - Zero cost leakage (no cost_clp, cost_usd, cost_price, average_unit_cost)
  - RBAC module filtering (Warehouse vs Sales vs Academy vs Super Admin)
- BF-32 Notification Center: /api/v1/admin/notifications/ & /api/v1/admin/notifications/read/
  - Verifiable operational alerts from real DB records
  - RBAC module filtering on notifications
  - Read / unread persistence per user via AdminNotificationReadState
  - Mark single notification read & mark_all read
"""

from decimal import Decimal
import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from core.rbac.constants import (
    ROLE_ACADEMY,
    ROLE_SALES,
    ROLE_WAREHOUSE,
)
from apps.analytics.models import AdminNotificationReadState
from apps.inventory.models import SerialNumberTrack, Warehouse
from apps.orders.logistics_models import Carrier, CarrierService, DeliveryIncident, Shipment
from apps.orders.models import Order, OrderStatus
from apps.products.models import Brand, Category, Product, ProductVariant
from apps.services.models import Service, ServiceRequest

User = get_user_model()


@pytest.fixture
def super_admin_user(db):
    return User.objects.create_user(
        username="gate13_super",
        email="gate13-super@levelproaudio.com",
        password="TestPassword123!",
        first_name="Super",
        last_name="Operator",
        is_staff=True,
        is_superuser=True,
    )


@pytest.fixture
def warehouse_user(db):
    user = User.objects.create_user(
        username="gate13_warehouse",
        email="gate13-warehouse@levelproaudio.com",
        password="TestPassword123!",
        first_name="Bodega",
        last_name="Operator",
        is_staff=True,
        is_superuser=False,
    )
    grp, _ = Group.objects.get_or_create(name=ROLE_WAREHOUSE)
    user.groups.add(grp)
    return user


@pytest.fixture
def academy_user(db):
    user = User.objects.create_user(
        username="gate13_academy",
        email="gate13-academy@levelproaudio.com",
        password="TestPassword123!",
        first_name="Academy",
        last_name="Coordinator",
        is_staff=True,
        is_superuser=False,
    )
    grp, _ = Group.objects.get_or_create(name=ROLE_ACADEMY)
    user.groups.add(grp)
    return user


@pytest.fixture
def sales_user(db):
    user = User.objects.create_user(
        username="gate13_sales",
        email="gate13-sales@levelproaudio.com",
        password="TestPassword123!",
        first_name="Sales",
        last_name="Executive",
        is_staff=True,
        is_superuser=False,
    )
    grp, _ = Group.objects.get_or_create(name=ROLE_SALES)
    user.groups.add(grp)
    return user


@pytest.fixture
def gate13_domain_data(db):
    brand = Brand.objects.create(name="Gate13 Acoustics", slug="gate13-acoustics")
    cat = Category.objects.create(name="Gate13 Interfaces", slug="gate13-interfaces")

    product = Product.objects.create(
        name="Apollo Twin X Gate13 Edition",
        slug="apollo-twin-x-gate13-edition",
        sku="G13-APOLLO-MASTER",
        brand=brand,
        category=cat,
        price=Decimal("1290000.00"),
        price_usd=Decimal("1350.00"),
        price_ars=Decimal("1420000.00"),
        cost_price=Decimal("820000.00"),
        stock=0,  # Triggers out-of-stock notification
        is_active=True,
    )

    variant = ProductVariant.objects.create(
        product=product,
        name="Heritage Duo Bundle",
        sku="G13-APOLLO-DUO-VAR",
        price=Decimal("1490000.00"),
        price_usd=Decimal("1560.00"),
        cost_price=Decimal("940000.00"),
        stock=2,
        is_active=True,
    )

    wh = Warehouse.objects.create(
        code="WH-G13",
        name="Bodega Central Gate13",
        is_default=False,
        is_active=True,
    )

    serial = SerialNumberTrack.objects.create(
        serial_number="SN-G13-998877",
        product=product,
        variant=variant,
        warehouse=wh,
    )

    customer = User.objects.create_user(
        username="gate13_customer",
        email="estudio.mastering.g13@cliente.cl",
        password="CustomerPassword123!",
        first_name="Estudio",
        last_name="MasteringG13",
    )

    order_clp = Order.objects.create(
        user=customer,
        email=customer.email,
        status=OrderStatus.PENDING,
        total=Decimal("1290000.00"),
        currency="CLP",
        shipping_address="Av. Providencia 1234, Santiago",
        tracking_number="TRK-G13-CLP01",
    )

    order_usd = Order.objects.create(
        user=customer,
        email="intl.buyer.g13@studio.com",
        status=OrderStatus.PAID,
        total=Decimal("1560.00"),
        currency="USD",
        shipping_address="Buenos Aires, Argentina",
        tracking_number="TRK-G13-USD02",
    )

    service = Service.objects.create(
        name="Calibración Acústica Gate13",
        slug="calibracion-acustica-gate13",
        description="Medición y ajuste de sala.",
        is_active=True,
    )
    service_req = ServiceRequest.objects.create(
        user=customer,
        service=service,
        name="Sala Mastering Sur",
        email="sala.sur.g13@audio.cl",
        status="pending",
    )

    carrier = Carrier.objects.create(
        code="G13-COURIER",
        name="Gate13 Express",
        country="CL",
    )
    carrier_srv = CarrierService.objects.create(
        carrier=carrier,
        service_code="G13-EXP-24",
        name="Express 24h",
    )
    shipment = Shipment.objects.create(
        shipment_number="SHP-G13-001",
        order=order_clp,
        warehouse=wh,
        carrier=carrier,
        carrier_service=carrier_srv,
        destination_address="Av. Providencia 1234, Santiago",
        tracking_number="TRK-SHP-G13-001",
    )
    incident = DeliveryIncident.objects.create(
        shipment=shipment,
        incident_type="address_issue",
        description="Dirección requiere confirmación de oficina en Providencia.",
    )

    return {
        "product": product,
        "variant": variant,
        "serial": serial,
        "customer": customer,
        "order_clp": order_clp,
        "order_usd": order_usd,
        "service_req": service_req,
        "incident": incident,
    }


@pytest.mark.django_db
class TestGate13CommandPaletteSearch:
    def test_min_length_guard_returns_empty_results(self, super_admin_user, gate13_domain_data):
        client = APIClient()
        client.force_authenticate(user=super_admin_user)

        res = client.get("/api/v1/admin/search/global/?q=a")
        assert res.status_code == 200
        body = res.json()
        assert body["min_length_met"] is False
        assert body["total_count"] == 0
        assert body["results"]["products"] == []

    def test_super_admin_searches_products_variants_serials_orders_customers(
        self, super_admin_user, gate13_domain_data
    ):
        client = APIClient()
        client.force_authenticate(user=super_admin_user)

        # 1. Search by SKU prefix G13-APOLLO -> hits Product and Variant
        res_sku = client.get("/api/v1/admin/search/global/?q=G13-APOLLO")
        assert res_sku.status_code == 200
        data_sku = res_sku.json()
        assert data_sku["min_length_met"] is True
        assert len(data_sku["results"]["products"]) == 1
        assert data_sku["results"]["products"][0]["sku"] == "G13-APOLLO-MASTER"
        assert len(data_sku["results"]["variants"]) == 1
        assert data_sku["results"]["variants"][0]["sku"] == "G13-APOLLO-DUO-VAR"

        # Verify ZERO cost leakage in payload
        raw_payload_str = str(data_sku)
        assert "cost_clp" not in raw_payload_str
        assert "cost_usd" not in raw_payload_str
        assert "cost_price" not in raw_payload_str
        assert "820000" not in raw_payload_str
        assert "940000" not in raw_payload_str

        # 2. Search by serial number SN-G13-998877
        res_sn = client.get("/api/v1/admin/search/global/?q=SN-G13-998877")
        assert res_sn.status_code == 200
        serials = res_sn.json()["results"]["serials"]
        assert len(serials) == 1
        assert serials[0]["serial_number"] == "SN-G13-998877"
        assert serials[0]["warehouse_code"] == "WH-G13"

        # 3. Search orders preserving original currency (CLP vs USD)
        res_ord = client.get("/api/v1/admin/search/global/?q=TRK-G13")
        assert res_ord.status_code == 200
        orders = res_ord.json()["results"]["orders"]
        assert len(orders) == 2
        by_cur = {o["currency"]: o for o in orders}
        assert by_cur["CLP"]["total"] == "1290000.00"
        assert by_cur["USD"]["total"] == "1560.00"

        # 4. Search customers by email / name
        res_cust = client.get("/api/v1/admin/search/global/?q=MasteringG13")
        assert res_cust.status_code == 200
        customers = res_cust.json()["results"]["customers"]
        assert len(customers) == 1
        assert customers[0]["email"] == "estudio.mastering.g13@cliente.cl"

    def test_rbac_filtering_restricts_unauthorized_modules(
        self, warehouse_user, academy_user, gate13_domain_data
    ):
        # Warehouse role has MODULE_INVENTORY & MODULE_LOGISTICS, NOT MODULE_ORDERS or MODULE_ROLES
        wh_client = APIClient()
        wh_client.force_authenticate(user=warehouse_user)

        res_wh = wh_client.get("/api/v1/admin/search/global/?q=G13")
        assert res_wh.status_code == 200
        body_wh = res_wh.json()
        assert "orders" not in body_wh["allowed_categories"]
        assert "customers" not in body_wh["allowed_categories"]
        assert body_wh["results"]["orders"] == []
        assert body_wh["results"]["customers"] == []
        # But Warehouse CAN search products, variants, and serials
        assert len(body_wh["results"]["products"]) >= 1
        assert len(body_wh["results"]["serials"]) == 1

        # Academy role has only MODULE_DASHBOARD & MODULE_ACADEMY -> zero access to catalog, orders, serials, customers
        ac_client = APIClient()
        ac_client.force_authenticate(user=academy_user)
        res_ac = ac_client.get("/api/v1/admin/search/global/?q=G13")
        assert res_ac.status_code == 200
        body_ac = res_ac.json()
        assert body_ac["allowed_categories"] == []
        assert body_ac["total_count"] == 0


@pytest.mark.django_db
class TestGate13NotificationCenter:
    def test_notifications_list_and_read_state_persistence(
        self, super_admin_user, gate13_domain_data
    ):
        client = APIClient()
        client.force_authenticate(user=super_admin_user)

        res = client.get("/api/v1/admin/notifications/")
        assert res.status_code == 200
        data = res.json()
        assert data["delivery_mode"] == "controlled_polling"
        assert data["polling_interval_seconds"] == 60
        assert data["total_count"] >= 4
        assert data["unread_count"] == data["total_count"]

        categories = {n["category"] for n in data["notifications"]}
        assert "orders" in categories
        assert "inventory" in categories
        assert "services" in categories
        assert "logistics" in categories

        # Mark first notification as read
        first_key = data["notifications"][0]["key"]
        res_mark = client.post(
            "/api/v1/admin/notifications/read/",
            {"key": first_key},
            format="json",
        )
        assert res_mark.status_code == 200
        mark_body = res_mark.json()
        assert first_key in mark_body["marked_keys"]
        assert mark_body["unread_count"] == data["total_count"] - 1
        assert AdminNotificationReadState.objects.filter(
            user=super_admin_user, notification_key=first_key
        ).exists()

        # Mark all remaining notifications as read
        res_all = client.post(
            "/api/v1/admin/notifications/read/",
            {"mark_all": True},
            format="json",
        )
        assert res_all.status_code == 200
        assert res_all.json()["unread_count"] == 0

        # Verify subsequent GET reflects is_read=True across all items
        res_after = client.get("/api/v1/admin/notifications/")
        assert res_after.status_code == 200
        assert res_after.json()["unread_count"] == 0
        assert all(n["is_read"] is True for n in res_after.json()["notifications"])

    def test_notifications_rbac_isolation(
        self, warehouse_user, academy_user, gate13_domain_data
    ):
        # Warehouse user sees inventory & logistics alerts, NOT orders or services
        wh_client = APIClient()
        wh_client.force_authenticate(user=warehouse_user)
        res_wh = wh_client.get("/api/v1/admin/notifications/")
        assert res_wh.status_code == 200
        wh_cats = {n["category"] for n in res_wh.json()["notifications"]}
        assert "inventory" in wh_cats
        assert "logistics" in wh_cats
        assert "orders" not in wh_cats
        assert "services" not in wh_cats

        # Academy user sees 0 operational alerts from catalog/orders/logistics/services
        ac_client = APIClient()
        ac_client.force_authenticate(user=academy_user)
        res_ac = ac_client.get("/api/v1/admin/notifications/")
        assert res_ac.status_code == 200
        assert res_ac.json()["total_count"] == 0
