# core/rbac/services.py
"""Servicios de negocio para gestión, ciclo de vida, SoD y resolución de roles y permisos RBAC."""

from django.db import transaction
from django.db.models import Q
from django.contrib.auth.models import Group
from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied, ValidationError

from core.rbac.constants import (
    ALL_ROLES,
    ROLE_SUPER_ADMIN,
    ALL_MODULES,
    ALL_ACTIONS,
    ALL_SENSITIVE_PERMISSIONS,
    DEFAULT_ROLE_MATRIX,
    ROLE_DESCRIPTIONS,
    INCOMPATIBLE_ROLE_PAIRS,
    PERM_MANAGE_ROLES,
)
from core.rbac.permissions import (
    _resolve_live_user,
    is_effective_super_admin,
    user_has_capability,
    get_user_roles,
)
from core.rbac.events import log_security_event

User = get_user_model()


def _blacklist_user_tokens(user):
    """Invalida tokens de refresco activos en simplejwt token_blacklist tras revocación total o desactivación."""
    try:
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
        for token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=token)
    except Exception:
        pass


def get_user_effective_permissions(user):
    """
    Calcula y consolida la totalidad de permisos, roles, acciones y capacidades efectivas
    del usuario autenticado para consumo directo del frontend y verificación de seguridad.
    Aplica Denegación por Defecto: usuarios inactivos o is_staff sin rol reciben 0 módulos y 0 capacidades.
    """
    live = _resolve_live_user(user)
    if not live:
        return {
            "is_authenticated": False,
            "is_staff": False,
            "is_superuser": False,
            "roles": [],
            "modules": [],
            "capabilities": {perm: False for perm in ALL_SENSITIVE_PERMISSIONS},
            "module_actions": {},
        }

    is_super = is_effective_super_admin(live)
    roles = get_user_roles(live)

    if is_super:
        allowed_modules = list(ALL_MODULES)
        capabilities = {perm: True for perm in ALL_SENSITIVE_PERMISSIONS}
        module_actions = {m: list(ALL_ACTIONS) for m in ALL_MODULES}
        effective_roles = roles if ROLE_SUPER_ADMIN in roles else [ROLE_SUPER_ADMIN] + roles
    else:
        modules_set = set()
        module_actions_map = {}
        for role in roles:
            role_config = DEFAULT_ROLE_MATRIX.get(role, {})
            for m in role_config.get("modules", []):
                modules_set.add(m)
            for m, acts in role_config.get("module_actions", {}).items():
                module_actions_map.setdefault(m, set()).update(acts)

        # Denegación por defecto: si no posee roles empresariales oficiales, no recibe módulos ni capacidades
        allowed_modules = [m for m in ALL_MODULES if m in modules_set]
        capabilities = {
            perm: user_has_capability(live, perm) for perm in ALL_SENSITIVE_PERMISSIONS
        }
        module_actions = {
            m: [a for a in ALL_ACTIONS if a in module_actions_map.get(m, set())]
            for m in allowed_modules
        }
        effective_roles = roles

    return {
        "id": str(live.id),
        "email": live.email,
        "username": live.username,
        "is_authenticated": True,
        "is_staff": bool(live.is_staff and (is_super or bool(effective_roles))),
        "is_superuser": is_super,
        "roles": effective_roles,
        "modules": allowed_modules,
        "capabilities": capabilities,
        "module_actions": module_actions,
    }


@transaction.atomic
def assign_role_to_user(target_user, role_name, operator=None, ip_address=None):
    """
    Asigna un rol empresarial a un usuario objetivo con validaciones anti-escalada,
    verificación de Segregación de Funciones (SoD) y sincronización atómica de flags.
    """
    if role_name not in ALL_ROLES:
        raise ValidationError(f"El rol '{role_name}' no es un rol válido del sistema.")

    if operator:
        live_op = _resolve_live_user(operator)
        if not live_op or (not is_effective_super_admin(live_op) and not user_has_capability(live_op, PERM_MANAGE_ROLES)):
            raise PermissionDenied("No posee autorización para administrar roles de usuarios.")

        if role_name == ROLE_SUPER_ADMIN and not is_effective_super_admin(live_op):
            raise PermissionDenied("Solo un Super Admin activo puede otorgar el rol Super Admin.")

    locked_target = User.objects.select_for_update().get(pk=target_user.pk)
    existing_roles = set(locked_target.groups.filter(name__in=ALL_ROLES).values_list("name", flat=True))

    # Validación de Segregación de Funciones (SoD) para roles operativos incompatibles
    if role_name != ROLE_SUPER_ADMIN and ROLE_SUPER_ADMIN not in existing_roles:
        for role_a, role_b in INCOMPATIBLE_ROLE_PAIRS:
            if (role_name == role_a and role_b in existing_roles) or (role_name == role_b and role_a in existing_roles):
                conflict = role_b if role_name == role_a else role_a
                raise ValidationError(
                    f"Conflicto de Segregación de Funciones (SoD): el rol '{role_name}' es incompatible con el rol '{conflict}' ya asignado al usuario."
                )

    group, _ = Group.objects.get_or_create(name=role_name)
    locked_target.groups.add(group)

    update_fields = []
    if not locked_target.is_staff:
        locked_target.is_staff = True
        update_fields.append("is_staff")
    if role_name == ROLE_SUPER_ADMIN and not locked_target.is_superuser:
        locked_target.is_superuser = True
        update_fields.append("is_superuser")
    if update_fields:
        locked_target.save(update_fields=update_fields)

    target_user.is_staff = locked_target.is_staff
    target_user.is_superuser = locked_target.is_superuser

    log_security_event(
        event_type="RBAC_ROLE_ASSIGNED",
        operator=operator,
        target_user=locked_target,
        details={"role": role_name},
        ip_address=ip_address,
    )
    return True


