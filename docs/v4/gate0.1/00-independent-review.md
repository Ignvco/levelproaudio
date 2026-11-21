# LEVELPRO OS V4.0 — GATE 0.1
## 00. Revisión Crítica e Independiente de los Documentos de Gate 0

**Documento:** `docs/v4/gate0.1/00-independent-review.md`  
**Versión:** 4.0.0-gate0.1  
**Fecha de Certificación:** Noviembre 2026  
**Auditor:** Lead Systems Auditor & Independent Architectural Reviewer  
**Referencia de Código:** Repositorio `Ignvco/levelproaudio`, Commit `e33f699a55b2709a6921b0c65fe301d2477ee9a8` y rama local `feature/v4-gate0-audit` (`8e21ba56da0b39e2646c92a457faa70cbd97498e`).  
**Objetivo:** Contrastar cada afirmación de los 9 documentos de Gate 0 contra la realidad técnica verificable en el código fuente, dependencias, configuraciones y contenedores.

---

### 1. Resumen de la Revisión Independiente

La auditoría de Gate 0 estableció una visión estratégica valiosa para LEVELPRO OS V4.0. No obstante, una inspección independiente y exhaustiva del repositorio revela que se incurrió en **afirmaciones no respaldadas, discrepancias de nomenclatura, supuestos sobre versiones tecnológicas y sobrestimaciones de capacidades operativas**. 

El propósito de esta revisión es **rectificar formalmente la línea base técnica** para asegurar que LEVELPRO OS V4.0 se construya sobre hechos demostrables y reproducibles, evitando arrastrar deuda técnica conceptual hacia la fase de implementación.

---

### 2. Tabla Comparativa de Discrepancias Críticas

| Ámbito Auditado | Declaración en Documentos Gate 0 | Realidad Verificada en el Código (Commit `e33f699`) | Severidad | Archivo / Evidencia |
| :--- | :--- | :--- | :---: | :--- |
| **Stack Frontend** | React 18, Vite 5, React Router 6, TailwindCSS 3 | **React 19.2.4, Vite 8.0.1, React Router 7.13.2, TailwindCSS 4.2.2** | Alta | `frontend/package.json` |
| **Test Runner Frontend** | Vitest (99 pruebas automatizadas) | **Node Test Runner (`node --test`) y Playwright** (100 pruebas unitarias) | Alta | `frontend/package.json:scripts` |
| **Runtime y Motores** | Node versión no especificada | **Node >=24.19.0 <25, npm 11.9.0** | Media | `frontend/package.json:engines` |
| **Servidor WSGI/ASGI** | Gunicorn con Uvicorn Worker (ASGI) | **Gunicorn WSGI estándar (`config.wsgi:application`)** | Media | `backend/Dockerfile.prod:29` |
| **Migraciones en Despliegue** | Despliegue blue/green seguro | **`manage.py migrate --noinput` en CMD de arranque del contenedor** | Crítica | `backend/Dockerfile.prod:29` |
| **Modelo de Usuario** | `CustomUser` | **`User` (clase `User(AbstractUser)`)** | Alta | `backend/apps/users/models.py:11` |
| **Modelo OrderItem** | Campo `unit_price` | **Campo `price`** (`unit_price` solo en `B2BQuoteItem`) | Alta | `backend/apps/orders/models.py:231` |
| **Ubicación B2BQuote** | Declarado en `apps/billing/` | **Ubicado en `apps/orders/models.py:262`** | Alta | `backend/apps/orders/models.py:262` |
| **Ubicación Pedidos Especiales**| Declarado como `SpecialOrder` en `apps/orders/` | **`SpecialOrderRequest` en `apps/products/models.py:323`** | Alta | `backend/apps/products/models.py:323` |
| **Campo de Stock** | `stock = IntegerField(default=0)` | **`stock = PositiveIntegerField(default=0)`** | Media | `backend/apps/products/models.py:124` |
| **Umbral de Stock Bajo** | Campo `low_stock_threshold` | **Campo `stock_min` (PositiveIntegerField)** | Media | `backend/apps/products/models.py:125` |
| **Permisos Administrativos** | RBAC granular (`IsOwnerOrAdmin`, etc.) | **Único permiso compartido: `IsAdminOrStaff`** | Alta | `backend/core/admin_permissions.py:5` |
| **Pasarelas Operativas** | Webpay Plus y Stripe operativas | **NO existen en `PaymentProvider`**; MP AR está deshabilitado en choices | Crítica | `backend/apps/payments/models.py:8-16` |
| **Máquina de Estados Pedido**| `PENDING → PROCESSING → SHIPPED → DELIVERED \| REFUNDED` | **`pending, paid, shipped, completed, cancelled`** | Crítica | `backend/apps/orders/models.py:15-20` |
| **Deducción de Inventario** | Al confirmar pago y transicionar a `PROCESSING` | **Al crear la orden en estado `pending` en el checkout** | Crítica | `backend/apps/orders/views.py:142,221` |
| **Cálculo de Fletes** | Tarifas reales de couriers y peso volumétrico | **Fórmula lineal fija; `city` se ignora en la fórmula** | Alta | `backend/apps/billing/shipping_and_tax.py:130` |
| **Multi-Moneda** | Cero conversiones automáticas de catálogo | **Fallback automático con tasas fijas (950 CLP, 1000 ARS)** | Alta | `backend/apps/products/models.py:198-211` |
| **Conteo de Tests Backend** | 419 pruebas unitarias | **827 pruebas recolectadas en `pytest`** | Media | Ejecución en contenedor QA |
| **Métricas de Impacto V4** | Cifras de reducción de tiempos y márgenes | **Hipótesis comerciales proyectadas, no certificadas** | Alta | `docs/v4/gate0/08-informe-ejecutivo.md` |

