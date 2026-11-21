# core/rbac/events.py
"""Emisión de eventos sanitizados de seguridad y auditoría RBAC (Gate 1.2)."""

import logging
import json
from django.utils import timezone
from core.audit.services import record_audit_event
from core.audit.constants import (
    CATEGORY_ROLE_PERMISSION,
    CATEGORY_PRIVILEGE_ESCALATION,
    SEVERITY_INFO,
    SEVERITY_WARNING,
    SEVERITY_CRITICAL,
    RESULT_SUCCESS,
    RESULT_DENIED,
)

logger = logging.getLogger("levelpro.security.rbac")


def log_security_event(event_type, operator=None, target_user=None, details=None, ip_address=None):
    """
    Registra un evento de seguridad sanitizado tanto en los logs estructurados
    como en la base de datos de auditoría (AuditEvent) con semántica inmutable.
    """
    event = {
        "timestamp": timezone.now().isoformat(),
        "event_type": event_type,
        "operator_id": str(operator.id) if operator and hasattr(operator, "id") else None,
        "operator_email": getattr(operator, "email", "system"),
        "target_user_id": str(target_user.id) if target_user and hasattr(target_user, "id") else None,
        "target_user_email": getattr(target_user, "email", None),
        "details": details or {},
        "ip_address": ip_address,
    }
    logger.info("SECURITY_EVENT_RBAC: %s", json.dumps(event))

    # Mapeo a modelo AuditEvent
    action = event_type
    if "ESCALAT" in event_type.upper():
        category = CATEGORY_PRIVILEGE_ESCALATION
        severity = SEVERITY_CRITICAL
        result = RESULT_DENIED
    else:
        category = CATEGORY_ROLE_PERMISSION
        severity = SEVERITY_CRITICAL if (details and "Super Admin" in str(details)) else SEVERITY_WARNING
        result = RESULT_SUCCESS

    target_email = getattr(target_user, "email", "")
    target_id = str(target_user.id) if target_user and hasattr(target_user, "id") else ""

    try:
        record_audit_event(
            module="roles",
            action=action,
            event_category=category,
            resource_type="User",
            resource_id=target_id,
            resource_repr=f"Usuario {target_email or target_id}",
            actor=operator,
            result=result,
            severity=severity,
            metadata=details or {},
            ip_address=ip_address,
            source="api",
            mandatory=False,
        )
    except Exception as exc:
        logger.warning("No se pudo persistir AuditEvent desde log_security_event: %s", exc)

    return event
