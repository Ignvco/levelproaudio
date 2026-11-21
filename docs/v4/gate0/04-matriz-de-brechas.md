# LEVELPRO OS V4.0 — GATE 0
## 04. Matriz de Brechas Técnicas y Operativas (Gap Analysis)

**Documento:** `docs/v4/gate0/04-matriz-de-brechas.md`  
**Versión:** 4.0.0-gate0  
**Fecha de Certificación:** Noviembre 2026  
**Líderes de Evaluación:** Senior Enterprise Architect, Lead QA & Product Manager  
**Objetivo:** Cuantificación rigurosa de las brechas funcionales y técnicas entre el estado actual y LEVELPRO OS V4.0.

---

### 1. Criterios de Evaluación y Calificación

Cada brecha identificada se califica según cuatro dimensiones:
- **Impacto en el Negocio (1 a 5):** Relevancia en ingresos, retención, eficiencia o mitigación de pérdidas.
- **Complejidad Técnica (Baja, Media, Alta):** Dificultad de implementación en backend, frontend y base de datos.
- **Riesgo Arquitectónico (Bajo, Medio, Alto):** Probabilidad de introducir regresiones en flujos existentes.
- **Esfuerzo Estimado (Sprints / Semanas):** Carga de trabajo técnico dentro de la planificación de fases.

---

### 2. Matriz Consolidada de Brechas por Dominio

| ID | Dominio / Módulo | Estado Actual | Estado Objetivo V4.0 | Impacto | Complejidad | Riesgo | Esfuerzo |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **GAP-01** | **Inventario y Trazabilidad** | Stock escalar único (`stock = int`). | Trazabilidad por Número de Serie unitario (`SerialNumberTrack`), soporte de múltiples bodegas y reservas en checkout. | 5/5 | Alta | Medio | 2 sprints |
| **GAP-02** | **Compras y Proveedores (PO)** | Inexistente. Compras gestionadas fuera del sistema. | Módulo de Proveedores (`Supplier`), Órdenes de Compra (`PurchaseOrder`), recepción parcial y cálculo de Costeo Landed. | 5/5 | Alta | Bajo (Aditivo) | 2 sprints |
| **GAP-03** | **Costeo Landed y Márgenes** | Margen calculado sobre costo base fijo (`cost_price`). | Prorrateo dinámico de fletes y aranceles sobre el costo unitario de importación. | 4/5 | Media | Bajo | 1 sprint |
| **GAP-04** | **Ventas B2B y Crédito** | Cotizaciones se convierten a orden con pago inmediato. | Gestión de términos de crédito (Net-15/30), límites autorizados por cliente y estados de cuenta. | 4/5 | Media | Medio | 1.5 sprints|
| **GAP-05** | **CRM y Ficha 360°** | Lista de usuarios básica con historial de órdenes plano. | Perfil técnico de audio pro (equipamiento del cliente), notas de soporte, scoring de cliente y valor de vida (CLV). | 4/5 | Media | Bajo | 1 sprint |
| **GAP-06** | **Navegación Bento Unificada** | Pestañas y menús dispersos en `/admin`. | Layout Editorial Bento de alta densidad, barra lateral colapsable y barra de comandos (`Cmd+K`). | 5/5 | Media | Bajo | 1.5 sprints|
| **GAP-07** | **Logística y Despacho** | Endpoint de cotización con couriers sin impresión de guías. | Generación e impresión de etiquetas de despacho, manifiestos diarios y seguimiento por webhook. | 4/5 | Media | Bajo | 1 sprint |
| **GAP-08** | **Auditoría y Trazabilidad** | Registros de logs en consola de Cloud Run sin UI. | Módulo de auditoría interna (`AuditLog`) con historial visual de cambios de precios, stock y órdenes. | 4/5 | Baja | Bajo | 0.5 sprints|
| **GAP-09** | **Conciliación Financiera** | Conciliación manual de transferencias en lista de pagos. | Bandeja Bento de conciliación rápida con previsualización del comprobante y aprobación en 1 clic. | 4/5 | Baja | Bajo | 0.5 sprints|
| **GAP-10** | **Alertas Proactivas** | Notificación por email básica de orden. | Centro de notificaciones operativas en el panel (Stock crítico, pedidos demorados, cotizaciones por vencer). | 3/5 | Baja | Bajo | 0.5 sprints|

