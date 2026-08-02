# tests/test_payments_create.py
#
# Cubre /api/v1/payments/create/ (no era testeado antes):
#   - Requiere autenticación
#   - Solo el dueño de la orden puede pagarla (IDOR)
#   - No se puede pagar una orden que ya fue procesada
#   - Proveedor inválido se rechaza
#   - Con proveedor válido, delega en el servicio de MercadoPago (mockeado —
#     nunca le pegamos a la API real de MP en tests)

import pytest
from decimal import Decimal
from unittest.mock import patch
from rest_framework.test import APIClient
from apps.users.models import User
from apps.orders.models import Order, OrderStatus


def _make_order(user, status=OrderStatus.PENDING, total="50000"):
    return Order.objects.create(
        user=user, status=status, total=Decimal(total),
        email=user.email, shipping_address="Test 123",
    )


@pytest.mark.django_db
def test_create_payment_requires_authentication():
    client = APIClient()
    resp = client.post("/api/v1/payments/create/", {
        "order_id": "00000000-0000-0000-0000-000000000000", "provider": "mercadopago_cl",
    }, format="json")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_create_payment_rejects_order_of_another_user():
    owner = User.objects.create_user(email="owner@test.com", username="owner", password="x")
    attacker = User.objects.create_user(email="attacker@test.com", username="attacker", password="x")
    order = _make_order(owner)

    client = APIClient()
    client.force_authenticate(user=attacker)

    resp = client.post("/api/v1/payments/create/", {
        "order_id": str(order.id), "provider": "mercadopago_cl",
    }, format="json")

    assert resp.status_code == 404  # no debe filtrar que la orden existe


@pytest.mark.django_db
def test_create_payment_rejects_already_processed_order():
    user = User.objects.create_user(email="user@test.com", username="user", password="x")
    order = _make_order(user, status=OrderStatus.PAID)

    client = APIClient()
    client.force_authenticate(user=user)

    resp = client.post("/api/v1/payments/create/", {
        "order_id": str(order.id), "provider": "mercadopago_cl",
    }, format="json")

    assert resp.status_code == 400


@pytest.mark.django_db
def test_create_payment_rejects_invalid_provider():
    user = User.objects.create_user(email="user@test.com", username="user", password="x")
    order = _make_order(user)

    client = APIClient()
    client.force_authenticate(user=user)

    resp = client.post("/api/v1/payments/create/", {
        "order_id": str(order.id), "provider": "bitcoin",
    }, format="json")

    assert resp.status_code == 400


@pytest.mark.django_db
@patch("apps.payments.views.create_mercadopago_preference")
def test_create_payment_success_delegates_to_mercadopago_service(mock_create_pref):
    user = User.objects.create_user(email="user@test.com", username="user", password="x")
    order = _make_order(user, total="50000")
    mock_create_pref.return_value = {"init_point": "https://mp.example.com/checkout/123"}

    client = APIClient()
    client.force_authenticate(user=user)

    resp = client.post("/api/v1/payments/create/", {
        "order_id": str(order.id), "provider": "mercadopago_cl",
    }, format="json")

    assert resp.status_code == 200
    assert resp.data["init_point"] == "https://mp.example.com/checkout/123"
    # Confirma que se le pasó la orden real (con el total server-side), no datos del cliente.
    mock_create_pref.assert_called_once()
    called_order = mock_create_pref.call_args[0][0]
    assert called_order.id == order.id
    assert called_order.total == Decimal("50000")
