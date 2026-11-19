# LEVELPRO OS V4.0 — GATE 0
## 07. Plan Maestro de Pruebas, Aseguramiento de Calidad (QA) y Verificación E2E

**Documento:** `docs/v4/gate0/07-plan-de-pruebas.md`  
**Versión:** 4.0.0-gate0  
**Fecha de Certificación:** Noviembre 2026  
**Líderes de QA:** Lead QA Engineer & Senior Test Automation Architect  
**Alcance:** Estrategia integral de verificación para asegurar cero regresiones y certificar cada módulo de LEVELPRO OS V4.0.

---

### 1. Filosofía de Aseguramiento de Calidad (QA Strategy)

Para garantizar la estabilidad absoluta de LevelPro Audio, el plan de pruebas adopta una pirámide de testing rigurosa y automatizada en cada fase del ciclo de vida:

```
                  ▲
                 / \
                /   \     [ Pruebas E2E / Flujos de Negocio ]
               / E2E \    (Compra, Checkout, B2B, PO, Recepción)
              /-------\
             /         \   [ Pruebas de Integración y API DRF ]
            / Integrac. \  (Webhooks, Serializers, Transacciones, RBAC)
           /-------------\
          /               \ [ Pruebas Unitarias Automatizadas ]
         /    Unitarias    \(Modelos, Cálculos de Margen, Puntos, Lógica)
        /-------------------\
```

---

### 2. Inventario de Pruebas Existentes y Cobertura Base

El sistema cuenta actualmente con una sólida base de pruebas automatizadas:
- **Pruebas de Backend:** 419 pruebas unitarias y de integración ejecutadas mediante `pytest-django` sobre PostgreSQL 16 y SQLite QA local.
- **Suites de Remediación Certificadas:**
  - `tests/test_audit_remediation_v35.py`: 4 pruebas (Redirección `?next=`, validación UUID en comparador, persistencia de cuentas bancarias y cursos iniciales).
  - `tests/test_audit_remediation_v34.py`: 9 pruebas (Seguridad en endpoints, serialización de órdenes, permisos RBAC).
  - `tests/test_f7_commercial_expansion_v33.py`: 13 pruebas (Comparador técnico, cotizaciones B2B, estimación de tarifas de transporte).
  - `tests/test_f6_financial_consolidation.py`: 9 pruebas (Márgenes de ganancia, distribución de costos e `IncomeRecord`).
  - **Resultado Reciente:** **35 de 35 pruebas aprobadas (100% de éxito)** en contenedor QA local.
- **Pruebas de Frontend:** 99 pruebas automatizadas con Vitest cubriendo stores de estado, validaciones de formularios y renderizado de componentes.

---

### 3. Escenarios de Prueba End-to-End (E2E) para LEVELPRO OS V4.0

Se definen 6 escenarios de prueba críticos que deben ejecutarse y validarse de extremo a extremo:

#### Escenario E2E-01: Ciclo Completo de Compra B2C de Hardware de Alta Gama con Serialización
1. **Acción Cliente:** Cliente selecciona un micrófono Neumann U87 en `/shop` y añade al carrito en CLP.
2. **Acción Checkout:** Selecciona pago con Webpay Plus o Transferencia Bancaria y completa el flujo.
3. **Validación Backend:**
   - La orden se crea en estado `PROCESSING`.
   - Se bloquea inventario con `select_for_update`.
   - Se genera el registro contable en `IncomeRecord` con moneda `CLP`.
   - Se acumulan puntos de fidelización en `LoyaltyProfile`.
4. **Acción Administrador (OS V4.0):**
   - El administrador abre la orden en `/admin/orders`.
   - Asigna un número de serie específico de bodega (`SerialNumberTrack`) al ítem.
   - Genera la guía de courier (Chilexpress/Starken) y cambia el estado a `SHIPPED`.
5. **Criterio de Éxito:** El número de serie queda marcado como `sold` vinculado al cliente y a la orden, sin alterar el stock de otros productos.

