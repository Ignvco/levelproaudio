# apps/payments/signals.py

import logging
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

logger = logging.getLogger("levelpro.audit")


@receiver(post_save, sender=Payment)
def update_order_status(sender, instance, **kwargs):
    """Cuando un pago es aprobado, reconcilia el estado del pedido a través de los contratos de negocio."""
    if instance.status == "approved":
        from core.contracts.reconciliation import PaymentReconciliationContractService

        try:
            result = PaymentReconciliationContractService.reconcile_payment(instance.order, instance)
        except Exception as exc:
            logger.critical(
                "AUDIT_ALERT_CRITICAL: Falló conciliación de pago para Orden #%s (Payment #%s): %s",
                instance.order_id,
                instance.id,
                exc,
                extra={
                    "order_id": str(instance.order_id),
                    "payment_id": str(instance.id),
                    "signal": "update_order_status",
                },
                exc_info=True,
            )
            return

        if result and result.is_fully_paid:
            try:
                record_audit_event(
                    module="orders",
                    action="ORDER_STATUS_CHANGED",
                    event_category=CATEGORY_ORDER_STATUS,
                    resource_type="Order",
                    resource_id=str(instance.order_id),
                    resource_repr=f"Orden #{instance.order_id}",
                    actor_type=ACTOR_SYSTEM,
                    previous_values={"status": "pending"},
                    new_values={"status": "paid"},
                    changed_fields=["status"],
                    source=SOURCE_SYSTEM_SIGNAL,
                    severity=SEVERITY_INFO,
                    mandatory=False,
                )
            except Exception as exc:
                # Evento Clase 2 (señal asíncrona de pago): Alerta crítica de seguridad
                # Nunca silenciar con pass; garantiza trazabilidad y monitoreo operacional
                logger.critical(
                    "AUDIT_ALERT_CRITICAL: Falló registro de auditoría en señal de pago para Orden #%s (Payment #%s): %s",
                    instance.order_id,
                    instance.id,
                    exc,
                    extra={
                        "order_id": str(instance.order_id),
                        "payment_id": str(instance.id),
                        "signal": "update_order_status",
                    },
                    exc_info=True,
                )
