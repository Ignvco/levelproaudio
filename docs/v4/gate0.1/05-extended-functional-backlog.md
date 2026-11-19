# LEVELPRO OS V4.0 — GATE 0.1
## 05. Backlog Funcional Extendido y Matriz de Asignación por Compuertas

**Documento:** `docs/v4/gate0.1/05-extended-functional-backlog.md`  
**Versión:** 4.0.0-gate0.1  
**Fecha de Certificación:** Noviembre 2026  
**Líderes de Producto:** Chief Product Officer & Senior Enterprise Architect  
**Alcance:** Catalogación exhaustiva de más de 30 capacidades funcionales para LEVELPRO OS V4.0.

---

### 1. Principios Rectores del Backlog

1. **Inspiración Funcional:** Combinar la **simplicidad operativa de Tiendanube** para la gestión ágil del día a día con la **potencia comercial de Shopify** y la **disciplina transaccional de un ERP moderno**, todo ello profundamente especializado en las necesidades técnicas de la industria del audio profesional.
2. **Preservación Total:** Ninguna de las capacidades actuales (Academia, Servicios, Loyalty, Rewards, SoundMap, Catálogo) es sustituida o degradada.
3. **Trazabilidad por Compuerta:** Cada funcionalidad cuenta con su compuerta de ejecución asignada (Gate 1 a Gate 4), dependencias técnicas, prioridad de negocio, entregables concretos y criterios objetivos de aceptación.

---

### 2. Matriz Consolidada del Backlog Funcional

