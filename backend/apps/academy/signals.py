# apps/academy/signals.py

from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.orders.models import Order
from .models import Enrollment


@receiver(post_save, sender=Order)
def enroll_user_in_course(sender, instance, **kwargs):
    """
    Inscribe al usuario en el curso cuando el pedido se marca como pagado.
    """
    if instance.status != "paid":
        return

    for item in instance.items.all():
        product = item.product

        # Método 1 — producto vinculado directamente al curso
        course = None
        if product and hasattr(product, "course") and product.course:
            course = product.course

        # Método 2 — busca curso por nombre como fallback
        if not course:
            try:
                from apps.academy.models import Course
                course = Course.objects.filter(
                    title__iexact=item.product_name.replace("Curso: ", "")
                ).first()
            except Exception:
                pass

        if course and instance.user:
            Enrollment.objects.get_or_create(
                user=instance.user,
                course=course,
            )