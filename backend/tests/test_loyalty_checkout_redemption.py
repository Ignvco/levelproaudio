# tests/test_loyalty_checkout_redemption.py
#
# Regresión para el fix de deduplicación: antes, orders/views.py
# reimplementaba el canje de puntos a mano (sin bloqueo de fila). Ahora
# delega en LoyaltyAccount.canjear_puntos(), que sí bloquea. Este test
# confirma que el flujo real de checkout (POST /api/v1/orders/ con
# loyalty_points_redeemed) sigue funcionando de punta a punta con el
# nuevo camino de código.

import pytest
from decimal import Decimal
from rest_framework.test import APIClient
from apps.users.models import User
from apps.products.models import Category, Product
from apps.loyalty.models import LoyaltyAccount, LoyaltyTransaction


@pytest.mark.django_db
def test_checkout_redeems_points_via_centralized_method():
    user = User.objects.create_user(email="buyer@test.com", username="buyer", password="x")
    category = Category.objects.create(name="Mics", slug="mics-loyalty")
    product = Product.objects.create(
        name="SM7B", slug="sm7b-checkout-loyalty", category=category,
        price=Decimal("50000"), stock=5, is_active=True,
    )
    account = LoyaltyAccount.objects.create(user=user, puntos_totales=1000)

    client = APIClient()
    client.force_authenticate(user=user)

    resp = client.post("/api/v1/orders/", {
        "items": [{"product": str(product.id), "quantity": 1}],
        "shipping_address": "Test 123",
        "loyalty_points_redeemed": 500,
    }, format="json")

    assert resp.status_code == 201
    account.refresh_from_db()
    assert account.puntos_canjeados == 500
    assert account.puntos_disponibles == 500

    # La transacción de canje debe quedar atada a la orden real.
    tx = LoyaltyTransaction.objects.get(account=account, tipo="redeem")
    assert str(tx.orden_id) == resp.data["id"]
    assert tx.puntos == -500


@pytest.mark.django_db
def test_checkout_rejects_redemption_above_balance():
    user = User.objects.create_user(email="buyer2@test.com", username="buyer2", password="x")
    category = Category.objects.create(name="Mics", slug="mics-loyalty-2")
    product = Product.objects.create(
        name="SM7B", slug="sm7b-checkout-loyalty-2", category=category,
        price=Decimal("50000"), stock=5, is_active=True,
    )
    LoyaltyAccount.objects.create(user=user, puntos_totales=100)  # menos que el mínimo/canje pedido

    client = APIClient()
    client.force_authenticate(user=user)

    resp = client.post("/api/v1/orders/", {
        "items": [{"product": str(product.id), "quantity": 1}],
        "shipping_address": "Test 123",
        "loyalty_points_redeemed": 5000,
    }, format="json")

    assert resp.status_code == 400
    # No debe haberse creado ninguna orden ni movimiento de puntos.
    assert not LoyaltyTransaction.objects.filter(tipo="redeem").exists()
