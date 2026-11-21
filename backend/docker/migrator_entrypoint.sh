#!/bin/sh
set -e

# LEVELPRO OS V4.0 — GATE 1.3: DECOUPLED MIGRATION RUNNER ENTRYPOINT
# Diseñado para ejecutarse como Cloud Run Job o contenedor efímero aislado.
# Ejecuta migraciones con PostgreSQL Advisory Locks y sale con código 0 o non-zero.

echo "[MIGRATOR_JOB] Iniciando trabajo de migración desacoplado..."
python manage.py migrate_with_lock --noinput --lock-timeout 120

echo "[MIGRATOR_JOB] ✓ Migraciones finalizadas exitosamente con código de salida 0."
