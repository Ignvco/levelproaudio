# LEVELPRO AUDIO — V3.2 · Patch final consolidado (Release candidate)

Base obligatoria en `main`: `02bea9019d92befb5d4546b7113978fdd4819812` (LOTE4-A_COMPAT). Este documento y el patch son **una sola entrega acumulativa**, sin necesidad de instalar el anterior LOTE4-B.

## Alcance consolidado
1. Servicios: API/error/empty/retry en catálogo y área de administración. KPIs no confunden datos no consultados con ceros. Formularios no guardan con catálogos auxiliares fallidos.
2. Loyalty administrativo: estados y errores con reintento; validación de ajustes enteros y de configuración; mensajes de error de guardado sin atribuir éxito.
3. Rewards administrativo: listas de campañas y ganadores con control de errores; accesibilidad de evidencia; detalle de campaña con fallos de carga recuperables; input de tickets por unidad validado.
4. Rewards público: separación entre error y catálogo vacío; recuperación del historial de ganadores sin ocultar fallos y eliminación de una afirmación de certificación externa no verificable.
5. Registro de participaciones: filtros con etiquetas accesibles, exportación ligada a criterios efectivos.
6. Finanzas: mensaje de saldo insuficiente en la moneda efectivamente seleccionada.
7. Pruebas automatizadas de contrato UI y validaciones de formularios integradas a `npm run test:unit`.

## Alcance NO modificado
- Patch 14: **totalmente pausado**, no se implementa ni modifica la orquestación de pagos.
- No se cambian modelos, migraciones, pasarelas, impuestos, lógica de sorteo ni reglas económicas.
- La separación comercial CLP/USD/ARS de V3.2 y Rewards LOTE4-A se conserva, sin FX implícito.
- Movimientos históricos con moneda desconocida siguen requiriendo conciliación documental. No se inventa divisa ni importe.
- La rentabilidad USD/ARS no se declara certificada sin costo equivalente o FX explícito.
- Los datos de listas paginadas representan **vista parcial**, no totales generales.

## Requisitos de aceptación antes de afirmar "listo para producción"
**No son opcionales y no se pueden comprobar desde un patch.**

1. Verificar árbol limpio y base SHA exacta.
2. `git apply --check LEVELPRO_AUDIO_V3.2_FINAL_CONSOLIDADO.patch`, aplicar y `git diff --check`.
3. Cloud Build de QA: `gcloud builds submit . --config cloudbuild.v3-2-qa.yaml` (sin despliegue).
4. `cd frontend && npm ci && npx playwright install chromium && npm run test:browser`.
5. QA real autenticada por perfiles y rutas, en desktop/móvil: 1440/1280/1024/768/390/320 px, red con pérdida y reintento, formularios, permisos, cambios de estado, persistencia y reingreso.
6. Operaciones controladas: órdenes CLP/USD/ARS, despacho/stock, PayPal USD pagado desde orden CLP, documentación SII, Rewards, certificaciones, videos, correo y archivos en entorno de pruebas/sandbox.
7. Revisar y conciliar histórico monetario NULL y documentos extranjeros anteriores donde proceda. Guardar backup restaurable de DB, definir rollback de Cloud Run y medir errores post-release.
8. Después de QA con evidencia y autorización, usar el procedimiento normal de despliegue. **Nunca confundir Cloud Build QA SUCCESS con implementación certificada.**

## Limitaciones de alcance
No se ha ejecutado QA autenticada ni integración real con terceros desde esta sesión. Una auditoría estática no puede demostrar acabado visual 1:1 de todas las rutas ni ausencia completa de defectos. La versión es candidata a liberación y su aprobación final exige las verificaciones anteriores.


## Invariante crítica de fidelización y divisas
La revisión encontró que `LoyaltyConfig.puntos_por_peso` y `peso_por_punto` están definidos en pesos CLP, mientras que órdenes USD/ARS se guardan en su moneda original. Antes, el backend acreditaba puntos por el número extranjero sin FX, y podía aplicar descuentos CLP numéricamente sobre subtotal USD/ARS.

La corrección falla de forma segura: **solo órdenes CLP ganan puntos automáticamente y solo órdenes CLP pueden canjearlos**. Las órdenes USD/ARS siguen siendo comprables sin puntos. Carrito y Checkout muestran las monedas seleccionadas, no inventan precios faltantes y no trasladan saldos CLP a operaciones extranjeras.

**Esta restricción requiere aprobación comercial**: habilitar fidelización extranjera de nuevo exige política explícita y tasa histórica identificable por operación. Históricos ya acreditados en USD/ARS deben auditarse con documentos; el patch no los reescribe. Tests backend de cobertura nueva en `backend/tests/test_loyalty_currency_guard.py`.
