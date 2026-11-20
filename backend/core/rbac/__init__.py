# core/rbac/__init__.py
"""Módulo de Control de Acceso Basado en Roles (RBAC Granular) para LEVELPRO OS V4.0."""

from core.rbac.constants import (
    ALL_ROLES,
    ROLE_SUPER_ADMIN,
    ROLE_MANAGEMENT,
    ROLE_SALES,
    ROLE_PURCHASING,
    ROLE_WAREHOUSE,
    ROLE_LOGISTICS,
    ROLE_FINANCE,
    ROLE_MARKETING,
    ROLE_ACADEMY,
    ROLE_SUPPORT,
    ALL_MODULES,
    ALL_SENSITIVE_PERMISSIONS,
)
from core.rbac.permissions import (
    RBACPermission,
    HasModulePermission,
    HasSensitivePermission,
    user_has_module_access,
    user_has_capability,
    get_user_roles,
)
from core.rbac.mixins import SensitiveDataSerializerMixin
from core.rbac.services import (
    get_user_effective_permissions,
    assign_role_to_user,
    remove_role_from_user,
    get_roles_summary,
)

__all__ = [
    "ALL_ROLES",
    "ROLE_SUPER_ADMIN",
    "ROLE_MANAGEMENT",
    "ROLE_SALES",
    "ROLE_PURCHASING",
    "ROLE_WAREHOUSE",
    "ROLE_LOGISTICS",
    "ROLE_FINANCE",
    "ROLE_MARKETING",
    "ROLE_ACADEMY",
    "ROLE_SUPPORT",
    "ALL_MODULES",
    "ALL_SENSITIVE_PERMISSIONS",
    "RBACPermission",
    "HasModulePermission",
    "HasSensitivePermission",
    "user_has_module_access",
    "user_has_capability",
    "get_user_roles",
    "SensitiveDataSerializerMixin",
    "get_user_effective_permissions",
    "assign_role_to_user",
    "remove_role_from_user",
    "get_roles_summary",
]
