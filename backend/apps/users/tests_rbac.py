# apps/users/tests_rbac.py
"""
Suite exhaustiva de pruebas unitarias, de integración y de seguridad (PATCH 1.1.1)
para el Core RBAC Granular, Denegación por Defecto, Ciclo de Vida de Roles y
Protección de Datos Sensibles en LEVELPRO OS V4.0.
"""

from decimal import Decimal
import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core.management import call_command
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.test import APIClient, APIRequestFactory

from core.admin_permissions import IsAdminOrStaff
from core.rbac.constants import (
    ROLE_SUPER_ADMIN,
    ROLE_MANAGEMENT,
    ROLE_SALES,
    ROLE_PURCHASING,
    ROLE_WAREHOUSE,
    ROLE_FINANCE,
    ROLE_LOGISTICS,
    ROLE_SUPPORT,
    ROLE_MARKETING,
    ROLE_ACADEMY,
    MODULE_DASHBOARD,
    MODULE_CATALOG,
    MODULE_ORDERS,
    MODULE_INVENTORY,
    MODULE_FINANCES,
    MODULE_ROLES,
    PERM_VIEW_COSTS,
    PERM_EDIT_COSTS,
    PERM_VIEW_MARGINS,
    PERM_EDIT_PRICES,
    PERM_ADJUST_INVENTORY,
    PERM_APPROVE_PAYMENTS,
    PERM_VIEW_FINANCES,
    PERM_MANAGE_FINANCES,
    PERM_EXPORT_DATA,
    PERM_MANAGE_ROLES,
    PERM_MANAGE_SETTINGS,
)
from core.rbac.permissions import RBACPermission
from apps.products.models import Product, Category, Brand
from apps.orders.models import Order, OrderItem, B2BQuote
from apps.payments.models import Payment

User = get_user_model()


@pytest.fixture(autouse=True)
def setup_rbac_environment(db):
    """Ejecuta setup_rbac con reset_defaults para asegurar la matriz limpia al inicio de cada prueba."""
    call_command("setup_rbac", reset_defaults=True)


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
def management_user(db):
    user = User.objects.create_user(
        username="gerencia@levelpro.cl",
        email="gerencia@levelpro.cl",
        password="MgmtPassword123!",
        is_staff=True,
    )
    user.groups.add(Group.objects.get(name=ROLE_MANAGEMENT))
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
def legacy_staff_without_role(db):
    """Usuario legacy con is_staff=True pero sin ningún rol RBAC asignado."""
    return User.objects.create_user(
        username="legacystaff@levelpro.cl",
        email="legacystaff@levelpro.cl",
        password="LegacyPassword123!",
        is_staff=True,
    )


@pytest.fixture
def sales_staff_user(db):
    user = User.objects.create_user(
        username="ventas@levelpro.cl",
        email="ventas@levelpro.cl",
        password="SalesPassword123!",
        is_staff=True,
    )
    user.groups.add(Group.objects.get(name=ROLE_SALES))
    return user


@pytest.fixture
def warehouse_staff_user(db):
    user = User.objects.create_user(
        username="bodega@levelpro.cl",
        email="bodega@levelpro.cl",
        password="WarehousePassword123!",
        is_staff=True,
    )
    user.groups.add(Group.objects.get(name=ROLE_WAREHOUSE))
    return user


@pytest.fixture
def finance_staff_user(db):
    user = User.objects.create_user(
        username="finanzas@levelpro.cl",
        email="finanzas@levelpro.cl",
        password="FinancePassword123!",
        is_staff=True,
    )
    user.groups.add(Group.objects.get(name=ROLE_FINANCE))
    return user


@pytest.fixture
def logistics_staff_user(db):
    user = User.objects.create_user(
        username="logistica@levelpro.cl",
        email="logistica@levelpro.cl",
        password="LogisticsPassword123!",
        is_staff=True,
    )
    user.groups.add(Group.objects.get(name=ROLE_LOGISTICS))
    return user


@pytest.fixture
def support_staff_user(db):
    user = User.objects.create_user(
        username="soporte@levelpro.cl",
        email="soporte@levelpro.cl",
        password="SupportPassword123!",
        is_staff=True,
    )
    user.groups.add(Group.objects.get(name=ROLE_SUPPORT))
    return user


@pytest.fixture
def marketing_staff_user(db):
    user = User.objects.create_user(
        username="marketing@levelpro.cl",
        email="marketing@levelpro.cl",
        password="MarketingPassword123!",
        is_staff=True,
    )
    user.groups.add(Group.objects.get(name=ROLE_MARKETING))
    return user


