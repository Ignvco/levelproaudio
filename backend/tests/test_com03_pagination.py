"""
backend/tests/test_com03_pagination.py
Pruebas de paginación integral y conjuntos grandes para SKUs,
usuarios e inscripciones (Issue #22 / COM-03).
"""

from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import User
from apps.products.models import Category, Product
from apps.academy.models import Course, Enrollment
from apps.payments.models import Payment, PaymentProvider, PaymentStatus
from apps.orders.models import Order, OrderStatus


class Com03PaginationTest(TestCase):
    def setUp(self):
        self.staff_user = User.objects.create_user(
            email="staff@example.test",
            username="staff_user",
            password="x",
            is_staff=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff_user)

    def test_admin_users_pagination_and_total_count(self):
        """
        Crea más de 100 usuarios (120) y comprueba que admin_users
        admite page y page_size, retornando conteo total y resultados sin corte forzado.
        """
        User.objects.bulk_create([
            User(
                email=f"client_{i}@example.test",
                username=f"client_{i}",
                first_name=f"Cliente{i}",
                last_name="Test",
            )
            for i in range(120)
        ])

        # Página 1 con 50 usuarios
        res1 = self.client.get("/api/v1/admin/users/?page=1&page_size=50")
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(len(res1.data["results"]), 50)
        self.assertGreaterEqual(res1.data["count"], 121)

        # Página 2 con siguientes 50 usuarios
        res2 = self.client.get("/api/v1/admin/users/?page=2&page_size=50")
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(len(res2.data["results"]), 50)

        # Los conjuntos de IDs no deben solaparse
        ids_p1 = {u["id"] for u in res1.data["results"]}
        ids_p2 = {u["id"] for u in res2.data["results"]}
        self.assertEqual(len(ids_p1.intersection(ids_p2)), 0)

    def test_admin_enrollments_pagination_and_total_count(self):
        """
        Crea más de 200 inscripciones (220) y comprueba que admin_enrollments
        soporta paginación limpia sin truncamiento rígido a 200.
        """
        course = Course.objects.create(
            title="Mezcla y Mastering Profesional",
            slug="mezcla-mastering-pro",
            price=Decimal("80000"),
            is_published=True,
        )
        students = User.objects.bulk_create([
            User(
                email=f"student_{i}@example.test",
                username=f"student_{i}",
                first_name="Alumno",
                last_name=str(i),
            )
            for i in range(220)
        ])
        Enrollment.objects.bulk_create([
            Enrollment(user=s, course=course)
            for s in students
        ])

        # Página 1: 100 inscripciones
        res1 = self.client.get("/api/v1/admin/academy/enrollments/?page=1&page_size=100")
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(len(res1.data["results"]), 100)
        self.assertEqual(res1.data["count"], 220)

        # Página 2: 100 inscripciones
        res2 = self.client.get("/api/v1/admin/academy/enrollments/?page=2&page_size=100")
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(len(res2.data["results"]), 100)

        # Página 3: últimas 20 inscripciones
        res3 = self.client.get("/api/v1/admin/academy/enrollments/?page=3&page_size=100")
        self.assertEqual(res3.status_code, 200)
        self.assertEqual(len(res3.data["results"]), 20)

    def test_admin_payments_pagination(self):
        """
        Prueba paginación en admin_payments con filtro de moneda.
        """
        order = Order.objects.create(
            user=self.staff_user,
            email=self.staff_user.email,
            shipping_address="Test",
            status=OrderStatus.PENDING,
            total=Decimal("10000"),
            currency="CLP",
        )
        Payment.objects.bulk_create([
            Payment(
                order=order,
                provider=PaymentProvider.TRANSFER,
                status=PaymentStatus.PENDING,
                amount=Decimal("10000"),
                currency="CLP",
            )
            for _ in range(60)
        ])

        res = self.client.get("/api/v1/admin/payments/?currency=CLP&page=1&page_size=25")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["results"]), 25)
        self.assertGreaterEqual(res.data["count"], 60)