@transaction.atomic
def remove_role_from_user(target_user, role_name, operator=None, ip_address=None):
    """
    Remueve un rol empresarial de un usuario objetivo con bloqueo pesimista (select_for_update)
    contra pérdida del último Super Admin activo y limpieza automática de is_staff al revocar el último rol.
    """
    # 1. Primero adquirir el bloqueo pesimista determinista sobre TODOS los Super Admins activos
    # y el usuario objetivo en orden de PK para serializar transacciones concurrentes en PostgreSQL.
    super_pks = list(
        User.objects.filter(is_active=True)
        .filter(Q(is_superuser=True) | Q(groups__name=ROLE_SUPER_ADMIN))
        .values_list("pk", flat=True)
        .distinct()
    )
    pks_to_lock = set(super_pks) | {target_user.pk}
    if operator and getattr(operator, "pk", None):
        pks_to_lock.add(operator.pk)

    locked_users_map = {
        u.pk: u
        for u in User.objects.select_for_update()
        .filter(pk__in=pks_to_lock)
        .order_by("id")
    }
    locked_target = locked_users_map.get(target_user.pk) or User.objects.select_for_update().get(pk=target_user.pk)

    # 2. Una vez adquirido el lock, re-evaluar en vivo los privilegios del operador
    # (por si otra transacción concurrente acaba de desactivarlo o revocarle su rol Super Admin).
    if operator:
        live_op = _resolve_live_user(operator)
        if not live_op or (not is_effective_super_admin(live_op) and not user_has_capability(live_op, PERM_MANAGE_ROLES)):
            raise PermissionDenied("No posee autorización para administrar roles de usuarios.")
        if role_name == ROLE_SUPER_ADMIN and not is_effective_super_admin(live_op):
            raise PermissionDenied("Solo un Super Admin activo puede revocar el rol Super Admin.")

    # 3. Re-calcular los Super Admins que siguen realmente activos DESPUÉS de obtener el lock
    active_supers = [
        u for u in locked_users_map.values()
        if u.is_active and (u.is_superuser or u.groups.filter(name=ROLE_SUPER_ADMIN).exists())
    ]

    if role_name == ROLE_SUPER_ADMIN:
        is_target_active_super = any(u.pk == locked_target.pk for u in active_supers)
        if is_target_active_super and len(active_supers) <= 1:
            raise ValidationError("No se puede revocar el rol al único Super Admin activo del sistema.")

    try:
        group = Group.objects.get(name=role_name)
        locked_target.groups.remove(group)
    except Group.DoesNotExist:
        pass

    remaining_roles = list(locked_target.groups.filter(name__in=ALL_ROLES).values_list("name", flat=True))
    update_fields = []

    if role_name == ROLE_SUPER_ADMIN and locked_target.is_superuser:
        locked_target.is_superuser = False
        update_fields.append("is_superuser")

    if not remaining_roles and not locked_target.is_superuser:
        if locked_target.is_staff:
            locked_target.is_staff = False
            update_fields.append("is_staff")
        _blacklist_user_tokens(locked_target)

    if update_fields:
        locked_target.save(update_fields=update_fields)

    target_user.is_staff = locked_target.is_staff
    target_user.is_superuser = locked_target.is_superuser

    log_security_event(
        event_type="RBAC_ROLE_REVOKED",
        operator=operator,
        target_user=locked_target,
        details={"role": role_name, "remaining_roles": remaining_roles},
        ip_address=ip_address,
    )
    return True


def get_roles_summary():
    """Retorna el listado completo de los 10 roles con métricas de usuarios asignados y capacidades reales desde DB."""
    from django.contrib.auth.models import Permission
    any_rbac_perms_in_db = Permission.objects.filter(
        content_type__app_label="users",
        codename__in=ALL_SENSITIVE_PERMISSIONS,
    ).exists()

    roles_list = []
    for role_name in ALL_ROLES:
        desc = ROLE_DESCRIPTIONS.get(role_name, "")
        config = DEFAULT_ROLE_MATRIX.get(role_name, {})
        user_count = User.objects.filter(groups__name=role_name, is_active=True).distinct().count()
        if any_rbac_perms_in_db and Group.objects.filter(name=role_name).exists():
            db_caps = set(
                Permission.objects.filter(
                    group__name=role_name,
                    content_type__app_label="users",
                    codename__in=ALL_SENSITIVE_PERMISSIONS,
                ).values_list("codename", flat=True)
            )
            effective_caps = [c for c in ALL_SENSITIVE_PERMISSIONS if c in db_caps]
        else:
            effective_caps = config.get("capabilities", [])

        roles_list.append({
            "name": role_name,
            "description": desc,
            "user_count": user_count,
            "modules": config.get("modules", []),
            "capabilities": effective_caps,
            "module_actions": config.get("module_actions", {}),
        })
    return roles_list
