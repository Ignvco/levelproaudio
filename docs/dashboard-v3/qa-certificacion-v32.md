# LEVELPRO AUDIO · V3.2 — CERTIFICACIÓN FINAL

Fecha de preparación: 2026-11-07. Base auditada: `main` SHA `9f36745a694f69d2be86da71182d569e9c4f6805`.

**Estado real al crear este paquete:** QA Cloud Build SUCCESS confirmado por el propietario. **Auditoría visual completa, pruebas reales de pasarelas y conciliación de producción: todavía SIN EJECUTAR.** Este paquete aporta instrumentos para producir evidencia; no inventa pruebas aprobadas. **Patch 14 totalmente pausado.**

## 1. Protocolo de ejecución

Esta fase **no cambia código de negocio ni publica en producción**. Ejecutar con cuentas QA cliente/admin, proyecto staging o sandbox de pasarelas y base de datos en modo lectura. No aplicar pruebas mutacionales a producción real.

**Preparación en Mac:**

```bash
cd levelproaudio-purge/frontend
npm ci
npx playwright install chromium
```

Para ejecutar contra un entorno real, la URL debe ser la de **staging**. Si no existe staging, usa el frontend local enlazado a un backend de pruebas, evitando credenciales de producción para pruebas con mutaciones.

### 1A. Capturar sesiones de PRUEBA (se hace manualmente en el navegador)

```bash
export QA_BASE_URL='https://TU-ENTORNO-DE-STAGING'
node scripts/qa-v32-capture-session.mjs --role=admin
node scripts/qa-v32-capture-session.mjs --role=customer
```

El flujo abre Chromium visible para iniciar sesión **manualmente**. Guarda cookies + sessionStorage en `~/.levelpro-v32-qa/{admin,customer}-session.json`, fuera del repo y con permisos de archivo 0600. **No compartir sesiones** ni subir a GitHub, Cloud Build ni ChatGPT.

### 1B. Auditoría visual de rutas

```bash
QA_WIDTHS='1440,1280,1024,768,430,390,320' \
  node scripts/qa-v32-visual.mjs
```

Captura todas las rutas estáticas en Chromium real, clasifica errores JS, respuestas >=500, imágenes rotas, desbordamiento horizontal, redirecciones de autenticación y ausencia de contenido. **Interrumpe cualquier intento HTTP POST/PATCH/PUT/DELETE** durante la captura, así que los formularios o acciones que lo necesiten deben probarse en staging por separado.

Rutas dinámicas: define variables QA_PRODUCT_SLUG, QA_COURSE_SLUG, QA_SERVICE_SLUG, QA_CAMPAIGN_ID, QA_ORDER_ID de registros **sintéticos de staging**. Si no se proporcionan, quedan explícitamente `SKIP`, no `PASS`.

**IMPORTANTE:** `/payment/success` y `/payment/pending` se omiten en el capturador de rutas por seguridad. Se prueban con pruebas sintéticas existentes y sandbox autorizado.

Resultados privados: `~/.levelpro-v32-qa/visual-evidence/index.html` y `report.json` más capturas. **Revisar manualmente** cada captura: contraste, proporción, identidad LevelPro, foco visible, overflow en tablas, overlays, navegación, logos, feedback y retícula móvil.

### 1C. Smoke autenticado READ ONLY

```bash
node scripts/qa-v32-operational-readonly.mjs
```

Consulta con HTTP GET endpoints de admin/cliente/públicos y verifica segregación CLP/USD/ARS, contratos de respuesta y denegación de permisos a clientes/no autenticados. No guarda bodies ni datos personales. `GET=200` **no garantiza** operaciones financieras, por lo que tiene que complementarse con pruebas de integración de la suite y sandbox real.

Resultados: `~/.levelpro-v32-qa/operational-evidence/report.json`.

### 1D. Suite de navegador ya existente

```bash
npm run test:browser
npm run lint
npm run test:unit
npm run build
```

Las suites Playwright existentes usan fixtures sintéticos y bloquean escrituras externas; son regresiones excelentes pero **no constituyen una transacción real con pasarela**. Ejecutarlas también con un entorno de preview cuando esté configurado.

### 1E. Conciliación histórica read-only del ERP comercial LevelPro

La herramienta **no mueve, convierte ni reclasifica dinero**. Requiere acceso autorizado a la DB del backend (idealmente usuario PostgreSQL SELECT-only). Desde `backend/` con entorno Django configurado:

```bash
python manage.py audit_currency_history \
  --samples 100 \
  --output "$HOME/.levelpro-v32-qa/currency-history.json"
```

Salida contiene IDs, referencias, montos y fechas **confidenciales**. Conservar localmente, no subir a GitHub ni imprimir en CI. Para un resumen sin IDs basta:

```bash
python manage.py audit_currency_history
```

En PostgreSQL la transacción utiliza `SET TRANSACTION READ ONLY`. El comando no contiene ninguna operación ORM de escritura. Comprueba: ingresos/retiros con moneda vacía/NULL/no reconocida, distribuciones de ingresos no CLP, diferencias entre moneda/importe de ingreso y orden (revisión documental, no error definitivo), puntos históricamente asignados o canjeados en USD/ARS, pagos aprobados sobre órdenes canceladas y monedas faltantes en órdenes/pagos. **Nunca suma monedas distintas.**

### 1F. Conciliación documental de cada excepción

Para cada ID de `currency-history.json`, revisar en contexto autorizado:

