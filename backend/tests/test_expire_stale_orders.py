"""
backend/tests/test_expire_stale_orders.py
Pruebas de expiración controlada de pedidos pendientes y liberación de stock
para Patch 14 (Issues #16 y #18 / P14-03 y P14-05).
"""

from datetime import timedelta
from decimal import Decimal
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from apps.users.models import User
from apps.products.models import Category, Product
from apps.orders.models import Order, OrderItem, OrderStatus
from apps.orders.services import expire_stale_pending_orders
from apps.payments.models import Payment, PaymentProvider, PaymentStatus


class ExpireStaleOrdersTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="stale@example.test",
            username="stale_user",
            password="testpassword123",
        )
        self.category = Category.objects.create(name="Cables", slug="cables")
        self.product = Product.objects.create(
            name="Cable XLR 5m",
            slug="cable-xlr-5m",
            category=self.category,
            price=Decimal("20000"),
            stock=10,
            is_active=True,
        )

    def test_stale_pending_order_is_cancelled_and_stock_restored(self):
        """
        Una orden pendiente abandonada (creada hace más de 48h) se cancela
        automáticamente y su stock se reintegra al inventario disponible.
        """
        old_time = timezone.now() - timedelta(hours=72)
        order = Order.objects.create(
            user=self.user,
            email=self.user.email,
            shipping_address="Calle Antigua 123",
            status=OrderStatus.PENDING,
            total=Decimal("40000"),
            stock_deductions={str(self.product.pk): 2},
        )
        OrderItem.objects.create(
            order=order,
            product=self.product,
            product_name=self.product.name,
            price=Decimal("20000"),
            quantity=2,
        )
        # Descontar stock inicial simulando checkout
        self.product.stock = 8
        self.product.save(update_fields=["stock"])

        # Forzar created_at antiguo
        Order.objects.filter(pk=order.pk).update(created_at=old_time)

        # Ejecutar expiración
        count = expire_stale_pending_orders(hours=48)
        self.assertEqual(count, 1)

        order.refresh_from_db()
        self.product.refresh_from_db()

        self.assertEqual(order.status, OrderStatus.CANCELLED)
        self.assertIn("Cancelación automática por vencimiento", order.notes)
        # El stock debe haberse restituido de 8 a 10
        self.assertEqual(self.product.stock, 10)

    def test_recent_pending_orders_are_not_expired(self):
        """
        Órdenes pendientes recientes (menos de 48h) no se cancelan y conservan su reserva.
        """
        recent_time = timezone.now() - timedelta(hours=5)
        order = Order.objects.create(
            user=self.user,
            email=self.user.email,
            shipping_address="Calle Reciente 456",
            status=OrderStatus.PENDING,
            total=Decimal("20000"),
            stock_deductions={str(self.product.pk): 1},
        )
        Order.objects.filter(pk=order.pk).update(created_at=recent_time)
        self.product.stock = 9
        self.product.save(update_fields=["stock"])

        count = expire_stale_pending_orders(hours=48)
        self.assertEqual(count, 0)

        order.refresh_from_db()
        self.product.refresh_from_db()

        self.assertEqual(order.status, OrderStatus.PENDING)
        self.assertEqual(self.product.stock, 9)

    def test_orders_with_payments_in_review_are_protected_from_expiration(self):
        """
        Si una orden tiene un pago en revisión (ej: webhook tardío o mismatch de monto),
        NO se cancela por expiración para permitir resolución humana.
        """
        old_time = timezone.now() - timedelta(hours=72)
        order = Order.objects.create(
            user=self.user,
            email=self.user.email,
            shipping_address="Calle Revision 789",
            status=OrderStatus.PENDING,
            total=Decimal("20000"),
            stock_deductions={str(self.product.pk): 1},
        )
        Order.objects.filter(pk=order.pk).update(created_at=old_time)

        # Pago asociado en revisión
        Payment.objects.create(
            order=order,
            provider=PaymentProvider.MERCADOPAGO_CL,
            status=PaymentStatus.IN_REVIEW,
            amount=Decimal("20000"),
            currency="CLP",
        )

        count = expire_stale_pending_orders(hours=48)
        self.assertEqual(count, 0)

        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.PENDING)

    def test_management_command_invokes_service_cleanly(self):
        """El comando `expire_stale_orders` se ejecuta sin errores."""
        call_command("expire_stale_orders", hours=24, limit=50)
