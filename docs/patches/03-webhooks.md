# Patch 03 — firmas de webhooks de Mercado Pago

Base: `b0bc355d4ad751458fd361876eda1c23dd73b7ad`.

## Antes del push

Este patch exige `MP_CL_WEBHOOK_SECRET` en Secret Manager. Hay que preparar
el secreto y los permisos antes de pushear: Cloud Build lo inyecta al
backend y Cloud Run valida su acceso durante el despliegue.

1. En la cuenta chilena de Mercado Pago, abrir **Tus integraciones** y la
   aplicación que corresponde al `MP_CL_ACCESS_TOKEN` de producción.
2. En **Webhooks**, configurar el evento **Pagos**, en modo producción,
   con esta URL:

   `https://levelproaudio.com/api/v1/payments/webhook/mercadopago/cl/`

3. Obtener la **firma secreta de Webhooks** de esa aplicación. Es una
   credencial independiente del access token. Las notificaciones IPN no
   permiten esta validación; hay que usar la configuración de Webhooks.
4. Aplicar el patch localmente con los cambios anteriores comiteados:

   ```bash
   git apply --check --index levelproaudio-security-03-webhooks.patch &&
   git apply --index levelproaudio-security-03-webhooks.patch
   ```

5. Desde la raíz del repo, con `gcloud` instalado y autenticado en una cuenta
   que pueda listar secretos del proyecto (`secretmanager.secrets.list`),
   gestionar el secreto y sus permisos:

   ```bash
   bash scripts/configure-mp-webhook-secret.sh cl
   ```

   El script comprueba primero si el secreto existe. Si falla la consulta
   por autenticación, permisos o conexión, muestra el error y se detiene.
   Luego pide el valor con entrada oculta, crea el secreto solo si la
   consulta terminó correctamente sin encontrarlo,
   concede `roles/secretmanager.secretAccessor` a
   `levelproaudio-app@levelproaudio.iam.gserviceaccount.com` sobre ese secreto
   y agrega una versión. No guarda el valor en archivos ni en argumentos
   de `gcloud`. Puede ejecutarse también desde Google Cloud Shell, en una
   copia del repo con el patch aplicado.

   Si el proyecto o la cuenta de runtime fueron personalizados, indicar
   `MP_PROJECT_ID` y `MP_RUNTIME_SA` al ejecutar el script. Los valores por
   defecto coinciden con `cloudbuild.yaml`.

6. Cuando el script termine correctamente:

   ```bash
   git commit -m "security: require and bind Mercado Pago webhook signatures" &&
   git push
   ```

Si el secreto ya existe y contiene la firma correcta, basta con comprobar
que la cuenta de runtime tiene acceso. Ejecutar el script nuevamente crea
una versión adicional; no rota la firma en el panel de Mercado Pago.

La cuenta argentina usa `MP_AR_WEBHOOK_SECRET` y su propio endpoint `/ar/`.
Solo al habilitar esa cuenta, ejecutar el script con `ar`, configurar sus
credenciales y activar la referencia AR comentada en `cloudbuild.yaml`.
Sin su secreto, ese endpoint responde 503 y no procesa notificaciones.

### Si apareció `Secret ... already exists`

La primera versión del script interpretaba cualquier fallo de `describe`
como ausencia del secreto y ocultaba el error original. Una sesión que
requería reautenticación podía terminar intentando crear un secreto existente.
Ese error detuvo el script antes de configurar el acceso y agregar la versión;
no borró el secreto ni sus versiones previas.

Aplicar la corrección del script y ejecutarlo nuevamente. No eliminar el
secreto existente. Si vuelve a fallar la autenticación, ejecutar
`gcloud auth login` y reintentar. Los errores de permisos o conexión se
muestran para corregir su causa; no se convierten en intentos de creación.

## Comportamiento

