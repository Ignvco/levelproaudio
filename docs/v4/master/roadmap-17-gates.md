# LEVELPRO OS V4.0 — ROADMAP MAESTRO EMPRESARIAL
## Arquitectura de 17 Compuertas de Implementación (Fases I a V)

**Documento:** `docs/v4/master/roadmap-17-gates.md`  
**Versión:** 4.0.0-master  
**Fecha de Emisión:** Noviembre 2026  
**Autor:** Senior Enterprise Architect & Lead Product Manager  
**Aprobación Estratégica:** Dirección General y Propietarios de LevelPro Audio  
**Alcance:** Marco de trabajo estructurado para la evolución completa del Business Management System.

---

### 1. Visión General de Fases y Compuertas

```
═══════════════════════════════════════════════════════════════════════════════════
FASE I — FUNDAMENTOS
├── GATE 0: Discovery & Audit (Completado)
├── GATE 0.1: Baseline Certification (Completado)
└── GATE 1: Security & Business Core (Preflight actual y desarrollo)

FASE II — ABASTECIMIENTO E INVENTARIO
├── GATE 2: Product Information Management (PIM Avanzado & Variantes)
├── GATE 3: Supplier Management (Proveedores M2M & Listas de Costo)
├── GATE 4: Warehouse Management (WMS, Bodegas, Kardex & Seriales)
├── GATE 5: Procurement Management (Órdenes de Compra & Recepción)
└── GATE 6: Cost & Pricing Intelligence (Landed Cost & Precios Dinámicos)

FASE III — OPERACIONES COMERCIALES
├── GATE 7: Order Management System (OMS, Ventas Manuales & Desacoplamiento)
├── GATE 8: CRM & B2B Management (Ficha 360°, Cotizaciones PDF & Crédito)
├── GATE 9: Financial Management (Conciliación, Tesorería, DTE & Flujo de Caja)
├── GATE 10: Logistics & After-Sales (Couriers, Guías, RMA & Garantías)
└── GATE 11: Marketing & Customer Growth (Rewards, Fidelización, Cupones & Carritos)

FASE IV — EXPERIENCIA Y ECOSISTEMA
├── GATE 12: Website & Content Management (CMS Bento, Hero, Banners & Versiones)
├── GATE 13: Admin Experience (Unificación Global Bento UI & Responsive 320px-4K)
└── GATE 14: Ecosystem & Business Intelligence (SoundMap Hub, BI & Analítica)

FASE V — CERTIFICACIÓN Y LANZAMIENTO
└── GATE 15: Enterprise Release & Certification (Hardening, QA Final & Despliegue)
═══════════════════════════════════════════════════════════════════════════════════
```

---

### 2. Especificación Detallada de las 17 Compuertas

---

#### GATE 0: Discovery & Audit
- **Objetivo:** Auditoría integral 360° del estado inicial de la plataforma post-despliegue V3.5.
- **Alcance:** Diagnóstico de los 12 ejes técnicos y de negocio, benchmark funcional inicial y levantamiento de deuda técnica.
- **Dependencias:** Ninguna (Línea base `e33f699`).
- **Funcionalidades a Preservar:** 100% de la tienda pública, pagos y catálogo.
- **Modelos Involucrados:** Modelos base existentes en las 11 aplicaciones.
- **Endpoints:** `/api/v1/*` de lectura y escritura.
- **Interfaces:** Tienda pública y `/admin` legacy.
- **Riesgos:** Supuestos técnicos no contrastados contra código.
- **Pruebas Obligatorias:** Inspección de pruebas unitarias existentes.
- **Entregables:** 9 documentos iniciales en `docs/v4/gate0/` e informe maestro.
- **Definition of Done (DoD):** Diagnóstico preliminar documentado y presentado a dirección.
- **Criterio de Aceptación del Propietario:** Aprobación conceptual condicionada a rectificación.

---

