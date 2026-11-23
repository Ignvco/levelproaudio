# apps/orders/crm_views.py
"""
LEVELPRO OS V4.0 — GATE 8: CRM & B2B REST API VIEWS
Rutas rectoras:
- /api/v1/admin/crm/customers/<uuid:customer_id>/360/
- /api/v1/admin/b2b/quotes/<uuid:quote_id>/pdf/
Además de CRUD CRM (organizaciones, contactos, perfil técnico, interacciones),
listas de precios B2B, cotizador profesional y cuentas de crédito comercial.
"""

from decimal import Decimal
from django.http import HttpResponse
from django.utils.dateparse import parse_datetime, parse_date
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.orders.b2b_pdf_generator import generate_and_store_b2b_quote_pdf
from apps.orders.b2b_preflight import format_money_str
from apps.orders.crm_models import (
    B2BPriceList,
    B2BQuotePDFSnapshot,
    CommercialCreditAccount,
    CustomerOrganization,
    CustomerProfile,
)
from apps.orders.crm_services import (
    CRMPermissionError,
    CRMServiceError,
    add_organization_contact,
    approve_or_update_credit_account,
    compute_credit_exposure,
    convert_b2b_quote_with_credit_check,
    create_or_update_b2b_price_list,
    create_or_update_b2b_quote,
    create_or_update_customer_profile,
    create_or_update_organization,
    generate_b2b_quote_share_link,
    get_customer_360_summary,
    record_customer_interaction,
    request_credit_account,
    resolve_b2b_unit_price,
    transition_b2b_quote_status,
    upsert_technical_profile,
)
from apps.orders.models import B2BQuote
from apps.products.models import Product, ProductVariant
from core.admin_permissions import IsAdminOrStaff, rbac_endpoint
from core.rbac.constants import (
    MODULE_FINANCES,
    MODULE_ORDERS,
    PERM_MANAGE_FINANCES,
    ROLE_FINANCE,
    ROLE_MANAGEMENT,
    ROLE_SALES,
    ROLE_SUPER_ADMIN,
    ROLE_SUPPORT,
)
from core.rbac.permissions import get_user_roles, is_effective_super_admin


# ═══════════════════════════════════════════════════════════════════════════
# 1. BF-21: CRM CLIENTES, ORGANIZACIONES, CONTACTOS, TÉCNICO, 360°
# ═══════════════════════════════════════════════════════════════════════════

@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_modules=[MODULE_ORDERS, MODULE_FINANCES],
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES, ROLE_FINANCE, ROLE_SUPPORT],
    allowed_roles_by_method={"POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES]},
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def admin_crm_customers_view(request):
    if request.method == "GET":
        search = (request.query_params.get("search") or "").strip()
        qs = CustomerProfile.objects.select_related("primary_organization", "sales_rep").all()
        if search:
            qs = qs.filter(full_name__icontains=search) | qs.filter(email__icontains=search) | qs.filter(tax_id__icontains=search)
        can_internal = is_effective_super_admin(request.user) or bool(
            set(get_user_roles(request.user)) & {ROLE_MANAGEMENT, ROLE_SALES}
        )
        results = [
            {
                "id": str(c.id),
                "code": c.code,
                "full_name": c.full_name,
                "email": c.email,
                "phone": c.phone,
                "country": c.country,
                "tax_id": c.tax_id,
                "tax_id_validated": c.tax_id_validated,
                "commercial_segment": c.commercial_segment,
                "preferred_currency": c.preferred_currency,
                "is_company_account": c.is_company_account,
                "organization_id": str(c.primary_organization_id) if c.primary_organization_id else None,
                "organization_name": c.primary_organization.legal_name if c.primary_organization_id else None,
                "sales_rep_email": c.sales_rep.email if c.sales_rep_id else None,
                "internal_notes": c.internal_notes if can_internal else "",
                "is_active": c.is_active,
                "created_at": c.created_at.isoformat(),
            }
            for c in qs[:100]
        ]
        return Response({"results": results, "count": len(results)})

    data = request.data or {}
    org = None
    if data.get("primary_organization_id"):
        org = CustomerOrganization.objects.filter(pk=data["primary_organization_id"]).first()
    try:
        prof = create_or_update_customer_profile(
            profile_id=data.get("id"),
            primary_organization=org,
            is_company_account=bool(data.get("is_company_account", False)),
            full_name=data.get("full_name", ""),
            email=data.get("email", ""),
            phone=data.get("phone", ""),
            country=data.get("country", "CL"),
            tax_id=data.get("tax_id", ""),
            commercial_segment=data.get("commercial_segment", CustomerOrganization.CommercialSegment.STANDARD),
            preferred_currency=data.get("preferred_currency", "CLP"),
            commercial_addresses=data.get("commercial_addresses"),
            authorized_notes=data.get("authorized_notes", ""),
            internal_notes=data.get("internal_notes"),
            actor=request.user,
        )
    except CRMServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({"id": str(prof.id), "code": prof.code, "tax_id_validated": prof.tax_id_validated}, status=status.HTTP_201_CREATED)


@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_modules=[MODULE_ORDERS, MODULE_FINANCES],
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES, ROLE_FINANCE, ROLE_SUPPORT],
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_crm_customer_360_view(request, customer_id):
    """GET /api/v1/admin/crm/customers/<uuid:customer_id>/360/"""
    try:
        summary = get_customer_360_summary(str(customer_id), actor=request.user)
    except CRMServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_404_NOT_FOUND)
    return Response(summary)


