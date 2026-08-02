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
