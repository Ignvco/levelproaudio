# LEVELPRO OS V4.0 — GATE 0.1
## 01. Matriz de Hallazgos, Evidencia de Código y Rectificaciones Técnicas

**Documento:** `docs/v4/gate0.1/01-findings-and-corrections.md`  
**Versión:** 4.0.0-gate0.1  
**Fecha de Certificación:** Noviembre 2026  
**Auditor Principal:** Lead Code Auditor & Technical Integrity Specialist  
**Estado:** **TODOS LOS HALLAZGOS CATALOGADOS Y RECTIFICADOS**

---

### 1. Metodología de Clasificación de Hallazgos

Cada hallazgo se estructura bajo la siguiente ficha técnica inmutable:
- **ID:** Identificador unívoco (`HAL-01` a `HAL-18`).
- **Severidad:** Crítica (bloquea la arquitectura o causa fallos transaccionales), Alta (inconsistencia grave de modelos/APIs), Media (discrepancia técnica de configuración o nombres), Informativa (aclaración de métricas).
- **Fuente:** Documento o sección de Gate 0 donde se originó el error.
- **Evidencia en Código:** Ruta exacta, clase, función y número de línea en el repositorio local (Commit `e33f699`).
- **Impacto:** Consecuencia técnica u operativa de mantener la afirmación incorrecta.
- **Corrección Propuesta:** Solución técnica validada contra el código real.
- **Estado:** `RECTIFICADO EN GATE 0.1`.

---

### 2. Matriz Exhaustiva de Hallazgos

#### HAL-01: Discrepancia en Versiones del Stack Frontend y Dependencias
- **Severidad:** Alta
- **Fuente:** `docs/v4/gate0/00-estado-actual.md`, Sección 2.
- **Evidencia en Código:**
  - Archivo: `frontend/package.json`
  - Líneas:
    - `"react": "^19.2.4"` (Línea 30)
    - `"react-dom": "^19.2.4"` (Línea 31)
    - `"react-router-dom": "^7.13.2"` (Línea 34)
    - `"vite": "^8.0.1"` (Línea 49)
    - `"tailwindcss": "^4.2.2"` (Línea 48)
    - `"packageManager": "npm@11.9.0"` (Línea 5)
    - `"engines": { "node": ">=24.19.0 <25", "npm": "11.9.0" }` (Líneas 6-9)
- **Impacto:** Planificar arquitecturas sobre React 18 / Router 6 genera código obsoleto o errores de importación de hooks incompatibles con React 19 y React Router v7.
- **Corrección:** Se actualiza formalmente la línea base a **React 19.2.4, Vite 8.0.1, React Router 7.13.2, TailwindCSS 4.2.2, Node 24 y npm 11.9.0**.
- **Estado:** RECTIFICADO EN GATE 0.1.

---

#### HAL-02: Identificación Errónea del Framework de Testing Frontend
- **Severidad:** Alta
- **Fuente:** `docs/v4/gate0/01-auditoria-funcional.md`, Punto 18; `07-plan-de-pruebas.md`.
- **Evidencia en Código:**
  - Archivo: `frontend/package.json`
  - Líneas 14, 16-17:
    - `"test:unit": "node --test tests/payment-return.test.mjs ..."`
    - `"test:browser": "node --test tests/payment-return.browser.mjs ..."`
    - `"devDependencies": { "playwright": "1.62.1" }`
  - Búsqueda en `package.json`: `vitest` **NO existe** en dependencies ni devDependencies.
- **Impacto:** Confusión en la ejecución de CI/CD al invocar comandos inexistentes como `vitest run`.
- **Corrección:** La suite frontend utiliza el **Node Test Runner nativo (`node --test`)** para pruebas unitarias (100 tests pasando) y **Playwright (1.62.1)** para pruebas de integración en navegador.
- **Estado:** RECTIFICADO EN GATE 0.1.

---

#### HAL-03: Inexistencia del Modelo `CustomUser` (Nombre Real: `User`)
- **Severidad:** Alta
- **Fuente:** `docs/v4/gate0/00-estado-actual.md`, Tabla de Modelos; `01-auditoria-funcional.md`, Punto 11.
- **Evidencia en Código:**
  - Archivo: `backend/apps/users/models.py`
  - Líneas 10-18:
    ```python
    class User(AbstractUser):
        """Usuario personalizado de LevelPro."""
        id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
        email = models.EmailField(unique=True)
    ```
  - Archivo: `backend/config/settings/base.py`
  - Línea 196: `AUTH_USER_MODEL = 'users.User'`
