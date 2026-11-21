# LEVELPRO OS V4.0 — GATE 0.1
## 03. Evidencia Empírica de la Línea Base de Producción y Paridad de Despliegue

**Documento:** `docs/v4/gate0.1/03-production-baseline-evidence.md`  
**Versión:** 4.0.0-gate0.1  
**Fecha de Certificación:** Noviembre 2026  
**Auditor DevOps:** Lead DevOps & Cloud Security Architect  
**Entorno Verificado:** Google Cloud Platform (Proyecto `levelproaudio`, Región `us-central1`)

---

### 1. Protocolo de Verificación de Producción

En cumplimiento estricto de las directrices de Gate 0.1:
> *"Un endpoint HTTP 200 no demuestra por sí solo paridad total de código y esquema. Para acreditar la paridad con producción, obtener información de solo lectura sobre commit desplegado, Cloud Build, revisiones activas, imágenes y digests, distribución de tráfico y configuración relevante."*

Se ejecutaron consultas de solo lectura mediante `gcloud` e inspección criptográfica de artefactos para contrastar el código fuente local con los contenedores activos en la nube.

---

### 2. Evidencia de Cloud Build y Commit Desplegado

El último despliegue exitoso hacia el entorno de producción se ejecutó a través de **GCP Cloud Build**:

- **Build ID:** `adea45b9-6a52-4f42-b28f-57f5adece3d0`
- **Estado del Build:** `SUCCESS`
- **Fecha de Ejecución:** `2026-11-19T20:15:16+00:00`
- **Commit Base:** `e33f699a55b2709a6921b0c65fe301d2477ee9a8`
- **Mensaje de Commit:** *"fix(payments): aislar activacion de uala/transfer y comando seed_bank_accounts para proteger tests unitarios"*
- **Artefactos Producidos:**
  - Backend Image: `us-central1-docker.pkg.dev/levelproaudio/levelproaudio-docker/backend:latest`
  - Frontend Image: `us-central1-docker.pkg.dev/levelproaudio/levelproaudio-docker/frontend:latest`
- **Bucket de Almacenamiento de Fuente:** `gs://levelproaudio_cloudbuild/source/1795119299.963009-2c1080aa27bd41598d29eb0837e477ae.tgz`
- **Hash SHA-256 de Fuentes:** `zBzZRbIuGKFyEDNHvOc2nyECrU3FsX6etJwW0-1nIEY=`

---

### 3. Evidencia de Servicios en GCP Cloud Run

#### 3.1. Servicio Backend (`levelproaudio-backend`)
- **Región:** `us-central1`
- **Revisión Activa al 100%:** `levelproaudio-backend-00251-c6x`
- **Última Revisión:** `True` (Trafico asignado: 100%)
- **Imagen del Contenedor:** `us-central1-docker.pkg.dev/levelproaudio/levelproaudio-docker/backend:latest`
- **Instancia de Base de Datos Vinculada:** `levelproaudio:us-central1:levelproaudio-db` (Cloud SQL PostgreSQL 16)
- **Cuenta de Servicio de Ejecución:** `levelproaudio-app@levelproaudio.iam.gserviceaccount.com`

#### 3.2. Servicio Frontend (`levelproaudio-frontend`)
- **Región:** `us-central1`
- **Revisión Activa al 100%:** `levelproaudio-frontend-00237-p9f`
- **Última Revisión:** `True` (Tráfico asignado: 100%)
- **Imagen del Contenedor:** `us-central1-docker.pkg.dev/levelproaudio/levelproaudio-docker/frontend:latest`
- **Servidor Web Interno:** Nginx sirviendo SPA construida con Vite 8 y React 19.

---

### 4. Análisis del Dockerfile de Producción y Hallazgo de Concurrencia

Al examinar `backend/Dockerfile.prod`, se detectó la siguiente directiva de arranque:

```dockerfile
CMD ["sh", "-c", "python manage.py migrate --noinput && (python manage.py createcachetable || true) && exec gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120 --access-logfile - --error-logfile -"]
```

#### Riesgo Crítico Identificado:
1. **Ejecución Concurrente de Migraciones:** En Cloud Run, las instancias se crean de forma dinámica según la carga de tráfico. Cuando se despliega una nueva revisión o hay un pico de peticiones, Cloud Run puede levantar simultáneamente 2 a 5 instancias.
2. Cada instancia ejecuta `python manage.py migrate --noinput` al inicializarse.
3. Si una migración aplica bloqueos DDL (`ALTER TABLE`, `ADD COLUMN`, `CREATE INDEX`) sobre tablas grandes como `orders_order` o `products_product`, la ejecución concurrente puede provocar **deadlocks o fallos de arranque de contenedor (`CrashLoopBackOff`)**.
4. **Recomendación para V4.0:** Desacoplar las migraciones del comando `CMD` del contenedor. Las migraciones deben ejecutarse como un paso único previo dentro de Cloud Build o mediante un Cloud Run Job dedicado antes de enrutar tráfico a la nueva revisión.

---

### 5. Verificación del Commit Local `8e21ba5` vs `origin/main`

Se verificó el estado de la rama de trabajo `feature/v4-gate0-audit`:

- **Commit Local:** `8e21ba56da0b39e2646c92a457faa70cbd97498e`
- **Commit Padre:** `e33f699a55b2709a6921b0c65fe301d2477ee9a8` (`origin/main`, `main`)
- **Diferencial de Archivos (`git diff origin/main..feature/v4-gate0-audit`):**
  - `docs/v4/gate0/00-estado-actual.md`
  - `docs/v4/gate0/01-auditoria-funcional.md`
  - `docs/v4/gate0/02-benchmark-tiendanube-shopify.md`
  - `docs/v4/gate0/03-arquitectura-propuesta.md`
  - `docs/v4/gate0/04-matriz-de-brechas.md`
  - `docs/v4/gate0/05-riesgos-y-regresiones.md`
  - `docs/v4/gate0/06-roadmap-v4.md`
  - `docs/v4/gate0/07-plan-de-pruebas.md`
  - `docs/v4/gate0/08-informe-ejecutivo.md`
- **Conclusión de Integridad:** **Cero modificaciones de código funcional, backend, frontend, migraciones o base de datos**. La rama contiene única y exclusivamente documentación autorizada.
