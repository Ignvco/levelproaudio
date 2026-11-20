# LEVELPRO OS V4.0 — GATE 1.0 PREFLIGHT
## 04. Certificación Empírica de Producción y Digests Inmutables de Contenedores

**Documento:** `docs/v4/gate1/preflight/04-production-evidence.md`  
**Versión:** 4.0.0-gate1.0  
**Fecha de Certificación:** Noviembre 2026  
**Auditor DevOps:** Senior Cloud Infrastructure & DevOps Security Architect  
**Entorno Verificado:** Google Cloud Platform (Proyecto `levelproaudio`, Región `us-central1`)  
**Método:** Consultas exclusivamente de solo lectura vía Google Cloud SDK (`gcloud`).

---

### 1. Principio de Identidad Inmutable de Artefactos

En estricta respuesta a la directiva del propietario:
> *"No utilizar únicamente :latest como evidencia de identidad del artefacto. Diferenciar paridad de código, imágenes, configuración y esquema."*

Las etiquetas mutables como `:latest` representan punteros dinámicos que pueden ser sobreescritos. La verdadera paridad de despliegue se certifica mediante **digests criptográficos inmutables SHA-256** generados durante el empaquetado y registrados en Artifact Registry y Cloud Run.

---

### 2. Evidencia de Cloud Build y Commit Base Desplegado

El último despliegue exitoso en producción se ejecutó mediante Cloud Build bajo los siguientes metadatos inmutables:

- **Build ID:** `adea45b9-6a52-4f42-b28f-57f5adece3d0`
- **Estado:** `SUCCESS`
- **Fecha y Hora de Creación:** `2026-11-19T20:15:16+00:00`
- **Commit Base Asociado:** `e33f699a55b2709a6921b0c65fe301d2477ee9a8`
- **Mensaje de Commit:** *"fix(payments): aislar activacion de uala/transfer y comando seed_bank_accounts para proteger tests unitarios"*
- **Hash SHA-256 de Fuentes (`sourceProvenance`):** `zBzZRbIuGKFyEDNHvOc2nyECrU3FsX6etJwW0-1nIEY=`
- **Ubicación en Storage:** `gs://levelproaudio_cloudbuild/source/1795119299.963009-2c1080aa27bd41598d29eb0837e477ae.tgz`

---

### 3. Digests Inmutables en Google Cloud Run

#### 3.1. Servicio Backend (`levelproaudio-backend`)
- **Región:** `us-central1`
- **Revisión Activa al 100%:** `levelproaudio-backend-00251-c6x`
- **Tráfico:** `100%` asignado a la última revisión.
- **Imagen Desplegada con Digest SHA-256 Inmutable:**
  ```
  us-central1-docker.pkg.dev/levelproaudio/levelproaudio-docker/backend@sha256:9aa7912ef69e028cc6beea55110de3f33146d6cb033a93e4213991989fb8a10f
  ```
- **Conexión a Base de Datos:** Instancia gestionada `levelproaudio:us-central1:levelproaudio-db` (Cloud SQL PostgreSQL 16).
- **Cuenta de Servicio:** `levelproaudio-app@levelproaudio.iam.gserviceaccount.com`.

#### 3.2. Servicio Frontend (`levelproaudio-frontend`)
- **Región:** `us-central1`
- **Revisión Activa al 100%:** `levelproaudio-frontend-00237-p9f`
- **Tráfico:** `100%` asignado a la última revisión.
- **Imagen Desplegada con Digest SHA-256 Inmutable:**
  ```
  us-central1-docker.pkg.dev/levelproaudio/levelproaudio-docker/frontend@sha256:645ab06c9f20d02e61de539eb1854c64913e8fcc297494df2e792d62300f2522
  ```
- **Servidor Web Interno:** Nginx 1.25+ configurado para SPA con compresión gzip y headers HTTP de seguridad.

---

### 4. Cuadro Comparativo de Niveles de Paridad

| Dimensión de Paridad | Estado de Verificación | Evidencia Técnica |
| :--- | :---: | :--- |
| **Paridad de Código** | **100% Idéntico** | El árbol de código fuente local en `origin/main` coincide bit a bit con el commit `e33f699`. La rama de trabajo `feature/v4-gate0-audit` solo agrega documentación en `docs/v4/`. |
| **Paridad de Imágenes** | **100% Certificada** | Las imágenes corriendo en Cloud Run coinciden con los digests inmutables `sha256:9aa7912e...` (backend) y `sha256:645ab06c...` (frontend) producidos por el build `adea45b9`. |
| **Paridad de Configuración**| **100% Consistente** | Variables de entorno en Cloud Run (`_REGION=us-central1`, `_SQL_INSTANCE=levelproaudio:us-central1:levelproaudio-db`) coincidentes con las sustituciones del Cloud Build. |
| **Paridad de Esquema BD** | **100% Sincronizado** | El historial de migraciones en producción no presenta migraciones pendientes respecto de `e33f699`. |

---

### 5. Análisis del Riesgo de Migraciones en `backend/Dockerfile.prod`

Se ratifica el hallazgo en la directiva de arranque de `backend/Dockerfile.prod:29`:
```dockerfile
CMD ["sh", "-c", "python manage.py migrate --noinput && (python manage.py createcachetable || true) && exec gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120 --access-logfile - --error-logfile -"]
```

#### Implicaciones para Cloud Run:
- Cloud Run no garantiza que solo una instancia inicie a la vez. Ante un despliegue o aumento repentino de peticiones, múltiples instancias arrancan en paralelo.
- Ejecutar `migrate --noinput` en el CMD implica que **todas las instancias concurrentes intentan aplicar DDL sobre Cloud SQL simultáneamente**.
- En tablas con millones de filas o migraciones con `ADD COLUMN NOT NULL`, esto provoca bloqueos de tabla (*Table Locks*) y caídas de servicio.
- **Acción Obligatoria en GATE 1.3:** Diseñar la migración desacoplada como un Cloud Run Job o un paso único en Cloud Build antes del inicio de los pods.
