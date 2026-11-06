"""Reporting regressions for V3.2.1 Lote 3 (no payment mutations)."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.orders.models import Order, OrderItem
from apps.products.models import Category, Product


class Lote3ReportingTest(TestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_superuser(
            email="admin-lote3@example.test", username="admin-lote3", password="x"
        )
        self.staff = User.objects.create_user(
            email="staff-lote3@example.test", username="staff-lote3", is_staff=True
        )
        self.customer = User.objects.create_user(
            email="customer-lote3@example.test", username="customer-lote3"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_top_products_multiply_unit_price_by_quantity_in_each_currency(self):
        category = Category.objects.create(name="Lote 3", slug="lote3")
        product = Product.objects.create(
            name="Mic Lote 3", slug="mic-lote3", category=category,
            price=Decimal("100"), stock=10,
        )
        expected = {"CLP": Decimal("500"), "USD": Decimal("12.50"), "ARS": Decimal("1500")}
        for currency, total in expected.items():
            for quantity in (2, 3):
                price = total / 5
                order = Order.objects.create(
                    user=self.customer, email=self.customer.email,
                    shipping_address="Test", status="paid", currency=currency,
                    total=price * quantity,
                )
                OrderItem.objects.create(
                    order=order, product=product, product_name=product.name,
                    price=price, quantity=quantity,
                )
        for currency, total in expected.items():
            with self.subTest(currency=currency):
                response = self.client.get("/api/v1/admin/dashboard/", {"currency": currency})
                self.assertEqual(response.status_code, 200)
                row = response.data["top_products"][0]
                self.assertEqual(row["total_sold"], 5)
                self.assertEqual(row["revenue"], total)

    def test_admin_user_list_exposes_actual_roles_without_changing_permissions(self):
        response = self.client.get("/api/v1/admin/users/")
        self.assertEqual(response.status_code, 200)
        rows = {row["id"]: row for row in response.data["results"]}
        for user in (self.admin, self.staff, self.customer):
            with self.subTest(user=user.username):
                self.assertEqual(rows[str(user.pk)]["is_staff"], user.is_staff)
                self.assertEqual(rows[str(user.pk)]["is_superuser"], user.is_superuser)

    def test_customer_cannot_read_admin_user_roles(self):
        self.client.force_authenticate(self.customer)
        response = self.client.get("/api/v1/admin/users/")
        self.assertEqual(response.status_code, 403)