#### GATE 0.1: Baseline Certification
- **Objetivo:** Revisión independiente, rectificación técnica y certificación de línea base empírica.
- **Alcance:** Corrección de versiones (React 19, Vite 8, Node 24), nomenclatura de modelos (`User`, `OrderItem.price`, `stock_min`, `SpecialOrderRequest`), máquina de estados real y eliminación de pasarelas inexistentes (Webpay/Stripe).
- **Dependencias:** GATE 0.
- **Funcionalidades a Preservar:** 100% del sistema productivo intacto sin mutación de código.
- **Modelos Involucrados:** Catálogo de 43 modelos Django reales.
- **Endpoints:** `/api/v1/*`.
- **Interfaces:** Verificación de rutas en `App.jsx`.
- **Riesgos:** Inconsistencia documental corregida.
- **Pruebas Obligatorias:** `npm run lint`, `npm run test:unit`, `check:bundle`, pruebas de concurrencia.
- **Entregables:** 9 documentos rectificados en `docs/v4/gate0.1/` y artefacto maestro.
- **Definition of Done (DoD):** Cero discrepancias entre documentos y código real.
- **Criterio de Aceptación del Propietario:** Aprobación formal de línea base rectificada.

---

#### GATE 1: Security & Business Core
- **Objetivo:** Establecer la base de seguridad granular (RBAC), auditoría inmutable (Audit Trail), desacoplamiento de migraciones y contratos de datos reutilizables.
- **Alcance:** Subgates 1.0 (Preflight y evidencias), 1.1 (RBAC granular por módulo/acción/campo), 1.2 (Audit Trail inmutable), 1.3 (Estrategia de desacoplamiento de migraciones Cloud Run), 1.4 (Contratos de datos de negocio y Decimal) y 1.5 (Certificación QA).
- **Dependencias:** Aprobación de GATE 0.1.
- **Funcionalidades a Preservar:** Login JWT, permisos de staff actuales, sesiones administrativas.
- **Modelos Involucrados:** `users.User`, `auth.Group`, `auth.Permission`, nuevo `AuditLog`.
- **Endpoints:** `/api/v1/admin/auth/roles/`, `/api/v1/admin/audit/`.
- **Interfaces:** Configuración de roles en panel administrativo.
- **Riesgos:** Bloqueo accidental de personal staff durante la transición RBAC.
- **Pruebas Obligatorias:** Tests de escalada de privilegios, inmutabilidad de logs y seguridad de tokens.
- **Entregables:** Documentación preflight en `docs/v4/gate1/preflight/`, clases de permisos DRF, modelo `AuditLog`, runbook de migraciones Cloud Run.
- **Definition of Done (DoD):** Usuarios con roles restringidos no pueden acceder a vistas no autorizadas ni ver campos sensibles en la API; `AuditLog` registra cada mutación crítica.
- **Criterio de Aceptación del Propietario:** Verificación de permisos y aprobación formal de entrega de Gate 1.

---

#### GATE 2: Product Information Management (PIM Avanzado & Variantes)
- **Objetivo:** Evolucionar el catálogo hacia un PIM profesional con variantes estructuradas, especificaciones de audio pro y edición masiva.
- **Alcance:** Variantes de producto (impedancia, color, conectores), atributos técnicos especializados (SPL, THD, respuesta en frecuencia), importador/exportador CSV/Excel validado y panel de actualización masiva de precios.
- **Dependencias:** GATE 1.
- **Funcionalidades a Preservar:** Kits/Bundles existentes (`BundleItem`), comparador técnico (`/compare`), slugs SEO y favoritos.
- **Modelos Involucrados:** `products.Product`, `products.Category`, `products.Brand`, `ProductVariant`, `TechnicalSpecification`.
- **Endpoints:** `/api/v1/products/`, `/api/v1/admin/products/bulk-update/`, `/api/v1/admin/products/export/`.
- **Interfaces:** `AdminProducts`, `AdminProductDetail`, selector de variantes en `/shop/:slug`.
- **Riesgos:** Alteración de URLs indexadas en Google o pérdida de precios base.
- **Pruebas Obligatorias:** Pruebas de serialización de variantes, cálculo de precios por moneda y validación de atributos.
- **Entregables:** Modelos de variantes, vistas de administración Bento y suite de tests.
- **Definition of Done (DoD):** Un producto con 3 opciones de impedancia administra SKUs independientes sin duplicar la ficha técnica.
- **Criterio de Aceptación del Propietario:** Aprobación visual del selector de variantes y exportador CSV.

---

