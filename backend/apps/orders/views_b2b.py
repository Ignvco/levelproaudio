"""
apps/orders/views_b2b.py — Cotizaciones B2B mayoristas e institucionales (V3.3 Módulo 2).

Endpoints:
- POST /api/v1/orders/b2b/quotes/                 → Solicitud de cotización mayorista (Público/Auth)
- GET  /api/v1/admin/orders/b2b/quotes/           → Listado de cotizaciones B2B (Admin/Staff)
- GET/PATCH /api/v1/admin/orders/b2b/quotes/{id}/ → Detalle y actualización comercial (Admin/Staff)
- POST /api/v1/admin/orders/b2b/quotes/{id}/convert/ → Conversión atómica a Order (Admin/Staff)
"""
from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.db.models import Count, Q
from drf_spectacular.utils import extend_schema, OpenApiTypes
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from core.admin_permissions import IsAdminOrStaff, rbac_endpoint
from core.rbac.constants import (
    MODULE_ORDERS,
    PERM_APPLY_DISCOUNTS,
    PERM_EDIT_PRICES,
    ROLE_SUPER_ADMIN,
    ROLE_MANAGEMENT,
    ROLE_SALES,
)
from core.rbac.permissions import get_user_roles, is_effective_super_admin, user_has_capability
from core.audit.services import record_audit_event
from core.audit.constants import CATEGORY_MODIFICATION
from apps.products.models import Product
from apps.site_settings.models import SiteSettings
from .b2b_preflight import (
    B2BPreflightError,
    convert_b2b_quote_to_order,
    format_money_str,
    resolve_b2b_tax_contract,
)
from .models import B2BQuote, B2BQuoteItem, B2BQuoteStatus


def _sanitize_tax_id(tax_id_str):
    return (tax_id_str or "").strip().upper().replace(".", "").replace(" ", "")


@extend_schema(request=OpenApiTypes.OBJECT, responses={201: OpenApiTypes.OBJECT})
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

    # CRM-PF-02: Contrato explícito de jurisdicción tributaria (no asumir CLP => 19% sin país)
    tax_contract = resolve_b2b_tax_contract(
        country=data.get("country"),
        currency=currency,
        tax_regime=data.get("tax_regime"),
    )
    tax_amount = tax_contract.compute_tax(subtotal) if tax_contract.is_resolved else Decimal("0.00")
    total = (subtotal + tax_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

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
        "subtotal": format_money_str(quote.subtotal, quote.currency),
        "tax_amount": format_money_str(quote.tax_amount, quote.currency),
        "total": format_money_str(quote.total, quote.currency),
        "tax_regime": tax_contract.tax_regime,
        "tax_jurisdiction_resolved": tax_contract.is_resolved,
        "status": quote.status,
        "items_count": len(validated_items),
        "created_at": quote.created_at.isoformat(),
    }, status=status.HTTP_201_CREATED)


@extend_schema(responses={200: OpenApiTypes.OBJECT})
@rbac_endpoint(module=MODULE_ORDERS)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_b2b_quotes(request):
    """
    GET /api/v1/admin/orders/b2b/quotes/
    Listado administrativo de cotizaciones B2B con filtros y búsqueda.
    """
    qs = B2BQuote.objects.annotate(items_count_ann=Count("items")).order_by("-created_at")

    status_filter = request.query_params.get("status")
    if status_filter:
        qs = qs.filter(status=status_filter)

    search = request.query_params.get("search")
    if search:
        qs = qs.filter(
            Q(company_name__icontains=search)
            | Q(tax_id__icontains=search)
            | Q(contact_name__icontains=search)
            | Q(email__icontains=search)
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
            "subtotal": format_money_str(q.subtotal, q.currency),
            "discount_amount": format_money_str(q.discount_amount, q.currency),
            "discount_percent": str(q.discount_percent),
            "tax_amount": format_money_str(q.tax_amount, q.currency),
            "total": format_money_str(q.total, q.currency),
            "status": q.status,
            "items_count": q.items_count_ann,
            "converted_order_id": str(q.converted_order_id) if q.converted_order_id else None,
            "created_at": q.created_at.strftime("%Y-%m-%d %H:%M"),
        })

    return Response({"results": results, "count": qs.count()})


