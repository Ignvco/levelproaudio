# apps/orders/crm_services.py
"""
LEVELPRO OS V4.0 — GATE 8: CRM, B2B PRICING, QUOTES & COMMERCIAL CREDIT SERVICES
- BF-21: CRM Técnico, Organizaciones, Contactos Multi-Org, Validación RUT/CUIT, Ficha 360°, Seguimiento.
- BF-19: Listas de Precios B2B, Precedencia Determinista, Escalones por Volumen e Integración Margen Gate 6.
- BF-20: Cotizador B2B Profesional, Ciclo de Vida, Snapshots, Enlace Seguro y Conversión OMS/WMS.
- BF-40: Crédito Comercial B2B (deshabilitado por defecto, SoD, Exposición y Bloqueo Preventivo).
"""

import secrets
import urllib.parse
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from django.conf import settings
from django.core import signing
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from apps.academy.models import Enrollment
from apps.billing.shipping_and_tax import (
    clean_tax_id,
    validate_argentine_cuit,
    validate_chilean_rut,
)
from apps.loyalty.models import LoyaltyAccount
from apps.orders.b2b_preflight import (
    B2BPreflightError,
    convert_b2b_quote_to_order,
    format_money_str,
    resolve_b2b_tax_contract,
)
from apps.orders.crm_models import (
    B2BPriceList,
    B2BPriceListItem,
    B2BPriceTier,
    CommercialCreditAccount,
    CommercialCreditDecision,
    CustomerContact,
    CustomerInteraction,
    CustomerOrganization,
    CustomerProfile,
    CustomerTechnicalProfile,
)
from apps.orders.models import (
    B2BQuote,
    B2BQuoteItem,
    B2BQuoteStatus,
    DraftOrder,
    Order,
    ReturnMerchandiseAuthorization,
)
from apps.payments.models import Payment, PaymentStatus
from apps.procurement.models import WeightedAverageCostState
from apps.products.models import Product, ProductVariant
from apps.rewards.models import Entry as RewardEntry, Winner as RewardWinner
from apps.services.models import Booking as ServiceBooking, ServiceRequest
from apps.site_settings.models import SiteSettings
from core.audit.constants import (
    CATEGORY_CREATION,
    CATEGORY_FINANCIAL_OPERATION,
    CATEGORY_MODIFICATION,
    SEVERITY_HIGH,
    SEVERITY_INFO,
)
from core.audit.services import record_audit_event
from core.rbac.constants import (
    PERM_APPLY_DISCOUNTS,
    PERM_EDIT_PRICES,
    PERM_MANAGE_FINANCES,
    PERM_VIEW_COSTS,
    PERM_VIEW_MARGINS,
    ROLE_FINANCE,
    ROLE_MANAGEMENT,
    ROLE_SALES,
)
from core.rbac.permissions import (
    get_user_roles,
    is_effective_super_admin,
    user_has_capability,
)

B2B_SHARE_TOKEN_SALT = "levelpro.v4.gate8.b2b_quote_share"


class CRMServiceError(ValueError):
    """Error de negocio o validación en CRM / B2B."""


class CRMPermissionError(PermissionError):
    """Error de autorización RBAC en CRM / B2B."""


def _next_code(model_cls, field_name: str, prefix: str) -> str:
    today = timezone.now().strftime("%Y%m%d")
    base = f"{prefix}-{today}-"
    count = model_cls.objects.filter(**{f"{field_name}__startswith": base}).count()
    for i in range(count + 1, count + 50):
        candidate = f"{base}{i:04d}"
        if not model_cls.objects.filter(**{field_name: candidate}).exists():
            return candidate
    return f"{base}{secrets.token_hex(3).upper()}"


def validate_tax_id_by_country(country: str, tax_id: str) -> tuple[str, bool]:
    """
    BF-21: Validación matemática de formato y dígito verificador para RUT chileno y CUIT argentino.
    Nota: No sustituye verificación oficial ante SII o AFIP.
    """
    cleaned = (tax_id or "").strip().upper()
    if not cleaned:
        return "", False
    c = (country or "CL").strip().upper()
    if c in ("CL", "CHILE"):
        return clean_tax_id(cleaned), validate_chilean_rut(cleaned)
    if c in ("AR", "ARGENTINA"):
        digits = "".join(ch for ch in cleaned if ch.isdigit())
        return digits or cleaned, validate_argentine_cuit(cleaned)
    return cleaned, False


# ═══════════════════════════════════════════════════════════════════════════
# 1. BF-21: ORGANIZACIONES, PERFILES, CONTACTOS, TÉCNICO, INTERACCIONES Y 360°
# ═══════════════════════════════════════════════════════════════════════════

