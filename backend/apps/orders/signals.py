# apps/orders/signals.py
# Signals relacionados con pedidos y carrito

from django.db.models.signals import post_save
from django.dispatch import receiver

from django.conf import settings
from .models import Cart


User = settings.AUTH_USER_MODEL


@receiver(post_save, sender=User)
def create_user_cart(sender, instance, created, **kwargs):
    """
    Crea automáticamente un carrito cuando se registra un usuario.
    """

    if created:
        Cart.objects.create(user=instance)