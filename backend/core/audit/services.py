# core/audit/services.py
"""Servicio transaccional de registro, consulta y análisis forense de eventos de auditoría."""

import logging
from django.db import transaction, connection
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db.models import Q, Count

from apps.analytics.models import AuditEvent
from core.rbac.services import get_user_roles
from core.rbac.permissions import user_has_capability
from core.rbac.constants import (
    PERM_VIEW_SECURITY_AUDIT,
    PERM_VIEW_FINANCIAL_AUDIT,
    PERM_VIEW_COSTS,
    PERM_VIEW_MARGINS,
    PERM_VIEW_FINANCES,
)
from .constants import (
    RESULT_SUCCESS,
    RESULT_DENIED,
    RESULT_FAILED,
    SEVERITY_INFO,
    SEVERITY_HIGH,
    SOURCE_API,
    ACTOR_USER,
    ACTOR_SYSTEM,
    CATEGORY_ROLE_PERMISSION,
    CATEGORY_SECURITY_DENIED,
    CATEGORY_PRIVILEGE_ESCALATION,
)
from .context import (
    get_current_correlation_id,
    get_current_ip,
    get_current_user_agent,
    get_current_user,
)
from .sanitizer import (
    sanitize_audit_payload,
    compute_state_diff,
    mask_payload_financial_data,
)

logger = logging.getLogger("levelpro.audit")
User = get_user_model()


def _resolve_actor_info(actor=None, actor_type=None):
    """Resuelve la información y snapshot de roles del actor."""
    resolved_actor = actor if actor is not None else get_current_user()

    if resolved_actor and getattr(resolved_actor, "is_authenticated", False):
        user_obj = resolved_actor
        a_type = actor_type or ACTOR_USER
        email = getattr(user_obj, "email", "") or ""
        username = getattr(user_obj, "username", "") or email
        try:
            roles = get_user_roles(user_obj)
        except Exception:
            roles = []
        return user_obj, a_type, email, username, roles

    # Sistema o anónimo / integración
    a_type = actor_type or ACTOR_SYSTEM
    return None, a_type, "system@levelproaudio.com", "system", ["Sistema"]


def record_audit_event(
    module: str,
    action: str,
    event_category: str,
    resource_type: str,
    resource_id: str = "",
    resource_repr: str = "",
    actor=None,
    actor_type: str = None,
    result: str = RESULT_SUCCESS,
    severity: str = SEVERITY_INFO,
    previous_values: dict = None,
    new_values: dict = None,
    changed_fields: list = None,
    metadata: dict = None,
    correlation_id: str = None,
    ip_address: str = None,
    user_agent: str = None,
    source: str = SOURCE_API,
    mandatory: bool = False,
) -> AuditEvent:
    """
    Registra síncronamente un evento de auditoría dentro de la transacción activa.
    Si mandatory=True y el guardado falla, levanta excepción provocando el rollback de la mutación de negocio.
    """
    try:
        user_obj, resolved_actor_type, email, username, roles = _resolve_actor_info(actor, actor_type)

        clean_prev = sanitize_audit_payload(previous_values or {})
        clean_new = sanitize_audit_payload(new_values or {})
        clean_meta = sanitize_audit_payload(metadata or {})

        c_fields = list(changed_fields or [])
        if not c_fields and (clean_prev or clean_new):
            c_fields = sorted(list(set(clean_prev.keys()).union(set(clean_new.keys()))))

        cid = correlation_id or get_current_correlation_id()
        ip = ip_address or get_current_ip()
        ua = user_agent if user_agent is not None else get_current_user_agent()

        event = AuditEvent.objects.create(
            actor=user_obj,
            actor_type=resolved_actor_type,
            actor_email=email,
            actor_username=username,
            actor_roles=roles,
            module=module,
            action=action,
            event_category=event_category,
            resource_type=resource_type,
            resource_id=str(resource_id or "")[:80],
            resource_repr=str(resource_repr or "")[:255],
            result=result,
            severity=severity,
            previous_values=clean_prev,
            new_values=clean_new,
            changed_fields=c_fields,
            correlation_id=cid[:64],
            source=source[:50],
            ip_address=ip,
            user_agent=ua[:1000] if ua else "",
            metadata=clean_meta,
            schema_version="1.0",
        )
        return event

    except Exception as exc:
        logger.error("Error registrando evento de auditoría [%s:%s]: %s", module, action, exc, exc_info=True)
        if mandatory:
            raise
        return None


