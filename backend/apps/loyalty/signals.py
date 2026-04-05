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