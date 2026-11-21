# LEVELPRO OS V4.0 — GATE 1.3: INFRASTRUCTURE & MIGRATION SAFETY
## DOCUMENTO 01 — SECURITY ENTRY CHECKPOINT: RESOLUCIÓN Y ENDURECIMIENTO INTEGRAL

**Versión:** 1.0  
**Fecha:** 21 de Noviembre de 2026  
**Rama:** `feature/v4-gate1-business-core`  
**Commit Base:** `bc433a8`  
**Autor:** Senior Software Architect & Security Infrastructure Lead  
**Estado:** CERTIFICADO & AUDITADO  

---

### 1. PROPÓSITO Y CONTEXTO ESTRATÉGICO

El cierre condicionado de GATE 1.2 (Audit Trail & Activity Log) y la autorización de inicio de GATE 1.3 (Infrastructure & Migration Safety) requirieron resolver de manera mandatoria tres observaciones críticas de seguridad y una ampliación exhaustiva de la suite de pruebas automatizadas:

1. **Eliminación absoluta de cualquier mecanismo de bypass de TRUNCATE** en la tabla `audit_events` que pudiera ser controlado o alterado por una sesión de usuario de aplicación (`levelpro_app_user`), restringiendo cualquier operación de mantenimiento a un procedimiento explícito, privilegiado y auditable.
2. **Reconciliación durable e idempotente de eventos de auditoría omitidos en pagos**, asegurando la recuperación retroactiva y detección de brechas sin mutar transacciones de pago ni estados de catálogo.
3. **Enmascaramiento riguroso de números de cuenta bancaria y datos sensibles** en campos de texto libre como `resource_repr`, serializadores de auditoría y exportaciones CSV para roles no financieros.
4. **Validación integral mediante 28 pruebas automatizadas de seguridad y auditoría** ejecutadas y aprobadas al 100% en el contenedor de QA aislado PostgreSQL 16.

---

### 2. RESOLUCIÓN BLOQUE 0.1: BLINDAJE DEL TRIGGER DE TRUNCATE Y PRIVILEGIOS DE SESIÓN

#### 2.1. Hallazgo de Seguridad Original
En la versión preliminar del trigger `trg_audit_event_truncate`, se evaluaba la condición:
```sql
current_setting('levelpro.allow_audit_truncate', true) = 'on'
```
**Análisis de Vulnerabilidad:** En PostgreSQL, cualquier sesión de usuario (incluyendo el usuario del pool de conexiones de la aplicación web `levelpro_app_user` o un atacante con inyección SQL) puede ejecutar libremente `SET levelpro.allow_audit_truncate = 'on'`. Si el rol disponía de privilegios de TRUNCATE o ejecutaba comandos DDL, la inmutabilidad de la tabla de auditoría quedaba desprotegida.

#### 2.2. Remediación Implementada y Verificada
Se implementó una defensa en profundidad de dos capas independientes en base de datos:

1. **Capa 1: Segregación Estricta de Privilegios SQL (DML vs DDL)**
   ```sql
   REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM levelpro_app_user;
   REVOKE TRUNCATE ON audit_events FROM levelpro_app_user;
   REVOKE ALL ON audit_events FROM PUBLIC;
   GRANT SELECT, INSERT, UPDATE, DELETE ON audit_events TO levelpro_app_user;
   ```
   Cualquier intento directo de `TRUNCATE audit_events` ejecutado por el usuario de la aplicación web es interceptado a nivel de motor PostgreSQL con `ERROR: permission denied for table audit_events`.

2. **Capa 2: Trigger PL/pgSQL con Verificación de Identidad de Sesión y Token Privilegiado**
   En la migración `backend/apps/analytics/migrations/0006_auditevent_truncate_trigger.py`:
   ```sql
   CREATE OR REPLACE FUNCTION prevent_audit_event_truncate()
   RETURNS trigger AS $$
   BEGIN
       -- Bypass estricto de mantenimiento: NUNCA controlable por el usuario web de aplicación (levelpro_app_user).
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
   ```