#### GATE 3: Supplier Management (Proveedores & Listas de Costo)
- **Objetivo:** Implementar la gestión comercial de distribuidores y fabricantes oficiales de audio profesional.
- **Alcance:** Directorio de distribuidores (`Supplier`), relación Muchos a Muchos (`ProductSupplier`), SKUs de proveedor, costos en moneda extranjera (USD), mínimos de compra (MOQ), plazos de entrega (lead time) e historial de precios (`SupplierPriceHistory`).
- **Dependencias:** GATE 2.
- **Funcionalidades a Preservar:** Costo base actual `cost_price` en `Product` como fallback de catálogo.
- **Modelos Involucrados:** `Supplier`, `ProductSupplier`, `SupplierPriceHistory`.
- **Endpoints:** `/api/v1/admin/suppliers/`, `/api/v1/admin/suppliers/:id/products/`.
- **Interfaces:** `AdminSuppliers`, matriz comparativa de proveedores en ficha de producto.
- **Riesgos:** Pérdida de histórico de compras al desactivar un proveedor.
- **Pruebas Obligatorias:** Validación de múltiples proveedores por SKU, preservación de histórico ante borrado lógico.
- **Entregables:** App `apps.procurement` inicializada, endpoints DRF y vistas Bento.
- **Definition of Done (DoD):** Es posible comparar costos entre 2 distribuidores para el mismo micrófono y seleccionar el preferente.
- **Criterio de Aceptación del Propietario:** Aprobación del directorio de distribuidores y matriz de costos.

---

#### GATE 4: Warehouse Management (WMS, Bodegas, Kardex & Seriales)
- **Objetivo:** Construir el motor de inventario dimensional y trazabilidad de números de serie unitarios.
- **Alcance:** Soporte multi-bodega (`Warehouse`: Central, Showroom, Tránsito), dimensiones de stock (físico, reservado, disponible), diario inmutable de movimientos (`InventoryMovement` / Kardex) y serialización en 3 modos (`NONE`, `OPTIONAL`, `REQUIRED`).
- **Dependencias:** GATE 2 y GATE 3.
- **Funcionalidades a Preservar:** Bloqueo de concurrencia en órdenes (`select_for_update`), consumo atómico de kits y preórdenes.
- **Modelos Involucrados:** `Warehouse`, `WarehouseStock`, `InventoryMovement`, `SerialNumberTrack`.
- **Endpoints:** `/api/v1/admin/inventory/warehouses/`, `/api/v1/admin/inventory/kardex/`, `/api/v1/admin/serials/`.
- **Interfaces:** `AdminInventory` con filtros por bodega, escáner de seriales y vista de Kardex.
- **Riesgos:** Desincronización entre stock físico y stock disponible mostrado en la tienda pública.
- **Pruebas Obligatorias:** Pruebas de concurrencia en PostgreSQL, prevención de duplicación de seriales y validación de Kardex.
- **Entregables:** Motor de inventario dimensional, endpoints de serialización y módulo visual.
- **Definition of Done (DoD):** Despachar un equipo serializado descuenta el stock físico de la bodega correcta y asocia el serial vendido al cliente.
- **Criterio de Aceptación del Propietario:** Verificación del flujo de serialización y no afectación del stock público.

---

#### GATE 5: Procurement Management (Órdenes de Compra & Recepción)
- **Objetivo:** Digitalizar el ciclo de adquisiciones a distribuidores nacionales e internacionales.
- **Alcance:** Creación y seguimiento de Órdenes de Compra (`PurchaseOrder`), emisión de PDF formal a fábrica, recepción física desacoplada (`GoodsReceipt`), soporte de entregas parciales, registro de diferencias y control de productos dañados.
- **Dependencias:** GATE 3 y GATE 4.
- **Funcionalidades a Preservar:** `SpecialOrderRequest` vinculable a una PO de importación.
- **Modelos Involucrados:** `PurchaseOrder`, `PurchaseOrderItem`, `GoodsReceipt`, `GoodsReceiptItem`.
- **Endpoints:** `/api/v1/admin/purchase-orders/`, `/api/v1/admin/goods-receipts/`.
- **Interfaces:** `AdminProcurement`, flujo de recepción de mercadería con escaneo de seriales.
- **Riesgos:** Que la creación de una PO aumente indebidamente las existencias físicas.
- **Pruebas Obligatorias:** Verificación de invariante: solo `GoodsReceipt` confirmada incrementa stock y Kardex.
- **Entregables:** Módulo de compras completo, generador de PO y receptor de carga.
- **Definition of Done (DoD):** Recepción parcial de 4 de 10 unidades pedidas genera entrada en Kardex por 4 unidades, dejando la PO en estado `PARTIALLY_RECEIVED`.
- **Criterio de Aceptación del Propietario:** Aprobación del flujo de compras y recepción en bodega.