- **Impacto:** Importar `from apps.users.models import CustomUser` provoca `ImportError` inmediato en tiempo de ejecución.
- **Corrección:** El modelo oficial se llama `User` y debe referenciarse como `settings.AUTH_USER_MODEL` o `from apps.users.models import User`.
- **Estado:** RECTIFICADO EN GATE 0.1.

---

#### HAL-04: Discrepancia en Campo de Precio en `OrderItem` (`price` vs `unit_price`)
- **Severidad:** Alta
- **Fuente:** `docs/v4/gate0/01-auditoria-funcional.md`, Punto 6.
- **Evidencia en Código:**
  - Archivo: `backend/apps/orders/models.py`
  - Líneas 231-236:
    ```python
    class OrderItem(TimeStampedModel):
        order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
        product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
        product_name = models.CharField(max_length=300)
        price = models.DecimalField(max_digits=12, decimal_places=2)
        quantity = models.PositiveIntegerField()
    ```
- **Impacto:** Consultas ORM como `OrderItem.objects.filter(unit_price__gt=1000)` provocan `django.core.exceptions.FieldError: Cannot resolve keyword 'unit_price' into field`.
- **Corrección:** `OrderItem` utiliza `price`. El campo `unit_price` existe únicamente en el modelo `B2BQuoteItem` (`apps/orders/models.py:295`).
- **Estado:** RECTIFICADO EN GATE 0.1.

---

#### HAL-05: Tipo de Campo y Nomenclatura de Stock en `Product`
- **Severidad:** Media
- **Fuente:** `docs/v4/gate0/01-auditoria-funcional.md`, Puntos 2 y 9.
- **Evidencia en Código:**
  - Archivo: `backend/apps/products/models.py`
  - Líneas 124-129:
    ```python
    stock = models.PositiveIntegerField(default=0, verbose_name="Stock")
    stock_min = models.PositiveIntegerField(
        default=5,
        verbose_name="Stock mínimo",
        help_text="Alerta cuando el stock baje de este nivel"
    )
    ```
- **Impacto:** Intentar asignar valores negativos a nivel de base de datos o consultar por `low_stock_threshold` fallará en la validación ORM.
- **Corrección:** `stock` es `PositiveIntegerField` y el umbral de alerta es `stock_min`.
- **Estado:** RECTIFICADO EN GATE 0.1.

---

#### HAL-06: Ubicación Errónea del Modelo `B2BQuote`
- **Severidad:** Alta
- **Fuente:** `docs/v4/gate0/00-estado-actual.md`, Tabla de Modelos (`apps/billing/`); `01-auditoria-funcional.md`.
- **Evidencia en Código:**
  - Archivo: `backend/apps/orders/models.py`
  - Líneas 262-281:
    ```python
    class B2BQuote(TimeStampedModel):
        user = models.ForeignKey(settings.AUTH_USER_MODEL, ...)
        company_name = models.CharField(max_length=200, ...)
        tax_id = models.CharField(max_length=50, ...)
    ```
- **Impacto:** Confusión arquitectónica al buscar el modelo en `apps.billing` cuando en realidad reside en `apps.orders`.
- **Corrección:** `B2BQuote` y `B2BQuoteItem` están definidos e implementados en `apps.orders`.
- **Estado:** RECTIFICADO EN GATE 0.1.

---

#### HAL-07: Nombre y Ubicación de Solicitudes Bajo Pedido (`SpecialOrderRequest`)
- **Severidad:** Alta
- **Fuente:** `docs/v4/gate0/00-estado-actual.md`, Tabla de Modelos; `01-auditoria-funcional.md`, Punto 10.
- **Evidencia en Código:**
  - Archivo: `backend/apps/products/models.py`
  - Líneas 323-345:
    ```python
    class SpecialOrderRequest(TimeStampedModel):
        user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
        full_name = models.CharField(max_length=200)
        email = models.EmailField()
        product_name = models.CharField(max_length=300)
    ```
