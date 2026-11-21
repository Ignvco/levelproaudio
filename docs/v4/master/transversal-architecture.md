# LEVELPRO OS V4.0 — CONTRATOS DE ARQUITECTURA TRANSVERSAL
## Estándares Técnicos Innegociables para Todos los Gates

**Documento:** `docs/v4/master/transversal-architecture.md`  
**Versión:** 4.0.0-master  
**Fecha de Emisión:** Noviembre 2026  
**Líderes de Arquitectura:** Senior Enterprise Architect & Lead Database Designer  
**Alcance:** Definición de contratos técnicos obligatorios que rigen el diseño e implementación de los 15 gates de LEVELPRO OS V4.0.

---

### 1. Contrato Transversal de Inventario

1. **Fuente Única de Verdad Dimensional:**
   El stock de un producto o variante no puede ser un único entero plano. Se define formalmente la ecuación de inventario:
   $$\text{Stock Disponible} = \text{Stock Físico (On-Hand)} - \text{Stock Reservado (Allocated)}$$
   $$\text{Stock Total Proyectado} = \text{Stock Disponible} + \text{Stock en Tránsito (Inbound)}$$
2. **Reconciliación de Deducciones al Crear Pedidos Pendientes:**
   - En el sistema actual, `Product.stock` se deduce al crear una orden en `PENDING`.
   - El motor dimensional identificará y aislará estas deducciones como **Stock Reservado** con un Time-To-Live (TTL de 60 minutos para pasarelas online y 48 horas para transferencias bancarias).
   - Si la orden no se paga dentro del TTL o pasa a `CANCELLED`, el stock reservado se libera atómicamente retornando al stock disponible.
   - **Prohibición de Doble Descuento:** Ninguna transición de estado de pedido (ej. de `PENDING` a `PAID`) volverá a descontar existencias físicas si ya fueron reservadas en el checkout.
3. **Kits, Combos y Bundles (`BundleItem`):**
   - Los kits no tienen stock físico propio. Su disponibilidad se calcula atómicamente a partir del menor stock disponible de sus componentes multiplicado por la cantidad requerida.
   - Al comprar un kit, se descuenta/reserva el stock individual de cada componente.
4. **Preórdenes y Venta Bajo Pedido:**
   - Productos marcados como `preorder` u `on_demand` no alteran el stock físico disponible para despacho inmediato, pero registran la demanda para generar órdenes de compra consolidadas en `GATE 5`.
5. **Separación de Estados Físicos de Existencias:**
   - `available`: Apta para venta inmediata.
   - `reserved`: Comprometida en pedidos pendientes o pagados.
   - `damaged`: Mercadería dañada en transporte o bodega, aislada de la venta.
   - `quarantine`: Equipos en inspección técnica, control de calidad o recepción pendiente.
6. **Kardex Inmutable:**
   - Prohibido modificar directamente el campo de stock físico mediante `UPDATE products_product SET stock = X`.
   - Todo cambio debe originarse mediante un registro inmutable en `InventoryMovement` con tipo, cantidad, bodega, usuario responsable y timestamp.

---

### 2. Contrato Transversal de Catálogo

1. **Jerarquía SKU Comercial vs Variante Almacenable:**
   - El producto base (`Product`) conserva la identidad pública, título, marca, descripción técnica, slug SEO, imágenes principales y categorización.
   - Si el producto posee variantes (ej. Audífonos Beyerdynamic DT 770 Pro de 32Ω, 80Ω y 250Ω), cada variante (`ProductVariant`) posee su propio SKU unívoco, código de barras EAN/UPC y existencias por bodega.
2. **Prohibición de Duplicación por Proveedor:**
   - Un mismo equipo de audio comercializado por LevelPro tiene **una única ficha de catálogo** en la tienda pública, independientemente de que existan 3 distribuidores internacionales que lo suministren.
   - Los distintos proveedores se vinculan a través de `ProductSupplier` en la capa de abastecimiento.
3. **Preservación de Activos Históricos y SEO:**
   - Las URLs públicas (`/shop/:slug`), la indexación en Google, los enlaces cruzados de la Academia, los productos en kits y las compras pasadas no pueden romperse ni cambiar de ID primario.

---

