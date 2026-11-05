#!/usr/bin/env bash
set -euo pipefail

bundle_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
base="58ee09609cd2b3bfbee5a4b0e97d907331d1f503"
expected_tree="bf31614edeccf87d0dcb05d6a0de2e9aef577c09"
mode="${1:-comprobar}"

fail() { printf '%s\n' "ERROR: $*" >&2; exit 1; }
case "$mode" in
  comprobar|comprobar-serie|aplicar) ;;
  *) printf '%s\n' 'Uso: bash APLICAR.sh comprobar | comprobar-serie | aplicar'; exit 2 ;;
esac

repo_dir="$(git rev-parse --show-toplevel 2>/dev/null)" || fail 'Ejecuta el script desde dentro del repositorio LevelPro Audio.'
cd "$repo_dir"
[ "$(git rev-parse HEAD)" = "$base" ] || fail 'La base no coincide con el patch 06 (58ee096). No fuerces la aplicación: revisa tu commit actual.'
git diff --quiet || fail 'Hay cambios locales sin commit. Guárdalos antes de aplicar el paquete.'
git diff --cached --quiet || fail 'Hay cambios preparados en el índice. Guárdalos antes de aplicar el paquete.'

(
  cd "$bundle_dir"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 -c SHA256SUMS >/dev/null
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum -c SHA256SUMS >/dev/null
  else
    fail 'Se necesita shasum (incluido en macOS) o sha256sum para verificar el paquete.'
  fi
) || fail 'Falló la verificación de integridad del paquete. Descárgalo y descomprímelo de nuevo.'

# One combined apply also detects untracked files that would be overwritten.
git apply --check --index "$bundle_dir/levelproaudio-07-11-completo.patch" || fail 'El patch no aplica limpiamente. No se modificó el repo.'

if [ "$mode" = 'comprobar-serie' ]; then
  index_dir="$(mktemp -d "${TMPDIR:-/tmp}/levelpro-series.XXXXXX")"
  trap 'rm -rf -- "$index_dir"' EXIT
  export GIT_INDEX_FILE="$index_dir/index"
  git read-tree HEAD
  for patch in \
    07-transfer-instructions.patch \
    08-admin-errors.patch \
    09-jsonld.patch \
    10-initial-page-seo.patch \
    11-performance.patch; do
    git apply --cached --check "$bundle_dir/patches/$patch"
    git apply --cached "$bundle_dir/patches/$patch"
  done
  [ "$(git write-tree)" = "$expected_tree" ] || fail 'La serie no coincide con el árbol de archivos validado.'
  printf '%s\n' 'OK: los cinco patches aplican en orden. No se modificó el índice real ni el árbol de trabajo.'
  exit 0
fi

if [ "$mode" = 'comprobar' ]; then
  printf '%s\n' 'OK: base, archivos y aplicación verificados. No se modificó el repo.'
  exit 0
fi

git apply --index "$bundle_dir/levelproaudio-07-11-completo.patch"
[ "$(git write-tree)" = "$expected_tree" ] || fail 'El índice resultante no coincide. Revisa git diff --cached antes de continuar.'
printf '%s\n' 'OK: patches 07–11 aplicados y preparados en el índice. No se hizo commit, push ni despliegue.'
git diff --cached --stat
