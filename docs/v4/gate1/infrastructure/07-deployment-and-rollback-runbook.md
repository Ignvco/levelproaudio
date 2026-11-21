# LEVELPRO OS V4.0 — GATE 1.3: INFRASTRUCTURE & MIGRATION SAFETY
## DOCUMENTO 07 — RUNBOOK OPERACIONAL DE DESPLIEGUE Y ROLLBACK DE INFRAESTRUCTURA

**Versión:** 1.0  
**Fecha:** 21 de Noviembre de 2026  
**Rama:** `feature/v4-gate1-business-core`  
**Autor:** DevOps Lead & Release Engineer  
**Estado:** VIGENTE & OPERACIONAL  

---

### 1. OBJETIVO Y ALCANCE

Este Runbook operacional establece el protocolo estándar de ejecución, verificación, contención y reversión rápida (Rollback) para todos los despliegues de infraestructura y cambios de base de datos en LEVELPRO OS V4.0 sobre Google Cloud Platform (Cloud Build, Cloud Run y Cloud SQL).

---

### 2. PROTOCOLO DE DESPLIEGUE ESTÁNDAR (CI/CD)

El pipeline se encuentra automatizado a través de `cloudbuild.yaml`.

#### 2.1. Fases del Flujo de Despliegue
1. **Fase 0: Preflight Automatizado en CI (`backend-tests`):**
   - Ejecuta tests unitarios de backend y verificación de integridad de órdenes con PostgreSQL efímero.
   - Si algún test falla, el pipeline aborta de inmediato con código 1.
2. **Fase 1 & 2: Construcción de Imágenes (`build-backend`, `build-frontend`):**
   - Construye las imágenes Docker optimizadas con tags inmutables y `latest`.
3. **Fase 3 & 4: Publicación en Artifact Registry (`push-backend`, `push-frontend`):**
   - Publica los contenedores validados en el registro de Google Cloud.
4. **Fase 4.5: Ejecución Desacoplada de Migraciones (`run-migrations`):**
   - Invoca el Cloud Run Job `levelproaudio-migrator-job` mediante `gcloud run jobs execute levelproaudio-migrator-job --region=us-central1 --wait`.
   - El Job adquiere el PostgreSQL Advisory Lock (`-7327028`), aplica las migraciones y sale con código 0.
5. **Fase 5 & 6: Despliegue de Servicios Web (`deploy-backend`, `deploy-frontend`):**
   - Crea nuevas revisiones en Cloud Run Service.
   - Aplica verificación de salud (`health check`) antes de rutear el 100% del tráfico.

---

### 3. MATRIZ DE ESCENARIOS DE FALLO Y PROTOCOLOS DE ROLLBACK

#### Escenario 1: Fallo durante la Ejecución de Migraciones (Cloud Run Job)
- **Síntoma:** El paso `run-migrations` en Cloud Build devuelve código de error (exit code 1).
- **Diagnóstico:** Conflicto de constraint de esquema, sintaxis SQL inválida o timeout de advisory lock.
- **Acción Automática del Pipeline:**
  - Cloud Build aborta la ejecución inmediatamente.
  - Los pasos 5 y 6 (`deploy-backend` y `deploy-frontend`) **NO** se ejecutan.
- **Impacto en Producción:** **Cero tiempo de inactividad (Zero Downtime)**. Las instancias web en producción continúan operando con la revisión anterior sobre el esquema previo (o compatible).
- **Procedimiento de Recuperación:**
  1. Consultar logs detallados del Job:
     ```bash
     gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=levelproaudio-migrator-job" --limit 50 --format="value(textPayload)"
     ```
  2. Corregir la migración en la rama local, probar en el entorno aislado de QA y someter un nuevo commit.

#### Escenario 2: Fallo en el Startup del Servicio Web (Health Check Failed)
- **Síntoma:** La migración concluyó exitosamente, pero las instancias del backend fallan al arrancar (ej. error en `web_entrypoint.sh` o variable de entorno faltante).
- **Comportamiento Nativo de Cloud Run:**
  - Cloud Run no rutea tráfico a una revisión hasta que pasa los checks de salud.
  - El 100% del tráfico permanece en la revisión previa (`healthy revision`).
- **Acción Manual de Rollback Forzado (si el tráfico fue ruteado parcialmente):**
  ```bash
  # Listar revisiones disponibles
  gcloud run revisions list --service=levelproaudio-backend --region=us-central1
  
  # Forzar el 100% del tráfico a la revisión previa conocida estable (ej. levelproaudio-backend-00042)
  gcloud run services update-traffic levelproaudio-backend \
      --to-revisions=levelproaudio-backend-PREVIOUS_STABLE_REVISION=100 \
      --region=us-central1
  ```

#### Escenario 3: Reversión de Migraciones de Base de Datos (Database Down-Migration)
- **Condición:** Si una migración aditiva necesita ser revertida de forma segura.
- **Regla:** Dado el contrato Expand/Contract, la base de datos es compatible con versiones previas; sin embargo, si se requiere revertir a un estado de migración específico:
  1. Ejecutar el Job de migración apuntando a la versión objetivo:
     ```bash
     gcloud run jobs execute levelproaudio-migrator-job \
         --region=us-central1 \
         --args="python,manage.py,migrate_with_lock,app_label,migration_name_target,--noinput" \
         --wait
     ```
  2. Verificar estado de consistencia en PostgreSQL:
     ```bash
     gcloud sql connect levelproaudio-db --user=levelpro_migrator_user --database=levelproaudio
     # SELECT app, name, applied FROM django_migrations ORDER BY applied DESC LIMIT 10;
     ```

---

### 4. CHECKLIST OPERACIONAL DE PRE-DESPLIEGUE

Antes de autorizar la ejecución del pipeline de Cloud Build para una nueva compuerta:

- [ ] Las 28 pruebas de auditoría y seguridad pasan en el contenedor de QA aislado.
- [ ] Las 100 pruebas unitarias frontend pasan (`npm run test:unit`).
- [ ] La compilación de producción frontend (`npm run build`) concluye con código 0 y sin warnings críticos.
- [ ] El script de migración cumple con las reglas del contrato Expand/Contract (aditivo, sin bloqueos de tabla).
- [ ] Las variables de entorno y secretos nuevos están presentes en Google Secret Manager.
- [ ] La Service Account `levelproaudio-migrator` cuenta con permisos vigentes en IAM y PostgreSQL.
