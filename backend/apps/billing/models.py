# apps/billing/models.py
#
# DOCUMENTACIÓN TRIBUTARIA — registro/seguimiento, NO facturador.
#
# Cambio de arquitectura (decisión del negocio): LevelPro dejó de ser un
# facturador propio. Ya NO genera XML DTE, ni folios correlativos, ni PDFs
# con formato oficial, ni emite nada al SII. La emisión real se hace por
# fuera, en el portal del SII (o, a futuro, vía un proveedor DTE).
#
# Este módulo ahora es SOLO un registro interno del admin: qué documento
# se emitió (número real del SII), cuándo, de qué tipo, y en qué estado
# está la gestión. El cliente NO ve esto — solo ve el estado del PAGO,
# que vive en apps/payments y apps/orders.

from django.db import models
from core.models import TimeStampedModel


class TributaryDocument(TimeStampedModel):
    """
    Registro de un documento tributario gestionado EXTERNAMENTE (SII).
    No genera nada — solo deja constancia de lo que el admin emitió por
    fuera, para trazabilidad interna.
    """

    class TipoDocumento(models.TextChoices):
        BOLETA       = "boleta",       "Boleta"
        FACTURA      = "factura",      "Factura"
        NOTA_CREDITO = "nota_credito", "Nota de Crédito"
        NINGUNO      = "ninguno",      "Sin documento"

    class Estado(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente de emitir en SII"
        EMITIDO   = "emitido",   "Emitido en SII"
        NO_APLICA = "no_aplica", "No aplica"

    order = models.OneToOneField(
        "orders.Order", on_delete=models.CASCADE,
        related_name="tributary_document",
    )
    tipo = models.CharField(
        max_length=20, choices=TipoDocumento.choices,
        default=TipoDocumento.NINGUNO,
        verbose_name="Tipo de documento",
    )
    # El número REAL del documento en el SII — texto libre, NO un
    # correlativo propio. Puede quedar vacío mientras está pendiente.
    numero_externo = models.CharField(
        max_length=60, blank=True,
        verbose_name="N° de documento (SII)",
        help_text="El número real del documento emitido en el SII.",
    )
    fecha_emision = models.DateField(
        null=True, blank=True,
        verbose_name="Fecha de emisión",
        help_text="Cuándo se emitió el documento en el SII.",
    )
    monto = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text="Monto del documento (informativo).",
    )
    estado = models.CharField(
        max_length=20, choices=Estado.choices,
        default=Estado.PENDIENTE,
    )
    observaciones = models.TextField(blank=True)
    # PDF opcional: el documento REAL del SII, subido a mano por el admin.
    pdf_externo = models.FileField(
        upload_to="billing/externos/", blank=True, null=True,
        verbose_name="PDF del documento (opcional)",
    )

    class Meta:
        verbose_name = "Documento Tributario"
        verbose_name_plural = "Documentos Tributarios"
        ordering = ["-created_at"]

    def __str__(self):
        ref = self.numero_externo or "sin número"
        return f"{self.get_tipo_display()} {ref} — orden {str(self.order_id)[:8]}"