@pytest.fixture
def academy_staff_user(db):
    user = User.objects.create_user(
        username="academia@levelpro.cl",
        email="academia@levelpro.cl",
        password="AcademyPassword123!",
        is_staff=True,
    )
    user.groups.add(Group.objects.get(name=ROLE_ACADEMY))
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
        stock_min=20,  # stock <= stock_min triggers alert in inventory_alerts
        is_active=True,
    )


@pytest.mark.django_db
class TestDenyByDefaultAndLegacyHardening:
    """
    PATCH 1.1.1 — Bloque 1:
    Verifica denegación por defecto en recursos no clasificados, bloqueo de
    is_staff sin rol, bloqueo de usuario inactivo y revocación en sesión abierta.
    """

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
        assert api_client.get("/api/v1/admin/roles/").status_code == 403
        assert api_client.get("/api/v1/admin/products/").status_code == 403

    def test_sales_effective_permissions_and_finance_isolation(
        self, api_client, sales_staff_user, finance_staff_user, super_admin_user, regular_customer, test_product
    ):
        """Preserva las verificaciones originales de Gate 1.1: permisos efectivos de Ventas, Finanzas y Super Admin."""
        # 1. Ventas: ve catálogo y órdenes, no finanzas ni costos
        api_client.force_authenticate(user=sales_staff_user)
        me_res = api_client.get("/api/v1/auth/me/permissions/")
        assert me_res.status_code == 200
        me_data = me_res.json()
        assert ROLE_SALES in me_data["roles"]
        assert MODULE_CATALOG in me_data["modules"]
        assert MODULE_ORDERS in me_data["modules"]
        assert MODULE_FINANCES not in me_data["modules"]
        assert me_data["capabilities"][PERM_VIEW_COSTS] is False
        assert api_client.get("/api/v1/admin/finance/summary/?currency=CLP").status_code == 403
        assert api_client.get("/api/v1/admin/finance/categories/").status_code == 403

        # 2. Finanzas: accede a finanzas y visualiza cost_price
        api_client.force_authenticate(user=finance_staff_user)
        assert api_client.get("/api/v1/admin/finance/summary/?currency=CLP").status_code == 200
        prod_fin = api_client.get(f"/api/v1/admin/products/{test_product.id}/").json()
        assert float(prod_fin["cost_price"]) == 220000.0

        # 3. Ventas no puede auto-asignarse ni asignar Super Admin
        api_client.force_authenticate(user=sales_staff_user)
        esc_res = api_client.post(
            f"/api/v1/admin/users/{regular_customer.id}/roles/",
            {"role": ROLE_SUPER_ADMIN, "action": "assign"},
            format="json",
        )
        assert esc_res.status_code == 403

        # 4. Super Admin tiene bypass total y puede editar cost_price
        api_client.force_authenticate(user=super_admin_user)
        patch_su = api_client.patch(
            f"/api/v1/admin/products/{test_product.id}/",
            {"cost_price": 210000},
            format="json",
        )
        assert patch_su.status_code == 200
        test_product.refresh_from_db()
        assert float(test_product.cost_price) == 210000.0

    def test_unclassified_endpoint_denied_by_default_for_all_non_superusers(
        self, sales_staff_user, management_user, legacy_staff_without_role, super_admin_user
    ):
        """Un endpoint con IsAdminOrStaff o RBACPermission sin metadatos RBAC deniega por defecto."""
        @api_view(["GET"])
        @permission_classes([IsAdminOrStaff])
        def unclassified_admin_view(request):
            return Response({"ok": True})

        factory = APIRequestFactory()

        for non_super in (sales_staff_user, management_user, legacy_staff_without_role):
            req = factory.get("/api/v1/admin/unclassified-test/")
            req.user = non_super
            perm = IsAdminOrStaff()
            assert perm.has_permission(req, unclassified_admin_view.cls) is False
            rbac_perm = RBACPermission()
            assert rbac_perm.has_permission(req, unclassified_admin_view.cls) is False

        # Solo un superusuario activo tiene acceso de emergencia a vistas sin clasificar
        req_super = factory.get("/api/v1/admin/unclassified-test/")
        req_super.user = super_admin_user
        assert IsAdminOrStaff().has_permission(req_super, unclassified_admin_view.cls) is True

    @pytest.mark.parametrize(
        "endpoint",
        [
            "/api/v1/admin/dashboard/",
            "/api/v1/admin/products/",
            "/api/v1/admin/orders/",
            "/api/v1/admin/inventory/summary/",
            "/api/v1/admin/finance/summary/?currency=CLP",
            "/api/v1/admin/roles/",
            "/api/v1/admin/site-settings/",
            "/api/schema/",
        ],
    )
    def test_legacy_staff_without_role_is_denied_everywhere(
        self, api_client, legacy_staff_without_role, endpoint
    ):
        """is_staff=True sin rol RBAC asignado NO constituye bypass y recibe 403 en todos los módulos."""
        api_client.force_authenticate(user=legacy_staff_without_role)
        res = api_client.get(endpoint)
        assert res.status_code == 403

    def test_inactive_user_and_inactive_superuser_denied(
        self, api_client, sales_staff_user, super_admin_user
    ):
        """Un usuario o superusuario desactivado en DB pierde acceso inmediatamente."""
        api_client.force_authenticate(user=sales_staff_user)
        assert api_client.get("/api/v1/admin/orders/").status_code == 200

        # Desactivar en base de datos mientras la sesión sigue abierta
        User.objects.filter(pk=sales_staff_user.pk).update(is_active=False)
        assert api_client.get("/api/v1/admin/orders/").status_code == 403

        # Incluso un superusuario inactivo es rechazado
        api_client.force_authenticate(user=super_admin_user)
        User.objects.filter(pk=super_admin_user.pk).update(is_active=False)
        assert api_client.get("/api/v1/admin/roles/").status_code == 403

    def test_role_revocation_with_open_session_immediately_revokes_access_and_clears_is_staff(
        self, api_client, super_admin_user, sales_staff_user
    ):
        """
        Cuando se revoca el rol de un usuario con sesión abierta, pierde acceso de inmediato
        y no cae en ningún fallback legacy (is_staff pasa a False).
        """
        sales_client = APIClient()
        sales_client.force_authenticate(user=sales_staff_user)
        assert sales_client.get("/api/v1/admin/orders/").status_code == 200

        # Super Admin revoca el rol Ventas
        api_client.force_authenticate(user=super_admin_user)
        rev_res = api_client.post(
            f"/api/v1/admin/users/{sales_staff_user.id}/roles/",
            {"role": ROLE_SALES, "action": "remove"},
            format="json",
        )
        assert rev_res.status_code == 200
        assert rev_res.json()["roles"] == []

        sales_staff_user.refresh_from_db()
        assert sales_staff_user.is_staff is False

        # La sesión previamente autenticada ahora recibe 403 en Pedidos y Catálogo
        assert sales_client.get("/api/v1/admin/orders/").status_code == 403
        assert sales_client.get("/api/v1/admin/products/").status_code == 403


