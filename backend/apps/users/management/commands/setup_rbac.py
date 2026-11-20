# apps/users/management/commands/setup_rbac.py
"""
Comando de gestión para inicializar y sincronizar roles, grupos y permisos RBAC
en LEVELPRO OS V4.0 de forma idempotente.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth import get_user_model

from core.rbac.constants import (
    ALL_ROLES,
    ALL_SENSITIVE_PERMISSIONS,
    DEFAULT_ROLE_MATRIX,
    ROLE_SUPER_ADMIN,
    ROLE_DESCRIPTIONS,
)

User = get_user_model()


class Command(BaseCommand):
    help = "Inicializa los 10 roles empresariales, capacidades sensibles y sincroniza superusuarios en LEVELPRO OS V4.0."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Iniciando aprovisionamiento RBAC LEVELPRO OS V4.0..."))

        # 1. Crear ContentType y Permisos Sensibles
        content_type = ContentType.objects.get_for_model(User)
        created_perms = 0
        existing_perms = 0

        permission_cache = {}
        for cap in ALL_SENSITIVE_PERMISSIONS:
            name_display = f"RBAC: {cap.replace('_', ' ').capitalize()}"
            perm, created = Permission.objects.get_or_create(
                codename=cap,
                content_type=content_type,
                defaults={"name": name_display},
            )
            permission_cache[cap] = perm
            if created:
                created_perms += 1
            else:
                existing_perms += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Permisos sensibles asegurados: {len(ALL_SENSITIVE_PERMISSIONS)} "
                f"({created_perms} creados, {existing_perms} existentes)."
            )
        )

        # 2. Crear Grupos / Roles Empresariales
        created_groups = 0
        for role_name in ALL_ROLES:
            group, created = Group.objects.get_or_create(name=role_name)
            if created:
                created_groups += 1

            # Sincronizar permisos del rol
            role_config = DEFAULT_ROLE_MATRIX.get(role_name, {})
            caps = role_config.get("capabilities", [])
            perms_to_add = [permission_cache[c] for c in caps if c in permission_cache]
            group.permissions.set(perms_to_add)

        self.stdout.write(
            self.style.SUCCESS(
                f"Grupos/Roles empresariales asegurados: {len(ALL_ROLES)} "
                f"({created_groups} creados, {len(ALL_ROLES) - created_groups} actualizados)."
            )
        )

        # 3. Asignar superusuarios a ROLE_SUPER_ADMIN
        super_admin_group = Group.objects.get(name=ROLE_SUPER_ADMIN)
        superusers = User.objects.filter(is_superuser=True)
        assigned_su = 0
        for su in superusers:
            if not su.groups.filter(name=ROLE_SUPER_ADMIN).exists():
                su.groups.add(super_admin_group)
                assigned_su += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Superusuarios sincronizados con rol '{ROLE_SUPER_ADMIN}': "
                f"{superusers.count()} total ({assigned_su} recién asignados)."
            )
        )

        self.stdout.write(self.style.SUCCESS("✓ Aprovisionamiento RBAC completado exitosamente."))