@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES],
)
@api_view(["POST", "PUT"])
@permission_classes([IsAdminOrStaff])
def admin_crm_technical_profile_view(request, customer_id):
    prof = CustomerProfile.objects.filter(pk=customer_id).first()
    org = CustomerOrganization.objects.filter(pk=customer_id).first() if prof is None else None
    if prof is None and org is None:
        return Response({"error": "Cliente u organización no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    try:
        tech = upsert_technical_profile(
            customer_profile=prof,
            organization=org,
            data=request.data or {},
            actor=request.user,
        )
    except CRMServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"id": str(tech.id), "primary_daw": tech.primary_daw, "facility_type": tech.facility_type})


@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_crm_interactions_view(request, customer_id):
    prof = CustomerProfile.objects.filter(pk=customer_id).first()
    org = CustomerOrganization.objects.filter(pk=customer_id).first() if prof is None else None
    if prof is None and org is None:
        return Response({"error": "Cliente u organización no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    data = request.data or {}
    next_fu = parse_datetime(data["next_follow_up_at"]) if data.get("next_follow_up_at") else None
    try:
        inter = record_customer_interaction(
            customer_profile=prof,
            organization=org,
            interaction_type=data.get("interaction_type", "call"),
            subject=data.get("subject", ""),
            summary=data.get("summary", ""),
            outcome=data.get("outcome", ""),
            next_follow_up_at=next_fu,
            actor=request.user,
        )
    except CRMServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"id": str(inter.id), "interaction_type": inter.interaction_type}, status=status.HTTP_201_CREATED)


@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_modules=[MODULE_ORDERS, MODULE_FINANCES],
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES, ROLE_FINANCE],
    allowed_roles_by_method={"POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES]},
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def admin_crm_organizations_view(request):
    if request.method == "GET":
        orgs = CustomerOrganization.objects.prefetch_related("contacts", "credit_accounts").all()[:100]
        results = [
            {
                "id": str(o.id),
                "code": o.code,
                "legal_name": o.legal_name,
                "trade_name": o.trade_name,
                "customer_type": o.customer_type,
                "country": o.country,
                "tax_id": o.tax_id,
                "tax_id_validated": o.tax_id_validated,
                "commercial_segment": o.commercial_segment,
                "preferred_currencies": o.preferred_currencies,
                "billing_email": o.billing_email,
                "phone": o.phone,
                "contacts_count": o.contacts.count(),
                "is_active": o.is_active,
            }
            for o in orgs
        ]
        return Response({"results": results, "count": len(results)})

    data = request.data or {}
    try:
        org = create_or_update_organization(
            org_id=data.get("id"),
            legal_name=data.get("legal_name", ""),
            trade_name=data.get("trade_name", ""),
            customer_type=data.get("customer_type", CustomerOrganization.CustomerType.STUDIO),
            country=data.get("country", "CL"),
            tax_id=data.get("tax_id", ""),
            commercial_segment=data.get("commercial_segment", CustomerOrganization.CommercialSegment.STANDARD),
            preferred_currencies=data.get("preferred_currencies"),
            commercial_addresses=data.get("commercial_addresses"),
            billing_email=data.get("billing_email", ""),
            phone=data.get("phone", ""),
            website=data.get("website", ""),
            authorized_notes=data.get("authorized_notes", ""),
            internal_notes=data.get("internal_notes"),
            actor=request.user,
        )
    except CRMServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"id": str(org.id), "code": org.code, "tax_id_validated": org.tax_id_validated}, status=status.HTTP_201_CREATED)