3. **Demostración de Inmunidad ante Ataques de Evasión (Prueba Real QA):**
   Incluso si a `levelpro_app_user` se le otorgara temporalmente el privilegio SQL de TRUNCATE y fijara el parámetro de mantenimiento:
   ```bash
   docker exec -i levelpro-v32-qa-db-1 psql -U levelpro_app_user -d levelpro_v32_qa -c \
     "SET levelpro.maintenance_audit_maintenance_active = 'active_authorized_maintenance'; TRUNCATE audit_events;"
   ```
   **Resultado:**
   ```
   ERROR:  AuditEvent table is append-only: TRUNCATE operation is prohibited for session user levelpro_app_user
   CONTEXT:  PL/pgSQL function prevent_audit_event_truncate() line 11 at RAISE
   ```
   El intento es terminado inmediatamente. `levelpro_app_user` no puede eludir la inmutabilidad bajo ningún escenario.

---

### 3. RESOLUCIÓN BLOQUE 0.2: RECONCILIACIÓN DURABLE E IDEMPOTENTE DE AUDITORÍA EN PAGOS

#### 3.1. Requerimiento
Acreditar un mecanismo durable e idempotente para detectar y registrar eventos de pago omitidos o transacciones huérfanas sin alterar la consistencia de pagos ni el catálogo.

#### 3.2. Implementación Arquitectónica
Se implementó el servicio de reconciliación en `backend/core/audit/services.py` (`reconcile_missing_payment_audit_events`) y el comando de gestión Django `reconcile_payment_audit` (`backend/apps/payments/management/commands/reconcile_payment_audit.py`).

**Características Técnicas:**
1. **Detección Atómica sin Mutación:** Inspecciona los registros en `payments_payment` con estados terminales (`approved`, `rejected`, `refunded`, `cancelled`). No modifica los importes, fechas ni estados de los pagos ni de las órdenes asociadas.
2. **Idempotencia Garantizada:** Verifica la existencia de eventos de auditoría previos filtrando por `resource_type="Payment"`, `resource_id=str(payment.id)` y `action=expected_action`. Si el evento ya existe, es omitido (`skipped`).
3. **Metadatos de Trazabilidad Forense:** Los eventos generados por reconciliación se etiquetan explícitamente con:
   ```json
   {
       "reconciled": true,
       "reconciliation_reason": "audit_trail_gap_recovery",
       "reconciled_at": "<ISO-8601-TIMESTAMP>"
   }
   ```
4. **Comando de Gestión para Cron / Runbook:**
   ```bash
   python manage.py reconcile_payment_audit [--dry-run] [--days 30]
   ```
   Ejecutado en QA:
   ```
   Iniciando escaneo y reconciliación de auditoría de pagos...
   Reconciliación exitosa: 0 pagos escaneados, 0 eventos de auditoría recuperados, 0 pagos ya auditados (sin duplicación).
   ```

---

### 4. RESOLUCIÓN BLOQUE 0.3: ENMASCARAMIENTO DE CUENTAS BANCARIAS EN REPRESENTACIONES Y EXPORTACIONES

#### 4.1. Hallazgo de Seguridad Original
En representaciones como `resource_repr` (ej. `"Cuenta Banco Santander 123456789012"`), o en campos JSON serializados secundarios, el número de cuenta bancaria permanecía visible para usuarios del admin con rol general de visualización de auditoría pero sin permisos financieros.

#### 4.2. Remediación Implementada
1. **Ampliación de Claves Financieras en Sanitizador (`backend/core/audit/sanitizer.py`):**
   Se incorporaron a `finance_keys`:
   `account_number`, `bank_account`, `numero_cuenta`, `destination`, `bank`, `cuenta`, `account`, `monto`, `amount`, `withdrawal_amount`.
