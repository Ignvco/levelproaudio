# apps/billing/models.py

from django.db import models
from django.conf import settings
from core.models import TimeStampedModel


class BillingConfig(TimeStampedModel):
    """Configuración tributaria del negocio — singleton"""

    class Pais(models.TextChoices):
        CL = "CL", "Chile"
        AR = "AR", "Argentina"

    pais              = models.CharField(
        max_length=2, choices=Pais.choices, default=Pais.CL,
        help_text="Determina qué tipos de documento se emiten y la numeración.",
    )
    razon_social      = models.CharField(max_length=200, default="")
    rut               = models.CharField(
        max_length=20, default="",
        help_text="RUT (Chile) o CUIT (Argentina).",
    )
    giro              = models.CharField(max_length=300, default="")
    direccion         = models.CharField(max_length=500, default="")
    telefono          = models.CharField(max_length=30, blank=True)
    ciudad            = models.CharField(max_length=100, default="Chile")
    email             = models.EmailField(blank=True)
    logo              = models.ImageField(
        upload_to="billing/", blank=True, null=True
    )
    # Numeración de documentos
    ultimo_numero_boleta    = models.PositiveIntegerField(default=0)
    ultimo_numero_factura   = models.PositiveIntegerField(default=0)
    ultimo_numero_factura_a = models.PositiveIntegerField(default=0)
    ultimo_numero_factura_b = models.PositiveIntegerField(default=0)
    ultimo_numero_factura_c = models.PositiveIntegerField(default=0)

    # IVA
    iva_porcentaje    = models.DecimalField(
        max_digits=5, decimal_places=2, default=19,
        help_text="19 para Chile, 21 para Argentina.",
    )
    # Auto-generación
    auto_generar_al_pagar = models.BooleanField(
        default=False,
        help_text="Emitir automáticamente boleta/factura cuando la orden se marca como Pagada.",
    )
    tipo_default = models.CharField(
        max_length=20, default="boleta",
        help_text="Tipo de documento a emitir por defecto (boleta, factura, factura_c, etc).",
    )

    class Meta:
        verbose_name = "Configuración de Facturación"

    def __str__(self):
        return f"Config facturación — {self.razon_social}"

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj

    def siguiente_numero(self, tipo: str) -> tuple[int, str]:
        """
        Devuelve (numero, folio) para un tipo de documento.
        Numeración por país + tipo, con prefijos claros.
        """
        prefix_map = {
            "boleta":       ("B",  "ultimo_numero_boleta"),
            "factura":      ("F",  "ultimo_numero_factura"),
            "factura_a":    ("FA", "ultimo_numero_factura_a"),
            "factura_b":    ("FB", "ultimo_numero_factura_b"),
            "factura_c":    ("FC", "ultimo_numero_factura_c"),
        }
        prefix, field = prefix_map.get(tipo, ("B", "ultimo_numero_boleta"))
        n = getattr(self, field) + 1
        setattr(self, field, n)
        self.save(update_fields=[field])
        return n, f"{prefix}-{n:06d}"

    # Compatibilidad hacia atrás
    def siguiente_numero_boleta(self):
        n, _ = self.siguiente_numero("boleta")
        return n

    def siguiente_numero_factura(self):
        n, _ = self.siguiente_numero("factura")
        return n


class TributaryDocument(TimeStampedModel):
    """Documento tributario generado para una orden"""

    class TipoDocumento(models.TextChoices):
        BOLETA       = "boleta",       "Boleta (CL)"
        FACTURA      = "factura",      "Factura (CL)"
        FACTURA_A    = "factura_a",    "Factura A (AR)"
        FACTURA_B    = "factura_b",    "Factura B (AR)"
        FACTURA_C    = "factura_c",    "Factura C (AR)"
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