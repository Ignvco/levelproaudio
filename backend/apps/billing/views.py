# apps/billing/views.py

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from django.core.files.base import ContentFile
from decimal import Decimal
from .models import BillingConfig, TributaryDocument


def get_is_admin(user):
    return user.is_staff or user.is_superuser


# ── Generar documento ─────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate_document(request):
    """POST /api/v1/billing/generate/"""
    if not get_is_admin(request.user):
        return Response({"error": "Sin permisos"}, status=403)

    from apps.orders.models import Order
    order_id = request.data.get("order_id")
    tipo     = request.data.get("tipo", "boleta")  # boleta | factura

    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        return Response({"error": "Orden no encontrada"}, status=404)

    # No generar duplicado
    if hasattr(order, "tributary_document"):
        return Response({
            "error": "Esta orden ya tiene un documento generado.",
            "document_id": str(order.tributary_document.id),
        }, status=400)

    config = BillingConfig.get()
    iva_pct = float(config.iva_porcentaje) / 100

    # Calcular montos
    total = float(order.total)
    iva   = round(total - total / (1 + iva_pct), 0)
    neto  = total - iva

    # Número de folio
    if tipo == "factura":
        numero = config.siguiente_numero_factura()
        folio  = f"F-{numero:06d}"
    else:
        numero = config.siguiente_numero_boleta()
        folio  = f"B-{numero:06d}"

    # Crear el documento
    doc = TributaryDocument.objects.create(
        order              = order,
        tipo               = tipo,
        numero             = numero,
        folio              = folio,
        receptor_email     = order.email,
        receptor_direccion = order.shipping_address or "",
        receptor_nombre    = request.data.get("receptor_nombre", ""),
        receptor_rut       = request.data.get("receptor_rut", ""),
        receptor_giro      = request.data.get("receptor_giro", ""),
        neto               = Decimal(str(neto)),
        iva                = Decimal(str(iva)),
        total              = Decimal(str(total)),
        notas              = request.data.get("notas", ""),
    )

    # Generar PDF
    from .pdf_generator import generate_document_pdf
    pdf_bytes = generate_document_pdf(doc)
    doc.pdf_file.save(
        f"{folio}.pdf",
        ContentFile(pdf_bytes),
        save=True
    )

    return Response({
        "id":     str(doc.id),
        "folio":  doc.folio,
        "tipo":   doc.tipo,
        "total":  float(doc.total),
        "estado": doc.estado,
    }, status=201)


# ── Descargar PDF ─────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_pdf(request, doc_id):
    """GET /api/v1/billing/download/{doc_id}/"""
    try:
        doc = TributaryDocument.objects.get(id=doc_id)
    except TributaryDocument.DoesNotExist:
        return Response({"error": "Documento no encontrado"}, status=404)

    # El cliente solo puede ver sus propios documentos
    if not get_is_admin(request.user):
        if doc.order.user != request.user:
            return Response(status=403)

    # Regenerar si no existe
    if not doc.pdf_file:
        from .pdf_generator import generate_document_pdf
        from django.core.files.base import ContentFile
        pdf_bytes = generate_document_pdf(doc)
        doc.pdf_file.save(f"{doc.folio}.pdf", ContentFile(pdf_bytes), save=True)

    response = HttpResponse(
        doc.pdf_file.read(),
        content_type="application/pdf"
    )
    response["Content-Disposition"] = (
        f'attachment; filename="{doc.folio}.pdf"'
    )
    return response


# ── Enviar por email ──────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_document_email(request, doc_id):
    """POST /api/v1/billing/send/{doc_id}/"""
    if not get_is_admin(request.user):
        return Response(status=403)

    try:
        doc = TributaryDocument.objects.get(id=doc_id)
    except TributaryDocument.DoesNotExist:
        return Response({"error": "Documento no encontrado"}, status=404)

    from django.core.mail import EmailMessage
    from django.conf import settings
    from django.utils import timezone

    try:
        email = EmailMessage(
            subject=f"Tu {doc.get_tipo_display()} N° {doc.folio} — LevelPro Audio",
            body=(
                f"Hola,\n\n"
                f"Adjuntamos tu {doc.get_tipo_display()} N° {doc.folio} "
                f"por un total de ${float(doc.total):,.0f}.\n\n"
                f"Gracias por tu compra.\n\n"
                f"Equipo LevelPro Audio"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[doc.receptor_email or doc.order.email],
        )

        if doc.pdf_file:
            doc.pdf_file.seek(0)
            email.attach(f"{doc.folio}.pdf", doc.pdf_file.read(), "application/pdf")

        email.send()
        doc.estado     = TributaryDocument.Estado.ENVIADO
        doc.enviado_at = timezone.now()
        doc.save(update_fields=["estado", "enviado_at"])

        return Response({"detail": "Documento enviado por email."})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


# ── Listar documentos (admin) ─────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_documents(request):
    """GET /api/v1/billing/documents/"""
    if not get_is_admin(request.user):
        return Response(status=403)

    docs = TributaryDocument.objects.select_related(
        "order"
    ).order_by("-created_at")[:100]

    return Response([{
        "id":             str(d.id),
        "folio":          d.folio,
        "tipo":           d.tipo,
        "tipo_label":     d.get_tipo_display(),
        "orden_id":       str(d.order.id),
        "orden_email":    d.order.email,
        "total":          float(d.total),
        "neto":           float(d.neto),
        "iva":            float(d.iva),
        "estado":         d.estado,
        "estado_label":   d.get_estado_display(),
        "tiene_pdf":      bool(d.pdf_file),
        "enviado_at":     d.enviado_at.strftime("%d/%m/%Y %H:%M") if d.enviado_at else None,
        "created_at":     d.created_at.strftime("%d/%m/%Y %H:%M"),
    } for d in docs])


# ── Anular documento ──────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def void_document(request, doc_id):
    """POST /api/v1/billing/void/{doc_id}/"""
    if not get_is_admin(request.user):
        return Response(status=403)

    try:
        doc = TributaryDocument.objects.get(id=doc_id)
    except TributaryDocument.DoesNotExist:
        return Response({"error": "No encontrado"}, status=404)

    doc.estado = TributaryDocument.Estado.ANULADO
    doc.save(update_fields=["estado"])
    return Response({"detail": "Documento anulado."})


# ── Config de facturación ─────────────────────────────────────

@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def billing_config(request):
    """GET/PATCH /api/v1/billing/config/"""
    if not get_is_admin(request.user):
        return Response(status=403)

    config = BillingConfig.get()

    if request.method == "PATCH":
        fields = [
            "razon_social", "rut", "giro", "direccion",
            "ciudad", "telefono", "email", "iva_porcentaje",
        ]
        for f in fields:
            if f in request.data:
                setattr(config, f, request.data[f])
        config.save()

    return Response({
        "razon_social":           config.razon_social,
        "rut":                    config.rut,
        "giro":                   config.giro,
        "direccion":              config.direccion,
        "ciudad":                 config.ciudad,
        "telefono":               config.telefono,
        "email":                  config.email,
        "iva_porcentaje":         float(config.iva_porcentaje),
        "ultimo_numero_boleta":   config.ultimo_numero_boleta,
        "ultimo_numero_factura":  config.ultimo_numero_factura,
    })