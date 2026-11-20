# apps/analytics/views_audit.py
"""Vistas API para el Centro de Registro de Actividad y Auditoría LEVELPRO OS V4.0 (Gate 1.2)."""

import csv
from datetime import datetime
from django.http import HttpResponse, Http404
from django.utils import timezone
from django.core.paginator import Paginator
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status

from core.admin_permissions import IsAdminOrStaff, rbac_endpoint
from core.rbac.constants import (
    MODULE_AUDIT,
    ALL_MODULES,
    PERM_VIEW_AUDIT,
    PERM_VIEW_SECURITY_AUDIT,
    PERM_VIEW_FINANCIAL_AUDIT,
    PERM_EXPORT_AUDIT,
    PERM_VIEW_COSTS,
    PERM_VIEW_MARGINS,
    PERM_VIEW_FINANCES,
    ROLE_SUPER_ADMIN,
    ROLE_MANAGEMENT,
    ROLE_FINANCE,
)
from core.rbac.permissions import user_has_capability, is_effective_super_admin
from core.audit.constants import (
    ALL_CATEGORIES,
    CATEGORY_LABELS,
    ALL_SEVERITIES,
    SEVERITY_LABELS,
    ALL_RESULTS,
    RESULT_LABELS,
    CATEGORY_ROLE_PERMISSION,
    CATEGORY_SECURITY_DENIED,
    CATEGORY_PRIVILEGE_ESCALATION,
    CATEGORY_EXPORT,
    SEVERITY_WARNING,
    RESULT_SUCCESS,
)
from core.audit.sanitizer import mask_payload_financial_data
from core.audit.services import (
    get_audit_events_queryset,
    get_audit_summary,
    record_audit_event,
)
from .models import AuditEvent


def _can_view_financials(user):
    """Verifica si el usuario tiene autorización para ver datos financieros y costos en auditoría."""
    if is_effective_super_admin(user):
        return True
    return (
        user_has_capability(user, PERM_VIEW_FINANCIAL_AUDIT)
        or user_has_capability(user, PERM_VIEW_FINANCES)
    )


def _serialize_audit_event(event: AuditEvent, user):
    """Serializa un evento aplicando enmascaramiento dinámico RBAC."""
    can_finances = _can_view_financials(user)
    can_costs = is_effective_super_admin(user) or user_has_capability(user, PERM_VIEW_COSTS) or can_finances
    can_margins = is_effective_super_admin(user) or user_has_capability(user, PERM_VIEW_MARGINS) or can_finances

    masked_prev = mask_payload_financial_data(
        event.previous_values or {},
        can_view_costs=can_costs,
        can_view_margins=can_margins,
        can_view_finances=can_finances,
    )
    masked_new = mask_payload_financial_data(
        event.new_values or {},
        can_view_costs=can_costs,
        can_view_margins=can_margins,
        can_view_finances=can_finances,
    )
    masked_meta = mask_payload_financial_data(
        event.metadata or {},
        can_view_costs=can_costs,
        can_view_margins=can_margins,
        can_view_finances=can_finances,
    )

    return {
        "id": str(event.id),
        "created_at": event.created_at.isoformat(),
        "actor": {
            "id": str(event.actor.id) if event.actor else None,
            "email": event.actor_email,
            "username": event.actor_username,
            "type": event.actor_type,
            "roles": event.actor_roles,
        },
        "module": event.module,
        "action": event.action,
        "event_category": event.event_category,
        "category_label": CATEGORY_LABELS.get(event.event_category, event.event_category),
        "resource_type": event.resource_type,
        "resource_id": event.resource_id,
        "resource_repr": event.resource_repr,
        "result": event.result,
        "result_label": RESULT_LABELS.get(event.result, event.result),
        "severity": event.severity,
        "severity_label": SEVERITY_LABELS.get(event.severity, event.severity),
        "previous_values": masked_prev,
        "new_values": masked_new,
        "changed_fields": event.changed_fields,
        "correlation_id": event.correlation_id,
        "source": event.source,
        "ip_address": event.ip_address,
        "user_agent": event.user_agent,
        "metadata": masked_meta,
        "schema_version": event.schema_version,
        "financial_masked": not can_finances,
    }


@rbac_endpoint(
    module=MODULE_AUDIT,
    capability=PERM_VIEW_AUDIT,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_FINANCE],
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def audit_events_list_view(request):
    """
    Listado paginado de eventos de auditoría con soporte exhaustivo de filtros
    y segregación de seguridad RBAC.
    """
    filters = {
        "date_from": request.query_params.get("date_from"),
        "date_to": request.query_params.get("date_to"),
        "actor": request.query_params.get("actor"),
        "role": request.query_params.get("role"),
        "module": request.query_params.get("module"),
        "action": request.query_params.get("action"),
        "event_category": request.query_params.get("event_category") or request.query_params.get("category"),
        "resource_type": request.query_params.get("resource_type"),
        "resource_id": request.query_params.get("resource_id"),
        "result": request.query_params.get("result"),
        "severity": request.query_params.get("severity"),
        "correlation_id": request.query_params.get("correlation_id"),
        "search": request.query_params.get("search"),
    }

    qs = get_audit_events_queryset(request.user, filters)

    try:
        page_num = max(1, int(request.query_params.get("page", 1)))
    except (ValueError, TypeError):
        page_num = 1

    try:
        page_size = min(100, max(5, int(request.query_params.get("page_size", 25))))
    except (ValueError, TypeError):
        page_size = 25

    paginator = Paginator(qs, page_size)
    page_obj = paginator.get_page(page_num)

    serialized_events = [_serialize_audit_event(ev, request.user) for ev in page_obj.object_list]

    return Response({
        "count": paginator.count,
        "total_pages": paginator.num_pages,
        "current_page": page_obj.number,
        "page_size": page_size,
        "results": serialized_events,
    })


