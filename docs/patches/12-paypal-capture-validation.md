# Patch 12 — Validación de monto y moneda al ejecutar PayPal

Base: `872756ad28eb187361244f5a96a3f61d1424d852`, con los patches 01–11
integrados y Cloud Build exitoso.

## Problema y resultado

Una ejecución PayPal que devolvía éxito podía aprobar el pedido aunque faltara
el monto, fuera `NaN` o la moneda no coincidiera con el pago local. Además,
el SDK combina la respuesta de `execute()` con el objeto de `find()`: si omitía
las transacciones, podía conservar el monto anterior a la ejecución.

Ahora se exige una única transacción con monto numérico, finito y mayor que
cero, y moneda idéntica a `Payment.currency` (USD en el flujo actual). El monto
se compara con `Payment.amount`, que ya está expresado en la moneda de PayPal;
no se vuelve a convertir el total CLP de la orden.

La comparación usa `Decimal` y conserva la tolerancia preexistente del **1%,
con mínimo de 0,01**. No introduce una política de igualdad exacta de centavos.
Se vacían las transacciones del objeto local del SDK antes de ejecutar para
exigir datos frescos; el POST a PayPal sigue enviando solo `payer_id`.

Una respuesta incompleta, ambigua, no finita, con monto no positivo, moneda
incorrecta o diferencia fuera de tolerancia deja el pago en `in_review`, sin
`paid_at`, y conserva la respuesta disponible para revisión. La orden pendiente
no pasa a pagada, no genera el ingreso de un pago aprobado ni envía el correo
de confirmación. Repetir después esa solicitud no vuelve a ejecutar el pago
porque ya no está pendiente. El endpoint conserva sus respuestas actuales.

## Aplicación

Descargar `levelproaudio-security-12-paypal-validation.patch` en la raíz del
repo. Partir de la base indicada y sin otros cambios preparados o sin preparar:

```bash
test "$(git rev-parse HEAD)" = "872756ad28eb187361244f5a96a3f61d1424d852" &&
git diff --quiet &&
git diff --cached --quiet &&
git apply --check --index levelproaudio-security-12-paypal-validation.patch &&
git apply --index levelproaudio-security-12-paypal-validation.patch &&
git commit -m "fix: validate PayPal capture amount and currency" &&
git push
```

Cada `&&` detiene la secuencia si falla un paso. Si cambió la base, revisar los
cambios antes de adaptar el patch; no usar `--reject` ni forzar conflictos.
No usar `git add .`: `--index` ya prepara los seis archivos del patch.

No requiere migraciones, cambios de secretos, dependencias ni frontend.
Después del push, comprobar el nuevo Cloud Build. Un pago que quede en revisión
requiere contrastar la operación en PayPal antes de confirmarlo manualmente;
el estado no significa que el proveedor no haya cobrado.

## Validación

- Tres regresiones reprodujeron el fallo antes del cambio: monto ausente,
  moneda incorrecta y `NaN` aprobaban el pedido.
- **38 casos nuevos** usan el recurso real de `paypalrestsdk` con el transporte
  HTTP simulado. Cubren importes inválidos, moneda, estructura, datos anteriores
  a la captura, tolerancia decimal, pagos válidos, USD sin reconversión, fallos
  de ejecución y repetición de solicitudes cuando el pago está en revisión.
- Suite dirigida: **156 passed**. Conserva los casos de permisos, errores
  seguros, fallo de correo después del cobro y cancelación durante la captura.
- Suite backend completa usada por Cloud Build: **694 passed, 12 skipped**.
  Los 12 omitidos corresponden a los existentes; seis requieren PostgreSQL.
  El control PostgreSQL de Cloud Build permanece configurado.
- `makemigrations --check --dry-run`: sin cambios.
- Sintaxis de los cinco archivos Python compatible con Python 3.11.
- `git diff --check` y aplicación en una copia limpia de la base verificados.

Entorno local: Python 3.12.14, SQLite en memoria. No se realizaron cobros,
solicitudes PayPal reales, despliegues ni pruebas Docker/PostgreSQL locales.
El frontend no cambia y no se repitió su build en esta entrega.

## Alcance

Se valida el monto y la moneda de próximas ejecuciones. No se modifican pagos
históricos, la API/SDK de PayPal, la tolerancia comercial ni las reglas de
cancelación. No añade reconciliación, reembolsos automáticos ni exclusión de
capturas simultáneas entre pestañas/dispositivos.

Referencias: [PayPal execute](https://developer.paypal.com/api/deprecated/payments/v1/payment-execute)
y [Decimal.is_finite](https://docs.python.org/3.11/library/decimal.html#decimal.Decimal.is_finite).
