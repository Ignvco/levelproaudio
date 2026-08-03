# apps/analytics/tests.py
#
# Cubre dos bugs reales encontrados en Finanzas:
#   1. create_distributions() dependía del orden de CREACIÓN de las
#      categorías (campo `order`, no editable desde el admin). Si la
#      categoría "remainder" (utilidad neta) se creaba antes que las
#      demás, el cálculo salía mal. Ahora el remainder siempre se
#      calcula al final, sin importar el orden de creación.
#   2. Los retiros no validaban contra el saldo disponible — se podía
#      dejar una categoría en negativo con un typo.

from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.db.models import Sum
from rest_framework.test import APIClient

from apps.products.models import Category, Product
from apps.orders.models import Order, OrderItem, OrderStatus
from apps.analytics.models import DistributionCategory, IncomeRecord, IncomeDistribution, Withdrawal

User = get_user_model()


def _order_with_product(price, cost_price):
    category = Category.objects.get_or_create(name="Mics", slug="mics-finance")[0]
    product = Product.objects.create(
        name="SM7B", slug=f"sm7b-finance-{price}-{cost_price}", category=category,
        price=Decimal(str(price)), cost_price=Decimal(str(cost_price)), stock=5, is_active=True,
    )
    order = Order.objects.create(
        status=OrderStatus.PAID, total=Decimal(str(price)),
        email="test@test.com", shipping_address="Test 123",
    )
    OrderItem.objects.create(
        order=order, product=product, product_name=product.name,
        price=product.price, quantity=1,
    )
    return order


class DistributionOrderingTest(TestCase):
    """El remainder siempre se calcula al final, sin importar el orden de creación."""

    def test_remainder_created_first_still_computes_correctly(self):
        # Crea el remainder PRIMERO (el escenario que rompía antes)
        remainder = DistributionCategory.objects.create(name="Utilidad neta", cat_type="remainder")
        fijo = DistributionCategory.objects.create(name="Costo capital", cat_type="fixed")
        iva = DistributionCategory.objects.create(name="IVA", cat_type="percent", percentage=Decimal("19"))

        order = _order_with_product(price="100000", cost_price="30000")
        record = IncomeRecord.objects.create(order=order, amount=order.total, source="payment")
        record.create_distributions()

        dist_fijo      = IncomeDistribution.objects.get(income_record=record, category=fijo)
        dist_iva       = IncomeDistribution.objects.get(income_record=record, category=iva)
        dist_remainder = IncomeDistribution.objects.get(income_record=record, category=remainder)

        self.assertEqual(dist_fijo.amount, Decimal("30000.00"))
        self.assertEqual(dist_iva.amount, Decimal("19000.00"))
        # 100000 - 30000 - 19000 = 51000, NO 100000 (que es lo que daría
        # el bug viejo si el remainder se calculaba antes que los demás)
        self.assertEqual(dist_remainder.amount, Decimal("51000.00"))

        # La suma de todo debe dar exactamente el total del ingreso
        total_distribuido = dist_fijo.amount + dist_iva.amount + dist_remainder.amount
        self.assertEqual(total_distribuido, record.amount)

    def test_multiple_remainder_categories_do_not_double_count(self):
        r1 = DistributionCategory.objects.create(name="Utilidad A", cat_type="remainder", order=1)
        r2 = DistributionCategory.objects.create(name="Utilidad B", cat_type="remainder", order=2)

        order = _order_with_product(price="50000", cost_price="0")
        record = IncomeRecord.objects.create(order=order, amount=order.total, source="payment")
        record.create_distributions()

        total = IncomeDistribution.objects.filter(income_record=record).aggregate(
            t=Sum("amount")
        )["t"]
        self.assertEqual(total, record.amount)  # nunca se duplica la utilidad