@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_crm_org_contacts_view(request, org_id):
    org = CustomerOrganization.objects.filter(pk=org_id).first()
    if org is None:
        return Response({"error": "Organización no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    data = request.data or {}
    user_obj = None
    if data.get("user_id"):
        from django.contrib.auth import get_user_model
        user_obj = get_user_model().objects.filter(pk=data["user_id"]).first()
    try:
        c = add_organization_contact(
            org,
            full_name=data.get("full_name", ""),
            email=data.get("email", ""),
            role_title=data.get("role_title", ""),
            phone=data.get("phone", ""),
            user=user_obj,
            is_primary=bool(data.get("is_primary", False)),
            can_request_quotes=bool(data.get("can_request_quotes", True)),
            can_approve_orders=bool(data.get("can_approve_orders", False)),
            can_use_credit=bool(data.get("can_use_credit", False)),
            actor=request.user,
        )
    except CRMServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"id": str(c.id), "full_name": c.full_name}, status=status.HTTP_201_CREATED)


# ═══════════════════════════════════════════════════════════════════════════
# 2. BF-19: LISTAS DE PRECIOS B2B Y MOTOR DE RESOLUCIÓN
# ═══════════════════════════════════════════════════════════════════════════

@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES],
    allowed_roles_by_method={"POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT]},
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def admin_b2b_price_lists_view(request):
    if request.method == "GET":
        lists = B2BPriceList.objects.prefetch_related("items__product", "items__variant", "items__tiers").all()[:100]
        results = []
        for pl in lists:
            results.append({
                "id": str(pl.id),
                "code": pl.code,
                "name": pl.name,
                "currency": pl.currency,
                "country": pl.country,
                "status": pl.status,
                "scope": pl.scope,
                "applicable_segment": pl.applicable_segment,
                "organization_id": str(pl.organization_id) if pl.organization_id else None,
                "priority": pl.priority,
                "version": pl.version,
                "min_margin_percent": str(pl.min_margin_percent),
                "valid_from": pl.valid_from.isoformat() if pl.valid_from else None,
                "valid_until": pl.valid_until.isoformat() if pl.valid_until else None,
                "items": [
                    {
                        "id": str(it.id),
                        "product_id": str(it.product_id),
                        "product_name": it.product.name,
                        "sku": it.variant.sku if it.variant_id else it.product.sku,
                        "pricing_mode": it.pricing_mode,
                        "fixed_price": format_money_str(it.fixed_price, pl.currency) if it.fixed_price is not None else None,
                        "discount_percent": str(it.discount_percent),
                        "tiers": [
                            {
                                "min_quantity": t.min_quantity,
                                "max_quantity": t.max_quantity,
                                "tier_price": format_money_str(t.tier_price, pl.currency) if t.tier_price is not None else None,
                                "tier_discount_percent": str(t.tier_discount_percent) if t.tier_discount_percent is not None else None,
                            }
                            for t in it.tiers.all()
                        ],
                    }
                    for it in pl.items.all()
                ],
            })
        return Response({"results": results, "count": len(results)})

    data = request.data or {}
    org = CustomerOrganization.objects.filter(pk=data["organization_id"]).first() if data.get("organization_id") else None
    prof = CustomerProfile.objects.filter(pk=data["customer_profile_id"]).first() if data.get("customer_profile_id") else None
    try:
        pl = create_or_update_b2b_price_list(
            price_list_id=data.get("id"),
            code=data.get("code", ""),
            name=data.get("name", ""),
            currency=data.get("currency", "CLP"),
            country=data.get("country", "CL"),
            market=data.get("market", ""),
            status=data.get("status", B2BPriceList.Status.ACTIVE),
            scope=data.get("scope", B2BPriceList.Scope.SEGMENT),
            applicable_segment=data.get("applicable_segment", ""),
            organization=org,
            customer_profile=prof,
            priority=data.get("priority", 100),
            valid_from=parse_datetime(data["valid_from"]) if data.get("valid_from") else None,
            valid_until=parse_datetime(data["valid_until"]) if data.get("valid_until") else None,
            min_margin_percent=Decimal(str(data.get("min_margin_percent") or "10.00")),
            items=data.get("items"),
            actor=request.user,
        )
    except (CRMServiceError, Product.DoesNotExist, ProductVariant.DoesNotExist) as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"id": str(pl.id), "code": pl.code, "version": pl.version}, status=status.HTTP_201_CREATED)


