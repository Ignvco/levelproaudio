# LEVELPRO OS V4.0 — GATE 0
## 02. Benchmark Funcional Competitivo: LevelPro vs Tiendanube, Shopify y ERPs Modernos

**Documento:** `docs/v4/gate0/02-benchmark-tiendanube-shopify.md`  
**Versión:** 4.0.0-gate0  
**Fecha de Certificación:** Noviembre 2026  
**Analistas:** Lead E-Commerce Architect, Product Manager & ERP Specialist  
**Sistemas de Referencia:** Tiendanube (Latinoamérica), Shopify Plus (Global), Odoo / Katana Cloud ERP (Especializados en Fabricación e Industria Técnica).

---

### 1. Metodología de Evaluación y Criterios de Clasificación

Para fundamentar la transición hacia **LEVELPRO OS V4.0**, se evaluó la plataforma actual frente a las mejores prácticas de la industria de comercio electrónico y software de gestión empresarial (ERP), clasificando cada capacidad bajo cuatro estados inmutables:

1. **Implementada y Verificada (IV):** La funcionalidad existe en el código, cuenta con interfaz gráfica de usuario y está respaldada por pruebas automatizadas y validación en producción.
2. **Implementada Parcialmente (IP):** La funcionalidad cuenta con backend activo o UI básica, pero carece de completitud en flujos operativos avanzados.
3. **Implementada sin Validación (ISV):** El código o endpoint existe, pero no ha sido sometido a pruebas automatizadas continuas ni validación de estrés operativo.
4. **No Implementada (NI):** La capacidad no existe actualmente en el repositorio ni en la base de datos.

---

### 2. Matriz Comparativa de Capacidades Comerciales y de Gestión

| Área Funcional / Módulo | Capacidad Específica | LevelPro Actual | Tiendanube | Shopify | Modern ERP (Odoo/Katana) | Estado LevelPro |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Gestión de Pedidos** | Creación y ciclo de vida de pedidos | Sí | Sí | Sí | Sí | **IV** |
| | Cancelaciones y reembolsos con retorno de stock | Sí | Sí | Sí | Sí | **IV** |
| | Subestados logísticos personalizados | No | Sí | Sí | Sí | **IP** |
| | Edición de pedidos post-pago | No | Limitado | Sí | Sí | **NI** |
| **Pagos y Moneda** | Cobro multi-moneda aislado (CLP, USD, ARS) | Sí | No (Moneda única) | Sí (Shopify Markets) | Sí (Multi-Ledger) | **IV** |
| | Webhooks asíncronos con idempotencia | Sí | Sí | Sí | Sí | **IV** |
| | Transferencias con conciliación asistida | Sí | Sí | No | Sí | **IV** |
| **Inventario** | Stock centralizado en tiempo real | Sí | Sí | Sí | Sí | **IV** |
| | Multi-bodega / sucursales físicas | No | Sí | Sí | Sí | **NI** |
| | Trazabilidad por Número de Serie (Audio Pro) | No | No | Con Apps | Nativo | **NI** |
| | Alertas de stock crítico configurable | Sí | Sí | Sí | Sí | **IV** |
| | Reservas de stock temporales en checkout | Parcial | No | Con Scripts | Sí | **IP** |
| **Catálogo y Kits** | Productos simples y variantes básicas | Sí | Sí | Sí | Sí | **IV** |
| | Kits / Bundles con cálculo de ahorro | Sí | Con Apps | Con Apps | Nativo | **IV** |
| | Fichas técnicas avanzadas de sonido (SPL, THD) | Sí | No | No | No | **IV** (Diferenciador) |
| | Comparador técnico multiproducto | Sí | No | Con Apps | No | **IV** |
| **Compras y Proveedores** | Órdenes de Compra (PO) a fábricas/marcas | No | No | No | Nativo | **NI** |
| | Gestión de proveedores y contactos comerciales | No | No | Limitado | Nativo | **NI** |
| | Cálculo de Costeo Landed (Flete + Aduana) | No | No | No | Nativo | **NI** |
| | Recepción parcial de mercadería con control de calidad | No | No | No | Nativo | **NI** |
| **Ventas B2B** | Formulario público de cotización mayorista | Sí | No | Solo Plus | Nativo | **IV** |
| | Conversión de Cotización B2B a Orden en 1 clic | Sí | No | Solo Plus | Nativo | **IV** |
| | Lista de precios mayoristas por volumen | No | No | Solo Plus | Nativo | **NI** |
| | Términos de pago a crédito (Net-30 / Net-60) | No | No | Solo Plus | Nativo | **NI** |
| **CRM y Clientes** | Registro de clientes y direcciones de despacho | Sí | Sí | Sí | Sí | **IV** |
| | Historial consolidado de pedidos y facturas | Sí | Sí | Sí | Sí | **IV** |
| | Segmentación RFM y Lifetime Value (CLV) | No | Limitado | Sí | Sí | **NI** |
| | Notas internas y bitácora de interacciones | No | Sí | Sí | Sí | **NI** |
| **Finanzas y Tributación** | Registro de documentos tributarios (SII DTE) | Sí | Con Apps | Con Apps | Con Módulos Locales| **IV** |
| | Asignación de margen bruto por orden | Sí | No | No | Nativo | **IV** |
| | Conciliación bancaria multi-moneda | Parcial | No | Con Apps | Nativo | **IP** |
| **Educación y Servicios**| Cursos online integrados en el mismo ecosistema | Sí | No | Con Apps | Con Apps | **IV** (Diferenciador) |
| | Agendamiento de consultorías técnicas | Sí | No | Con Apps | Con Apps | **IV** (Diferenciador) |
| | Programa de Lealtad (Loyalty Points) | Sí | Con Apps | Con Apps | Nativo | **IV** |
| | Sorteos y Campañas Comerciales (Rewards) | Sí | No | No | No | **IV** (Diferenciador) |

