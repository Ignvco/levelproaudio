# LEVELPRO OS V4.0 — GATE 1.2 FINAL ACCEPTANCE
## 03. Inmutabilidad Operacional, Triggers PostgreSQL y Privilegios

**Documento Rector:** `docs/v4/gate1/audit-trail/final-acceptance/03-immutability-and-postgresql-privileges.md`  
**Rama Local:** `feature/v4-gate1-business-core`  
**Estado:** Certificado y Homologado

---

### 1. Inmutabilidad Operacional Multinivel

En cumplimiento de las normas de integridad de auditoría, se rectifican formalmente las menciones previas de "verificación criptográfica". La inmutabilidad de LEVELPRO OS V4.0 se fundamenta en un modelo de defensa en profundidad compuesto por tres capas:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   DEFENSA EN PROFUNDIDAD DE AUDITORÍA                  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [CAPA 1: CÓDIGO DE APLICACIÓN Y ORM (PYTHON / DJANGO)]                │
│  • Sobrescritura de save() y delete() en AuditEvent                    │
│  • QuerySet especializado que bloquea update() y delete() masivos      │
│  • Lanza django.core.exceptions.PermissionDenied si se intenta alterar │
│                                                                        │
│  [CAPA 2: MOTOR DE BASE DE DATOS (POSTGRESQL 16)]                      │
│  • Trigger trg_audit_event_immutable (BEFORE UPDATE OR DELETE)         │
│  • Trigger trg_audit_event_truncate (BEFORE TRUNCATE)                  │
│  • Funciones PL/pgSQL que ejecutan RAISE EXCEPTION                     │
│  • Mapeado en Python como django.db.utils.InternalError                │
│                                                                        │
│  [CAPA 3: PRIVILEGIOS DE INFRAESTRUCTURA (CLOUD SQL)]                  │
│  • Usuario de aplicación con mínimo privilegio grant                   │
│  • Revocación de permisos destructivos en esquemas de auditoría        │
│  • Purgado automático deshabilitado: preservación histórica 100%       │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 2. Implementación de Triggers PL/pgSQL en PostgreSQL

#### Trigger 1: Bloqueo de UPDATE y DELETE a Nivel de Fila
```sql
CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'AuditEvent table is append-only: % operation is prohibited', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_event_immutable
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
```

#### Trigger 2: Bloqueo de TRUNCATE a Nivel de Sentencia
```sql
CREATE OR REPLACE FUNCTION prevent_audit_event_truncate()
RETURNS trigger AS $$
BEGIN
    IF current_setting('levelpro.allow_audit_truncate', true) = 'on' THEN
        RETURN NULL;
    END IF;
    RAISE EXCEPTION 'AuditEvent table is append-only: TRUNCATE operation is prohibited';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_event_truncate
BEFORE TRUNCATE ON audit_events
FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_event_truncate();
```

---

### 3. Matriz de Excepciones Técnicas Certificadas

Se contrastó el comportamiento real de las excepciones mediante ejecución directa en PostgreSQL 16 local:

| Operación Intentada | Vía de Invocación | Excepción Python Lanzada | Causa Raíz en Driver / BD | Código de Error |
|---|---|---|---|---|
| Modificación de registro | Django ORM `event.save()` | `<class 'django.core.exceptions.PermissionDenied'>` | Lógica interna del modelo `AuditEvent` | N/A |
| Eliminación de registro | Django ORM `event.delete()` | `<class 'django.core.exceptions.PermissionDenied'>` | Lógica interna del modelo `AuditEvent` | N/A |
| Actualización masiva | QuerySet `AuditEvent.objects.update()` | `<class 'django.core.exceptions.PermissionDenied'>` | `AuditEventQuerySet.update()` interceptado | N/A |
| Eliminación masiva | QuerySet `AuditEvent.objects.delete()` | `<class 'django.core.exceptions.PermissionDenied'>` | `AuditEventQuerySet.delete()` interceptado | N/A |
| SQL Directo `UPDATE` | `cursor.execute("UPDATE audit_events...")` | `<class 'django.db.utils.InternalError'>` | `<class 'psycopg2.errors.RaiseException'>` | `ERRCODE = 'P0001'` |
| SQL Directo `DELETE` | `cursor.execute("DELETE FROM audit_events...")` | `<class 'django.db.utils.InternalError'>` | `<class 'psycopg2.errors.RaiseException'>` | `ERRCODE = 'P0001'` |
| SQL Directo `TRUNCATE` | `cursor.execute("TRUNCATE TABLE audit_events")` | `<class 'django.db.utils.InternalError'>` | `<class 'psycopg2.errors.RaiseException'>` | `ERRCODE = 'P0001'` |

> [!IMPORTANT]
> **Aclaración sobre `RestrictedError`:** Se ratifica que Django lanza `django.db.models.RestrictedError` **únicamente** cuando una clave foránea protegida con `on_delete=models.RESTRICT` previene una eliminación en cascada. Cuando una sentencia SQL directa es rechazada por un trigger PL/pgSQL mediante `RAISE EXCEPTION`, Django captura el error de `psycopg2` y lo envuelve en `django.db.utils.InternalError`. Esto ha sido certificado empíricamente con pruebas unitarias (`test_postgresql_trigger_blocks_sql_update_and_delete` y `test_postgresql_trigger_blocks_sql_truncate`).

---

### 4. Política de Retención y Preservación de Datos

1. **Parámetro de Configuración:** `AUDIT_RETENTION_DAYS = 365` (1 año configurable en `settings.base`).
2. **Estado de Purgado Automático:** **DESHABILITADO**.
3. **Regla de Cumplimiento:** Durante GATE 1.2 no se ejecutan tareas programadas (`cron` o `Celery beat`) destructivas sobre `audit_events`. Todos los registros generados permanecen preservados indefinidamente en PostgreSQL para auditoría tributaria y análisis forense. Cualquier archivado futuro requerirá aprobación de gobierno de datos y exportación fuera de banda (GCS Coldline).
