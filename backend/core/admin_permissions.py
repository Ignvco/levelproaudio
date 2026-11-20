# core/admin_permissions.py
"""
Permiso administrativo unificado compatible con la arquitectura RBAC de LEVELPRO OS V4.0.
Permite acceso irrestricto a Super Admin y evalúa roles y capacidades en usuarios restringidos.
"""

from rest_framework.permissions import BasePermission
from core.rbac.permissions import (
    user_has_module_access,
    user_has_capability,
    get_user_roles,
)


class IsAdminOrStaff(BasePermission):
    """
    Permiso administrativo centralizado.
    - Superuser activo: Acceso irrestricto.
    - Usuario con rol asignado: Acceso condicionado al módulo y capacidad de la vista.
    - Usuario staff sin rol (legacy): Acceso operativo general, excluyendo finanzas y roles.
    - Cliente/Anónimo: Denegación inmediata (403/401).
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False

        # Super Admin activo tiene bypass irrestricto
        if user.is_superuser:
            return True

        # Si no es staff ni superuser, denegar de inmediato
        if not user.is_staff:
            return False

        # Si la vista especifica un módulo RBAC, validar pertenencia
        required_module = (
            getattr(view, "rbac_module", None)
            or getattr(getattr(view, "cls", None), "rbac_module", None)
            or getattr(getattr(view, "view_class", None), "rbac_module", None)
        )
        if required_module:
            if not user_has_module_access(user, required_module):
                return False

        # Si la vista especifica una capacidad sensible, validar explícitamente
        required_capability = (
            getattr(view, "rbac_capability", None)
            or getattr(getattr(view, "cls", None), "rbac_capability", None)
            or getattr(getattr(view, "view_class", None), "rbac_capability", None)
        )
        if required_capability:
            if not user_has_capability(user, required_capability):
                return False

        # Si el usuario tiene roles asignados pero la vista no especifica módulo:
        # Se verifica que posea al menos un rol administrativo activo
        roles = get_user_roles(user)
        if roles:
            return True

        # Si es un usuario staff legacy sin rol asignado:
        # Por seguridad, no puede acceder a finanzas ni administración de roles
        from core.rbac.constants import MODULE_FINANCES, MODULE_ROLES
        if required_module in (MODULE_FINANCES, MODULE_ROLES):
            return False

        return True
