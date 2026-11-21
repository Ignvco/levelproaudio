# LEVELPRO OS V4.0 — GATE 0.1
## 06. Roadmap Técnico Revisado y Estructura de Compuertas de Implementación

**Documento:** `docs/v4/gate0.1/06-revised-roadmap.md`  
**Versión:** 4.0.0-gate0.1  
**Fecha de Certificación:** Noviembre 2026  
**Líderes de Planificación:** Enterprise Product Manager & Lead Systems Architect  
**Estrategia de Ejecución:** Modelo de compuertas secuenciales con subgates atómicos y criterios de salida verificables.

---

### 1. Filosofía de Implementación por Compuertas

La evolución hacia **LEVELPRO OS V4.0** no admite saltos improvisados ni mezclas de responsabilidades. Cada compuerta debe ser formalmente auditada, probada y certificada antes de habilitar el inicio de la siguiente:

```
[ GATE 0.1 ] Rectificación Técnica, Línea Base y Certificación (ESTADO ACTUAL)
     │
     ▼ (Aprobación Formal del Propietario)
[ GATE 1 ] Business Core: Modelos ERP, Proveedores, Inventario, Seriales, Compras y RBAC
     │
     ▼ (Certificación de Migraciones y Pruebas Unitarias Backend)
[ GATE 2 ] Commerce & Admin Experience: Layout Bento V4, Pedidos, Ventas Manuales y Responsive
     │
     ▼ (Certificación de Interfaz, Usabilidad y Pruebas Frontend)
[ GATE 3 ] Business Operations: Landed Cost, CRM Técnico 360°, B2B, Finanzas, Logística y CMS
     │
     ▼ (Validación End-to-End y Pruebas Transaccionales Multi-Moneda)
[ GATE 4 ] Release & Certification: Hardening, Seguridad OWASP, Staging y Despliegue en Producción
```

---

### 2. Desglose Detallado de Compuertas y Subgates

#### GATE 0.1: Rectificación y Certificación Técnica (FASE ACTUAL)
- **Estado:** En ejecución y cierre documental.
- **Entregables:** 9 documentos rectificados en `docs/v4/gate0.1/` y artefacto maestro.
- **Criterio de Salida:** Aprobación explícita de la dirección sobre las Decisiones de Arquitectura (ADRs) y el Backlog Extendido.

---

#### GATE 1: Business Core (Backend & Data Layer)
- **Objetivo:** Construir la base relacional, de permisos y transaccional del ERP sin tocar producción.
- **Subgates:**
  - **Subgate 1.1 (RBAC & Seguridad):** Clases modulares de permisos en `core/admin_permissions.py` (Super Admin, Bodega, Ventas, Finanzas, Soporte) con restricción a nivel de campo y acción.
  - **Subgate 1.2 (Proveedores & Productos M2M):** App `apps/procurement/` con modelos `Supplier`, `ProductSupplier` y `SupplierPriceHistory`.
  - **Subgate 1.3 (Inventario Dimensional & Kardex):** Modelos `Warehouse`, `WarehouseStock` y el diario inmutable de movimientos `InventoryMovement`.
  - **Subgate 1.4 (Trazabilidad de Seriales en 3 Modos):** Modelo `SerialNumberTrack` con modalidades `NONE`, `OPTIONAL` y `REQUIRED`, y llaves protegidas (`models.PROTECT`).
  - **Subgate 1.5 (Compras & Recepción Física):** Modelos `PurchaseOrder` y `GoodsReceipt` desacoplados, con soporte de recepciones parciales y control de daños.
  - **Subgate 1.6 (Costos Históricos y Capas):** Implementación de costo por serial (identificación específica) y costo promedio ponderado para stock general.
- **Criterio de Salida Gate 1:** 100% de pruebas unitarias pasando en contenedor QA con PostgreSQL 16; migraciones sin locks comprobadas en entorno de prueba.

---

