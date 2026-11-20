# core/audit/__init__.py
"""Módulo transversal de trazabilidad, eventos de auditoría y análisis forense LEVELPRO OS V4.0."""

from .constants import *  # noqa
from .context import (
    get_current_correlation_id,
    get_current_ip,
    get_current_user_agent,
    get_current_user,
    set_current_audit_context,
)
from .sanitizer import (
    sanitize_audit_payload,
    compute_state_diff,
    mask_payload_financial_data,
)
from .services import (
    record_audit_event,
    record_out_of_band_audit_event,
    get_audit_events_queryset,
)

__all__ = [
    "get_current_correlation_id",
    "get_current_ip",
    "get_current_user_agent",
    "get_current_user",
    "set_current_audit_context",
    "sanitize_audit_payload",
    "compute_state_diff",
    "mask_payload_financial_data",
    "record_audit_event",
    "record_out_of_band_audit_event",
    "get_audit_events_queryset",
]
