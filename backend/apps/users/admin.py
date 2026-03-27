# apps/users/admin.py

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display  = ['email', 'username', 'first_name', 'last_name', 'is_staff']
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
                'address_street', 'address_city',
                'address_province', 'address_zip'
            )
        }),
    )