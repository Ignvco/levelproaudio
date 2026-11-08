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

    # Puntos por peso son CLP; acreditar importes USD/ARS como pesos daría
    # valores matemáticamente falsos. Requiere una política FX explícita
    # y tasa histórica por orden; nunca convertir silenciosamente.
    if instance.currency != "CLP":
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
    Si una orden se cancela:
    1. Si ya había otorgado puntos (earn_tx), se los quita al cliente.
    2. Si el cliente había canjeado puntos en ella (redeem_tx), se le devuelven.

    Idempotente: verifica que no existan ajustes previos para esta orden.
    """
    if instance.status != "cancelled":
        return
    if not instance.user:
        return

    from apps.loyalty.models import LoyaltyAccount, LoyaltyTransaction

    # 1. Revertir puntos ganados
    earn_tx = LoyaltyTransaction.objects.filter(orden=instance, tipo="earn").first()
    if earn_tx:
        ya_revertido = LoyaltyTransaction.objects.filter(
            orden=instance, tipo="adjust", puntos__lt=0,
        ).exists()
        if not ya_revertido:
            try:
                account = LoyaltyAccount.objects.get(user=instance.user)
                account.revertir_puntos(
                    earn_tx.puntos,
                    descripcion=f"Reversión por cancelación — Orden #{str(instance.id)[:8].upper()}",
                    orden=instance,
                )
            except LoyaltyAccount.DoesNotExist:
                pass

    # 2. Devolver puntos canjeados
    redeem_tx = LoyaltyTransaction.objects.filter(orden=instance, tipo="redeem").first()
    if redeem_tx:
        ya_devuelto = LoyaltyTransaction.objects.filter(
            orden=instance, tipo="adjust", puntos__gt=0,
        ).exists()
        if not ya_devuelto:
            try:
                account = LoyaltyAccount.objects.get(user=instance.user)
                account.reembolsar_puntos_canjeados(
                    abs(redeem_tx.puntos),
                    descripcion=f"Devolución de puntos por cancelación — Orden #{str(instance.id)[:8].upper()}",
                    orden=instance,
                )
            except LoyaltyAccount.DoesNotExist:
                pass
