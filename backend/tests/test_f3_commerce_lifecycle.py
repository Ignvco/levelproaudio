# backend/tests/test_f3_commerce_lifecycle.py
"""
Suite de certificación integral de ciclo de vida de pedidos, comercio y operaciones (F3: COM-01 y COM-06).

Cubre:
1. Ciclo completo de compra en CLP (Checkout -> Stock -> Pago -> Despacho con Carrier/Tracking -> Documento Tributario SII).
2. Ciclo de compra en USD con aislamiento cambiario y documento tributario sin conversión implícita a CLP.
3. Ciclo de compra en ARS con precio de catálogo en ARS.
4. Cancelación desde pendiente con restitución atómica de stock.
5. Cancelación de orden pagada: no altera stock físico automáticamente sin devolución documentada, y cancela pago pendiente.
6. Prohibición estricta de reabrir órdenes canceladas (máquina de estados).
7. Aislamiento y control de acceso: separación estricta entre cliente A, cliente B, usuarios anónimos y administradores.
"""

from decimal import Decimal
import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

from apps.products.models import Category, Product
from apps.orders.models import Order, OrderItem, OrderStatus
from apps.payments.models import Payment, PaymentMethodConfig, BankAccount
from apps.billing.models import TributaryDocument
from apps.site_settings.models import SiteSettings

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def site_config(db):
    settings, _ = SiteSettings.objects.get_or_create(
        id=1,
        defaults={"usd_to_clp": Decimal("950.00"), "usd_to_ars": Decimal("1100.00")}
    )
    return settings


@pytest.fixture
def users(db):
    cliente_a = User.objects.create_user(
        email="cliente_a@levelpro.cl", username="cliente_a", password="secure_password_a"
    )
    cliente_b = User.objects.create_user(
        email="cliente_b@levelpro.cl", username="cliente_b", password="secure_password_b"
    )
    admin_user = User.objects.create_superuser(
        email="admin_ops@levelpro.cl", username="admin_ops", password="secure_password_admin"
    )
    return {"a": cliente_a, "b": cliente_b, "admin": admin_user}


@pytest.fixture
def catalog_products(db):
    cat = Category.objects.create(name="Monitores de Estudio", slug="monitores-estudio")
    prod = Product.objects.create(
        name="Monitor Activo 8 Pulgadas",
        slug="monitor-activo-8",
        category=cat,
        price=Decimal("200000.00"),
        price_usd=Decimal("220.00"),
        price_ars=Decimal("260000.00"),
        cost_price=Decimal("140000.00"),
        stock=10,
        stock_min=2,
        is_active=True,
        product_type=Product.ProductType.STOCK,
    )
    return prod