class WithdrawalValidationTest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email="admin@test.com", username="admin", password="x"
        )
        self.category = DistributionCategory.objects.create(name="Marketing", cat_type="percent", percentage=10)
        order = _order_with_product(price="100000", cost_price="0")
        record = IncomeRecord.objects.create(order=order, amount=order.total, source="payment")
        IncomeDistribution.objects.create(income_record=record, category=self.category, amount=Decimal("10000"))
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_withdrawal_within_balance_succeeds(self):
        resp = self.client.post("/api/v1/admin/finance/withdrawals/", {
            "category_id": str(self.category.id), "amount": "5000", "destination": "Banco Estado",
        }, format="json")
        self.assertEqual(resp.status_code, 201)

    def test_withdrawal_exceeding_balance_rejected(self):
        resp = self.client.post("/api/v1/admin/finance/withdrawals/", {
            "category_id": str(self.category.id), "amount": "999999", "destination": "Banco Estado",
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(Withdrawal.objects.filter(category=self.category).exists())

    def test_negative_withdrawal_rejected(self):
        resp = self.client.post("/api/v1/admin/finance/withdrawals/", {
            "category_id": str(self.category.id), "amount": "-500", "destination": "Banco Estado",
        }, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_zero_withdrawal_rejected(self):
        resp = self.client.post("/api/v1/admin/finance/withdrawals/", {
            "category_id": str(self.category.id), "amount": "0", "destination": "Banco Estado",
        }, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_withdrawal_records_who_created_it(self):
        self.client.post("/api/v1/admin/finance/withdrawals/", {
            "category_id": str(self.category.id), "amount": "5000", "destination": "Banco Estado",
        }, format="json")
        w = Withdrawal.objects.get(category=self.category)
        self.assertEqual(w.created_by, self.admin)

    def test_deleting_withdrawal_creates_audit_log(self):
        from apps.analytics.models import WithdrawalDeletionLog

        w = Withdrawal.objects.create(
            category=self.category, amount=Decimal("3000"),
            destination="Banco Estado", created_by=self.admin,
        )
        deleter = User.objects.create_superuser(email="deleter@test.com", username="deleter", password="x")
        client2 = APIClient()
        client2.force_authenticate(user=deleter)

        resp = client2.delete(f"/api/v1/admin/finance/withdrawals/{w.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(Withdrawal.objects.filter(id=w.id).exists())

        log = WithdrawalDeletionLog.objects.get(original_id=w.id)
        self.assertEqual(log.amount, Decimal("3000"))
        self.assertEqual(log.category_name, "Marketing")
        self.assertEqual(log.original_created_by, self.admin)
        self.assertEqual(log.deleted_by, deleter)


class IncomeRecordPaymentLinkingTest(TestCase):
    """
    Antes, IncomeRecord.payment podía quedar en None aunque el pago
    existiera, porque el signal corre ANTES de que este endpoint apruebe
    el pago. update_status ahora re-vincula el pago si quedó huérfano.
    """
    def test_income_record_gets_linked_to_payment_after_approval(self):
        from apps.payments.models import Payment, PaymentProvider, PaymentStatus

        admin = User.objects.create_superuser(email="fin@test.com", username="fin", password="x")
        order = _order_with_product(price="80000", cost_price="0")
        payment = Payment.objects.create(
            order=order, provider=PaymentProvider.TRANSFER,
            status=PaymentStatus.PENDING, amount=order.total,
        )

        client = APIClient()
        client.force_authenticate(user=admin)
        resp = client.post(f"/api/v1/admin/orders/{order.id}/update_status/", {"status": "paid"}, format="json")
        self.assertEqual(resp.status_code, 200)

        record = IncomeRecord.objects.get(order=order)
        self.assertEqual(record.payment_id, payment.id)


class CategoryDeletionTest(TestCase):
    """
    Antes, borrar una categoría con movimientos históricos tiraba un 500
    crudo (ProtectedError sin capturar) y el admin no entendía qué pasaba.
    Ahora: sin historial se borra de verdad; con historial se desactiva
    (nunca se pierde el dato financiero pasado) y avisa por qué.
    """
    def setUp(self):
        self.admin = User.objects.create_superuser(email="catdel@test.com", username="catdel", password="x")
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_category_without_history_is_actually_deleted(self):
        cat = DistributionCategory.objects.create(name="Sin uso", cat_type="percent", percentage=5)
        resp = self.client.delete(f"/api/v1/admin/finance/categories/{cat.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["deleted"])
        self.assertFalse(DistributionCategory.objects.filter(id=cat.id).exists())

    def test_category_with_income_distribution_is_deactivated_not_deleted(self):
        cat = DistributionCategory.objects.create(name="IVA", cat_type="percent", percentage=19)
        order = _order_with_product(price="50000", cost_price="0")
        record = IncomeRecord.objects.create(order=order, amount=order.total, source="payment")
        record.create_distributions()  # ahora `cat` tiene historial

        resp = self.client.delete(f"/api/v1/admin/finance/categories/{cat.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["deleted"])
        self.assertTrue(resp.data["deactivated"])

        cat.refresh_from_db()
        self.assertFalse(cat.is_active)
        # El historial financiero sigue intacto
        self.assertTrue(IncomeDistribution.objects.filter(category=cat).exists())

    def test_category_with_withdrawal_history_is_deactivated_not_deleted(self):
        cat = DistributionCategory.objects.create(name="Marketing", cat_type="percent", percentage=10)
        Withdrawal.objects.create(category=cat, amount=Decimal("5000"), destination="Banco Estado")

        resp = self.client.delete(f"/api/v1/admin/finance/categories/{cat.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["deactivated"])
        cat.refresh_from_db()
        self.assertFalse(cat.is_active)


class CategoryEditDoesNotRewriteHistoryTest(TestCase):
    """
    Antes, editar el % de una categoría reescribía TODAS las distribuciones
    históricas con el valor nuevo — si el IVA era 19% en una venta vieja y
    lo cambiabas a 20%, esa venta vieja terminaba "pagando" 20% también.
    Ahora: el historial queda fiel a lo que se distribuyó en su momento;
    el cambio de % solo aplica a ventas futuras.
    """
    def setUp(self):
        self.admin = User.objects.create_superuser(email="edithist@test.com", username="edithist", password="x")
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_editing_percentage_does_not_change_past_distributions(self):
        iva = DistributionCategory.objects.create(name="IVA", cat_type="percent", percentage=Decimal("19"))
        order = _order_with_product(price="100000", cost_price="0")
        record = IncomeRecord.objects.create(order=order, amount=order.total, source="payment")
        record.create_distributions()

        dist_antes = IncomeDistribution.objects.get(income_record=record, category=iva)
        self.assertEqual(dist_antes.amount, Decimal("19000.00"))

        # Editar el % de IVA de 19 a 20
        resp = self.client.patch(f"/api/v1/admin/finance/categories/{iva.id}/", {
            "percentage": "20",
        }, format="json")
        self.assertEqual(resp.status_code, 200)

        # La distribución de la venta VIEJA no debe haber cambiado
        dist_despues = IncomeDistribution.objects.get(income_record=record, category=iva)
        self.assertEqual(dist_despues.amount, Decimal("19000.00"))

        # Pero la config de la categoría sí quedó en 20% para ventas futuras
        iva.refresh_from_db()
        self.assertEqual(iva.percentage, Decimal("20.00"))

    def test_new_sale_after_edit_uses_new_percentage(self):
        iva = DistributionCategory.objects.create(name="IVA", cat_type="percent", percentage=Decimal("19"))

        self.client.patch(f"/api/v1/admin/finance/categories/{iva.id}/", {"percentage": "20"}, format="json")

        order = _order_with_product(price="100000", cost_price="0")
        record = IncomeRecord.objects.create(order=order, amount=order.total, source="payment")
        record.create_distributions()

        dist = IncomeDistribution.objects.get(income_record=record, category=iva)
        self.assertEqual(dist.amount, Decimal("20000.00"))  # usa el 20% nuevo


class AdminProductCreationTest(TestCase):
    """
    Antes, el selector de "Tipo de producto" del formulario admin mandaba
    valores ("physical"/"digital"/"service") que NO EXISTEN en las choices
    reales del modelo (stock/preorder/on_demand) — así que crear un
    producto nuevo desde el admin fallaba el 100% de las veces con un 400,
    a menos que ya viniera con un tipo válido cargado por otra vía.
    También: cost_price y stock_min no estaban en el serializer de
    escritura, así que se ignoraban en silencio aunque el formulario los
    mandara (rompía la calculadora de margen y el indicador de stock bajo).
    """
    def setUp(self):
        self.admin = User.objects.create_superuser(email="prodadmin@test.com", username="prodadmin", password="x")
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_create_product_with_form_default_type_succeeds(self):
        """Exactamente lo que el formulario manda hoy por defecto en un producto nuevo."""
        resp = self.client.post("/api/v1/admin/products/", {
            "name": "Micrófono de prueba",
            "price": "80000",
            "stock": 5,
            "product_type": "stock",  # el default corregido
            "is_active": True,
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)

    def test_create_product_with_old_broken_default_fails(self):
        """Confirma que el valor viejo ("physical") efectivamente rompía la creación."""
        resp = self.client.post("/api/v1/admin/products/", {
            "name": "Micrófono roto",
            "price": "80000",
            "stock": 5,
            "product_type": "physical",
            "is_active": True,
        }, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_cost_price_and_stock_min_are_saved(self):
        resp = self.client.post("/api/v1/admin/products/", {
            "name": "Micrófono con costo",
            "price": "80000",
            "cost_price": "45000",
            "stock": 5,
            "stock_min": 2,
            "product_type": "stock",
            "is_active": True,
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)

        from apps.products.models import Product
        product = Product.objects.get(id=resp.data["id"])
        self.assertEqual(product.cost_price, Decimal("45000.00"))
        self.assertEqual(product.stock_min, 2)

    def test_preorder_and_on_demand_types_are_valid(self):
        for ptype in ["preorder", "on_demand"]:
            resp = self.client.post("/api/v1/admin/products/", {
                "name": f"Producto {ptype}",
                "price": "10000", "stock": 0,
                "product_type": ptype, "is_active": True,
            }, format="json")
            self.assertEqual(resp.status_code, 201, resp.data)


class AdminUserManagementPrivilegeEscalationTest(TestCase):
    """
    IsAdminOrStaff acepta cualquier is_staff=True, no solo superusuarios
    — sin estas protecciones, un staff común podía otorgarse (o
    otorgarle a cualquiera) permisos de administrador, o borrar/
    desactivar la cuenta de un superusuario.
    """
    def setUp(self):
        self.superuser = User.objects.create_superuser(
            email="owner@test.com", username="owner", password="x"
        )
        self.staff = User.objects.create_user(
            email="staffmember@test.com", username="staffmember", password="x", is_staff=True
        )
        self.regular = User.objects.create_user(
            email="regularuser@test.com", username="regularuser", password="x"
        )
        self.client = APIClient()

    def test_regular_staff_cannot_grant_is_staff_to_another_user(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.patch(f"/api/v1/admin/users/{self.regular.id}/", {
            "is_staff": True,
        }, format="json")
        self.assertEqual(resp.status_code, 403)
        self.regular.refresh_from_db()
        self.assertFalse(self.regular.is_staff)

    def test_regular_staff_cannot_modify_another_staff_account(self):
        other_staff = User.objects.create_user(
            email="other@test.com", username="other", password="x", is_staff=True
        )
        self.client.force_authenticate(user=self.staff)
        resp = self.client.patch(f"/api/v1/admin/users/{other_staff.id}/", {
            "first_name": "Cambiado",
        }, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_regular_staff_cannot_delete_superuser(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.delete(f"/api/v1/admin/users/{self.superuser.id}/")
        self.assertEqual(resp.status_code, 403)
        self.assertTrue(User.objects.filter(id=self.superuser.id).exists())

    def test_superuser_cannot_delete_another_superuser_either(self):
        """Protección adicional: borrar un superusuario nunca se permite
        desde este endpoint, ni siquiera otro superusuario lo puede hacer
        (para eso está el admin de Django directo)."""
        other_super = User.objects.create_superuser(
            email="other-owner@test.com", username="otherowner", password="x"
        )
        self.client.force_authenticate(user=self.superuser)
        resp = self.client.delete(f"/api/v1/admin/users/{other_super.id}/")
        self.assertEqual(resp.status_code, 403)

    def test_superuser_can_grant_is_staff(self):
        self.client.force_authenticate(user=self.superuser)
        resp = self.client.patch(f"/api/v1/admin/users/{self.regular.id}/", {
            "is_staff": True,
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        self.regular.refresh_from_db()
        self.assertTrue(self.regular.is_staff)

    def test_superuser_can_delete_regular_staff(self):
        self.client.force_authenticate(user=self.superuser)
        resp = self.client.delete(f"/api/v1/admin/users/{self.staff.id}/")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(User.objects.filter(id=self.staff.id).exists())

    def test_nobody_can_modify_their_own_account_via_this_endpoint(self):
        self.client.force_authenticate(user=self.superuser)
        resp = self.client.patch(f"/api/v1/admin/users/{self.superuser.id}/", {
            "first_name": "Yo mismo",
        }, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_nobody_can_delete_their_own_account_via_this_endpoint(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.delete(f"/api/v1/admin/users/{self.staff.id}/")
        self.assertEqual(resp.status_code, 403)
        self.assertTrue(User.objects.filter(id=self.staff.id).exists())

    def test_superuser_can_still_update_regular_users_normally(self):
        self.client.force_authenticate(user=self.superuser)
        resp = self.client.patch(f"/api/v1/admin/users/{self.regular.id}/", {
            "is_active": False,
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        self.regular.refresh_from_db()
        self.assertFalse(self.regular.is_active)


class LowStockThresholdConsistencyTest(TestCase):
    """
    Antes, "stock bajo" se calculaba con 3 criterios distintos según la
    pantalla: un umbral fijo de 5 en el dashboard principal, uno fijo de
    10 en analytics_full, y el umbral real por producto (stock_min) solo
    en inventory_alerts. Un mismo producto podía aparecer como "stock
    bajo" en una pantalla y no en otra. Ahora las tres usan el mismo
    criterio: stock_min configurado por producto.
    """
    def setUp(self):
        self.admin = User.objects.create_superuser(email="stockadmin@test.com", username="stockadmin", password="x")
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        cat = Category.objects.create(name="Mics", slug="mics-stockthreshold")

        # Antes: con umbral fijo de 5, este NO aparecía como "stock bajo"
        # (stock=7 > 5) — pero con su propio stock_min=10 configurado,
        # sí debería aparecer.
        self.high_threshold_product = Product.objects.create(
            name="Producto con umbral alto", slug="alto-umbral", category=cat,
            price=Decimal("50000"), stock=7, stock_min=10, is_active=True,
        )
        # Este SÍ estaba por debajo del umbral fijo de 5, y también está
        # por debajo de su propio stock_min=3 — debería seguir apareciendo.
        self.normal_product = Product.objects.create(
            name="Producto normal", slug="normal-umbral", category=cat,
            price=Decimal("30000"), stock=2, stock_min=3, is_active=True,
        )
        # Fuera de stock — no debe contar como "bajo", es su propia categoría.
        self.out_of_stock_product = Product.objects.create(
            name="Sin stock", slug="sin-stock-umbral", category=cat,
            price=Decimal("20000"), stock=0, stock_min=5, is_active=True,
        )

    def test_dashboard_overview_uses_real_stock_min(self):
        resp = self.client.get("/api/v1/admin/dashboard/")
        self.assertEqual(resp.status_code, 200)
        # Antes daba 1 (solo normal_product, por el umbral fijo de 5) — ahora
        # también cuenta high_threshold_product (7 <= su propio stock_min=10)
        self.assertEqual(resp.data["products"]["low_stock"], 2)
        self.assertEqual(resp.data["products"]["out_of_stock"], 1)

    def test_inventory_alerts_total_matches_dashboard_low_plus_out_of_stock(self):
        """inventory_alerts junta "bajo" + "sin stock" en una sola lista
        (con un campo status que los distingue) — el dashboard los separa
        en dos contadores. La suma de los dos debe dar el mismo total."""
        resp_dashboard = self.client.get("/api/v1/admin/dashboard/")
        resp_alerts = self.client.get("/api/v1/admin/inventory/alerts/")

        alert_names = {p["name"] for p in resp_alerts.data}
        self.assertIn("Producto con umbral alto", alert_names)
        self.assertIn("Producto normal", alert_names)
        self.assertIn("Sin stock", alert_names)  # inventory_alerts SÍ la incluye

        total_dashboard = (
            resp_dashboard.data["products"]["low_stock"]
            + resp_dashboard.data["products"]["out_of_stock"]
        )
        self.assertEqual(total_dashboard, len(resp_alerts.data))


class ExecutiveDashboardUtilidadMesTest(TestCase):
    """
    executive_dashboard calculaba "utilidad neta del mes" con un nombre
    de campo que no existe (record en vez de income_record) — el
    try/except alrededor lo tragaba en silencio y siempre devolvía $0,
    sin ningún error visible en ningún lado.
    """
    def setUp(self):
        self.admin = User.objects.create_superuser(email="execadmin@test.com", username="execadmin", password="x")
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_utilidad_mes_computes_real_value_not_always_zero(self):
        from apps.orders.models import Order, OrderStatus
        from apps.analytics.models import DistributionCategory, IncomeRecord

        utilidad_cat = DistributionCategory.objects.create(
            name="Utilidad neta", cat_type="remainder"
        )
        order = Order.objects.create(
            status=OrderStatus.PAID, total=Decimal("100000"),
            email="test@test.com", shipping_address="Test 123",
        )
        record = IncomeRecord.objects.create(order=order, amount=order.total, source="payment")
        record.create_distributions()  # crea la distribución real, incluida la de "utilidad_cat"

        resp = self.client.get("/api/v1/admin/executive/")
        self.assertEqual(resp.status_code, 200)
        # Antes esto SIEMPRE daba 0 por el bug — ahora debe reflejar la
        # distribución real que se acaba de crear.
        self.assertGreater(resp.data["utilidad_mes"], 0)
