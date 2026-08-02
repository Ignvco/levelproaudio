# tests/test_products_catalog.py
#
# Cubre el catálogo público (no era testeado antes):
#   - Solo se listan productos activos
#   - El catálogo es de solo lectura (nadie puede crear/editar vía este endpoint)
#   - Favoritos exige autenticación e ignora productos de otros usuarios

import pytest
from decimal import Decimal
from rest_framework.test import APIClient
from apps.users.models import User
from apps.products.models import Category, Brand, Product, Favorite


def _make_product(name, slug, is_active=True, price="10000"):
    category = Category.objects.get_or_create(name="Micrófonos", slug="microfonos")[0]
    brand = Brand.objects.get_or_create(name="Shure", slug="shure")[0]
    return Product.objects.create(
        name=name, slug=slug, category=category, brand=brand,
        price=Decimal(price), stock=5, is_active=is_active,
    )


@pytest.mark.django_db
def test_catalog_hides_inactive_products():
    _make_product("SM7B", "sm7b", is_active=True)
    _make_product("Descontinuado", "descontinuado", is_active=False)

    client = APIClient()
    resp = client.get("/api/v1/products/")

    assert resp.status_code == 200
    slugs = [p["slug"] for p in resp.data["results"]]
    assert "sm7b" in slugs
    assert "descontinuado" not in slugs


@pytest.mark.django_db
def test_catalog_write_is_blocked():
    """El catálogo público es de solo lectura — crear productos NO es posible desde acá."""
    client = APIClient()
    resp = client.post("/api/v1/products/", {
        "name": "Producto pirata", "slug": "producto-pirata", "price": "1",
    }, format="json")
    assert resp.status_code == 405  # Method Not Allowed


@pytest.mark.django_db
def test_favorites_requires_authentication():
    client = APIClient()
    resp = client.get("/api/v1/favorites/")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_toggle_favorite_and_list_own_favorites():
    user = User.objects.create_user(email="user@test.com", username="user", password="x")
    product = _make_product("SM7B", "sm7b")

    client = APIClient()
    client.force_authenticate(user=user)

    resp = client.post("/api/v1/favorites/toggle/", {"product_id": str(product.id)}, format="json")
    assert resp.status_code == 200
    assert resp.data["favorited"] is True
    assert Favorite.objects.filter(user=user, product=product).exists()

    resp_list = client.get("/api/v1/favorites/")
    assert resp_list.status_code == 200
    assert resp_list.data["count"] == 1


@pytest.mark.django_db
def test_favorites_are_private_per_user():
    user_a = User.objects.create_user(email="a@test.com", username="a", password="x")
    user_b = User.objects.create_user(email="b@test.com", username="b", password="x")
    product = _make_product("SM7B", "sm7b")
    Favorite.objects.create(user=user_a, product=product)

    client = APIClient()
    client.force_authenticate(user=user_b)

    resp = client.get("/api/v1/favorites/")
    assert resp.status_code == 200
    assert resp.data["count"] == 0  # user_b no ve los favoritos de user_a
