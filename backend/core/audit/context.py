# core/audit/context.py
"""Gestión de contexto de ejecución de auditoría (correlation ID, IP, User-Agent, Actor) mediante ContextVars."""

import uuid
from contextvars import ContextVar

_correlation_id_ctx: ContextVar[str] = ContextVar("audit_correlation_id", default="")
_ip_address_ctx: ContextVar[str] = ContextVar("audit_ip_address", default="")
_user_agent_ctx: ContextVar[str] = ContextVar("audit_user_agent", default="")
_current_user_ctx: ContextVar[object] = ContextVar("audit_current_user", default=None)


def set_current_audit_context(correlation_id=None, ip_address=None, user_agent=None, user=None):
    """Establece las variables de contexto para la solicitud actual."""
    if correlation_id:
        _correlation_id_ctx.set(correlation_id)
    if ip_address is not None:
        _ip_address_ctx.set(ip_address)
    if user_agent is not None:
        _user_agent_ctx.set(user_agent)
    if user is not None:
        _current_user_ctx.set(user)


def get_current_correlation_id() -> str:
    val = _correlation_id_ctx.get()
    if not val:
        val = str(uuid.uuid4())
        _correlation_id_ctx.set(val)
    return val


def get_current_ip() -> str:
    return _ip_address_ctx.get() or None


def get_current_user_agent() -> str:
    return _user_agent_ctx.get() or ""


def clear_current_audit_context():
    """Limpia las variables de contexto de auditoría para el hilo/coroutine actual."""
    _correlation_id_ctx.set("")
    _ip_address_ctx.set("")
    _user_agent_ctx.set("")
    _current_user_ctx.set(None)


def get_current_user():
    return _current_user_ctx.get()