| Situación | Respuesta / efecto |
|---|---|
| Secreto ausente o vacío | 503; no consulta la API ni modifica pagos |
| Firma o request-id ausente, mal formado o incorrecto | 401; sin efectos |
| ID ausente, cambiado o ambiguo en la URL | 401; sin efectos |
| JSON inválido, ID del cuerpo distinto o tipos de evento contradictorios | 400; sin efectos |
| Firma válida para `payment` | Consulta el ID firmado en la API de la cuenta correspondiente |
| Otro tipo de recurso con firma válida | 200; no se interpreta como un pago |
| Excepción al procesar un pago | 503; detalle de error solo en logs del backend |

El verificador utiliza HMAC-SHA256 y comparación en tiempo constante. Admite
`?data.id=...` y el alias `?id=...` cuando tienen firma válida; rechaza
parámetros repetidos o contradictorios. El ID superior del JSON puede ser
el de la notificación y no se usa para buscar el pago.

Los endpoints se autentican por la firma del proveedor. Cookies JWT,
Bearer y CSRF del navegador no sustituyen ni interfieren con esa firma.
La aprobación y el monto siguen obteniéndose de la API de Mercado Pago.
`merchant_order` utiliza otro recurso de API y deja de consultarse como si
su ID fuera un ID de pago: configurar el evento Pagos es necesario.

El timestamp se valida y forma parte de la firma. Este patch no impone una
ventana corta de expiración ni añade deduplicación de reintentos; no debe
interpretarse como una implementación completa de protección contra replay.

## Validación después del despliegue

Una llamada sin firma debe responder **401**, sin consultar pagos:

```bash
curl -i -X POST \
  https://levelproaudio.com/api/v1/payments/webhook/mercadopago/cl/ \
  -H 'Content-Type: application/json' --data '{}'
```

En el panel de Webhooks, usar **Simular notificación** para comprobar la
recepción y revisar el código de respuesta. Para validar el ciclo de pago,
utilizar cuentas y credenciales del entorno de prueba correspondiente.

Si aparece 503 con `webhook unavailable`, revisar la referencia al secreto
en la nueva revisión del backend. Un 401 con notificaciones del proveedor
requiere comprobar aplicación, cuenta, firma y que la configuración sea
Webhooks. Un 200 por sí solo confirma recepción, no aprobación de una orden.

## Pruebas locales

La suite usada por Cloud Build se ejecuta desde `backend/`:

```bash
DJANGO_SECRET_KEY=ci-dummy-key DB_NAME=x DB_USER=x DB_PASSWORD=x \
DJANGO_SETTINGS_MODULE=config.settings.test \
python -m pytest tests/ apps/loyalty/ apps/billing/ apps/products/ \
  apps/analytics/ apps/orders/ apps/services/ apps/academy/ apps/rewards/ \
  apps/payments/ apps/users/ apps/seo/ apps/site_settings/ core/ -q
```

La validación incluye 121 casos nuevos con solicitudes HTTP y HMAC reales
para CL y AR. Solo se simulan la API externa y el envío de correo; se
verifican las órdenes y pagos de una base de pruebas. El script de secretos
se comprueba con un `gcloud` simulado, sin modificar recursos de Google Cloud.

Resultado del patch original: **457 passed, 6 skipped**. La corrección del
script agrega **20 pruebas de regresión aprobadas**, ejecutadas de forma
aislada con `gcloud` simulado: existencia, reautenticación, errores de
consulta, creación concurrente, permisos, carga del valor y validación de
entrada. No se repitió la suite completa para este ajuste del script.

La configuración real de Mercado Pago, Secret Manager y el despliegue
quedan a cargo de los pasos anteriores; las pruebas locales no hacen
cobros ni acceden a esas cuentas.

Referencias oficiales:

- [Notificaciones de Checkout Pro](https://www.mercadopago.com.mx/developers/es/docs/checkout-pro-preferences/payment-notifications)
- [Limitaciones de IPN](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/ipn)
- [Secretos en Cloud Run](https://docs.cloud.google.com/run/docs/configuring/services/secrets)
- [Agregar una versión de un secreto](https://docs.cloud.google.com/secret-manager/docs/add-secret-version)
- [Scripts con gcloud: códigos de salida y mensajes de error](https://docs.cloud.google.com/sdk/docs/scripting-gcloud)
