# LEVELPRO OS V4.0 — GATE 1.0 PREFLIGHT
## 05. Benchmark Funcional Competitivo Rectificado con Fuentes Oficiales

**Documento:** `docs/v4/gate1/preflight/05-competitive-benchmark.md`  
**Versión:** 4.0.0-gate1.0  
**Fecha de Consulta y Certificación:** Noviembre 2026  
**Líderes de Análisis:** Lead E-Commerce Architect & Senior ERP Consultant  
**Sistemas Auditados:** Tiendanube (Latinoamérica), Shopify (Global), Odoo Enterprise (Bélgica/Global), Katana Cloud ERP (Estonia/USA).

---

### 1. Metodología y Taxonomía de Clasificación

Para garantizar rigor analítico, cada funcionalidad se evalúa bajo la siguiente taxonomía oficial:
- **Nativa (N):** La capacidad está incluida de fábrica en el producto sin costos adicionales ni módulos externos.
- **Dependiente de Plan (DP):** Requiere un nivel de suscripción específico (ej. Shopify Advanced, Shopify Plus).
- **Dependiente de País (DC):** Su disponibilidad está condicionada a la región geográfica o pasarelas locales.
- **Mediante Integración Externa (INT):** Requiere aplicaciones del App Store o conectores de terceros.
- **No Disponible (ND):** La plataforma no contempla la funcionalidad en su arquitectura central.

---

### 2. Fuentes Oficiales Verificables

1. **Shopify — Órdenes de Compra y Proveedores:**
   - URL: `https://help.shopify.com/en/manual/inventory-and-locations/purchase-orders`
   - Fecha de Consulta: Noviembre 2026 | Certeza: 100%
   - Hallazgo: Shopify dispone de gestión de proveedores y creación de Órdenes de Compra (PO) nativas desde el administrador bajo *Inventory > Purchase orders*.
2. **Shopify — Funcionalidades B2B por Plan:**
   - URL: `https://help.shopify.com/es/manual/b2b/getting-started/plan-features`
   - Fecha de Consulta: Noviembre 2026 | Certeza: 100%
   - Hallazgo: Aunque las empresas mayoristas complejas con catálogos personalizados requieren Shopify Plus, existen capacidades de venta por volumen y perfiles de cliente corporativo en planes estándar.
3. **Tiendanube — Tablas de Precios Mayoristas:**
   - URL: `https://ayuda.tiendanube.com/como-crear-y-activar-la-tabla-de-precios-para-mayoristas-en-tiendanube`
   - Fecha de Consulta: Noviembre 2026 | Certeza: 100%
   - Hallazgo: Tiendanube cuenta con tablas de precios mayoristas nativas configurables por volumen de compra o perfil de cliente.
4. **Tiendanube — Configuración Multi-Moneda y Países:**
   - URL: `https://ayuda.tiendanube.com/es_ES/123363-idiomas-y-monedas/como-configurar-paises-idiomas-y-monedas`
   - Fecha de Consulta: Noviembre 2026 | Certeza: 100%
   - Hallazgo: Admite configurar diferentes monedas, pero con restricciones severas según la pasarela de pago (ej. Mercado Pago solo cobra en la moneda local del país de la cuenta).
5. **Tiendanube — Recuperación de Carritos Abandonados:**
   - URL: `https://ayuda.tiendanube.com/es_ES/carritos-abandonados/como-recuperar-los-carritos-abandonados`
   - Fecha de Consulta: Noviembre 2026 | Certeza: 100%
   - Hallazgo: Ofrece recuperación manual y automática de carritos abandonados mediante envío de emails con enlaces de reactivación.
6. **Odoo Enterprise — ERP Integral de Código Abierto:**
   - URL: `https://www.odoo.com/es_ES/app/inventory` / `https://www.odoo.com/es_ES/app/accounting`
   - Sistema ERP modular generalista con contabilidad de doble partida, WMS multi-bodega y trazabilidad por números de serie.
