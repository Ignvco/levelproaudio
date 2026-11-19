# LEVELPRO OS V4.0 — GATE 0
## 05. Matriz de Riesgos Críticos, Prevención de Regresiones y Planes de Contingencia

**Documento:** `docs/v4/gate0/05-riesgos-y-regresiones.md`  
**Versión:** 4.0.0-gate0  
**Fecha de Certificación:** Noviembre 2026  
**Líderes de Auditoría:** Senior QA Engineer, Lead Systems Architect & DevOps Director  
**Objetivo:** Identificación preventiva de riesgos arquitectónicos, operacionales y transaccionales para blindar el sistema durante la evolución a LEVELPRO OS V4.0.

---

### 1. Principio de Cero Regresiones (Zero-Regression Policy)

La evolución de la suite administrativa de LevelPro no debe comprometer en ningún momento la disponibilidad (uptime 99.9%), la velocidad de respuesta de la API (<120ms) ni la integridad financiera de la tienda pública. Todo cambio implementado en V4.0 debe cumplir con:
1. Pruebas automatizadas de regresión previas al merge (`pytest` y `vitest`).
2. Despliegue blue/green en GCP Cloud Run con healthchecks de contenedor certificados.
3. Compatibilidad hacia atrás en serializers y esquemas de base de datos.
4. Preservación innegociable del aislamiento contable multi-moneda (CLP / USD / ARS).

---

### 2. Matriz de Riesgos Críticos

| ID | Riesgo Identificado | Probabilidad | Impacto | Nivel de Riesgo | Estrategia de Mitigación V4.0 |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **RSK-01** | **Contaminación Cruzada Multi-Moneda**<br>Mezcla accidental de saldos CLP, USD y ARS en reportes consolidados o en cotizaciones B2B. | Baja | Crítico (5/5) | **Alto** | Filtrado obligatorio por moneda en el backend (`AccountingCurrencySelect`), validación estricta en serializers DRF y tests de aserción monetaria. |
| **RSK-02** | **Fallo de Idempotencia en Webhooks**<br>Re-procesamiento de webhooks de pasarelas (Webpay, MP, Ualá) generando doble deducción de stock. | Muy Baja | Crítico (5/5) | **Medio** | Transacciones atómicas con bloqueo de fila (`select_for_update`), verificación de estado previo `Payment.status == 'approved'` antes de cualquier mutación. |
| **RSK-03** | **Bloqueo de Tablas en Migraciones de PostgreSQL**<br>Adición de llaves foráneas o columnas no nulas sin default en tablas masivas (`orders_order`, `products_product`). | Media | Alto (4/5) | **Medio** | Migraciones en 2 pasos: primero agregar columnas como `null=True`, poblar datos de forma asíncrona y posteriormente aplicar constraints `NOT NULL`. |
| **RSK-04** | **Regresión en Checkout y Transferencias Bancarias**<br>Incompatibilidad con el seeder de cuentas bancarias (`BankAccount`) o alteración del flujo de instrucciones bancarias. | Baja | Alto (4/5) | **Medio** | Preservar el comando `seed_bank_accounts` desacoplado de las migraciones base y ejecutar la suite `test_audit_remediation_v35.py` en cada CI/CD. |
| **RSK-05** | **Sobrecarga Cognitiva y Ruptura del Diseño Bento**<br>Densidad excesiva de información o inserción de componentes no acordes con la estética LevelPro (fondos claros, botones sin contraste). | Media | Medio (3/5) | **Medio** | Auditoría continua de diseño UI con Design System Tokens: fondo `#0B0E14`, acento `#1AFF6E`, Geist Sans / Mono, espaciado modular Bento. |
| **RSK-06** | **Fuga de Información en Roles Administrativos**<br>Personal de bodega o soporte visualizando costos de importación o balances financieros de la empresa. | Baja | Alto (4/5) | **Medio** | Implementación estricta de RBAC granular con decoradores y clases de permisos (`HasFinancialPermission`, `HasInventoryPermission`). |

