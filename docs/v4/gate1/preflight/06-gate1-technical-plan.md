# LEVELPRO OS V4.0 — GATE 1.0 PREFLIGHT
## 06. Plan Técnico Detallado de Implementación de GATE 1 (Security & Business Core)

**Documento:** `docs/v4/gate1/preflight/06-gate1-technical-plan.md`  
**Versión:** 4.0.0-gate1.0  
**Fecha de Emisión:** Noviembre 2026  
**Líderes Técnicos:** Senior Enterprise Architect & Lead Security Engineer  
**Objetivo:** Especificación técnica exhaustiva para la ejecución de GATE 1 tras su autorización formal.

---

### 1. Alcance Reestructurado de GATE 1

En cumplimiento estricto de las directivas del propietario:
> *"El alcance de GATE 1 se redefine exclusivamente como Security & Business Core. El desarrollo de proveedores, inventario dimensional, seriales y compras queda reservado para sus gates correspondientes."*

GATE 1 se divide en 6 compuertas internas (Subgates 1.0 a 1.5):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       GATE 1: SECURITY & BUSINESS CORE                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Subgate 1.0: Preflight y Cierre de Evidencias (FASE ACTUAL)               │
│ • Subgate 1.1: Control de Acceso Basado en Roles (RBAC Granular)            │
│ • Subgate 1.2: Registro Inmutable de Auditoría (Audit Trail)                │
│ • Subgate 1.3: Seguridad en Infraestructura y Migraciones Cloud Run         │
│ • Subgate 1.4: Contratos Fundacionales de Negocio y Tipos Numéricos         │
│ • Subgate 1.5: Aseguramiento de Calidad, Pruebas y Certificación de Salida  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 2. Especificación Técnica por Subgate

#### SUBGATE 1.0: Preflight y Cierre de Evidencias
- **Estado:** Completado en esta entrega.
- **Entregables:** 7 documentos en `docs/v4/gate1/preflight/` y 3 documentos maestros en `docs/v4/master/`.
- **Criterio de Cierre:** Detención formal y aprobación explícita del propietario.

---

#### SUBGATE 1.1: RBAC Granular (Role-Based Access Control)
- **Estrategia de Autorización:**
  - Se evaluó y decidió **reutilizar los modelos estándar de Django `auth.Group` y `auth.Permission`**, complementados con una capa de decoradores y clases de permisos DRF en `core/admin_permissions.py`.
  - Se evita construir un sistema de permisos paralelo o fragmentado.
- **Perfiles Operativos Iniciales:**
  1. `Super Admin`: Acceso total sin restricciones.
  2. `Administración / Gerencia`: Acceso a operaciones comerciales, finanzas y reportes; sin acceso a credenciales técnicas.
  3. `Ventas`: Gestión de pedidos, carritos, cotizaciones B2B y catálogo; **sin acceso a costos de compra ni márgenes brutos**.
  4. `Compras`: Gestión de proveedores, órdenes de compra y recepción de mercadería.
  5. `Bodega / WMS`: Gestión de existencias físicas, escaneo de seriales y empaque; **sin acceso a datos financieros**.
  6. `Logística`: Emisión de guías, transportistas y seguimiento de despachos.
  7. `Finanzas / Contabilidad`: Conciliación bancaria, DTE/SII, márgenes, compras y reportes contables.
  8. `Marketing`: Campañas, Rewards, Loyalty, cupones y banners del sitio web.
  9. `Academia`: Gestión de cursos, lecciones, inscripciones y certificaciones.
  10. `Soporte Técnico`: Atención al cliente, notas en CRM y gestión de garantías (RMA).
- **Protección a Nivel de Serializer (Field-Level Masking):**
  - Implementación de mixins DRF (`SensitiveFieldPermissionMixin`) que filtran campos como `cost_price`, `margin` o `raw_response` en tiempo de serialización según el rol del usuario autenticado.
- **Compatibilidad hacia Atrás:**
  - Durante la transición, usuarios con `is_superuser=True` o `is_staff=True` conservan acceso operativo mediante el permiso base `IsAdminOrStaff`.

---

