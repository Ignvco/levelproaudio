# Patch 04 — stock y concurrencia de pedidos

Base: `3ca37e6cdbb89e58fc786af4f2047f08e91e8d1f`.
Incluye el patch 03 y la corrección de su script, ya aplicados en esa base.

## Qué corrige

- Productos y componentes de kits se bloquean en orden estable dentro de
  la transacción de compra. Se valida la suma de todas las líneas: un
  producto suelto y dos kits que usan el mismo micrófono compiten por las
  mismas unidades.
- Líneas repetidas del mismo producto se agrupan antes de comprobar stock.
  Cantidades inválidas, kits vacíos o kits anidados devuelven 400 sin crear
  la orden. Los kits anidados no tenían una reserva válida de sus componentes;
  deben configurarse con productos simples.
- Los descuentos usan actualizaciones de base de datos y una comprobación
  de disponibilidad. Si falla la reserva, se revierte toda la compra,
  incluidos los puntos canjeados dentro de esa transacción.
- Cada nueva orden guarda `stock_deductions`: los IDs y cantidades que
  realmente descontó. Cancelarla repone ese desglose, aunque el kit se
  haya editado o eliminado después.
- Las preórdenes, productos a pedido, cursos, servicios y stickers comprados
  por sus endpoints específicos no generan stock ficticio al cancelarse.
- La cancelación de una orden pendiente repone inventario una sola vez,
  tanto desde el cliente como desde el panel administrativo. El guardado
  del estado y la reposición comparten una transacción.
- Los pagos y las cancelaciones comparten el bloqueo de la orden. Si
  llega un cobro aprobado para una orden cancelada, el pago queda en
  `in_review`, conserva la respuesta del proveedor y no reactiva la orden.
  Debe revisarse manualmente para coordinar un nuevo pedido o un reembolso;
  el patch no realiza reembolsos automáticos.
- Una orden cancelada no se puede reabrir, y una procesada no puede volver
  a pendiente. Esto evita reutilizar una reserva de inventario ya liberada.
  La confirmación repetida de un pago no devuelve una orden enviada a pagada.
- La edición de productos y componentes desde el panel se realiza en una
  transacción. Los avisos de cambios de estado del administrador se envían
  después del commit.

## Aplicación

Con los cambios anteriores comiteados, guardar el archivo en la raíz del repo:

```bash
git status --short
git apply --check --index levelproaudio-security-04-stock.patch &&
git apply --index levelproaudio-security-04-stock.patch
```

Revisar los cambios y luego:

```bash
git commit -m "fix: serialize stock reservations and order cancellations" &&
git push
```

El cambio incluye la migración aditiva `orders.0006_order_stock_deductions`.
El arranque actual de `backend/Dockerfile.prod` ejecuta `migrate --noinput`
antes de iniciar Gunicorn. No requiere agregar secretos ni modificar la
configuración de Mercado Pago.

## Pruebas y bloqueo del despliegue

La suite local completa terminó con **527 passed, 12 skipped**. Son 50
casos funcionales nuevos aprobados. De los 12 omitidos, 6 ya existían y
6 son pruebas nuevas de concurrencia que necesitan PostgreSQL real.

La ejecución local no pudo iniciar PostgreSQL por las restricciones de
usuarios/procesos del entorno de trabajo. Por tanto, **los seis casos de
concurrencia todavía no están verificados contra un servidor PostgreSQL**.
No se presenta el resultado SQLite como evidencia de bloqueos de fila.

Para verificarlos antes de desplegar, el paso existente `backend-tests` de
Cloud Build ahora instala PostgreSQL y ejecuta:

```bash
bash scripts/test-order-inventory-postgres.sh
```

Ese script crea una base temporal con socket local y sin escucha TCP,
ejecuta los 50 casos funcionales y los 6 concurrentes, detiene el servidor
y elimina sus datos al finalizar. No usa Cloud SQL ni credenciales de
producción. El resultado esperado de esta fase es **56 passed**.

Los casos concurrentes usan conexiones independientes y verifican en
`pg_stat_activity` que las dos operaciones estén esperando un bloqueo
antes de liberarlo. Cubren:

1. Dos compras de la última unidad.
2. Un kit y un producto suelto disputando la misma unidad.
3. Carritos que piden los mismos productos en orden inverso.
4. Dos cancelaciones del mismo pedido.
5. Confirmación de pago y cancelación simultáneas.
6. Cancelación desde el administrador y desde el cliente al mismo tiempo.

Si la instalación, el arranque de PostgreSQL o cualquiera de las pruebas
falla, `backend-tests` falla y los builds/despliegues no continúan.
Se conservan las dependencias que exigen ambos pushes antes de desplegar.
Esta instalación temporal añade tiempo al paso de pruebas.

El script también se puede ejecutar localmente con PostgreSQL instalado
y las dependencias de desarrollo del backend. Para elegir el Python del
entorno virtual:

```bash
PYTHON_BIN="$(pwd)/.venv/bin/python" bash scripts/test-order-inventory-postgres.sh
```

Se verificaron localmente la sintaxis Bash, cinco escenarios del script
con comandos simulados (éxito, fallo de tests, inicialización y arranque),
la configuración de Cloud Build y la consistencia de las migraciones.
Estos controles del script no sustituyen la ejecución PostgreSQL pendiente.

## Pedidos existentes y límites

Los pedidos anteriores a esta migración tienen `stock_deductions = null`.
No es posible reconstruir exactamente su reserva histórica si ya cambiaron
los productos o los componentes del kit. Su cancelación conserva un cálculo
de compatibilidad basado en la composición actual, con agregación y bloqueo.
Los pedidos antiguos con kits modificados requieren revisar el inventario
antes de cancelarlos. La migración no intenta corregir diferencias históricas.

La reposición automática aplica a pedidos pendientes. Cancelar o reembolsar
un pedido ya pagado, enviado o completado no demuestra que la mercancía
haya vuelto: la devolución física y el ajuste de existencias siguen siendo
una operación administrativa.

La reserva continúa realizándose al crear el pedido. Este patch no añade
caducidad automática de pedidos abandonados ni cambia la política comercial
de reservas. Las importaciones y ajustes manuales de cantidades siguen
representando instrucciones explícitas del operador.

La protección del estado se aplica a `Order.save()` y `Payment.save()`.
Las escrituras SQL directas o `QuerySet.update()` sobre sus estados omiten
esas reglas y no deben usarse para transiciones de pedidos o pagos.

Referencias técnicas:

- [Bloqueos de fila de Django 5.2](https://docs.djangoproject.com/en/5.2/ref/models/querysets/#select-for-update)
- [Bloqueos y orden de adquisición en PostgreSQL](https://www.postgresql.org/docs/16/explicit-locking.html)