- **Impacto:** Se asumió que existía un modelo `SpecialOrder` en `apps.orders` vinculado a `Product` vía N:M. En realidad, es un formulario de solicitud comercial en `apps.products`.
- **Corrección:** El modelo oficial es `SpecialOrderRequest` en `apps.products`.
- **Estado:** RECTIFICADO EN GATE 0.1.

---

#### HAL-08: Permisos Administrativos Reales (`IsAdminOrStaff`)
- **Severidad:** Alta
- **Fuente:** `docs/v4/gate0/01-auditoria-funcional.md`, Punto 4.
- **Evidencia en Código:**
  - Archivo: `backend/core/admin_permissions.py`
  - Líneas 5-11:
    ```python
    class IsAdminOrStaff(BasePermission):
        def has_permission(self, request, view):
            return bool(
                request.user and
                request.user.is_authenticated and
                (request.user.is_staff or request.user.is_superuser)
            )
    ```
- **Impacto:** Se afirmó falsamente la existencia de clases como `IsOwnerOrAdmin` y roles granulares ya implementados en backend.
- **Corrección:** Actualmente existe un único permiso compartido `IsAdminOrStaff`. El RBAC granular es una **decisión a diseñar para Gate 1**, no una realidad existente.
- **Estado:** RECTIFICADO EN GATE 0.1.

---

#### HAL-09: Auditoría Real de Pasarelas en `PaymentProvider`
- **Severidad:** Crítica
- **Fuente:** `docs/v4/gate0/00-estado-actual.md`, Sección 5; `03-arquitectura-propuesta.md`.
- **Evidencia en Código:**
  - Archivo: `backend/apps/payments/models.py`
  - Líneas 8-16:
    ```python
    class PaymentProvider(models.TextChoices):
        MERCADOPAGO_CL = "mercadopago_cl", "MercadoPago Chile"
        MERCADOPAGO_AR = "mercadopago_ar", "MercadoPago Argentina (deshabilitado)"
        UALA           = "uala",           "Ualá (Argentina)"
        PAYPAL         = "paypal",         "PayPal"
        GLOBAL66       = "global66",       "Transferencia Global66"
        TRANSFER       = "transfer",       "Transferencia bancaria"
        PAYONEER       = "payoneer",       "Payoneer (USD)"
        CASH           = "cash",           "Pago manual"
    ```
- **Impacto:** Declarar Webpay Plus y Stripe como pasarelas operativas o configurables indujo a error. Ni Webpay ni Stripe existen como opciones en `PaymentProvider`.
- **Corrección:** Se rectifica el inventario: las pasarelas reales son Mercado Pago Chile, PayPal, Transferencias bancarias (CLP/ARS), Ualá Bis, Global66, Payoneer y Cash. Mercado Pago Argentina está explícitamente deshabilitado en choices.
- **Estado:** RECTIFICADO EN GATE 0.1.

---

#### HAL-10: Máquina de Estados Real de `Order` vs `Payment`
- **Severidad:** Crítica
- **Fuente:** `docs/v4/gate0/01-auditoria-funcional.md`, Punto 6; `05-riesgos-y-regresiones.md`.
- **Evidencia en Código:**
  - Archivo: `backend/apps/orders/models.py`
  - Líneas 15-20:
    ```python
    class OrderStatus(models.TextChoices):
        PENDING   = "pending",   "Pendiente"
        PAID      = "paid",      "Pagado"
        SHIPPED   = "shipped",   "Enviado"
        COMPLETED = "completed", "Completado"
        CANCELLED = "cancelled", "Cancelado"
    ```
  - Archivo: `backend/apps/payments/models.py`
  - Líneas 19-25:
    ```python
    class PaymentStatus(models.TextChoices):
        PENDING   = "pending",   "Pendiente"
        APPROVED  = "approved",  "Aprobado"
        REJECTED  = "rejected",  "Rechazado"
        CANCELLED = "cancelled", "Cancelado"
        REFUNDED  = "refunded",  "Reembolsado"
        IN_REVIEW = "in_review", "En revisión"
    ```
