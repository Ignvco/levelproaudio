# LEVELPRO OS V4.0 — GATE 0
## 03. Arquitectura Propuesta: LEVELPRO OS V4.0 — Business Management System

**Documento:** `docs/v4/gate0/03-arquitectura-propuesta.md`  
**Versión:** 4.0.0-gate0  
**Fecha de Certificación:** Noviembre 2026  
**Autor:** Senior Enterprise Software Architect & UX/UI Director  
**Filosofía de Diseño:** Editorial Bento System (Dark `#0B0E14`, Neon `#1AFF6E`, Tipografías Geist y Geist Mono)  
**Alcance:** Evolución sin disrupción de la suite administrativa actual hacia un Business Management System de audio profesional.

---

### 1. Principios Arquitectónicos Innegociables

1. **Evolución Aditiva, No Reescritura:** Se aprovechan el 100% de los modelos Django existentes (`Order`, `Product`, `Payment`, `IncomeRecord`, `CustomUser`, etc.) y los componentes React ya certificados. No se destruye ninguna API ni endpoint en producción.
2. **Preservación Estricta de la Identidad Visual:** El diseño Bento de alta densidad, bordes refinados con sutiles gradientes, tipografía Geist Sans para títulos y Geist Mono para valores numéricos, SKUs y métricas, y acentos verde oficial `#1AFF6E` continúan siendo la firma visual inconfundible.
3. **Aislamiento Multi-Moneda Inviolable:** Cada módulo financiero, de compras, inventario y facturación opera respetando la segregación estricta entre CLP (Pesos Chilenos), USD (Dólares) y ARS (Pesos Argentinos). Cero conversiones implícitas o saldos mixtos.
4. **Desacoplamiento Operativo:** Las operaciones críticas (descuento de stock, registro de pagos, emisión de boletas) se mantienen protegidas mediante transacciones atómicas de base de datos e idempotencia criptográfica.

---

### 2. Estructura de Navegación y Bento Layout V4.0