---

### 3. Identificación de Brechas Críticas frente a ERPs y Grandes E-Commerce

#### 3.1. Brecha en Inventario Avanzado y Trazabilidad (Audio Pro)
- **Problema Actual:** Un micrófono de alta gama (ej. Neumann U87 de \$3.500 USD) se maneja con el mismo modelo de stock que un cable XLR: un simple entero (`stock = 5`).
- **Riesgo:** Pérdida de trazabilidad de garantías, dificultad en postventa, incapacidad de rastrear qué número de serie específico se vendió a qué cliente o qué producto fue importado en qué embarque.
- **Requerimiento V4.0:** Módulo de trazabilidad de números de serie (`SerialNumberTrack`), asociable a líneas de pedido y boletas/facturas.

#### 3.2. Brecha en Compras, Proveedores y Costeo Landed
- **Problema Actual:** No existe módulo de Órdenes de Compra (PO). El reabastecimiento con distribuidores internacionales (Shure, Sennheiser, Focusrite, Genelec) se gestiona por correo o planillas externas.
- **Riesgo:** Desconexión entre los costos de importación reales (aranceles aduaneros, fletes aéreos/marítimos, seguros) y el margen calculado en `IncomeRecord`.
- **Requerimiento V4.0:** Módulo de Proveedores (`Supplier`), Órdenes de Compra (`PurchaseOrder`) y distribución de costos prorrateados (*Landed Cost*).

#### 3.3. Brecha en Operaciones B2B Mayoristas
- **Problema Actual:** Las cotizaciones B2B existen y pueden convertirse a orden, pero carecen de términos de crédito comercial, límites de crédito para estudios y productoras, y emisión de estados de cuenta periódicos.
- **Requerimiento V4.0:** Panel B2B extendido con perfiles empresariales validados, asignación de crédito autorizado y control de vencimientos.

#### 3.4. Brecha en Inteligencia Comercial y Analítica Financiera
- **Problema Actual:** El módulo `/admin/finance` muestra gráficos excelentes de ingresos y márgenes, pero no proyecta flujo de caja futuro ni analiza rotación de inventario (*Inventory Turnover Rate*) por marca o categoría.
- **Requerimiento V4.0:** Bento de Inteligencia Financiera con métricas de capital inmovilizado en stock, días promedio de inventario (DSI) y rentabilidad por metro cúbico/peso.

#### 3.5. Brecha en Gestión de Clientes (CRM Técnico)
- **Problema Actual:** `/admin/users` lista usuarios pero no proporciona el perfil de equipamiento del cliente (ej. qué consola tiene en su estudio, qué micrófonos ha comprado, si prefiere cursos de mezcla o de mastering).
- **Requerimiento V4.0:** Ficha de Estudio / Cliente Pro con historial unificado de compras de hardware, cursos inscritos, servicios agendados y notas del equipo de soporte.

---

### 4. Conclusión del Benchmark

LevelPro Audio posee una ventaja competitiva radical frente a Tiendanube y Shopify genéricos gracias a sus submódulos de **Academia, Servicios Profesionales, Comparador de Audio Pro y Rewards integrados**. 

Sin embargo, para consolidarse como el software definitivo de gestión empresarial en el rubro del sonido profesional (**LEVELPRO OS V4.0**), debe incorporar las capacidades estructurales de un ERP vertical moderno (Compras, Serialización, Costeo Landed y CRM Técnico), manteniendo estrictamente intacta su arquitectura liviana y su diseño Bento característico.