@rbac_endpoint(
    module=MODULE_AUDIT,
    capability=PERM_VIEW_AUDIT,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_FINANCE],
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def audit_event_detail_view(request, event_id):
    """Detalle forense de un evento de auditoría específico con diff estructurado."""
    try:
        event = AuditEvent.objects.select_related("actor").get(pk=event_id)
    except (AuditEvent.DoesNotExist, ValueError):
        raise Http404("Evento de auditoría no encontrado.")

    # Verificar si el evento es de seguridad y el usuario carece de permiso
    is_security_category = event.event_category in [
        CATEGORY_ROLE_PERMISSION,
        CATEGORY_SECURITY_DENIED,
        CATEGORY_PRIVILEGE_ESCALATION,
    ]
    if is_security_category and not (
        is_effective_super_admin(request.user)
        or user_has_capability(request.user, PERM_VIEW_SECURITY_AUDIT)
    ):
        return Response(
            {"error": "No posee autorización (view_security_audit) para consultar este evento de seguridad."},
            status=status.HTTP_403_FORBIDDEN,
        )

    return Response(_serialize_audit_event(event, request.user))


@rbac_endpoint(
    module=MODULE_AUDIT,
    capability=PERM_VIEW_AUDIT,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_FINANCE],
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def audit_summary_view(request):
    """Métricas y KPIs consolidados para el Centro de Registro de Actividad."""
    summary_data = get_audit_summary(request.user)
    return Response(summary_data)


@rbac_endpoint(
    module=MODULE_AUDIT,
    capability=PERM_VIEW_AUDIT,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_FINANCE],
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def audit_catalog_view(request):
    """Catálogo oficial de taxonomía, categorías, módulos y severidades con etiquetas legibles."""
    return Response({
        "categories": [{"key": k, "label": CATEGORY_LABELS.get(k, k)} for k in ALL_CATEGORIES],
        "severities": [{"key": k, "label": SEVERITY_LABELS.get(k, k)} for k in ALL_SEVERITIES],
        "results": [{"key": k, "label": RESULT_LABELS.get(k, k)} for k in ALL_RESULTS],
        "modules": [{"key": m, "label": m.capitalize()} for m in ALL_MODULES],
    })


@rbac_endpoint(
    module=MODULE_AUDIT,
    capability=PERM_EXPORT_AUDIT,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_FINANCE],
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def audit_export_view(request):
    """
    Exportación de registros de auditoría a CSV.
    Aplica enmascaramiento RBAC dinámico y audita síncronamente la exportación.
    """
    filters = {
        "date_from": request.query_params.get("date_from"),
        "date_to": request.query_params.get("date_to"),
        "actor": request.query_params.get("actor"),
        "role": request.query_params.get("role"),
        "module": request.query_params.get("module"),
        "action": request.query_params.get("action"),
        "event_category": request.query_params.get("event_category") or request.query_params.get("category"),
        "result": request.query_params.get("result"),
        "severity": request.query_params.get("severity"),
        "search": request.query_params.get("search"),
    }

    qs = get_audit_events_queryset(request.user, filters)[:5000]

    response = HttpResponse(content_type="text/csv; charset=utf-8")
    filename = f"audit_trail_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
    response["Content-Disposition"] = f'attachment; filename="{filename}"'

    writer = csv.writer(response)
    writer.writerow([
        "ID",
        "Fecha UTC",
        "Actor Email",
        "Actor Username",
        "Roles al Momento",
        "Módulo",
        "Acción",
        "Categoría",
        "Recurso Tipo",
        "Recurso ID",
        "Recurso Representación",
        "Resultado",
        "Severidad",
        "Correlation ID",
        "IP",
        "Campos Modificados",
    ])

    for ev in qs:
        writer.writerow([
            str(ev.id),
            ev.created_at.isoformat(),
            ev.actor_email,
            ev.actor_username,
            ", ".join(ev.actor_roles or []),
            ev.module,
            ev.action,
            CATEGORY_LABELS.get(ev.event_category, ev.event_category),
            ev.resource_type,
            ev.resource_id,
            ev.resource_repr,
            RESULT_LABELS.get(ev.result, ev.result),
            SEVERITY_LABELS.get(ev.severity, ev.severity),
            ev.correlation_id,
            ev.ip_address or "",
            ", ".join(ev.changed_fields or []),
        ])

    # Registrar el evento de exportación en la auditoría
    try:
        record_audit_event(
            module=MODULE_AUDIT,
            action="SENSITIVE_DATA_EXPORTED",
            event_category=CATEGORY_EXPORT,
            resource_type="AuditExport",
            resource_id=filename,
            resource_repr=f"Exportación CSV de {len(qs)} eventos de auditoría",
            actor=request.user,
            result=RESULT_SUCCESS,
            severity=SEVERITY_WARNING,
            metadata={"exported_count": len(qs), "filename": filename},
        )
    except Exception:
        pass

    return response
