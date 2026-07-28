"""
apps/billing/signals.py — auto-emisión de documento al pagar.
"""
from decimal import Decimal
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.files.base import ContentFile


@receiver(post_save, sender="orders.Order")
def auto_generate_document_on_paid(sender, instance, **kwargs):
    """
    Cuando una orden se marca como Pagada, si la config lo tiene activado,
    genera automáticamente el documento tributario configurado por defecto.
    Idempotente: no genera si ya existe.
    """
    if instance.status not in ("paid", "shipped", "completed"):
        return

    # Import diferido para evitar ciclos
    from .models import BillingConfig, TributaryDocument
    from .pdf_generator import generate_document_pdf

    if hasattr(instance, "tributary_document"):
        return

    config = BillingConfig.get()
    if not config.auto_generar_al_pagar:
        return

    tipo = config.tipo_default or "boleta"
    iva_pct = float(config.iva_porcentaje) / 100

    total = float(instance.total)
    iva   = round(total - total / (1 + iva_pct), 0)
    neto  = total - iva

    numero, folio = config.siguiente_numero(tipo)

    doc = TributaryDocument.objects.create(
        order              = instance,
        tipo               = tipo,
        numero             = numero,
        folio              = folio,
        receptor_email     = instance.email,
        receptor_direccion = instance.shipping_address or "",
        receptor_nombre    = (
            f"{instance.user.first_name} {instance.user.last_name}".strip()
            if instance.user else ""
        ),
        neto               = Decimal(str(neto)),
        iva                = Decimal(str(iva)),
        total              = Decimal(str(total)),
        notas              = "Emitido automáticamente al confirmar el pago.",
    )

    try:
        pdf_bytes = generate_document_pdf(doc)
        doc.pdf_file.save(f"{folio}.pdf", ContentFile(pdf_bytes), save=True)
    except Exception:
        # Si el PDF falla, dejamos el doc creado sin PDF (se puede regenerar bajo demanda)
        pass
