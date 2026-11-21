#!/bin/sh
set -e

# LEVELPRO OS V4.0 — GATE 1.3: WEB CONTAINER RUNTIME ENTRYPOINT
# No ejecuta migraciones durante el startup del contenedor web.
# Garantiza arranque ultrarrápido (<3s cold start) y previene contención DDL.

echo "[WEB_STARTUP] Iniciando runtime web de LevelPro OS v4.0..."
PORT="${PORT:-8080}"
WORKERS="${WEB_CONCURRENCY:-2}"
THREADS="${GUNICORN_THREADS:-4}"
TIMEOUT="${GUNICORN_TIMEOUT:-120}"

echo "[WEB_STARTUP] Enlazando servidor Gunicorn en 0.0.0.0:${PORT} (workers=${WORKERS}, threads=${THREADS})..."
exec gunicorn config.wsgi:application \
    --bind "0.0.0.0:${PORT}" \
    --workers "${WORKERS}" \
    --threads "${THREADS}" \
    --timeout "${TIMEOUT}" \
    --access-logfile - \
    --error-logfile -