| ID | Funcionalidad | Módulo V4.0 | Gate Asignado | Prioridad | Dependencias | Entregable Concreto | Criterio de Aceptación (DoD) |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| **BF-01** | **Gestión de Proveedores** | 4. Compras | **Gate 1** | P1 (Alta) | Ninguna | Modelos `Supplier`, endpoints DRF y vistas de gestión. | Permite crear proveedores con moneda (USD/CLP/ARS), contactos y MOQ. |
| **BF-02** | **Comparación de Proveedores** | 4. Compras | **Gate 1** | P2 (Media) | BF-01 | Modelo `ProductSupplier` con comparativa de costo y lead time. | La ficha de producto muestra matriz comparativa de costo entre distribuidores. |
| **BF-03** | **Órdenes de Compra (PO)** | 4. Compras | **Gate 1** | P1 (Alta) | BF-01 | Modelo `PurchaseOrder` y máquina de estados de compra. | Permite emitir PO formal a proveedor sin alterar el stock físico. |
| **BF-04** | **Recepciones y Diferencias** | 4. Compras | **Gate 1** | P1 (Alta) | BF-03 | Modelo `GoodsReceipt` para recepción parcial y mermas. | El stock físico se incrementa atómicamente solo al confirmar la recepción. |
| **BF-05** | **Bodegas y Ubicaciones** | 3. Inventario | **Gate 1** | P1 (Alta) | Ninguna | Modelos `Warehouse` y `WarehouseStock`. | Soporta existencias separadas para Bodega Central, Showroom y Tránsito. |
| **BF-06** | **Kardex de Movimientos** | 3. Inventario | **Gate 1** | P1 (Alta) | BF-05 | Modelo inmutable `InventoryMovement`. | Toda entrada, salida o ajuste genera un registro auditable con usuario. |
| **BF-07** | **Trazabilidad de Seriales** | 3. Inventario | **Gate 1** | P1 (Alta) | BF-05 | Modelo `SerialNumberTrack` con 3 modos (NONE, OPT, REQ). | Validación estricta de seriales obligatorios al recibir mercadería y despachar. |
| **BF-08** | **Reservas de Stock** | 3. Inventario | **Gate 1** | P2 (Media) | BF-05 | TTL de bloqueo temporal de existencias en checkout. | Libera automáticamente existencias si el cliente abandona o expira el pago. |
| **BF-09** | **Historial y Capas de Costos**| 7. Finanzas | **Gate 1** | P1 (Alta) | BF-04 | Snapshots de costo por lote y específico por serial. | Cálculo de costo de venta congelado por orden, desvinculado del precio catálogo. |
| **BF-10** | **RBAC Granular Backend** | 13. Seguridad | **Gate 1** | P1 (Alta) | Ninguna | Decoradores y permisos modulares en DRF. | Usuarios de bodega no visualizan márgenes ni datos financieros. |
| **BF-11** | **Ventas Manuales (Drafts)** | 2. Pedidos | **Gate 2** | P1 (Alta) | BF-05 | Creador administrativo de órdenes manuales con reserva. | Permite a un ejecutivo generar una orden asistida para un cliente. |
| **BF-12** | **Ventas por WhatsApp** | 2. Pedidos | **Gate 2** | P2 (Media) | BF-11 | Generador de enlace de carrito/pago con enlace wa.me. | Genera un enlace corto directo a checkout con productos y moneda listos. |
| **BF-13** | **Desacoplamiento Pedido/Pago**| 2. Pedidos | **Gate 2** | P1 (Alta) | Ninguna | Refactor de máquina de estados de `Order` vs `Payment`. | El pedido gestiona logística independientemente de los intentos de cobro. |
| **BF-14** | **Variantes de Producto** | 3. Catálogo | **Gate 2** | P2 (Media) | BF-05 | Soporte para variantes de impedancia, color y conexión. | Cada variante maneja su propio SKU, serialización y stock en bodega. |
| **BF-15** | **Edición Masiva de Catálogo** | 3. Catálogo | **Gate 2** | P2 (Media) | Ninguna | Panel de actualización rápida de precios y stock. | Permite ajustar precios de una marca completa con porcentaje en un clic. |
| **BF-16** | **Importación / Exportación** | 3. Catálogo | **Gate 2** | P2 (Media) | Ninguna | Importador/Exportador CSV y Excel con validación de tipos. | Carga masiva con reporte de errores por fila sin interrumpir el catálogo. |
| **BF-17** | **Bento Admin UI & Responsive**| 1. Dashboard | **Gate 2** | P1 (Alta) | Ninguna | Layout Editorial Bento responsive (320px a 4K). | Navegación fluida con búsqueda rápida `Cmd+K` y selector de moneda. |
| **BF-18** | **Costeo Landed Definitivo** | 4. Compras | **Gate 3** | P1 (Alta) | BF-03, BF-04 | Prorrateo de fletes, aranceles aduaneros y seguros. | Asigna el costo puesto en bodega exacto a cada unidad serializada. |
| **BF-19** | **Listas de Precios B2B** | 5. B2B | **Gate 3** | P1 (Alta) | Ninguna | Tablas de precios por volumen y perfil de empresa. | Aplica automáticamente precios mayoristas al superar umbrales de compra. |
| **BF-20** | **Cotizador B2B con PDF** | 5. B2B | **Gate 3** | P1 (Alta) | BF-19 | Generador de propuestas comerciales con membrete en PDF. | Descarga de PDF con validez formal y conversión a orden en 1 clic. |
| **BF-21** | **CRM Técnico y Ficha 360°** | 6. CRM | **Gate 3** | P1 (Alta) | Ninguna | Perfil de estudio: DAW, microfonía, monitoreo y notas. | Visualización consolidada de compras de hardware, cursos y soporte técnico. |
| **BF-22** | **Garantías y Posventa (RMA)** | 6. CRM | **Gate 3** | P2 (Media) | BF-07 | Módulo de gestión de garantías vinculado al serial vendido. | Valida instantáneamente la vigencia de la garantía contra el fabricante. |
| **BF-23** | **Devoluciones y Reembolsos** | 2. Pedidos | **Gate 3** | P1 (Alta) | BF-06, BF-13 | Flujo formal de RMA con reingreso controlado a bodega. | Retorna stock al inventario solo tras inspección física del equipo devuelto. |
| **BF-24** | **Conciliación Financiera** | 7. Finanzas | **Gate 3** | P1 (Alta) | Ninguna | Bandeja Bento de transferencias con visor de comprobantes. | Permite aprobar o rechazar comprobantes de transferencia en 1 clic. |
| **BF-25** | **Integración de Couriers** | 8. Logística | **Gate 3** | P2 (Media) | Ninguna | Generación de guías con Chilexpress/Starken y manifiestos. | Impresión de etiquetas con código de barras para entrega al transporte. |
| **BF-26** | **Cupones de Descuento** | 10. Marketing | **Gate 3** | P2 (Media) | Ninguna | Motor de cupones con restricción por moneda, uso y fecha. | Validación segura en checkout impidiendo combinaciones indebidas. |
| **BF-27** | **Promociones Programadas** | 10. Marketing | **Gate 3** | P2 (Media) | Ninguna | Programador de campañas de descuento con fecha inicio/fin. | Activa y desactiva precios promocionales automáticamente a medianoche. |
| **BF-28** | **Recuperación de Carritos** | 10. Marketing | **Gate 3** | P2 (Media) | BF-08 | Detección de carritos abandonados con emails automáticos. | Envío de recordatorio personalizado con enlace directo para retomar la compra. |
| **BF-29** | **Embudo de Conversión** | 1. Dashboard | **Gate 3** | P3 (Baja) | Ninguna | Métricas del funnel de compra (Visita → Carrito → Pago). | Gráfico Bento con tasas de caída por etapa sin requerir scripts externos. |
| **BF-30** | **Editor Visual del Sitio** | 11. CMS | **Gate 3** | P2 (Media) | Ninguna | Gestor visual de Hero Slider, banners y textos. | Permite actualizar la estética de la tienda pública sin modificar código. |
| **BF-31** | **Borradores y Versiones CMS** | 11. CMS | **Gate 3** | P3 (Baja) | BF-30 | Estados de contenido (`Borrador`, `Publicado`) con rollback. | Permite previsualizar campañas de marketing antes de lanzarlas al público. |
| **BF-32** | **Centro de Notificaciones** | 1. Dashboard | **Gate 3** | P2 (Media) | Ninguna | Alertas operativas en tiempo real (stock bajo, pedidos demorados).| Panel superior de notificaciones con conteo de acciones urgentes. |
| **BF-33** | **Inteligencia Comercial (BI)**| 1. Dashboard | **Gate 3** | P2 (Media) | BF-06, BF-09 | Rotación de inventario (DSI) y rentabilidad por marca/categoría.| Métricas de capital inmovilizado y productos de baja rotación en Bento. |
| **BF-34** | **Ecosistema SoundMap** | 10. Marketing | **Gate 3** | P2 (Media) | Ninguna | Sincronización de credenciales y librerías de audio vía webhook.| Validación de beneficios comerciales exclusivos para usuarios SoundMap. |
| **BF-35** | **Hardening y Release V4.0** | 13. Seguridad | **Gate 4** | P1 (Alta) | Todas | Pruebas de carga, auditoría de seguridad y despliegue final. | Aprobación formal de entrega y cero errores en producción. |