#### SUBGATE 1.2: Audit Trail Inmutable
- **Modelo de Datos:**
  ```python
  class AuditLog(TimeStampedModel):
      user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
      action = models.CharField(max_length=50, choices=[
          ("create", "Creación"),
          ("update", "Modificación"),
          ("delete", "Eliminación"),
          ("price_change", "Cambio de Precio"),
          ("stock_adjust", "Ajuste de Stock"),
          ("order_status", "Cambio Estado Pedido"),
          ("role_change", "Asignación de Rol"),
      ])
      resource_type = models.CharField(max_length=100) # ej: Product, Order, BankAccount
      resource_id = models.CharField(max_length=255)
      ip_address = models.GenericIPAddressField(null=True, blank=True)
      user_agent = models.TextField(blank=True)
      changes = models.JSONField(help_text="Snapshot de valores previos y nuevos")

      class Meta:
          ordering = ["-created_at"]
          indexes = [
              models.Index(fields=["resource_type", "resource_id"]),
              models.Index(fields=["action", "created_at"]),
          ]
  ```
- **Protección contra Mutaciones:**
  - El modelo sobreescribe `save()` y `delete()` impidiendo modificaciones posteriores a la creación (`raise PermissionDenied("Los registros de auditoría son inmutables.")`).
  - Solo lectura en el admin de Django para usuarios Super Admin.
  - Sanitización automática: se enmascaran contraseñas, tokens y datos bancarios privados antes de persistir en `changes`.

---

#### SUBGATE 1.3: Infraestructura y Desacoplamiento de Migraciones Cloud Run
- **Problema Actual:** `Dockerfile.prod` ejecuta `python manage.py migrate --noinput` en el CMD de cada contenedor, causando carreras cuando Cloud Run escala instancias en paralelo.
- **Solución Propuesta para GATE 1.3:**
  1. **Desacoplar Migraciones del Arranque de Contenedor:**
     - El CMD del contenedor correrá únicamente:
       ```dockerfile
       CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8080", "--workers", "2", "--threads", "4", "--timeout", "120"]
       ```
  2. **Ejecución como Cloud Run Job Dedicado o Paso de Cloud Build:**
     - En `cloudbuild.yaml`, antes del paso de despliegue a los servicios de frontend/backend, se invoca un paso aislado de migración que se conecta a Cloud SQL a través del Cloud SQL Auth Proxy y ejecuta `manage.py migrate --noinput` de forma exclusiva.
  3. **Patrón Expand / Migrate / Contract:**
     - Todo cambio de esquema futuro en V4.0 se divide en 3 pasos: primero agregar columnas como `nullable`, migrar datos de fondo (backfill), y posteriormente aplicar restricciones `NOT NULL`.
  4. **Tratamiento de `createcachetable`:**
     - La tabla de caché de Django (`database_cache`) ya existe en Cloud SQL; el comando se ejecuta como parte del setup inicial de release, no en cada arranque de pod.
- **Regla Estricta:** No se eliminará la configuración actual en `Dockerfile.prod` hasta que el mecanismo de reemplazo sea validado exhaustivamente en el entorno local y QA.

---

#### SUBGATE 1.4: Contratos Fundacionales de Negocio y Tipos Numéricos
- **Conformidad Numérica:**
  - Creación del módulo `core/types.py` con utilidades de precisión matemática:
    ```python
    from decimal import Decimal, ROUND_HALF_UP

    def quantize_currency(amount, currency="CLP"):
        dec_amount = Decimal(str(amount or "0"))
        if currency.upper() in ("CLP", "ARS"):
            return dec_amount.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        return dec_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    ```
- **Estandarización de Errores de API:**
  - Formato estricto para respuestas HTTP 4xx y 5xx con código de error interno, mensaje legible y timestamp, sin exponer tracebacks internos en producción.
- **Mapeo de Estados de Dominio:**
  - Definición de interfaces abstractas para separar claramente los estados de pedido, pago y despacho.

---

#### SUBGATE 1.5: Aseguramiento de Calidad y Pruebas
- Pruebas unitarias de las clases de permisos RBAC.
- Pruebas de inmutabilidad del modelo `AuditLog`.
- Pruebas de simulación de migraciones concurrentes en PostgreSQL.
- Verificación de que 0 endpoints públicos se ven afectados.
