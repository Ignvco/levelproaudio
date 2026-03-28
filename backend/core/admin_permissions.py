# core/admin_permissions.py
# Permiso reutilizable para todos los endpoints del admin

from rest_framework.permissions import BasePermission

class IsAdminOrStaff(BasePermission):
    """Solo staff o superuser pueden acceder al panel admin."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (request.user.is_staff or request.user.is_superuser)
        )