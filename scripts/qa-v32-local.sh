#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose -f "$ROOT/docker-compose.qa-v32.yml")
PRIVATE_DIR="${QA_PRIVATE_DIR:-$HOME/.levelpro-v32-qa}"
command -v docker >/dev/null || { echo 'Falta Docker Desktop con docker compose en PATH.' >&2; exit 2; }
case "${1:-}" in
  doctor)
    docker info >/dev/null
    "${COMPOSE[@]}" config --quiet
    echo 'Docker y Compose OK. QA apunta solamente a recursos locales declarados.'
    ;;
  up)
    "${COMPOSE[@]}" up --build -d
    echo 'QA local iniciado. Frontend: http://127.0.0.1:3000'
    echo 'Para datos sintéticos: bash scripts/qa-v32-local.sh seed'
    ;;
  seed)
    umask 077
    mkdir -p "$PRIVATE_DIR"
    test -e "$PRIVATE_DIR/local-seed-credentials.txt" && { echo 'El archivo de credenciales ya existe. Moverlo antes de rotar usuarios QA.' >&2; exit 1; }
    tmp="$PRIVATE_DIR/.seed-$$.tmp"
    trap 'rm -f "$tmp"' EXIT
    "${COMPOSE[@]}" exec -T backend python manage.py qa_seed_v32 > "$tmp"
    chmod 600 "$tmp"
    mv "$tmp" "$PRIVATE_DIR/local-seed-credentials.txt"
    trap - EXIT
    echo "Datos sintéticos listos. Credenciales privadas: $PRIVATE_DIR/local-seed-credentials.txt"
    echo 'NO subas ese archivo a GitHub ni lo compartas por chat.'
    ;;
  capture-admin|capture-customer)
    command -v node >/dev/null || { echo 'Falta Node 24 del proyecto.' >&2; exit 2; }
    role="${1#capture-}"
    (cd "$ROOT/frontend" && QA_BASE_URL=http://127.0.0.1:3000 node scripts/qa-v32-capture-session.mjs "--role=$role")
    ;;
  visual)
    command -v node >/dev/null || { echo 'Falta Node 24 del proyecto.' >&2; exit 2; }
    if test -f "$PRIVATE_DIR/local-seed-credentials.txt"; then
      while IFS='=' read -r key value; do
        case "$key" in
          QA_PRODUCT_SLUG|QA_COURSE_SLUG|QA_SERVICE_SLUG|QA_CAMPAIGN_ID|QA_ORDER_ID) export "$key=$value" ;;
        esac
      done < "$PRIVATE_DIR/local-seed-credentials.txt"
    fi
    (cd "$ROOT/frontend" && QA_BASE_URL=http://127.0.0.1:3000 node scripts/qa-v32-visual.mjs)
    ;;
  operational)
    command -v node >/dev/null || { echo 'Falta Node 24 del proyecto.' >&2; exit 2; }
    (cd "$ROOT/frontend" && QA_BASE_URL=http://127.0.0.1:3000 node scripts/qa-v32-operational-readonly.mjs)
    ;;
  summary)
    command -v node >/dev/null || { echo 'Falta Node 24 del proyecto.' >&2; exit 2; }
    (cd "$ROOT/frontend" && node scripts/qa-v32-summary.mjs)
    ;;
  test-backend)
    "${COMPOSE[@]}" exec -T -e DJANGO_SETTINGS_MODULE=config.settings.test \
       backend python -m pytest tests/ apps/loyalty/ apps/billing/ apps/products/ \
       apps/analytics/ apps/orders/ apps/services/ apps/academy/ apps/rewards/ \
       apps/payments/ apps/users/ apps/seo/ apps/site_settings/ core/ -q
    ;;
  status) "${COMPOSE[@]}" ps ;;
  logs) "${COMPOSE[@]}" logs --tail=100 backend frontend ;;
  down) "${COMPOSE[@]}" down ;;
  reset)
    echo 'Esto ELIMINARÁ la base y los archivos sintéticos del laboratorio local.'
    read -r -p 'Escribe RESET-QA para confirmar: ' confirm
    test "$confirm" = 'RESET-QA' || exit 1
    "${COMPOSE[@]}" down -v
    echo 'Volúmenes Docker locales eliminados; credenciales locales no se borran.'
    ;;
  *) echo 'Uso: bash scripts/qa-v32-local.sh doctor|up|seed|capture-admin|capture-customer|visual|operational|summary|test-backend|status|logs|down|reset'; exit 2 ;;
esac
