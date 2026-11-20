# apps/users/views_rbac.py
"""Vistas API REST para gestión y consulta de RBAC en LEVELPRO OS V4.0."""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.core.exceptions import PermissionDenied, ValidationError

from core.admin_permissions import IsAdminOrStaff, rbac_endpoint
from core.rbac.constants import (
    ALL_ROLES,
    ALL_MODULES,
    ALL_ACTIONS,
    ALL_SENSITIVE_PERMISSIONS,
    MODULE_IMPLEMENTATION_STATUS,
    DEFAULT_ROLE_MATRIX,
    ROLE_DESCRIPTIONS,
    INCOMPATIBLE_ROLE_PAIRS,
    MAX_UNAPPROVED_DISCOUNT_PERCENT,
    MODULE_ROLES,
    PERM_MANAGE_ROLES,
)
from core.rbac.services import (
    get_user_effective_permissions,
    get_roles_summary,
    assign_role_to_user,
    remove_role_from_user,
)

User = get_user_model()


def get_client_ip(request):
    """Obtiene la IP remota del cliente para registro de auditoría."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def _no_store_response(data, status_code=status.HTTP_200_OK):
    resp = Response(data, status=status_code)
    resp["Cache-Control"] = "private, no-store"
    return resp


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_permissions_view(request):
    """
    Retorna los permisos, roles, acciones y módulos efectivos del usuario actual.
    Consumido por el frontend para renderizado condicional y protección de rutas.
    """
    data = get_user_effective_permissions(request.user)
    return _no_store_response(data, status.HTTP_200_OK)


@rbac_endpoint(module=MODULE_ROLES, capability=PERM_MANAGE_ROLES)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def roles_list_view(request):
    """Retorna el listado consolidado de los 10 roles empresariales."""
    roles = get_roles_summary()
    return _no_store_response({"count": len(roles), "results": roles}, status.HTTP_200_OK)


@rbac_endpoint(module=MODULE_ROLES, capability=PERM_MANAGE_ROLES)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def role_detail_view(request, role_name):
    """Retorna el detalle, capacidades, acciones y usuarios de un rol específico."""
    if role_name not in ALL_ROLES:
        return _no_store_response({"error": "Rol inexistente."}, status.HTTP_404_NOT_FOUND)

    config = DEFAULT_ROLE_MATRIX.get(role_name, {})
    assigned_users = User.objects.filter(groups__name=role_name).values("id", "email", "username", "is_active")

    from django.contrib.auth.models import Group, Permission
    any_rbac_perms_in_db = Permission.objects.filter(
        content_type__app_label="users",
        codename__in=ALL_SENSITIVE_PERMISSIONS,
    ).exists()
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

    data = {
        "name": role_name,
        "description": ROLE_DESCRIPTIONS.get(role_name, ""),
        "modules": config.get("modules", []),
        "capabilities": effective_caps,
        "module_actions": config.get("module_actions", {}),
        "user_count": len(assigned_users),
        "users": list(assigned_users),
    }
    return _no_store_response(data, status.HTTP_200_OK)


@rbac_endpoint(module=MODULE_ROLES, capability=PERM_MANAGE_ROLES)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def user_roles_management_view(request, user_id):
    """
    GET: Consulta los roles asignados a un usuario.
    POST: Asigna o revoca un rol con validación anti-escalada, SoD y protección del último Super Admin.
    """
    target_user = get_object_or_404(User, id=user_id)
    ip_addr = get_client_ip(request)

    if request.method == "GET":
        user_roles = list(target_user.groups.filter(name__in=ALL_ROLES).values_list("name", flat=True))
        return _no_store_response({
            "user_id": str(target_user.id),
            "email": target_user.email,
            "roles": user_roles,
            "available_roles": ALL_ROLES,
        }, status.HTTP_200_OK)

    role_name = request.data.get("role")
    action = request.data.get("action", "assign")

    if not role_name or role_name not in ALL_ROLES:
        return _no_store_response(
            {"error": f"El rol '{role_name}' no es válido. Roles válidos: {ALL_ROLES}"},
            status.HTTP_400_BAD_REQUEST,
        )

    try:
        if action == "assign":
            assign_role_to_user(target_user, role_name, operator=request.user, ip_address=ip_addr)
            message = f"Rol '{role_name}' asignado exitosamente a {target_user.email}."
        elif action == "remove":
            remove_role_from_user(target_user, role_name, operator=request.user, ip_address=ip_addr)
            message = f"Rol '{role_name}' revocado exitosamente a {target_user.email}."
        else:
            return _no_store_response(
                {"error": f"Acción inválida '{action}'. Use 'assign' o 'remove'."},
                status.HTTP_400_BAD_REQUEST,
            )

        updated_roles = list(target_user.groups.filter(name__in=ALL_ROLES).values_list("name", flat=True))
        return _no_store_response({
            "message": message,
            "user_id": str(target_user.id),
            "roles": updated_roles,
        }, status.HTTP_200_OK)

    except PermissionDenied as e:
        return _no_store_response({"error": str(e)}, status.HTTP_403_FORBIDDEN)
    except ValidationError as e:
        err_msg = e.messages[0] if hasattr(e, "messages") and e.messages else str(e)
        return _no_store_response({"error": err_msg}, status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(module=MODULE_ROLES, capability=PERM_MANAGE_ROLES)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def permissions_catalog_view(request):
    """
    Retorna el catálogo completo de módulos, estado de implementación, acciones,
    capacidades sensibles, reglas SoD y matriz de roles para LEVELPRO OS V4.0.
    """
    catalog = {
        "modules": ALL_MODULES,
        "module_status": MODULE_IMPLEMENTATION_STATUS,
        "actions": ALL_ACTIONS,
        "capabilities": ALL_SENSITIVE_PERMISSIONS,
        "role_matrix": DEFAULT_ROLE_MATRIX,
        "role_descriptions": ROLE_DESCRIPTIONS,
        "incompatible_role_pairs": [list(pair) for pair in INCOMPATIBLE_ROLE_PAIRS],
        "policies": {
            "max_unapproved_discount_percent": float(MAX_UNAPPROVED_DISCOUNT_PERCENT),
        },
    }
    return _no_store_response(catalog, status.HTTP_200_OK)