---

#### GATE 6: Cost & Pricing Intelligence (Landed Cost & Precios Dinámicos)
- **Objetivo:** Calcular con precisión contable el costo real puesto en bodega (*Landed Cost*) y rentabilidad de ventas.
- **Alcance:** Prorrateo de aranceles aduaneros, fletes internacionales y seguros sobre el costo unitario de compra; costeo por identificación específica para seriales y promedio ponderado para stock fungible; alertas de margen mínimo de seguridad.
- **Dependencias:** GATE 5.
- **Funcionalidades a Preservar:** Desglose financiero `IncomeRecord` e `IncomeDistribution`.
- **Modelos Involucrados:** `LandedCostAllocation`, `CostLayer`, `IncomeRecord`.
- **Endpoints:** `/api/v1/admin/costing/landed-cost/`, `/api/v1/admin/pricing/margins/`.
- **Interfaces:** Calculadora Bento de Landed Cost y reporte de márgenes por marca.
- **Riesgos:** Alteración retroactiva de órdenes de venta pasadas.
- **Pruebas Obligatorias:** Aserción matemática de prorrateo por peso y valor CIF; blindaje de operaciones históricas cerradas.
- **Entregables:** Módulo de costeo landed y reporte contable de margen bruto real.
- **Definition of Done (DoD):** El costo unitario de un micrófono importado incluye exactamente su porción de flete aéreo e internación aduanera.
- **Criterio de Aceptación del Propietario:** Validación contable de las fórmulas de prorrateo.

---

#### GATE 7: Order Management System (OMS, Ventas Manuales & Desacoplamiento)
- **Objetivo:** Optimizar el centro de operaciones comerciales y de despacho.
- **Alcance:** Desacoplamiento de estados comerciales, de cobro y logísticos; creación de ventas manuales (Draft Orders) por ejecutivos; generador de enlaces de pago para WhatsApp; gestión formal de devoluciones y reembolsos (RMA) con reingreso a stock condicionado a inspección.
- **Dependencias:** GATE 4.
- **Funcionalidades a Preservar:** Ciclo de pago de pasarelas (Mercado Pago, PayPal, Ualá, Transferencias).
- **Modelos Involucrados:** `orders.Order`, `orders.OrderItem`, `DraftOrder`, `ReturnMerchandiseAuthorization`.
- **Endpoints:** `/api/v1/admin/orders/manual/`, `/api/v1/admin/orders/:id/rma/`.
- **Interfaces:** `AdminOrders` (vista Kanban y tabla de alta densidad), detalle de orden expandido.
- **Riesgos:** Doble deducción de stock en órdenes manuales.
- **Pruebas Obligatorias:** Flujo de orden asistida, generación de enlace WhatsApp y restitución de inventario en RMA.
- **Entregables:** Panel OMS Bento, creador de órdenes manuales y módulo de devoluciones.
- **Definition of Done (DoD):** Un ejecutivo crea una cotización telefónica, genera un enlace corto de pago y el stock queda reservado temporalmente.
- **Criterio de Aceptación del Propietario:** Aprobación del flujo de ventas manuales y gestión de pedidos.

---

