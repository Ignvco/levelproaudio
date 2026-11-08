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
        "currency":       d.order.currency,
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
    Soporta paginación (?page=1&page_size=50) y filtros por ?currency=, ?doc_estado=, ?tipo=, ?status=.
    """
    if not _is_admin(request.user):
        return Response(status=403)

    from apps.orders.models import Order

    qs = (
        Order.objects.filter(status__in=["paid", "shipped", "completed"])
        .select_related("user")
        .prefetch_related("tributary_document")
        .order_by("-created_at")
    )

    currency = request.query_params.get("currency")
    if currency and currency.upper() in ("CLP", "USD", "ARS"):
        qs = qs.filter(currency=currency.upper())

    order_status = request.query_params.get("status")
    if order_status:
        qs = qs.filter(status=order_status)

    doc_estado = request.query_params.get("doc_estado")
    if doc_estado:
        if doc_estado == "sin_documento":
            qs = qs.filter(tributary_document__isnull=True)
        else:
            qs = qs.filter(tributary_document__estado=doc_estado)

    doc_tipo = request.query_params.get("tipo")
    if doc_tipo:
        qs = qs.filter(tributary_document__tipo=doc_tipo)

    total_count = qs.count()

    page_param = request.query_params.get("page")
    if page_param is not None:
        try:
            page = max(1, int(page_param))
        except (ValueError, TypeError):
            page = 1
        try:
            page_size = int(request.query_params.get("page_size", 50))
            page_size = max(1, min(page_size, 200))
        except (ValueError, TypeError):
            page_size = 50

        total_pages = max(1, (total_count + page_size - 1) // page_size)
        start = (page - 1) * page_size
        end = start + page_size
        orders = qs[start:end]
        paginated = True
    else:
        page = 1
        page_size = 200
        total_pages = max(1, (total_count + page_size - 1) // page_size)
        orders = qs[:200]
        paginated = False

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
            "currency":     o.currency,
            "pago_estado":  o.status,
            "documento":    _serialize(doc) if doc else None,
        })
    response_data = {
        "results": rows,
        "count": total_count,
    }
    if paginated:
        response_data.update({
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        })
    return Response(response_data)


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
                m = Decimal(str(raw))
                if m < 0:
                    return Response({"error": "El monto no puede ser negativo."}, status=400)
                doc.monto = m
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