---

### 3. Protocolos de Mitigación en Detalle

#### 3.1. Salvaguarda de Aislamiento Multi-Moneda
- **Regla de Oro:** Ninguna consulta SQL o función analítica puede calcular `Sum('amount')` sin agrupar previamente por `currency`.
- **Implementación Técnica:**
  ```python
  # Regla arquitectónica en apps/analytics/services.py:
  def get_revenue_summary(period='month'):
      return IncomeRecord.objects.filter(
          created_at__gte=start_date
      ).values('currency').annotate(
          total_revenue=Sum('net_amount'),
          total_cogs=Sum('cost_amount'),
          gross_margin=Sum('margin_amount')
      ).order_by('currency')
  ```
- **Prueba de Blindaje:** Test automatizado que inyecta órdenes simuladas en CLP y USD y verifica que el consolidado devuelva dos estructuras independientes sin sumatorias combinadas.

#### 3.2. Idempotencia y Blindaje de Stock
- **Flujo Transaccional:**
  ```
  [ Webhook Recibido ] 
          │
          ▼
  [ INICIAR transaction.atomic() ]
          │
          ▼
  [ SELECT * FROM payments_payment WHERE transaction_id = X FOR UPDATE ]
          │
     ¿Ya aprobado?
     ├── SÍ ──▶ [ Registrar log 'DUPLICATE_WEBHOOK_IGNORED' ] ──▶ [ RETORNAR HTTP 200 ]
     │
     └── NO  ──▶ [ Marcar Payment = APPROVED ]
                 [ Descontar Stock de OrderItems atómicamente ]
                 [ Transicionar Order = PROCESSING ]
                 [ Crear IncomeRecord con snapshot de costos ]
                 [ COMMIT ] ──▶ [ RETORNAR HTTP 200 ]
  ```

#### 3.3. Plan de Migraciones Seguras en Cloud SQL (PostgreSQL 16)
Para la introducción de nuevos modelos (`Supplier`, `PurchaseOrder`, `SerialNumberTrack`):
1. **Modelos Nuevos:** Al tratarse de tablas nuevas, se crean de forma instantánea sin bloquear tablas existentes (`CREATE TABLE` no bloquea lecturas ni escrituras en otras tablas).
2. **Columnas Nuevas en Tablas Existentes:** Si se requiere asociar `OrderItem` con `SerialNumberTrack`, la relación será inversa o con llave foránea nullable:
   ```python
   # Seguro para cero downtime:
   serial_number = models.ForeignKey('SerialNumberTrack', null=True, blank=True, on_delete=models.SET_NULL)
   ```

---

### 4. Plan de Rollback y Recuperación ante Desastres (Runbook)

En caso de detectarse cualquier anomalía operativa tras un despliegue de V4.0:

1. **Rollback Instantáneo de Cloud Run (0 downtime):**
   - El servicio Cloud Run mantiene las revisiones anteriores intactas.
   - Para revertir a la versión anterior de inmediato:
     ```bash
     gcloud run services update-traffic levelproaudio-backend --to-revisions=PREVIOUS_REVISION=100 --region=us-central1
     gcloud run services update-traffic levelproaudio-frontend --to-revisions=PREVIOUS_REVISION=100 --region=us-central1
     ```
   - Tiempo de ejecución: **< 15 segundos**.

2. **Rollback de Migraciones de Base de Datos:**
   - Cada migración de V4.0 debe implementar su método `down` o ser estrictamente reversible mediante `python manage.py migrate <app_name> <previous_migration>`.

3. **Restauración de Cloud SQL:**
   - La base de datos Cloud SQL cuenta con copias de seguridad automáticas diarias y recuperación puntual (*Point-in-Time Recovery - PITR*) habilitada con retención de logs WAL de 7 días.
