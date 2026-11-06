# LevelPro Audio — V3.2 · Auditoría integral y correcciones de estabilización

Base: `ef614c9357675d7fb6a18658eb2e8694e072a38f`. Rama de trabajo:
`feat/v3-2-integral-stabilization`. Este trabajo **NO implementa el Patch 14**.

## 1. Alcance examinado

Inspección estática de los 62 archivos de páginas React y sus rutas relacionadas,
componentes de administración compartidos, layouts, hojas de estilo y módulos
Django de órdenes, pagos, analítica, facturación e inventario. Evaluación de
contratos API, caché React Query v5, importes y pantallas.

**Límite de esta auditoría:** no ha habido sesión de navegador autenticado,
capturas automatizadas de todos los módulos, ejecución de la suite Django en
esta rama ni comprobación real de pasarelas. No afirmar certificación visual
o de producción sin esas pruebas.

## 2. Diagnóstico UX/UI

- Dashboard V3.1 conserva lenguaje Editorial Bento aprobado; los encabezados
  sobre tarjetas negras carecían de contraste y los tres tiles de usuario
  empleaban demasiado alto sin contenido.
- Los módulos interiores usan un catálogo amplio de componentes admin,
  pero todavía combinan tokens CSS, estilos inline y controles locales.
- `DataTable` tenía encabezados ordenables solo con clic, filas sin
  navegación por teclado, menú sin cierre Escape y ordenación incorrecta
  de cadenas monetarias/decimales.
- `StatCard` disparaba clic sobre un `div` no semántico.
- Algunos botones/enlaces compartidos ignoraban deshabilitado/carga.
- Páginas seguían invocando `invalidateQueries(["..."])` con firma
  anterior a React Query v5; la actualización visual podía mostrar datos
  obsoletos tras algunas mutaciones.
- La hoja V3.2 aplica contraste reforzado, foco visible, reduced motion,
  tamaños responsive, densidad Bento más equilibrada y CSS transversal
  sin cambiar rutas ni derechos de acceso.

## 3. Diagnóstico contable y solución técnica

**Tres dominios monetarios distintos:**

1. **Comercio:** `Order.total` expresado en `Order.currency`.
2. **Cobro real:** `Payment.amount` expresado en `Payment.currency`.
   Ejemplo: orden CLP puede liquidarse por PayPal USD.
3. **Tesorería interna:** `IncomeRecord`, `IncomeDistribution` y
   `Withdrawal` con moneda propia e historial potencialmente ambiguo.

En V3.1 existían `Sum(total)` sobre pedidos CLP/USD/ARS y
`Sum(amount)` sobre pagos de múltiples pasarelas.

Correcciones V3.2:
- `GET /api/v1/admin/dashboard/?currency=...`,
  `analytics/`, `executive/`, `payments/`,
  `finance/summary/`, `finance/withdrawals/`,
  `finance/by-product/` separan CLP/USD/ARS. Sin FX implícito.
  Cuando no se informa la moneda, CLP es el valor de compatibilidad,
  **no una suma mezclada**.
- Retienen las formas históricas de respuesta cuando es posible;
  añaden `currency` y totales de cada divisa.
- Las categorías de analítica utilizan cantidad × precio unitario
  dentro de la divisa original y no suman distintos currencies.
- Nuevos `IncomeRecord` guardan el importe original del pedido,
  aunque `Payment` tenga USD por PayPal.
- `IncomeRecord.create_distributions()` no calcula costos ni
  utilidades de ventas USD/ARS con `product.cost_price` expresado CLP:
  guarda el ingreso comercial, pero no simula un margen convertido.
- Migración `analytics.0004_currency_integrity`: clasifica ingresos
  históricos solo con evidencia suficiente; importes históricos
  ambiguos permanecen `currency=NULL`. Los retiros históricos quedan
  sin clasificar hasta conciliación expresa.
- Categorías que contienen ingresos o retiros históricos sin moneda
  muestran `reconciliation_required` y balance `null`. API de retiro
  devuelve 409 y bloquea operaciones sobre esa categoría hasta
  resolver el histórico. No se pierde ni se reetiqueta dinero.
- Se preserva en auditoría de eliminación el currency del retiro.
- Monedas identificadas se muestran claramente en pedidos, clientes,
  notificaciones, pagos, documentación tributaria y finanzas.
- El selector CLP/USD/ARS del admin consulta cada reporte por divisa;
  cambiar moneda no crea una conversión.

## 4. Limitaciones contables pendientes de certificación

- El costo de producto se mantiene expresado CLP. Rentabilidad en
  USD/ARS no puede certificarse sin ledger de costo en la misma moneda
  o tasa FX explícita por operación, no añadida aquí.
- Los movimientos de tesorería históricos con `NULL` no se deben
  imputar automáticamente a CLP. Requieren una conciliación documental.
- El dashboard comercial filtra ventas por fecha de creación de pedido,
  no por fecha efectiva del cobro. Por tanto, reporta **ventas de
  pedidos pagados por fecha de pedido**, no flujo de caja bancario.
- En caso de mezcla histórica de pagos y órdenes, la auditoría debe
  verificar `Order.currency`, `Payment.currency` y evidencias
  externas de conciliación antes de re-etiquetar registros.
- La financiación y la contabilidad no quedan «100% certificadas»
  hasta pruebas reales y revisión de históricos.

## 5. Patch 14 — revisión de alcance, expresamente pausado

**No existe implementación del Patch 14 en este cambio.**
La propuesta original cubría idempotencia de pagos, reintentos,
recuperación de órdenes, conciliación, callbacks tardíos, stock y
trazabilidad. Riesgos y puntos de integración:
- `backend/apps/payments/services.py` crea intents por pasarela;
  requiere validar reintentos y referencia única antes de modificarlo.
- `backend/apps/payments/views.py`, webhooks y retorno al checkout
  necesitan revisión de transiciones/confirmaciones duplicadas.
- `backend/apps/orders/models.py` y servicios de inventario
  gobiernan cancelaciones, stock y cambios de estado.
- `IncomeRecord` por signals tiene protección de existencia, pero
  eso no sustituye una política de idempotencia transaccional global.
- Diseñar pruebas de pagos tardíos, doble evento y reservas, **sin
  introducir todavía cambios de lógica**.

La Fase V3.2 no debe usarse para declarar implementado Patch 14.

## 6. Validación obligatoria antes de integrar

Backend (lo ejecuta Cloud Build; no es obligatorio instalar Python en Mac):

```bash
python manage.py makemigrations --check --dry-run
python -m pytest apps/analytics/tests_currency_isolation.py -q
python -m pytest -q
```

Frontend con Node/npm del proyecto:

```bash
npm ci
npm run lint
npm run test:unit
npm run build
```

QA manual al menos:
- Admin y cliente con cero pedidos y con pedidos CLP/USD/ARS.
- Orden CLP liquidada por PayPal USD: el ingreso comercial sigue CLP,
  liquidación de pasarela se ve USD.
- Reportes mensuales, 7D, 30D, 1A sin suma entre monedas.
- Finanzas con histórico NULL: alerta visible y retiro bloqueado.
- Efectos sobre módulos de pedidos, facturación, inventario y Rewards.
- Módulos con cambios de estado: la caché se actualiza correctamente.
- React Query v5, pantallas vacías, errores de API, foco y navegación.
- 1440, 1024, 768, 430 y 390 px. Revisar visual de todas las rutas
  antes de dar por finalizada la fase.
- Validar triggers/despliegue y migración solo con backup y plan rollback.

Estado: **implementación en rama**, pruebas de cloud y QA autenticada
**pendientes**; jamás mezclar con aprobación de producción.