---

### 3. Análisis en Profundidad de las Brechas Críticas

#### GAP-01: Inventario Avanzado y Trazabilidad por Número de Serie
- **Justificación Técnica:** Los equipos de audio profesional de alta gama poseen números de serie obligatorios para validar la garantía internacional del fabricante (ej. Shure, Neumann, Genelec, SSL).
- **Diseño del Modelo:**
  ```python
  class SerialNumberTrack(models.Model):
      product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="serial_numbers")
      serial_number = models.CharField(max_length=120, unique=True, db_index=True)
      status = models.CharField(max_length=20, choices=[
          ('in_stock', 'En Bodega'),
          ('allocated', 'Asignado a Pedido'),
          ('sold', 'Vendido / Despachado'),
          ('rma', 'Garantía / Servicio Técnico'),
      ], default='in_stock')
      order_item = models.ForeignKey(OrderItem, null=True, blank=True, on_delete=models.SET_NULL)
      purchase_order = models.ForeignKey('PurchaseOrder', null=True, blank=True, on_delete=models.SET_NULL)
      created_at = models.DateTimeField(auto_now_add=True)
  ```
- **Compatibilidad:** Para productos menores (cables, conectores, merchandising), el sistema continuará utilizando el stock numérico estándar sin requerir seriales individuales.

#### GAP-02 y GAP-03: Módulo de Compras, Proveedores y Costeo Landed
- **Justificación de Negocio:** La mayor parte del hardware comercializado por LevelPro es importado en USD o adquirido a distribuidores oficiales autorizados. Los costos de transporte aéreo/marítimo y los aranceles aduaneros modifican significativamente el costo real de cada unidad puesta en bodega.
- **Diseño del Modelo:**
  ```python
  class Supplier(models.Model):
      name = models.CharField(max_length=200)
      country = models.CharField(max_length=100)
      currency = models.CharField(max_length=3, choices=[('USD', 'USD'), ('CLP', 'CLP'), ('ARS', 'ARS')])
      contact_email = models.EmailField()
      lead_time_days = models.PositiveIntegerField(default=15)

  class PurchaseOrder(models.Model):
      po_number = models.CharField(max_length=50, unique=True)
      supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT)
      status = models.CharField(max_length=20, choices=[
          ('draft', 'Borrador'),
          ('issued', 'Emitida a Proveedor'),
          ('in_transit', 'En Tránsito / Aduana'),
          ('received', 'Recibida en Bodega'),
          ('cancelled', 'Cancelada'),
      ])
      freight_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
      customs_duty_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
      currency = models.CharField(max_length=3)
  ```

#### GAP-05: Ficha 360° del Cliente (CRM Técnico)
- **Justificación de Conversión:** El cliente de audio profesional es altamente recurrente y busca asesoría técnica personalizada.
- **Componente Visual Bento:**
  - Panel superior con resumen de inversión histórica segregada por moneda.
  - Timeline interactivo con compras de equipamiento, cursos completados, tickets en soporte y agendamientos técnicos.
  - Bloque de equipamiento actual para recomendaciones cruzadas pertinentes (ej. si compró una interfaz Apollo Twin, sugerir plugins DSP o preamplificadores de micrófono compatibles).

---

### 4. Conclusión de la Matriz de Brechas

Ninguna de las brechas identificadas requiere rehacer lo existente. **El 100% de las brechas son de naturaleza aditiva y modular**. Esto confirma la viabilidad arquitectónica de avanzar hacia LEVELPRO OS V4.0 sin riesgos de degradación sobre las operaciones comerciales activas en producción.