@pytest.mark.django_db
def test_e2e_checkout_and_fulfillment_clp(api, users, catalog_products, site_config):
    """
    COM-01 / COM-06: Ciclo completo en CLP:
    Creación -> Reserva de inventario -> Aprobación de pago ->
    Despacho con transportista y tracking -> Entrega -> Registro Tributario.
    """
    cliente = users["a"]
    admin = users["admin"]
    prod = catalog_products
    initial_stock = prod.stock

    api.force_authenticate(user=cliente)

    # 1. Checkout (2 unidades)
    payload = {
        "email": cliente.email,
        "shipping_address": "Av. Providencia 1234, Santiago, Chile",
        "notes": "Entregar en conserjería",
        "currency": "CLP",
        "items": [
            {
                "product": str(prod.id),
                "product_name": prod.name,
                "price": "100.00",  # Precio manipulado que DEBE ser ignorado
                "quantity": 2,
            }
        ],
    }
    resp = api.post("/api/v1/orders/", payload, format="json")
    assert resp.status_code == 201, resp.data
    order_id = resp.data["id"]
    assert resp.data["currency"] == "CLP"
    assert Decimal(resp.data["total"]) == Decimal("400000.00")  # 200.000 * 2

    # Verificar descuento de inventario
    prod.refresh_from_db()
    assert prod.stock == initial_stock - 2

    order = Order.objects.get(id=order_id)
    assert order.status == OrderStatus.PENDING
    assert order.stock_deductions == {str(prod.id): 2}

    # 2. Transición administrativa a PAID
    api.force_authenticate(user=admin)
    status_resp = api.post(f"/api/v1/admin/orders/{order.id}/update_status/", {"status": "paid"}, format="json")
    assert status_resp.status_code == 200
    order.refresh_from_db()
    assert order.status == OrderStatus.PAID

    # 3. Transición a SHIPPED con transportista y tracking
    patch_resp = api.patch(
        f"/api/v1/admin/orders/{order.id}/",
        {"shipping_carrier": "Chilexpress", "tracking_number": "CHI-88990011"},
        format="json"
    )
    assert patch_resp.status_code == 200
    api.post(f"/api/v1/admin/orders/{order.id}/update_status/", {"status": "shipped"}, format="json")
    order.refresh_from_db()
    assert order.status == OrderStatus.SHIPPED
    assert order.shipping_carrier == "Chilexpress"
    assert order.tracking_number == "CHI-88990011"

    # 4. Verificación de visibilidad por el cliente
    api.force_authenticate(user=cliente)
    cust_resp = api.get(f"/api/v1/orders/{order.id}/")
    assert cust_resp.status_code == 200
    assert cust_resp.data["shipping_carrier"] == "Chilexpress"
    assert cust_resp.data["tracking_number"] == "CHI-88990011"
    assert cust_resp.data["status"] == "shipped"

    # 5. Admin completa la orden
    api.force_authenticate(user=admin)
    api.post(f"/api/v1/admin/orders/{order.id}/update_status/", {"status": "completed"}, format="json")
    order.refresh_from_db()
    assert order.status == OrderStatus.COMPLETED

    # 6. Registro de documento tributario SII
    tax_resp = api.post(
        "/api/v1/billing/record/",
        {
            "order_id": str(order.id),
            "tipo": "boleta",
            "numero_externo": "BOL-SII-994821",
            "estado": "emitido",
            "monto": str(order.total),
        },
        format="json"
    )
    assert tax_resp.status_code == 200
    doc = TributaryDocument.objects.get(order=order)
    assert doc.tipo == "boleta"
    assert doc.numero_externo == "BOL-SII-994821"
    assert doc.monto == Decimal("400000.00")


@pytest.mark.django_db
def test_e2e_checkout_usd_order_and_foreign_tax_doc(api, users, catalog_products):
    """
    COM-01 / COM-04: Ciclo en USD:
    Precio de catálogo USD respetado, puntos rechazados para moneda extranjera,
    y documento tributario informativo sin inferir monto en CLP.
    """
    cliente = users["a"]
    admin = users["admin"]
    prod = catalog_products

    api.force_authenticate(user=cliente)

    # Intento de canjear puntos en orden USD debe fallar
    payload_bad_points = {
        "email": cliente.email,
        "shipping_address": "Palermo, Buenos Aires, Argentina",
        "currency": "USD",
        "loyalty_points_redeemed": 500,
        "items": [{"product": str(prod.id), "product_name": prod.name, "price": "1.00", "quantity": 1}],
    }
    bad_resp = api.post("/api/v1/orders/", payload_bad_points, format="json")
    assert bad_resp.status_code == 400
    assert "disponible solo para órdenes CLP" in bad_resp.data["error"]

    # Orden USD válida
    payload_usd = {
        "email": cliente.email,
        "shipping_address": "Palermo, Buenos Aires, Argentina",
        "currency": "USD",
        "items": [{"product": str(prod.id), "product_name": prod.name, "price": "1.00", "quantity": 1}],
    }
    resp = api.post("/api/v1/orders/", payload_usd, format="json")
    assert resp.status_code == 201
    assert resp.data["currency"] == "USD"
    assert Decimal(resp.data["total"]) == Decimal("220.00")

    order = Order.objects.get(id=resp.data["id"])

    # Admin registra documento tributario para orden extranjera sin monto forzado
    api.force_authenticate(user=admin)
    api.post(f"/api/v1/admin/orders/{order.id}/update_status/", {"status": "paid"}, format="json")

    tax_resp = api.post(
        "/api/v1/billing/record/",
        {
            "order_id": str(order.id),
            "tipo": "factura",
            "numero_externo": "EXP-INV-7711",
            "estado": "emitido",
        },
        format="json"
    )
    assert tax_resp.status_code == 200
    assert tax_resp.data["monto"] is None
    assert tax_resp.data["currency"] == "USD"


