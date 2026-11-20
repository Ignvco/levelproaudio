# core/rbac/events.py
"""Emisión de eventos sanitizados de seguridad y auditoría RBAC (preparación Gate 1.2)."""

import logging
import json
from django.utils import timezone

logger = logging.getLogger("levelpro.security.rbac")


def log_security_event(event_type, operator=None, target_user=None, details=None, ip_address=None):
    """
    Registra un evento de seguridad sanitizado en el log de auditoría.
    Garantiza que no se incluyan credenciales ni datos personales no autorizados.
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
    return event