@extend_schema(request=OpenApiTypes.OBJECT, responses={200: OpenApiTypes.OBJECT})
@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_roles_by_method={"PATCH": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES]},
)
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

    user_roles = set(get_user_roles(request.user))
    can_view_internal_notes = is_effective_super_admin(request.user) or bool(
        user_roles & {ROLE_MANAGEMENT, ROLE_SALES}
    )

    if request.method == "GET":
        return Response({
            "id": str(quote.id),
            "company_name": quote.company_name,
            "tax_id": quote.tax_id,
            "contact_name": quote.contact_name,
            "email": quote.email,
            "phone": quote.phone,
            "currency": quote.currency,
            "subtotal": format_money_str(quote.subtotal, quote.currency),
            "discount_amount": format_money_str(quote.discount_amount, quote.currency),
            "discount_percent": str(quote.discount_percent),
            "tax_amount": format_money_str(quote.tax_amount, quote.currency),
            "total": format_money_str(quote.total, quote.currency),
            "status": quote.status,
            "client_notes": quote.client_notes,
            "admin_notes": quote.admin_notes if can_view_internal_notes else "",
            "converted_order_id": str(quote.converted_order_id) if quote.converted_order_id else None,
            "created_at": quote.created_at.isoformat(),
            "items": [{
                "id": str(it.id),
                "product_id": str(it.product_id) if it.product_id else None,
                "product_name": it.product_name,
                "unit_price": format_money_str(it.unit_price, quote.currency),
                "quantity": it.quantity,
                "subtotal": format_money_str(it.subtotal, quote.currency),
            } for it in quote.items.all()],
        })

    # PATCH — Validar descuentos y límites de política antes de mutar
    data = request.data
    d_pct = None
    d_amt = None
    if "discount_percent" in data:
        try:
            d_pct = max(Decimal("0.00"), min(Decimal("100.00"), Decimal(str(data["discount_percent"]))))
        except (ValueError, TypeError):
            d_pct = None
    elif "discount_amount" in data:
        try:
            d_amt = max(Decimal("0.00"), Decimal(str(data["discount_amount"])))
            if quote.subtotal and quote.subtotal > Decimal("0.00"):
                d_pct = (d_amt / quote.subtotal * Decimal("100.00")).quantize(Decimal("0.01"))
            else:
                d_pct = Decimal("0.00")
        except (ValueError, TypeError):
            d_pct = None

    if d_pct is not None and d_pct > Decimal("0.00") and not is_effective_super_admin(request.user):
        if not (
            user_has_capability(request.user, PERM_APPLY_DISCOUNTS)
            and user_has_capability(request.user, PERM_EDIT_PRICES)
        ):
            return Response(
                {
                    "error": (
                        "Política comercial: los descuentos en cotizaciones B2B requieren autorización "
                        "de Gerencia / Administración o Super Admin."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

    # CRM-PF-02: Resolver jurisdicción tributaria explícita si se intenta emitir/aprobar o si se envía país/régimen
    new_status = data.get("status")
    has_explicit_tax_params = ("country" in data) or ("tax_regime" in data)
    tax_contract = None
    if has_explicit_tax_params:
        tax_contract = resolve_b2b_tax_contract(
            country=data.get("country"),
            currency=quote.currency,
            tax_regime=data.get("tax_regime"),
        )
        if not tax_contract.is_resolved and new_status == B2BQuoteStatus.APPROVED:
            return Response({"error": tax_contract.reason}, status=status.HTTP_400_BAD_REQUEST)
    elif new_status == B2BQuoteStatus.APPROVED and quote.tax_amount == Decimal("0.00"):
        # Si no hay impuesto resuelto ni jurisdicción declarada, impedir emisión definitiva sin configuración fiscal
        tax_contract = resolve_b2b_tax_contract(
            country=data.get("country"),
            currency=quote.currency,
            tax_regime=data.get("tax_regime"),
        )
        if not tax_contract.is_resolved:
            return Response({"error": tax_contract.reason}, status=status.HTTP_400_BAD_REQUEST)

    if new_status and new_status in B2BQuoteStatus.values:
        quote.status = new_status

    if "admin_notes" in data:
        quote.admin_notes = data["admin_notes"]

    if "discount_percent" in data and d_pct is not None:
        quote.discount_percent = d_pct
        quote.discount_amount = (quote.subtotal * d_pct / Decimal("100")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    elif "discount_amount" in data and d_amt is not None:
        quote.discount_amount = min(quote.subtotal, d_amt)
        quote.discount_percent = d_pct if d_pct is not None else Decimal("0.00")

    net_after_discount = max(Decimal("0.00"), quote.subtotal - quote.discount_amount)
    if tax_contract is not None and tax_contract.is_resolved:
        quote.tax_amount = tax_contract.compute_tax(net_after_discount)
    elif quote.tax_amount > Decimal("0.00") and quote.subtotal > Decimal("0.00"):
        # Preservar tasa implícita de cotización histórica sin asumir CLP => 19%
        prev_net = max(Decimal("1.00"), quote.subtotal)
        eff_rate = (quote.tax_amount / prev_net).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        quote.tax_amount = (net_after_discount * eff_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    quote.total = (net_after_discount + quote.tax_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    quote.save()

    record_audit_event(
        module="orders",
        action="B2B_QUOTE_UPDATED",
        event_category=CATEGORY_MODIFICATION,
        resource_type="B2BQuote",
        resource_id=str(quote.id),
        resource_repr=f"Cotización B2B #{str(quote.id)[:8].upper()}",
        actor=request.user,
        new_values={
            "status": quote.status,
            "discount_percent": str(quote.discount_percent),
            "total": str(quote.total),
            "currency": quote.currency,
        },
        mandatory=True,
    )

    return Response({
        "id": str(quote.id),
        "status": quote.status,
        "discount_percent": str(quote.discount_percent),
        "discount_amount": format_money_str(quote.discount_amount, quote.currency),
        "tax_amount": format_money_str(quote.tax_amount, quote.currency),
        "total": format_money_str(quote.total, quote.currency),
        "admin_notes": quote.admin_notes,
    })


@extend_schema(request=None, responses={201: OpenApiTypes.OBJECT})
@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_b2b_quote_convert(request, quote_id):
    """
    POST /api/v1/admin/orders/b2b/quotes/{id}/convert/
    CRM-PF-01: Convierte una cotización B2B aprobada en una Order integrando OMS y WMS.
    """
    quote = B2BQuote.objects.filter(id=quote_id).first()
    if quote is None:
        return Response({"error": "Cotización B2B no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    payload = request.data if isinstance(request.data, dict) else {}
    idem_key = payload.get("idempotency_key") or request.headers.get("Idempotency-Key")
    try:
        order, is_replay = convert_b2b_quote_to_order(
            quote,
            idempotency_key=idem_key,
            shipping_address=payload.get("shipping_address"),
            actor=request.user,
        )
    except B2BPreflightError as exc:
        return Response(
            {
                "error": str(exc),
                "order_id": str(quote.converted_order_id) if quote.converted_order_id else None,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response({
        "order_id": str(order.id),
        "quote_id": str(quote.id),
        "status": B2BQuoteStatus.CONVERTED,
        "total": format_money_str(order.total, order.currency),
        "currency": order.currency,
        "commercial_status": order.commercial_status,
        "financial_status": order.financial_status,
        "fulfillment_status": order.fulfillment_status,
        "idempotent_replay": is_replay,
    }, status=status.HTTP_200_OK if is_replay else status.HTTP_201_CREATED)
