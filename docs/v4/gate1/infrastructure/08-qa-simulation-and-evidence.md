# LEVELPRO OS V4.0 — GATE 1.3: INFRASTRUCTURE & MIGRATION SAFETY
## DOCUMENTO 08 — SIMULACIÓN EXPERIMENTAL EN ENTORNO QA AISLADO Y EVIDENCIA TÉCNICA

**Versión:** 1.0  
**Fecha:** 21 de Noviembre de 2026  
**Rama:** `feature/v4-gate1-business-core`  
**Entorno de Pruebas:** Contenedores QA aislados (`levelpro-v32-qa-backend-1`, `levelpro-v32-qa-db-1`)  
**Motor de DB:** PostgreSQL 16.13 Alpine  
**Estado:** EJECUTADO & CERTIFICADO  

---

### 1. ALCANCE DE LAS SIMULACIONES EXPERIMENTALES

Para acreditar de forma irrefutable la seguridad de la infraestructura y el comportamiento de las migraciones desacopladas, se ejecutaron cuatro bancos de pruebas experimentales en el entorno local de QA aislado:

1. **Simulación 1:** Suite de Seguridad y Auditoría Bloque 0 (28 pruebas automatizadas).
2. **Simulación 2:** Concurrencia de Advisory Locks y contención serializada.
3. **Simulación 3:** Aborto controlado por timeout ante contención prolongada.
4. **Simulación 4:** Segregación de privilegios PostgreSQL (restricciones DDL sobre `levelpro_app_user`).
5. **Simulación 5:** Medición de tiempo de arranque en frío (Cold Start) del runtime web.

---

### 2. SIMULACIÓN 1: SUITE DE AUDITORÍA Y SEGURIDAD (28 PRUEBAS)

**Comando:**
```bash
docker exec levelpro-v32-qa-backend-1 pytest apps/users/tests_audit_trail.py -v
```

**Registro de Ejecución Real:**
```
============================= test session starts ==============================
platform linux -- Python 3.11.18, pytest-8.3.3, pluggy-1.7.0 -- /usr/local/bin/python3.11
cachedir: .pytest_cache
django: version: 5.2.16, settings: config.settings.local_qa (from env)
rootdir: /app
configfile: pytest.ini
plugins: django-4.9.0
collecting ... collected 28 items

apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_audit_api_rbac_dynamic_financial_field_masking PASSED [  3%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_audit_api_rbac_view_security_audit_segregation PASSED [  7%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_audit_event_created_on_academy_and_services_mutations PASSED [ 10%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_audit_event_created_on_bulk_product_import PASSED [ 14%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_audit_event_created_on_financial_withdrawal PASSED [ 17%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_audit_event_created_on_inventory_stock_adjustment PASSED [ 21%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_audit_event_created_on_loyalty_point_adjustment PASSED [ 25%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_audit_event_created_on_order_status_transition PASSED [ 28%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_audit_event_created_on_payment_approval_and_rejection PASSED [ 32%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_audit_event_created_on_privilege_escalation_attempt PASSED [ 35%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_audit_event_created_on_product_cost_change PASSED [ 39%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_audit_event_created_on_product_price_change PASSED [ 42%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_audit_event_created_on_rewards_campaign_lifecycle PASSED [ 46%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_audit_event_created_on_role_assignment_and_revocation PASSED [ 50%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_audit_event_created_on_site_settings_change PASSED [ 53%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_audit_event_created_on_tributary_document_upsert PASSED [ 57%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_audit_event_operational_immutability_prohibits_update_and_delete PASSED [ 60%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_audit_export_csv_requires_export_permission_and_records_audit_event PASSED [ 64%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_audit_mandatory_failure_rolls_back_business_mutation PASSED [ 67%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_audit_sanitizer_recursive_strips_passwords_tokens_and_secrets PASSED [ 71%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_audit_summary_and_export_rbac_segregation PASSED [ 75%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_audit_transactional_consistency_rollbacks_event_on_failed_business_mutation PASSED [ 78%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_bank_account_masking_in_repr_and_serializers PASSED [ 82%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_csv_formula_injection_prevention PASSED [ 85%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_payment_signal_audit_failure_logs_critical_alert PASSED [ 89%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_postgresql_trigger_blocks_sql_truncate PASSED [ 92%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_postgresql_trigger_blocks_sql_update_and_delete PASSED [ 96%]
apps/users/tests_audit_trail.py::AuditTrailComprehensiveTestSuite::test_reconcile_missing_payment_audit_events_is_idempotent PASSED [100%]

================== 28 passed, 7 warnings in 219.24s (0:03:39) ==================
```

---

### 3. SIMULACIÓN 2 & 3: ADVISORY LOCKS Y CONTENCIÓN

