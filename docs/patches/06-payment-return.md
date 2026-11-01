# Patch 06 — Confirmación real del pago en el frontend

Base: `041241f700720964cb08cc30d3bb40df99036d1c`
(`security: protect payment error responses and validate requests`).
El check de Google Cloud Build de ese commit figura exitoso.

## Problemas corregidos

La pantalla de retorno mostraba “Compra exitosa”, confeti y mensajes de acceso
a cursos antes de consultar el pedido. También vaciaba el carrito al montarse,
ocultaba errores de captura y usaba una firma incorrecta para `refetchInterval`
de TanStack Query v5. La ruta de fallo afirmaba que no hubo cobro basándose
únicamente en la URL de retorno.

## Comportamiento final

- `/payment/success`, `/payment/pending` y `/payment/failure` consultan el estado
  de la orden. La ruta de fallo nunca ejecuta una captura PayPal.
- Hay vistas distintas para consulta inicial, captura, pendiente, revisión,
  cancelación, rechazo, reembolso, error de consulta y confirmación.
- Solo una lectura del backend con orden `paid`, `shipped` o `completed`
  muestra confirmación, confeti y siguientes pasos. Una orden cancelada tiene
  prioridad; un pago reembolsado sin otro aprobado tampoco se presenta como éxito.
- El JSON `approved` de una captura, los parámetros de URL y los datos cacheados
  antes de la primera consulta nueva no bastan para confirmar la compra.
- Las órdenes pendientes y en revisión se consultan cada tres segundos mientras
  la pestaña está activa. Los estados finales y errores de consulta detienen
  ese intervalo. “Actualizar estado” realiza una consulta GET.
- PayPal se captura después de poder consultar una orden pendiente. Los efectos
  repetidos reutilizan la misma promesa durante el montaje; no se reintenta
  automáticamente una captura fallida. Al recibir su resultado se eliminan
  `paymentId`, `PayerID` y `token` de la entrada actual del historial.
- Un fallo de captura muestra un mensaje prudente y, cuando existe, el `error_id`
  seguro del patch 05. Nunca se muestra el texto interno de la excepción.
- El checkout guarda una referencia temporal del carrito que originó el pedido
  antes de salir a Mercado Pago o PayPal. El retorno solo lo vacía cuando el
  pedido está confirmado y siguen coincidiendo sus productos, cantidades y
  puntos seleccionados. No vacía carritos nuevos al visitar órdenes antiguas
  ni al comprar cursos desde sus páginas individuales.
- Los importes muestran la moneda de la orden y conservan los centavos de USD.

## Aplicación

Con el patch 05 comiteado y el archivo descargado en la raíz del repo:

```bash
git apply --check --index levelproaudio-security-06-payment-return.patch &&
git apply --index levelproaudio-security-06-payment-return.patch &&
git commit -m "fix: confirm payment return from server order status" &&
git push
```

No requiere migraciones ni cambios de secretos. El backend no cambia.
Se conservan Node y npm fijados en el Dockerfile y `npm ci`.
Se agrega Playwright 1.62.1 como dependencia de desarrollo; ninguna dependencia
existente cambia de versión. El navegador de QA no forma parte del runtime nginx.

## Validación

- Instalación limpia: `npm ci --include=dev --no-audit --no-fund`.
- **37 pruebas de lógica aprobadas**, sin omisiones.
- **26 pruebas de navegador aprobadas contra Vite de desarrollo**, con StrictMode.
- **29 pruebas de navegador aprobadas contra el frontend compilado**, incluidos
  los estados principales, errores 403/404/500, captura fallida, refresco sin
  repetir captura, orden pagada tras un error, parámetros incompletos y cambio
  de orden en la URL.
- Presentación revisada a 360, 390 y 1280 px; sin desbordamiento horizontal y
  con importes USD. El ajuste final del total se volvió a compilar y verificó
  en esos tres anchos.
- Compilación Vite de producción correcta con las variables de branding.
- ESLint de los archivos modificados: pasa con `argsIgnorePattern: "^[A-Z_]"`
  para los argumentos JSX `Icon`; la configuración original ya producía dos
  falsos positivos sobre esos mismos argumentos en la base.
- `git diff --check` y aplicación del patch en una copia limpia de la base.

Entorno local: Node 24.22.1, npm 11.9.0, Chromium 153, Playwright 1.62.1.
Todas las respuestas de APIs en las pruebas de navegador son sintéticas y
las conexiones externas están bloqueadas. No se hicieron cobros ni se desplegó
el patch. La compilación Docker completa y otros navegadores no se ejecutaron
localmente. Vite mantiene el aviso de tamaño del bundle principal; rendimiento
queda en la siguiente revisión.

## Repetir las pruebas

Desde `frontend/`:

```bash
npm ci --include=dev --no-audit --no-fund
npm run test:payment
npx playwright install chromium
npm run test:payment:browser
npm run build
PAYMENT_TEST_MODE=preview npm run test:payment:browser
```

La prueba de navegador inicia y cierra un servidor local automáticamente.
`PAYMENT_TEST_CHROMIUM=/ruta/al/chromium` permite usar un navegador ya instalado.
Si se usa `PAYMENT_TEST_URL`, solo acepta `localhost` o `127.0.0.1`.
Para replicar producción, definir las variables `VITE_*` de `cloudbuild.yaml`
antes de compilar.

El Dockerfile ejecuta `npm run test:payment` antes de `npm run build`; un fallo
bloquea la imagen y los despliegues dependientes. Las pruebas de navegador son
QA local y no se ejecutan dentro de Alpine. Los controles existentes del backend
y las pruebas PostgreSQL del patch 04 se conservan.

## Alcance y pendientes

La protección de captura descrita pertenece a esta pantalla. No reemplaza la
idempotencia del proveedor ni garantiza exclusión entre distintas pestañas o
dispositivos. La autoridad sobre pagos, propietario e inventario sigue en el
backend. Si el navegador bloquea sessionStorage o el checkout empezó antes de
este patch, el carrito se conserva al volver.

Durante esta revisión se detectó otro pendiente en `TransferInstructions.jsx`:
lee `order` antes de declararlo cuando falta la moneda de navegación y depende
de datos bancarios recibidos por el estado del router. La recuperación de esa
pantalla al recargar necesita un patch específico. También quedan JSON-LD,
metadatos por página, respuestas internas del panel y rendimiento.

Referencias: [TanStack Query](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery)
y [efectos de React](https://react.dev/reference/react/useEffect).
