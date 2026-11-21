# LEVELPRO OS V4.0 — GATE 1.2 FINAL ACCEPTANCE
## 02. Eventos Críticos, Taxonomía Tripartita y Consistencia Transaccional

**Documento Rector:** `docs/v4/gate1/audit-trail/final-acceptance/02-critical-events-and-transactional-consistency.md`  
**Rama Local:** `feature/v4-gate1-business-core`  
**Estado:** Certificado y Homologado

---

### 1. Taxonomía de Eventos de Auditoría (3 Clases)

Para resolver definitivamente el dilema entre consistencia estricta (fail-closed) y resiliencia de la experiencia del cliente (fail-safe), se formaliza la siguiente clasificación arquitectónica:

```
┌────────────────────────────────────────────────────────────────────────┐
│               TAXONOMÍA OPERACIONAL DE EVENTOS AUDITABLES              │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [CLASE 1: OBLIGATORIA & FAIL-CLOSED]                                  │
│  • Mutaciones manuales de administradores (Precios, Costos, Stock)     │
│  • Aprobación / Rechazo manual de pagos por Staff                      │
│  • Retiros de fondos y distribuciones financieras                      │
│  • Asignación, revocación o escalación de Roles RBAC                   │
│  • Creación y carga de documentos tributarios SII                      │
│  • Modificación de configuración crítica del sitio                     │
│  → Garantía: mandatory=True. Si falla auditoría, ROLLBACK TOTAL.       │
│                                                                        │
│  [CLASE 2: ASÍNCRONA, DURABLE & RECUPERABLE]                           │
│  • Webhooks entrantes de pasarelas (MercadoPago, Ualá, PayPal)         │
│  • Señales automáticas de sistema (post_save update_order_status)      │
│  • Notificaciones y transiciones automáticas en background             │
│  → Garantía: No bloquea el cobro al cliente. Registra alerta crítica    │
│    (logger.critical / Sentry) con order_id y metadatos forenses.       │
│                                                                        │
│  [CLASE 3: TELEMETRÍA Y CONSULTAS]                                     │
│  • Consultas de solo lectura en dashboard                              │
│  • Visualizaciones de catálogo público                                 │
│  → Garantía: Best-effort. Sin impacto transaccional.                   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 2. Mapeo Exhaustivo de Endpoints y Operaciones

| Módulo | Operación | Clase | Política Transaccional | Severidad |
|---|---|---|---|---|
| **Catálogo** | Creación / Edición de Producto | Clase 1 | `mandatory=True`, `@transaction.atomic` | `INFO` / `WARNING` |
| **Catálogo** | Cambio de Precio / Costo | Clase 1 | `mandatory=True`, `@transaction.atomic` | `WARNING` |
| **Inventario** | Ajuste manual de Stock | Clase 1 | `mandatory=True`, `@transaction.atomic` | `WARNING` |
| **Órdenes** | Transición de Estado de Pedido | Clase 1 | `mandatory=True`, `@transaction.atomic` | `INFO` / `WARNING` |
| **Pagos** | Aprobación / Rechazo manual | Clase 1 | `mandatory=True`, `@transaction.atomic` | `WARNING` |
| **Pagos** | Configuración de Cuentas Bancarias | Clase 1 | `mandatory=True`, `@transaction.atomic` | `WARNING` |
| **Finanzas** | Ejecución de Retiro de Fondos | Clase 1 | `mandatory=True`, `@transaction.atomic` | `CRITICAL` |
| **Billing** | Emisión / Actualización Doc SII | Clase 1 | `mandatory=True`, `atomic()` | `INFO` |
| **Billing** | Carga de PDF Tributario | Clase 1 | `mandatory=True`, `atomic()` | `INFO` |
| **Roles** | Asignación / Revocación de Rol | Clase 1 | `mandatory=True`, `@transaction.atomic` | `CRITICAL` |
| **Settings** | Modificación de Configuración | Clase 1 | `mandatory=True`, `atomic()` | `WARNING` |
| **Pagos** | Webhook MercadoPago / Ualá | Clase 2 | Durable en `PaymentWebhookEvent`, `logger.critical` | `INFO` / `CRITICAL` |
| **Pagos** | Señal `update_order_status` | Clase 2 | Alerta estructurada `AUDIT_ALERT_CRITICAL` | `INFO` / `CRITICAL` |
| **Auditoría** | Exportación de Registros CSV | Clase 2 | Registro explícito con `logger.error` fallback | `WARNING` |

---

### 3. Mecanismo de Garantía Fail-Closed

En los eventos Clase 1, `record_audit_event()` opera directamente dentro del contexto transaccional activo:

```python
@transaction.atomic
def perform_update(self, serializer):
    instance = serializer.save()
    # Si la inserción en audit_events falla por cualquier causa (disparador, BD, disco, etc.),
    # record_audit_event lanza excepción, interrumpiendo el flujo y provocando el ROLLBACK
    # atómico de la mutación de negocio en instance.
    record_audit_event(
        module="finances",
        action="BANK_ACCOUNT_UPDATED",
        event_category=CATEGORY_CONFIG_CHANGE,
        resource_type="BankAccount",
        resource_id=str(instance.id),
        resource_repr=f"Cuenta {instance.bank_name} {instance.account_number}",
        actor=self.request.user,
        new_values={"bank": instance.bank_name, "is_active": instance.is_active},
        mandatory=True,
    )
```

### 4. Evidencia de Prueba de Inyección de Fallos

Se implementó el test automatizado `test_audit_mandatory_failure_rolls_back_business_mutation`:

```python
def test_audit_mandatory_failure_rolls_back_business_mutation(self):
    self.client.force_authenticate(user=self.management_user)
    initial_price = self.product.price

    # Inyección de fallo simulado en el motor de auditoría
    with patch("apps.analytics.views.record_audit_event", side_effect=RuntimeError("Fallo inducido en auditoría")):
        resp = self.client.patch(
            f"/api/v1/admin/products/{self.product.id}/",
            {"price": "999999.00"},
            format="json",
        )
        # La API retorna HTTP 500 y aborta la transacción
        self.assertEqual(resp.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Verificación en base de datos: el precio original no cambió
    self.product.refresh_from_db()
    self.assertEqual(self.product.price, initial_price)
```

**Resultado:** Aprobado en ejecución automatizada de pytest. Garantía fail-closed 100% acreditada.
