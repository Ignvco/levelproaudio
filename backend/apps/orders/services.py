# apps/orders/services.py

from django.db import transaction
from apps.orders.models import Order, OrderItem
from apps.payments.models import Payment
from apps.orders.models import OrderStatus
from apps.payments.models import PaymentMethod


def create_order_from_cart(cart, user, email, shipping_address):
    """
    Convierte un carrito en una orden.
    """

    with transaction.atomic():

        order = Order.objects.create(
            user=user,
            email=email,
            shipping_address=shipping_address,
            status=OrderStatus.PENDING,
            total=cart.total
        )

        for item in cart.items.all():

            OrderItem.objects.create(
                order=order,
                product=item.product,
                product_name=item.product.name,
                price=item.product.price,
                quantity=item.quantity
            )

        cart.is_active = False
        cart.save()

        return order