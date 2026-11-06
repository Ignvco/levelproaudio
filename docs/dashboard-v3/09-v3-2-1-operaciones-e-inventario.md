# LevelPro Audio V3.2.1 — Lote 2: catálogo, inventario, academia y operaciones

**Estado:** implementación terminada en rama, pendiente de QA integrada y aceptación visual.  
**Base:** `e2789ae378f1112c2ab4336ee4ffedb963778bff` (V3.2.1; Cloud Build exitoso confirmado por el propietario).  
**Rama:** `feat/v3-2-1-interiores-catalogo-academia`.  
**Patch 14:** no iniciado, no se altera su alcance.

## A. Hallazgos y correcciones

1. **Inventario / rotación:** el backend retorna `unidades_vendidas`, `stock_actual`, `ingresos`, `currency`. La pantalla utilizaba `units_sold`, `stock`, `total_revenue`, `rotation_index`. Resultado anterior: números y barras falsos. La normalización usa el contrato real, hace explícitas métricas faltantes y permite filtrar CLP, USD, ARS en la petición. La barra compara unidades vendidas entre los 20 productos devueltos: **no** es una tasa contable de rotación.
2. **Inventario / paginación:** la pestaña por categoría utilizaba los primeros 200 SKUs como si fueran el inventario completo. Se detecta `next`/`count` y se etiqueta como **vista parcial**. Totales por categoría son solo de la muestra. Se marcan costos y precios de venta desconocidos en lugar de inventarlos.
3. **Inventario / ganancia potencial:** `cost_price` admite `null`. El servicio de stock sumaba costos conocidos, pero restaba el resultado de todas las ventas potenciales. Ahora añade `cost_missing_count`, `profit_calculable` y devuelve `ganancia_potencial: null` si un producto con stock carece de costo. Con costos completos, preserva la fórmula anterior. Es una protección de reporte, **sin migración de base de datos**.
4. **Registro tributario:** el monto CLP del documento del SII no puede inferirse de una orden USD o ARS. Para una orden extranjera sin documento, el input queda vacío y el administrador ve una explicación explícita. Los montos ya registrados **no se reescriben** y deben revisarse contra el documento SII. El backend acepta `null` para `monto`. El endpoint lista hasta 200 órdenes: KPI ahora indica el límite.
5. **Academia:** fallos de consulta distinguidos del catálogo vacío; reintento; indicadores etiquetados por vista; acciones de curso con nombre accesible y precio CLP sin cero inventado.
6. **Productos, Marcas, Categorías, Órdenes:** estados de error y reintento, títulos/KPIs condicionados a datos reales, controles de teclado, etiquetas de búsqueda, datos y precios por moneda coherente.
7. **Categorías / orden:** `useQuery.onSuccess` estaba obsoleto en TanStack Query v5. Se elimina la sincronización duplicada. Tras un reorder exitoso, la vista vuelve a leer la lista autorizada por el servidor. Ante un fallo, alerta y consulta nuevamente; una operación parcial debe revisarse.
8. **Finanzas:** resumen y pestañas de retirados, categorías, por producto y análisis anuncian fallos de sus propias consultas; no muestran valores vacíos como si fueran balances. No se modificó la conciliación monetaria histórica de V3.2.
9. **Pagos / bancos:** cuando falta información del servidor, no se asumen cero medios de pago o cuentas. Se bloquea la creación desde listados fallidos hasta recuperar los datos y se permite reintentar.
10. **UI:** tarjetas de marca/Academia con contraste más legible, sombra contenida, interacción menos brusca y composición móvil más segura. Se mantienen identidad Obsidian/Canvas, Geist y acento oficial LevelPro.
11. **QA:** se corrige `cloudbuild.v3-2-qa.yaml` de Node 22 a Node 24.19; npm 11.9; se incorpora `check:bundle`. No despliega.

## B. Pruebas incorporadas

- `backend/apps/analytics/tests_inventory_valuation.py`: costos ausentes, cobertura completa y producto sin stock.
- `frontend/tests/v3-2-1-inventory.test.mjs`: campos reales de Django, distinción null/0, moneda original, cobertura parcial, costo/precio desconocidos.
- `frontend/tests/v3-2-1-billing.test.mjs`: prohibición de copiar valor de órdenes USD/ARS, CLP original y registros históricos preservados.
- Ambas suites JS forman parte de `npm run test:unit`.
- Ocho comprobaciones aisladas de helpers JS se ejecutaron satisfactoriamente. **No equivalen a Cloud Build ni a un flujo autenticado**.

## C. Validación exigida

En una rama local de QA con el patch:

```bash
git diff --check
gcloud builds submit . --config cloudbuild.v3-2-qa.yaml
```

La configuración de QA ejecuta tests backend, migraciones en dry-run, PostgreSQL efímero, ESLint, pruebas JS, build Vite y control del bundle, **sin desplegar Cloud Run**.

Revisar con cuentas reales y con estados de error:
- Catálogo / Inventario: Resumen, Alertas, Rotación CLP/USD/ARS, Categorías parciales, producto sin costo, venta sin costo.
- Productos, Marcas y Categorías: crear/editar/eliminar, arrastrar, guardar/recargar, filtrado, móviles.
- Academia: lista, curso libre y con precio, niveles, módulos, edición, importación.
- Finanzas: selector de moneda, ingresos, retiros, por producto, análisis, reconciliación pendiente.
- Pagos y Métodos de Pago: movimientos, cuentas, formularios, permisos y estados de error.
- Tributario: pedido CLP vs USD/ARS, importe SII real, documento antiguo y límites de 200 órdenes.
- Resoluciones 1440 / 1280 / 1024 / 768 / 390 / 320 y navegación por teclado.

## D. Pendientes explícitos

- No se certifica experiencia visual 1:1 de todas las páginas desde inspección de código: faltan capturas autenticadas.
- Módulos restantes: Lecciones, Módulos, Inscripciones, Certificaciones, Loyalty Admin, Rewards detallado, Usuarios, Servicios y varias rutas públicas.
- Los documentos SII extranjeros que ya tuvieran importe registrado necesitan revisión manual; no se aplica retroactividad automática.
- Las categorías con más de 200 SKUs siguen siendo una muestra en la interfaz, no un informe total de valorización por categoría.
- Conciliación histórica CLP/USD/ARS de finanzas V3.2 sigue pendiente; Patch 14 sigue pausado.
- No declarar éxito de compilación o QA de **este lote** hasta obtener los registros de Cloud Build y revisión visual.