### 3. Contrato Transversal de Proveedores

1. **Relación Muchos a Muchos Enriquecida:**
   - La tabla intermedia `ProductSupplier` almacena la relación entre `Product` y `Supplier`.
   - Contempla: `supplier_sku`, `cost_price`, `currency` (USD/CLP/ARS), `lead_time_days`, `min_order_qty` (MOQ), `discount_terms` y `is_preferred`.
2. **Preservación Histórica ante Desactivación:**
   - Cuando un distribuidor deja de operar con LevelPro, su registro se marca como `is_active=False`.
   - **Prohibido el borrado físico (`CASCADE`)**: Todas las órdenes de compra pasadas, facturas de proveedor y recepciones en bodega conservan su enlace íntegro con el proveedor inactivo.
3. **Diferenciación de Precios:**
   - Queda estrictamente diferenciado el **costo mayorista de lista de proveedor** (informado por fábrica), el **costo neto de compra negociado** (en la PO) y el **costo landed definitivo** (tras nacionalización).

---

### 4. Contrato Transversal de Costos y Valuación

1. **Capas de Costo (Cost Layers) y No Dependencia de `Product.cost_price`:**
   - `Product.cost_price` es un atributo de referencia de catálogo, no un registro contable de existencias.
2. **Metodologías de Valuación:**
   - **Hardware Serializado (`REQUIRED`):** Método de **Identificación Específica**. Cada número de serie (`SerialNumberTrack`) almacena su costo de adquisición exacto más su landed cost prorrateado.
   - **Existencias Fungibles No Serializadas:** Método de **Costo Promedio Ponderado (CPP)** calculado en cada recepción de compra confirmada.
3. **Inmutabilidad y Snapshots en Ventas:**
   - Al momento de confirmarse el pago y despacharse una orden de venta, el Costo de Mercancía Vendida (COGS) se congela en un snapshot inmutable en `OrderItem`.
   - El margen bruto de la venta se calcula como:
     $$\text{Margen Bruto Real} = \text{Precio Neto Venta} - \text{COGS Snapshot}$$
4. **Trazabilidad de Conversiones Cambiarias:**
   - Toda conversión financiera debe registrar obligatoriamente: moneda origen, moneda destino, importe origen, importe destino, tasa cambiaria aplicada, fuente de la tasa (ej. Banco Central de Chile, Dólar Oficial BNA), fecha y usuario responsable.

---

### 5. Contrato Transversal de Compras y Recepciones

1. **Desacoplamiento Estricto entre Orden Comercial y Recepción Física:**
   - La emisión de una `PurchaseOrder` es un compromiso comercial de compra. **No altera el stock físico bajo ninguna circunstancia**. Solo actualiza el stock en tránsito (*Inbound*).
2. **Recepción Física Atómica (`GoodsReceipt`):**
   - El incremento del stock físico en bodega ocurre única y exclusivamente cuando el operador confirma un documento `GoodsReceipt`.
   - Cada recepción genera entradas en el Kardex y registra los números de serie escaneados en estado `in_stock`.
3. **Gestión de Discrepancias:**
   - El sistema admite recepciones parciales (`PARTIALLY_RECEIVED`), registrando la diferencia pendiente contra la PO original.
   - Mercadería dañada en transporte se recepciona con estado `damaged` y genera automáticamente una solicitud de reclamo o nota de crédito al transportista/proveedor, sin entrar al inventario disponible para la venta.

---

### 6. Contrato Transversal de Manejo de Moneda y Precisión Numérica

1. **Segregación Estricta Multi-Moneda:**
   - Ninguna consulta SQL ni función contable puede sumar importes sin agrupar previamente por `currency`.
   - Se prohíbe la consolidación implícita de saldos CLP, USD y ARS en una sola cifra sin tasa documentada.
2. **Precisión Numérica en Base de Datos:**
   - Prohibido el uso de tipos de coma flotante (`float`) para montos de dinero o costos.
   - Todos los campos monetarios utilizan `DecimalField(max_digits=12, decimal_places=2)` o `DecimalField(max_digits=14, decimal_places=4)` para tasas y costos unitarios de importación.
   - El redondeo contable utiliza la convención bancaria estándar `ROUND_HALF_UP`.
