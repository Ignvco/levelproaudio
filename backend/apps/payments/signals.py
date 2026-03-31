# apps/payments/signals.py

from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Payment
from apps.orders.models import Order


@receiver(post_save, sender=Payment)
def update_order_status(sender, instance, **kwargs):
    """Cuando un pago es aprobado, cambia el estado del pedido a pagado."""
    if instance.status == "approved":
        order = instance.order
        if order.status != "paid":
            order.status = "paid"
            order.save(update_fields=["status"])  # ← update_fields evita loops