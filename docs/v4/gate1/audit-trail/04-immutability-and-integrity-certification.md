# LEVELPRO OS V4.0 — GATE 1.2: AUDIT TRAIL & ACTIVITY LOG
## DOCUMENTO TÉCNICO 04: CERTIFICACIÓN DE INMUTABILIDAD OPERACIONAL E INTEGRIDAD FORENSE

---

### 1. ALCANCE DE LA CERTIFICACIÓN

El presente documento certifica formalmente que el modelo `AuditEvent` en **LEVELPRO OS V4.0** cumple con la propiedad estricta de **Inmutabilidad Operacional (Append-Only)**. 

Bajo ningún supuesto se permite la modificación (`UPDATE`) o eliminación (`DELETE`) de registros de auditoría una vez emitidos.

---

### 2. MECANISMOS DE PROTECCIÓN IMPLEMENTADOS

#### 2.1. Nivel Aplicación — Django ORM (`apps/analytics/models.py`)
1. **QuerySet & Manager Restringidos**:
   `AuditEventQuerySet` y `AuditEventManager` sobreescriben explícitamente `update()`, `delete()` y `bulk_update()` lanzando `django.core.exceptions.PermissionDenied`:
   ```python
   def update(self, **kwargs):
       raise PermissionDenied("Operación prohibida: Los registros de AuditEvent son estrictamente inmutables (append-only).")

   def delete(self):
       raise PermissionDenied("Operación prohibida: Los registros de AuditEvent no pueden ser eliminados (append-only).")
   ```
2. **Control de Ciclo de Vida en la Instancia**:
   `AuditEvent.save()` verifica si la instancia ya posee clave primaria y no está en estado de inserción (`not self._state.adding`), lanzando `PermissionDenied`.
   `AuditEvent.delete()` rechaza cualquier intento de borrado directo desde el objeto.

#### 2.2. Nivel Base de Datos — PostgreSQL Trigger (`0005_auditevent.py`)
El trigger opera directamente sobre el motor PostgreSQL, protegiendo la tabla contra conexiones directas por consola, scripts externos o herramientas administrativas:
```sql
CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Operación prohibida: Los eventos de auditoría son inmutables (append-only) y no admiten UPDATE ni DELETE.'
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_event_immutable
BEFORE UPDATE OR DELETE ON apps_analytics_auditevent
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
```

---

### 3. EVIDENCIA DE PRUEBAS AUTOMATIZADAS DE CERTIFICACIÓN

Las pruebas automatizadas en `backend/apps/users/tests_audit_trail.py` fueron ejecutadas satisfactoriamente contra la base de datos real PostgreSQL en el contenedor `levelpro-v32-qa-backend-1`:

```
============================= test session starts ==============================
collected 21 items

apps/users/tests_audit_trail.py .....................                    [100%]
================== 21 passed, 7 warnings in 161.27s (0:02:41) ==================
```

#### Caso 1: Inmutabilidad en Python ORM (`test_audit_event_operational_immutability_prohibits_update_and_delete`)
- **Prueba 1A**: Modificación de atributo `event.action = "ALTERED"` e intento de `event.save()`.
  - **Resultado**: `PermissionDenied` capturado y verificado.
- **Prueba 1B**: Intento de eliminación `event.delete()`.
  - **Resultado**: `PermissionDenied` capturado y verificado.
- **Prueba 1C**: Intento de actualización masiva `AuditEvent.objects.filter(id=event.id).update(action="HACKED")`.
  - **Resultado**: `PermissionDenied` capturado y verificado.
- **Prueba 1D**: Intento de borrado masivo `AuditEvent.objects.filter(id=event.id).delete()`.
  - **Resultado**: `PermissionDenied` capturado y verificado.

#### Caso 2: Inmutabilidad en Motor PostgreSQL (`test_postgresql_trigger_blocks_sql_update_and_delete`)
- **Prueba 2A**: Ejecución de SQL crudo `UPDATE apps_analytics_auditevent SET action = 'SQL_HACK' WHERE id = ...`.
  - **Resultado**: `django.db.utils.RestrictedError` disparado por PostgreSQL Trigger.
- **Prueba 2B**: Ejecución de SQL crudo `DELETE FROM apps_analytics_auditevent WHERE id = ...`.
  - **Resultado**: `django.db.utils.RestrictedError` disparado por PostgreSQL Trigger.

#### Caso 3: Consistencia Transaccional y Rollback (`test_audit_transactional_consistency_rollbacks_event_on_failed_business_mutation`)
- **Prueba**: Se inicia una mutación comercial que registra un evento de auditoría dentro de `transaction.atomic()`, seguida por una excepción deliberada que aborta la transacción.
- **Resultado**: La transacción completa hace rollback en PostgreSQL; el evento de auditoría NO queda huérfano ni persistido, demostrando integridad y consistencia ácida (ACID).

---

### 4. DICTAMEN DE CERTIFICACIÓN

Se dictamina que el sistema de auditoría de **LEVELPRO OS V4.0** cumple cabalmente con los requisitos de inmutabilidad operativa, resistencia a manipulación y consistencia transaccional requeridos para su operación institucional.
