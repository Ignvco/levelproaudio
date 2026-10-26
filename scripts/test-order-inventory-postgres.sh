#!/usr/bin/env bash
# PostgreSQL temporal, sin TCP ni Cloud SQL. Requiere PostgreSQL + deps de tests.
set -euo pipefail

repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
python_bin=${PYTHON_BIN:-python}
pg_bin=$(pg_config --bindir)
if [[ ! -x "$pg_bin/initdb" || ! -x "$pg_bin/pg_ctl" ]]; then
  printf 'Se necesita el servidor PostgreSQL (initdb y pg_ctl).\n' >&2
  exit 1
fi

pg_tmp=$(mktemp -d /tmp/levelpro-inventory.XXXXXXXX)
pg_run() {
  if [[ $(id -u) == 0 ]]; then
    runuser -u postgres -- "$@"
  else
    "$@"
  fi
}
cleanup() {
  # También intentar detener un arranque que haya superado el timeout de pg_ctl.
  pg_run "$pg_bin/pg_ctl" -D "$pg_tmp/data" -m immediate -w stop >/dev/null 2>&1 || true
  rm -rf -- "$pg_tmp"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [[ $(id -u) == 0 ]]; then
  chown postgres "$pg_tmp"
fi
pg_run "$pg_bin/initdb" -D "$pg_tmp/data" -U inventory_test \
  --auth-local=trust --auth-host=reject --no-locale --encoding=UTF8 >/dev/null
pg_run "$pg_bin/pg_ctl" -D "$pg_tmp/data" -l "$pg_tmp/postgres.log" \
  -o "-k $pg_tmp -c listen_addresses='' -c fsync=off" -w start >/dev/null

cd "$repo_dir/backend"
DJANGO_SECRET_KEY=inventory-test-key-not-used-in-production \
DB_NAME=x DB_USER=x DB_PASSWORD=x \
TEST_POSTGRES_HOST="$pg_tmp" TEST_POSTGRES_PORT=5432 \
TEST_POSTGRES_USER=inventory_test TEST_POSTGRES_PASSWORD='' TEST_POSTGRES_DB=postgres \
DJANGO_SETTINGS_MODULE=config.settings.test_postgres \
  "$python_bin" -m pytest tests/test_order_inventory.py \
  tests/test_order_inventory_concurrency.py -q
