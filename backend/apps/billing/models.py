# apps/billing/models.py

from django.db import models
from django.conf import settings
from core.models import TimeStampedModel


class BillingConfig(TimeStampedModel):
    """Configuración tributaria del negocio — singleton"""
    razon_social      = models.CharField(max_length=200, default="")
    rut               = models.CharField(max_length=12, default="")
    giro              = models.CharField(max_length=200, default="")
    direccion         = models.CharField(max_length=300, default="")
    ciudad            = models.CharField(max_length=100, default="Chile")
    telefono          = models.CharField(max_length=20, blank=True)
    email             = models.EmailField(blank=True)
    logo              = models.ImageField(
        upload_to="billing/", blank=True, null=True
    )
    # Numeración de documentos
    ultimo_numero_boleta  = models.PositiveIntegerField(default=0)
    ultimo_numero_factura = models.PositiveIntegerField(default=0)
    # IVA
    iva_porcentaje    = models.DecimalField(
        max_digits=5, decimal_places=2, default=19
    )

    class Meta:
        verbose_name = "Configuración de Facturación"

    def __str__(self):
        return f"Config facturación — {self.razon_social}"

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj

    def siguiente_numero_boleta(self):
        self.ultimo_numero_boleta += 1
        self.save(update_fields=["ultimo_numero_boleta"])
        return self.ultimo_numero_boleta

    def siguiente_numero_factura(self):
        self.ultimo_numero_factura += 1
        self.save(update_fields=["ultimo_numero_factura"])
        return self.ultimo_numero_factura


class TributaryDocument(TimeStampedModel):
    """Documento tributario generado para una orden"""

    class TipoDocumento(models.TextChoices):
        BOLETA   = "boleta",   "Boleta"
        FACTURA  = "factura",  "Factura"
        NOTA_CREDITO = "nota_credito", "Nota de Crédito"

    class Estado(models.TextChoices):
        EMITIDO   = "emitido",   "Emitido"
        ANULADO   = "anulado",   "Anulado"
        ENVIADO   = "enviado",   "Enviado por email"

    order           = models.OneToOneField(
        "orders.Order", on_delete=models.CASCADE,
        related_name="tributary_document"
    )
    tipo            = models.CharField(
        max_length=20,
        choices=TipoDocumento.choices,
        default=TipoDocumento.BOLETA
    )
    numero          = models.PositiveIntegerField()
    folio           = models.CharField(max_length=20)

    # Datos del receptor (comprador)
    receptor_nombre = models.CharField(max_length=200, blank=True)
    receptor_rut    = models.CharField(max_length=12, blank=True)
    receptor_email  = models.EmailField(blank=True)
    receptor_giro   = models.CharField(max_length=200, blank=True)
    receptor_direccion = models.CharField(max_length=300, blank=True)

    # Montos
    neto            = models.DecimalField(max_digits=12, decimal_places=2)
    iva             = models.DecimalField(max_digits=12, decimal_places=2)
    total           = models.DecimalField(max_digits=12, decimal_places=2)

    estado          = models.CharField(
        max_length=20,
        choices=Estado.choices,
        default=Estado.EMITIDO
    )
    pdf_file        = models.FileField(
        upload_to="billing/pdfs/", blank=True, null=True
    )
    enviado_at      = models.DateTimeField(null=True, blank=True)
    notas           = models.TextField(blank=True)

    class Meta:
        verbose_name = "Documento Tributario"
        verbose_name_plural = "Documentos Tributarios"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_tipo_display()} N°{self.folio} — {self.order.email}"