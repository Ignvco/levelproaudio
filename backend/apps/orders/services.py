# apps/orders/services.py

from django.db import transaction
from apps.orders.models import Cart, Order, OrderItem
from .inventory import InventoryError, prepare_inventory, deduct_inventory
from apps.orders.models import OrderStatus


def create_order_from_cart(cart, user, email, shipping_address):
    """
    Convierte un carrito en una orden.
    """

    with transaction.atomic():
        cart = Cart.objects.select_for_update().get(pk=cart.pk, user=user)
        if not cart.is_active:
            raise InventoryError("El carrito ya fue procesado.")
        lines, demand = prepare_inventory([
            {"product": str(item.product_id), "quantity": item.quantity}
            for item in cart.items.all()
        ])

        order = Order.objects.create(
            user=user,
            email=email,
            shipping_address=shipping_address,
            status=OrderStatus.PENDING,
            total=sum(line["product"].price * line["quantity"] for line in lines),
            stock_deductions={str(pk): quantity for pk, quantity in demand.items()},
        )

        for item in lines:

            OrderItem.objects.create(
                order=order,
                product=item["product"],
                product_name=item["product"].name,
                price=item["product"].price,
                quantity=item["quantity"]
            )

        deduct_inventory(demand)
        cart.is_active = False
        cart.save()

        return order
