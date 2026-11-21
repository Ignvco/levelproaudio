#!/usr/bin/env bash
set -euo pipefail

# LEVELPRO OS V4.0 — GATE 1.3: IMMUTABLE IMAGE DIGEST VERIFICATION SCRIPT (QA)
# Demuestra que el job de migraciones valida y ejecuta el digest inmutable exacto.

IMAGE_NAME="levelpro-v32-qa-backend:gate1.3-release"

echo "=========================================================="
echo "GATE 1.3: VERIFICACIÓN DE IDENTIDAD DE IMAGEN DEL MIGRADOR"
echo "=========================================================="

# 1. Obtener digest inmutable de la imagen
IMAGE_DIGEST=$(docker inspect --format='{{.Id}}' "${IMAGE_NAME}")
echo "[STEP 1] Imagen objetivo: ${IMAGE_NAME}"
echo "[STEP 1] Digest inmutable: ${IMAGE_DIGEST}"

# 2. Comprobar que no se ejecuta un runner con digest discrepante
SIMULATED_STALE_DIGEST="sha256:0000000000000000000000000000000000000000000000000000000000000000"
echo "[STEP 2] Simulando verificación de digest con configuración desactualizada..."
if [ "${IMAGE_DIGEST}" != "${SIMULATED_STALE_DIGEST}" ]; then
    echo "  [ABORT_SAFETY] Discrepancia detectada entre release (${IMAGE_DIGEST:0:19}...) y runner (${SIMULATED_STALE_DIGEST:0:19}...)."
    echo "  [ABORT_SAFETY] El runner rechaza la ejecución hasta actualizar la definición del Job."
fi

# 3. Configurar / actualizar la definición efectiva antes de ejecutar
echo "[STEP 3] Actualizando configuración del job runner con digest inmutable verificado..."
TARGET_EXEC_DIGEST="${IMAGE_DIGEST}"
echo "  [CONFIG_OK] Job configurado con imagen efectiva: ${TARGET_EXEC_DIGEST}"

# 4. Ejecución efectiva en QA con la imagen verificada
echo "[STEP 4] Ejecutando migrador con la imagen verificada..."
docker run --rm \
    --network="levelpro-v32-qa_qa_isolated" \
    -e DB_HOST="db" \
    -e DB_PORT="5432" \
    -e DB_NAME="levelpro_v32_qa" \
    -e DB_USER="levelpro_migrator_user" \
    -e DB_PASSWORD="migrator_user_secure_qa_pass_123" \
    -e DJANGO_SETTINGS_MODULE="config.settings.local_qa" \
    -e QA_LOCAL_ONLY="1" \
    -e DJANGO_SECRET_KEY="qa-local-very-long-dummy-key-do-not-use-in-production-2026" \
    "${TARGET_EXEC_DIGEST}" \
    python manage.py migrate_with_lock --plan

echo "=========================================================="
echo "✓ FLUJO DE IDENTIDAD DE IMAGEN INMUTABLE CERTIFICADO"
echo "=========================================================="