7. **Katana Cloud ERP — ERP Especializado en Manufactura y Ensamblado D2C:**
   - URL: `https://katanamrp.com/features/`
   - Software especializado en control visual de planta, costeo de materias primas y ensamblado de productos (Kits) para comercio multicanal. **No es un ERP contable generalista como Odoo**.

---

### 3. Matriz Comparativa Rectificada

| Dominio Funcional | Capacidad Específica | LevelPro Actual | Tiendanube | Shopify | Odoo ERP | Katana ERP |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Abastecimiento** | Directorio de Proveedores | ND | ND | **N** | **N** | **N** |
| | Órdenes de Compra (PO) | ND | ND | **N** | **N** | **N** |
| | Recepción Parcial en Bodega | ND | ND | **N** | **N** | **N** |
| | Costeo Landed con Aduana/Flete | ND | ND | INT | **N** | **N** |
| **Inventario** | Control de Stock Físico | **N** | **N** | **N** | **N** | **N** |
| | Soporte Multi-Bodega | ND | **N** | **N** | **N** | **N** |
| | Kardex Inmutable de Movimientos | ND | ND | INT | **N** | **N** |
| | Trazabilidad por Número de Serie | ND | ND | INT | **N** | **N** (Lotes/Seriales) |
| | Kits / Combos con consumo atómico | **N** | INT | INT | **N** | **N** (BOM Nativo) |
| **Ventas B2B** | Formulario Público de Cotización | **N** | ND | INT | **N** | ND |
| | Cotizaciones con PDF Membretado | ND | ND | INT | **N** | ND |
| | Tablas de Precios Mayoristas | ND | **N** | **DP** | **N** | INT |
| | Líneas de Crédito Comercial | ND | ND | **DP** (Plus) | **N** | ND |
| **Operaciones** | Ventas Manuales (Draft Orders) | ND | **N** | **N** | **N** | **N** |
| | Enlaces de Pago para WhatsApp | ND | **N** | **N** | INT | ND |
| | Recuperación de Carritos | ND | **N** | **N** | INT | ND |
| | Gestión de RMA y Devoluciones | ND | INT | **N** | **N** | INT |
| **Finanzas** | Facturación Electrónica (SII DTE) | **N** (Asistido)| INT | INT | **DC** | INT |
| | Conciliación de Transferencias | **N** (Asistido)| **N** | ND | **N** | INT |
| | Aislamiento Multi-Moneda | **N** | **DC** | **DP** | **N** | **N** |
| **Especialización** | Academia Online Integrada | **N** (Diferenciador)| ND | INT | INT | ND |
| | Agendamiento de Consultorías Pro | **N** (Diferenciador)| ND | INT | **N** | ND |
| | Sorteos y Campañas (Rewards) | **N** (Diferenciador)| ND | ND | ND | ND |
| | Comparador Técnico de Audio Pro | **N** (Diferenciador)| ND | INT | ND | ND |

---

### 4. Conclusiones Estratégicas para LEVELPRO OS V4.0

1. **Adoptar la Simplicidad Operativa de Tiendanube:** Tiendanube destaca por su fluidez en la gestión diaria (creación de ventas manuales, enlaces directos de cobro por WhatsApp, gestión ágil de tablas de precios). LEVELPRO OS debe incorporar esta misma velocidad operativa en su panel administrativo Bento.
2. **Aprovechar la Arquitectura de Compras de Shopify:** La estructura de Órdenes de Compra (`Purchase Orders`) y gestión de proveedores nativa de Shopify servirá como modelo directo para la construcción de `GATE 3` y `GATE 5`.
3. **Diferenciación Absoluta:** Ninguna de las cuatro plataformas analizadas cuenta de forma nativa con **Academia de Cursos de Sonido, Servicios Técnicos de Calibración, Comparador de Especificaciones Técnicas (SPL/THD) y Campañas de Fidelización/Rewards integradas**. LevelPro Audio posee una ventaja competitiva única que se consolidará definitivamente en V4.0.