#### GATE 2: Commerce & Admin Experience (Frontend UI/UX)
- **Objetivo:** Unificar la interfaz del administrador bajo el sistema de diseño Editorial Bento, logrando la agilidad operativa de Tiendanube y la potencia de Shopify.
- **Subgates:**
  - **Subgate 2.1 (Editorial Bento Layout):** Layout principal con navegación adaptable (Sidebar colapsable de alta densidad, paleta `#0B0E14` / `#1AFF6E` y tipografías Geist / Geist Mono).
  - **Subgate 2.2 (Desacoplamiento Pedido/Pago):** Refactorización de vistas de orden para gestionar ciclo comercial y logístico independientemente de las transacciones de pasarela.
  - **Subgate 2.3 (Ventas Manuales & WhatsApp):** Interfaz para creación rápida de pedidos asistidos por ejecutivos y generador de enlaces de checkout para WhatsApp.
  - **Subgate 2.4 (Gestor de Catálogo Avanzado):** Soporte para variantes de producto, panel de edición masiva de precios por lote e importador/exportador CSV/Excel.
  - **Subgate 2.5 (Bento Responsive & Command Palette):** Adaptación perfecta para pantallas desde 320px hasta 4K y barra de búsqueda global instantánea con `Cmd+K`.
- **Criterio de Salida Gate 2:** Certificación de componentes con Node Test Runner y pruebas de navegación en múltiples resoluciones; cero advertencias de accesibilidad y ESLint en 0.

---

#### GATE 3: Business Operations (Módulos Especializados)
- **Objetivo:** Conectar las operaciones avanzadas del negocio de audio profesional.
- **Subgates:**
  - **Subgate 3.1 (Landed Cost Definitivo):** Módulo interactivo de prorrateo de aranceles de aduana, fletes y seguros al costo unitario del producto recibido.
  - **Subgate 3.2 (CRM Técnico & Perfil de Estudio):** Ficha 360° del cliente con inventario de equipamiento que posee, DAW preferido, notas técnicas e historial de compras/cursos.
  - **Subgate 3.3 (Ventas B2B & Cotizador en PDF):** Generador de propuestas comerciales con membrete oficial LevelPro, cálculo de impuestos y conversión a orden en 1 clic.
  - **Subgate 3.4 (Finanzas & Conciliación Asistida):** Bandeja Bento de transferencias bancarias con previsualizador de comprobante y aprobación/rechazo en un clic.
  - **Subgate 3.5 (Logística & Despacho con Couriers):** Integración de generación de etiquetas de transporte (Chilexpress/Starken), manifiestos diarios y seguimiento por guía.
  - **Subgate 3.6 (Marketing, Cupones & Carritos):** Motor de cupones con reglas de moneda, automatización de promociones y recuperación de carritos abandonados.
  - **Subgate 3.7 (CMS Bento & Versiones):** Editor visual de banners, Hero Slider y anuncios con estados borrador/publicado.
  - **Subgate 3.8 (Inteligencia Comercial & Alertas):** KPIs Bento de rotación de inventario (DSI), alertas de quiebre de stock y rentabilidad por marca.
- **Criterio de Salida Gate 3:** Flujo completo de compra internacional, recepción en bodega, costeo landed, serialización, venta mayorista y conciliación financiera completado sin inconsistencias.

---

#### GATE 4: Release & Certification (Hardening y Producción)
- **Objetivo:** Certificar la robustez del sistema y desplegarlo de forma segura en producción.
- **Subgates:**
  - **Subgate 4.1 (Suite Integral de Regresión):** Ejecución automatizada de las 827 pruebas de backend en PostgreSQL 16 y 100 pruebas de frontend.
  - **Subgate 4.2 (Pruebas de Carga y Concurrencia):** Simulación de tráfico concurrente con transacciones atómicas y bloqueos en base de datos.
  - **Subgate 4.3 (Auditoría de Seguridad OWASP & RBAC):** Verificación de inmutabilidad del log de auditoría, prevención de escalada de privilegios y protección de comprobantes bancarios.
  - **Subgate 4.4 (Despliegue en Staging):** Validación funcional con usuarios clave (equipo de bodega, ventas y finanzas).
  - **Subgate 4.5 (Despliegue en Producción):** Despliegue con monitoreo en Cloud Logging, desacoplando migraciones del CMD del contenedor para evitar colisiones.
- **Criterio de Salida Gate 4:** Aprobación formal de entrega por parte del propietario de LevelPro Audio y versión etiquetada `v4.0.0-release` en la rama `main`.

---

### 3. Estimaciones de Tiempo y Compromisos

Los plazos finales estarán sujetos a la definición de alcance acordada tras Gate 0.1:
- **Gate 0.1:** Fase actual (Concluida con esta entrega documental).
- **Gate 1:** Estimado 3 a 4 semanas.
- **Gate 2:** Estimado 3 a 4 semanas.
- **Gate 3:** Estimado 4 a 5 semanas.
- **Gate 4:** Estimado 2 semanas.
