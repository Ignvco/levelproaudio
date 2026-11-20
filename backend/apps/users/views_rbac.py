# apps/users/views_rbac.py
"""Vistas API REST para gestión y consulta de RBAC en LEVELPRO OS V4.0."""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.core.exceptions import PermissionDenied, ValidationError

from core.admin_permissions import IsAdminOrStaff
from core.rbac.constants import (
    ALL_ROLES,
    ALL_MODULES,
    ALL_SENSITIVE_PERMISSIONS,
    DEFAULT_ROLE_MATRIX,
    ROLE_DESCRIPTIONS,
    PERM_MANAGE_ROLES,
)
from core.rbac.permissions import user_has_capability
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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_permissions_view(request):
    """
    Retorna los permisos, roles y módulos efectivos del usuario actual.
    Consumido por el frontend para renderizado condicional de Bento UI.
    """
    data = get_user_effective_permissions(request.user)
    return Response(data, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def roles_list_view(request):
    """Retorna el listado consolidado de los 10 roles empresariales."""
    roles = get_roles_summary()
    return Response({"count": len(roles), "results": roles}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def role_detail_view(request, role_name):
    """Retorna el detalle, capacidades y usuarios de un rol específico."""
    if role_name not in ALL_ROLES:
        return Response({"error": "Rol inexistente."}, status=status.HTTP_404_NOT_FOUND)

    config = DEFAULT_ROLE_MATRIX.get(role_name, {})
    assigned_users = User.objects.filter(groups__name=role_name).values("id", "email", "username", "is_active")

    data = {
        "name": role_name,
        "description": ROLE_DESCRIPTIONS.get(role_name, ""),
        "modules": config.get("modules", []),
        "capabilities": config.get("capabilities", []),
        "user_count": len(assigned_users),
        "users": list(assigned_users),
    }
    return Response(data, status=status.HTTP_200_OK)


@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def user_roles_management_view(request, user_id):
    """
    GET: Consulta los roles asignados a un usuario.
    POST: Asigna o revoca un rol con validación de permisos anti-escalada.
    """
    target_user = get_object_or_404(User, id=user_id)
    ip_addr = get_client_ip(request)

    if request.method == "GET":
        user_roles = list(target_user.groups.values_list("name", flat=True))
        return Response({
            "user_id": str(target_user.id),
            "email": target_user.email,
            "roles": user_roles,
            "available_roles": ALL_ROLES,
        }, status=status.HTTP_200_OK)

    # POST: Asignación o revocación
    role_name = request.data.get("role")
    action = request.data.get("action", "assign")  # "assign" o "remove"

    if not role_name or role_name not in ALL_ROLES:
        return Response(
            {"error": f"El rol '{role_name}' no es válido. Roles válidos: {ALL_ROLES}"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        if action == "assign":
            assign_role_to_user(target_user, role_name, operator=request.user, ip_address=ip_addr)
            message = f"Rol '{role_name}' asignado exitosamente a {target_user.email}."
        elif action == "remove":
            remove_role_from_user(target_user, role_name, operator=request.user, ip_address=ip_addr)
            message = f"Rol '{role_name}' revocado exitosamente a {target_user.email}."
        else:
            return Response(
                {"error": f"Acción inválida '{action}'. Use 'assign' o 'remove'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        updated_roles = list(target_user.groups.values_list("name", flat=True))
        return Response({
            "message": message,
            "user_id": str(target_user.id),
            "roles": updated_roles,
        }, status=status.HTTP_200_OK)

    except PermissionDenied as e:
        return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)
    except ValidationError as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def permissions_catalog_view(request):
    """
    Retorna el catálogo completo de módulos y capacidades sensibles
    para el panel de matriz de permisos de LEVELPRO OS V4.0.
    """
    catalog = {
        "modules": ALL_MODULES,
        "capabilities": ALL_SENSITIVE_PERMISSIONS,
        "role_matrix": DEFAULT_ROLE_MATRIX,
        "role_descriptions": ROLE_DESCRIPTIONS,
    }
    return Response(catalog, status=status.HTTP_200_OK)
