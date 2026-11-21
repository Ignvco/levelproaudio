#!/usr/bin/env bash
set -euo pipefail

# LEVELPRO OS V4.0 — GATE 1.3: SETUP CLOUD RUN MIGRATOR JOB
# Script de aprovisionamiento del Cloud Run Job desacoplado para migraciones

PROJECT_ID="${PROJECT_ID:-levelproaudio}"
REGION="${REGION:-us-central1}"
JOB_NAME="levelproaudio-migrator-job"
SA_NAME="levelproaudio-migrator"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SQL_INSTANCE="levelproaudio:us-central1:levelproaudio-db"
IMAGE="us-central1-docker.pkg.dev/${PROJECT_ID}/levelproaudio-docker/backend:latest"

echo "=========================================================="
echo "Configurando Cloud Run Job: ${JOB_NAME}"
echo "Proyecto: ${PROJECT_ID} | Región: ${REGION}"
echo "=========================================================="

# 1. Crear Service Account si no existe
if ! gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    echo "Creando Service Account dedicada para migraciones: ${SA_EMAIL}..."
    gcloud iam service-accounts create "${SA_NAME}" \
        --project="${PROJECT_ID}" \
        --display-name="LevelPro OS V4.0 Database Migrator" \
        --description="Cuenta de servicio con privilegios acotados para ejecución de migraciones DDL"
else
    echo "Service Account ${SA_EMAIL} ya existe."
fi

# 2. Otorgar permisos mínimos requeridos a la Service Account
echo "Asignando roles IAM mínimos requeridos..."
# Conexión a Cloud SQL
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/cloudsql.client" \
    --condition=None >/dev/null

# Acceso a Secret Manager (Secret Accessor)
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --condition=None >/dev/null

# 3. Crear o actualizar el Cloud Run Job
echo "Desplegando / actualizando Cloud Run Job ${JOB_NAME}..."
gcloud run jobs deploy "${JOB_NAME}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --image="${IMAGE}" \
    --command="/app/docker/migrator_entrypoint.sh" \
    --service-account="${SA_EMAIL}" \
    --set-cloudsql-instances="${SQL_INSTANCE}" \
    --set-env-vars=DJANGO_SETTINGS_MODULE=config.settings.production \
    --set-env-vars=CLOUD_SQL_CONNECTION_NAME="${SQL_INSTANCE}" \
    --update-secrets=DB_USER=DB_MIGRATOR_USER:latest \
    --update-secrets=DB_PASSWORD=DB_MIGRATOR_PASSWORD:latest \
    --update-secrets=DB_NAME=DB_NAME:latest \
    --update-secrets=DJANGO_SECRET_KEY=DJANGO_SECRET_KEY:latest \
    --memory=512Mi \
    --cpu=1 \
    --max-retries=1 \
    --task-timeout=300s

echo "✓ Cloud Run Job ${JOB_NAME} aprovisionado exitosamente."