- **Impacto:** `PROCESSING`, `DELIVERED` y `REFUNDED` NO son estados del modelo `Order`. Forzar transiciones a `PROCESSING` o `DELIVERED` lanza excepciones en Django.
- **Corrección:** Se documenta la máquina de estados real de 5 estados para `Order` y 6 estados para `Payment`.
- **Estado:** RECTIFICADO EN GATE 0.1.

---

#### HAL-11: Momento Real de Deducción de Inventario
- **Severidad:** Crítica
- **Fuente:** `docs/v4/gate0/01-auditoria-funcional.md`, Punto 9; `05-riesgos-y-regresiones.md`, Diagrama transaccional.
- **Evidencia en Código:**
  - Archivo: `backend/apps/orders/views.py`
  - Líneas 142 y 221:
    ```python
    validated_items, stock_demand = prepare_inventory(items_data)
    ...
    deduct_inventory(stock_demand) # Se ejecuta al crear el pedido en PENDING
    ```
  - Archivo: `backend/apps/orders/models.py`
  - Líneas 196-198:
    ```python
    if previous.status == OrderStatus.PENDING and self.status == OrderStatus.CANCELLED:
        from .inventory import restore_inventory
        restore_inventory(previous)
    ```
- **Impacto:** La auditoría afirmó que el stock se descuenta al aprobarse el pago. En realidad, se descuenta al momento de crear el pedido en el checkout (`PENDING`) y se restaura si la orden `PENDING` pasa a `CANCELLED`.
- **Corrección:** Se rectifica el flujo real de reserva/deducción de stock y se sienta la base para la compuerta de inventario de V4.0.
- **Estado:** RECTIFICADO EN GATE 0.1.

---

#### HAL-12: Algoritmo Real de Estimación Logística en `shipping_and_tax.py`
- **Severidad:** Alta
- **Fuente:** `docs/v4/gate0/01-auditoria-funcional.md`, Punto 13.
- **Evidencia en Código:**
  - Archivo: `backend/apps/billing/shipping_and_tax.py`
  - Líneas 130-155:
    ```python
    price_std = (Decimal("4990") + (weight_kg * Decimal("1200"))) * factor
    price_exp = (Decimal("7990") + (weight_kg * Decimal("2000"))) * factor
    price_sta = (Decimal("3990") + (weight_kg * Decimal("1000"))) * factor
    ```
  - Línea 112: `city = (request.data.get("city") or request.data.get("region") or "Santiago").strip()`
  - El parámetro `city` solo se devuelve en la respuesta JSON; **no interviene en la fórmula matemática**.
  - Blue Express **no figura** en el código (solo Chilexpress y Starken para Chile; Andreani y Correo Argentino para Argentina).
- **Impacto:** Afirmar integración de cotización real por API con transportistas y peso volumétrico no es verídico.
- **Corrección:** Se reclasifica formalmente como **estimación referencial basada en fórmula lineal de peso**, preparando la arquitectura de integración real para Gate 3.
- **Estado:** RECTIFICADO EN GATE 0.1.

---

#### HAL-13: Mecanismo de Fallback en Precios Multi-Moneda
- **Severidad:** Alta
- **Fuente:** `docs/v4/gate0/00-estado-actual.md`, Sección 5; `01-auditoria-funcional.md`, Punto 8.
- **Evidencia en Código:**
  - Archivo: `backend/apps/products/models.py`
  - Líneas 191-217 (`prices_by_currency`):
    ```python
    usd_to_clp = usd_to_clp or Decimal("950")
    usd_to_ars = usd_to_ars or Decimal("1000")
    if self.price_usd is not None:
        usd = self.price_usd
    else:
        usd = (clp / usd_to_clp).quantize(...)
    if self.price_ars is not None:
        ars = self.price_ars
    else:
        ars = (usd * usd_to_ars).quantize(...)
    ```
- **Impacto:** Decir que "no existen conversiones automáticas" es incorrecto: si el producto no tiene `price_usd` o `price_ars` explícito, el sistema calcula un valor referencial usando tasas predefinidas fijas (950 CLP/USD y 1000 ARS/USD).
- **Corrección:** Se documenta la existencia del fallback de visualización de catálogo y se separan los conceptos de moneda de visualización, cobro y liquidación.
- **Estado:** RECTIFICADO EN GATE 0.1.

---

