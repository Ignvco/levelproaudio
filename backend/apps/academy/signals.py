# apps/academy/signals.py
# Signals relacionados con cursos

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.orders.models import Order
from .models import Enrollment


@receiver(post_save, sender=Order)
def enroll_user_in_course(sender, instance, **kwargs):
    """
    Inscribe automáticamente al usuario en el curso
    cuando el pedido se marca como pagado.
    """

    if instance.status == "paid":

        for item in instance.items.all():

            product = item.product

            if hasattr(product, "course"):
                Enrollment.objects.get_or_create(
                    user=instance.user,
                    course=product.course
                )