def record_out_of_band_audit_event(
    module: str,
    action: str,
    event_category: str,
    resource_type: str,
    resource_id: str = "",
    resource_repr: str = "",
    actor=None,
    actor_type: str = None,
    result: str = RESULT_DENIED,
    severity: str = SEVERITY_HIGH,
    metadata: dict = None,
    correlation_id: str = None,
    ip_address: str = None,
    user_agent: str = None,
    source: str = SOURCE_API,
) -> AuditEvent:
    """
    Registra un evento fuera de banda (por ejemplo, accesos denegados o fallos)
    garantizando su persistencia inmediata incluso si la transacción de negocio fue abortada.
    """
    try:
        user_obj, resolved_actor_type, email, username, roles = _resolve_actor_info(actor, actor_type)
        cid = correlation_id or get_current_correlation_id()
        ip = ip_address or get_current_ip()
        ua = user_agent if user_agent is not None else get_current_user_agent()
        clean_meta = sanitize_audit_payload(metadata or {})

        event = AuditEvent.objects.create(
            actor=user_obj,
            actor_type=resolved_actor_type,
            actor_email=email,
            actor_username=username,
            actor_roles=roles,
            module=module,
            action=action,
            event_category=event_category,
            resource_type=resource_type,
            resource_id=str(resource_id or "")[:80],
            resource_repr=str(resource_repr or "")[:255],
            result=result,
            severity=severity,
            previous_values={},
            new_values={},
            changed_fields=[],
            correlation_id=cid[:64],
            source=source[:50],
            ip_address=ip,
            user_agent=ua[:1000] if ua else "",
            metadata=clean_meta,
            schema_version="1.0",
        )
        return event
    except Exception as exc:
        logger.error("Error persistiendo evento fuera de banda [%s:%s]: %s", module, action, exc, exc_info=True)
        return None


def get_audit_events_queryset(user, filters: dict = None):
    """
    Construye el QuerySet de eventos aplicando filtrado dinámico y segregación RBAC.
    """
    qs = AuditEvent.objects.all().select_related("actor")
    filters = filters or {}

    # Segregación RBAC: Si el usuario no tiene view_security_audit, ocultar eventos de seguridad y roles.
    has_security_perm = user_has_capability(user, PERM_VIEW_SECURITY_AUDIT) or getattr(user, "is_superuser", False)
    if not has_security_perm:
        qs = qs.exclude(
            event_category__in=[
                CATEGORY_ROLE_PERMISSION,
                CATEGORY_SECURITY_DENIED,
                CATEGORY_PRIVILEGE_ESCALATION,
            ]
        )

    # Filtros de fecha
    date_from = filters.get("date_from")
    if date_from:
        qs = qs.filter(created_at__gte=date_from)

    date_to = filters.get("date_to")
    if date_to:
        qs = qs.filter(created_at__lte=date_to)

    # Filtro de módulo
    module = filters.get("module")
    if module:
        qs = qs.filter(module__iexact=module)

    # Filtro de acción
    action = filters.get("action")
    if action:
        qs = qs.filter(action__iexact=action)

    # Filtro de categoría
    category = filters.get("event_category") or filters.get("category")
    if category:
        qs = qs.filter(event_category__iexact=category)

    # Filtro de severidad
    severity = filters.get("severity")
    if severity:
        qs = qs.filter(severity__iexact=severity)

    # Filtro de resultado
    result = filters.get("result")
    if result:
        qs = qs.filter(result__iexact=result)

    # Filtro de actor
    actor = filters.get("actor")
    if actor:
        qs = qs.filter(Q(actor_email__icontains=actor) | Q(actor_username__icontains=actor))

    # Filtro de rol
    role = filters.get("role")
    if role:
        qs = qs.filter(actor_roles__contains=[role])

    # Filtro de correlation_id
    correlation_id = filters.get("correlation_id")
    if correlation_id:
        qs = qs.filter(correlation_id=correlation_id)

    # Filtro de recurso
    resource_type = filters.get("resource_type")
    if resource_type:
        qs = qs.filter(resource_type__iexact=resource_type)

    resource_id = filters.get("resource_id")
    if resource_id:
        qs = qs.filter(resource_id=str(resource_id))

    # Búsqueda libre
    search = filters.get("search")
    if search:
        search_terms = search.strip()
        qs = qs.filter(
            Q(resource_repr__icontains=search_terms)
            | Q(actor_email__icontains=search_terms)
            | Q(action__icontains=search_terms)
            | Q(resource_id__icontains=search_terms)
            | Q(correlation_id__icontains=search_terms)
            | Q(ip_address__icontains=search_terms)
        )

    return qs.order_by("-created_at")


def get_audit_summary(user):
    """Calcula KPIs consolidados para el Centro de Registro de Actividad."""
    base_qs = get_audit_events_queryset(user, {})
    total_events = base_qs.count()

    critical_count = base_qs.filter(severity__in=["high", "critical"]).count()
    denied_count = base_qs.filter(result="denied").count()

    modules_breakdown = list(
        base_qs.values("module")
        .annotate(count=Count("id"))
        .order_by("-count")[:10]
    )

    severities_breakdown = list(
        base_qs.values("severity")
        .annotate(count=Count("id"))
        .order_by("-count")
    )

    return {
        "total_events": total_events,
        "critical_events": critical_count,
        "denied_events": denied_count,
        "by_module": modules_breakdown,
        "by_severity": severities_breakdown,
    }
