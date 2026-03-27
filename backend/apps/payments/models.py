# apps/payments/models.py

from django.db import models
from core.models import TimeStampedModel
from apps.orders.models import Order


class PaymentProvider(models.TextChoices):
    MERCADOPAGO_CL = "mercadopago_cl", "MercadoPago Chile"
    MERCADOPAGO_AR = "mercadopago_ar", "MercadoPago Argentina"
    PAYPAL         = "paypal",         "PayPal"
    GLOBAL66       = "global66",       "Transferencia Global66"
    TRANSFER       = "transfer",       "Transferencia bancaria"
    CASH           = "cash",           "Pago manual"


class PaymentStatus(models.TextChoices):
    PENDING   = "pending",   "Pendiente"
    APPROVED  = "approved",  "Aprobado"
    REJECTED  = "rejected",  "Rechazado"
    CANCELLED = "cancelled", "Cancelado"
    REFUNDED  = "refunded",  "Reembolsado"
    IN_REVIEW = "in_review", "En revisión"


class Payment(TimeStampedModel):

    order    = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="payments"
    )
    provider = models.CharField(
        max_length=30,
        choices=PaymentProvider.choices
    )
    status   = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING
    )
    amount   = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default="CLP")

    # IDs externos del proveedor
    external_id        = models.CharField(max_length=255, blank=True)
    preference_id      = models.CharField(
        max_length=255, blank=True,
        help_text="ID de preferencia MP o PayPal order ID"
    )
    provider_reference = models.CharField(max_length=255, blank=True)

    # URLs
    payment_url = models.URLField(
        blank=True,
        help_text="URL de checkout del proveedor"
    )

    # Fechas
    paid_at = models.DateTimeField(null=True, blank=True)

    # Respuesta cruda del proveedor (para debugging)
    raw_response = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Pago"
        verbose_name_plural = "Pagos"

    def __str__(self):
        return f"Payment {self.id} — {self.provider} — {self.status}"

    @property
    def is_approved(self):
        return self.status == PaymentStatus.APPROVED