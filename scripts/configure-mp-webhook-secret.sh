#!/usr/bin/env bash
# Ejecutar localmente antes del push del patch 03. Nunca pegar el secreto en Git.
set +x
set -euo pipefail

case "${1:-cl}" in
  cl) mp_secret_name=MP_CL_WEBHOOK_SECRET ;;
  ar) mp_secret_name=MP_AR_WEBHOOK_SECRET ;;
  *) printf 'Uso: bash scripts/configure-mp-webhook-secret.sh [cl|ar]\n' >&2; exit 2 ;;
esac

mp_project_id=${MP_PROJECT_ID:-levelproaudio}
mp_runtime_sa=${MP_RUNTIME_SA:-levelproaudio-app@${mp_project_id}.iam.gserviceaccount.com}

if ! command -v gcloud >/dev/null 2>&1; then
  printf 'Necesitas gcloud autenticado; también puedes usar Google Cloud Shell.\n' >&2
  exit 1
fi

printf 'Proyecto: %s\nSecreto: %s\nAcceso de runtime: %s\n' "$mp_project_id" "$mp_secret_name" "$mp_runtime_sa"

# Solo una consulta exitosa sin resultados permite concluir que falta el secreto.
# Mantener stderr visible para reautenticación y errores de permisos/conectividad.
if ! mp_existing_secret=$(gcloud secrets list --project="$mp_project_id" \
  --filter="name~'(^|/)${mp_secret_name}$'" --format='value(name)'); then
  printf 'No se pudo consultar Secret Manager. Revisa la autenticación y los permisos; no se intentó crear el secreto.\n' >&2
  exit 1
fi

unset mp_webhook_secret
trap 'unset mp_webhook_secret' EXIT
printf 'Pega la firma secreta de Webhooks de Mercado Pago (entrada oculta): ' >&2
IFS= read -r -s mp_webhook_secret
printf '\n' >&2
if [[ -z "$mp_webhook_secret" || "$mp_webhook_secret" == *[[:space:]]* ]]; then
  printf 'El secreto no puede estar vacío ni contener espacios o saltos de línea.\n' >&2
  exit 1
fi

if [[ -z "$mp_existing_secret" ]]; then
  if ! gcloud secrets create "$mp_secret_name" --project="$mp_project_id" --replication-policy=automatic; then
    # Otra ejecución pudo crearlo entre la consulta y el intento de creación.
    # Continuar únicamente si ahora se puede verificar el recurso exacto.
    if ! gcloud secrets describe "$mp_secret_name" --project="$mp_project_id" >/dev/null; then
      printf 'No se pudo crear ni verificar el secreto. No se agregó ninguna versión.\n' >&2
      exit 1
    fi
    printf 'El secreto ya está disponible; se reutilizará.\n'
  fi
else
  printf 'El secreto ya existe; se reutilizará.\n'
fi

gcloud secrets add-iam-policy-binding "$mp_secret_name" --project="$mp_project_id" \
  --member="serviceAccount:$mp_runtime_sa" --role=roles/secretmanager.secretAccessor >/dev/null

# printf es builtin: el valor no se pasa en argumentos de gcloud ni va a un archivo.
printf '%s' "$mp_webhook_secret" | gcloud secrets versions add "$mp_secret_name" \
  --project="$mp_project_id" --data-file=- --quiet >/dev/null
unset mp_webhook_secret
printf 'Secreto guardado y acceso configurado. Ahora puedes hacer commit y push.\n'