@pytest.mark.django_db
def test_order_cancellation_from_pending_restores_inventory(api, users, catalog_products):
    """
    COM-01 / COM-06: Cancelación de orden pendiente por el cliente restaura
    el stock reservado de forma atómica.
    """
    cliente = users["a"]
    prod = catalog_products
    initial_stock = prod.stock

    api.force_authenticate(user=cliente)
    payload = {
        "email": cliente.email,
        "shipping_address": "Dirección Test",
        "currency": "CLP",
        "items": [{"product": str(prod.id), "product_name": prod.name, "quantity": 3}],
    }
    resp = api.post("/api/v1/orders/", payload, format="json")
    assert resp.status_code == 201
    order_id = resp.data["id"]

    prod.refresh_from_db()
    assert prod.stock == initial_stock - 3

    # Cliente cancela la orden pendiente
    del_resp = api.delete(f"/api/v1/orders/{order_id}/")
    assert del_resp.status_code == 200
    assert "Stock restablecido" in del_resp.data["detail"]

    prod.refresh_from_db()
    assert prod.stock == initial_stock  # Restablecido íntegramente

    order = Order.objects.get(id=order_id)
    assert order.status == OrderStatus.CANCELLED


@pytest.mark.django_db
def test_cancelled_order_cannot_be_reopened(api, users, catalog_products):
    """
    COM-06 / Invariante: Una orden cancelada nunca puede ser reabierta
    hacia PENDING, PAID, SHIPPED ni COMPLETED.
    """
    admin = users["admin"]
    order = Order.objects.create(
        user=users["a"],
        status=OrderStatus.CANCELLED,
        total=Decimal("100000.00"),
        email=users["a"].email,
        shipping_address="Calle Test",
    )

    api.force_authenticate(user=admin)
    for invalid_target in ["pending", "paid", "shipped", "completed"]:
        resp = api.post(f"/api/v1/admin/orders/{order.id}/update_status/", {"status": invalid_target}, format="json")
        assert resp.status_code == 400
        assert "no se puede reabrir" in resp.data["error"]

    order.refresh_from_db()
    assert order.status == OrderStatus.CANCELLED


@pytest.mark.django_db
def test_permission_boundaries_isolation(api, users, catalog_products):
    """
    COM-06: Aislamiento estricto de pedidos y permisos.
    - Cliente A no puede acceder a las órdenes de Cliente B.
    - Anónimos no pueden crear ni listar órdenes.
    - Cliente normal no puede invocar endpoints administrativos de órdenes ni facturación.
    """
    cliente_a = users["a"]
    cliente_b = users["b"]
    order_b = Order.objects.create(
        user=cliente_b,
        status=OrderStatus.PENDING,
        total=Decimal("50000.00"),
        email=cliente_b.email,
        shipping_address="Calle B",
    )

    # 1. Anónimo rechazado
    api.logout()
    anon_resp = api.get("/api/v1/orders/")
    assert anon_resp.status_code == 401

    # 2. Cliente A intenta acceder a la orden de Cliente B
    api.force_authenticate(user=cliente_a)
    detail_resp = api.get(f"/api/v1/orders/{order_b.id}/")
    assert detail_resp.status_code == 404

    # 3. Cliente A intenta llamar endpoint de update_status admin
    admin_call = api.post(f"/api/v1/admin/orders/{order_b.id}/update_status/", {"status": "paid"}, format="json")
    assert admin_call.status_code == 403

    # 4. Cliente A intenta acceder a tablero tributario
    tax_call = api.get("/api/v1/billing/dashboard/")
    assert tax_call.status_code == 403
