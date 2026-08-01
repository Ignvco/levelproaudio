# tests/test_orders_price_integrity.py
#
# Regresión para el bug de manipulación de precios: el total de la orden
# SIEMPRE debe calcularse desde Product.price en la BD, nunca desde el
# valor "price" que manda el cliente en el body del POST.

import pytest
from decimal import Decimal
from rest_framework.test import APIClient
from apps.users.models import User
from apps.products.models import Category, Brand, Product


@pytest.mark.django_db
def test_order_ignores_client_supplied_price():
    user = User.objects.create_user(
        email="buyer@test.com", username="buyer", password="x"
    )
    category = Category.objects.create(name="Micrófonos", slug="microfonos")
    brand = Brand.objects.create(name="Shure", slug="shure")
    product = Product.objects.create(
        name="SM7B", slug="sm7b", category=category, brand=brand,
        price=Decimal("250000"), stock=5, is_active=True,
    )

    client = APIClient()
    client.force_authenticate(user=user)

    # El cliente intenta comprar a $1 en vez del precio real ($250.000)
    resp = client.post("/api/v1/orders/", {
        "items": [{"product": str(product.id), "quantity": 1, "price": 1}],
        "shipping_address": "Test 123",
    }, format="json")

    assert resp.status_code == 201
    assert Decimal(str(resp.data["total"])) == Decimal("250000")