#### GATE 8: CRM & B2B Management (Ficha 360°, Cotizaciones PDF & Crédito)
- **Objetivo:** Profesionalizar la atención comercial para estudios, productoras y clientes recurrentes.
- **Alcance:** Ficha 360° del Cliente Técnico (perfil de estudio, DAW, microfonía, notas internas); cotizador mayorista B2B con generación de PDF formal con membrete y validez legal; gestión de crédito comercial (términos Net-15/30, límites autorizados y alertas de mora).
- **Dependencias:** GATE 7.
- **Funcionalidades a Preservar:** Formulario público `/b2b`, modelo `B2BQuote` y perfiles de usuario.
- **Modelos Involucrados:** `users.User`, `orders.B2BQuote`, `CustomerProfile`, `CommercialCreditAccount`.
- **Endpoints:** `/api/v1/admin/crm/customers/:id/360/`, `/api/v1/admin/b2b/quotes/:id/pdf/`.
- **Interfaces:** `AdminUsers` evolucionado a CRM Técnico, visor de cotizaciones B2B.
- **Riesgos:** Exposición de notas privadas de soporte o concesión de crédito sin respaldo.
- **Pruebas Obligatorias:** Generación de PDF en ReportLab, validación de RUT/CUIT y límites de crédito.
- **Entregables:** Ficha técnica 360°, generador de PDF B2B y control de crédito mayorista.
- **Definition of Done (DoD):** Es posible emitir una cotización B2B formal en PDF en menos de 60 segundos y enviarla al cliente con un clic.
- **Criterio de Aceptación del Propietario:** Aprobación del diseño del PDF y ficha 360°.

---

#### GATE 9: Financial Management (Conciliación, Tesorería, DTE & Flujo de Caja)
- **Objetivo:** Consolidar la salud contable y tributaria de la empresa sin mezclar monedas.
- **Alcance:** Bandeja Bento de conciliación de transferencias bancarias con previsualizador de comprobante y aprobación en 1 clic; registro asistido de folios del SII (Boleta/Factura) con esquema API-ready; cuentas por cobrar y pagar; proyección de flujo de caja por moneda (CLP/USD/ARS).
- **Dependencias:** GATE 6, GATE 7 y GATE 8.
- **Funcionalidades a Preservar:** Cuentas bancarias `BankAccount`, modelo `TributaryDocument`, desglose `IncomeRecord`.
- **Modelos Involucrados:** `billing.TributaryDocument`, `payments.BankAccount`, `payments.Payment`, `CashFlowProjection`.
- **Endpoints:** `/api/v1/admin/finance/reconciliation/`, `/api/v1/admin/finance/cash-flow/`.
- **Interfaces:** `AdminFinance`, bandeja de conciliación rápida de transferencias.
- **Riesgos:** Mezcla de saldos cambiarios o aprobación de transferencias sin respaldo.
- **Pruebas Obligatorias:** Invariantes multi-moneda (CLP, USD, ARS independientes sin suma cruzada FX) y auditoría de comprobantes.
- **Entregables:** Módulo financiero completo, bandeja de conciliación y exportador contable.
- **Definition of Done (DoD):** El contador concilia una transferencia bancaria revisando el comprobante en pantalla y el pedido se marca pagado instantáneamente.
- **Criterio de Aceptación del Propietario:** Validación de la segregación de cuentas bancarias y reportes contables.

---

#### GATE 10: Logistics & After-Sales (Couriers, Guías, RMA & Garantías)
- **Objetivo:** Automatizar la entrega física de productos y el servicio posventa.
- **Alcance:** Integración con transportistas locales (Chilexpress, Starken) para generación de guías y etiquetas de despacho; impresión de manifiestos diarios de retiro; seguimiento automatizado con notificaciones al cliente; módulo de garantías de hardware respaldado en números de serie.
- **Dependencias:** GATE 4 y GATE 7.
- **Funcionalidades a Preservar:** Endpoint `/api/v1/shipping/estimate/`, políticas legales `/envios` y `/garantia`.
- **Modelos Involucrados:** `orders.Order`, `products.SerialNumberTrack`, `ShippingManifest`, `WarrantyClaim`.
- **Endpoints:** `/api/v1/admin/logistics/manifests/`, `/api/v1/admin/logistics/labels/`.
- **Interfaces:** `AdminLogistics`, centro de despacho y mesa de servicio técnico.
- **Riesgos:** Errores en peso volumétrico que generen sobrecostos de flete.
- **Pruebas Obligatorias:** Simulación de emisión de guías de despacho y verificación de números de seguimiento.
- **Entregables:** Centro logístico Bento, generador de manifiestos y validador de garantías.
- **Definition of Done (DoD):** El bodeguero imprime el manifiesto del día con todos los bultos empaquetados y sus números de guía para entregar al transportista.
- **Criterio de Aceptación del Propietario:** Aprobación del manifiesto de despacho y flujo de posventa.

---

