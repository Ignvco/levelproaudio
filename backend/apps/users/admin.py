# apps/users/admin.py

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.core.exceptions import PermissionDenied
from django.db.models import Q
from core.rbac.constants import ROLE_SUPER_ADMIN
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display  = ['email', 'username', 'first_name', 'last_name', 'is_staff', 'is_superuser', 'is_active']
    search_fields = ['email', 'username', 'first_name', 'last_name']
    ordering      = ['email']

    # Formulario de CREACIÓN — agrega email obligatorio
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': (
                'email', 'username',
                'first_name', 'last_name',
                'password1', 'password2',
            ),
        }),
    )

    # Formulario de EDICIÓN
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Información adicional', {
            'fields': (
                'phone',
                'address_street', 'address_comuna', 'address_city',
                'address_province', 'address_zip'
            )
        }),
    )

    def get_readonly_fields(self, request, obj=None):
        ro = list(super().get_readonly_fields(request, obj))
        if not request.user.is_superuser:
            for field in ("is_superuser", "is_staff", "groups", "user_permissions", "is_active"):
                if field not in ro:
                    ro.append(field)
        return tuple(ro)

    def has_change_permission(self, request, obj=None):
        if obj is not None and (obj.is_superuser or obj.is_staff) and not request.user.is_superuser:
            return False
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if not request.user.is_superuser:
            return False
        if obj is not None and obj.is_superuser:
            active_supers = User.objects.filter(is_active=True).filter(
                Q(is_superuser=True) | Q(groups__name=ROLE_SUPER_ADMIN)
            ).distinct().count()
            if active_supers <= 1:
                return False
        return super().has_delete_permission(request, obj)

    def save_model(self, request, obj, form, change):
        if not request.user.is_superuser:
            if change:
                orig = User.objects.get(pk=obj.pk)
                if orig.is_superuser or orig.is_staff:
                    raise PermissionDenied("Solo un Super Admin puede modificar cuentas de staff o superusuario.")
                obj.is_superuser = orig.is_superuser
                obj.is_staff = orig.is_staff
            else:
                obj.is_superuser = False
                obj.is_staff = False
        elif change:
            orig = User.objects.get(pk=obj.pk)
            if orig.is_superuser and (not obj.is_superuser or not obj.is_active):
                other_active_supers = (
                    User.objects.filter(is_active=True)
                    .filter(Q(is_superuser=True) | Q(groups__name=ROLE_SUPER_ADMIN))
                    .exclude(pk=obj.pk)
                    .distinct()
                    .count()
                )
                if other_active_supers == 0:
                    raise PermissionDenied("No se puede desactivar ni revocar privilegios al último Super Admin activo.")
        super().save_model(request, obj, form, change)
