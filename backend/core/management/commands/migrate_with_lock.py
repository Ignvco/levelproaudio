# backend/core/management/commands/migrate_with_lock.py
"""
LEVELPRO OS V4.0 — GATE 1.3: DECOUPLED MIGRATION RUNNER WITH ADVISORY LOCKING

Ejecutor de migraciones desacoplado con bloqueo distribuido (PostgreSQL Advisory Locks).
Garantiza la serialización de ejecuciones concurrentes de migraciones, previniendo
colisiones DDL, interbloqueos y corrupción del estado en django_migrations.
"""

import logging
import time
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import DEFAULT_DB_ALIAS, connections

logger = logging.getLogger("levelpro.infrastructure")

# Clave fija de 64 bits para el Advisory Lock de LevelPro OS
# hashtext('levelpro_migration_lock') = -7327028
LEVELPRO_MIGRATION_ADVISORY_LOCK_KEY = -7327028


class Command(BaseCommand):
    help = (
        "Ejecuta las migraciones de Django de forma desacoplada y atómica, "
        "coordinando instancias concurrentes mediante PostgreSQL Advisory Locks."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "app_label",
            nargs="?",
            help="App label de la aplicación a migrar (opcional).",
        )
        parser.add_argument(
            "migration_name",
            nargs="?",
            help="Nombre de la migración objetivo o 'zero' (opcional).",
        )
        parser.add_argument(
            "--database",
            default=DEFAULT_DB_ALIAS,
            help="Base de datos sobre la cual aplicar las migraciones (default: 'default').",
        )
        parser.add_argument(
            "--lock-timeout",
            type=int,
            default=60,
            help="Tiempo máximo en segundos para esperar la obtención del Advisory Lock (default: 60s).",
        )
        parser.add_argument(
            "--fake",
            action="store_true",
            help="Marcar migraciones como ejecutadas sin aplicar SQL.",
        )
        parser.add_argument(
            "--fake-initial",
            action="store_true",
            help="Detectar si las tablas existen y marcar la migración inicial como fake.",
        )
        parser.add_argument(
            "--plan",
            action="store_true",
            help="Mostrar el plan de migraciones sin ejecutarlas.",
        )
        parser.add_argument(
            "--check",
            action="store_true",
            help="Salir con código de error si existen migraciones pendientes.",
        )
        parser.add_argument(
            "--noinput",
            "--no-input",
            action="store_false",
            dest="interactive",
            help="No solicitar confirmación interactiva.",
        )
        parser.add_argument(
            "--skip-cache-table",
            action="store_true",
            help="Omitir la verificación o creación de la tabla de cache.",
        )

    def handle(self, *args, **options):
        database = options["database"]
        connection = connections[database]
        lock_timeout = options["lock_timeout"]
        is_postgres = connection.vendor == "postgresql"

        self.stdout.write(
            self.style.NOTICE(
                f"[MIGRATOR] Iniciando ejecutor de migraciones desacoplado para base de datos '{database}'."
            )
        )

        lock_acquired = False
        start_time = time.time()

        if is_postgres:
            self.stdout.write(
                f"[MIGRATOR] Adquiriendo PostgreSQL Advisory Lock (key={LEVELPRO_MIGRATION_ADVISORY_LOCK_KEY})..."
            )
            with connection.cursor() as cursor:
                while True:
                    cursor.execute(
                        "SELECT pg_try_advisory_lock(%s);",
                        [LEVELPRO_MIGRATION_ADVISORY_LOCK_KEY],
                    )
                    acquired = cursor.fetchone()[0]
                    if acquired:
                        lock_acquired = True
                        elapsed = time.time() - start_time
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"[MIGRATOR_LOCK] Bloqueo advisory obtenido exitosamente en {elapsed:.2f}s."
                            )
                        )
                        break

                    elapsed = time.time() - start_time
                    if elapsed >= lock_timeout:
                        err_msg = (
                            f"[MIGRATOR_TIMEOUT] Tiempo de espera agotado ({lock_timeout}s) para obtener el "
                            f"PostgreSQL Advisory Lock ({LEVELPRO_MIGRATION_ADVISORY_LOCK_KEY}). "
                            "Existe otra instancia de despliegue o migración en ejecución. Abortando de forma segura."
                        )
                        logger.error(err_msg)
                        raise CommandError(err_msg)

                    self.stdout.write(
                        self.style.WARNING(
                            f"[MIGRATOR_WAIT] Bloqueo en uso por otro proceso. Reintentando en 2s (transcurrido: {elapsed:.1f}s)..."
                        )
                    )
                    time.sleep(2)
        else:
            self.stdout.write(
                self.style.NOTICE(
                    f"[MIGRATOR] Motor {connection.vendor} no requiere PostgreSQL Advisory Locks. Procediendo directamente."
                )
            )

        try:
            # Construir argumentos para el comando nativo migrate
            migrate_kwargs = {
                "database": database,
                "interactive": options.get("interactive", False),
            }
            if options.get("fake"):
                migrate_kwargs["fake"] = True
            if options.get("fake_initial"):
                migrate_kwargs["fake_initial"] = True
            if options.get("plan"):
                migrate_kwargs["plan"] = True
            if options.get("check"):
                migrate_kwargs["check"] = True

            app_label = options.get("app_label")
            migration_name = options.get("migration_name")

            migrate_args = []
            if app_label:
                migrate_args.append(app_label)
                if migration_name:
                    migrate_args.append(migration_name)

            self.stdout.write("[MIGRATOR] Ejecutando Django migrate...")
            call_command("migrate", *migrate_args, **migrate_kwargs)

            # Creación o validación idempotente de tabla de cache si aplica
            if not options.get("skip_cache_table") and not options.get("check") and not options.get("plan"):
                try:
                    self.stdout.write("[MIGRATOR] Verificando tabla de cache de base de datos...")
                    call_command("createcachetable", database=database)
                except Exception as cache_exc:
                    # Idempotente: si ya existe o no se usa DatabaseCache, continuar
                    self.stdout.write(
                        self.style.NOTICE(f"[MIGRATOR] Nota en createcachetable: {cache_exc}")
                    )

            self.stdout.write(
                self.style.SUCCESS("[MIGRATOR] ✓ Proceso de migración completado exitosamente.")
            )

        finally:
            if lock_acquired and is_postgres:
                try:
                    with connection.cursor() as cursor:
                        cursor.execute(
                            "SELECT pg_advisory_unlock(%s);",
                            [LEVELPRO_MIGRATION_ADVISORY_LOCK_KEY],
                        )
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"[MIGRATOR_UNLOCK] Bloqueo PostgreSQL Advisory Lock liberado exitosamente (key={LEVELPRO_MIGRATION_ADVISORY_LOCK_KEY})."
                        )
                    )
                except Exception as unlock_exc:
                    logger.warning(
                        f"Error al liberar advisory lock de migración: {unlock_exc}"
                    )
