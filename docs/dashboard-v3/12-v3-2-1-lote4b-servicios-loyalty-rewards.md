# LevelPro Audio V3.2.1 — LOTE4-B · Servicios, Loyalty y Rewards Admin

Base: `02bea9019d92befb5d4546b7113978fdd4819812` (LOTE4-A_COMPAT aplicado). **Patch 14 se mantiene completamente pausado.**

## Correcciones en este lote
- Servicios públicos: un fallo de API ya no aparece como "no hay servicios"; ofrece reintento. Contador total desconocido se muestra "—" en vez de cero; filtros accesibles con `aria-pressed`.
- Servicios administrados: solicitudes, catálogo y reservas distinguen carga, error y ausencia real; KPIs muestran "—" mientras los datos no están disponibles, especialmente reservas cuyo fetch estaba deshabilitado hasta abrir la pestaña. Botones de alta y guardado requieren catálogo y categorías verificados.
- Fidelización: errores de resumen y configuración ya no presentan ceros inventados o skeleton infinito; se captura el error al guardar sin cerrar formulario ni anunciar éxito. Ajustes manuales y parámetros se validan sin cambiar reglas de acumulación o canje.
- Campañas y ganadores: errores de consulta con reintento; KPIs de campañas etiquetados por vista visible, no falsos totales del backend paginado; control de archivo de evidencia accesible por teclado.
- Pruebas de formularios y contratos UX en `frontend/tests/v3-2-1-lote4b-ux.test.mjs`, enlazadas en `test:unit`.

## Limitaciones y validación
No hay cambios de backend, pagos, sorteo, permisos, inventario ni migraciones. El módulo de Servicios no modifica el contrato API ni introduce paginación adicional. La cobertura visual con sesión autenticada y las pruebas reales de operaciones siguen pendientes.

Validar `npm run lint`, `npm run test:unit`, `npm run build`, `gcloud builds submit . --config cloudbuild.v3-2-qa.yaml`, y QA con cuentas reales a 1440/768/390px. Verificar caídas HTTP, recuperación, carga de categorías, formularios, reservas, campañas y entrega de premios.
