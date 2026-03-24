# apps/payments/models.py

from django.db import models
from core.models import TimeStampedModel
from apps.orders.models import Order


class PaymentMethod(models.TextChoices):
    MERCADOPAGO = "mercadopago", "MercadoPago"
    TRANSBANK = "transbank", "Transbank"
    FLOW = "flow", "Flow"
    TRANSFER = "transfer", "Transferencia bancaria"
    CASH = "cash", "Pago manual"


class PaymentStatus(models.TextChoices):
    PENDING = "pending", "Pendiente"
    APPROVED = "approved", "Aprobado"
    REJECTED = "rejected", "Rechazado"
    CANCELLED = "cancelled", "Cancelado"
    REFUNDED = "refunded", "Reembolsado"


class Payment(TimeStampedModel):
    """
    Registro de pagos asociados a una orden.
    Permite integrar múltiples proveedores de pago.
    """

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="payments"
    )

    method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices
    )

    status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    currency = models.CharField(
        max_length=10,
        default="CLP"
    )

    transaction_id = models.CharField(
        max_length=255,
        blank=True,
        help_text="ID de la transacción del proveedor de pago"
    )

    provider_reference = models.CharField(
        max_length=255,
        blank=True,
        help_text="Referencia adicional del proveedor"
    )

    payment_url = models.URLField(
        blank=True,
        help_text="URL de pago (ej: checkout MercadoPago)"
    )

    paid_at = models.DateTimeField(
        null=True,
        blank=True
    )

    raw_response = models.JSONField(
        null=True,
        blank=True,
        help_text="Respuesta completa del proveedor de pago"
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Payment {self.id} - {self.method} - {self.status}"