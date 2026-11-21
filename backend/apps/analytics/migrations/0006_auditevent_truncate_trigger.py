# Generated for LevelPro OS v4.0 Gate 1.2 Final Acceptance
from django.db import migrations


def install_postgres_truncate_trigger(apps, schema_editor):
    """Instala a nivel de PostgreSQL el trigger BEFORE TRUNCATE sobre audit_events."""
    if schema_editor.connection.vendor == "postgresql":
        with schema_editor.connection.cursor() as cursor:
            cursor.execute("""
                CREATE OR REPLACE FUNCTION prevent_audit_event_truncate()
                RETURNS trigger AS $$
                BEGIN
                    IF current_setting('levelpro.allow_audit_truncate', true) = 'on' THEN
                        RETURN NULL;
                    END IF;
                    RAISE EXCEPTION 'AuditEvent table is append-only: TRUNCATE operation is prohibited';
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