| Evidencia | Comprobación |
|---|---|
| Orden | Moneda de venta original, total, descuentos y fecha de pago |
| Pasarela | Moneda liquidada, monto realmente capturado, ID externo y comisión |
| Ingreso histórico | Comparar `IncomeRecord.amount` con venta, no asumir que USD=CLP |
| Retiros históricos | Documento bancario/contable de origen para saber divisa real |
| Distribuciones | Recalcular únicamente si costos y moneda son comparables |
| Fidelización | Revisar puntos otorgados antiguamente a compras no CLP sin corregirlos a ciegas |

**Ninguna fila NULL se convierte por suposiciones, por igualdad numérica ni por moneda de visualización de un dashboard.** Si no existe evidencia, queda `SIN CONCILIAR` y se mantiene la restricción de operaciones de la app.

## 2. Matriz de aceptación operativa — staging y sandbox

| ID | Escenario | Aceptación objetiva | Resultado |
|---|---|---|---|
| OP-01 | Login admin / cliente, logout y expiración | Roles aislados; sesión revalidada contra cookie HTTPOnly | PENDIENTE |
| OP-02 | Catálogo, carrito y orden CLP | Precio de servidor correcto; stock descontado solo una vez | PENDIENTE |
| OP-03 | Carrito y orden USD/ARS | Moneda explícita y ningún canje/acreditación automática de puntos CLP | PENDIENTE |
| OP-04 | PayPal: orden CLP, cobro USD | Orden/comercio permanecen CLP; liquidación se mantiene USD; sin sumar importes | PENDIENTE |
| OP-05 | MercadoPago Chile y Argentina | Aprobación sandbox validada con ID de proveedor; no deducir pago desde redirect | PENDIENTE |
| OP-06 | Transferencia/Global66/Payoneer | Instrucciones acordes a moneda; estado no pasa a pagado sin evidencia | PENDIENTE |
| OP-07 | Pago pendiente, rechazo, retorno tardío | No felicitar ni vaciar otro carrito; inventario coherente | PENDIENTE |
| OP-08 | Doble callback, retry, webhooks duplicados | Máximo un ingreso/recompensa y transiciones coherentes; registrar riesgo si no pasa | PENDIENTE |
| OP-09 | Rewards | Solo pago confirmado crea entradas; CSV filtrado y sorteo en fixture de staging | PENDIENTE |
| OP-10 | Fidelización | Ajustes validados; límites; ninguna recompensa monetaria CLP en USD/ARS | PENDIENTE |
| OP-11 | Inventario y cancelaciones | Restauración sin duplicación; reversión de puntos; permisos | PENDIENTE |
| OP-12 | Academia | Cursos, inscripciones, progreso, certificados y videos por rol | PENDIENTE |
| OP-13 | Servicios | Solicitudes, reservas, cambio de estados y actualización de caché | PENDIENTE |
| OP-14 | Facturación | Documentos tributarios reales solo cuando hay hecho contable válido; sin datos de prueba en producción | PENDIENTE |
| OP-15 | Responsividad y accesibilidad | Sin overflow crítico 320/390/768/1024/1440, navegación teclado y contraste | PENDIENTE |
| OP-16 | Permisos/seguridad | Cliente/anónimo jamás ve APIs admin; denegaciones 401/403 | PENDIENTE |
| OP-17 | Recuperación | Backup restaurable, rollback despliegue, registros de auditoría y monitoreo | PENDIENTE |

**Regla de seguridad:** pruebas OP-02 a OP-14 que escriben datos se ejecutan solamente en staging/sandbox, nunca en el sitio comercial con pasarelas en modo real. No hacer sorteo público real ni cobrar tarjetas reales para certificar QA.

**Patch 14 permanece pausado:** el objetivo de esta fase es probar la robustez actual, no reimplementar su arquitectura. Un hallazgo grave de concurrencia/pago no se certifica sin corrección o aceptación formal y medidas compensatorias.

## 3. Rubrica visual de revisión humana

- **Marca:** Geist, jerarquía editorial, Bento, verde LevelPro, contrastes, componentes y botones coherentes.
- **Layouts:** adaptativos, sin cortes de tarjetas, overlays, scroll horizontal accidental ni modales fuera de viewport.
- **Estados:** loading vs empty vs error, reintento funcional, disabled, feedback de guardado, validación visible.
- **Interacción:** tab/shift-tab, focus, Escape, navegación breadcrumb, drawer, filtros, hover y touch.
- **Datos:** formatos CLP/USD/ARS correctos, fecha local, sin `$NaN`, sin cero inventado, sin totales mixtos.
- **Evidencia:** PNG por ruta y resolución, issue ID, severidad, pasos de reproducción, commit y navegador. No almacenar contraseñas, tokens ni datos personales en capturas compartidas.

## 4. Puertas de aprobación (sin promesas)

**GO** solamente cuando: pruebas Cloud Build QA success sobre commit final, todas las rutas no omitidas revisadas visualmente, pruebas operativas sandbox aprobadas, no hay hallazgos P0/P1 sin mitigar, históricos conciliados o formalmente segregados, backup/restauración y rollback documentados, y aceptación responsable firmada.

**NO-GO** si: pagos o movimientos duplicados, importes mezclados, permisos fallan, el dashboard presenta históricos ambiguos como fondos disponibles, o faltan pruebas de pasarelas que se anuncien como certificadas.

**Estado actual:** HERRAMIENTAS PREPARADAS / NO SE HAN EJECUTADO CONTRA UNA SESIÓN REAL NI BASE DE DATOS. No publicar certificados falsos.
