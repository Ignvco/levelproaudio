# Patch 05 — Respuestas seguras en pagos

Base: `c4572ed4d36605eb70fea0d0b92c2ef4284c78e9`
(`fix: serialize stock reservations and cancellations`).

## Problema corregido

`POST /api/v1/payments/create/` devolvía `detail: str(exception)` al
comprador cuando fallaba un proveedor o la creación del pago. Ese contenido
podía incluir respuestas internas del SDK, configuración o datos de diagnóstico.
La captura PayPal dejaba escapar excepciones hacia el manejador general de Django.
Además, cuerpos JSON que no eran objetos y algunos identificadores inválidos
podían causar errores 500 antes de contactar al proveedor.

## Comportamiento

- Las entradas se validan mediante serializers antes de buscar la orden o
  iniciar la captura. Se exige una orden UUID válida y uno de los seis
  proveedores ya admitidos; `cash` sigue reservado al administrador.
- Las referencias de captura PayPal son obligatorias, no pueden estar vacías
  y tienen un límite de 255 caracteres. Se conserva la normalización estándar
  de `CharField` de Django REST Framework.
- Las entradas inválidas devuelven HTTP 400 con un mensaje fijo, sin reflejar
  los valores enviados por el cliente.
- Las excepciones de consulta de la orden, creación del pago o captura
  devuelven HTTP 500 con `error` y un `error_id` aleatorio. La excepción y su
  traza quedan en los logs del servidor, asociadas a esa misma referencia.
- La captura advierte que se debe revisar el estado de la orden antes de
  volver a pagar: una excepción puede ocurrir después de que el cobro se
  haya confirmado. El manejador no modifica los estados ni repite la captura.
- Se conservan la autenticación, el control de propietario, los HTTP 404 para
  órdenes ajenas/inexistentes y los HTTP 400 para órdenes ya procesadas.
- Las respuestas de éxito conservan sus campos actuales, incluido
  `{"status": "approved"}` en la captura PayPal.

Ejemplo de error interno al crear un pago:

```json
{
  "error": "Error al procesar el pago. Intenta de nuevo.",
  "error_id": "<referencia aleatoria de 32 caracteres>"
}
```

Para diagnosticar, buscar el valor de `error_id` en los logs del backend.
La referencia se entrega en el JSON; este patch no agrega un componente
visual para mostrarla. Los logs mantienen el diagnóstico completo y requieren
acceso restringido; este cambio no incorpora redacción automática de secretos
en mensajes de terceros.

## Aplicación

Con los cambios anteriores comiteados y el archivo descargado en la raíz del repo:

```bash
git apply --check --index levelproaudio-security-05-payment-errors.patch &&
git apply --index levelproaudio-security-05-payment-errors.patch &&
git commit -m "security: protect payment error responses and validate requests" &&
git push
```

No requiere migraciones, cambios de secretos ni instalación de dependencias.
El paso existente `backend-tests` de Cloud Build incluye el nuevo archivo de
pruebas automáticamente. El bloqueo de despliegue por tests y las pruebas
PostgreSQL del patch 04 se conservan.

## Validación realizada

- Base sin cambios: **527 passed, 12 skipped, 49 warnings**.
- Resultado final: **590 passed, 12 skipped, 49 warnings**.
- **63 casos nuevos**: privacidad de errores con DEBUG activado/desactivado,
  correlación de referencias con logs, errores de almacenamiento, entradas
  inválidas/incompletas, límites de referencias, SDK PayPal fallando en consulta
  o captura, comprobación del propietario y conservación de pagos ya aprobados.
- Los fallos externos se simulan; no se realizaron cobros ni consultas a
  proveedores reales.
- `manage.py check`: sin problemas.
- `manage.py makemigrations --check --dry-run`: sin cambios.
- `git diff --check` y aplicación del patch sobre una copia limpia de la base.

Los 12 casos omitidos son los mismos de la base: seis de integración externa
y seis de concurrencia que requieren PostgreSQL. La validación local usó
SQLite. El check de Google Cloud Build del commit base figura exitoso; no se
ejecutó un nuevo despliegue de este patch desde esta revisión.

Comando para repetir la suite desde `backend/`, con las dependencias instaladas:

```bash
DJANGO_SECRET_KEY=ci-dummy-key DB_NAME=x DB_USER=x DB_PASSWORD=x \
  DJANGO_SETTINGS_MODULE=config.settings.test \
  python -m pytest tests/ apps/loyalty/ apps/billing/ apps/products/ \
  apps/analytics/ apps/orders/ apps/services/ apps/academy/ apps/rewards/ \
  apps/payments/ apps/users/ apps/seo/ apps/site_settings/ core/ -q
```

## Pendientes de la revisión

El frontend de retorno de pagos (`PaymentSuccess.jsx`) aún necesita distinguir
correctamente los estados pendiente/cancelado/error de consulta antes de mostrar
una confirmación. La revisión de JSON-LD, metadatos por página y rendimiento
también queda pendiente. Las otras respuestas de error del panel administrativo
requieren su propia revisión; el alcance de este patch son los dos endpoints
de creación y captura indicados arriba.
