# core/rbac/permissions.py
"""Clases de permisos centralizadas y modulares para DRF en LEVELPRO OS V4.0."""

from rest_framework.permissions import BasePermission
from core.rbac.constants import (
    ROLE_SUPER_ADMIN,
    ALL_MODULES,
    DEFAULT_ROLE_MATRIX,
)


def get_user_roles(user):
    """Retorna la lista de nombres de grupos/roles a los que pertenece el usuario."""
    if not user or not user.is_authenticated:
        return []
    return list(user.groups.values_list("name", flat=True))


def user_has_module_access(user, module_name):
    """
    Determina si un usuario tiene acceso a un módulo específico según sus roles o permisos directos.
    Aplica principio de denegación por defecto.
    """
    if not user or not user.is_authenticated or not user.is_active:
        return False
    if user.is_superuser:
        return True

    roles = get_user_roles(user)
    # Si el usuario no tiene roles asignados pero es staff legacy:
    # Por seguridad, no permitimos acceso implícito a módulos protegidos.
    if not roles and user.is_staff:
        # Staff legacy sin rol específico: acceso limitado de transición solo si no es módulo financiero/roles
        from core.rbac.constants import MODULE_FINANCES, MODULE_ROLES
        if module_name in (MODULE_FINANCES, MODULE_ROLES):
            return False
        return True

    for role in roles:
        role_config = DEFAULT_ROLE_MATRIX.get(role)
        if role_config and module_name in role_config["modules"]:
            return True

    # Chequeo directo por permiso explícito Django: app_label.view_<module> o similar
    perm_name = f"users.access_{module_name}"
    if user.has_perm(perm_name):
        return True

    return False


def user_has_capability(user, capability_name):
    """
    Determina si el usuario posee una capacidad sensible específica (ej: view_costs, view_finances).
    """
    if not user or not user.is_authenticated or not user.is_active:
        return False
    if user.is_superuser:
        return True

    roles = get_user_roles(user)
    for role in roles:
        role_config = DEFAULT_ROLE_MATRIX.get(role)
        if role_config and capability_name in role_config["capabilities"]:
            return True

    # Chequeo por permiso directo Django
    perm_name = f"users.{capability_name}"
    if user.has_perm(perm_name):
        return True

    return False


class RBACPermission(BasePermission):
    """
    Permiso centralizado para endpoints de LEVELPRO OS.
    Evalúa módulo, acción HTTP y capacidades sensibles requeridas en la vista.
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False

        # Bypass exclusivo para Super Admin activo
        if user.is_superuser:
            return True

        # Determinar módulo requerido desde la vista
        required_module = (
            getattr(view, "rbac_module", None)
            or getattr(getattr(view, "cls", None), "rbac_module", None)
            or getattr(getattr(view, "view_class", None), "rbac_module", None)
        )
        required_capability = (
            getattr(view, "rbac_capability", None)
            or getattr(getattr(view, "cls", None), "rbac_capability", None)
            or getattr(getattr(view, "view_class", None), "rbac_capability", None)
        )

        if required_capability:
            if not user_has_capability(user, required_capability):
                return False

        if required_module:
            if not user_has_module_access(user, required_module):
                return False

        # Si el endpoint es administrativo general y no especifica módulo:
        # Se requiere al menos ser staff activo y pertenecer a un rol operativo o ser staff autorizado
        if user.is_staff:
            return True

        return False


def HasModulePermission(module_name, required_capability=None):
    """Factory para generar clases de permiso asociadas a un módulo específico."""
    class CustomModulePermission(BasePermission):
        def has_permission(self, request, view):
            user = request.user
            if not user or not user.is_authenticated or not user.is_active:
                return False
            if user.is_superuser:
                return True
            if required_capability and not user_has_capability(user, required_capability):
                return False
            return user_has_module_access(user, module_name)
    return CustomModulePermission


def HasSensitivePermission(capability_name):
    """Factory para generar clases de permiso que protegen capacidades sensibles."""
    class CustomCapabilityPermission(BasePermission):
        def has_permission(self, request, view):
            return user_has_capability(request.user, capability_name)
    return CustomCapabilityPermission