@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_b2b_price_resolve_view(request):
    data = request.data or {}
    prod = Product.objects.filter(pk=data.get("product_id")).first()
    if prod is None:
        return Response({"error": "Producto no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    var = ProductVariant.objects.filter(pk=data.get("variant_id"), product=prod).first() if data.get("variant_id") else None
    org = CustomerOrganization.objects.filter(pk=data.get("organization_id")).first() if data.get("organization_id") else None
    prof = CustomerProfile.objects.filter(pk=data.get("customer_profile_id")).first() if data.get("customer_profile_id") else None
    res = resolve_b2b_unit_price(
        product=prod,
        variant=var,
        quantity=int(data.get("quantity") or 1),
        currency=data.get("currency", "CLP"),
        customer_profile=prof,
        organization=org,
        segment=data.get("segment"),
        actor=request.user,
    )
    return Response(res)


# ═══════════════════════════════════════════════════════════════════════════
# 3. BF-20: COTIZADOR B2B PROFESIONAL, PDF VERSIONADO Y CONVERSIÓN
# ═══════════════════════════════════════════════════════════════════════════

@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_b2b_quote_pro_create_view(request):
    data = request.data or {}
    org = CustomerOrganization.objects.filter(pk=data.get("organization_id")).first() if data.get("organization_id") else None
    prof = CustomerProfile.objects.filter(pk=data.get("customer_profile_id")).first() if data.get("customer_profile_id") else None
    try:
        q = create_or_update_b2b_quote(
            quote_id=data.get("id"),
            organization=org,
            customer_profile=prof,
            company_name=data.get("company_name", ""),
            tax_id=data.get("tax_id", ""),
            contact_name=data.get("contact_name", ""),
            email=data.get("email", ""),
            phone=data.get("phone", ""),
            country=data.get("country", "CL"),
            tax_regime=data.get("tax_regime", ""),
            currency=data.get("currency", "CLP"),
            payment_terms=data.get("payment_terms", "prepaid"),
            delivery_terms=data.get("delivery_terms", ""),
            valid_until=parse_date(data["valid_until"]) if data.get("valid_until") else None,
            discount_percent=Decimal(str(data.get("discount_percent") or "0.00")),
            client_notes=data.get("client_notes", ""),
            admin_notes=data.get("admin_notes", ""),
            items=data.get("items") or [],
            actor=request.user,
        )
    except CRMPermissionError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except (CRMServiceError, Product.DoesNotExist) as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(
        {
            "id": str(q.id),
            "quote_number": q.quote_number,
            "version": q.version,
            "status": q.status,
            "currency": q.currency,
            "subtotal": format_money_str(q.subtotal, q.currency),
            "tax_amount": format_money_str(q.tax_amount, q.currency),
            "total": format_money_str(q.total, q.currency),
            "tax_regime": q.tax_regime,
        },
        status=status.HTTP_201_CREATED,
    )


@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_b2b_quote_status_view(request, quote_id):
    q = B2BQuote.objects.filter(pk=quote_id).first()
    if q is None:
        return Response({"error": "Cotización no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    try:
        updated = transition_b2b_quote_status(
            q,
            target_status=(request.data or {}).get("status", ""),
            actor=request.user,
        )
    except CRMServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"id": str(updated.id), "status": updated.status, "version": updated.version})


@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES, ROLE_FINANCE],
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_b2b_quote_pdf_view(request, quote_id):
    """GET /api/v1/admin/b2b/quotes/<uuid:quote_id>/pdf/"""
    q = B2BQuote.objects.select_related("sales_rep").prefetch_related("items__product", "items__variant").filter(pk=quote_id).first()
    if q is None:
        return Response({"error": "Cotización B2B no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    design = request.query_params.get("design") or B2BQuotePDFSnapshot.DesignVariant.CLASSIC_CORPORATE
    snap = generate_and_store_b2b_quote_pdf(q, design_variant=design, actor=request.user)

    if request.query_params.get("meta") == "1":
        return Response({
            "quote_id": str(q.id),
            "quote_number": q.quote_number or str(q.id)[:8].upper(),
            "version": snap.version,
            "design_variant": snap.design_variant,
            "sha256_checksum": snap.sha256_checksum,
            "file_size_bytes": snap.file_size_bytes,
            "generated_at": snap.generated_at.isoformat(),
        })

    filename = f"{q.quote_number or str(q.id)[:8]}-v{snap.version}.pdf"
    resp = HttpResponse(bytes(snap.pdf_bytes), content_type="application/pdf")
    resp["Content-Disposition"] = f'inline; filename="{filename}"'
    resp["X-PDF-SHA256"] = snap.sha256_checksum
    resp["X-Quote-Version"] = str(snap.version)
    return resp


@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_b2b_quote_share_view(request, quote_id):
    q = B2BQuote.objects.filter(pk=quote_id).first()
    if q is None:
        return Response({"error": "Cotización B2B no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    data = request.data or {}
    try:
        res = generate_b2b_quote_share_link(
            q,
            expires_in_hours=int(data.get("expires_in_hours") or 72),
            base_frontend_url=data.get("base_frontend_url"),
            actor=request.user,
        )
    except CRMServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(res)


@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_b2b_quote_convert_pro_view(request, quote_id):
    q = B2BQuote.objects.filter(pk=quote_id).first()
    if q is None:
        return Response({"error": "Cotización B2B no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    data = request.data or {}
    idem = data.get("idempotency_key") or request.headers.get("Idempotency-Key")
    try:
        order, is_replay = convert_b2b_quote_with_credit_check(
            q,
            idempotency_key=idem,
            shipping_address=data.get("shipping_address"),
            actor=request.user,
        )
    except CRMServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(
        {
            "order_id": str(order.id),
            "quote_id": str(q.id),
            "total": format_money_str(order.total, order.currency),
            "currency": order.currency,
            "payment_terms": order.payment_terms,
            "commercial_status": order.commercial_status,
            "financial_status": order.financial_status,
            "fulfillment_status": order.fulfillment_status,
            "idempotent_replay": is_replay,
        },
        status=status.HTTP_200_OK if is_replay else status.HTTP_201_CREATED,
    )


# ═══════════════════════════════════════════════════════════════════════════
# 4. BF-40: CRÉDITO COMERCIAL B2B
# ═══════════════════════════════════════════════════════════════════════════

@rbac_endpoint(
    module=MODULE_FINANCES,
    allowed_modules=[MODULE_FINANCES, MODULE_ORDERS],
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_FINANCE, ROLE_SALES],
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def admin_b2b_credit_accounts_view(request):
    if request.method == "GET":
        accounts = CommercialCreditAccount.objects.select_related("organization").all()[:100]
        results = [compute_credit_exposure(ca) for ca in accounts]
        return Response({"results": results, "count": len(results)})

    data = request.data or {}
    org = CustomerOrganization.objects.filter(pk=data.get("organization_id")).first()
    if org is None:
        return Response({"error": "Organización no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    try:
        ca = request_credit_account(
            organization=org,
            currency=data.get("currency", "CLP"),
            proposed_limit=Decimal(str(data.get("proposed_limit") or "0.00")),
            payment_terms=data.get("payment_terms", CommercialCreditAccount.PaymentTerms.NET_15),
            notes=data.get("notes", ""),
            actor=request.user,
        )
    except CRMServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(compute_credit_exposure(ca), status=status.HTTP_201_CREATED)


@rbac_endpoint(
    module=MODULE_FINANCES,
    capability=PERM_MANAGE_FINANCES,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_FINANCE],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_b2b_credit_decide_view(request, account_id):
    ca = CommercialCreditAccount.objects.filter(pk=account_id).first()
    if ca is None:
        return Response({"error": "Cuenta de crédito no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    data = request.data or {}
    try:
        updated = approve_or_update_credit_account(
            ca,
            action=data.get("action", ""),
            credit_limit=Decimal(str(data["credit_limit"])) if data.get("credit_limit") is not None else None,
            payment_terms=data.get("payment_terms"),
            expires_at=parse_datetime(data["expires_at"]) if data.get("expires_at") else None,
            approval_evidence=data.get("approval_evidence", ""),
            policy_acknowledged=bool(data.get("policy_acknowledged", False)),
            notes=data.get("notes", ""),
            actor=request.user,
        )
    except CRMPermissionError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except CRMServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(compute_credit_exposure(updated))
