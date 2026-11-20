# core/rbac/services.py
"""Servicios de negocio para gestión, auditoría y resolución de roles y permisos RBAC."""

from django.contrib.auth.models import Group, Permission
from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied, ValidationError

from core.rbac.constants import (
    ALL_ROLES,
    ROLE_SUPER_ADMIN,
    ALL_MODULES,
    ALL_SENSITIVE_PERMISSIONS,
    DEFAULT_ROLE_MATRIX,
    ROLE_DESCRIPTIONS,
    PERM_MANAGE_ROLES,
)
from core.rbac.permissions import user_has_capability, get_user_roles, user_has_module_access
from core.rbac.events import log_security_event

User = get_user_model()


def get_user_effective_permissions(user):
    """
    Calcula y consolida la totalidad de permisos, roles y capacidades efectivas
    del usuario autenticado para consumo directo del frontend y verificación de seguridad.
    """
    if not user or not user.is_authenticated:
        return {
            "is_authenticated": False,
            "is_superuser": False,
            "roles": [],
            "modules": [],
            "capabilities": {},
        }

    is_super = bool(user.is_superuser and user.is_active)
    roles = get_user_roles(user)

    # Si es Super Admin, tiene acceso total a todos los módulos y capacidades
    if is_super:
        allowed_modules = list(ALL_MODULES)
        capabilities = {perm: True for perm in ALL_SENSITIVE_PERMISSIONS}
    else:
        # Calcular módulos permitidos acumulados de todos sus roles
        modules_set = set()
        for role in roles:
            role_config = DEFAULT_ROLE_MATRIX.get(role, {})
            modules_set.update(role_config.get("modules", []))

        # Si es staff legacy sin rol, dar acceso limitado básico (excluyendo finanzas y roles)
        if not roles and user.is_staff:
            modules_set = set(m for m in ALL_MODULES if m not in ("finances", "roles"))

        allowed_modules = [m for m in ALL_MODULES if m in modules_set]
        capabilities = {
            perm: user_has_capability(user, perm) for perm in ALL_SENSITIVE_PERMISSIONS
        }

    return {
        "id": str(user.id),
        "email": user.email,
        "username": user.username,
        "is_staff": user.is_staff,
        "is_superuser": is_super,
        "roles": roles if not is_super else [ROLE_SUPER_ADMIN],
        "modules": allowed_modules,
        "capabilities": capabilities,
    }


def assign_role_to_user(target_user, role_name, operator=None, ip_address=None):
    """
    Asigna un rol empresarial a un usuario objetivo con validaciones de seguridad anti-escalada.
    """
    if role_name not in ALL_ROLES:
        raise ValidationError(f"El rol '{role_name}' no es un rol válido del sistema.")

    # Verificación de permisos del operador (a menos que sea script de sistema)
    if operator:
        if not operator.is_superuser and not user_has_capability(operator, PERM_MANAGE_ROLES):
            raise PermissionDenied("No posee autorización para administrar roles de usuarios.")

        # Impedir escalada: un no-superuser no puede otorgar el rol Super Admin
        if role_name == ROLE_SUPER_ADMIN and not operator.is_superuser:
            raise PermissionDenied("Solo un Super Admin existente puede otorgar el rol Super Admin.")

    group, _ = Group.objects.get_or_create(name=role_name)
    target_user.groups.add(group)

    # Si se asigna cualquier rol administrativo, asegurarse de que is_staff sea True
    if not target_user.is_staff:
        target_user.is_staff = True
        target_user.save(update_fields=["is_staff"])

    # Emisión de evento de seguridad sanitizado
    log_security_event(
        event_type="RBAC_ROLE_ASSIGNED",
        operator=operator,
        target_user=target_user,
        details={"role": role_name},
        ip_address=ip_address,
    )
    return True


def remove_role_from_user(target_user, role_name, operator=None, ip_address=None):
    """
    Remueve un rol empresarial de un usuario objetivo con protección contra lockout del propietario.
    """
    if operator:
        if not operator.is_superuser and not user_has_capability(operator, PERM_MANAGE_ROLES):
            raise PermissionDenied("No posee autorización para administrar roles de usuarios.")

    # Protección de contingencia: no permitir eliminar el último Super Admin activo
    if role_name == ROLE_SUPER_ADMIN:
        super_count = User.objects.filter(is_superuser=True, is_active=True).count()
        if super_count <= 1 and target_user.is_superuser:
            raise ValidationError("No se puede revocar el rol al único Super Admin activo del sistema.")

    try:
        group = Group.objects.get(name=role_name)
        target_user.groups.remove(group)
    except Group.DoesNotExist:
        pass

    log_security_event(
        event_type="RBAC_ROLE_REVOKED",
        operator=operator,
        target_user=target_user,
        details={"role": role_name},
        ip_address=ip_address,
    )
    return True


def get_roles_summary():
    """Retorna el listado completo de los 10 roles con métricas de usuarios asignados."""
    roles_list = []
    for role_name in ALL_ROLES:
        desc = ROLE_DESCRIPTIONS.get(role_name, "")
        config = DEFAULT_ROLE_MATRIX.get(role_name, {})
        user_count = User.objects.filter(groups__name=role_name).count()
        roles_list.append({
            "name": role_name,
            "description": desc,
            "user_count": user_count,
            "modules": config.get("modules", []),
            "capabilities": config.get("capabilities", []),
        })
    return roles_list
