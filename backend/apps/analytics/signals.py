# apps/analytics/signals.py

from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender="orders.Order")
def create_income_on_order_paid(sender, instance, **kwargs):
    """
    Crea IncomeRecord automáticamente cuando una Order se marca como pagada.
    Escucha Order (no Payment) porque en pruebas el pago se aprueba
    cambiando el estado de la orden directamente desde el admin.
    """
    from apps.analytics.models import IncomeRecord
    from decimal import Decimal

    # Solo órdenes pagadas/enviadas/completadas
    if instance.status not in ["paid", "shipped", "completed"]:
        return

    # Evita duplicar si ya existe un IncomeRecord para esta orden
    if IncomeRecord.objects.filter(order=instance).exists():
        return

    # Necesita monto mayor a 0
    if not instance.total or instance.total <= 0:
        return

    record = IncomeRecord.objects.create(
        order       = instance,
        payment     = instance.payments.filter(
            status="approved"
        ).first(),  # puede ser None si fue simulado
        amount      = Decimal(str(instance.total)),
        description = f"Venta — Orden #{str(instance.id)[:8].upper()}",
        source      = "payment",
    )
    record.create_distributions()


@receiver(post_save, sender="payments.Payment")
def create_income_on_payment_approved(sender, instance, **kwargs):
    """
    También escucha Payment por si el webhook real aprueba el pago.
    Evita duplicar si ya existe por la orden.
    """
    from apps.analytics.models import IncomeRecord
    from decimal import Decimal

    if instance.status != "approved":
        return

    # Si ya existe por la orden, no duplicar
    if IncomeRecord.objects.filter(order=instance.order).exists():
        return

    record = IncomeRecord.objects.create(
        payment     = instance,
        order       = instance.order,
        amount      = Decimal(str(instance.amount)),
        description = f"Pago aprobado — Orden #{str(instance.order.id)[:8].upper()}",
        source      = "payment",
    )
    record.create_distributions()