@pytest.mark.django_db
class TestGranularActionsAndAtomicFieldProtection:
    """
    PATCH 1.1.1 — Bloques 3 y 4:
    Verifica permisos granulares por acción (read, create, update, delete, export, import, approve)
    y rechazo atómico sin efectos parciales en escrituras no autorizadas.
    """

    def test_sales_cannot_edit_prices_stock_costs_or_delete_products(
        self, api_client, sales_staff_user, test_product
    ):
        """Ventas tiene solo lectura en Catálogo: no puede editar precios, stock, costos ni eliminar productos."""
        api_client.force_authenticate(user=sales_staff_user)

        # Lectura permitida (sin cost_price)
        get_res = api_client.get(f"/api/v1/admin/products/{test_product.id}/")
        assert get_res.status_code == 200
        assert "cost_price" not in get_res.json()

        # PATCH de precio + nombre rechazado sin efecto parcial
        patch_res = api_client.patch(
            f"/api/v1/admin/products/{test_product.id}/",
            {"name": "Nombre Alterado", "price": 1000},
            format="json",
        )
        assert patch_res.status_code == 403
        test_product.refresh_from_db()
        assert test_product.name == "Micrófono Shure SM7B"
        assert float(test_product.price) == 399990.0

        # DELETE de producto rechazado
        del_res = api_client.delete(f"/api/v1/admin/products/{test_product.id}/")
        assert del_res.status_code == 403
        assert Product.objects.filter(pk=test_product.pk).exists()

    def test_warehouse_can_adjust_stock_only_and_atomic_rejection_on_price_or_cost(
        self, api_client, warehouse_staff_user, test_product
    ):
        """
        Bodega puede ajustar stock/stock_min, pero un PATCH mixto con price o cost_price
        es rechazado atómicamente sin alterar tampoco el stock.
        """
        api_client.force_authenticate(user=warehouse_staff_user)

        # PATCH mixto (stock + price) -> 403 atómico, stock sigue en 15
        bad_patch = api_client.patch(
            f"/api/v1/admin/products/{test_product.id}/",
            {"stock": 99, "price": 500000},
            format="json",
        )
        assert bad_patch.status_code == 403
        test_product.refresh_from_db()
        assert test_product.stock == 15
        assert float(test_product.price) == 399990.0

        # PATCH mixto (stock + cost_price) -> 403 atómico, stock sigue en 15
        bad_cost_patch = api_client.patch(
            f"/api/v1/admin/products/{test_product.id}/",
            {"stock": 88, "cost_price": 100000},
            format="json",
        )
        assert bad_cost_patch.status_code in (400, 403)
        test_product.refresh_from_db()
        assert test_product.stock == 15
        assert float(test_product.cost_price) == 220000.0

        # PATCH exclusivo de stock y stock_min -> 200 OK
        good_patch = api_client.patch(
            f"/api/v1/admin/products/{test_product.id}/",
            {"stock": 25, "stock_min": 5},
            format="json",
        )
        assert good_patch.status_code == 200
        test_product.refresh_from_db()
        assert test_product.stock == 25
        assert test_product.stock_min == 5

        # Bodega no puede crear ni eliminar productos
        assert api_client.delete(f"/api/v1/admin/products/{test_product.id}/").status_code == 403

    def test_payment_approval_restricted_to_approve_payments_capability(
        self, api_client, sales_staff_user, logistics_staff_user, finance_staff_user, regular_customer, test_product
    ):
        """
        Ventas y Logística NO pueden aprobar pagos manualmente ni marcar órdenes como pagadas.
        Finanzas sí puede aprobar pagos. Logística solo puede despachar órdenes ya pagadas.
        """
        order = Order.objects.create(
            user=regular_customer,
            email=regular_customer.email,
            status="pending",
            total=Decimal("399990"),
            currency="CLP",
        )
        payment = Payment.objects.create(
            order=order,
            provider="transfer",
            amount=Decimal("399990"),
            currency="CLP",
            status="pending",
        )

        # Ventas intenta aprobar pago -> 403
        api_client.force_authenticate(user=sales_staff_user)
        res_sales_pay = api_client.patch(
            f"/api/v1/admin/payments/{payment.id}/status/",
            {"status": "approved"},
            format="json",
        )
        assert res_sales_pay.status_code == 403

        # Ventas intenta marcar orden como paid directamente -> 403
        res_sales_ord = api_client.post(
            f"/api/v1/admin/orders/{order.id}/update_status/",
            {"status": "paid"},
            format="json",
        )
        assert res_sales_ord.status_code == 403

        # Logística intenta despachar orden aún pendiente de pago -> 403
        api_client.force_authenticate(user=logistics_staff_user)
        res_log_unpaid = api_client.post(
            f"/api/v1/admin/orders/{order.id}/update_status/",
            {"status": "shipped"},
            format="json",
        )
        assert res_log_unpaid.status_code == 403

        # Finanzas aprueba el pago -> 200 OK
        api_client.force_authenticate(user=finance_staff_user)
        res_fin_pay = api_client.patch(
            f"/api/v1/admin/payments/{payment.id}/status/",
            {"status": "approved"},
            format="json",
        )
        assert res_fin_pay.status_code == 200
        order.refresh_from_db()
        assert order.status == "paid"

        # Ahora Logística puede marcar la orden pagada como shipped -> 200 OK
        api_client.force_authenticate(user=logistics_staff_user)
        res_log_ship = api_client.post(
            f"/api/v1/admin/orders/{order.id}/update_status/",
            {"status": "shipped"},
            format="json",
        )
        assert res_log_ship.status_code == 200
        order.refresh_from_db()
        assert order.status == "shipped"

    def test_bulk_import_and_csv_export_restrictions(
        self, api_client, sales_staff_user, marketing_staff_user, management_user
    ):
        """
        Importación masiva de productos está restringida a quienes pueden editar precios y costos.
        Exportación CSV de Rewards requiere PERM_EXPORT_DATA.
        """
        for user in (sales_staff_user, marketing_staff_user):
            api_client.force_authenticate(user=user)
            assert api_client.post("/api/v1/admin/products/import/").status_code == 403
            assert api_client.get("/api/v1/admin/rewards/entries/export/").status_code == 403

        # Gerencia posee PERM_EXPORT_DATA
        api_client.force_authenticate(user=management_user)
        export_res = api_client.get("/api/v1/admin/rewards/entries/export/")
        assert export_res.status_code == 200

    def test_marketing_cannot_manage_settings_exchange_rates_or_manual_points(
        self, api_client, marketing_staff_user
    ):
        """
        Marketing NO posee manage_settings, no puede acceder a site-settings ni tipos de cambio,
        no puede ver cuentas bancarias admin ni ajustar puntos manualmente.
        """
        api_client.force_authenticate(user=marketing_staff_user)
        assert api_client.get("/api/v1/admin/site-settings/").status_code == 403
        assert api_client.patch(
            "/api/v1/admin/site-settings/", {"usd_to_clp": "990.00"}, format="json"
        ).status_code == 403
        assert api_client.get("/api/v1/payments/admin/bank-accounts/").status_code == 403
        assert api_client.post(
            "/api/v1/loyalty/admin/adjust/", {"user_id": 1, "points": 500}, format="json"
        ).status_code == 403

    def test_b2b_discount_policy_limit_15_percent_for_sales(
        self, api_client, sales_staff_user, management_user
    ):
        """
        No se permiten descuentos autónomos no autorizados en cotizaciones B2B por parte de Ventas.
        Todo descuento B2B > 0% requiere autorización de Gerencia / Administración o Super Admin.
        """
        quote = B2BQuote.objects.create(
            company_name="Estudio Pro Audio SpA",
            tax_id="76.123.456-7",
            contact_name="Ingeniero Jefe",
            email="ing@estudiopro.cl",
            currency="CLP",
            subtotal=Decimal("1000000"),
            total=Decimal("1000000"),
        )

        api_client.force_authenticate(user=sales_staff_user)
        # Ventas puede actualizar notas sin alterar descuentos -> 200 OK
        res_notes = api_client.patch(
            f"/api/v1/admin/b2b/quotes/{quote.id}/",
            {"admin_notes": "Cotización revisada por ejecutivo comercial"},
            format="json",
        )
        assert res_notes.status_code == 200

        # Ventas intenta aplicar 5% o 10% de descuento autónomo -> 403 Forbidden
        res_sales_disc = api_client.patch(
            f"/api/v1/admin/b2b/quotes/{quote.id}/",
            {"discount_amount": "50000"},
            format="json",
        )
        assert res_sales_disc.status_code == 403
        quote.refresh_from_db()
        assert quote.discount_amount == Decimal("0.00")

        # Gerencia / Administración sí está autorizada a aplicar descuento -> 200 OK
        api_client.force_authenticate(user=management_user)
        res_mgmt = api_client.patch(
            f"/api/v1/admin/b2b/quotes/{quote.id}/",
            {"discount_amount": "150000"},
            format="json",
        )
        assert res_mgmt.status_code == 200
        quote.refresh_from_db()
        assert quote.discount_amount == Decimal("150000.00")


