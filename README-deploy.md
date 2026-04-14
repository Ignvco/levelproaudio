# 🚀 Deploy LevelPro Audio — Google Cloud

## Arquitectura

```
GitHub (main) → Cloud Build → Artifact Registry
                                      ↓
                     ┌────────────────────────────────┐
                     │         Cloud Run               │
                     │  Frontend (Nginx + React build) │
                     │  Backend  (Gunicorn + Django)   │
                     └────────────────────────────────┘
                              ↓           ↓
                         Cloud SQL    Cloud Storage
                        (PostgreSQL)  (media/static)
```

## Archivos a copiar al repo

| Archivo de este zip | Destino en el repo |
|---|---|
| `Dockerfile.prod.backend` | `backend/Dockerfile.prod` |
| `Dockerfile.prod.frontend` | `frontend/Dockerfile.prod` |
| `nginx.conf` | `frontend/nginx.conf` |
| `production.py` | `backend/config/settings/production.py` |
| `cloudbuild.yaml` | `cloudbuild.yaml` (raíz del repo) |
| `setup-gcloud.sh` | `setup-gcloud.sh` (raíz, solo local) |

## Paso 1 — Instalar gcloud CLI

```bash
# Mac
brew install google-cloud-sdk

# O descargar desde:
# https://cloud.google.com/sdk/docs/install
```

## Paso 2 — Crear proyecto en GCloud

1. Ir a https://console.cloud.google.com
2. Crear nuevo proyecto: `levelproaudio`
3. Activar billing (necesario para Cloud Run, Cloud SQL, etc.)

## Paso 3 — Autenticarse

```bash
gcloud auth login
gcloud config set project levelproaudio
```

## Paso 4 — Editar setup-gcloud.sh

Abrir `setup-gcloud.sh` y cambiar las primeras líneas:

```bash
PROJECT_ID="levelproaudio"    # ← debe coincidir con tu project en GCloud
REGION="us-central1"          # ← southamerica-east1 para latencia menor en CL/AR
```

## Paso 5 — Ejecutar el setup

```bash
bash setup-gcloud.sh
```

Este script hace TODO automáticamente:
- ✅ Habilita las APIs necesarias
- ✅ Crea Cloud SQL PostgreSQL
- ✅ Crea bucket de Cloud Storage con acceso público
- ✅ Guarda todos los secrets en Secret Manager
- ✅ Configura Service Accounts con los permisos correctos
- ✅ Te guía para conectar GitHub con Cloud Build
- ✅ Ejecuta el primer build y deploy

## Paso 6 — Correr migraciones

```bash
bash migrate-prod.sh
```

## Paso 7 — Crear superusuario en producción

```bash
# Desde Cloud Shell en la consola web de GCloud:
gcloud run jobs execute levelproaudio-migrate \
  --update-env-vars="DJANGO_SUPERUSER_EMAIL=admin@levelproaudio.com,DJANGO_SUPERUSER_PASSWORD=TuPassword,DJANGO_SUPERUSER_USERNAME=admin" \
  --command="python" --args="manage.py,createsuperuser,--noinput"
```

## Paso 8 — Dominio personalizado (opcional)

```bash
# Mapear dominio al frontend
gcloud run domain-mappings create \
  --service=levelproaudio-frontend \
  --domain=levelproaudio.com \
  --region=us-central1

# Mapear subdominio api al backend
gcloud run domain-mappings create \
  --service=levelproaudio-backend \
  --domain=api.levelproaudio.com \
  --region=us-central1
```

Luego configurar los DNS records que te indique GCloud (CNAME o A records).

## Variables de entorno — resumen completo

Todas se guardan en **Secret Manager** y se inyectan automáticamente en Cloud Run:

| Secret | Descripción |
|---|---|
| `levelproaudio-secret-key` | Django SECRET_KEY |
| `levelproaudio-db-name` | Nombre de la DB |
| `levelproaudio-db-user` | Usuario de la DB |
| `levelproaudio-db-password` | Password de la DB |
| `levelproaudio-gcs-bucket` | Nombre del bucket GCS |
| `levelproaudio-gcs-project` | Project ID de GCloud |

## CI/CD automático

Una vez configurado, cada `git push` a `main`:
1. Cloud Build detecta el push
2. Build las imágenes de backend y frontend
3. Push a Container Registry
4. Deploy automático a Cloud Run
5. Sin downtime (rolling deploy)

## Costos estimados (nivel inicial)

| Servicio | Costo estimado/mes |
|---|---|
| Cloud Run (backend + frontend, tráfico bajo) | ~$0–5 USD |
| Cloud SQL db-f1-micro | ~$7–10 USD |
| Cloud Storage (media) | ~$0.5 USD |
| Cloud Build (250 min gratis/mes) | ~$0 USD |
| **Total estimado** | **~$10–15 USD/mes** |

> Cloud Run escala a 0 cuando no hay tráfico — solo pagas lo que usas.

## Solución de problemas frecuentes

### Error: "Permission denied" en Cloud Build
```bash
PROJECT_NUMBER=$(gcloud projects describe levelproaudio --format="value(projectNumber)")
gcloud projects add-iam-policy-binding levelproaudio \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"
```

### Error: "Cannot connect to Cloud SQL"
- Verificar que `CLOUD_SQL_CONNECTION_NAME` tenga el formato correcto: `project:region:instance`
- Verificar que el Service Account tenga el rol `cloudsql.client`

### Migraciones fallan
```bash
# Ver logs del job
gcloud run jobs executions logs list --job=levelproaudio-migrate --region=us-central1
```

### Imágenes no cargan después del deploy
```bash
# Subir media local al bucket
gsutil -m cp -r backend/media/* gs://levelproaudio-media/media/
```
