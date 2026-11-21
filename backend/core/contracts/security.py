# backend/core/contracts/security.py
"""
LEVELPRO OS V4.0 — GATE 1.4: BUSINESS CORE CONTRACTS
Integración de Contratos de Negocio con RBAC Granular y Audit Trail.
Protege las operaciones críticas de contratos (cancelaciones, reembolsos, ajustes de stock)
exigiendo permisos explícitos y registrando intentos denegados.
"""

from typing import Any, Optional

from core.audit.constants import (
    CATEGORY_SECURITY_DENIED,
    SEVERITY_WARNING,
    ACTOR_USER,
    SOURCE_API,
)
from core.audit.services import record_audit_event


class ContractPermissionDeniedError(PermissionError):
    """Lanzada cuando un usuario intenta ejecutar una operación de contrato sin autorización RBAC."""
    pass


# Permisos Granulares Estándar para Contratos de Negocio
PERM_ORDER_CANCEL        = "orders.change_order"
PERM_PAYMENT_REFUND       = "payments.change_payment"
PERM_STOCK_MANUAL_ADJUST = "products.change_product"
PERM_VIEW_FINANCIAL      = "payments.view_payment"


def check_contract_permission(
    user: Any,
    permission_codename: str,
    resource_type: str = "ContractOperation",
    resource_id: str = "",
    action_name: str = "CONTRACT_EXECUTION",
) -> bool:
    """
    Verifica que el usuario posea el permiso requerido.
    Si el acceso es denegado, registra automáticamente el evento en Audit Trail y retorna False.
    """
    if not user or not getattr(user, "is_authenticated", False):
        _record_denied(user, permission_codename, resource_type, resource_id, action_name, "Usuario no autenticado")
        return False

    if getattr(user, "is_superuser", False):
        return True

    # Verificar permiso granular en grupos y permisos de Django
    has_perm = user.has_perm(permission_codename)
    if not has_perm:
        _record_denied(user, permission_codename, resource_type, resource_id, action_name, "Permiso RBAC insuficiente")
        return False

    return True


def enforce_contract_permission(
    user: Any,
    permission_codename: str,
    resource_type: str = "ContractOperation",
    resource_id: str = "",
    action_name: str = "CONTRACT_EXECUTION",
) -> None:
    """
    Exige que el usuario posea el permiso requerido. Lanza ContractPermissionDeniedError si no lo tiene.
    """
    if not check_contract_permission(user, permission_codename, resource_type, resource_id, action_name):
        user_repr = getattr(user, "email", str(user))
        raise ContractPermissionDeniedError(
            f"Acceso denegado: El usuario '{user_repr}' no dispone del permiso '{permission_codename}' "
            f"para ejecutar {action_name} sobre {resource_type}."
        )


def _record_denied(
    user: Any,
    permission: str,
    resource_type: str,
    resource_id: str,
    action: str,
    reason: str,
) -> None:
    try:
        record_audit_event(
            module="security",
            action=f"DENIED_{action}",
            event_category=CATEGORY_SECURITY_DENIED,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_repr=f"Intento no autorizado: {action}",
            actor=user,
            actor_type=ACTOR_USER if getattr(user, "is_authenticated", False) else "anonymous",
            new_values={"required_permission": permission, "denial_reason": reason},
            source=SOURCE_API,
            severity=SEVERITY_WARNING,
            mandatory=True,
        )
    except Exception:
        pass
