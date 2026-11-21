# LEVELPRO OS V4.0 — GATE 1.3 TECHNICAL PLAN
## INFRASTRUCTURE & MIGRATION SAFETY PLAN

**Documento Rector:** `docs/v4/gate1/gate1.3-infrastructure-and-migration-safety-plan.md`  
**Compuerta:** GATE 1.3 (Security & Business Core Phase 3)  
**Estado:** Propuesta Técnica y Plan de Alineación para Autorización  
**Regla:** NO MODIFICAR CÓDIGO DE GATE 1.3 HASTA APROBACIÓN FORMAL

---

### 1. Diagnóstico del Estado Actual en Infraestructura y Migraciones

La auditoría de la línea base identificó que el despliegue del backend en Google Cloud Run ejecuta `manage.py migrate --noinput` dentro del script de arranque de la instancia web (`entrypoint.sh` o `CMD` de Dockerfile):

#### Riesgos Críticos del Enfoque Actual
1. **Condición de Carrera en Auto-Escalado:** Cuando Cloud Run escala de 0 a $N$ instancias ante un pico de tráfico, múltiples instancias en paralelo intentan ejecutar `manage.py migrate` contra Cloud SQL simultáneamente, provocando bloqueos de tabla (`LockWaitException`), fallos de transacción y reinicios en cascada de contenedores.
2. **Caída por Migración Larga:** Si una migración toma más tiempo que el timeout de inicio de Cloud Run (típicamente 240 segundos), la instancia es cancelada violentamente por el health check de GCP (`SIGKILL`), dejando la base de datos en estado corrupto o a medio migrar.
3. **Violación de Mínimo Privilegio (IAM y SQL):** La cuenta de servicio del contenedor web posee permisos `DDL` completos (`ALTER TABLE`, `CREATE TABLE`, `DROP TABLE`) sobre PostgreSQL, cuando en tiempo de ejecución solo requiere permisos `DML` (`SELECT`, `INSERT`, `UPDATE`, `DELETE`). Si la aplicación web sufre una vulnerabilidad de inyección SQL, el atacante tiene capacidades completas de alteración de esquema.
4. **Falta de Patrón Expand/Contract:** Cambios que renombran o eliminan columnas de inmediato rompen las instancias de Cloud Run de la versión previa que aún se encuentran atendiendo solicitudes durante el despliegue canario o rolling update.

---

### 2. Arquitectura Objetivo para GATE 1.3

```
┌────────────────────────────────────────────────────────────────────────┐
│               ARQUITECTURA DE DESPLIEGUE SEGURO (GATE 1.3)             │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [FASE A: PIPELINE CI/CD (GITHUB ACTIONS / CLOUD BUILD)]               │
│  1. Verificación de migraciones reversibles y expand/contract         │
│  2. Construcción y escaneo de imagen Docker inmutable                   │
│                                                                        │
│  [FASE B: EJECUCIÓN AISLADA — CLOUD RUN JOB (MIGRATOR)]                │
│  • Tarea única desacoplada del tráfico web                             │
│  • Timeout extendido (hasta 60 min si fuese necesario)                │
│  • Rol IAM dedicado: roles/cloudsql.client con usuario DB DDL         │
│  • Ejecución secuencial con pre-flight check de conectividad y bloqueo│
│  • Si falla: ABORTA el despliegue antes de tocar el servicio web      │
│                                                                        │
│  [FASE C: DESPLIEGUE CANARIO / ZERO-DOWNTIME — CLOUD RUN SERVICE]      │
│  • Contenedor web SIN comando migrate en su entrypoint                │
│  • Arranque ultrarrápido (< 5 segundos, warm start instantáneo)       │
│  • Rol IAM de ejecución: Usuario DB DML (sin permisos ALTER/DROP)     │
│  • Health check HTTP /api/v1/health/ directo                           │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 3. Programa de Trabajo y Paquetes de Tareas (GATE 1.3)

#### Paquete 1: Desacoplamiento de Migraciones y Creación de Cloud Run Job
- Modificar `backend/docker/entrypoint.sh` para eliminar `manage.py migrate --noinput`.
- Crear definición de Terraform / gcloud para el Cloud Run Job `levelpro-migration-runner`.
- Configurar script de migración con validación de bloqueos (`pg_locks`), timeouts y logging estructurado.

#### Paquete 2: Segregación de Privilegios de Base de Datos (IAM & PostgreSQL)
- Crear dos usuarios en Cloud SQL:
  1. `levelpro_app_user`: Únicamente permisos `SELECT`, `INSERT`, `UPDATE`, `DELETE` sobre tablas de negocio y `INSERT` sobre `audit_events`.
  2. `levelpro_migrator_user`: Permisos `DDL` (`CREATE`, `ALTER`, `DROP`) sobre el esquema público, restringido exclusivamente al Cloud Run Job.
- Configurar rotación de credenciales vía Google Secret Manager.

#### Paquete 3: Guía y Reglas de Migración Segura (Expand/Contract)
- Establecer como regla obligatoria de ingeniería el ciclo de vida en 3 pasos para mutaciones de esquema:
  1. **Expand:** Agregar nueva columna/tabla manteniendo retrocompatibilidad con la versión anterior.
  2. **Transition:** Desplegar código que escribe en ambas columnas o utiliza la nueva vía fallbacks.
  3. **Contract:** Eliminar la columna o tabla obsoleta una vez que el 100% del tráfico corre en la nueva versión.
- Implementar linter de migraciones en CI para bloquear migraciones no seguras (e.g. `ALTER TABLE ... DEFAULT` en tablas masivas sin soporte de PostgreSQL 11+).

#### Paquete 4: Procedimientos de Rollback y Recuperación ante Desastres
- Runbook paso a paso para revertir migraciones hacia atrás (`manage.py migrate <app> <previous_migration>`).
- Validación de snapshots automatizados de Cloud SQL antes de la ejecución de migraciones complejas.

---

### 4. Criterios de Aceptación para GATE 1.3

1. El contenedor web de Cloud Run arranca limpiamente en menos de 10 segundos sin ejecutar ningún comando de migración.
2. El Cloud Run Job ejecuta las migraciones de forma aislada, reportando estado exitoso a Cloud Logging y deteniéndose automáticamente al concluir.
3. El usuario web de la base de datos no puede ejecutar sentencias `CREATE TABLE` o `DROP TABLE` (verificado con pruebas de inyección controlada).
4. El despliegue de una migración aditiva bajo simulación de tráfico web continuo se ejecuta con 0 errores 500 y 0 interrupciones de servicio (zero-downtime acreditado).
