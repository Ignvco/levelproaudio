# core/admin_permissions.py
"""
Permiso administrativo unificado con Denegación por Defecto (Zero Trust)
compatible con la arquitectura RBAC Granular de LEVELPRO OS V4.0.
"""

from rest_framework.permissions import BasePermission
from core.rbac.permissions import (
    _resolve_live_user,
    is_effective_super_admin,
    user_has_module_access,
    user_has_module_action,
    user_has_capability,
    get_user_roles,
    infer_rbac_action,
    get_view_rbac_attr,
)


def rbac_endpoint(
    module=None,
    capability=None,
    action=None,
    allowed_modules=None,
    capability_by_method=None,
    allowed_roles=None,
    allowed_roles_by_method=None,
):
    """
    Decorador declarativo para clasificar vistas funcionales DRF (@api_view)
    o clases APIView con reglas RBAC granulares por módulo, acción y capacidad.
    """
    def decorator(view_obj):
        attrs = {
            "rbac_module": module,
            "rbac_capability": capability,
            "rbac_action": action,
            "rbac_allowed_modules": allowed_modules,
            "rbac_capability_by_method": capability_by_method,
            "rbac_allowed_roles": allowed_roles,
            "rbac_allowed_roles_by_method": allowed_roles_by_method,
        }
        target_funcs = [view_obj]
        w = getattr(view_obj, "__wrapped__", None)
        while w is not None:
            target_funcs.append(w)
            w = getattr(w, "__wrapped__", None)

        for k, v in attrs.items():
            if v is not None:
                for fn in target_funcs:
                    setattr(fn, k, v)
                    if hasattr(fn, "cls"):
                        setattr(fn.cls, k, v)
                    if hasattr(fn, "view_class"):
                        setattr(fn.view_class, k, v)
        return view_obj
    return decorator


def evaluate_admin_rbac_permission(request, view):
    """
    Motor central de evaluación RBAC con Denegación por Defecto:
    1. Usuario autenticado y activo en base de datos -> obligatorio.
    2. Super Admin activo -> acceso irrestricto.
    3. is_staff=True y pertenencia a al menos un rol oficial -> obligatorio (is_staff solo NUNCA autoriza).
    4. Clasificación RBAC explícita en la vista -> obligatoria (recursos sin clasificar se deniegan por defecto).
    5. Validación de roles permitidos, capacidades sensibles y acción granular sobre el módulo.
    """
    live = _resolve_live_user(getattr(request, "user", None))
    if not live:
        return False

    # 1. Super Admin activo tiene autoridad total
    if is_effective_super_admin(live):
        return True

    # 2. Condición necesaria (pero nunca suficiente): ser staff activo con al menos un rol empresarial
    if not live.is_staff:
        return False

    user_roles = get_user_roles(live)
    if not user_roles:
        return False

    # 3. Extraer clasificación RBAC del recurso/vista
    required_module = get_view_rbac_attr(view, "rbac_module")
    allowed_modules = get_view_rbac_attr(view, "rbac_allowed_modules")
    required_capability = get_view_rbac_attr(view, "rbac_capability")
    capability_by_method = get_view_rbac_attr(view, "rbac_capability_by_method")
    allowed_roles = get_view_rbac_attr(view, "rbac_allowed_roles")
    allowed_roles_by_method = get_view_rbac_attr(view, "rbac_allowed_roles_by_method")

    # 4. DENEGACIÓN POR DEFECTO EN RECURSOS NO CLASIFICADOS
    if (
        required_module is None
        and allowed_modules is None
        and required_capability is None
        and capability_by_method is None
        and allowed_roles is None
        and allowed_roles_by_method is None
    ):
        return False

    method = (getattr(request, "method", "GET") or "GET").upper()
    drf_action = getattr(view, "action", None)

    # 5. Validar restricción explícita de roles por método/acción
    role_allowlist_checked = False
    if allowed_roles_by_method:
        method_roles = allowed_roles_by_method.get(drf_action) or allowed_roles_by_method.get(method)
        if method_roles is not None:
            if not any(r in method_roles for r in user_roles):
                return False
            role_allowlist_checked = True

    if allowed_roles is not None and not role_allowlist_checked:
        if not any(r in allowed_roles for r in user_roles):
            return False
        role_allowlist_checked = True

    # 6. Validar capacidad sensible por método/acción o global de la vista
    if capability_by_method:
        method_cap = capability_by_method.get(drf_action) or capability_by_method.get(method)
        if method_cap:
            if isinstance(method_cap, (list, tuple, set)):
                if not all(user_has_capability(live, c) for c in method_cap):
                    return False
            elif not user_has_capability(live, method_cap):
                return False

    if required_capability:
        if isinstance(required_capability, (list, tuple, set)):
            if not all(user_has_capability(live, c) for c in required_capability):
                return False
        elif not user_has_capability(live, required_capability):
            return False

    # 7. Validar acceso al módulo y acción granular
    modules_to_check = list(allowed_modules) if allowed_modules else ([required_module] if required_module else [])
    if modules_to_check:
        action = infer_rbac_action(request, view)
        if role_allowlist_checked:
            # Si la vista ya validó una lista explícita de roles para esta acción,
            # basta que el rol esté autorizado o posea acceso al módulo.
            if not any(user_has_module_access(live, m) for m in modules_to_check) and not role_allowlist_checked:
                return False
        else:
            if not any(user_has_module_action(live, m, action) for m in modules_to_check):
                return False

    return True


class IsAdminOrStaff(BasePermission):
    """
    Permiso administrativo centralizado con Denegación por Defecto:
    - Superuser activo: Acceso irrestricto.
    - Usuario con rol asignado: Acceso condicionado estrictamente al módulo, acción y capacidad de la vista.
    - Vista sin clasificación RBAC: Denegación por defecto (403) para todo no-superuser.
    - Usuario staff sin rol (legacy o revocado): Denegación absoluta (403).
    - Usuario inactivo / Cliente / Anónimo: Denegación inmediata (401/403).
    """
    def has_permission(self, request, view):
        return evaluate_admin_rbac_permission(request, view)
