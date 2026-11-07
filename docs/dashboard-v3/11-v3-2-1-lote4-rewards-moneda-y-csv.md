# LevelPro Audio V3.2.1 — LOTE4, parte A · Rewards
Base inmutable: `c9418589ae30cc34930929a3cec1c11e6be622d5`. Cambios aislados en rama de revisión; **Patch 14 permanece pausado**.

## Hallazgo de contabilidad
El endpoint `/api/v1/admin/rewards/dashboard/` sumaba `Order.total` sobre órdenes de tres monedas sin filtrar `Order.currency`; la tarjeta de ingreso del administrador lo mostraba como un importe único. Se sustituye por un cálculo aislado CLP/USD/ARS, predeterminado CLP, con rechazo de monedas desconocidas. Las órdenes con múltiples tickets se cuentan una vez. No se introducen conversiones, ni modificaciones de pagos, pedidos o historiales.

## Correcciones UX
El dashboard administrativo de Rewards selecciona explícitamente la moneda original y evita mostrar un importe sin contrato `currency` verificable. El listado de participaciones diferencia fallo de consulta de cero registros y ofrece reintento. El CSV filtra campaña, búsqueda y fechas; antes sólo exportaba por campaña. El número visible de participaciones no se presenta como total global cuando la API pagina.

## Cambios y pruebas
- Backend: `backend/apps/rewards/views_admin.py`; tests `backend/apps/rewards/tests_currency_dashboard.py`.
- Frontend: API Rewards, dashboard y participaciones; contrato JS incluido en `frontend/tests/v3-2-currency.test.mjs`.
- Pruebas diseñadas: ingresos separados CLP/USD/ARS, orden con tickets duplicados, orden pendiente excluida, moneda inválida, acceso sin privilegios y CSV filtrado.
- No hay migraciones nuevas, cambios de permisos ni nueva lógica de sorteo.

## Antes de integrar
Ejecutar `gcloud builds submit . --config cloudbuild.v3-2-qa.yaml`, ejecutar también la suite de navegador y validar Rewards con cuenta admin en 1440, 768 y 390px. Verificar la exportación de CSV real con búsqueda y fechas. No dar por aprobada producción hasta resultados de QA y validación autenticada. Esta fase no sustituye el resto de pendientes de Servicios, Loyalty, Winners, Campaigns, inspección de 62 páginas, históricos de monedas y Patch 14.
