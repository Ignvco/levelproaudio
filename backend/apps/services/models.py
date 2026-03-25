# apps/services/models.py

from django.db import models
from django.utils import timezone          # ← agrega este import
from django.conf import settings
from core.models import TimeStampedModel


class ServiceCategory(TimeStampedModel):

    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)

    # Defaults para las filas existentes en la BD
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.name


class Service(TimeStampedModel):

    name = models.CharField(max_length=300)

    slug = models.SlugField(unique=True)

    category = models.ForeignKey(
        ServiceCategory,
        on_delete=models.SET_NULL,
        null=True,
        related_name="services"
    )

    description = models.TextField()

    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )

    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Booking(TimeStampedModel):

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )

    service = models.ForeignKey(
        Service,
        on_delete=models.CASCADE
    )

    scheduled_date = models.DateTimeField()

    notes = models.TextField(blank=True)

    status = models.CharField(
        max_length=20,
        choices=[
            ("pending", "Pendiente"),
            ("confirmed", "Confirmado"),
            ("completed", "Completado"),
            ("cancelled", "Cancelado"),
        ],
        default="pending"
    )


class ServiceRequest(TimeStampedModel):

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )

    service = models.ForeignKey(
        Service,
        on_delete=models.SET_NULL,
        null=True
    )

    message = models.TextField()

    budget = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )

    status = models.CharField(
        max_length=20,
        choices=[
            ("pending", "Pendiente"),
            ("contacted", "Contactado"),
            ("accepted", "Aceptado"),
            ("rejected", "Rechazado"),
        ],
        default="pending"
    )