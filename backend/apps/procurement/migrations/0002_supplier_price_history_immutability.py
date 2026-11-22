# Generated for LevelPro OS v4.0 Gate 4 Preflight (SUP-01)
from django.db import migrations


def install_price_history_immutability_triggers(apps, schema_editor):
    """
    Instala triggers BEFORE UPDATE OR DELETE y BEFORE TRUNCATE en PostgreSQL sobre
    procurement_supplierpricehistory para garantizar inmutabilidad append-only.
    Preserva operaciones de mantenimiento autorizadas bajo rol privilegiado + token de sesión.
    """
    if schema_editor.connection.vendor == "postgresql":
        with schema_editor.connection.cursor() as cursor:
            cursor.execute("""
                CREATE OR REPLACE FUNCTION prevent_supplier_price_history_mutation()
                RETURNS trigger AS $$
                BEGIN
                    IF (session_user IN ('postgres', 'cloudsqlsuperuser', 'levelpro_maintenance', 'levelpro', 'levelpro_qa')
                        AND current_setting('levelpro.maintenance_audit_maintenance_active', true) = 'active_authorized_maintenance') THEN
                        IF TG_OP = 'DELETE' THEN
                            RETURN OLD;
                        END IF;
                        RETURN NEW;
                    END IF;

                    RAISE EXCEPTION 'SupplierPriceHistory table is append-only: % operation is prohibited for session user %', TG_OP, session_user
                        USING ERRCODE = '55000';
                END;
                $$ LANGUAGE plpgsql;

                DROP TRIGGER IF EXISTS trg_supplier_price_history_immutable ON procurement_supplierpricehistory;
                CREATE TRIGGER trg_supplier_price_history_immutable
                BEFORE UPDATE OR DELETE ON procurement_supplierpricehistory
                FOR EACH ROW EXECUTE FUNCTION prevent_supplier_price_history_mutation();

                CREATE OR REPLACE FUNCTION prevent_supplier_price_history_truncate()
                RETURNS trigger AS $$
                BEGIN
                    IF (session_user IN ('postgres', 'cloudsqlsuperuser', 'levelpro_maintenance', 'levelpro', 'levelpro_qa')
                        AND current_setting('levelpro.maintenance_audit_maintenance_active', true) = 'active_authorized_maintenance') THEN
                        RETURN OLD;
                    END IF;

                    RAISE EXCEPTION 'SupplierPriceHistory table is append-only: TRUNCATE operation is prohibited for session user %', session_user
                        USING ERRCODE = '55000';
                END;
                $$ LANGUAGE plpgsql;

                DROP TRIGGER IF EXISTS trg_supplier_price_history_truncate ON procurement_supplierpricehistory;
                CREATE TRIGGER trg_supplier_price_history_truncate
                BEFORE TRUNCATE ON procurement_supplierpricehistory
                FOR EACH STATEMENT EXECUTE FUNCTION prevent_supplier_price_history_truncate();
            """)


def remove_price_history_immutability_triggers(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        with schema_editor.connection.cursor() as cursor:
            cursor.execute("""
                DROP TRIGGER IF EXISTS trg_supplier_price_history_truncate ON procurement_supplierpricehistory;
                DROP FUNCTION IF EXISTS prevent_supplier_price_history_truncate();
                DROP TRIGGER IF EXISTS trg_supplier_price_history_immutable ON procurement_supplierpricehistory;
                DROP FUNCTION IF EXISTS prevent_supplier_price_history_mutation();
            """)


class Migration(migrations.Migration):

    dependencies = [
        ("procurement", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(
            install_price_history_immutability_triggers,
            remove_price_history_immutability_triggers,
        ),
    ]
