# apps/users/management/commands/setup_rbac.py
"""
Comando de gestión para inicializar y sincronizar roles, grupos y permisos RBAC
en LEVELPRO OS V4.0 de forma estrictamente idempotente y no destructiva.
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
)

User = get_user_model()


class Command(BaseCommand):
    help = "Inicializa los 10 roles empresariales y capacidades sensibles en LEVELPRO OS V4.0 sin destruir configuraciones existentes ni modificar usuarios reales."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-defaults",
            action="store_true",
            help="Restablece los permisos de cada grupo exactamente a la matriz por defecto (sobrescribe permisos adicionales).",
        )
        parser.add_argument(
            "--sync-superusers",
            action="store_true",
            help="Asigna el grupo Super Admin a cuentas con is_superuser=True que aún no lo tengan.",
        )

    def handle(self, *args, **options):
        reset_defaults = options.get("reset_defaults", False)
        sync_superusers = options.get("sync_superusers", False)

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

        # 2. Crear Grupos / Roles Empresariales preservando configuraciones previas
        created_groups = 0
        for role_name in ALL_ROLES:
            group, created = Group.objects.get_or_create(name=role_name)
            if created:
                created_groups += 1

            role_config = DEFAULT_ROLE_MATRIX.get(role_name, {})
            caps = role_config.get("capabilities", [])
            perms_to_add = [permission_cache[c] for c in caps if c in permission_cache]

            if created or reset_defaults:
                group.permissions.set(perms_to_add)
            else:
                # Si el grupo ya existía pero nunca había recibido ningún permiso RBAC
                # (0 permisos asignados), se inicializa con la matriz base.
                # Si ya tenía permisos configurados, NO se restituyen silenciosamente
                # permisos sensibles retirados de forma deliberada (salvo con --reset-defaults).
                has_existing_perms = group.permissions.exists()
                if not has_existing_perms and perms_to_add:
                    group.permissions.set(perms_to_add)

        self.stdout.write(
            self.style.SUCCESS(
                f"Grupos/Roles empresariales asegurados: {len(ALL_ROLES)} "
                f"({created_groups} creados, {len(ALL_ROLES) - created_groups} preservados/actualizados)."
            )
        )

        # 3. Sincronización opcional de superusuarios (no modifica usuarios por defecto)
        if sync_superusers:
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
