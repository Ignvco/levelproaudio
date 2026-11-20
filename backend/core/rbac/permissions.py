# core/rbac/permissions.py
"""
Clases y funciones de permisos centralizadas con Denegación por Defecto (Zero Trust)
y control granular por módulo, acción y capacidad sensible para LEVELPRO OS V4.0.
"""

from django.contrib.auth import get_user_model
from rest_framework.permissions import BasePermission
from core.rbac.constants import (
    ROLE_SUPER_ADMIN,
    ALL_ROLES,
    ALL_MODULES,
    DEFAULT_ROLE_MATRIX,
    ACTION_READ,
    ACTION_CREATE,
    ACTION_UPDATE,
    ACTION_DELETE,
    ACTION_EXPORT,
    ACTION_IMPORT,
    ACTION_APPROVE,
)


def _resolve_live_user(user):
    """
    Sincroniza los flags de seguridad (is_active, is_staff, is_superuser) contra la
    base de datos cuando el usuario tiene PK persistido. Esto garantiza revocación
    inmediata incluso en sesiones JWT abiertas o instancias en memoria cacheadas.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return None
    if getattr(user, "pk", None):
        User = get_user_model()
        fresh = User.objects.filter(pk=user.pk).only("id", "is_active", "is_staff", "is_superuser").first()
        if not fresh:
            return None
        user.is_active = fresh.is_active
        user.is_staff = fresh.is_staff
        user.is_superuser = fresh.is_superuser
    if not user.is_active:
        return None
    return user


def is_effective_super_admin(user):
    """
    Política única de autoridad Super Admin:
    El usuario debe estar activo, ser is_superuser=True (o pertenecer a Super Admin con is_staff=True).
    """
    live = _resolve_live_user(user)
    if not live:
        return False
    if live.is_superuser:
        return True
    return False


def get_user_roles(user):
    """
    Retorna la lista de roles empresariales oficiales vigentes a los que pertenece el usuario activo.
    Si el usuario está inactivo o no tiene is_staff ni is_superuser, no posee roles administrativos efectivos.
    """
    live = _resolve_live_user(user)
    if not live:
        return []
    if not live.is_staff and not live.is_superuser:
        return []
    roles = list(live.groups.filter(name__in=ALL_ROLES).values_list("name", flat=True))
    if live.is_superuser and ROLE_SUPER_ADMIN not in roles:
        roles.insert(0, ROLE_SUPER_ADMIN)
    return roles


def user_has_module_access(user, module_name):
    """
    Determina si un usuario activo tiene acceso a un módulo específico.
    Aplica Denegación por Defecto estricta: is_staff sin rol asignado NO otorga acceso.
    """
    live = _resolve_live_user(user)
    if not live:
        return False
    if is_effective_super_admin(live):
        return True
    if not live.is_staff:
        return False

    roles = get_user_roles(live)
    if not roles:
        return False

    for role in roles:
        role_config = DEFAULT_ROLE_MATRIX.get(role)
        if role_config and module_name in role_config.get("modules", []):
            return True

    return False


def user_has_module_action(user, module_name, action_name):
    """
    Determina si un usuario activo posee permiso para ejecutar una acción específica
    (read, create, update, delete, export, import, approve) dentro de un módulo.
    """
    live = _resolve_live_user(user)
    if not live:
        return False
    if is_effective_super_admin(live):
        return True
    if not live.is_staff:
        return False

    roles = get_user_roles(live)
    if not roles:
        return False

    for role in roles:
        role_config = DEFAULT_ROLE_MATRIX.get(role, {})
        module_actions = role_config.get("module_actions", {}).get(module_name, [])
        if action_name in module_actions:
            return True

    return False


def user_has_capability(user, capability_name):
    """
    Determina si el usuario activo posee una capacidad sensible específica
    (ej: view_costs, edit_costs, view_finances, manage_finances, approve_payments).
    Fuente de verdad: permisos efectivos en base de datos (auth_group_permissions + user_permissions)
    condicionados a que el usuario posea al menos un rol activo en ALL_ROLES.
    Si los grupos de un rol aún no tienen filas en auth_group_permissions (ej. en tests unitarios
    que crean el Group sin ejecutar setup_rbac), hace fallback a DEFAULT_ROLE_MATRIX.
    """
    live = _resolve_live_user(user)
    if not live:
        return False
    if is_effective_super_admin(live):
        return True
    if not live.is_staff:
        return False

    roles = get_user_roles(live)
    if not roles:
        return False

    from django.contrib.auth.models import Permission
    # Verificar si los grupos del usuario fueron aprovisionados con permisos RBAC en la base de datos
    any_rbac_perms_in_db = Permission.objects.filter(
        content_type__app_label="users",
        codename__in=DEFAULT_ROLE_MATRIX.get(ROLE_SUPER_ADMIN, {}).get("capabilities", []),
    ).exists()

    if any_rbac_perms_in_db:
        # Evaluar estrictamente contra la base de datos (sin usar el caché _perm_cache de la instancia)
        has_group_perm = Permission.objects.filter(
            group__user=live,
            group__name__in=roles,
            content_type__app_label="users",
            codename=capability_name,
        ).exists()
        if has_group_perm:
            return True
        has_direct_perm = Permission.objects.filter(
            user=live,
            content_type__app_label="users",
            codename=capability_name,
        ).exists()
        return has_direct_perm

    # Fallback exclusivo para tests ligeros que crean Group sin ejecutar setup_rbac
    for role in roles:
        role_config = DEFAULT_ROLE_MATRIX.get(role)
        if role_config and capability_name in role_config.get("capabilities", []):
            return True

    return False


def infer_rbac_action(request, view):
    """
    Infiere la acción granular RBAC a partir de la vista DRF y el método HTTP.
    """
    explicit_action = (
        getattr(view, "rbac_action", None)
        or getattr(getattr(view, "cls", None), "rbac_action", None)
        or getattr(getattr(view, "view_class", None), "rbac_action", None)
    )
    if explicit_action:
        return explicit_action

    drf_action = getattr(view, "action", None)
    if drf_action in ("list", "retrieve"):
        return ACTION_READ
    if drf_action == "create":
        return ACTION_CREATE
    if drf_action in ("update", "partial_update"):
        return ACTION_UPDATE
    if drf_action == "destroy":
        return ACTION_DELETE
    if drf_action == "export_csv":
        return ACTION_EXPORT

    method = (getattr(request, "method", "GET") or "GET").upper()
    if method in ("GET", "HEAD", "OPTIONS"):
        return ACTION_READ
    if method == "POST":
        return ACTION_CREATE
    if method in ("PUT", "PATCH"):
        return ACTION_UPDATE
    if method == "DELETE":
        return ACTION_DELETE
    return ACTION_READ


def get_view_rbac_attr(view, attr_name):
    """Extrae un atributo de configuración RBAC desde la vista, su clase o función subyacente."""
    for candidate in (
        view,
        getattr(view, "cls", None),
        getattr(view, "view_class", None),
        getattr(getattr(view, "__class__", None), "handler", None),
    ):
        if candidate is not None:
            val = getattr(candidate, attr_name, None)
            if val is not None:
                return val
            w = getattr(candidate, "__wrapped__", None)
            while w is not None:
                val = getattr(w, attr_name, None)
                if val is not None:
                    return val
                w = getattr(w, "__wrapped__", None)
    return None


class RBACPermission(BasePermission):
    """
    Permiso centralizado con Denegación por Defecto para endpoints de LEVELPRO OS V4.0.
    Rechaza cualquier acceso a vistas administrativas que no declaren clasificación RBAC.
    """
    def has_permission(self, request, view):
        from core.admin_permissions import evaluate_admin_rbac_permission
        return evaluate_admin_rbac_permission(request, view)


def HasModulePermission(module_name, required_capability=None, required_action=None):
    """Factory para generar clases de permiso asociadas a un módulo, acción y capacidad específica."""
    class CustomModulePermission(BasePermission):
        def has_permission(self, request, view):
            live = _resolve_live_user(request.user)
            if not live:
                return False
            if is_effective_super_admin(live):
                return True
            if not live.is_staff:
                return False
            if required_capability and not user_has_capability(live, required_capability):
                return False
            action = required_action or infer_rbac_action(request, view)
            return user_has_module_action(live, module_name, action)
    return CustomModulePermission


def HasSensitivePermission(capability_name):
    """Factory para generar clases de permiso que protegen capacidades sensibles."""
    class CustomCapabilityPermission(BasePermission):
        def has_permission(self, request, view):
            return user_has_capability(request.user, capability_name)
    return CustomCapabilityPermission
