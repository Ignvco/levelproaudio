# LEVELPRO OS V4.0 — GATE 0.1
## 04. Propuesta de Decisiones Arquitectónicas Estructurales (ADRs)

**Documento:** `docs/v4/gate0.1/04-architecture-decisions.md`  
**Versión:** 4.0.0-gate0.1  
**Fecha de Certificación:** Noviembre 2026  
**Autores:** Enterprise Architect, Lead Database Designer & ERP Specialist  
**Estado:** **PROPUESTA TÉCNICA FORMALIZADA — EN ESPERA DE APROBACIÓN PARA GATE 1**

---

### 1. ADR-01: Modelo de Proveedores y Relación Muchos a Muchos con Productos

#### Contexto y Problema
Actualmente, el modelo `Product` solo contiene un campo escalar `cost_price`. No existe entidad para representar proveedores o distribuidores oficiales de audio (ej. Shure Chile, Sennheiser Latam, Focusrite Pro). En la industria del sonido profesional, un mismo micrófono o interfaz puede ser adquirido a diferentes proveedores con distintos costos, monedas (USD/CLP), plazos de entrega y mínimos de compra.

#### Decisión Propuesta
1. Crear el modelo `Supplier` en una nueva app `apps/procurement/`.
2. Establecer una relación Muchos a Muchos entre `Product` y `Supplier` a través de una tabla intermedia enriquecida `ProductSupplier`:
   ```python
   class ProductSupplier(TimeStampedModel):
       product = models.ForeignKey("products.Product", on_delete=models.CASCADE, related_name="supplier_links")
       supplier = models.ForeignKey("Supplier", on_delete=models.CASCADE, related_name="supplied_products")
       supplier_sku = models.CharField(max_length=100, blank=True, help_text="Código del producto en el catálogo del proveedor")
       cost_price = models.DecimalField(max_digits=12, decimal_places=2, help_text="Costo base de lista con este proveedor")
       currency = models.CharField(max_length=10, choices=[("USD", "USD"), ("CLP", "CLP"), ("ARS", "ARS")])
       lead_time_days = models.PositiveIntegerField(default=7, help_text="Días estimados de entrega")
       min_order_qty = models.PositiveIntegerField(default=1, help_text="Cantidad mínima de compra (MOQ)")
       is_preferred = models.BooleanField(default=False, help_text="Proveedor preferente para este producto")
       source_url = models.URLField(blank=True, help_text="Enlace al portal B2B del proveedor")
       last_synced_at = models.DateTimeField(null=True, blank=True)

       class Meta:
           unique_together = ("product", "supplier")
           verbose_name = "Proveedor de Producto"
   ```
3. Crear `SupplierPriceHistory` para auditar la evolución de precios de compra en el tiempo.
4. **Regla Innegociable:** No duplicar registros en `Product` para el mismo equipo físico. Un solo `Product` se conecta con múltiples proveedores.

---

### 2. ADR-02: Inventario de Fuente Única, Dimensiones de Stock y Kardex

#### Contexto y Problema
El modelo actual posee `stock = PositiveIntegerField(default=0)`. Este enfoque plano impide distinguir entre lo que está físicamente en bodega, lo que ya está comprometido en un pedido pagado pero no despachado, lo que viene en camino en una orden de compra y el stock externo del distribuidor.

#### Decisión Propuesta
1. Diseñar una arquitectura de inventario dimensional con las siguientes variables:
   - **Stock Físico (On-Hand):** Unidades reales presentes en los almacenes.
   - **Stock Reservado (Allocated):** Unidades comprometidas en pedidos activos no despachados.
   - **Stock Disponible (Available):** `Stock Físico - Stock Reservado` (la cifra comercializable en tienda).
   - **Stock en Tránsito (Inbound):** Unidades adquiridas en Órdenes de Compra en camino.
   - **Stock de Proveedor (Dropship/Virtual):** Disponibilidad externa confirmada por distribuidores.
2. Soporte para múltiples bodegas (`Warehouse` y `WarehouseStock`): Bodega Central (Santiago), Showroom y Tránsito.
3. **Kardex Inmutable (`InventoryMovement`):** Todo cambio en el stock físico debe ser respaldado por un movimiento inmutable con tipo de transacción:
   - `RECEIPT_PO` (Recepción de compra)
   - `SALE_OUT` (Despacho a cliente)
   - `SALE_RETURN` (Devolución por cliente)
   - `TRANSFER` (Entre bodegas)
   - `ADJUSTMENT_POS` (Ajuste por conteo positivo)
   - `ADJUSTMENT_NEG` (Ajuste por merma/pérdida)
   - `DAMAGE` (Equipo dañado)
4. **Transición Compatible:** Durante la transición, `Product.stock` reflejará el stock disponible calculado atómicamente, garantizando compatibilidad hacia atrás con el checkout y catálogo sin doble contabilización.

---

### 3. ADR-03: Trazabilidad de Números de Serie (3 Modalidades)