@pytest.mark.django_db
class TestIndirectSensitiveDataLeakProtection:
    """
    PATCH 1.1.1 — Bloque 4:
    Verifica que ningún endpoint administrativo filtre costos, márgenes, utilidad
    o gasto financiero por vías indirectas (resúmenes, alertas, agregaciones).
    """

    def test_inventory_endpoints_mask_cost_and_margin_for_warehouse(
        self, api_client, warehouse_staff_user, finance_staff_user, test_product
    ):
        """
        Bodega puede consultar inventario pero NO ve valor_inventario, ganancia_potencial,
        cost_missing_count ni cost_price en alertas ni en valor por categoría.
        """
        api_client.force_authenticate(user=warehouse_staff_user)

        sum_res = api_client.get("/api/v1/admin/inventory/summary/")
        assert sum_res.status_code == 200
        sum_data = sum_res.json()
        assert sum_data["valor_inventario"] is None
        assert sum_data["ganancia_potencial"] is None
        assert sum_data["valor_venta"] is None
        assert sum_data["cost_missing_count"] is None
        assert sum_data["profit_calculable"] is False
        assert sum_data["total_productos"] == 1

        alerts_res = api_client.get("/api/v1/admin/inventory/alerts/")
        assert alerts_res.status_code == 200
        alerts_data = alerts_res.json()
        assert len(alerts_data) == 1
        assert "cost_price" not in alerts_data[0]

        cat_res = api_client.get("/api/v1/admin/inventory/by-category/")
        assert cat_res.status_code == 200
        cat_data = cat_res.json()
        assert len(cat_data) == 1
        assert cat_data[0]["valor_inventario"] is None

        # En cambio, Finanzas sí visualiza la valorización de inventario por costo
        api_client.force_authenticate(user=finance_staff_user)
        fin_sum = api_client.get("/api/v1/admin/inventory/summary/").json()
        assert fin_sum["valor_inventario"] == float(15 * 220000)

    def test_executive_dashboard_and_support_users_mask_profit_and_spend(
        self, api_client, support_staff_user, sales_staff_user, finance_staff_user, regular_customer
    ):
        """
        Soporte y Ventas NO ven utilidad_mes en executive_dashboard.
        Soporte NO ve total_spent ni spend_by_currency en /api/v1/admin/users/.
        """
        Order.objects.create(
            user=regular_customer,
            email=regular_customer.email,
            status="paid",
            total=Decimal("150000"),
            currency="CLP",
        )

        # Ventas consulta executive_dashboard: ve ventas pero NO utilidad_mes
        api_client.force_authenticate(user=sales_staff_user)
        exec_sales = api_client.get("/api/v1/admin/executive/?currency=CLP")
        assert exec_sales.status_code == 200
        exec_sales_data = exec_sales.json()
        assert exec_sales_data["utilidad_mes"] is None
        assert exec_sales_data["utilidad_estado"] == "restringido_rbac"
        assert exec_sales_data["ventas"]["hoy"] == 150000.0

        # Soporte consulta executive_dashboard: no tiene acceso al módulo dashboard -> 403
        api_client.force_authenticate(user=support_staff_user)
        exec_sup_res = api_client.get("/api/v1/admin/executive/?currency=CLP")
        assert exec_sup_res.status_code == 403

        # Soporte consulta /api/v1/admin/users/: total_spent y spend_by_currency enmascarados
        users_sup = api_client.get("/api/v1/admin/users/").json()
        cust_row = next(u for u in users_sup["results"] if u["email"] == regular_customer.email)
        assert cust_row["total_spent"] is None
        assert cust_row["spend_by_currency"] is None

        # Finanzas sí ve utilidad_mes en executive_dashboard
        api_client.force_authenticate(user=finance_staff_user)
        exec_fin = api_client.get("/api/v1/admin/executive/?currency=CLP").json()
        assert exec_fin["utilidad_mes"] is not None
        assert exec_fin["utilidad_estado"] == "estimacion_costos_catalogo_CLP"

    def test_private_media_proxy_requires_authentication_and_rbac(
        self,
        api_client,
        regular_customer,
        support_staff_user,
        sales_staff_user,
        logistics_staff_user,
        finance_staff_user,
    ):
        """
        Archivos bajo /media/billing/, /media/receipts/ o /media/private/ requieren autenticación y
        autorización financiera específica (PERM_VIEW_FINANCES) o titularidad comprobada sobre la orden.
        La sola pertenencia a MODULE_ORDERS (ej. Ventas, Logística, Soporte) NO otorga acceso a archivos financieros.
        """
        # Anónimo -> 401/403 denegado
        res_anon = api_client.get("/media/billing/test_invoice.pdf")
        assert res_anon.status_code in (401, 403)

        # Cliente regular que no es dueño del documento -> 403
        api_client.force_authenticate(user=regular_customer)
        res_cust = api_client.get("/media/billing/test_invoice.pdf")
        assert res_cust.status_code == 403

        # Roles con acceso a MODULE_ORDERS pero sin PERM_VIEW_FINANCES -> 403 en archivos privados y en tax_dashboard
        for non_finance_staff in (support_staff_user, sales_staff_user, logistics_staff_user):
            api_client.force_authenticate(user=non_finance_staff)
            assert api_client.get("/media/billing/test_invoice.pdf").status_code == 403
            assert api_client.get("/media/receipts/transfer_proof.pdf").status_code == 403
            assert api_client.get("/media/private/internal_doc.pdf").status_code == 403
            assert api_client.get("/api/v1/billing/dashboard/").status_code == 403

        # Finanzas posee PERM_VIEW_FINANCES -> autorizado en tax_dashboard (200) y en MediaProxyView._check_private_access
        api_client.force_authenticate(user=finance_staff_user)
        assert api_client.get("/api/v1/billing/dashboard/").status_code == 200

        from core.views import MediaProxyView
        factory = APIRequestFactory()
        for p in ("billing/test_invoice.pdf", "receipts/transfer_proof.pdf", "private/internal_doc.pdf"):
            req_fin = factory.get(f"/media/{p}")
            req_fin.user = finance_staff_user
            assert MediaProxyView()._check_private_access(req_fin, p) is True

            req_sales = factory.get(f"/media/{p}")
            req_sales.user = sales_staff_user
            assert MediaProxyView()._check_private_access(req_sales, p) is False


