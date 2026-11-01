# Patch 07 — Instrucciones de transferencia recuperables

Base: patch 06 integrado en `58ee09609cd2b3bfbee5a4b0e97d907331d1f503`.

## Cambio

La página consulta `GET /api/v1/payments/transfer/<order_id>/` con autenticación
y propiedad de la orden. Ya no depende del estado del router, no referencia
`order` antes de declararlo y no inventa un alias cuando faltan datos.
La consulta no crea pagos. Usa el último intento, el monto y la moneda reales,
y no ofrece transferir si la orden está procesada, existe un pago aprobado o
en revisión, o el último intento no corresponde a una transferencia pendiente.
Oculta instrucciones ante errores; permite consultar de nuevo sin hacer un pago.

Las cuentas se filtran por método y moneda exactos, también en el catálogo de
métodos del checkout. Se elimina el fallback a cuentas de otras monedas.
Global66 requiere un alias configurado y CLP, la moneda soportada por su flujo
actual. No se agregan promesas de tiempo SWIFT ni de procesamiento no verificadas.

## Migración y configuración

Incluye `payments.0006_bankaccount_payment_method`, una columna con valor inicial
`transfer`. No elimina cuentas ni cambia sus números o monedas. El arranque del
backend de producción ya ejecuta `migrate --noinput`.

**Si usás Payoneer**, después del despliegue entrá al panel → Métodos de pago →
Cuentas bancarias → Editar y elegí **Payoneer** en «Método de esta cuenta» para
sus cuentas USD. No se adivina el método a partir del nombre del banco. Hasta
asignarlas explícitamente, esos pedidos muestran instrucciones no disponibles.
Las cuentas comunes conservan «Transferencia bancaria». Global66 conserva sus
variables actuales. No hay que crear ni rotar secretos.

## Validación

Pruebas backend en `apps/payments/tests_transfer_instructions.py`: propiedad,
lecturas sin escrituras, estados finales/revisión, selección de método y moneda,
Global66 sin alias, intentos online posteriores, errores seguros y CRUD de cuentas.
Pruebas navegador en `frontend/tests/transfer-instructions.browser.mjs`: acceso
directo, recarga, decimales USD, estados de bloqueo, error y actualización.
Todos los datos son sintéticos y las llamadas de pago reales están bloqueadas.

## Límites

Las instrucciones usan la configuración activa actual, no una fotografía
histórica de cuentas. Desactivar/cambiar una cuenta afecta a órdenes pendientes;
la atención manual debe verificar comprobantes enviados a cuentas anteriores.
Una lectura no impide que el estado cambie después; se vuelve a consultar al
recuperar foco y cada 15 segundos mientras se puede transferir o está en revisión.