#### Contexto y Problema
El documento original de Gate 0 propuso un umbral arbitrario de \$200 USD para serializar productos. Esto es inviable en la práctica: existen accesorios críticos de alto valor que no tienen número de serie, y micrófonos de medición acústica de \$150 USD que sí requieren serialización estricta por calibración de fábrica.

#### Decisión Propuesta
1. Descartar el umbral fijo de \$200 USD.
2. Implementar tres modalidades de serialización:
   - `NONE`: No requiere número de serie (cables, conectores, merchandising, consumibles).
   - `OPTIONAL`: El operador puede registrar el número de serie si lo desea.
   - `REQUIRED`: Obligatorio registrar el número de serie al recibir en bodega y al despachar al cliente.
3. La política se define a nivel de `Category` y puede ser sobreescrita individualmente en `Product.serialization_mode`.
4. **Protección Histórica de Datos:**
   - La tabla `SerialNumberTrack` utilizará `models.PROTECT` en sus relaciones con `Order` y `User`.
   - **Prohibido el borrado físico (`CASCADE`)** de seriales que hayan tenido movimientos históricos.
5. **Regla de Unicidad:** `unique_together = ("product", "serial_number")` para permitir el mismo serial en diferentes fabricantes si coincidiera el formato.
6. **No Retroactividad:** No se inventarán números de serie ficticios para ventas históricas anteriores a V4.0.

---

### 4. ADR-04: Separación Estricta entre Orden de Compra y Recepción Física

#### Contexto y Problema
En sistemas ERP deficientes, emitir una Orden de Compra incrementa erróneamente el stock físico, o recibir mercadería incompleta bloquea todo el proceso contable.

#### Decisión Propuesta
1. Separar formalmente el documento comercial (`PurchaseOrder`) de la recepción física (`GoodsReceipt`).
2. Una `PurchaseOrder` emitida **NUNCA incrementa el stock físico**. Solo actualiza el stock en tránsito.
3. El incremento de existencias ocurre exclusivamente al registrar una `GoodsReceipt` confirmada por el operador de bodega.
4. Soporte nativo para:
   - Recepciones parciales (ej. se pidieron 10 consolas, llegaron 4 hoy y 6 la próxima semana).
   - Registro de diferencias (cantidades facturadas vs recibidas).
   - Control de productos dañados en transporte (asignados a estado `damaged` sin entrar al inventario disponible).
5. Las recepciones deben ser atómicas, trazables con usuario responsable e idempotentes.

---

### 5. ADR-05: Capas de Costos Históricos y Metodología de Valuación

#### Contexto y Problema
`Product.cost_price` es solo un campo escalar estático. Usarlo como costo histórico distorsiona la contabilidad, ya que no refleja la inflación de compras pasadas, las variaciones del tipo de cambio ni los costos de importación de cada lote específico.

#### Decisión Propuesta
1. No utilizar `Product.cost_price` como único registro histórico de costos.
2. Implementar capas de costo (*Cost Layers*):
   - **Para Hardware Serializado:** Método de **Identificación Específica**. Cada número de serie almacena su costo de adquisición exacto más su landed cost prorrateado (`landed_cost_actual`).
   - **Para Productos No Serializados:** Método de **Costo Promedio Ponderado (CPP)** o FIFO configurable.
3. Diferenciación estricta de métricas financieras:
   - *Costo de Adquisición:* Precio facturado por el proveedor extranjero o local.
   - *Landed Cost Estimado:* Proyección de flete y aduana previa al arribo.
   - *Landed Cost Confirmado:* Costo final liquidado tras pagar aranceles y flete real.
   - *Costo de Mercancía Vendida (COGS):* Costo real congelado al momento del despacho del pedido.
   - *Margen Bruto Real:* `Precio Neto Venta - COGS Real`.
   - *Impuestos Recuperables vs No Recuperables:* Distinción entre IVA crédito fiscal (recuperable) y aranceles de importación (costo directo).

---

### 6. ADR-06: Documentación Tributaria Asistida y Arquitectura API Ready

#### Contexto y Problema
La integración con el Servicio de Impuestos Internos (SII) de Chile requiere certificados digitales, firma XML en formato XML-DTE y timbraje electrónico complejo. En la etapa actual, la empresa emite sus facturas directamente en el portal web del SII.

#### Decisión Propuesta
1. **Mantener el flujo asistido actual:** El administrador genera la venta en LevelPro OS, emite la factura/boleta en el portal del SII, e ingresa en el sistema el número de folio y PDF correspondiente en `TributaryDocument`.
2. **Arquitectura API-Ready:** Diseñar la estructura de datos compatible con el estándar DTE (esquema `generate_sii_dte_payload` existente en `apps/billing/shipping_and_tax.py:65`) para que en una compuerta futura pueda conectarse un conector de facturación electrónica por API sin alterar el modelo relacional.
3. Diferenciar con claridad en la interfaz los comprobantes internos de venta de los Documentos Tributarios Electrónicos (DTE) formalmente emitidos y validados ante el ente fiscal.
