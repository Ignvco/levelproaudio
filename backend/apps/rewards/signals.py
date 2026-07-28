"""
apps/rewards/signals.py — hooks a Orders sin modificarlo.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender="orders.Order")
def generate_reward_entries(sender, instance, **kwargs):
    """
    Cuando una orden cambia a estado 'paid', 'shipped' o 'completed',
    generamos las participaciones correspondientes.

    Idempotente vía services.generate_entries_for_order (verifica duplicados).
    """
    if instance.status not in ("paid", "shipped", "completed"):
        return
    if not instance.user_id:
        return

    # Import diferido para evitar ciclos
    from .services import generate_entries_for_order
    generate_entries_for_order(instance)