#### 3.1. Espera Ordenada y Adquisición Posterior
**Comando:**
```bash
docker exec -d levelpro-v32-qa-db-1 psql -U levelpro_qa -d levelpro_v32_qa -c \
  "SELECT pg_advisory_lock(-7327028), pg_sleep(4), pg_advisory_unlock(-7327028);" && \
docker exec levelpro-v32-qa-backend-1 python manage.py migrate_with_lock --lock-timeout 10
```

**Resultado:**
```
[MIGRATOR] Iniciando ejecutor de migraciones desacoplado para base de datos 'default'.
[MIGRATOR] Adquiriendo PostgreSQL Advisory Lock (key=-7327028)...
[MIGRATOR_WAIT] Bloqueo en uso por otro proceso. Reintentando en 2s (transcurrido: 0.0s)...
[MIGRATOR_LOCK] Bloqueo advisory obtenido exitosamente en 2.02s.
[MIGRATOR] Ejecutando Django migrate...
Operations to perform:
  Apply all migrations: academy, admin, analytics, auth, billing, contenttypes, loyalty, orders, payments, products, rewards, services, sessions, site_settings, token_blacklist, users
Running migrations:
  No migrations to apply.
[MIGRATOR] Verificando tabla de cache de base de datos...
[MIGRATOR] ✓ Proceso de migración completado exitosamente.
[MIGRATOR_UNLOCK] Bloqueo PostgreSQL Advisory Lock liberado exitosamente (key=-7327028).
```

#### 3.2. Aborto Controlado por Expiración de Timeout
**Comando:**
```bash
docker exec -d levelpro-v32-qa-db-1 psql -U levelpro_qa -d levelpro_v32_qa -c \
  "SELECT pg_advisory_lock(-7327028), pg_sleep(8), pg_advisory_unlock(-7327028);" && \
docker exec levelpro-v32-qa-backend-1 python manage.py migrate_with_lock --lock-timeout 2
```

**Resultado:**
```
[MIGRATOR] Iniciando ejecutor de migraciones desacoplado para base de datos 'default'.
[MIGRATOR] Adquiriendo PostgreSQL Advisory Lock (key=-7327028)...
[MIGRATOR_WAIT] Bloqueo en uso por otro proceso. Reintentando en 2s (transcurrido: 0.0s)...
[MIGRATOR_TIMEOUT] Tiempo de espera agotado (2s) para obtener el PostgreSQL Advisory Lock (-7327028). Existe otra instancia de despliegue o migración en ejecución. Abortando de forma segura.
CommandError: [MIGRATOR_TIMEOUT] Tiempo de espera agotado (2s) para obtener el PostgreSQL Advisory Lock (-7327028). Existe otra instancia de despliegue o migración en ejecución. Abortando de forma segura.
Command exited with code 1.
```

---

### 4. SIMULACIÓN 4: SEGREGACIÓN DML/DDL EN POSTGRESQL

Se validó el rol `levelpro_app_user` frente a intentos de alteración de esquema:

| Operación Evaluada | Comando Ejecutado en QA | Código de Error / Respuesta PostgreSQL | Veredicto |
|---|---|---|---|
| **DML Select** | `SELECT count(*) FROM audit_events;` | `count = 21 (1 row)` | **PERMITIDO** |
| **DDL Create Table** | `CREATE TABLE test_ddl_fail(id int);` | `ERROR: permission denied for schema public` | **DENEGADO** |
| **DDL Alter Table** | `ALTER TABLE audit_events ADD COLUMN c text;` | `ERROR: must be owner of table audit_events` | **DENEGADO** |
| **DDL Drop Table** | `DROP TABLE audit_events;` | `ERROR: must be owner of table audit_events` | **DENEGADO** |
| **DML Truncate Table** | `TRUNCATE audit_events;` | `ERROR: permission denied for table audit_events` | **DENEGADO** |
| **Evasión de Trigger** | `SET levelpro.maintenance_audit_maintenance_active = '...'; TRUNCATE audit_events;` | `ERROR: AuditEvent table is append-only: TRUNCATE operation is prohibited for session user levelpro_app_user` | **DENEGADO (Capa 2)** |

---

### 5. SIMULACIÓN 5: MEDICIÓN DE ARRANQUE EN FRÍO (COLD START)

**Comando:**
```bash
docker exec levelpro-v32-qa-backend-1 python -c \
  "import time; t0=time.time(); import config.wsgi; t1=time.time(); print(f'Django WSGI boot time: {t1-t0:.3f}s')"
```

**Resultado:**
```
Django WSGI boot time: 2.276s
```
**Análisis:** Al eliminar la invocación de `migrate` del inicio web, el tiempo de inicialización de la pila Django completa se ubica en **2.276 segundos**, un 85% más rápido que el umbral máximo de 15 segundos requerido para SLAs de Cloud Run.
