# apps/users/tests_rbac.py
"""
Suite exhaustiva de pruebas unitarias y de integración para el Core de Seguridad RBAC
y protección de datos sensibles en LEVELPRO OS V4.0.
"""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from rest_framework.test import APIClient

from core.rbac.constants import (
    ROLE_SUPER_ADMIN,
    ROLE_SALES,
    ROLE_WAREHOUSE,
    ROLE_FINANCE,
    MODULE_CATALOG,
    MODULE_ORDERS,
    MODULE_FINANCES,
    PERM_VIEW_COSTS,
    PERM_EDIT_COSTS,
    PERM_VIEW_FINANCES,
)
from apps.products.models import Product, Category, Brand

User = get_user_model()


@pytest.fixture(autouse=True)
def setup_rbac_environment(db):
    """Ejecuta setup_rbac para asegurar roles y permisos en la base de pruebas."""
    call_command("setup_rbac")


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def super_admin_user(db):
    user = User.objects.create_superuser(
        username="superadmin@levelpro.cl",
        email="superadmin@levelpro.cl",
        password="SuperPassword123!",
    )
    group = Group.objects.get(name=ROLE_SUPER_ADMIN)
    user.groups.add(group)
    return user


@pytest.fixture
def regular_customer(db):
    return User.objects.create_user(
        username="customer@levelpro.cl",
        email="customer@levelpro.cl",
        password="CustomerPassword123!",
        is_staff=False,
    )


@pytest.fixture
def sales_staff_user(db):
    user = User.objects.create_user(
        username="ventas@levelpro.cl",
        email="ventas@levelpro.cl",
        password="SalesPassword123!",
        is_staff=True,
    )
    group = Group.objects.get(name=ROLE_SALES)
    user.groups.add(group)
    return user


@pytest.fixture
def warehouse_staff_user(db):
    user = User.objects.create_user(
        username="bodega@levelpro.cl",
        email="bodega@levelpro.cl",
        password="WarehousePassword123!",
        is_staff=True,
    )
    group = Group.objects.get(name=ROLE_WAREHOUSE)
    user.groups.add(group)
    return user


@pytest.fixture
def finance_staff_user(db):
    user = User.objects.create_user(
        username="finanzas@levelpro.cl",
        email="finanzas@levelpro.cl",
        password="FinancePassword123!",
        is_staff=True,
    )
    group = Group.objects.get(name=ROLE_FINANCE)
    user.groups.add(group)
    return user


@pytest.fixture
def test_product(db):
    cat = Category.objects.create(name="Audio Pro", slug="audio-pro")
    brand = Brand.objects.create(name="Shure", slug="shure")
    return Product.objects.create(
        name="Micrófono Shure SM7B",
        slug="shure-sm7b",
        sku="SHU-SM7B",
        category=cat,
        brand=brand,
        price=399990,
        cost_price=220000,
        stock=15,
        stock_min=3,
        is_active=True,
    )


@pytest.mark.django_db
class TestRBACAuthenticationAndPermissions:
    """Verificación de acceso base y denegación por defecto."""

    def test_anonymous_user_cannot_access_me_permissions(self, api_client):
        response = api_client.get("/api/v1/auth/me/permissions/")
        assert response.status_code == 401

    def test_regular_customer_sees_empty_roles_and_no_admin_access(self, api_client, regular_customer):
        api_client.force_authenticate(user=regular_customer)
        response = api_client.get("/api/v1/auth/me/permissions/")
        assert response.status_code == 200
        data = response.json()
        assert data["is_staff"] is False
        assert data["is_superuser"] is False
        assert data["roles"] == []
        assert data["modules"] == []

        # Intento de acceso a endpoints de administración
        res_roles = api_client.get("/api/v1/admin/roles/")
        assert res_roles.status_code == 403

        res_products = api_client.get("/api/v1/admin/products/")
        assert res_products.status_code == 403