#### GATE 11: Marketing & Customer Growth (Rewards, Fidelización, Cupones & Carritos)
- **Objetivo:** Potenciar la recurrencia de compra y la lealtad de la comunidad de audio.
- **Alcance:** Motor de cupones de descuento con reglas estrictas de moneda y fecha; promociones programadas con activación automática; recuperación de carritos abandonados mediante notificaciones automatizadas; optimización de los módulos existentes de LevelPro Loyalty y LevelPro Rewards.
- **Dependencias:** GATE 7.
- **Funcionalidades a Preservar:** Sistema de puntos `LoyaltyAccount`, campañas de sorteos `rewards.Campaign` y compra de stickers.
- **Modelos Involucrados:** `loyalty.*`, `rewards.*`, `Coupon`, `AbandonedCartTrigger`.
- **Endpoints:** `/api/v1/admin/marketing/coupons/`, `/api/v1/admin/marketing/abandoned-carts/`.
- **Interfaces:** `AdminLoyalty`, `AdminRewards`, panel de cupones y automatizaciones.
- **Riesgos:** Cupones que erosionen el margen mínimo de ganancia sin control.
- **Pruebas Obligatorias:** Pruebas de validación de cupones, prevención de canjes duplicados y límites por moneda.
- **Entregables:** Módulo de cupones, automatizador de carritos abandonados y optimizaciones de fidelización.
- **Definition of Done (DoD):** Un cupón de 10% en USD solo puede ser utilizado en órdenes cuya moneda de cobro sea USD y no aplica a productos con descuento previo si está bloqueado.
- **Criterio de Aceptación del Propietario:** Aprobación de las reglas de cupones y campañas de fidelización.

---

#### GATE 12: Website & Content Management (CMS Bento, Hero, Banners & Versiones)
- **Objetivo:** Proveer control total y visual de la tienda pública al equipo comercial sin tocar código.
- **Alcance:** CMS Editorial Bento para edición de Hero Slider (imágenes desktop/mobile, textos, botones); barra de anuncios comerciales programable; banners destacados por categoría; gestión de borradores y publicación con versiones y rollback; optimización de metadatos SEO dinámicos.
- **Dependencias:** GATE 1.
- **Funcionalidades a Preservar:** Modelo `site_settings.SiteSettings`, generación dinámica de `sitemap.xml` en `apps.seo`.
- **Modelos Involucrados:** `site_settings.SiteSettings`, `CMSBanner`, `CMSVersion`.
- **Endpoints:** `/api/v1/site-settings/`, `/api/v1/admin/cms/banners/`.
- **Interfaces:** `AdminSettings` evolucionado a CMS visual con previsualización en vivo.
- **Riesgos:** Rotura visual en la tienda pública por carga de imágenes con dimensiones no optimizadas.
- **Pruebas Obligatorias:** Pruebas de renderizado responsive, persistencia de banners y validación de tipos de imagen.
- **Entregables:** CMS visual Bento, control de versiones de contenido y gestor de anuncios.
- **Definition of Done (DoD):** El equipo de marketing programa el banner del Black Friday como borrador y lo publica con un clic cambiando el home al instante.
- **Criterio de Aceptación del Propietario:** Aprobación del editor visual y previsualizador.

---

#### GATE 13: Admin Experience (Unificación Global Bento UI & Responsive 320px-4K)
- **Objetivo:** Unificar toda la suite administrativa bajo una sola experiencia visual impecable y ergonómica.
- **Alcance:** Integración del sistema de diseño Editorial Bento en la totalidad de los paneles; barra de comandos global (`CommandPalette / Cmd+K`) con búsqueda instantánea de órdenes, clientes, SKUs y números de serie; responsive garantizado desde 320px hasta 4K; paleta oficial `#0B0E14` con acento `#1AFF6E` y tipografías Geist / Geist Mono.
- **Dependencias:** Gates 1 al 12.
- **Funcionalidades a Preservar:** Todas las vistas operativas construidas en gates anteriores.
- **Modelos Involucrados:** Componentes frontend en `frontend/src/components/admin/ui/`.
- **Endpoints:** Búsqueda unificada `/api/v1/admin/search/global/`.
- **Interfaces:** 100% de la suite `/admin/*`.
- **Riesgos:** Degradación de usabilidad en dispositivos móviles o pantallas compactas.
- **Pruebas Obligatorias:** Auditoría visual y de accesibilidad (WCAG 2.1 AA), linteo ESLint en 0, pruebas de renderizado en 320px, 390px, 768px, 1280px y 4K.
- **Entregables:** Biblioteca de componentes Bento unificada, layout maestro y Command Palette.
- **Definition of Done (DoD):** Un administrador puede navegar, buscar y operar cualquier módulo del sistema fluidamente desde su teléfono móvil o monitor 4K.
- **Criterio de Aceptación del Propietario:** Aprobación visual definitiva de la suite administrativa.

