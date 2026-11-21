# LEVELPRO OS V4.0 — GATE 1.3: INFRASTRUCTURE & MIGRATION SAFETY
## DOCUMENTO 02 — INVENTARIO Y DIAGNÓSTICO DE ENTRYPOINTS Y CICLO DE VIDA DE CONTENEDORES

**Versión:** 1.0  
**Fecha:** 21 de Noviembre de 2026  
**Rama:** `feature/v4-gate1-business-core`  
**Autor:** Senior Software Architect & Infrastructure Engineer  
**Estado:** CERTIFICADO  

---

### 1. PROPÓSITO DEL INVENTARIO

Este documento presenta una auditoría exhaustiva de todos los puntos de entrada (entrypoints), Dockerfiles, especificaciones de compose y configuraciones de CI/CD existentes en el repositorio `Ignvco/levelproaudio`. 

El objetivo primordial es identificar y erradicar cualquier ejecución acoplada de comandos DDL (`python manage.py migrate`) durante el ciclo de vida de los contenedores de servicio web, documentando los riesgos de concurrencia, sobrecarga en cold starts y brechas de seguridad asociadas.

---

### 2. INVENTARIO EXHAUSTIVO DE MANIFESTS Y CONFIGURACIONES DE ENTRADA

#### 2.1. `backend/Dockerfile.prod` (Entorno de Producción Cloud Run)
- **Ruta:** `backend/Dockerfile.prod`
- **Línea Crítica Detectada:** 33 (antes de GATE 1.3)
- **Instrucción Previa:**
  ```dockerfile
  CMD ["sh", "-c", "python manage.py migrate --noinput && (python manage.py createcachetable || true) && exec gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120 --access-logfile - --error-logfile -"]
  ```
- **Diagnóstico:** Cada instancia del servicio web `levelproaudio-backend` ejecutaba `migrate --noinput` en su arranque.
- **Riesgo:** Si Cloud Run escala de 1 a 5 instancias simultáneamente ante un pico de tráfico, las 5 instancias intentan ejecutar `migrate` concurrentemente sobre la base de datos de producción.

#### 2.2. `backend/Dockerfile` (Entorno de Desarrollo Local)
- **Ruta:** `backend/Dockerfile`
- **Instrucción de Entrada:** No define `CMD` propio; delega en `docker-compose.yml`.
- **Diagnóstico:** Diseñado para desarrollo interactivo con montaje de volúmenes en caliente.

#### 2.3. `docker-compose.yml` (Entorno Local y Pre-QA)
- **Ruta:** `docker-compose.yml`
- **Servicio `backend`:**
  ```yaml
  backend:
    working_dir: /app
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: python manage.py runserver 0.0.0.0:8000
  ```
- **Diagnóstico:** No ejecuta migraciones automáticamente en el `command`. Las migraciones en local siempre se aplicaban manualmente por el desarrollador.

#### 2.4. `cloudbuild.yaml` (Pipeline CI/CD Maestro de Producción)
- **Ruta:** `cloudbuild.yaml`
- **Flujo Previo:**
  1. `backend-tests`: Validación en tests unitarios SQLite y script efímero.
  2. `build-backend`: Construcción de imagen productiva con `Dockerfile.prod`.
  3. `build-frontend`: Construcción de imagen Vite.
  4. `push-backend` y `push-frontend`: Carga en Artifact Registry.
  5. `deploy-backend`: Despliegue directo a Cloud Run Service.
  6. `deploy-frontend`: Despliegue frontend.
- **Diagnóstico:** La orquestación CI/CD no poseía una etapa separada para migraciones de base de datos. Asumía tácitamente que el servicio web resolvería las migraciones al inicializarse.

---

### 3. MATRIZ DE RIESGOS DEL ACOPLAMIENTO DE MIGRACIONES EN EL RUNTIME WEB

| Dimensión de Riesgo | Manifestación en Producción | Severidad Técnica |
|---|---|---|
| **Contención de Bloqueos DDL** | Bloqueos exclusivos de tablas (`AccessExclusiveLock`) durante peticiones activas de usuarios, provocando caídas de conexiones y timeouts HTTP 504. | **ALTA (P0)** |
| **Colisiones de Escalado Concurrente** | Múltiples contenedores nuevos intentan insertar registros en `django_migrations` de forma simultánea, causando errores de clave duplicada (`psycopg2.IntegrityError`). | **CRÍTICA (P0)** |
| **Degradación de Cold Starts** | El tiempo de arranque en frío de una nueva instancia se incrementa en 10-25 segundos mientras consulta y valida el grafo de migraciones contra la DB. | **ALTA (P1)** |
| **Violación del Principio de Mínimo Privilegio** | El usuario del pool web (`levelpro_app_user`) debe tener permisos de `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE` y `TRUNCATE`, exponiendo la base de datos ante inyecciones SQL. | **CRÍTICA (P0)** |
| **Imposibilidad de Abortar Despliegues Fallidos** | Si una migración falla en el arranque del contenedor web, el tráfico ya ha sido derivado a la nueva revisión o el contenedor entra en bucle de reinicios incontrolados. | **CRÍTICA (P0)** |

---

### 4. RECTIFICACIÓN Y NUEVA LÍNEA BASE EN GATE 1.3

1. **Eliminación Definitiva en `backend/Dockerfile.prod`:**
   Se sustituyó la instrucción acoplada por una invocación directa y ultraliviana:
   ```dockerfile
   ENTRYPOINT ["/app/docker/web_entrypoint.sh"]
   ```
2. **Creación de Entrypoints Segregados:**
   - `backend/docker/web_entrypoint.sh`: Dedicado exclusivamente al servicio web. Sin llamadas a `migrate`.
   - `backend/docker/migrator_entrypoint.sh`: Dedicado al trabajo efímero de migración con Advisory Lock.
3. **Desacoplamiento en Cloud Build:**
   Se incorporó el paso intermedio `run-migrations` (`gcloud run jobs execute levelproaudio-migrator-job --wait`), bloqueando el despliegue del backend web hasta que la migración concluya con éxito.

---

### 5. VEREDICTO DE AUDITORÍA DE ENTRYPOINTS

- **Entrypoints Acoplados Preexistentes:** 1 (`backend/Dockerfile.prod`).
- **Estado Post-Gate 1.3:** 0 entrypoints acoplados.
- **Conformidad Arquitectónica:** 100% alineada con 12-Factor App (Factores IX y XII: Procesos de administración como tareas únicas y efímeras).
