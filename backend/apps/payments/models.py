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
    PAYONEER       = "payoneer",       "Payoneer (USD)"
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
        verbose_name        = "Pago"
        verbose_name_plural = "Pagos"
        ordering            = ["-created_at"]

    def __str__(self):
        return f"Payment {self.id} — {self.provider} — {self.status}"

    @property
    def is_approved(self):
        return self.status == PaymentStatus.APPROVED

class PaymentMethodConfig(TimeStampedModel):
    """
    Configuración de un método de pago, editable desde el admin. Permite
    activar/desactivar métodos y, para transferencias, cargar los datos
    de la(s) cuenta(s) — sin tocar código.

    Cada método es un "proveedor enchufable": transferencia hoy, dLocal y
    Payoneer cuando estén confirmados. El checkout lee de acá qué mostrar.
    """
    class Method(models.TextChoices):
        TRANSFER   = "transfer",    "Transferencia bancaria"
        DLOCAL     = "dlocal",      "dLocal Go"
        PAYONEER   = "payoneer",    "Payoneer (USD)"
        MERCADOPAGO_CL = "mercadopago_cl", "MercadoPago Chile"
        MERCADOPAGO_AR = "mercadopago_ar", "MercadoPago Argentina"
        PAYPAL     = "paypal",      "PayPal"

    method   = models.CharField(max_length=30, choices=Method.choices, unique=True)
    is_active = models.BooleanField(default=False, verbose_name="Activo en el checkout")
    label    = models.CharField(
        max_length=80, blank=True,
        help_text="Nombre visible en el checkout. Si se deja vacío, usa el nombre por defecto.",
    )
    description = models.CharField(
        max_length=160, blank=True,
        help_text="Texto corto bajo el nombre (ej: 'Tarjetas, Khipu, efectivo').",
    )
    # Monedas en las que se ofrece este método (ej: transferencia CLP;
    # Payoneer USD). Si está vacío, se ofrece en cualquier moneda.
    currencies = models.CharField(
        max_length=60, blank=True, default="",
        help_text="Monedas separadas por coma (ej: CLP,USD). Vacío = todas.",
    )
    order    = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "method"]
        verbose_name = "Método de pago"
        verbose_name_plural = "Métodos de pago"

    def __str__(self):
        return f"{self.get_method_display()} ({'activo' if self.is_active else 'inactivo'})"

    def currency_list(self):
        return [c.strip().upper() for c in self.currencies.split(",") if c.strip()]

    def available_for_currency(self, currency):
        cl = self.currency_list()
        return not cl or (currency or "").upper() in cl


class BankAccount(TimeStampedModel):
    """
    Una cuenta bancaria para transferencias. El admin puede cargar varias
    (CLP, ARS, distintos bancos) y activarlas/desactivarlas. Se muestran
    en el checkout cuando el cliente elige transferencia.
    """
    label        = models.CharField(
        max_length=80,
        help_text="Nombre para identificarla (ej: 'Cuenta CLP - Banco Estado').",
    )
    currency     = models.CharField(max_length=10, default="CLP")
    bank_name    = models.CharField(max_length=120, verbose_name="Banco")
    account_type = models.CharField(max_length=80, blank=True, verbose_name="Tipo de cuenta")
    account_number = models.CharField(max_length=80, verbose_name="N° de cuenta")
    holder_name  = models.CharField(max_length=160, verbose_name="Titular")
    holder_id    = models.CharField(max_length=40, blank=True, verbose_name="RUT/CUIT del titular")
    email        = models.EmailField(blank=True, help_text="Email para enviar el comprobante (opcional).")
    instructions = models.TextField(blank=True, help_text="Notas o instrucciones extra (opcional).")

    is_active    = models.BooleanField(default=True)
    order        = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "currency"]
        verbose_name = "Cuenta bancaria"
        verbose_name_plural = "Cuentas bancarias (transferencia)"

    def __str__(self):
        return f"{self.label} ({self.currency})"
