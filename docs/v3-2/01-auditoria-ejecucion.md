# LEVELPRO AUDIO V3.2 — Auditoría integral / registro de ejecución

Base auditada: `ef614c9357675d7fb6a18658eb2e8694e072a38f` (V3.1 validada).
Rama de trabajo: `feat/v3-2-refinamiento-integral`.

## Inventario del frontend

Se inspeccionaron los 27 módulos/páginas de `frontend/src/pages/admin`,
las 9 subpáginas de `frontend/src/pages/dashboard`, las 18 páginas de nivel
superior, los layouts y 14 primitivas compartidas `components/admin/ui`.
Se leyeron fuentes de API, backend de analytics, órdenes, pagos y facturación.

La inspección ha sido **del código** y de las capturas de producción aportadas
por el propietario para Admin Home/Cliente Home. No se dispone de un navegador
autenticado con todas las rutas ni de capturas responsive de cada página.
Por ello NO se certifica una auditoría visual 1:1 de cada módulo.

### Conclusiones UX/UI

- El lenguaje Bento V3 está concentrado en los dos Home; numerosas vistas
  interiores mantienen sistema `admin-ui.css` y JSX con estilos inline.
- AdminDashboard, AdminFinance, AdminProducts y Dashboard concentran muchos
  estilos inline: una migración masiva e indiscriminada rompería el diseño.
- Las tarjetas KPI accionables estaban implementadas como `div onClick`,
  sin soporte de teclado; tablas usaban `th onClick`, y varios diálogos
  carecían de nombre accesible y gestión de foco.
- En el Home del usuario, las tarjetas verdes se expandían a la altura del
  hero negro, dejando amplias zonas vacías. Se reajusta la composición para
  dos filas Bento con un protagonista vertical.
- Se normalizan foco visible, contraste de títulos oscuros, reduced motion
  y controles de módulos dentro del shell, sin tocar el storefront público.

## Finanzas y multimoneda: diagnóstico

**P0 — resuelto en consultas comerciales de esta entrega:**
- `dashboard_overview`: sumaba `Order.total` de todas las monedas.
- `analytics_full`: KPI, series y ticket promedio agregaban órdenes
  CLP/USD/ARS; ingresos por proveedor tampoco separaban monedas.
- `admin_payments`: sumaba `Payment.amount` de todas las monedas.
- `executive_dashboard`: KPIs diarios/mensuales y series mezclaban importes.
- `admin_finance_by_product`: mezclaba ventas; además restaba costo de
  catálogo CLP contra ventas USD/ARS.
- UI de pedidos del cliente, gestión de órdenes Admin y registro tributario
  presentaban importes extranjeros como `$` CLP.
- `getAnalytics` utilizado en Finanzas no identificaba moneda.

**Corrección implementada:**
- Endpoints con `?currency=CLP|USD|ARS`, valor por defecto explícito CLP,
  rechazo HTTP 400 de monedas no soportadas.
- Totales de las 3 divisas reportados separadamente, sin conversiones.
- Moneda en listado de documentos tributarios y selección de monedas en UI.
- Costos, margen y utilidad de productos USD/ARS devueltos `null` hasta
  disponer de costos comparables, sin tasa de cambio improvisada.
- La lista de compras y sus KPIs no suman monedas distintas ni pedidos no
  pagados.

**P0 — detectado, NO resuelto aún: libro mayor histórico.**
- `IncomeRecord`, `IncomeDistribution` y `Withdrawal` guardan montos
  sin moneda explícita; `admin_finance_summary`, retiros, distribuciones
  y balance histórico pueden ser matemáticamente ambiguos.
- La API identifica ingresos extranjeros y movimientos sin clasificación;
  el panel avisa que los saldos históricos no están certificados.
- Debe diseñarse una migración de esquema con columna moneda, vinculación
  verificable a órdenes/pagos, tratamiento de retiros históricos sin origen,
  reconciliación de costos y auditoría de registros previos.
- No se marcó un retiro como CLP por defecto, no se inventó un tipo de
  cambio y NO se cambió el flujo monetario de retiros sin conciliación.
- El catálogo almacena `cost_price` en moneda local; su coste histórico
  no debe asumirse como coste definitivo de órdenes de exportación.
- Rewards e integración fiscal requieren revisión de integridad monetaria
  antes de certificar todo el negocio.

## Patch 14 — estado

**No existe implementación ni patch aprobado del 14**. Su alcance
previamente planteado: idempotencia de intentos de pago, recuperación
de pedidos pendientes, conciliación de pasarelas y protección de stock.
No se abrió ni modificó lógica relativa al Patch 14 en V3.2.
Se conserva absolutamente pausado.

## Validación

- Tests Django añadidos para CLP/USD/ARS en Dashboard, Analytics, Pagos,
  Executive, reporte de producto, moneda inválida y riesgo financiero.
- Tests JS añadidos para separación de totales, importe original y
  moneda ausente.
- Debe ejecutarse `python manage.py check`, `python -m pytest`,
  `npm run lint`, `npm run test:unit`, `npm run build` en CI.
- Debe revisarse visualmente en escritorio/tablet/móvil cada área antes
  de fusionar, además de compras y pagos sandbox.
- **No son pruebas ya ejecutadas**: las nuevas comprobaciones de Cloud Build
  y QA autenticada requieren integrar el patch en el entorno del propietario.

## Prioridad del siguiente lote dentro de V3.2

1. Conciliación histórica y migración monetaria de tesorería, sin
   reinterpretar retiros antiguos por defecto.
2. Revisar recompensas, documentos fiscales y series monetarias restantes.
3. Comprobar exhaustivamente estados de error/carga y responsive en todas
   las páginas interiores, con capturas reales y pruebas E2E.
4. QA funcional de roles, pagos y todos los módulos tras cambios comunes.
5. Solo después, informe final de V3.2 y consideración del Patch 14.