La nueva interfaz administrativa se estructura bajo un layout modular tipo Bento, con una barra de navegación lateral colapsable de alta densidad (`AdminSidebarV4`), un encabezado con selector de moneda contable activa y búsqueda global instantánea (`CommandPalette / Cmd+K`), y un contenedor central que renderiza tarjetas Bento interactivas:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ LEVELPRO OS V4.0  [🔎 Cmd+K Buscar...]       [Moneda: CLP ▼] [Admin Pro ▼]  │
├───────────────┬─────────────────────────────────────────────────────────────┤
│ 📊 Dashboard  │  [ BENTO GRID 12 COLUMNAS ]                                 │
│ 📦 Pedidos    │  ┌───────────────────────────┬───────────────────────────┐  │
│ 🏷️ Catálogo   │  │ KPI 1: Ventas Netas HOY   │ KPI 2: Margen Bruto Op.   │  │
│ 🏭 Compras    │  │ $14.850.000 CLP (+18.4%)  │ 34.2% (CLP) | 41.0% (USD) │  │
│ 💼 Ventas B2B │  ├───────────────────────────┴───────────────────────────┤  │
│ 👥 CRM        │  │ GRÁFICO BENTO CENTRAL (Ingresos vs Costos de Ventas) │  │
│ 💳 Finanzas   │  ├───────────────────────────┬───────────────────────────┤  │
│ 🚚 Logística  │  │ Órdenes Críticas Despacho │ Alertas de Stock Bajo     │  │
│ 🎓 Academia   │  │ 6 órdenes pendientes guía │ 4 SKUs < 2 unidades       │  │
│ 🎁 Marketing  │  └───────────────────────────┴───────────────────────────┘  │
│ 🌐 Sitio Web  │                                                             │
│ ⚙️ Ajustes   │                                                             │
│ 🛡️ Auditoría  │                                                             │
└───────────────┴─────────────────────────────────────────────────────────────┘
```

---

### 3. Especificación Técnica de los 13 Módulos de LEVELPRO OS V4.0

#### Módulo 1: Resumen Ejecutivo (Executive Bento Dashboard)
- **Ruta:** `/admin` (index)
- **Funcionalidad:** Vista panorámica del negocio en tiempo real. Métricas de ventas netas, ticket promedio, margen bruto acumulado por moneda seleccionada (CLP/USD/ARS), pedidos pendientes de despacho, stock crítico y actividad de usuarios en vivo.
- **Widgets Bento:**
  - *RadialStatCard:* Rendimiento mensual de ventas vs meta proyectada.
  - *CurrencyBreakdownCard:* Ingresos segregados sin mezclar tasas.
  - *QuickActionsBar:* Crear cotización rápida, ingresar recepción de compra, ajustar stock manual.

#### Módulo 2: Pedidos y Operaciones (Order Management System - OMS)
- **Ruta:** `/admin/orders`
- **Funcionalidad:** Control total del flujo de órdenes B2C y B2B. Vista tipo Kanban y vista tabular con filtros avanzados (estado, método de pago, transportista, rango de fechas).
- **Detalle de Pedido Extendido:**
  - Snapshot de ítems, precios congelados e impuestos.
  - Trazabilidad de pago (ID de transacción Transbank/Mercado Pago/Stripe).
  - Generación de guía de despacho con courier asignado.
  - Enlace al documento tributario emitido (Boleta/Factura).
  - Bitácora de cambios de estado con autor y timestamp.

#### Módulo 3: Inventario y Catálogo Maestro (PIM & WMS)
- **Ruta:** `/admin/inventory` y `/admin/products`
- **Funcionalidad:** Gestión centralizada de productos simples, kits (bundles) y servicios asociados.
- **Novedades V4.0:**
  - *Serial Number Tracking:* Registro de números de serie individuales al recibir mercadería y asignación al momento del despacho.
  - *Multi-Location Inventory:* Soporte inicial para Bodega Central (Santiago) y Bodega de Tránsito / Eventos.
  - *Calculador de Margen en Catálogo:* Alerta visual si el precio de venta baja del margen objetivo de la marca.
  - *Gestor de Fichas Técnicas:* Edición visual de especificaciones de audio pro (Respuesta en frecuencia, SPL máximo, Impedancia, Patrón polar).

#### Módulo 4: Compras y Proveedores (Procurement & Landed Cost)
- **Ruta:** `/admin/procurement` *(Nuevo Módulo V4.0)*
- **Funcionalidad:**
  - Registro de marcas y distribuidores mayoristas (Directos: Shure, Sennheiser, Yamaha, Neumann).
  - Creación y seguimiento de Órdenes de Compra (Purchase Orders - PO).
  - *Landed Cost Calculator:* Registro de costos adicionales de importación (Flete internacional, aranceles aduaneros, seguro de carga) y prorrateo automático al costo unitario del producto (`cost_price`).
  - Recepción de mercadería con control de diferencias (cantidades pedidas vs recibidas).

#### Módulo 5: Ventas B2B y Cotizaciones Mayoristas
- **Ruta:** `/admin/b2b`
- **Funcionalidad:** Administración de solicitudes de cotización para productoras de eventos, canales de televisión, teatros y estudios de grabación.
- **Novedades V4.0:**
  - Generador de PDF formal de cotización con validez legal y membrete LevelPro.
  - Conversión a orden de compra con bloqueo de inventario preventivo.
  - Descuentos escalonados por volumen de compra pre-configurados.

#### Módulo 6: Clientes y CRM Técnico (Customer 360°)
- **Ruta:** `/admin/users`
- **Funcionalidad:** Perfil unificado del cliente enfocado en audio profesional.
- **Ficha 360° del Cliente:**
  - Datos de contacto, RUT / DNI y razón social para facturación.
  - Perfil de Estudio: tipo de equipamiento que posee (home studio, estudio comercial, sonidista en vivo).
  - Historial consolidado: hardware comprado, cursos tomados en la Academia, servicios agendados.
  - Saldo acumulado de puntos Loyalty y tickets en campañas de Rewards.

#### Módulo 7: Finanzas y Documentos Tributarios (ERP Finance)
- **Ruta:** `/admin/finance` y `/admin/billing`
- **Funcionalidad:** Consolidación contable sin mezclar monedas.
- **Capacidades:**
  - Asignación de márgenes brutos por venta (`IncomeRecord`).
  - Conciliación de transferencias bancarias: previsualización del comprobante adjunto y aprobación/rechazo en un clic.
  - Registro y verificación de folios SII (Boleta electrónica / Factura electrónica).
  - Reporte de exportación CSV/Excel para software contable externo (Defontana, Nubox, ERP local).

#### Módulo 8: Logística y Envíos (Fulfillment Center)
- **Ruta:** `/admin/logistics` *(Evolución de `/admin/shipping`)*
- **Funcionalidad:** Despacho nacional e internacional.
- **Capacidades:**
  - Selector de couriers certificados (Chilexpress, Starken, Blue Express).
  - Impresión de manifiesto de entrega diario para retiro de transporte.
  - Notificaciones automáticas por correo electrónico al cliente con número de seguimiento en tiempo real.

#### Módulo 9: Academia y Servicios Profesionales
- **Ruta:** `/admin/academy` y `/admin/services`
- **Funcionalidad:** Gestión integral de productos digitales y servicios en terreno.
- **Capacidades:**
  - Creador de cursos con lecciones en video, quizzes y subida de sesiones DAW (Pro Tools, Ableton, Logic).
  - Administración de inscripciones y progreso de estudiantes.
  - Calendario de agendamiento de consultorías acústicas y calibración de sistemas line array.

#### Módulo 10: Marketing, Fidelización y Rewards
- **Ruta:** `/admin/loyalty` y `/admin/rewards`
- **Funcionalidad:** Retención de clientes y activaciones promocionales.
- **Capacidades:**
  - Configuración de campañas de puntos Loyalty (multiplicadores por compra).
  - Creación de campañas de sorteos (Rewards): asignación de tickets según monto de compra, fecha límite y motor de sorteo aleatorio criptográficamente verificable.
  - Integración con SoundMap: administración de cupones para usuarios verificados en SoundMap.

#### Módulo 11: Personalización Web y Contenidos (CMS Bento)
- **Ruta:** `/admin/settings` (Sección Contenido)
- **Funcionalidad:** Control visual de la tienda pública sin tocar código.
- **Capacidades:**
  - Gestor de Hero Slider (imágenes desktop/mobile, botones, textos).
  - Barra de anuncios urgentes (envíos gratis, promociones bancarias).
  - Banners promocionales Bento para páginas de aterrizaje.
  - Metadatos SEO y palabras clave por categoría de audio.

#### Módulo 12: Configuración del Sistema y Multi-Moneda
- **Ruta:** `/admin/settings` (Sección Sistema)
- **Funcionalidad:** Switches de configuración global.
- **Capacidades:**
  - Activación/desactivación de pasarelas de pago (Webpay, Mercado Pago, Ualá Bis, PayPal, Stripe).
  - Configuración de cuentas bancarias receptoras de transferencias (CLP / ARS).
  - Configuración de impuestos locales (IVA 19% Chile, retenciones).

#### Módulo 13: Seguridad, Auditoría y Trazabilidad (Audit Trail)
- **Ruta:** `/admin/audit` *(Nuevo Módulo V4.0)*
- **Funcionalidad:** Registro inmutable de actividades administrativas para cumplimiento de seguridad.
- **Capacidades:**
  - Bitácora de accesos y cambios críticos (modificación de precios, cancelaciones de órdenes, ajustes manuales de stock, asignación de reembolsos).
  - Control de roles basados en atributos (RBAC): Administrador General, Operador de Bodega, Finanzas/Contador, Soporte al Cliente.

---

### 4. Diagrama de Relaciones del Ecosistema V4.0

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│    Supplier     │──────▶│  PurchaseOrder  │──────▶│ SerialNumberTrack│
│  (Distribuidores│       │  (Órdenes de    │       │ (Números de     │
│   de Audio Pro) │       │   Compra / PO)  │       │  Serie Unitarios│
└─────────────────┘       └─────────────────┘       └────────┬────────┘
                                                             │
┌─────────────────┐       ┌─────────────────┐                │
│    CustomUser   │──────▶│      Order      │◀───────────────┘
│  (Clientes Pro  │       │  (Órdenes B2C   │
│   y Productores)│       │   y B2B)        │───────┐
└────────┬────────┘       └────────┬────────┘       │
         │                         │                ▼
         ▼                         ▼        ┌─────────────────┐
┌─────────────────┐       ┌─────────────────┐│TributaryDocument│
│ LoyaltyProfile  │       │  IncomeRecord   ││ (Boleta /       │
│ & RewardsEntry  │       │(Margen Real CLP/││  Factura SII)   │
└─────────────────┘       │    USD / ARS)   │└─────────────────┘
                          └─────────────────┘
```