#### HAL-14: Concurrencia de Migraciones en `backend/Dockerfile.prod`
- **Severidad:** Crítica
- **Fuente:** `docs/v4/gate0/05-riesgos-y-regresiones.md`.
- **Evidencia en Código:**
  - Archivo: `backend/Dockerfile.prod`
  - Línea 29:
    ```dockerfile
    CMD ["sh", "-c", "python manage.py migrate --noinput && (python manage.py createcachetable || true) && exec gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120 --access-logfile - --error-logfile -"]
    ```
- **Impacto:** Si Cloud Run inicia 3 instancias simultáneas ante un pico de tráfico, todas ejecutarán `migrate --noinput` en paralelo sobre Cloud SQL PostgreSQL 16, arriesgando locks de tabla, deadlocks o fallos de inicialización.
- **Corrección:** Se incluye formalmente en el análisis de Gate 0.1 la desacoplación del paso de migración (ejecución como Cloud Run Job o paso único de Cloud Build).
- **Estado:** RECTIFICADO EN GATE 0.1.

---

#### HAL-15: Conteo Real de Pruebas Automatizadas en Backend
- **Severidad:** Media
- **Fuente:** `docs/v4/gate0/00-estado-actual.md`, Sección 1; `07-plan-de-pruebas.md`.
- **Evidencia en Código:**
  - Ejecución en contenedor: `docker exec levelpro-v32-qa-backend-1 pytest --collect-only -q`
  - Resultado empírico: **827 pruebas recolectadas en 5.14s**.
- **Impacto:** Reportar 419 pruebas subestimaba el alcance del suite real del repositorio o reflejaba una corrida parcial de versiones pasadas.
- **Corrección:** Se actualiza el inventario certificando la recolección de 827 pruebas backend y 100 pruebas frontend.
- **Estado:** RECTIFICADO EN GATE 0.1.

---

#### HAL-16: Rectificación del Benchmark Funcional (Shopify / Tiendanube / Odoo / Katana)
- **Severidad:** Alta
- **Fuente:** `docs/v4/gate0/02-benchmark-tiendanube-shopify.md`.
- **Evidencia en Documentación Oficial:**
  - Shopify PO & Proveedores: Nativo bajo Inventory > Purchase orders (Documentación Shopify Help Center).
  - Shopify B2B: Disponible en planes específicos, no exclusivamente Plus.
  - Tiendanube Mayorista: Tablas de precios mayoristas nativas configurables.
  - Odoo vs Katana: Odoo es ERP modular generalista; Katana es ERP especializado en manufactura y ensamblado D2C.
- **Impacto:** Conclusiones erradas de capacidades de mercado.
- **Corrección:** Se reescribe íntegramente la matriz comparativa con citas oficiales y fecha de consulta.
- **Estado:** RECTIFICADO EN GATE 0.1.

---

#### HAL-17: Reclasificación de Métricas Comerciales de V4.0 a Hipótesis
- **Severidad:** Alta
- **Fuente:** `docs/v4/gate0/08-informe-ejecutivo.md`, Tabla de ROI.
- **Evidencia:** Las cifras de "reducción del 65%", "precisión del 99.5%", "incremento del 35%" y "eliminación del 100% de fraudes" eran proyecciones no contrastadas contra líneas base empíricas.
- **Impacto:** Creación de expectativas desmedidas sin instrumentación de telemetría previa.
- **Corrección:** Se reclasifican como **hipótesis de negocio sujetas a medición formal post-lanzamiento**.
- **Estado:** RECTIFICADO EN GATE 0.1.

---

#### HAL-18: Diferenciación de Servidor Web de Producción
- **Severidad:** Media
- **Fuente:** `docs/v4/gate0/00-estado-actual.md`, Sección 2.
- **Evidencia en Código:**
  - Archivo: `backend/Dockerfile.prod`
  - Línea 29: `exec gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 4 ...`
  - Archivo: `backend/requirements/base.txt`
  - `uvicorn` no figura en `requirements/base.txt` ni `requirements/production.txt`.
- **Impacto:** Afirmar que el backend corre bajo Uvicorn/ASGI era inexacto.
- **Corrección:** El backend corre bajo **Gunicorn 22.0.0 con workers de hilos WSGI (`gunicorn config.wsgi:application`)**.
- **Estado:** RECTIFICADO EN GATE 0.1.
