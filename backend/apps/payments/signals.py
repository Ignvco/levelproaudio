# apps/payments/signals.py

from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Payment
from apps.orders.models import Order
from core.audit.services import record_audit_event
from core.audit.constants import (
    CATEGORY_ORDER_STATUS,
    SEVERITY_INFO,
    ACTOR_SYSTEM,
    SOURCE_SYSTEM_SIGNAL,
)


@receiver(post_save, sender=Payment)
def update_order_status(sender, instance, **kwargs):
    """Cuando un pago es aprobado, cambia el estado del pedido a pagado."""
    if instance.status == "approved":
        order = instance.order
        if order.status == "pending":
            order.status = "paid"
            order.save(update_fields=["status"])  # ← update_fields evita loops
            try:
                record_audit_event(
                    module="orders",
                    action="ORDER_STATUS_CHANGED",
                    event_category=CATEGORY_ORDER_STATUS,
                    resource_type="Order",
                    resource_id=str(order.id),
                    resource_repr=f"Orden #{order.id}",
                    actor_type=ACTOR_SYSTEM,
                    previous_values={"status": "pending"},
                    new_values={"status": "paid"},
                    changed_fields=["status"],
                    source=SOURCE_SYSTEM_SIGNAL,
                    severity=SEVERITY_INFO,
                )
            except Exception:
                pass
