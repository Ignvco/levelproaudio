# apps/academy/tests.py
#
# Antes, el signal que inscribe al alumno al pagar un curso solo
# aceptaba status=="paid" exacto (distinto al resto de signals del
# proyecto), y había una llamada duplicada/redundante en
# payments/services.py con un método de respaldo roto (no le sacaba el
# prefijo "Curso: " al nombre, así que nunca encontraba el curso).

from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.academy.models import Course, Enrollment
from apps.orders.models import Order, OrderItem, OrderStatus
from apps.products.models import Category, Product

User = get_user_model()


class CourseEnrollmentOnPurchaseTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="student@test.com", username="student", password="x"
        )
        self.course = Course.objects.create(
            title="Mezcla y Masterización", price=Decimal("80000"), is_published=True,
        )

    def _order_with_course_item(self, product=None):
        order = Order.objects.create(
            user=self.user, status=OrderStatus.PENDING, total=self.course.price,
            email=self.user.email, shipping_address="Curso digital — sin envío",
        )
        OrderItem.objects.create(
            order=order, product=product, product_name=f"Curso: {self.course.title}",
            price=self.course.price, quantity=1,
        )
        return order

    def test_enrollment_created_when_order_becomes_paid_via_name_match(self):
        """Método 2 (fallback por nombre) — el camino real hoy, ya que
        el admin React no permite vincular Product↔Course."""
        order = self._order_with_course_item(product=None)
        self.assertFalse(Enrollment.objects.filter(user=self.user, course=self.course).exists())

        order.status = OrderStatus.PAID
        order.save()

        self.assertTrue(Enrollment.objects.filter(user=self.user, course=self.course).exists())

    def test_enrollment_created_via_linked_product(self):
        """Método 1 — si el producto SÍ está vinculado al curso (vía Django admin)."""
        category = Category.objects.create(name="Cursos", slug="cursos-test")
        product = Product.objects.create(
            name="Curso vinculado", slug="curso-vinculado", category=category,
            price=self.course.price, stock=999, is_active=True, course=self.course,
        )
        order = self._order_with_course_item(product=product)

        order.status = OrderStatus.PAID
        order.save()

        self.assertTrue(Enrollment.objects.filter(user=self.user, course=self.course).exists())

    def test_enrollment_created_for_shipped_and_completed_too(self):
        """Ahora acepta paid/shipped/completed, no solo 'paid' exacto (consistencia
        con los signals de loyalty y finanzas)."""
        for target_status, course_suffix in [("shipped", "2"), ("completed", "3")]:
            course = Course.objects.create(
                title=f"Curso {course_suffix}", price=Decimal("50000"), is_published=True,
            )
            order = Order.objects.create(
                user=self.user, status=OrderStatus.PENDING, total=course.price,
                email=self.user.email, shipping_address="Curso digital — sin envío",
            )
            OrderItem.objects.create(
                order=order, product=None, product_name=f"Curso: {course.title}",
                price=course.price, quantity=1,
            )
            order.status = target_status
            order.save()
            self.assertTrue(
                Enrollment.objects.filter(user=self.user, course=course).exists(),
                f"No se inscribió con status={target_status}",
            )

    def test_does_not_enroll_on_pending_or_cancelled(self):
        order = self._order_with_course_item()
        order.status = OrderStatus.CANCELLED
        order.save()
        self.assertFalse(Enrollment.objects.filter(user=self.user, course=self.course).exists())

    def test_no_duplicate_enrollment_on_repeated_save(self):
        order = self._order_with_course_item()
        order.status = OrderStatus.PAID
        order.save()
        order.save()  # dispara el signal de nuevo
        count = Enrollment.objects.filter(user=self.user, course=self.course).count()
        self.assertEqual(count, 1)
