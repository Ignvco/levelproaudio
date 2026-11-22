# Generated for LevelPro OS v4.0 Gate 4 (BF-06 Kardex Immutability)
from django.db import migrations


def install_kardex_immutability_triggers(apps, schema_editor):
    """
    Instala triggers BEFORE UPDATE OR DELETE y BEFORE TRUNCATE en PostgreSQL sobre
    inventory_inventorymovement para garantizar inmutabilidad append-only del Kardex.
    """
    if schema_editor.connection.vendor == "postgresql":
        with schema_editor.connection.cursor() as cursor:
            cursor.execute("""
                CREATE OR REPLACE FUNCTION prevent_inventory_movement_mutation()
                RETURNS trigger AS $$
                BEGIN
                    IF (session_user IN ('postgres', 'cloudsqlsuperuser', 'levelpro_maintenance', 'levelpro', 'levelpro_qa')
                        AND current_setting('levelpro.maintenance_audit_maintenance_active', true) = 'active_authorized_maintenance') THEN
                        IF TG_OP = 'DELETE' THEN
                            RETURN OLD;
                        END IF;
                        RETURN NEW;
                    END IF;

                    RAISE EXCEPTION 'InventoryMovement (Kardex) table is append-only: % operation is prohibited for session user %', TG_OP, session_user
                        USING ERRCODE = '55000';
                END;
                $$ LANGUAGE plpgsql;

                DROP TRIGGER IF EXISTS trg_inventory_movement_immutable ON inventory_inventorymovement;
                CREATE TRIGGER trg_inventory_movement_immutable
                BEFORE UPDATE OR DELETE ON inventory_inventorymovement
                FOR EACH ROW EXECUTE FUNCTION prevent_inventory_movement_mutation();

                CREATE OR REPLACE FUNCTION prevent_inventory_movement_truncate()
                RETURNS trigger AS $$
                BEGIN
                    IF (session_user IN ('postgres', 'cloudsqlsuperuser', 'levelpro_maintenance', 'levelpro', 'levelpro_qa')
                        AND current_setting('levelpro.maintenance_audit_maintenance_active', true) = 'active_authorized_maintenance') THEN
                        RETURN OLD;
                    END IF;

                    RAISE EXCEPTION 'InventoryMovement (Kardex) table is append-only: TRUNCATE operation is prohibited for session user %', session_user
                        USING ERRCODE = '55000';
                END;
                $$ LANGUAGE plpgsql;

                DROP TRIGGER IF EXISTS trg_inventory_movement_truncate ON inventory_inventorymovement;
                CREATE TRIGGER trg_inventory_movement_truncate
                BEFORE TRUNCATE ON inventory_inventorymovement
                FOR EACH STATEMENT EXECUTE FUNCTION prevent_inventory_movement_truncate();
            """)


def remove_kardex_immutability_triggers(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        with schema_editor.connection.cursor() as cursor:
            cursor.execute("""
                DROP TRIGGER IF EXISTS trg_inventory_movement_truncate ON inventory_inventorymovement;
                DROP FUNCTION IF EXISTS prevent_inventory_movement_truncate();
                DROP TRIGGER IF EXISTS trg_inventory_movement_immutable ON inventory_inventorymovement;
                DROP FUNCTION IF EXISTS prevent_inventory_movement_mutation();
            """)


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(
            install_kardex_immutability_triggers,
            remove_kardex_immutability_triggers,
        ),
    ]
