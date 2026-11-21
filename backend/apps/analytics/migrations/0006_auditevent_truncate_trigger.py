# Generated for LevelPro OS v4.0 Gate 1.2 Final Acceptance / Gate 1.3 Security Hardening
from django.db import migrations


def install_postgres_truncate_trigger(apps, schema_editor):
    """
    Instala a nivel de PostgreSQL el trigger BEFORE TRUNCATE con protección estricta.
    Elimina cualquier bypass controlable por el usuario web de aplicación (levelpro_app_user).
    Restringe operaciones de mantenimiento exclusivamente a superusuario/mantenimiento con token activo.
    """
    if schema_editor.connection.vendor == "postgresql":
        with schema_editor.connection.cursor() as cursor:
            cursor.execute("""
                CREATE OR REPLACE FUNCTION prevent_audit_event_truncate()
                RETURNS trigger AS $$
                BEGIN
                    -- Bypass estricto de mantenimiento: NUNCA controlable por el usuario web de aplicación.
                    -- Solo permitido si el usuario de sesión es postgres, superusuario o rol de mantenimiento de infraestructura,
                    -- Y además se ha fijado explícitamente el token de mantenimiento para esa sesión.
                    IF (session_user IN ('postgres', 'cloudsqlsuperuser', 'levelpro_maintenance', 'levelpro', 'levelpro_qa')
                        AND current_setting('levelpro.maintenance_audit_maintenance_active', true) = 'active_authorized_maintenance') THEN
                        RETURN OLD;
                    END IF;

                    RAISE EXCEPTION 'AuditEvent table is append-only: TRUNCATE operation is prohibited for session user %', session_user
                        USING ERRCODE = '55000';
                END;
                $$ LANGUAGE plpgsql;

                DROP TRIGGER IF EXISTS trg_audit_event_truncate ON audit_events;
                CREATE TRIGGER trg_audit_event_truncate
                BEFORE TRUNCATE ON audit_events
                FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_event_truncate();
            """)


def remove_postgres_truncate_trigger(apps, schema_editor):
    """Revierte el trigger BEFORE TRUNCATE en PostgreSQL."""
    if schema_editor.connection.vendor == "postgresql":
        with schema_editor.connection.cursor() as cursor:
            cursor.execute("""
                DROP TRIGGER IF EXISTS trg_audit_event_truncate ON audit_events;
                DROP FUNCTION IF EXISTS prevent_audit_event_truncate();
            """)


class Migration(migrations.Migration):

    dependencies = [
        ('analytics', '0005_auditevent'),
    ]

    operations = [
        migrations.RunPython(install_postgres_truncate_trigger, remove_postgres_truncate_trigger),
    ]
