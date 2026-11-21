# LEVELPRO OS V4.0 — BACKLOG FUNCIONAL EMPRESARIAL REASIGNADO
## Matriz Maestra de Capacidades (BF-01 a BF-47) sobre las 17 Compuertas

**Documento:** `docs/v4/master/functional-backlog-matrix.md`  
**Versión:** 4.0.0-master  
**Fecha de Emisión:** Noviembre 2026  
**Líderes de Producto:** Chief Product Officer & Senior Enterprise Architect  
**Alcance:** Catálogo completo de 47 capacidades funcionales reasignadas a la arquitectura de 17 compuertas, preservando todos los identificadores históricos y añadiendo las capacidades empresariales requeridas.

---

### 1. Criterios de Asignación y Priorización

- **Identificadores Preservados:** Las capacidades `BF-01` a `BF-35` conservan sus identificadores unívocos originales definidos en Gate 0.1.
- **Nuevas Capacidades Empresariales:** Se incorporan formalmente del `BF-36` al `BF-47` para cubrir finanzas profundas (AR/AP, tesorería, flujo de caja), crédito B2B, gestión documental aduanera, regularización de seriales y desacoplamiento de infraestructura.
- **Prioridades:** P1 (Crítica / Fundacional), P2 (Diferenciador Operativo), P3 (Optimización y Analítica).

---

### 2. Matriz Maestra de Funcionalidades