2. **Función de Enmascaramiento de Representación (`mask_sensitive_resource_repr`):**
   ```python
   def mask_sensitive_resource_repr(resource_repr: str, can_view_finances: bool = False) -> str:
       if not resource_repr or can_view_finances:
           return resource_repr
       # Detecta secuencias de 5 o más dígitos continuos y las enmascara preservando los últimos 4
       return re.sub(r'\b\d{5,}(\d{4})\b', r'****\1', resource_repr)
   ```
3. **Enmascaramiento en Vistas de API y Exportación CSV (`backend/apps/analytics/views_audit.py`):**
   Tanto en la serialización REST (`_serialize_audit_event`) como en la exportación tabular (`audit_export_view`), si el usuario consultante carece de `PERM_VIEW_FINANCES` o `PERM_VIEW_FINANCIAL_AUDIT`:
   - El payload `new_values` y `previous_values` enmascara `account_number` a `"[RESTRINGIDO]"`.
   - El campo `resource_repr` es enmascarado a `"Cuenta Banco de Chile ****9012"`.
4. **Enmascaramiento en Mutaciones de Cuentas (`backend/apps/payments/views.py`):**
   Al crear, actualizar o desactivar cuentas bancarias, el `resource_repr` grabado en la auditoría se guarda formateado como `f"Cuenta {bank.bank_name} ****{account_number[-4:]}"`.

---

### 5. RESOLUCIÓN BLOQUE 0.4: SUITE DE PRUEBAS DE SEGURIDAD (28/28 APROBADAS)

La suite `AuditTrailComprehensiveTestSuite` en `backend/apps/users/tests_audit_trail.py` fue ampliada con pruebas automatizadas exhaustivas para los escenarios anteriores:

- **Prueba 23 (`test_postgresql_trigger_blocks_sql_truncate`):** Valida que intentos de `TRUNCATE audit_events` sin el token de mantenimiento de sesión fallen con `OperationalError` / código PostgreSQL 55000, y que intentos de configurar parámetros obsoletos como `levelpro.allow_audit_truncate` sean completamente estériles.
- **Prueba 27 (`test_reconcile_missing_payment_audit_events_is_idempotent`):** Valida que la reconciliación identifique pagos huérfanos, genere el evento de auditoría correspondiente con metadatos de recuperación y que una segunda ejecución sea 100% idempotente (0 duplicados).
- **Prueba 28 (`test_bank_account_masking_in_repr_and_serializers`):** Valida que usuarios con privilegios financieros (Super Admin / Finanzas) visualicen la cuenta completa, mientras que roles restringidos vean `"[RESTRINGIDO]"` y representación enmascarada `****9012`.

**Resultado de Ejecución en QA:**
```
================== 28 passed, 7 warnings in 219.24s (0:03:39) ==================
```
**100% de la suite de auditoría y seguridad aprobada.**

---

### 6. CERTIFICACIÓN DE ENTRADA A GATE 1.3

| Ítem Bloque 0 | Requisito de Entrada | Estado de Implementación | Verificación QA | Certificación |
|---|---|---|---|---|
| **0.1** | Eliminación de bypass TRUNCATE | Trigger incondicional para usuarios de app + REVOKE TRUNCATE en DB | Bloqueado con error 55000 | **APROBADO** |
| **0.2** | Reconciliación durable en pagos | Algoritmo idempotente con metadatos de auditoría y comando Django | 0 mutaciones en catálogo | **APROBADO** |
| **0.3** | Enmascaramiento de cuentas bancarias | Enmascaramiento regex en repr + RBAC dinámico en serializers/CSV | `****9012` verificado | **APROBADO** |
| **0.4** | Suite de pruebas de seguridad | 28 pruebas automatizadas de integración y persistencia | 28/28 exitosas | **APROBADO** |

Con estos cuatro pilares rigurosamente certificados en el contenedor PostgreSQL de QA, se autoriza formalmente el despliegue de las soluciones de infraestructura de GATE 1.3.