@transaction.atomic
def create_or_update_organization(
    *,
    org_id=None,
    legal_name: str,
    trade_name: str = "",
    customer_type: str = CustomerOrganization.CustomerType.STUDIO,
    country: str = "CL",
    tax_id: str = "",
    commercial_segment: str = CustomerOrganization.CommercialSegment.STANDARD,
    preferred_currencies: list = None,
    commercial_addresses: list = None,
    billing_email: str = "",
    phone: str = "",
    website: str = "",
    sales_rep=None,
    is_active: bool = True,
    authorized_notes: str = "",
    internal_notes: Optional[str] = None,
    actor=None,
) -> CustomerOrganization:
    if not (legal_name or "").strip():
        raise CRMServiceError("La razón social de la organización es obligatoria.")

    norm_tax, tax_valid = validate_tax_id_by_country(country, tax_id)
    if (country or "").upper() in ("CL", "AR") and tax_id and not tax_valid:
        raise CRMServiceError(
            f"El identificador tributario '{tax_id}' no supera la validación matemática de dígito verificador para {country.upper()}."
        )

    if org_id:
        org = CustomerOrganization.objects.select_for_update().get(pk=org_id)
        action = "CRM_ORGANIZATION_UPDATED"
    else:
        org = CustomerOrganization(code=_next_code(CustomerOrganization, "code", "ORG"))
        action = "CRM_ORGANIZATION_CREATED"

    org.legal_name = legal_name.strip()
    org.trade_name = (trade_name or "").strip()
    if customer_type in CustomerOrganization.CustomerType.values:
        org.customer_type = customer_type
    org.country = (country or "CL").strip().upper()[:10]
    org.tax_id = norm_tax
    org.tax_id_validated = tax_valid
    if commercial_segment in CustomerOrganization.CommercialSegment.values:
        org.commercial_segment = commercial_segment
    if preferred_currencies is not None:
        org.preferred_currencies = [str(x).upper() for x in preferred_currencies if x]
    elif not org.preferred_currencies:
        org.preferred_currencies = ["CLP"]
    if commercial_addresses is not None:
        org.commercial_addresses = list(commercial_addresses)
    org.billing_email = (billing_email or "").strip()
    org.phone = (phone or "").strip()
    org.website = (website or "").strip()
    if sales_rep is not None:
        org.sales_rep = sales_rep
    org.is_active = bool(is_active)
    org.authorized_notes = (authorized_notes or "").strip()
    if internal_notes is not None:
        org.internal_notes = internal_notes.strip()
    org.save()

    record_audit_event(
        module="orders",
        action=action,
        event_category=CATEGORY_CREATION if not org_id else CATEGORY_MODIFICATION,
        resource_type="CustomerOrganization",
        resource_id=str(org.id),
        resource_repr=str(org),
        actor=actor,
        new_values={"code": org.code, "segment": org.commercial_segment, "country": org.country},
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return org


@transaction.atomic
def add_organization_contact(
    organization: CustomerOrganization,
    *,
    full_name: str,
    email: str,
    role_title: str = "",
    phone: str = "",
    user=None,
    is_primary: bool = False,
    can_request_quotes: bool = True,
    can_approve_orders: bool = False,
    can_use_credit: bool = False,
    actor=None,
) -> CustomerContact:
    if not (full_name or "").strip() or not (email or "").strip():
        raise CRMServiceError("El nombre completo y email del contacto son obligatorios.")

    if user is not None:
        existing = CustomerContact.objects.filter(organization=organization, user=user).first()
        if existing is not None:
            raise CRMServiceError("El usuario ya se encuentra vinculado como contacto de esta organización.")

    if is_primary:
        CustomerContact.objects.filter(organization=organization, is_primary=True).update(is_primary=False)

    contact = CustomerContact.objects.create(
        organization=organization,
        user=user,
        full_name=full_name.strip(),
        role_title=(role_title or "").strip(),
        email=email.strip().lower(),
        phone=(phone or "").strip(),
        is_primary=bool(is_primary),
        can_request_quotes=bool(can_request_quotes),
        can_approve_orders=bool(can_approve_orders),
        can_use_credit=bool(can_use_credit),
    )

    record_audit_event(
        module="orders",
        action="CRM_CONTACT_ADDED",
        event_category=CATEGORY_CREATION,
        resource_type="CustomerContact",
        resource_id=str(contact.id),
        resource_repr=str(contact),
        actor=actor,
        new_values={"organization_id": str(organization.id), "is_primary": contact.is_primary},
        severity=SEVERITY_INFO,
        mandatory=False,
    )
    return contact


@transaction.atomic
def create_or_update_customer_profile(
    *,
    profile_id=None,
    user=None,
    primary_organization: CustomerOrganization = None,
    is_company_account: bool = False,
    full_name: str,
    email: str,
    phone: str = "",
    country: str = "CL",
    tax_id: str = "",
    commercial_segment: str = CustomerOrganization.CommercialSegment.STANDARD,
    preferred_currency: str = "CLP",
    commercial_addresses: list = None,
    sales_rep=None,
    is_active: bool = True,
    authorized_notes: str = "",
    internal_notes: Optional[str] = None,
    actor=None,
) -> CustomerProfile:
    if not (full_name or "").strip() or not (email or "").strip():
        raise CRMServiceError("El nombre y email de la ficha CRM son obligatorios.")

    norm_tax, tax_valid = validate_tax_id_by_country(country, tax_id)
    if (country or "").upper() in ("CL", "AR") and tax_id and not tax_valid:
        raise CRMServiceError(
            f"El identificador tributario '{tax_id}' no supera la validación matemática de dígito verificador para {country.upper()}."
        )

    if profile_id:
        profile = CustomerProfile.objects.select_for_update().get(pk=profile_id)
        action = "CRM_PROFILE_UPDATED"
    elif user is not None and hasattr(user, "crm_profile"):
        profile = CustomerProfile.objects.select_for_update().get(user=user)
        action = "CRM_PROFILE_UPDATED"
    else:
        profile = CustomerProfile(code=_next_code(CustomerProfile, "code", "CUS"))
        action = "CRM_PROFILE_CREATED"

    profile.user = user or profile.user
    profile.primary_organization = primary_organization
    profile.is_company_account = bool(is_company_account or primary_organization is not None)
    profile.full_name = full_name.strip()
    profile.email = email.strip().lower()
    profile.phone = (phone or "").strip()
    profile.country = (country or "CL").strip().upper()[:10]
    profile.tax_id = norm_tax
    profile.tax_id_validated = tax_valid
    if commercial_segment in CustomerOrganization.CommercialSegment.values:
        profile.commercial_segment = commercial_segment
    profile.preferred_currency = (preferred_currency or "CLP").strip().upper()[:10]
    if commercial_addresses is not None:
        profile.commercial_addresses = list(commercial_addresses)
    if sales_rep is not None:
        profile.sales_rep = sales_rep
    profile.is_active = bool(is_active)
    profile.authorized_notes = (authorized_notes or "").strip()
    if internal_notes is not None:
        profile.internal_notes = internal_notes.strip()
    profile.save()

    record_audit_event(
        module="orders",
        action=action,
        event_category=CATEGORY_CREATION if action == "CRM_PROFILE_CREATED" else CATEGORY_MODIFICATION,
        resource_type="CustomerProfile",
        resource_id=str(profile.id),
        resource_repr=str(profile),
        actor=actor,
        new_values={"code": profile.code, "segment": profile.commercial_segment},
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return profile


@transaction.atomic
def upsert_technical_profile(
    *,
    customer_profile: CustomerProfile = None,
    organization: CustomerOrganization = None,
    data: dict,
    actor=None,
) -> CustomerTechnicalProfile:
    if customer_profile is None and organization is None:
        raise CRMServiceError("Debe vincular el perfil técnico a un cliente o una organización.")

    if organization is not None:
        tech, _ = CustomerTechnicalProfile.objects.get_or_create(organization=organization)
    else:
        tech, _ = CustomerTechnicalProfile.objects.get_or_create(customer_profile=customer_profile)

    for str_field in ("primary_activity", "facility_type", "primary_daw", "existing_equipment_notes", "future_needs", "active_projects"):
        if str_field in data:
            setattr(tech, str_field, str(data[str_field] or "").strip())

    for list_field in ("audio_interfaces", "consoles", "microphones", "monitors", "pa_systems", "processors", "instruments", "brands_of_interest"):
        if list_field in data and isinstance(data[list_field], list):
            setattr(tech, list_field, [str(x).strip() for x in data[list_field] if str(x).strip()])

    tech.save()
    record_audit_event(
        module="orders",
        action="CRM_TECHNICAL_PROFILE_UPDATED",
        event_category=CATEGORY_MODIFICATION,
        resource_type="CustomerTechnicalProfile",
        resource_id=str(tech.id),
        resource_repr=str(tech),
        actor=actor,
        new_values={"primary_daw": tech.primary_daw, "facility_type": tech.facility_type},
        severity=SEVERITY_INFO,
        mandatory=False,
    )
    return tech


@transaction.atomic
def record_customer_interaction(
    *,
    customer_profile: CustomerProfile = None,
    organization: CustomerOrganization = None,
    interaction_type: str,
    subject: str,
    summary: str = "",
    outcome: str = "",
    next_follow_up_at=None,
    related_quote: B2BQuote = None,
    actor=None,
) -> CustomerInteraction:
    if customer_profile is None and organization is None:
        raise CRMServiceError("La interacción debe asociarse a un cliente o una organización.")
    if not (subject or "").strip():
        raise CRMServiceError("El asunto de la interacción es obligatorio.")

    itype = (
        interaction_type
        if interaction_type in CustomerInteraction.InteractionType.values
        else CustomerInteraction.InteractionType.CALL
    )
    inter = CustomerInteraction.objects.create(
        customer_profile=customer_profile,
        organization=organization,
        interaction_type=itype,
        subject=subject.strip(),
        summary=(summary or "").strip(),
        outcome=(outcome or "").strip(),
        next_follow_up_at=next_follow_up_at,
        sales_rep=actor if getattr(actor, "is_authenticated", False) else None,
        related_quote=related_quote,
    )
    record_audit_event(
        module="orders",
        action="CRM_INTERACTION_LOGGED",
        event_category=CATEGORY_CREATION,
        resource_type="CustomerInteraction",
        resource_id=str(inter.id),
        resource_repr=str(inter),
        actor=actor,
        new_values={"interaction_type": itype},
        severity=SEVERITY_INFO,
        mandatory=False,
    )
    return inter


def get_customer_360_summary(customer_id: str, *, actor=None) -> dict:
    """
    BF-21: Ficha 360° consolidada para CustomerProfile, CustomerOrganization o User.
    - Sin consultas N+1.
    - Respeta privacidad RBAC (notas internas, perfil técnico, costos y saldos de crédito).
    - Presenta estados vacíos honestos cuando un módulo no tiene registros.
    """
    profile = (
        CustomerProfile.objects.select_related("user", "primary_organization", "sales_rep")
        .filter(Q(pk=customer_id) | Q(user_id=customer_id))
        .first()
    )
    org = None
    user_obj = None

    if profile is not None:
        org = profile.primary_organization
        user_obj = profile.user
    else:
        org = CustomerOrganization.objects.select_related("sales_rep").filter(pk=customer_id).first()
        if org is None:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            user_obj = User.objects.filter(pk=customer_id).first()
            if user_obj is None:
                raise CRMServiceError("Cliente u organización CRM no encontrado.")

    roles = set(get_user_roles(actor)) if actor else set()
    is_super = is_effective_super_admin(actor) if actor else False
    can_view_internal = is_super or bool(roles & {ROLE_MANAGEMENT, ROLE_SALES})
    can_view_credit = is_super or bool(roles & {ROLE_MANAGEMENT, ROLE_FINANCE, ROLE_SALES}) or (
        actor and user_has_capability(actor, PERM_MANAGE_FINANCES)
    )

    email_lookup = (
        profile.email if profile else (org.billing_email if org else (user_obj.email if user_obj else ""))
    ).strip().lower()

    # 1. Pedidos OMS
    order_q = Q()
    if user_obj is not None:
        order_q |= Q(user=user_obj)
    if email_lookup:
        order_q |= Q(email__iexact=email_lookup)
    if org and org.tax_id:
        order_q |= Q(customer_tax_id__iexact=org.tax_id)

    orders_qs = (
        Order.objects.filter(order_q).order_by("-created_at")[:25]
        if order_q
        else Order.objects.none()
    )
    orders_list = [
        {
            "id": str(o.id),
            "created_at": o.created_at.isoformat(),
            "currency": o.currency,
            "total": format_money_str(o.total, o.currency),
            "status": o.status,
            "commercial_status": o.commercial_status,
            "financial_status": o.financial_status,
            "fulfillment_status": o.fulfillment_status,
            "order_origin": o.order_origin,
        }
        for o in orders_qs
    ]

    # 2. Borradores manuales / WhatsApp (Gate 7)
    draft_q = Q()
    if user_obj is not None:
        draft_q |= Q(customer=user_obj)
    if email_lookup:
        draft_q |= Q(customer_email__iexact=email_lookup)
    drafts_qs = (
        DraftOrder.objects.filter(draft_q).order_by("-created_at")[:20]
        if draft_q
        else DraftOrder.objects.none()
    )
    drafts_list = [
        {
            "id": str(d.id),
            "draft_number": d.draft_number,
            "status": d.status,
            "channel": d.channel,
            "currency": d.currency,
            "total": format_money_str(d.total, d.currency),
            "created_at": d.created_at.isoformat(),
        }
        for d in drafts_qs
    ]

    # 3. Cotizaciones B2B
    quote_q = Q()
    if org is not None:
        quote_q |= Q(organization=org)
    if profile is not None:
        quote_q |= Q(customer_profile=profile)
    if user_obj is not None:
        quote_q |= Q(user=user_obj)
    if email_lookup:
        quote_q |= Q(email__iexact=email_lookup)
    quotes_qs = (
        B2BQuote.objects.filter(quote_q).order_by("-created_at")[:20]
        if quote_q
        else B2BQuote.objects.none()
    )
    quotes_list = [
        {
            "id": str(q.id),
            "quote_number": q.quote_number or f"QTE-{str(q.id)[:8].upper()}",
            "version": q.version,
            "status": q.status,
            "currency": q.currency,
            "total": format_money_str(q.total, q.currency),
            "created_at": q.created_at.isoformat(),
        }
        for q in quotes_qs
    ]

    # 4. RMA y Devoluciones
    rma_qs = (
        ReturnMerchandiseAuthorization.objects.select_related("order")
        .filter(order_id__in=[o["id"] for o in orders_list])
        .order_by("-created_at")[:20]
        if orders_list
        else ReturnMerchandiseAuthorization.objects.none()
    )
    rmas_list = [
        {
            "id": str(r.id),
            "rma_number": r.rma_number,
            "status": r.status,
            "refund_status": r.refund_status,
            "refund_amount": format_money_str(r.refund_amount, r.refund_currency),
            "refund_currency": r.refund_currency,
            "created_at": r.created_at.isoformat(),
        }
        for r in rma_qs
    ]

    # 5. Academia, Servicios, Loyalty y Rewards (reales, con estado vacío honesto)
    enrollments_list = []
    bookings_list = []
    service_requests_list = []
    loyalty_info = None
    rewards_info = {"entries_count": 0, "wins_count": 0}

    if user_obj is not None:
        enrollments_list = [
            {
                "id": str(e.id),
                "course_title": e.course.title,
                "status": e.status if hasattr(e, "status") else "active",
                "enrolled_at": e.created_at.isoformat(),
            }
            for e in Enrollment.objects.select_related("course").filter(user=user_obj).order_by("-created_at")[:20]
        ]
        bookings_list = [
            {
                "id": str(b.id),
                "service_name": b.service.name,
                "status": b.status,
                "created_at": b.created_at.isoformat(),
            }
            for b in ServiceBooking.objects.select_related("service").filter(user=user_obj).order_by("-created_at")[:20]
        ]
        service_requests_list = [
            {
                "id": str(sr.id),
                "service_name": sr.service.name if sr.service_id else "Servicio personalizado",
                "status": sr.status,
                "created_at": sr.created_at.isoformat(),
            }
            for sr in ServiceRequest.objects.select_related("service").filter(user=user_obj).order_by("-created_at")[:20]
        ]
        loy = LoyaltyAccount.objects.filter(user=user_obj).first()
        if loy is not None:
            loyalty_info = {
                "points_balance": getattr(loy, "points_balance", getattr(loy, "balance", 0)),
                "tier": getattr(loy, "tier", "standard"),
            }
        rewards_info = {
            "entries_count": RewardEntry.objects.filter(user=user_obj).count(),
            "wins_count": RewardWinner.objects.filter(user=user_obj).count(),
        }

    # 6. Perfil Técnico (confidencial CRM)
    tech_obj = None
    if org is not None:
        tech_obj = getattr(org, "technical_profile", None)
    if tech_obj is None and profile is not None:
        tech_obj = getattr(profile, "technical_profile", None)

    tech_data = None
    if tech_obj is not None and can_view_internal:
        tech_data = {
            "primary_activity": tech_obj.primary_activity,
            "facility_type": tech_obj.facility_type,
            "primary_daw": tech_obj.primary_daw,
            "audio_interfaces": tech_obj.audio_interfaces,
            "consoles": tech_obj.consoles,
            "microphones": tech_obj.microphones,
            "monitors": tech_obj.monitors,
            "pa_systems": tech_obj.pa_systems,
            "processors": tech_obj.processors,
            "instruments": tech_obj.instruments,
            "brands_of_interest": tech_obj.brands_of_interest,
            "existing_equipment_notes": tech_obj.existing_equipment_notes,
            "future_needs": tech_obj.future_needs,
            "active_projects": tech_obj.active_projects,
        }

    # 7. Contactos, organizaciones vinculadas e interacciones
    contacts_list = []
    if org is not None:
        contacts_list = [
            {
                "id": str(c.id),
                "full_name": c.full_name,
                "role_title": c.role_title,
                "email": c.email,
                "phone": c.phone,
                "is_primary": c.is_primary,
                "can_request_quotes": c.can_request_quotes,
                "can_approve_orders": c.can_approve_orders,
                "can_use_credit": c.can_use_credit,
                "user_id": str(c.user_id) if c.user_id else None,
            }
            for c in org.contacts.filter(is_active=True)
        ]

    linked_orgs = []
    if user_obj is not None:
        linked_orgs = [
            {
                "organization_id": str(m.organization_id),
                "code": m.organization.code,
                "legal_name": m.organization.legal_name,
                "can_request_quotes": m.can_request_quotes,
                "can_approve_orders": m.can_approve_orders,
                "can_use_credit": m.can_use_credit,
            }
            for m in CustomerContact.objects.select_related("organization").filter(user=user_obj, is_active=True)
        ]

    inter_q = Q()
    if profile is not None:
        inter_q |= Q(customer_profile=profile)
    if org is not None:
        inter_q |= Q(organization=org)
    interactions_list = []
    if inter_q and can_view_internal:
        for it in CustomerInteraction.objects.select_related("sales_rep").filter(inter_q)[:30]:
            interactions_list.append({
                "id": str(it.id),
                "interaction_type": it.interaction_type,
                "subject": it.subject,
                "summary": it.summary,
                "outcome": it.outcome,
                "next_follow_up_at": it.next_follow_up_at.isoformat() if it.next_follow_up_at else None,
                "sales_rep_email": it.sales_rep.email if it.sales_rep_id else None,
                "created_at": it.created_at.isoformat(),
            })

    # 8. Crédito comercial (solo con permiso)
    credit_list = []
    if org is not None and can_view_credit:
        for ca in org.credit_accounts.all():
            credit_list.append(compute_credit_exposure(ca))

    return {
        "identity": {
            "entity_type": "organization" if (org and not profile) else "customer",
            "id": str(profile.id if profile else (org.id if org else user_obj.id)),
            "code": profile.code if profile else (org.code if org else f"USR-{str(user_obj.id)[:8].upper()}"),
            "full_name": profile.full_name if profile else (org.legal_name if org else (user_obj.get_full_name() or user_obj.email)),
            "email": email_lookup,
            "phone": profile.phone if profile else (org.phone if org else getattr(user_obj, "phone", "")),
            "country": profile.country if profile else (org.country if org else "CL"),
            "tax_id": profile.tax_id if profile else (org.tax_id if org else ""),
            "tax_id_validated": profile.tax_id_validated if profile else (org.tax_id_validated if org else False),
            "commercial_segment": profile.commercial_segment if profile else (org.commercial_segment if org else "standard"),
            "sales_rep_email": (
                profile.sales_rep.email if (profile and profile.sales_rep_id)
                else (org.sales_rep.email if (org and org.sales_rep_id) else None)
            ),
            "authorized_notes": profile.authorized_notes if profile else (org.authorized_notes if org else ""),
            "internal_notes": (
                (profile.internal_notes if profile else (org.internal_notes if org else ""))
                if can_view_internal else ""
            ),
        },
        "organization": (
            {
                "id": str(org.id),
                "code": org.code,
                "legal_name": org.legal_name,
                "trade_name": org.trade_name,
                "customer_type": org.customer_type,
                "country": org.country,
                "tax_id": org.tax_id,
                "tax_id_validated": org.tax_id_validated,
                "commercial_segment": org.commercial_segment,
                "preferred_currencies": org.preferred_currencies,
                "commercial_addresses": org.commercial_addresses,
            }
            if org else None
        ),
        "linked_organizations": linked_orgs,
        "contacts": contacts_list,
        "technical_profile": tech_data,
        "history_360": {
            "orders": orders_list,
            "draft_orders": drafts_list,
            "b2b_quotes": quotes_list,
            "rmas": rmas_list,
            "academy_enrollments": enrollments_list,
            "service_bookings": bookings_list,
            "service_requests": service_requests_list,
            "loyalty": loyalty_info,
            "rewards": rewards_info,
        },
        "interactions": interactions_list,
        "credit_accounts": credit_list,
    }


# ═══════════════════════════════════════════════════════════════════════════
# 2. BF-19: LISTAS DE PRECIOS B2B, PRECEDENCIA Y MARGEN GATE 6
# ═══════════════════════════════════════════════════════════════════════════

def _get_public_unit_price(product: Product, variant: Optional[ProductVariant], currency: str) -> Decimal:
    curr = (currency or "CLP").upper()
    site = SiteSettings.objects.first()
    rate_clp = site.usd_to_clp if site else None
    rate_ars = site.usd_to_ars if site else None
    if variant is not None:
        base_clp = variant.effective_price
        if curr == "CLP":
            return Decimal(str(base_clp)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    prices = product.prices_by_currency(rate_clp, rate_ars)
    val = prices.get(curr) or (variant.effective_price if variant else product.price)
    return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _get_verifiable_unit_cost(product: Product, variant: Optional[ProductVariant], currency: str) -> Optional[Decimal]:
    curr = (currency or "CLP").upper()
    wac = WeightedAverageCostState.objects.filter(
        product=product, variant=variant, currency=curr, total_quantity__gt=0
    ).first()
    if wac is not None and wac.average_unit_cost > Decimal("0"):
        return Decimal(str(wac.average_unit_cost)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    if curr == "CLP":
        raw = variant.effective_cost_price if variant else product.cost_price
        if raw and Decimal(str(raw)) > Decimal("0"):
            return Decimal(str(raw)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    return None


@transaction.atomic
def create_or_update_b2b_price_list(
    *,
    price_list_id=None,
    code: str,
    name: str,
    currency: str = "CLP",
    country: str = "CL",
    market: str = "",
    status: str = B2BPriceList.Status.ACTIVE,
    scope: str = B2BPriceList.Scope.SEGMENT,
    applicable_segment: str = "",
    organization: CustomerOrganization = None,
    customer_profile: CustomerProfile = None,
    priority: int = 100,
    valid_from=None,
    valid_until=None,
    min_margin_percent: Decimal = Decimal("10.00"),
    items: list[dict] = None,
    actor=None,
) -> B2BPriceList:
    if not (code or "").strip() or not (name or "").strip():
        raise CRMServiceError("El código y nombre de la lista B2B son obligatorios.")
    curr = (currency or "CLP").strip().upper()
    if curr not in ("CLP", "USD", "ARS"):
        raise CRMServiceError(f"Moneda '{curr}' no soportada.")
    if valid_from and valid_until and valid_until <= valid_from:
        raise CRMServiceError("La fecha de término de vigencia debe ser posterior al inicio.")

    if price_list_id:
        pl = B2BPriceList.objects.select_for_update().get(pk=price_list_id)
        pl.version += 1
        history = list(pl.change_history or [])
        history.append({
            "version": pl.version,
            "changed_at": timezone.now().isoformat(),
            "actor": getattr(actor, "email", "system"),
        })
        pl.change_history = history
    else:
        pl = B2BPriceList(
            code=code.strip().upper(),
            change_history=[{"version": 1, "changed_at": timezone.now().isoformat(), "actor": getattr(actor, "email", "system")}],
        )

    pl.name = name.strip()
    pl.currency = curr
    pl.country = (country or "CL").strip().upper()[:10]
    pl.market = (market or "").strip()
    if status in B2BPriceList.Status.values:
        pl.status = status
    if scope in B2BPriceList.Scope.values:
        pl.scope = scope
    pl.applicable_segment = (applicable_segment or "").strip()
    pl.organization = organization
    pl.customer_profile = customer_profile
    pl.priority = max(1, int(priority or 100))
    pl.valid_from = valid_from
    pl.valid_until = valid_until
    pl.min_margin_percent = Decimal(str(min_margin_percent or "0.00")).quantize(Decimal("0.01"))
    if actor and getattr(actor, "is_authenticated", False):
        pl.responsible_user = actor
    pl.save()

    if items is not None:
        pl.items.all().delete()
        for raw in items:
            prod = Product.objects.get(pk=raw["product_id"])
            var = ProductVariant.objects.get(pk=raw["variant_id"]) if raw.get("variant_id") else None
            mode = raw.get("pricing_mode") or B2BPriceListItem.PricingMode.FIXED_PRICE
            fixed_p = Decimal(str(raw["fixed_price"])).quantize(Decimal("0.01")) if raw.get("fixed_price") is not None else None
            disc_p = Decimal(str(raw.get("discount_percent") or "0.00")).quantize(Decimal("0.01"))
            if disc_p < Decimal("0.00") or disc_p > Decimal("100.00"):
                raise CRMServiceError("El porcentaje de descuento no puede ser negativo ni superior al 100%.")
            if fixed_p is not None and fixed_p < Decimal("0.00"):
                raise CRMServiceError("El precio fijo B2B no puede ser negativo.")

            pl_item = B2BPriceListItem.objects.create(
                price_list=pl,
                product=prod,
                variant=var,
                pricing_mode=mode,
                fixed_price=fixed_p,
                discount_percent=disc_p,
                min_quantity=max(1, int(raw.get("min_quantity") or 1)),
                max_discount_percent=Decimal(str(raw.get("max_discount_percent") or "100.00")),
                min_margin_percent=Decimal(str(raw["min_margin_percent"])) if raw.get("min_margin_percent") is not None else None,
            )
            prev_max = 0
            for t in sorted(raw.get("tiers") or [], key=lambda x: int(x["min_quantity"])):
                tmin = int(t["min_quantity"])
                tmax = int(t["max_quantity"]) if t.get("max_quantity") is not None else None
                if tmin <= 0 or (tmax is not None and tmax < tmin) or tmin <= prev_max:
                    raise CRMServiceError("Los tramos por volumen son contradictorios o se solapan.")
                prev_max = tmax if tmax is not None else 10**9
                t_price = Decimal(str(t["tier_price"])).quantize(Decimal("0.01")) if t.get("tier_price") is not None else None
                t_disc = Decimal(str(t["tier_discount_percent"])).quantize(Decimal("0.01")) if t.get("tier_discount_percent") is not None else None
                if t_disc is not None and (t_disc < Decimal("0.00") or t_disc > Decimal("100.00")):
                    raise CRMServiceError("Descuento de tramo por volumen inválido.")
                B2BPriceTier.objects.create(
                    price_list_item=pl_item,
                    min_quantity=tmin,
                    max_quantity=tmax,
                    tier_price=t_price,
                    tier_discount_percent=t_disc,
                )

    record_audit_event(
        module="orders",
        action="B2B_PRICE_LIST_SAVED",
        event_category=CATEGORY_MODIFICATION if price_list_id else CATEGORY_CREATION,
        resource_type="B2BPriceList",
        resource_id=str(pl.id),
        resource_repr=str(pl),
        actor=actor,
        new_values={"code": pl.code, "version": pl.version, "currency": pl.currency, "scope": pl.scope},
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return pl


def resolve_b2b_unit_price(
    *,
    product: Product,
    variant: Optional[ProductVariant] = None,
    quantity: int = 1,
    currency: str = "CLP",
    customer_profile: Optional[CustomerProfile] = None,
    organization: Optional[CustomerOrganization] = None,
    segment: Optional[str] = None,
    actor=None,
) -> dict:
    """
    BF-19: Política determinista de resolución de precios B2B:
    1. Contrato específico vigente del cliente / organización (CUSTOMER_CONTRACT).
    2. Lista B2B asignada a la empresa (ORGANIZATION).
    3. Lista B2B del segmento aplicable (SEGMENT).
    4. Precio público vigente como fallback.
    """
    curr = (currency or "CLP").strip().upper()
    qty = max(1, int(quantity or 1))
    now = timezone.now()
    catalog_price = _get_public_unit_price(product, variant, curr)

    eff_segment = segment or (
        organization.commercial_segment if organization else (customer_profile.commercial_segment if customer_profile else "")
    )

    active_lists = (
        B2BPriceList.objects.filter(status=B2BPriceList.Status.ACTIVE, currency=curr)
        .filter(Q(valid_from__isnull=True) | Q(valid_from__lte=now))
        .filter(Q(valid_until__isnull=True) | Q(valid_until__gte=now))
    )

    candidate_scopes = []
    if organization or customer_profile:
        q_contract = Q(scope=B2BPriceList.Scope.CUSTOMER_CONTRACT) & (
            (Q(organization=organization) if organization else Q(pk__isnull=True))
            | (Q(customer_profile=customer_profile) if customer_profile else Q(pk__isnull=True))
        )
        candidate_scopes.append((1, active_lists.filter(q_contract).order_by("priority", "-version")))
    if organization:
        candidate_scopes.append((2, active_lists.filter(scope=B2BPriceList.Scope.ORGANIZATION, organization=organization).order_by("priority", "-version")))
    if eff_segment:
        candidate_scopes.append((3, active_lists.filter(scope=B2BPriceList.Scope.SEGMENT, applicable_segment=eff_segment).order_by("priority", "-version")))

    matched_list = None
    matched_item = None
    for _, qs in candidate_scopes:
        for pl in qs:
            item = (
                B2BPriceListItem.objects.prefetch_related("tiers")
                .filter(price_list=pl, product=product, variant=variant, min_quantity__lte=qty)
                .first()
            )
            if item is None and variant is not None:
                item = (
                    B2BPriceListItem.objects.prefetch_related("tiers")
                    .filter(price_list=pl, product=product, variant__isnull=True, min_quantity__lte=qty)
                    .first()
                )
            if item is not None:
                matched_list = pl
                matched_item = item
                break
        if matched_item is not None:
            break

    proposed_price = catalog_price
    pricing_source = "public_catalog"
    price_list_version = None
    min_margin_req = Decimal("0.00")

    if matched_item is not None and matched_list is not None:
        price_list_version = matched_list.version
        min_margin_req = (
            matched_item.min_margin_percent
            if matched_item.min_margin_percent is not None
            else matched_list.min_margin_percent
        )
        # Evaluar escalones por volumen
        matched_tier = None
        for tier in matched_item.tiers.all():
            if qty >= tier.min_quantity and (tier.max_quantity is None or qty <= tier.max_quantity):
                matched_tier = tier
                break

        if matched_tier is not None:
            if matched_tier.tier_price is not None:
                proposed_price = matched_tier.tier_price
            elif matched_tier.tier_discount_percent is not None:
                factor = (Decimal("100.00") - matched_tier.tier_discount_percent) / Decimal("100.00")
                proposed_price = (catalog_price * factor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            upper = matched_tier.max_quantity or "+"
            pricing_source = f"{matched_list.code}:v{matched_list.version}:tier_{matched_tier.min_quantity}_{upper}"
        else:
            if matched_item.pricing_mode == B2BPriceListItem.PricingMode.FIXED_PRICE and matched_item.fixed_price is not None:
                proposed_price = matched_item.fixed_price
            else:
                disc = min(matched_item.discount_percent, matched_item.max_discount_percent)
                factor = (Decimal("100.00") - disc) / Decimal("100.00")
                proposed_price = (catalog_price * factor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            pricing_source = f"{matched_list.code}:v{matched_list.version}:{matched_list.scope}"

    disc_pct = Decimal("0.00")
    if catalog_price > Decimal("0.00") and proposed_price < catalog_price:
        disc_pct = ((catalog_price - proposed_price) / catalog_price * Decimal("100.00")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    unit_cost = _get_verifiable_unit_cost(product, variant, curr)
    can_see_costs = actor is not None and (
        is_effective_super_admin(actor)
        or user_has_capability(actor, PERM_VIEW_COSTS)
        or user_has_capability(actor, PERM_VIEW_MARGINS)
    )

    gross_margin_pct = None
    markup_pct = None
    below_min_margin = False
    margin_status = "pending_calculation"

    if unit_cost is not None and proposed_price > Decimal("0.00"):
        margin_status = "calculated"
        gross_margin_pct = (((proposed_price - unit_cost) / proposed_price) * Decimal("100.00")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        markup_pct = (((proposed_price - unit_cost) / unit_cost) * Decimal("100.00")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        if min_margin_req > Decimal("0.00") and gross_margin_pct < min_margin_req:
            below_min_margin = True

    return {
        "currency": curr,
        "quantity": qty,
        "catalog_unit_price": format_money_str(catalog_price, curr),
        "b2b_proposed_price": format_money_str(proposed_price, curr),
        "discount_percent": str(disc_pct),
        "pricing_source": pricing_source,
        "price_list_version": price_list_version,
        "margin_status": margin_status,
        "below_min_margin": below_min_margin,
        "min_margin_required": str(min_margin_req),
        "unit_cost": str(unit_cost) if (can_see_costs and unit_cost is not None) else None,
        "gross_margin_percent": str(gross_margin_pct) if (can_see_costs and gross_margin_pct is not None) else None,
        "markup_percent": str(markup_pct) if (can_see_costs and markup_pct is not None) else None,
    }


# ═══════════════════════════════════════════════════════════════════════════
# 3. BF-40: CRÉDITO COMERCIAL B2B (POLÍTICA SEGURA, SoD Y EXPOSICIÓN)
# ═══════════════════════════════════════════════════════════════════════════

def compute_credit_exposure(credit_account: CommercialCreditAccount) -> dict:
    """
    BF-40: Calcula exposición comercial en tiempo real sin confundir con libro contable AR (Gate 9).
    - No consume crédito por simples cotizaciones.
    - Evita doble contabilización entre órdenes y pagos parciales aprobados.
    """
    org = credit_account.organization
    curr = credit_account.currency

    # Órdenes confirmadas bajo crédito que aún no están canceladas ni 100% pagadas/reembolsadas
    credit_orders = Order.objects.filter(
        credit_account=credit_account,
        currency=curr,
    ).exclude(
        commercial_status=Order.CommercialStatusChoices.CANCELLED
    ).exclude(
        financial_status__in=[
            Order.FinancialStatusChoices.PAID,
            Order.FinancialStatusChoices.REFUNDED,
        ]
    )

    committed_gross = Decimal("0.00")
    paid_against_credit = Decimal("0.00")
    for ord_obj in credit_orders:
        committed_gross += Decimal(str(ord_obj.total or "0.00"))
        approved_paid = (
            ord_obj.payments.filter(status=PaymentStatus.APPROVED).aggregate(t=Sum("amount"))["t"]
            or Decimal("0.00")
        )
        paid_against_credit += Decimal(str(approved_paid))

    net_exposure = max(Decimal("0.00"), committed_gross - paid_against_credit).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    limit = Decimal(str(credit_account.credit_limit or "0.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    is_usable = (
        credit_account.status == CommercialCreditAccount.Status.ACTIVE
        and credit_account.policy_acknowledged
        and (credit_account.expires_at is None or credit_account.expires_at > timezone.now())
    )
    available = max(Decimal("0.00"), limit - net_exposure).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if is_usable else Decimal("0.00")
    utilization_pct = (
        (net_exposure / limit * Decimal("100.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if limit > Decimal("0.00")
        else Decimal("0.00")
    )

    return {
        "id": str(credit_account.id),
        "organization_id": str(org.id),
        "organization_code": org.code,
        "organization_name": org.trade_name or org.legal_name,
        "currency": curr,
        "status": credit_account.status,
        "payment_terms": credit_account.payment_terms,
        "policy_acknowledged": credit_account.policy_acknowledged,
        "credit_limit": format_money_str(limit, curr),
        "committed_exposure": format_money_str(net_exposure, curr),
        "paid_confirmed": format_money_str(paid_against_credit, curr),
        "available_credit": format_money_str(available, curr),
        "utilization_percent": str(utilization_pct),
        "is_usable": is_usable,
        "expires_at": credit_account.expires_at.isoformat() if credit_account.expires_at else None,
        "accounting_note": "Control comercial preventivo (Gate 8). Cuentas por cobrar AR corresponden a Gate 9.",
    }


@transaction.atomic
def request_credit_account(
    *,
    organization: CustomerOrganization,
    currency: str = "CLP",
    proposed_limit: Decimal = Decimal("0.00"),
    payment_terms: str = CommercialCreditAccount.PaymentTerms.NET_15,
    notes: str = "",
    actor=None,
) -> CommercialCreditAccount:
    """
    BF-40: Crea o solicita línea de crédito comercial.
    Política inicial de seguridad: NUNCA activa crédito automáticamente; nace en DISABLED_PENDING_POLICY o PENDING_APPROVAL.
    """
    curr = (currency or "CLP").strip().upper()
    if curr not in ("CLP", "USD", "ARS"):
        raise CRMServiceError("Moneda inválida para cuenta de crédito.")

    lim = Decimal(str(proposed_limit or "0.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if lim < Decimal("0.00"):
        raise CRMServiceError("El límite propuesto no puede ser negativo.")

    ca, created = CommercialCreditAccount.objects.select_for_update().get_or_create(
        organization=organization,
        currency=curr,
        defaults={
            "credit_limit": Decimal("0.00"),
            "payment_terms": payment_terms if payment_terms in CommercialCreditAccount.PaymentTerms.values else CommercialCreditAccount.PaymentTerms.NET_15,
            "status": (
                CommercialCreditAccount.Status.PENDING_APPROVAL
                if lim > Decimal("0.00")
                else CommercialCreditAccount.Status.DISABLED_PENDING_POLICY
            ),
            "requested_by": actor if getattr(actor, "is_authenticated", False) else None,
            "notes": (notes or "").strip(),
        },
    )
    if not created:
        prev_status = ca.status
        ca.status = CommercialCreditAccount.Status.PENDING_APPROVAL
        ca.requested_by = actor if getattr(actor, "is_authenticated", False) else ca.requested_by
        if notes:
            ca.notes = f"{ca.notes}\n{notes}".strip()
        ca.save(update_fields=["status", "requested_by", "notes", "updated_at"])
    else:
        prev_status = ""

    CommercialCreditDecision.objects.create(
        credit_account=ca,
        action=CommercialCreditDecision.Action.REQUESTED,
        previous_limit=ca.credit_limit,
        new_limit=lim,
        previous_status=prev_status,
        new_status=ca.status,
        notes=(notes or "").strip(),
        actor=actor if getattr(actor, "is_authenticated", False) else None,
    )
    record_audit_event(
        module="finances",
        action="B2B_CREDIT_REQUESTED",
        event_category=CATEGORY_FINANCIAL_OPERATION,
        resource_type="CommercialCreditAccount",
        resource_id=str(ca.id),
        resource_repr=str(ca),
        actor=actor,
        new_values={"currency": curr, "proposed_limit": str(lim), "status": ca.status},
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return ca


@transaction.atomic
def approve_or_update_credit_account(
    credit_account: CommercialCreditAccount,
    *,
    action: str,
    credit_limit: Optional[Decimal] = None,
    payment_terms: Optional[str] = None,
    expires_at=None,
    approval_evidence: str = "",
    policy_acknowledged: bool = False,
    notes: str = "",
    actor=None,
) -> CommercialCreditAccount:
    """
    BF-40: Aprueba, suspende o actualiza una línea de crédito comercial.
    - Requiere PERM_MANAGE_FINANCES o rol Gerencia/Finanzas/Super Admin.
    - Enforces SoD: un ejecutivo comercial (Sales) no puede aprobar ni incrementar unilateralmente.
    - Exige policy_acknowledged=True y approval_evidence para activar crédito real.
    """
    if actor is not None and not is_effective_super_admin(actor):
        roles = set(get_user_roles(actor))
        if not (user_has_capability(actor, PERM_MANAGE_FINANCES) or bool(roles & {ROLE_MANAGEMENT, ROLE_FINANCE})):
            raise CRMPermissionError(
                "No posee autorización financiera/gerencial para aprobar o modificar límites de crédito."
            )

    ca = CommercialCreditAccount.objects.select_for_update().get(pk=credit_account.pk)
    prev_limit = ca.credit_limit
    prev_status = ca.status

    if action == "approve":
        if (
            actor is not None
            and not is_effective_super_admin(actor)
            and ca.requested_by_id == getattr(actor, "id", None)
        ):
            raise CRMPermissionError(
                "Segregación de Funciones (SoD): quien solicita una línea de crédito no puede aprobarla."
            )
        if not policy_acknowledged or not (approval_evidence or "").strip():
            raise CRMServiceError(
                "Política de seguridad B2B: para activar una línea de crédito se requiere confirmación explícita "
                "de política comercial (policy_acknowledged=True) y evidencia documental de aprobación."
            )
        new_lim = Decimal(str(credit_limit if credit_limit is not None else ca.credit_limit)).quantize(Decimal("0.01"))
        if new_lim <= Decimal("0.00"):
            raise CRMServiceError("El límite autorizado debe ser mayor que cero para activar el crédito.")
        ca.credit_limit = new_lim
        ca.status = CommercialCreditAccount.Status.ACTIVE
        ca.policy_acknowledged = True
        ca.approval_evidence = approval_evidence.strip()
        ca.approved_by = actor if getattr(actor, "is_authenticated", False) else None
        ca.approved_at = timezone.now()
        if payment_terms in CommercialCreditAccount.PaymentTerms.values:
            ca.payment_terms = payment_terms
        if expires_at is not None:
            ca.expires_at = expires_at
        dec_action = CommercialCreditDecision.Action.APPROVED
    elif action == "suspend":
        ca.status = CommercialCreditAccount.Status.SUSPENDED
        dec_action = CommercialCreditDecision.Action.SUSPENDED
    elif action == "reject":
        ca.status = CommercialCreditAccount.Status.DISABLED_PENDING_POLICY
        dec_action = CommercialCreditDecision.Action.REJECTED
    else:
        raise CRMServiceError(f"Acción de crédito '{action}' inválida.")

    if notes:
        ca.notes = f"{ca.notes}\n{notes}".strip()
    ca.save()

    CommercialCreditDecision.objects.create(
        credit_account=ca,
        action=dec_action,
        previous_limit=prev_limit,
        new_limit=ca.credit_limit,
        previous_status=prev_status,
        new_status=ca.status,
        evidence=(approval_evidence or "").strip(),
        notes=(notes or "").strip(),
        actor=actor if getattr(actor, "is_authenticated", False) else None,
    )
    record_audit_event(
        module="finances",
        action=f"B2B_CREDIT_{dec_action.upper()}",
        event_category=CATEGORY_FINANCIAL_OPERATION,
        resource_type="CommercialCreditAccount",
        resource_id=str(ca.id),
        resource_repr=str(ca),
        actor=actor,
        previous_values={"limit": str(prev_limit), "status": prev_status},
        new_values={"limit": str(ca.credit_limit), "status": ca.status},
        severity=SEVERITY_HIGH,
        mandatory=True,
    )
    return ca


@transaction.atomic
def commit_credit_exposure_for_order(
    *,
    organization: CustomerOrganization,
    order: Order,
    actor=None,
) -> CommercialCreditAccount:
    """
    BF-40: Compromete línea de crédito al convertir/confirmar una orden a plazo (Net-15 / Net-30).
    Bloquea bajo select_for_update() cualquier operación que exceda el disponible o si la cuenta no está activa.
    """
    ca = CommercialCreditAccount.objects.select_for_update().filter(
        organization=organization,
        currency=order.currency,
    ).first()
    if ca is None:
        raise CRMServiceError(
            f"La organización no posee cuenta de crédito configurada en {order.currency}."
        )
    if ca.status != CommercialCreditAccount.Status.ACTIVE or not ca.policy_acknowledged:
        raise CRMServiceError(
            f"Crédito comercial bloqueado (estado: '{ca.status}'). No se autoriza operación a plazo sin habilitación aprobada."
        )
    if ca.expires_at and ca.expires_at <= timezone.now():
        ca.status = CommercialCreditAccount.Status.EXPIRED
        ca.save(update_fields=["status", "updated_at"])
        raise CRMServiceError("La autorización de crédito comercial ha vencido.")

    exposure = compute_credit_exposure(ca)
    avail = Decimal(exposure["available_credit"])
    if Decimal(str(order.total)) > avail:
        raise CRMServiceError(
            f"Exceso de línea de crédito: monto de orden ({order.total} {order.currency}) supera "
            f"el crédito disponible ({avail} {order.currency})."
        )

    order.credit_account = ca
    order.payment_terms = ca.payment_terms
    order.save(update_fields=["credit_account", "payment_terms", "updated_at"])

    CommercialCreditDecision.objects.create(
        credit_account=ca,
        action=CommercialCreditDecision.Action.EXPOSURE_COMMITTED,
        previous_limit=ca.credit_limit,
        new_limit=ca.credit_limit,
        previous_status=ca.status,
        new_status=ca.status,
        notes=f"Compromiso comercial por Orden #{str(order.id)[:8].upper()} ({order.total} {order.currency})",
        actor=actor if getattr(actor, "is_authenticated", False) else None,
    )
    return ca


# ═══════════════════════════════════════════════════════════════════════════
# 4. BF-20: COTIZADOR B2B PROFESIONAL, CICLO DE VIDA Y CONVERSIÓN OMS/WMS
# ═══════════════════════════════════════════════════════════════════════════

@transaction.atomic
def create_or_update_b2b_quote(
    *,
    quote_id=None,
    organization: Optional[CustomerOrganization] = None,
    customer_profile: Optional[CustomerProfile] = None,
    contact: Optional[CustomerContact] = None,
    company_name: str = "",
    tax_id: str = "",
    contact_name: str = "",
    email: str = "",
    phone: str = "",
    country: str = "CL",
    tax_regime: str = "",
    currency: str = "CLP",
    payment_terms: str = "prepaid",
    delivery_terms: str = "",
    valid_until=None,
    discount_percent: Decimal = Decimal("0.00"),
    client_notes: str = "",
    admin_notes: str = "",
    items: list[dict],
    actor=None,
) -> B2BQuote:
    if not items:
        raise CRMServiceError("Debe incluir al menos un producto en la cotización B2B.")

    curr = (currency or "CLP").strip().upper()
    if curr not in ("CLP", "USD", "ARS"):
        raise CRMServiceError(f"Moneda '{curr}' no soportada.")

    if contact is None and organization is not None:
        contact = organization.contacts.filter(is_active=True).order_by("-is_primary", "created_at").first()

    eff_company = (company_name or (organization.legal_name if organization else "") or (customer_profile.full_name if customer_profile else "")).strip()
    eff_tax = (tax_id or (organization.tax_id if organization else "") or (customer_profile.tax_id if customer_profile else "")).strip()
    eff_contact = (contact_name or (contact.full_name if contact else "") or (customer_profile.full_name if customer_profile else "") or (organization.trade_name or organization.legal_name if organization else "")).strip()
    eff_email = (email or (contact.email if contact else "") or (customer_profile.email if customer_profile else "") or (organization.billing_email if organization else "")).strip()
    eff_phone = (phone or (contact.phone if contact else "") or (organization.phone if organization else "")).strip()
    eff_country = (country or (organization.country if organization else "CL")).strip().upper()

    if not eff_company or not eff_contact or not eff_email:
        raise CRMServiceError("Razón social/cliente, contacto y email son obligatorios.")

    disc_global = Decimal(str(discount_percent or "0.00")).quantize(Decimal("0.01"))
    if disc_global > Decimal("0.00") and actor is not None and not is_effective_super_admin(actor):
        if not (user_has_capability(actor, PERM_APPLY_DISCOUNTS) and user_has_capability(actor, PERM_EDIT_PRICES)):
            raise CRMPermissionError("Los descuentos globales en cotizaciones B2B requieren autorización de Gerencia o Super Admin.")

    tax_contract = resolve_b2b_tax_contract(country=eff_country, currency=curr, tax_regime=tax_regime)

    if quote_id:
        quote = B2BQuote.objects.select_for_update().get(pk=quote_id)
        if quote.status == B2BQuoteStatus.CONVERTED:
            raise CRMServiceError("No se puede editar una cotización ya convertida en orden.")
        quote.version += 1
        hist = list(quote.version_history or [])
        hist.append({"version": quote.version, "updated_at": timezone.now().isoformat(), "actor": getattr(actor, "email", "system")})
        quote.version_history = hist
    else:
        quote = B2BQuote(
            quote_number=_next_code(B2BQuote, "quote_number", "QTE"),
            version=1,
            status=B2BQuoteStatus.DRAFT,
            version_history=[{"version": 1, "created_at": timezone.now().isoformat(), "actor": getattr(actor, "email", "system")}],
        )

    quote.organization = organization
    quote.customer_profile = customer_profile
    quote.contact = contact
    quote.user = (contact.user if contact and contact.user_id else (customer_profile.user if customer_profile and customer_profile.user_id else quote.user))
    quote.sales_rep = actor if getattr(actor, "is_authenticated", False) else quote.sales_rep
    quote.company_name = eff_company
    quote.tax_id = eff_tax or "N/A"
    quote.contact_name = eff_contact
    quote.email = eff_email
    quote.phone = eff_phone
    quote.country = eff_country
    quote.tax_regime = tax_contract.tax_regime
    quote.currency = curr
    quote.payment_terms = (payment_terms or "prepaid").strip()
    quote.delivery_terms = (delivery_terms or "").strip()
    quote.valid_until = valid_until or (timezone.now().date() + timedelta(days=15))
    quote.client_notes = (client_notes or "").strip()
    quote.admin_notes = (admin_notes or "").strip()

    subtotal = Decimal("0.00")
    built_lines = []
    for raw in items:
        prod = Product.objects.get(pk=raw["product_id"], is_active=True)
        var = ProductVariant.objects.get(pk=raw["variant_id"], product=prod) if raw.get("variant_id") else None
        qty = max(1, int(raw.get("quantity") or 1))

        resolved = resolve_b2b_unit_price(
            product=prod,
            variant=var,
            quantity=qty,
            currency=curr,
            customer_profile=customer_profile,
            organization=organization,
            actor=actor,
        )
        cat_p = Decimal(resolved["catalog_unit_price"])
        b2b_p = Decimal(resolved["b2b_proposed_price"])
        unit_p = Decimal(str(raw["unit_price"])).quantize(Decimal("0.01")) if raw.get("unit_price") is not None else b2b_p

        if unit_p != b2b_p and actor is not None and not is_effective_super_admin(actor):
            if not user_has_capability(actor, PERM_EDIT_PRICES):
                raise CRMPermissionError("No posee permiso 'edit_prices' para sobrescribir el precio calculado B2B.")

        line_sub = (unit_p * Decimal(qty)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        subtotal += line_sub
        built_lines.append({
            "product": prod,
            "variant": var,
            "product_name": prod.name,
            "sku_snapshot": var.sku if var else (prod.sku or ""),
            "variant_name_snapshot": var.name if var else "",
            "catalog_unit_price_snapshot": cat_p,
            "b2b_proposed_price_snapshot": b2b_p,
            "unit_price": unit_p,
            "discount_percent": Decimal(resolved["discount_percent"]),
            "quantity": qty,
            "subtotal": line_sub,
            "pricing_source": resolved["pricing_source"],
            "price_list_version": resolved["price_list_version"],
        })

    quote.subtotal = subtotal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    quote.discount_percent = disc_global
    quote.discount_amount = (quote.subtotal * disc_global / Decimal("100.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    net_after_disc = max(Decimal("0.00"), quote.subtotal - quote.discount_amount)
    quote.tax_amount = tax_contract.compute_tax(net_after_disc)
    quote.total = (net_after_disc + quote.tax_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    quote.save()

    quote.items.all().delete()
    for ln in built_lines:
        B2BQuoteItem.objects.create(quote=quote, **ln)

    return quote


@transaction.atomic
def transition_b2b_quote_status(
    quote: B2BQuote,
    *,
    target_status: str,
    actor=None,
) -> B2BQuote:
    locked = B2BQuote.objects.select_for_update().get(pk=quote.pk)
    if target_status not in B2BQuoteStatus.values:
        raise CRMServiceError(f"Estado de cotización inválido: '{target_status}'.")
    if locked.status == B2BQuoteStatus.CONVERTED:
        raise CRMServiceError("Una cotización convertida no puede cambiar de estado.")

    if target_status in (B2BQuoteStatus.APPROVED, B2BQuoteStatus.ISSUED):
        tax_contract = resolve_b2b_tax_contract(
            country=locked.country,
            currency=locked.currency,
            tax_regime=locked.tax_regime,
        )
        if not tax_contract.is_resolved:
            raise CRMServiceError(tax_contract.reason)

    now = timezone.now()
    locked.status = target_status
    if target_status == B2BQuoteStatus.APPROVED:
        locked.approved_by = actor if getattr(actor, "is_authenticated", False) else None
        locked.approved_at = now
    elif target_status == B2BQuoteStatus.ISSUED:
        locked.issued_at = locked.issued_at or now
    elif target_status == B2BQuoteStatus.SENT:
        locked.shared_at = locked.shared_at or now
    locked.save()

    record_audit_event(
        module="orders",
        action="B2B_QUOTE_STATUS_CHANGED",
        event_category=CATEGORY_MODIFICATION,
        resource_type="B2BQuote",
        resource_id=str(locked.id),
        resource_repr=str(locked),
        actor=actor,
        new_values={"status": locked.status, "version": locked.version},
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return locked


@transaction.atomic
def generate_b2b_quote_share_link(
    quote: B2BQuote,
    *,
    expires_in_hours: int = 72,
    base_frontend_url: str = None,
    actor=None,
) -> dict:
    locked = B2BQuote.objects.select_for_update().get(pk=quote.pk)
    if locked.status in (B2BQuoteStatus.REJECTED, B2BQuoteStatus.EXPIRED):
        raise CRMServiceError(f"No se puede compartir una cotización en estado '{locked.status}'.")

    now = timezone.now()
    exp_at = now + timedelta(hours=max(1, int(expires_in_hours or 72)))
    nonce = secrets.token_hex(4)
    signer = signing.Signer(salt=B2B_SHARE_TOKEN_SALT)
    token = signer.sign(f"{locked.id.hex}.{nonce}")

    locked.share_token = token
    locked.share_token_expires_at = exp_at
    locked.shared_at = now
    if locked.status in (B2BQuoteStatus.DRAFT, B2BQuoteStatus.APPROVED, B2BQuoteStatus.ISSUED):
        locked.status = B2BQuoteStatus.SENT
    locked.save(update_fields=["share_token", "share_token_expires_at", "shared_at", "status", "updated_at"])

    base_url = (base_frontend_url or getattr(settings, "FRONTEND_URL", "") or "https://levelproaudio.cl").rstrip("/")
    share_url = f"{base_url}/b2b/quote/{urllib.parse.quote(token, safe='')}"
    q_code = locked.quote_number or f"QTE-{str(locked.id)[:8].upper()}"
    wa_text = f"Hola, te compartimos la cotización B2B LevelPro Audio ({q_code}) en {locked.currency}: {share_url}"
    wa_url = f"https://wa.me/?text={urllib.parse.quote(wa_text, safe='')}"

    return {
        "quote_id": str(locked.id),
        "quote_number": q_code,
        "share_token": token,
        "share_url": share_url,
        "wa_me_url": wa_url,
        "expires_at": exp_at.isoformat(),
    }


@transaction.atomic
def convert_b2b_quote_with_credit_check(
    quote: B2BQuote,
    *,
    idempotency_key: Optional[str] = None,
    shipping_address: Optional[str] = None,
    actor=None,
) -> tuple[Order, bool]:
    locked = B2BQuote.objects.select_for_update().get(pk=quote.pk)
    if locked.valid_until and locked.valid_until < timezone.now().date() and locked.status != B2BQuoteStatus.CONVERTED:
        locked.status = B2BQuoteStatus.EXPIRED
        locked.save(update_fields=["status", "updated_at"])
        raise CRMServiceError("La cotización ha vencido y no puede convertirse en pedido.")

    if locked.status in (B2BQuoteStatus.ISSUED, B2BQuoteStatus.SENT, B2BQuoteStatus.ACCEPTED):
        locked.status = B2BQuoteStatus.APPROVED
        locked.save(update_fields=["status", "updated_at"])

    try:
        order, is_replay = convert_b2b_quote_to_order(
            locked,
            idempotency_key=idempotency_key,
            shipping_address=shipping_address,
            actor=actor,
        )
    except B2BPreflightError as exc:
        raise CRMServiceError(str(exc)) from exc

    if not is_replay and locked.payment_terms in ("net_15", "net_30"):
        if not locked.organization_id:
            raise CRMServiceError("Las ventas a plazo (Net-15/Net-30) requieren una organización CRM vinculada.")
        commit_credit_exposure_for_order(
            organization=locked.organization,
            order=order,
            actor=actor,
        )

    return order, is_replay