| ID | Funcionalidad | Dominio / Módulo | Gate Asignado | Prioridad | Dependencias | Entregable Concreto | Criterio de Aceptación (DoD) |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| **BF-01** | **Gestión de Proveedores** | Abastecimiento | **GATE 3** | P1 | Ninguna | Modelo `Supplier`, endpoints DRF y vistas de gestión. | Permite crear distribuidores con moneda (USD/CLP/ARS), contactos y MOQ. |
| **BF-02** | **Comparación de Proveedores** | Abastecimiento | **GATE 3** | P2 | BF-01 | Modelo `ProductSupplier` con comparativa de costo y lead time. | La ficha de producto muestra matriz comparativa de costo entre distribuidores. |
| **BF-03** | **Órdenes de Compra (PO)** | Abastecimiento | **GATE 5** | P1 | BF-01 | Modelo `PurchaseOrder` y máquina de estados de compra. | Permite emitir PO formal a proveedor sin alterar el stock físico. |
| **BF-04** | **Recepciones y Diferencias** | Abastecimiento | **GATE 5** | P1 | BF-03, BF-05 | Modelo `GoodsReceipt` para recepción parcial y mermas. | El stock físico se incrementa atómicamente solo al confirmar la recepción. |
| **BF-05** | **Bodegas y Ubicaciones** | Inventario | **GATE 4** | P1 | Ninguna | Modelos `Warehouse` y `WarehouseStock`. | Soporta existencias separadas para Bodega Central, Showroom y Tránsito. |
| **BF-06** | **Kardex de Movimientos** | Inventario | **GATE 4** | P1 | BF-05 | Modelo inmutable `InventoryMovement`. | Toda entrada, salida o ajuste genera un registro auditable con usuario. |
| **BF-07** | **Trazabilidad de Seriales** | Inventario | **GATE 4** | P1 | BF-05 | Modelo `SerialNumberTrack` con 3 modos (NONE, OPT, REQ). | Validación estricta de seriales obligatorios al recibir mercadería y despachar. |
| **BF-08** | **Reservas de Stock** | Inventario | **GATE 4** | P2 | BF-05 | TTL de bloqueo temporal de existencias en checkout. | Libera automáticamente existencias si el cliente abandona o expira el pago. |
| **BF-09** | **Historial y Capas de Costos**| Costos | **GATE 6** | P1 | BF-04 | Snapshots de costo por lote y específico por serial. | Cálculo de costo de venta congelado por orden, desvinculado del precio catálogo. |
| **BF-10** | **RBAC Granular Backend** | Seguridad | **GATE 1** | P1 | Ninguna | Clases de permisos modulares en DRF y asignación de grupos. | Usuarios de bodega no visualizan márgenes ni datos financieros. |
| **BF-11** | **Ventas Manuales (Drafts)** | Operaciones | **GATE 7** | P1 | BF-05 | Creador administrativo de órdenes manuales con reserva. | Permite a un ejecutivo generar una orden asistida para un cliente. |
| **BF-12** | **Ventas por WhatsApp** | Operaciones | **GATE 7** | P2 | BF-11 | Generador de enlace de carrito/pago con enlace wa.me. | Genera un enlace corto directo a checkout con productos y moneda listos. |
| **BF-13** | **Desacoplamiento Pedido/Pago**| Operaciones | **GATE 7** | P1 | Ninguna | Refactor de máquina de estados de `Order` vs `Payment`. | El pedido gestiona logística independientemente de los intentos de cobro. |
| **BF-14** | **Variantes de Producto** | Catálogo | **GATE 2** | P2 | Ninguna | Soporte para variantes de impedancia, color y conexión. | Cada variante maneja su propio SKU, serialización y stock en bodega. |
| **BF-15** | **Edición Masiva de Catálogo** | Catálogo | **GATE 2** | P2 | Ninguna | Panel de actualización rápida de precios y stock. | Permite ajustar precios de una marca completa con porcentaje en un clic. |
| **BF-16** | **Importación / Exportación** | Catálogo | **GATE 2** | P2 | Ninguna | Importador/Exportador CSV y Excel con validación de tipos. | Carga masiva con reporte de errores por fila sin interrumpir el catálogo. |
| **BF-17** | **Bento Admin UI & Responsive**| Experiencia | **GATE 13** | P1 | Ninguna | Layout Editorial Bento responsive (320px a 4K). | Navegación fluida con búsqueda rápida `Cmd+K` y selector de moneda. |
| **BF-18** | **Costeo Landed Definitivo** | Costos | **GATE 6** | P1 | BF-03, BF-04 | Prorrateo de fletes, aranceles aduaneros y seguros. | Asigna el costo puesto en bodega exacto a cada unidad serializada. |
| **BF-19** | **Listas de Precios B2B** | B2B | **GATE 8** | P1 | Ninguna | Tablas de precios por volumen y perfil de empresa. | Aplica automáticamente precios mayoristas al superar umbrales de compra. |
| **BF-20** | **Cotizador B2B con PDF** | B2B | **GATE 8** | P1 | BF-19 | Generador de propuestas comerciales con membrete en PDF. | Descarga de PDF con validez formal y conversión a orden en 1 clic. |
| **BF-21** | **CRM Técnico y Ficha 360°** | CRM | **GATE 8** | P1 | Ninguna | Perfil de estudio: DAW, microfonía, monitoreo y notas. | Visualización consolidada de compras de hardware, cursos y soporte técnico. |
| **BF-22** | **Garantías y Posventa (RMA)** | Posventa | **GATE 10** | P2 | BF-07 | Módulo de gestión de garantías vinculado al serial vendido. | Valida instantáneamente la vigencia de la garantía contra el fabricante. |
| **BF-23** | **Devoluciones y Reembolsos** | Operaciones | **GATE 7** | P1 | BF-06, BF-13 | Flujo formal de RMA con reingreso controlado a bodega. | Retorna stock al inventario solo tras inspección física del equipo devuelto. |
| **BF-24** | **Conciliación Financiera** | Finanzas | **GATE 9** | P1 | Ninguna | Bandeja Bento de transferencias con visor de comprobantes. | Permite aprobar o rechazar comprobantes de transferencia en 1 clic. |
| **BF-25** | **Integración de Couriers** | Logística | **GATE 10** | P2 | Ninguna | Generación de guías con Chilexpress/Starken y manifiestos. | Impresión de etiquetas con código de barras para entrega al transporte. |
| **BF-26** | **Cupones de Descuento** | Crecimiento | **GATE 11** | P2 | Ninguna | Motor de cupones con restricción por moneda, uso y fecha. | Validación segura en checkout impidiendo combinaciones indebidas. |
| **BF-27** | **Promociones Programadas** | Crecimiento | **GATE 11** | P2 | Ninguna | Programador de campañas de descuento con fecha inicio/fin. | Activa y desactiva precios promocionales automáticamente a medianoche. |
| **BF-28** | **Recuperación de Carritos** | Crecimiento | **GATE 11** | P2 | BF-08 | Detección de carritos abandonados con emails automáticos. | Envío de recordatorio personalizado con enlace directo para retomar la compra. |
| **BF-29** | **Embudo de Conversión** | Analítica | **GATE 14** | P3 | Ninguna | Métricas del funnel de compra (Visita → Carrito → Pago). | Gráfico Bento con tasas de caída por etapa sin requerir scripts externos. |
| **BF-30** | **Editor Visual del Sitio** | CMS | **GATE 12** | P2 | Ninguna | Gestor visual de Hero Slider, banners y textos. | Permite actualizar la estética de la tienda pública sin modificar código. |
| **BF-31** | **Borradores y Versiones CMS** | CMS | **GATE 12** | P3 | BF-30 | Estados de contenido (`Borrador`, `Publicado`) con rollback. | Permite previsualizar campañas de marketing antes de lanzarlas al público. |
| **BF-32** | **Centro de Notificaciones** | Experiencia | **GATE 13** | P2 | Ninguna | Alertas operativas en tiempo real (stock bajo, pedidos demorados).| Panel superior de notificaciones con conteo de acciones urgentes. |
| **BF-33** | **Inteligencia Comercial (BI)**| Analítica | **GATE 14** | P2 | BF-06, BF-09 | Rotación de inventario (DSI) y rentabilidad por marca/categoría.| Métricas de capital inmovilizado y productos de baja rotación en Bento. |
| **BF-34** | **Ecosistema SoundMap** | Ecosistema | **GATE 14** | P2 | Ninguna | Sincronización de credenciales y librerías de audio vía webhook.| Validación de beneficios comerciales exclusivos para usuarios SoundMap. |
| **BF-35** | **Hardening y Release V4.0** | Lanzamiento | **GATE 15** | P1 | Todas | Pruebas de carga, auditoría de seguridad y despliegue final. | Aprobación formal de entrega y cero errores en producción. |
| **BF-36** | **Cuentas por Cobrar (AR)** | Finanzas | **GATE 9** | P1 | BF-19, BF-20 | Módulo de aging de cartera, facturas pendientes y cobranza B2B. | Reporte de cuentas por cobrar agrupadas por antigüedad (30/60/90 días). |
| **BF-37** | **Cuentas por Pagar (AP)** | Finanzas | **GATE 9** | P1 | BF-03, BF-04 | Módulo de control de facturas de proveedores y fechas de pago. | Calendario de pagos a distribuidores con alertas de vencimiento. |
| **BF-38** | **Tesorería Multi-Cuenta** | Finanzas | **GATE 9** | P1 | Ninguna | Gestión de saldos bancarios y liquidación por moneda (CLP/USD/ARS).| Conciliación de cartolas bancarias y arqueo de caja sin mezclar divisas. |
| **BF-39** | **Proyección de Flujo de Caja**| Finanzas | **GATE 9** | P2 | BF-36, BF-37 | Algoritmo predictivo de entradas y salidas de efectivo a 30/60/90 días.| Gráfico Bento con estimación de balance futuro por cada moneda. |
| **BF-40** | **Crédito Comercial B2B** | B2B | **GATE 8** | P1 | BF-20 | Asignación de líneas de crédito corporativo y términos de pago. | Bloqueo preventivo de órdenes si el cliente supera su línea de crédito autorizada. |
| **BF-41** | **Audit Trail Inmutable** | Seguridad | **GATE 1** | P1 | Ninguna | Modelo `AuditLog` protegido contra mutaciones ordinarias. | Registro inalterable de quién modificó un precio, stock, orden o permiso. |
| **BF-42** | **Gestión Documental Aduanas** | Abastecimiento | **GATE 5** | P2 | BF-03 | Repositorio de Bill of Lading, Facturas Comerciales y DUS aduaneros.| Asociación de documentos de importación escaneados a cada PO emitida. |
| **BF-43** | **Servicio Técnico de Taller** | Posventa | **GATE 10** | P2 | BF-07, BF-22 | Ficha de reparación de equipamiento (diagnóstico, repuestos, pruebas).| Trazabilidad de equipos en taller con presupuesto y entrega al cliente. |
| **BF-44** | **Catálogo Técnico Pro Audio** | Catálogo | **GATE 2** | P2 | Ninguna | Campos estructurados de respuesta en frecuencia, impedancia y SPL.| Visualización comparativa técnica interactiva en la tienda pública. |
| **BF-45** | **Hub de Integraciones** | Ecosistema | **GATE 14** | P2 | BF-34 | Panel centralizado de webhooks, API keys y estado de servicios.| Monitor de salud de webhooks de Mercado Pago, PayPal y SoundMap. |
| **BF-46** | **Regularización de Seriales** | Inventario | **GATE 4** | P1 | BF-07 | Protocolo de transición para SKUs existentes que cambien a `REQUIRED`.| Asignación guiada de números de serie al stock físico preexistente. |
| **BF-47** | **Desacoplamiento Migraciones**| Infraestructura| **GATE 1** | P1 | Ninguna | Desacoplamiento de `migrate` del CMD del contenedor Cloud Run. | Ejecución exclusiva como Job previo sin carreras concurrentes. |