#### Escenario E2E-02: Flujo Completo de Cotización B2B y Conversión a Orden Mayorista
1. **Acción Productora:** Completa el formulario en `/b2b` solicitando 10 sistemas inalámbricos Shure con RUT de empresa y condiciones mayoristas.
2. **Acción Ejecutivo Comercial (OS V4.0):**
   - Visualiza la cotización en `/admin/b2b`.
   - Aplica un descuento corporativo del 12% y establece validez de 15 días.
   - Genera el PDF con membrete oficial LevelPro y envía al cliente.
3. **Aprobación:** La productora aprueba la cotización.
4. **Conversión:** El administrador presiona "Convertir en Orden".
5. **Criterio de Éxito:** Se genera una `Order` formal con estado `PENDING`, items congelados y vínculo directo a la cotización original.

#### Escenario E2E-03: Proceso de Adquisición (PO), Landed Cost y Recepción en Bodega
1. **Acción Compras (OS V4.0):**
   - Crea una Orden de Compra (`PurchaseOrder`) a Sennheiser Alemania por 20 audífonos HD600 en USD.
   - Registra flete aéreo DHL (\$450 USD) y arancel aduanero estimado (\$620 USD).
2. **Recepción en Bodega:**
   - El bodeguero recibe el embarque en `/admin/procurement`.
   - Escanea o ingresa los 20 números de serie individuales.
   - Presiona "Confirmar Recepción".
3. **Criterio de Éxito:**
   - El stock de HD600 se incrementa en 20 unidades.
   - Se crean 20 registros en `SerialNumberTrack` con estado `in_stock`.
   - El costo unitario `cost_price` se recalcula sumando el flete y arancel prorrateado por unidad.

#### Escenario E2E-04: Transacción Internacional Multi-Moneda (USD) con Tarjeta de Crédito
1. **Acción Cliente Internacional:** Navega la tienda con moneda activa `USD`. Añade un preamplificador a la cesta.
2. **Checkout:** Paga mediante Stripe Elements o PayPal en USD.
3. **Validación:**
   - La orden se registra con `currency='USD'`.
   - El `Payment` registra el gateway ID de Stripe/PayPal en USD.
   - El módulo `/admin/finance` refleja el ingreso en la columna segregada de USD, sin mezclar con CLP ni ARS.
4. **Criterio de Éxito:** Cero distorsión cambiaria; saldo contable en USD perfectamente conciliado.

#### Escenario E2E-05: Canje de Puntos Loyalty y Participación en Campaña de Rewards
1. **Acción Cliente:** Inicia sesión con su cuenta y añade un producto al carrito.
2. **Checkout:** Utiliza 5.000 puntos LevelPro Rewards para obtener un descuento directo.
3. **Confirmación:** Al pagar el remanente, el sistema:
   - Descuenta 5.000 puntos del `LoyaltyProfile`.
   - Genera 3 tickets para el sorteo activo en `RewardsCampaign` por el monto abonado.
4. **Criterio de Éxito:** La orden refleja el descuento de puntos; los tickets aparecen en el perfil del cliente en `/rewards`.

#### Escenario E2E-06: Conciliación Asistida de Transferencias Bancarias
1. **Acción Cliente:** Realiza una transferencia bancaria en CLP y sube el comprobante en la pantalla de confirmación.
2. **Acción Finanzas (OS V4.0):**
   - El pago aparece en la bandeja Bento `/admin/finance/reconciliation` como `PENDING_REVIEW`.
   - El administrador previsualiza el comprobante adjunto y verifica el abono en la cartola bancaria.
   - Presiona "Aprobar Transferencia".
3. **Criterio de Éxito:** El pago pasa a `approved`, la orden a `PROCESSING`, se emite notificación al cliente y se reserva el stock atómicamente.

---

### 4. Automatización en Integración Continua (CI/CD)

Cada pull request hacia la rama de desarrollo de V4.0 deberá superar obligatoriamente:
1. `flake8` / `black` (formato y calidad de código PEP8).
2. `python manage.py check --deploy` (verificación de seguridad de Django).
3. `pytest` en backend (ejecución completa de pruebas unitarias y de integración).
4. `npm run test` (suite de pruebas frontend con Vitest).
5. `npm run build` (compilación limpia del bundle de producción sin advertencias críticas).
