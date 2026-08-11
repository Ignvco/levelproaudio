# apps/billing/views.py
#
# DOCUMENTACIÓN TRIBUTARIA — endpoints de registro/seguimiento (admin).
# Ya no genera documentos ni PDFs ni emite nada. Solo permite al admin
# registrar y consultar lo que se gestionó por fuera en el SII.

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from decimal import Decimal, InvalidOperation

from .models import TributaryDocument


def _is_admin(user):
    return user.is_staff or user.is_superuser


def _serialize(d):
    return {
        "id":             str(d.id),
        "order_id":       str(d.order_id),
        "order_short":    str(d.order_id)[:8].upper(),
        "order_email":    d.order.email,
        "tipo":           d.tipo,
        "tipo_label":     d.get_tipo_display(),
        "numero_externo": d.numero_externo,
        "fecha_emision":  d.fecha_emision.isoformat() if d.fecha_emision else None,
        "monto":          float(d.monto) if d.monto is not None else None,
        "estado":         d.estado,
        "estado_label":   d.get_estado_display(),
        "observaciones":  d.observaciones,
        "tiene_pdf":      bool(d.pdf_externo),
        "created_at":     d.created_at.strftime("%d/%m/%Y %H:%M"),
    }


# ── Tablero: todas las órdenes pagadas + su documento (si existe) ──
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def tax_dashboard(request):
    """
    GET /api/v1/billing/dashboard/
    Devuelve las órdenes pagadas y el registro tributario de cada una
    (o null si todavía no se registró nada). Este es el tablero central
    de seguimiento del admin.
    """
    if not _is_admin(request.user):
        return Response(status=403)

    from apps.orders.models import Order

    orders = (
        Order.objects.filter(status__in=["paid", "shipped", "completed"])
        .select_related("user")
        .prefetch_related("tributary_document")
        .order_by("-created_at")[:200]
    )

    rows = []
    for o in orders:
        doc = getattr(o, "tributary_document", None)
        rows.append({
            "order_id":     str(o.id),
            "order_short":  str(o.id)[:8].upper(),
            "cliente":      (f"{o.user.first_name} {o.user.last_name}".strip()
                             if o.user else "") or o.email,
            "email":        o.email,
            "total":        float(o.total),
            "pago_estado":  o.status,
            "documento":    _serialize(doc) if doc else None,
        })
    return Response({"results": rows})


# ── Registrar / actualizar el documento de una orden ──────────────
@api_view(["POST", "PATCH"])
@permission_classes([IsAuthenticated])
def upsert_document(request):
    """
    POST/PATCH /api/v1/billing/record/
    Registra (o actualiza) el documento tributario de una orden — con el
    número REAL emitido en el SII. No genera nada, solo guarda lo que el
    admin ingresa.
    """
    if not _is_admin(request.user):
        return Response(status=403)

    from apps.orders.models import Order

    order_id = request.data.get("order_id")
    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        return Response({"error": "Orden no encontrada."}, status=404)

    doc, _ = TributaryDocument.objects.get_or_create(order=order)

    if "tipo" in request.data:
        tipo = request.data["tipo"]
        if tipo not in dict(TributaryDocument.TipoDocumento.choices):
            return Response({"error": f'Tipo inválido: "{tipo}".'}, status=400)
        doc.tipo = tipo

    if "estado" in request.data:
        estado = request.data["estado"]
        if estado not in dict(TributaryDocument.Estado.choices):
            return Response({"error": f'Estado inválido: "{estado}".'}, status=400)
        doc.estado = estado

    if "numero_externo" in request.data:
        doc.numero_externo = request.data["numero_externo"] or ""

    if "fecha_emision" in request.data:
        doc.fecha_emision = request.data["fecha_emision"] or None

    if "observaciones" in request.data:
        doc.observaciones = request.data["observaciones"] or ""

    if "monto" in request.data:
        raw = request.data["monto"]
        if raw in (None, ""):
            doc.monto = None
        else:
            try:
                doc.monto = Decimal(str(raw))
            except (InvalidOperation, ValueError):
                return Response({"error": "Monto inválido."}, status=400)

    doc.save()
    return Response(_serialize(doc), status=200)


# ── Subir el PDF real del SII (opcional) ──────────────────────────
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upload_document_pdf(request, doc_id):
    """POST /api/v1/billing/record/<id>/pdf/ — sube el PDF oficial del SII."""
    if not _is_admin(request.user):
        return Response(status=403)

    try:
        doc = TributaryDocument.objects.get(id=doc_id)
    except TributaryDocument.DoesNotExist:
        return Response({"error": "No encontrado."}, status=404)

    pdf = request.FILES.get("pdf")
    if not pdf:
        return Response({"error": "No se envió ningún archivo."}, status=400)

    doc.pdf_externo.save(pdf.name, pdf, save=True)
    return Response(_serialize(doc))