@pytest.mark.django_db
class TestSuperAdminLifecycleAndSegregationOfDuties:
    """
    PATCH 1.1.1 — Bloque 5:
    Verifica Segregación de Funciones (SoD), protección del último Super Admin activo
    en todos los puntos de mutación e idempotencia no destructiva de setup_rbac.
    """

    @pytest.mark.parametrize(
        "role_a,role_b",
        [
            (ROLE_SALES, ROLE_FINANCE),
            (ROLE_PURCHASING, ROLE_FINANCE),
            (ROLE_WAREHOUSE, ROLE_FINANCE),
        ],
    )
    def test_segregation_of_duties_prevents_incompatible_role_combinations(
        self, api_client, super_admin_user, regular_customer, role_a, role_b
    ):
        """No permite combinar roles operacionales con Finanzas (SoD)."""
        api_client.force_authenticate(user=super_admin_user)

        res1 = api_client.post(
            f"/api/v1/admin/users/{regular_customer.id}/roles/",
            {"role": role_a, "action": "assign"},
            format="json",
        )
        assert res1.status_code == 200

        res2 = api_client.post(
            f"/api/v1/admin/users/{regular_customer.id}/roles/",
            {"role": role_b, "action": "assign"},
            format="json",
        )
        assert res2.status_code == 400
        assert "Segregación de Funciones" in res2.json()["error"]

    def test_cannot_revoke_deactivate_or_delete_last_active_super_admin(
        self, api_client, super_admin_user
    ):
        """Bloquea revocación de rol, desactivación o eliminación del último Super Admin activo."""
        api_client.force_authenticate(user=super_admin_user)

        # 1. No puede revocar su propio rol Super Admin siendo el último
        res_revoke = api_client.post(
            f"/api/v1/admin/users/{super_admin_user.id}/roles/",
            {"role": ROLE_SUPER_ADMIN, "action": "remove"},
            format="json",
        )
        assert res_revoke.status_code == 400

        # 2. No puede desactivarse ni borrarse en admin_user_detail
        res_patch = api_client.patch(
            f"/api/v1/admin/users/{super_admin_user.id}/",
            {"is_active": False},
            format="json",
        )
        assert res_patch.status_code == 403

        res_del = api_client.delete(f"/api/v1/admin/users/{super_admin_user.id}/")
        assert res_del.status_code == 403

    def test_setup_rbac_is_idempotent_and_non_destructive_to_custom_group_permissions_and_users(
        self, db, legacy_staff_without_role, management_user
    ):
        """
        setup_rbac preserva permisos adicionales asignados a grupos, NO restituye silenciosamente
        permisos sensibles retirados de forma deliberada y no modifica usuarios reales
        salvo que se indique explícitamente --reset-defaults o --sync-superusers.
        """
        from core.rbac.permissions import user_has_capability

        sales_group = Group.objects.get(name=ROLE_SALES)
        extra_perm = Permission.objects.get(codename=PERM_EXPORT_DATA)
        sales_group.permissions.add(extra_perm)

        # Retirar deliberadamente PERM_EDIT_COSTS del grupo Gerencia / Administración
        mgmt_group = Group.objects.get(name=ROLE_MANAGEMENT)
        removed_perm = Permission.objects.get(codename=PERM_EDIT_COSTS)
        assert user_has_capability(management_user, PERM_EDIT_COSTS) is True
        mgmt_group.permissions.remove(removed_perm)
        assert user_has_capability(management_user, PERM_EDIT_COSTS) is False

        # Ejecutar setup_rbac por defecto (no destructivo)
        call_command("setup_rbac")

        # 1. El permiso adicional en Ventas se conserva
        assert sales_group.permissions.filter(codename=PERM_EXPORT_DATA).exists()
        # 2. El permiso sensible retirado deliberadamente de Gerencia NO se restituye silenciosamente
        assert not mgmt_group.permissions.filter(codename=PERM_EDIT_COSTS).exists()
        assert user_has_capability(management_user, PERM_EDIT_COSTS) is False
        # 3. El usuario staff legacy NO fue promovido a ningún rol automáticamente
        assert legacy_staff_without_role.groups.count() == 0

        # Con --reset-defaults se restaura exactamente la matriz base
        call_command("setup_rbac", reset_defaults=True)
        assert not sales_group.permissions.filter(codename=PERM_EXPORT_DATA).exists()
        assert mgmt_group.permissions.filter(codename=PERM_EDIT_COSTS).exists()
        assert user_has_capability(management_user, PERM_EDIT_COSTS) is True

    def test_django_admin_protects_last_super_admin_on_direct_edit_and_bulk_delete(
        self, db, super_admin_user, regular_customer
    ):
        """
        Verifica que UserAdmin en Django Admin impide desactivar, quitar is_superuser
        o ejecutar eliminación masiva (delete_queryset) sobre el último Super Admin activo.
        """
        from django.contrib.admin.sites import AdminSite
        from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
        from apps.users.admin import UserAdmin

        site = AdminSite()
        user_admin = UserAdmin(User, site)

        class DummyRequest:
            user = super_admin_user

        req = DummyRequest()

        # 1. has_delete_permission devuelve False para el único Super Admin activo
        assert user_admin.has_delete_permission(req, obj=super_admin_user) is False

        # 2. Acción masiva delete_queryset incluyendo al único Super Admin activo es bloqueada
        qs_all = User.objects.filter(pk__in=[super_admin_user.pk, regular_customer.pk])
        with pytest.raises(DjangoPermissionDenied):
            user_admin.delete_queryset(req, qs_all)
        assert User.objects.filter(pk=super_admin_user.pk, is_active=True).exists()

        # 3. Edición directa save_model intentando desactivar al único Super Admin activo es bloqueada
        super_admin_user.is_active = False
        with pytest.raises(DjangoPermissionDenied):
            user_admin.save_model(req, super_admin_user, form=None, change=True)
        super_admin_user.refresh_from_db()
        assert super_admin_user.is_active is True

    def test_permissions_catalog_endpoint_reflects_12_capabilities_and_module_status(
        self, api_client, super_admin_user
    ):
        api_client.force_authenticate(user=super_admin_user)
        response = api_client.get("/api/v1/admin/permissions/catalog/")
        assert response.status_code == 200
        assert "no-store" in response["Cache-Control"]
        data = response.json()
        assert len(data["modules"]) >= 12
        assert "audit" in data["modules"]
        assert len(data["capabilities"]) >= 12
        assert "view_audit" in data["capabilities"]
        assert len(data["role_matrix"]) == 10
        assert data["module_status"]["purchases"]["status"] == "implemented"
        assert data["module_status"]["logistics"]["status"] == "partial_reserved"
        assert data["module_status"]["catalog"]["status"] == "implemented"