---

#### GATE 14: Ecosystem & Business Intelligence (SoundMap Hub, BI & Analítica)
- **Objetivo:** Consolidar la inteligencia comercial y la integración profunda con la comunidad de creadores de audio.
- **Alcance:** Dashboard ejecutivo con métricas de capital inmovilizado, rotación de existencias (DSI), margen por marca y categoría; embudo de conversión nativo; profundización de la integración con SoundMap (sincronización de credenciales, tokens SSO y eventos de audio assets).
- **Dependencias:** Gates 6, 7 y 9.
- **Funcionalidades a Preservar:** SSO SoundMap en `apps.users.sso_soundmap`, endpoints de audio assets y webhooks.
- **Modelos Involucrados:** `analytics.*`, `users.User`, `IntegrationsHub`.
- **Endpoints:** `/api/v1/admin/analytics/turnover/`, `/api/v1/integrations/soundmap/`.
- **Interfaces:** `AdminDashboard` con widgets Bento analíticos, Hub de Integraciones.
- **Riesgos:** Lentitud en consultas analíticas complejas sobre PostgreSQL.
- **Pruebas Obligatorias:** Pruebas de optimización de queries SQL con `EXPLAIN ANALYZE` y validación de webhooks firmados de SoundMap.
- **Entregables:** Módulo de Business Intelligence, centro de métricas y hub SoundMap.
- **Definition of Done (DoD):** El dashboard muestra en tiempo real los 5 productos con mayor margen neto y alerta sobre SKUs con más de 90 días inmovilizados.
- **Criterio de Aceptación del Propietario:** Validación de los indicadores comerciales de BI.

---

#### GATE 15: Enterprise Release & Certification (Hardening, QA Final & Despliegue)
- **Objetivo:** Certificar la máxima robustez tecnológica y desplegar LEVELPRO OS V4.0 en producción sin disrupción.
- **Alcance:** Ejecución de la suite completa de pruebas de regresión (backend y frontend); pruebas de carga y estrés concurrentes en Cloud Run; auditoría de seguridad OWASP Top 10; validación en entorno de Staging con usuarios clave; despliegue controlado en producción con migraciones desacopladas y monitoreo en Cloud Logging.
- **Dependencias:** Gates 1 al 14.
- **Funcionalidades a Preservar:** 100% de la plataforma comercial y administrativa.
- **Modelos Involucrados:** Los 43 modelos base más los modelos extendidos de V4.0.
- **Endpoints:** Totalidad de la API REST.
- **Interfaces:** Tienda pública y suite administrativa completa.
- **Riesgos:** Caídas de servicio o bloqueos de base de datos durante el despliegue.
- **Pruebas Obligatorias:** 100% de pruebas unitarias, de integración, de concurrencia y de navegador pasando con éxito.
- **Entregables:** Informe final de certificación de calidad, manual operativo de usuario, etiqueta Git `v4.0.0-release` en `main`.
- **Definition of Done (DoD):** Cero errores en logs de Cloud Run, cero regresiones y plataforma 100% operativa en producción.
- **Criterio de Aceptación del Propietario:** Firma formal de aceptación de entrega y cierre exitoso del proyecto.

---

### 3. Protocolo de Transición entre Compuertas

Cada compuerta del roadmap maestro debe operar bajo la siguiente disciplina:
1. **Inicio Controlado:** Solo se inicia un Gate tras la aprobación formal del informe de la compuerta anterior.
2. **Desarrollo en Rama Local:** Cada gate se implementa en una rama dedicada `feature/v4-gate<N>`.
3. **Certificación de Pruebas:** Ejecución obligatoria de la suite completa antes del merge.
4. **Detención Formal:** Al finalizar el alcance del Gate, el equipo se detiene y presenta el informe de salida al propietario.
