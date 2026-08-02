# apps/loyalty/signals.py

from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender="orders.Order")
def award_points_on_purchase(sender, instance, **kwargs):
    """
    Otorga puntos cuando una orden se marca como pagada.
    """
    if instance.status not in ["paid", "shipped", "completed"]:
        return

    if not instance.user:
        return

    from apps.loyalty.models import LoyaltyAccount, LoyaltyConfig, LoyaltyTransaction

    # Evitar dar puntos dos veces por la misma orden
    if LoyaltyTransaction.objects.filter(orden=instance, tipo="earn").exists():
        return

    config = LoyaltyConfig.get()
    if not config.is_active:
        return

    # Calcular puntos: total × puntos_por_peso
    puntos = int(float(instance.total) * float(config.puntos_por_peso))
    if puntos <= 0:
        return

    account, _ = LoyaltyAccount.objects.get_or_create(user=instance.user)
    account.agregar_puntos(
        puntos      = puntos,
        descripcion = f"Compra — Orden #{str(instance.id)[:8].upper()}",
        orden       = instance,
    )


@receiver(post_save, sender="orders.Order")
def reverse_points_on_cancellation(sender, instance, **kwargs):
    """
    Si una orden que ya había dado puntos se cancela, le quita esos puntos
    al cliente. Antes esto no pasaba: comprar, ganar puntos, cancelar/
    devolver, y quedarse con los puntos igual.

    Idempotente: solo revierte si todavía no hay una transacción de
    reversión para esta orden.
    """
    if instance.status != "cancelled":
        return
    if not instance.user:
        return

    from apps.loyalty.models import LoyaltyAccount, LoyaltyTransaction

    earn_tx = LoyaltyTransaction.objects.filter(orden=instance, tipo="earn").first()
    if not earn_tx:
        return  # esta orden nunca dio puntos (ej. se canceló antes de pagar)

    ya_revertido = LoyaltyTransaction.objects.filter(
        orden=instance, tipo="adjust", puntos__lt=0,
    ).exists()
    if ya_revertido:
        return

    try:
        account = LoyaltyAccount.objects.get(user=instance.user)
    except LoyaltyAccount.DoesNotExist:
        return

    account.revertir_puntos(
        earn_tx.puntos,
        descripcion=f"Reversión por cancelación — Orden #{str(instance.id)[:8].upper()}",
        orden=instance,
    )