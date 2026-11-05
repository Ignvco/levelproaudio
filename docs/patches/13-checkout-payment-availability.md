# Patch 13 — Disponibilidad real de medios de pago en checkout

Base: `d80a610c2a624c59228977ea98cc28cdcd6b2de4` (`main`, patches 01–12).
Rama: `fix/fase13-checkout-payment-availability`.

## Problemas corregidos

1. `POST /api/v1/payments/create/` podía registrar pagos por transferencia/Payoneer sin cuenta activa o con proveedor deshabilitado.
2. El endpoint de métodos podía ofrecer proveedores en monedas que su servicio no procesa, especialmente PayPal en ARS y Mercado Pago fuera de su moneda.
3. Un `dlocal` activo se mostraba pese a carecer todavía de implementación de creación de pago.
4. Checkout conservaba el medio de pago anterior cuando cambiaba la moneda.
5. Global66 tenía flujo de pago, pero faltaba en las opciones administrables de `PaymentMethodConfig`.

## Comportamiento esperado

- El listado público y el POST aplican las mismas condiciones.
- Transferencia y Payoneer necesitan una cuenta activa del método y de la moneda exacta.
- Payoneer solo USD; MercadoPago Chile solo CLP; MercadoPago Argentina solo ARS.
- PayPal solo CLP (conversión a USD) o USD; no ARS.
- Global66 solo CLP y con alias configurado; nueva opción administrativa inicialmente INACTIVA.
- dLocal queda oculto hasta implementar su integración real.
- Un método rechazado devuelve HTTP 400 sin crear `Payment` ni llamar a la pasarela.
- El frontend muestra estados de consulta/error/sin métodos y no procesa una selección inválida o desactualizada.

## Migración

Aplicar `python manage.py migrate` en el backend: `payments.0007_global66_payment_method`.
La migración agrega Global66 al selector del administrador y lo registra inactivo, sin sobrescribir configuraciones existentes.
No habilitar proveedores por defecto.

## QA requerida antes de incorporar a main

Desde el directorio `backend` y con el entorno de pruebas configurado:

```bash
python manage.py makemigrations --check --dry-run
python -m pytest apps/payments/tests_checkout_availability.py apps/payments/tests_method_config.py tests/test_payments_create.py tests/test_payment_api_errors.py -q
python -m pytest -q
```

Desde `frontend`:

```bash
npm ci
npm run build
```

Probar manualmente CLP, ARS y USD: carga de métodos, cuenta activa/inactiva, cambio de moneda, selección antigua, transferencia, PayPal y retorno sin pago.
Validar un pedido real con credenciales de sandbox antes de cualquier despliegue.
No activar Global66 sin verificar cuenta bancaria, alias y conciliación.
No desplegar en producción sin validación completa.

## Fuera de alcance

- Verificación en vivo de credenciales MP/PayPal, disponibilidad bancaria y trazabilidad de pagos.
- Idempotencia de intentos repetidos y expiración/conciliación de órdenes pendientes.
- Implementación de dLocal o cuenta Mercado Pago Argentina.
- Validación de correos, fulfillment e inventario extremo a extremo.