@pytest.mark.django_db
class TestSalesRoleIsolationAndSensitiveFieldMasking:
    """Pruebas de aislamiento estricto para el rol Ventas."""

    def test_sales_effective_permissions(self, api_client, sales_staff_user):
        api_client.force_authenticate(user=sales_staff_user)
        response = api_client.get("/api/v1/auth/me/permissions/")
        assert response.status_code == 200
        data = response.json()
        assert ROLE_SALES in data["roles"]
        assert MODULE_CATALOG in data["modules"]
        assert MODULE_ORDERS in data["modules"]
        assert MODULE_FINANCES not in data["modules"]
        assert data["capabilities"][PERM_VIEW_COSTS] is False

    def test_sales_can_read_catalog_but_cost_price_is_masked(self, api_client, sales_staff_user, test_product):
        api_client.force_authenticate(user=sales_staff_user)
        response = api_client.get(f"/api/v1/admin/products/{test_product.id}/")
        assert response.status_code == 200
        product_data = response.json()
        assert product_data["name"] == test_product.name
        # Campo sensible de costo debe ser completamente removido
        assert "cost_price" not in product_data

    def test_sales_cannot_write_cost_price(self, api_client, sales_staff_user, test_product):
        api_client.force_authenticate(user=sales_staff_user)
        response = api_client.patch(
            f"/api/v1/admin/products/{test_product.id}/",
            {"cost_price": 150000},
            format="json",
        )
        assert response.status_code in (400, 403)
        # Verificar que el costo real no fue alterado en base de datos
        test_product.refresh_from_db()
        assert float(test_product.cost_price) == 220000.0

    def test_sales_cannot_access_finance_endpoints(self, api_client, sales_staff_user):
        api_client.force_authenticate(user=sales_staff_user)
        response = api_client.get("/api/v1/admin/finance/summary/?currency=CLP")
        assert response.status_code == 403

        res_cats = api_client.get("/api/v1/admin/finance/categories/")
        assert res_cats.status_code == 403


@pytest.mark.django_db
class TestFinanceAndSuperAdminPrivileges:
    """Pruebas de visibilidad financiera y privilegios de Super Admin."""

    def test_finance_can_access_finance_and_see_costs(self, api_client, finance_staff_user, test_product):
        api_client.force_authenticate(user=finance_staff_user)
        res_summary = api_client.get("/api/v1/admin/finance/summary/?currency=CLP")
        assert res_summary.status_code == 200

        res_product = api_client.get(f"/api/v1/admin/products/{test_product.id}/")
        assert res_product.status_code == 200
        product_data = res_product.json()
        # Finanzas posee PERM_VIEW_COSTS
        assert "cost_price" in product_data
        assert float(product_data["cost_price"]) == 220000.0

    def test_super_admin_has_full_bypass_and_write_costs(self, api_client, super_admin_user, test_product):
        api_client.force_authenticate(user=super_admin_user)
        res_product = api_client.get(f"/api/v1/admin/products/{test_product.id}/")
        assert res_product.status_code == 200
        assert "cost_price" in res_product.json()

        # Modificación de costo por Super Admin permitida
        patch_res = api_client.patch(
            f"/api/v1/admin/products/{test_product.id}/",
            {"cost_price": 210000},
            format="json",
        )
        assert patch_res.status_code == 200
        test_product.refresh_from_db()
        assert float(test_product.cost_price) == 210000.0


@pytest.mark.django_db
class TestAntiEscalationAndRoleManagement:
    """Pruebas de seguridad contra escalada de privilegios y protección de superusuarios."""

    def test_non_superuser_cannot_assign_super_admin(self, api_client, sales_staff_user, regular_customer):
        api_client.force_authenticate(user=sales_staff_user)
        response = api_client.post(
            f"/api/v1/admin/users/{regular_customer.id}/roles/",
            {"role": ROLE_SUPER_ADMIN, "action": "assign"},
            format="json",
        )
        assert response.status_code == 403

    def test_super_admin_can_assign_and_revoke_roles(self, api_client, super_admin_user, regular_customer):
        api_client.force_authenticate(user=super_admin_user)

        # Asignar rol Bodega
        res_assign = api_client.post(
            f"/api/v1/admin/users/{regular_customer.id}/roles/",
            {"role": ROLE_WAREHOUSE, "action": "assign"},
            format="json",
        )
        assert res_assign.status_code == 200
        assert ROLE_WAREHOUSE in res_assign.json()["roles"]

        # Revocar rol Bodega
        res_revoke = api_client.post(
            f"/api/v1/admin/users/{regular_customer.id}/roles/",
            {"role": ROLE_WAREHOUSE, "action": "remove"},
            format="json",
        )
        assert res_revoke.status_code == 200
        assert ROLE_WAREHOUSE not in res_revoke.json()["roles"]

    def test_cannot_revoke_super_admin_from_last_active_superuser(self, api_client, super_admin_user):
        api_client.force_authenticate(user=super_admin_user)
        response = api_client.post(
            f"/api/v1/admin/users/{super_admin_user.id}/roles/",
            {"role": ROLE_SUPER_ADMIN, "action": "remove"},
            format="json",
        )
        assert response.status_code in (400, 403)
        assert super_admin_user.groups.filter(name=ROLE_SUPER_ADMIN).exists()

    def test_permissions_catalog_endpoint(self, api_client, super_admin_user):
        api_client.force_authenticate(user=super_admin_user)
        response = api_client.get("/api/v1/admin/permissions/catalog/")
        assert response.status_code == 200
        data = response.json()
        assert len(data["modules"]) == 12
        assert len(data["capabilities"]) == 11
        assert len(data["role_matrix"]) == 10
