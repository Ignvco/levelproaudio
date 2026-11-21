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
            {
                "product": str(item.product_id),
                "variant": str(item.variant_id) if item.variant_id else None,
                "quantity": item.quantity,
            }
            for item in cart.items.all()
        ])

        def _line_price(line):
            v = line.get("variant")
            return v.effective_price if v is not None else line["product"].price

        order = Order.objects.create(
            user=user,
            email=email,
            shipping_address=shipping_address,
            status=OrderStatus.PENDING,
            total=sum(_line_price(line) * line["quantity"] for line in lines),
            stock_deductions={str(pk): quantity for pk, quantity in demand.items()},
        )

        for item in lines:
            variant = item.get("variant")
            OrderItem.objects.create(
                order=order,
                product=item["product"],
                variant=variant,
                product_name=item["product"].name,
                variant_name=variant.name if variant else "",
                variant_sku=variant.sku if variant else "",
                price=_line_price(item),
                quantity=item["quantity"],
            )

        deduct_inventory(demand)
        cart.is_active = False
        cart.save()

        return order


def expire_stale_pending_orders(hours=48, max_orders=100):
    """
    Cancela automáticamente pedidos pendientes que superaron la ventana de pago
    sin recibir confirmación ni encontrarse en revisión, liberando el stock reservado.
    """
    from datetime import timedelta
    from django.utils import timezone
    from apps.payments.models import PaymentStatus

    cutoff = timezone.now() - timedelta(hours=hours)
    stale_orders = (
        Order.objects.filter(status=OrderStatus.PENDING, created_at__lt=cutoff)
        .exclude(
            payments__status__in=[PaymentStatus.APPROVED, PaymentStatus.IN_REVIEW]
        )
        .order_by("created_at")[:max_orders]
    )

    expired_count = 0
    for order in stale_orders:
        with transaction.atomic():
            locked = Order.objects.select_for_update().get(pk=order.pk)
            if locked.status != OrderStatus.PENDING:
                continue
            if locked.payments.filter(
                status__in=[PaymentStatus.APPROVED, PaymentStatus.IN_REVIEW]
            ).exists():
                continue
            locked.status = OrderStatus.CANCELLED
            note = f"Cancelación automática por vencimiento ({hours}h sin pago)."
            locked.notes = f"{locked.notes}\n{note}".strip() if locked.notes else note
            locked.save(update_fields=["status", "notes", "updated_at"])
            expired_count += 1

    return expired_count
