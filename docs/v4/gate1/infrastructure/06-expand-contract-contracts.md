# LEVELPRO OS V4.0 — GATE 1.3: INFRASTRUCTURE & MIGRATION SAFETY
## DOCUMENTO 06 — CONTRATOS EXPAND/CONTRACT PARA EVOLUCIÓN DE ESQUEMA CON CERO DOWNTIME

**Versión:** 1.0  
**Fecha:** 21 de Noviembre de 2026  
**Rama:** `feature/v4-gate1-business-core`  
**Autor:** Senior Database Architect & Software Engineer  
**Estado:** VIGENTE & CERTIFICADO  

---

### 1. PRINCIPIO GENERAL: CERO DOWNTIME Y RETROCOMPATIBILIDAD

En un entorno de comercio electrónico de audio profesional con operaciones continuas (tienda pública, checkout, pagos con webhook asíncronos y academia en línea), ninguna migración de base de datos puede romper la compatibilidad hacia atrás con el código que se encuentra actualmente en ejecución.

Durante una actualización de producción:
1. El Cloud Run Job aplica la migración sobre la base de datos de producción.
2. Las instancias existentes de la revisión actual del backend (`levelproaudio-backend:v_old`) siguen atendiendo tráfico durante el despliegue gradual de la nueva revisión (`levelproaudio-backend:v_new`).
3. Por lo tanto, **el esquema resultante de la migración debe ser 100% compatible tanto con la versión de código nueva como con la versión de código anterior**.

Para lograr esto de forma estandarizada en las 17 compuertas de LEVELPRO OS V4.0, se adopta formalmente el patrón **Expand/Contract** (Fase de Expansión, Fase de Migración/Relleno y Fase de Contracción).

---

### 2. LAS TRES FASES DEL PATRÓN EXPAND/CONTRACT

```
  FASE 1: EXPAND                       FASE 2: BACKFILL                      FASE 3: CONTRACT
(Release N / Compuerta A)           (Background Job / Asíncrono)          (Release N+1 / Compuerta B)
+-----------------------+           +--------------------------+          +-------------------------+
| - Añadir nueva columna|           | - Poblar datos históricos|          | - Eliminar código viejo |
|   NULLABLE o con      | --------> |   en segundo plano sin   | -------> |   en desuso.            |
|   DEFAULT seguro.     |           |   bloqueos exclusivos.   |          | - Dropear columna vieja |
| - Código nuevo soporta|           | - Validar consistencia y |          |   o aplicar constraint  |
|   ambas versiones.    |           |   totales en auditoría.  |          |   NOT NULL definitivo.  |
+-----------------------+           +--------------------------+          +-------------------------+
```

#### 2.1. Fase 1: Expand (Expansión)
- Se introducen cambios aditivos únicamente.
- Nuevas tablas, índices creados con `CONCURRENTLY` (en PostgreSQL nativo cuando aplique) o columnas opcionales.
- **Regla Innegociable 1:** Prohibido agregar columnas `NOT NULL` sin un valor por defecto seguro preexistente (`DEFAULT`). En PostgreSQL 11+, agregar columnas con `DEFAULT` es una operación de catálogo instantánea ($O(1)$) que no reescribe la tabla.
- **Regla Innegociable 2:** Prohibido renombrar columnas directamente (`ALTER TABLE ... RENAME COLUMN`). El renombrado inmediato quiebra todas las instancias web activas de la versión previa.
- **Regla Innegociable 3:** Si un campo cambia de formato, se crea una columna nueva y el código se adapta para escribir en ambas columnas (dual-write).

#### 2.2. Fase 2: Backfill (Relleno Asíncrono)
- La sincronización o migración de datos históricos se ejecuta mediante tareas en segundo plano o comandos de gestión por lotes (`batching` con límites de 500-1000 registros).
- Se evita ejecutar scripts DML masivos dentro de una transacción de migración para no retener bloqueos de fila (`RowExclusiveLock`) que retrasen el checkout o pagos.

#### 2.3. Fase 3: Contract (Contracción)
- Se ejecuta obligatoriamente en una compuerta o despliegue posterior, una vez que el 100% del tráfico corre sobre el código nuevo y se ha certificado la ausencia de lecturas sobre la columna o tabla deprecada.
- Se retira el código de compatibilidad dual.
- Se eliminan de forma segura las columnas obsoletas o se agregan restricciones de integridad estrictas (`NOT NULL`, claves foráneas definitivas).

---

### 3. CONTRATOS Y EJEMPLOS DE APLICACIÓN EN LEVELPRO OS V4.0

#### 3.1. Caso: Evolución de Catálogo y Precios Multidivisa
*Objetivo:* Modificar la estructura de listas de precios mayoristas B2B sin detener la tienda pública.

- **Compuerta N (Expand):**
  1. Migración: Agregar columna `b2b_price_tier` en `products_product` como `null=True, blank=True`.
  2. Código: El backend lee `b2b_price_tier`; si es `None`, recurre a la lógica legacy `price * discount_rate`.
  3. Despliegue seguro: Las instancias web viejas continúan leyendo `price` sin notar el campo nuevo.
- **Compuerta N+1 (Backfill):**
  Comando `reconcile_b2b_tiers` asigna las listas de precios a los productos catalogados en lotes de 100 productos.
- **Compuerta N+2 (Contract):**
  Una vez verificado el 100% de productos con tier, se añade constraint de validación o valor por defecto y se retira el cálculo dinámico legacy.

#### 3.2. Caso: Auditoría Inmutable de Pagos
*Objetivo:* Asegurar que los webhooks de pago no fallen ante discrepancias de esquema.

- Al introducir la tabla `audit_events` y sus relaciones con `users_user` y `payments_payment`:
  1. La clave foránea `actor` se definió con `on_delete=models.SET_NULL, null=True, blank=True`.
  2. Los campos de snapshot (`actor_email`, `actor_username`, `actor_roles`) garantizan que si un usuario o rol es modificado, la auditoría permanece inalterada y autosuficiente.

---

### 4. REGLAS DE ORO PARA INGENIERÍA DE MIGRACIONES EN LEVELPRO OS

1. **Nunca combinar un Rename de columna con lógica de negocio en la misma compuerta.**
2. **Nunca eliminar una columna de base de datos sin haber retirado previamente todas las referencias en el código Python de la compuerta anterior.**
3. **Evitar bloqueos de tabla prolongados:** Establecer `lock_timeout` en scripts DDL para evitar que una migración espere indefinidamente bloqueando las transacciones de los usuarios.
4. **Idempotencia obligatoria:** Cada comando de migración o backfill debe ser seguro de reejecutar múltiples veces sin causar efectos secundarios adversos.
