#!/usr/bin/env bash
# ==============================================================================
# LEVELPRO OS V4.0 — PR #46: RELEASE PIPELINE HARDENING TEST SUITE
# ==============================================================================
# Ejecuta la verificación integral del pipeline en cloudbuild.yaml y la suite
# completa de seguridad del lock de coordinación distribuido sobre GCS HTTP API
# v1 (`scripts/test_release_lock_safety.py` con el binario real `gcloud storage`
# y `git` real en clones shallow).
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

echo "=============================================================================="
echo " LEVELPRO OS V4.0 — PR #46: RELEASE PIPELINE HARDENING VERIFICATION"
echo "=============================================================================="
echo "Directorio de trabajo: ${ROOT_DIR}"
echo ""

echo "[STAGE 1/2] Validación estricta de digests inmutables (sin fallback a tags mutables)..."
python3 - <<'PY'
import sys
sys.path.insert(0, "scripts")
from release_coordinator import validate_immutable_digest, DigestValidationError

invalid_cases = [
    "",
    "us-central1-docker.pkg.dev/levelproaudio/levelproaudio-docker/backend:latest",
    "us-central1-docker.pkg.dev/levelproaudio/levelproaudio-docker/backend:90676f6",
    "us-central1-docker.pkg.dev/levelproaudio/levelproaudio-docker/backend@sha256:1234abcd",
    "us-central1-docker.pkg.dev/levelproaudio/levelproaudio-docker/backend@sha256:" + ("z" * 64),
]
for cand in invalid_cases:
    try:
        validate_immutable_digest(cand, "backend")
    except DigestValidationError:
        continue
    raise AssertionError(f"Digest inválido fue aceptado: {cand!r}")

valid = "us-central1-docker.pkg.dev/levelproaudio/levelproaudio-docker/backend@sha256:" + ("a1b2c3d4" * 8)
assert validate_immutable_digest(valid, "backend") == valid
print("  ✓ Rechazo estricto de digests vacíos, truncados, no-hex o tags mutables verificado.")
PY

echo ""
echo "[STAGE 2/2] Ejecutando suite integral de bloqueo atómico, heartbeat, fail-closed y Cloud Build..."
python3 "${SCRIPT_DIR}/test_release_lock_safety.py"

echo ""
echo "=============================================================================="
echo " RESUMEN FINAL: PIPELINE & RELEASE LOCK HARDENING 100% VERIFICADO"
echo "=============================================================================="
exit 0