@pytest.mark.django_db(transaction=True)
def test_concurrent_super_admin_revocation_and_deactivation_preserves_at_least_one_active(super_admin_user):
    """
    BLOQUE A.3 — Prueba real de concurrencia PostgreSQL (SELECT ... FOR UPDATE):
    Cuando existen 2 Super Admins activos y dos transacciones concurrentes intentan revocar
    o desactivar simultáneamente a ambos, el bloqueo pesimista serializa las operaciones y
    garantiza que exactamente 1 tenga éxito (200) y la segunda sea bloqueada (400),
    preservando siempre al menos 1 Super Admin activo en PostgreSQL.
    """
    from concurrent.futures import ThreadPoolExecutor
    from queue import Queue
    import time
    from django.db import close_old_connections, connection, connections, transaction
    from django.db.models import Q

    if connection.vendor != "postgresql":
        pytest.skip("Requiere PostgreSQL real para validar SELECT ... FOR UPDATE.")

    second_super = User.objects.create_superuser(
        username="superadmin2@levelpro.cl",
        email="superadmin2@levelpro.cl",
        password="SuperPassword123!",
    )
    super_group = Group.objects.get(name=ROLE_SUPER_ADMIN)
    second_super.groups.add(super_group)

    def revoke_role(actor_pk, target_pk):
        client = APIClient()
        client.force_authenticate(user=User.objects.get(pk=actor_pk))
        return client.post(
            f"/api/v1/admin/users/{target_pk}/roles/",
            {"role": ROLE_SUPER_ADMIN, "action": "remove"},
            format="json",
        ).status_code

    pids = Queue()

    def worker(action):
        close_old_connections()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SET lock_timeout = '8s'")
                cursor.execute("SET statement_timeout = '12s'")
                cursor.execute("SELECT pg_backend_pid()")
                pids.put(cursor.fetchone()[0])
            return action()
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        with transaction.atomic():
            # Retener el lock de los dos Super Admins hasta que ambos workers estén en espera real
            list(
                User.objects.select_for_update()
                .filter(pk__in=[super_admin_user.pk, second_super.pk])
                .order_by("id")
            )
            f1 = pool.submit(worker, lambda: revoke_role(super_admin_user.pk, second_super.pk))
            f2 = pool.submit(worker, lambda: revoke_role(second_super.pk, super_admin_user.pk))
            worker_pids = [pids.get(timeout=5), pids.get(timeout=5)]
            deadline = time.monotonic() + 5
            waiting = 0
            while time.monotonic() < deadline:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT pg_stat_clear_snapshot()")
                    cursor.execute(
                        "SELECT count(*) FROM pg_stat_activity WHERE pid = ANY(%s) AND wait_event_type = 'Lock'",
                        [worker_pids],
                    )
                    waiting = cursor.fetchone()[0]
                if waiting == 2:
                    break
                time.sleep(0.02)
            assert waiting == 2, "Ambas transacciones concurrentes deben esperar el lock de fila en PostgreSQL."

        results = sorted([f1.result(timeout=15), f2.result(timeout=15)])

    # Una revocación tiene éxito (200) y la segunda es rechazada por ser el último Super Admin o por pérdida de privilegio (400 o 403)
    assert results[0] == 200
    assert results[1] in (400, 403)

    remaining_active_supers = (
        User.objects.filter(is_active=True)
        .filter(Q(is_superuser=True) | Q(groups__name=ROLE_SUPER_ADMIN))
        .distinct()
        .count()
    )
    assert remaining_active_supers == 1

