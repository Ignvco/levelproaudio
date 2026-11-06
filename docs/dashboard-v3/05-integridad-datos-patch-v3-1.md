# V3.1 — Auditoría y reparación de integridad de datos (Patch)

Base: `b5050dd1c0ea181734e2de9972c8837ba6026540` (`main` con V3 Editorial Bento).
Rama: `fix/dashboard-v3-real-data-integrity`.
**No es Patch 14.** No cambia backend, pasarelas, modelos, migraciones ni estilos Bento.

## Qué corrige

- Se eliminan datos demostrativos incorporados por el rediseño V3 en Admin
  (ventas, órdenes, clientes, ticket promedio, metas, tendencias, ratios).
- Se elimina una lista de órdenes atribuida a usuarios ficticios. Si no hay
  órdenes, se muestra el estado vacío, no ejemplos.
- El donut de ingresos refleja el porcentaje real del mes sobre el total
  histórico entregado por la API; su progreso y ticks ya no son fijos.
- El indicador de despachos usa los conteos de órdenes `shipped` y
  `completed` reportados por `GET /admin/analytics/`. Sin estadísticas
  de estado se muestra «Sin desglose», nunca un 96% inventado.
- El gráfico de ventas usa `sales_chart` (7 y 30 días) y `sales_by_month`
  (1 año); botones de periodo, etiquetas y tooltip corresponden a datos.
  Se conserva el Bento y se usa Recharts, dependencia existente.
- El mix por categoría usa unidades realmente vendidas (`count` de la API),
  no porcentajes fijos ni sumas de distintas divisas.
- En el cliente, puntos y nivel se obtienen exclusivamente de
  `/loyalty/me/`; no hay 2450 puntos ni multiplicador ficticio.
- Los pedidos y su seguimiento se obtienen del historial del cliente, sin
  IDs, fechas, importes ni fechas de despacho simuladas.
- La Academia usa la inscripción/progreso real y estados vacíos elegantes.
- El historial muestra pedidos y transacciones reales de puntos.
- Las marcas provienen del catálogo, sin inventar distribuidores oficiales.
- Los tiles de navegación no prometen sorteos, descuentos o promociones
  que no estén verificadas.
- Se distinguen estados de carga, error y vacío; se preservan tokens, logo,
  navegación, componentes visuales, rutas y acciones V3.

## Limitaciones conocidas, fuera de este patch

**Importante sobre multimoneda:** actualmente el backend de analytics
agrega `Order.total` de órdenes pagadas sin segmentar por `Order.currency`.
Si existen órdenes CLP/USD/ARS mezcladas, mostrar esa suma como CLP puede
resultar contablemente incorrecto. Este patch elimina cifras inventadas,
pero **no certifica la agregación multimoneda del backend**. Para solucionar
esa limitación hace falta un ajuste de contrato del endpoint, con pruebas
contables y migración visual compatible; no se improvisó conversión usando
un tipo de cambio arbitrario.

El dashboard admin original no devuelve el campo moneda en
`recent_orders`. Por eso se muestra la cifra sin símbolo monetario cuando
no es identificable. Al abrir la orden completa está su moneda real.

Las curvas y porcentajes históricos solo pueden representar la
granularidad que devuelve la API actual. No se infieren proyecciones ni
se rellenan fechas sin observaciones.

## Comprobaciones

En `frontend/`, con Node/npm del proyecto:

```bash
npm ci
npm run lint
npm run test:unit
npm run build
```

Las pruebas nuevas en
`frontend/tests/dashboard-v3-data.test.mjs` verifican ausencia de
fallbacks comerciales falsos, cifras cero, órdenes, monedas desconocidas,
categorías por unidades, estados y series por período.

QA autenticada requerida: Admin y Cliente con cuenta **vacía**, con
pedidos reales, con puntos en cero, historial de fidelización, marca
sin logo, error de API y datos de múltiples monedas. Comprobar también
responsive desktop/mobile, filtros de 7D/30D/1A y permisos.

Estado: patch preparado y selectores evaluados aisladamente;
**build completo y pruebas de Cloud Build pendientes en este entorno**.
No desplegar si alguna prueba falla.
