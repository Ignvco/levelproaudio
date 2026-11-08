"""
apps/orders/views_b2b.py — Cotizaciones B2B mayoristas e institucionales (V3.3 Módulo 2).

Endpoints:
- POST /api/v1/orders/b2b/quotes/                 → Solicitud de cotización mayorista (Público/Auth)
- GET  /api/v1/admin/orders/b2b/quotes/           → Listado de cotizaciones B2B (Admin/Staff)
- GET/PATCH /api/v1/admin/orders/b2b/quotes/{id}/ → Detalle y actualización comercial (Admin/Staff)
- POST /api/v1/admin/orders/b2b/quotes/{id}/convert/ → Conversión atómica a Order (Admin/Staff)
"""
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from core.admin_permissions import IsAdminOrStaff
from apps.products.models import Product
from apps.site_settings.models import SiteSettings
from .models import Order, OrderItem, B2BQuote, B2BQuoteItem, B2BQuoteStatus


def _sanitize_tax_id(tax_id_str):
    return (tax_id_str or "").strip().upper().replace(".", "").replace(" ", "")


@api_view(["POST"])
@permission_classes([AllowAny])
@transaction.atomic
def b2b_quote_create(request):
    """
    POST /api/v1/orders/b2b/quotes/
    Crea una solicitud de cotización para empresas, estudios o instituciones.
    """
    data = request.data
    company_name = (data.get("company_name") or "").strip()
    tax_id       = _sanitize_tax_id(data.get("tax_id"))
    contact_name = (data.get("contact_name") or "").strip()
    email        = (data.get("email") or "").strip()
    phone        = (data.get("phone") or "").strip()
    currency     = (data.get("currency") or "CLP").strip().upper()
    items_data   = data.get("items") or []
    client_notes = (data.get("notes") or data.get("client_notes") or "").strip()

    if not company_name or not tax_id or not contact_name or not email:
        return Response(
            {"error": "Razón social, RUT/CUIT, contacto y email son obligatorios."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if currency not in ("CLP", "USD", "ARS"):
        currency = "CLP"

    if not items_data or not isinstance(items_data, list):
        return Response(
            {"error": "Debes incluir al menos un producto en la cotización."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Tasas de cambio configurables para fallback
    site_settings = SiteSettings.objects.first()
    rate_clp = site_settings.usd_to_clp if site_settings else None
    rate_ars = site_settings.usd_to_ars if site_settings else None

    # Validar productos y calcular subtotal
    validated_items = []
    subtotal = Decimal("0.00")

    for raw_item in items_data:
        pid = raw_item.get("product_id") or raw_item.get("product")
        try:
            qty = max(1, int(raw_item.get("quantity", 1)))
        except (ValueError, TypeError):
            qty = 1

        try:
            product = Product.objects.get(id=pid, is_active=True)
        except (Product.DoesNotExist, Exception):
            return Response(
                {"error": f"Producto con ID {pid} no existe o no está activo."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prices = product.prices_by_currency(rate_clp, rate_ars)
        unit_price = prices.get(currency) or product.price
        item_subtotal = Decimal(str(unit_price)) * qty
        subtotal += item_subtotal

        validated_items.append({
            "product": product,
            "product_name": product.name,
            "unit_price": Decimal(str(unit_price)),
            "quantity": qty,
            "subtotal": item_subtotal,
        })

    # IVA referencial según país/moneda (CLP = 19% IVA chileno)
    tax_amount = (subtotal * Decimal("0.19")).quantize(Decimal("0.01")) if currency == "CLP" else Decimal("0.00")
    total = subtotal + tax_amount

    user = request.user if request.user.is_authenticated else None

    quote = B2BQuote.objects.create(
        user=user,
        company_name=company_name,
        tax_id=tax_id,
        contact_name=contact_name,
        email=email,
        phone=phone,
        currency=currency,
        subtotal=subtotal,
        discount_amount=Decimal("0.00"),
        discount_percent=Decimal("0.00"),
        tax_amount=tax_amount,
        total=total,
        status=B2BQuoteStatus.PENDING,
        client_notes=client_notes,
    )

    for vi in validated_items:
        B2BQuoteItem.objects.create(
            quote=quote,
            product=vi["product"],
            product_name=vi["product_name"],
            unit_price=vi["unit_price"],
            quantity=vi["quantity"],
            subtotal=vi["subtotal"],
        )

    return Response({
        "id": str(quote.id),
        "company_name": quote.company_name,
        "tax_id": quote.tax_id,
        "currency": quote.currency,
        "subtotal": float(quote.subtotal),
        "tax_amount": float(quote.tax_amount),
        "total": float(quote.total),
        "status": quote.status,
        "items_count": len(validated_items),
        "created_at": quote.created_at.isoformat(),
    }, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_b2b_quotes(request):
    """
    GET /api/v1/admin/orders/b2b/quotes/
    Listado administrativo de cotizaciones B2B con filtros y búsqueda.
    """
    qs = B2BQuote.objects.all().order_by("-created_at")

    status_filter = request.query_params.get("status")
    if status_filter:
        qs = qs.filter(status=status_filter)

    search = request.query_params.get("search")
    if search:
        qs = qs.filter(
            company_name__icontains=search
        ) | qs.filter(
            tax_id__icontains=search
        ) | qs.filter(
            contact_name__icontains=search
        ) | qs.filter(
            email__icontains=search
        )

    results = []
    for q in qs[:100]:
        results.append({
            "id": str(q.id),
            "company_name": q.company_name,
            "tax_id": q.tax_id,
            "contact_name": q.contact_name,
            "email": q.email,
            "phone": q.phone,
            "currency": q.currency,
            "subtotal": float(q.subtotal),
            "discount_amount": float(q.discount_amount),
            "discount_percent": float(q.discount_percent),
            "tax_amount": float(q.tax_amount),
            "total": float(q.total),
            "status": q.status,
            "items_count": q.items.count(),
            "converted_order_id": str(q.converted_order_id) if q.converted_order_id else None,
            "created_at": q.created_at.strftime("%Y-%m-%d %H:%M"),
        })

    return Response({"results": results, "count": qs.count()})


@api_view(["GET", "PATCH"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_b2b_quote_detail(request, quote_id):
    """
    GET / PATCH /api/v1/admin/orders/b2b/quotes/{id}/
    Detalle y actualización comercial de cotización B2B (descuentos y estados).
    """
    try:
        quote = B2BQuote.objects.prefetch_related("items__product").get(id=quote_id)
    except B2BQuote.DoesNotExist:
        return Response({"error": "Cotización B2B no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response({
            "id": str(quote.id),
            "company_name": quote.company_name,
            "tax_id": quote.tax_id,
            "contact_name": quote.contact_name,
            "email": quote.email,
            "phone": quote.phone,
            "currency": quote.currency,
            "subtotal": float(quote.subtotal),
            "discount_amount": float(quote.discount_amount),
            "discount_percent": float(quote.discount_percent),
            "tax_amount": float(quote.tax_amount),
            "total": float(quote.total),
            "status": quote.status,
            "client_notes": quote.client_notes,
            "admin_notes": quote.admin_notes,
            "converted_order_id": str(quote.converted_order_id) if quote.converted_order_id else None,
            "created_at": quote.created_at.isoformat(),
            "items": [{
                "id": str(it.id),
                "product_id": str(it.product_id) if it.product_id else None,
                "product_name": it.product_name,
                "unit_price": float(it.unit_price),
                "quantity": it.quantity,
                "subtotal": float(it.subtotal),
            } for it in quote.items.all()],
        })

    # PATCH
    data = request.data
    new_status = data.get("status")
    if new_status and new_status in B2BQuoteStatus.values:
        quote.status = new_status

    if "admin_notes" in data:
        quote.admin_notes = data["admin_notes"]

    if "discount_percent" in data:
        try:
            d_pct = max(Decimal("0.00"), min(Decimal("100.00"), Decimal(str(data["discount_percent"]))))
            quote.discount_percent = d_pct
            quote.discount_amount = (quote.subtotal * d_pct / Decimal("100")).quantize(Decimal("0.01"))
        except (ValueError, TypeError):
            pass

    net_after_discount = max(Decimal("0.00"), quote.subtotal - quote.discount_amount)
    quote.tax_amount = (net_after_discount * Decimal("0.19")).quantize(Decimal("0.01")) if quote.currency == "CLP" else Decimal("0.00")
    quote.total = net_after_discount + quote.tax_amount
    quote.save()

    return Response({
        "id": str(quote.id),
        "status": quote.status,
        "discount_percent": float(quote.discount_percent),
        "discount_amount": float(quote.discount_amount),
        "total": float(quote.total),
        "admin_notes": quote.admin_notes,
    })


@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_b2b_quote_convert(request, quote_id):
    """
    POST /api/v1/admin/orders/b2b/quotes/{id}/convert/
    Convierte una cotización B2B aprobada en una Order en estado pending con precios congelados.
    """
    try:
        quote = B2BQuote.objects.select_for_update().prefetch_related("items__product").get(id=quote_id)
    except B2BQuote.DoesNotExist:
        return Response({"error": "Cotización B2B no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    if quote.status == B2BQuoteStatus.CONVERTED:
        return Response(
            {"error": "Esta cotización ya fue convertida en orden de compra.", "order_id": str(quote.converted_order_id)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if quote.status != B2BQuoteStatus.APPROVED:
        return Response(
            {"error": "Solo cotizaciones en estado 'approved' pueden ser convertidas en pedido."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Construir demanda de inventario
    stock_demand = {}
    for item in quote.items.all():
        if item.product_id:
            stock_demand[str(item.product_id)] = stock_demand.get(str(item.product_id), 0) + item.quantity

    # Crear Order
    order = Order.objects.create(
        user=quote.user,
        email=quote.email,
        shipping_address=f"Despacho B2B — {quote.company_name} (RUT/CUIT: {quote.tax_id})",
        notes=f"Generada desde Cotización B2B #{str(quote.id)[:8].upper()}. {quote.client_notes}".strip(),
        total=quote.total,
        currency=quote.currency,
        status="pending",
        stock_deductions=stock_demand,
        loyalty_points_redeemed=0,
        loyalty_discount=Decimal("0.00"),
    )

    for item in quote.items.all():
        OrderItem.objects.create(
            order=order,
            product=item.product,
            product_name=item.product_name,
            price=item.unit_price,
            quantity=item.quantity,
        )

    quote.converted_order = order
    quote.status = B2BQuoteStatus.CONVERTED
    quote.save(update_fields=["converted_order", "status"])

    return Response({
        "order_id": str(order.id),
        "quote_id": str(quote.id),
        "status": quote.status,
        "total": float(order.total),
        "currency": order.currency,
    }, status=status.HTTP_201_CREATED)