---

### 3. Evaluación de Impacto por Documento Original

#### Documento `00-estado-actual.md`
- **Error Principal:** Describió la arquitectura frontend como React 18 / Vite 5 / TailwindCSS 3 y el backend como ASGI con uvicorn worker.
- **Riesgo:** Generar incompatibilidades en librerías o planificar migraciones innecesarias sobre dependencias que ya se encuentran en sus versiones más recientes (React 19 y Vite 8).

#### Documento `01-auditoria-funcional.md`
- **Error Principal:** Uso de nombres de modelos y campos ficticios (`CustomUser`, `OrderItem.unit_price`, `low_stock_threshold`, `SpecialOrder`).
- **Riesgo:** Si el equipo de desarrollo de Gate 1 escribe código sobre estos nombres, las pruebas fallarán de inmediato por `AttributeError` o `FieldError`.

#### Documento `02-benchmark-tiendanube-shopify.md`
- **Error Principal:** Afirmó que Shopify carece de órdenes de compra y gestión de proveedores, y que B2B es exclusivo de Plus. Afirmó que Tiendanube no tiene listas mayoristas ni recuperación de carritos. Fusionó Odoo y Katana como si fuesen el mismo sistema.
- **Riesgo:** Subestimar las plataformas de referencia y diseñar soluciones inferiores a los estándares de la industria.

#### Documento `03-arquitectura-propuesta.md`
- **Error Principal:** Asumió estados inexistentes (`PROCESSING`, `DELIVERED`, `REFUNDED`) y propuso el threshold fijo de \$200 USD para seriales.
- **Riesgo:** Romper la máquina de estados real en PostgreSQL y forzar un criterio arbitrario de negocio en inventario.

#### Documento `05-riesgos-y-regresiones.md`
- **Error Principal:** Afirmó capacidad de rollback en < 15 segundos y omitió el riesgo crítico de `migrate --noinput` en el arranque de Cloud Run.
- **Riesgo:** Caídas en producción por bloqueo de base de datos durante escalado horizontal de contenedores.

#### Documento `08-informe-ejecutivo.md`
- **Error Principal:** Presentó porcentajes especulativos (65% menos tiempo de despacho, 99.5% precisión en margen) como hechos comprobados.
- **Riesgo:** Desalineación de expectativas con la dirección general y reporte de métricas infundadas.

---

### 4. Conclusión del Dictamen Independiente

Los 9 documentos originales de Gate 0 quedan preservados en `docs/v4/gate0/` como antecedente histórico. A partir de este momento, **la verdad técnica oficial se documenta en `docs/v4/gate0.1/`**.
