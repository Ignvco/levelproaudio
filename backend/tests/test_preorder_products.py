# tests/test_preorder_products.py
#
# Antes, un producto "preorden" o "a pedido" con stock=0 (su estado
# normal/esperado — todavía no lo tenés físicamente) era imposible de
# comprar, porque la validación de stock aplicaba igual para todos los
# tipos de producto. Esto confirma que ahora sí se puede.

import pytest
from decimal import Decimal
from rest_framework.test import APIClient
from apps.users.models import User
from apps.products.models import Category, Product


def _product(product_type, stock=0, price="50000"):
    category = Category.objects.get_or_create(name="Mics", slug=f"mics-{product_type}")[0]
    return Product.objects.create(
        name="Micrófono en preventa", slug=f"mic-preventa-{product_type}",
        category=category, price=Decimal(price), stock=stock,
        product_type=product_type, is_active=True,
    )


@pytest.mark.django_db
def test_preorder_product_can_be_purchased_with_zero_stock():
    user = User.objects.create_user(email="preorder@test.com", username="preorder", password="x")
    product = _product("preorder", stock=0)

    client = APIClient()
    client.force_authenticate(user=user)

    resp = client.post("/api/v1/orders/", {
        "items": [{"product": str(product.id), "quantity": 1}],
        "shipping_address": "Test 123",
    }, format="json")

    assert resp.status_code == 201


@pytest.mark.django_db
def test_on_demand_product_can_be_purchased_with_zero_stock():
    user = User.objects.create_user(email="ondemand@test.com", username="ondemand", password="x")
    product = _product("on_demand", stock=0)

    client = APIClient()
    client.force_authenticate(user=user)

    resp = client.post("/api/v1/orders/", {
        "items": [{"product": str(product.id), "quantity": 1}],
        "shipping_address": "Test 123",
    }, format="json")

    assert resp.status_code == 201


@pytest.mark.django_db
def test_regular_stock_product_still_requires_stock():
    """Confirma que NO rompimos la validación normal para productos con stock real."""
    user = User.objects.create_user(email="stockcheck@test.com", username="stockcheck", password="x")
    product = _product("stock", stock=0)

    client = APIClient()
    client.force_authenticate(user=user)

    resp = client.post("/api/v1/orders/", {
        "items": [{"product": str(product.id), "quantity": 1}],
        "shipping_address": "Test 123",
    }, format="json")

    assert resp.status_code == 400


@pytest.mark.django_db
def test_add_to_cart_allows_preorder_with_zero_stock():
    user = User.objects.create_user(email="cartpre@test.com", username="cartpre", password="x")
    product = _product("preorder", stock=0)

    client = APIClient()
    client.force_authenticate(user=user)

    resp = client.post("/api/v1/cart/add_item/", {
        "product_id": str(product.id), "quantity": 2,
    }, format="json")

    assert resp.status_code == 200
