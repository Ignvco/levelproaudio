# apps/users/admin.py

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.core.exceptions import PermissionDenied
from django.db import transaction
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
        if obj is not None and (obj.is_superuser or obj.groups.filter(name=ROLE_SUPER_ADMIN).exists()):
            active_supers = User.objects.filter(is_active=True).filter(
                Q(is_superuser=True) | Q(groups__name=ROLE_SUPER_ADMIN)
            ).distinct().count()
            if active_supers <= 1:
                return False
        return super().has_delete_permission(request, obj)

    @transaction.atomic
    def delete_model(self, request, obj):
        super_pks = list(
            User.objects.filter(is_active=True)
            .filter(Q(is_superuser=True) | Q(groups__name=ROLE_SUPER_ADMIN))
            .values_list("pk", flat=True)
            .distinct()
        )
        locked_supers = list(
            User.objects.select_for_update()
            .filter(pk__in=super_pks, is_active=True)
            .order_by("id")
        )
        if any(u.pk == obj.pk for u in locked_supers) and len(locked_supers) <= 1:
            raise PermissionDenied("Operación bloqueada: no se puede eliminar al último Super Admin activo.")
        super().delete_model(request, obj)

    @transaction.atomic
    def delete_queryset(self, request, queryset):
        if not request.user.is_superuser:
            raise PermissionDenied("Solo un Super Admin puede ejecutar eliminaciones masivas de usuarios.")
        super_pks = list(
            User.objects.filter(is_active=True)
            .filter(Q(is_superuser=True) | Q(groups__name=ROLE_SUPER_ADMIN))
            .values_list("pk", flat=True)
            .distinct()
        )
        locked_supers = list(
            User.objects.select_for_update()
            .filter(pk__in=super_pks, is_active=True)
            .order_by("id")
        )
        deleting_pks = set(queryset.values_list("pk", flat=True))
        remaining_supers = [u for u in locked_supers if u.pk not in deleting_pks]
        if len(remaining_supers) == 0:
            raise PermissionDenied("Operación masiva bloqueada: no se puede eliminar a todos los Super Admin activos.")
        super().delete_queryset(request, queryset)

    @transaction.atomic
    def save_model(self, request, obj, form, change):
        if not request.user.is_superuser:
            if change:
                orig = User.objects.select_for_update().get(pk=obj.pk)
                if orig.is_superuser or orig.is_staff:
                    raise PermissionDenied("Solo un Super Admin puede modificar cuentas de staff o superusuario.")
                obj.is_superuser = orig.is_superuser
                obj.is_staff = orig.is_staff
            else:
                obj.is_superuser = False
                obj.is_staff = False
        elif change:
            super_pks = list(
                User.objects.filter(is_active=True)
                .filter(Q(is_superuser=True) | Q(groups__name=ROLE_SUPER_ADMIN))
                .values_list("pk", flat=True)
                .distinct()
            )
            locked_supers = list(
                User.objects.select_for_update()
                .filter(pk__in=super_pks, is_active=True)
                .order_by("id")
            )
            orig = User.objects.select_for_update().get(pk=obj.pk)
            was_super = orig.is_superuser or orig.groups.filter(name=ROLE_SUPER_ADMIN).exists()
            if was_super and (not obj.is_superuser or not obj.is_active):
                other_active_supers = [u for u in locked_supers if u.pk != obj.pk]
                if len(other_active_supers) == 0:
                    raise PermissionDenied("No se puede desactivar ni revocar privilegios al último Super Admin activo.")
        super().save_model(request, obj, form, change)

    @transaction.atomic
    def save_related(self, request, form, formsets, change):
        obj = form.instance
        super().save_related(request, form, formsets, change)
        # Verificar post-save_related que siga existiendo al menos un Super Admin activo
        super_pks = list(
            User.objects.filter(is_active=True)
            .filter(Q(is_superuser=True) | Q(groups__name=ROLE_SUPER_ADMIN))
            .values_list("pk", flat=True)
            .distinct()
        )
        locked_supers = list(
            User.objects.select_for_update()
            .filter(pk__in=super_pks, is_active=True)
            .order_by("id")
        )
        if len(locked_supers) == 0:
            raise PermissionDenied("No se puede quitar el grupo Super Admin al último Super Admin activo.")
