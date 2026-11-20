# LEVELPRO OS V4.0 — GATE 1.2: AUDIT TRAIL & ACTIVITY LOG
## DOCUMENTO TÉCNICO 08: CENTRO DE ACTIVIDAD Y EXPERIENCIA DE USUARIO (UX/UI)

---

### 1. PRINCIPIOS DE DISEÑO EDITORIAL BENTO

El **Centro de Registro de Actividad y Auditoría Forense** (`frontend/src/pages/admin/AdminAudit.jsx`) ha sido diseñado e integrado siguiendo fielmente la estética **Editorial Bento** de LEVELPRO OS V4.0:

- **Paleta Cromática Oficial**:
  - Fondo de lienzo: `#08090A` / `#0D0E11`
  - Paneles Bento: `#14161B` con bordes sutiles `1px solid rgba(255, 255, 255, 0.08)`
  - Verde Identitario: `#1AFF6E` (botones primarios, badges de éxito, correlaciones)
  - Acentos de Estado: Azul Cyan `#60A5FA` (Info/Tiempo), Ámbar `#F59E0B` (Warning/Costos), Rojo Coral `#EF4444` (Critical/Denied).
- **Tipografías**:
  - `Geist`: Encabezados, etiquetas, selectores y prosa administrativa.
  - `Geist Mono`: Timestamps, Correlation IDs, UUIDs, IPs, fragmentos JSON y diffs.
- **Microinteracciones y Feedback**:
  - Hover states reactivos en filas de la tabla con elevación sutil.
  - Copia con feedback visual (icono de check) para Correlation IDs.
  - Estados de carga con skeletons bento estructurados (`SkeletonCard`, `SkeletonTable`).

---

### 2. ESTRUCTURA VISUAL DE LA INTERFAZ

```
┌────────────────────────────────────────────────────────────────────────┐
│ [GATE 1.2] Registro de Actividad y Auditoría      [Actualizar] [Exportar]│
├──────────────┬──────────────┬──────────────┬───────────────────────────┤
│ TOTAL EVENTOS│ ÚLTIMAS 24H  │ ALERTAS/CRIT │ MÓDULOS ACTIVOS           │
│ 142          │ 38           │ 14           │ 8                         │
├──────────────┴──────────────┴──────────────┴───────────────────────────┤
│ [🔍 Buscar actor/recurso...] [Módulo: Todos ▼] [Categoría ▼] [Severidad]│
├────────────────────────────────────────────────────────────────────────┤
│ TABLA FORENSE EDITORIAL:                                               │
│ Fecha/Hora │ Actor │ Módulo │ Acción │ Recurso │ Severidad │ Resultado │
├────────────────────────────────────────────────────────────────────────┤
│ 20/11 19:45│ admin │ Catalog│ PRICE_ │ Shure SM│ [INFO]    │ [SUCCESS] │
│ 20/11 19:30│ fin   │ Finance│ WITHDR_│ Retiro #│ [WARNING] │ [SUCCESS] │
│ 20/11 19:00│ sales │ Finance│ SEC_DEN│ /finance│ [WARNING] │ [DENIED]  │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 3. COMPONENTES PRINCIPALES

#### 3.1. Bento Stat Cards (KPIs Operativos)
Cuatro tarjetas métricas que consolidan en tiempo real:
1. **Total Eventos**: Volumen total acumulado de operaciones auditadas.
2. **Últimas 24 Horas**: Dinamismo de mutaciones recientes.
3. **Alertas y Críticos**: Agregación de severidades `warning` y `critical`.
4. **Módulos Activos**: Número de subsistemas que han registrado mutaciones.

#### 3.2. Barra de Filtros Reactivos
Permite combinar búsqueda de texto libre (`SearchInput`) con selectores de módulo, categoría taxonómica, severidad y resultado de la operación. Incluye acción de "Limpiar filtros" con actualización instantánea de la consulta vía React Query.

#### 3.3. Tabla Forense Paginada
Renderiza registros con micro-badges de severidad y resultado. El timestamp se formatea canónicamente en hora local chilena (`es-CL`). Al hacer clic en cualquier fila o en el botón "Detalle", se despliega el modal forense.

#### 3.4. Modal Forense de Mutación (Drawer Forense)
El componente `FormModal` optimizado (`open`, `scrollableBody`, `maxWidth="820px"`) presenta:
1. **Encabezado Forense**: Fecha/hora, módulo, categoría, severidad y Correlation ID con botón de copiado rápido.
2. **Contexto de Red e Identidad**: Nombre y email del actor, roles empresariales activos en el momento de la mutación, dirección IP y User-Agent del cliente.
3. **Alerta de Restricción RBAC**: Aparece dinámicamente si `financial_masked: true`, informando al usuario que las cifras monetarias fueron enmascaradas por políticas del rol.
4. **Comparador Visual de Estados (Diff)**:
   - Panel izquierdo en tono rojizo suave (`rgba(239, 68, 68, 0.04)`): **Estado Anterior (Previous Values)**.
   - Panel derecho en tono verde esmeralda (`rgba(26, 255, 110, 0.04)`): **Nuevo Estado (New Values)**.
   - Resaltado de lista de campos modificados (`changed_fields`).
   - Panel de metadatos técnicos en JSON monoespaciado.

---

### 4. CERTIFICACIÓN DE ADAPTABILIDAD RESPONSIVA

El Centro de Actividad fue verificado mediante pruebas automatizadas de renderizado con Playwright:
- **Desktop (1280px)**: Bento cards en fila de 4 columnas, tabla expandida con scroll horizontal interno protegido y modal centrado de 820px.
- **Tablet (768px)**: Bento cards en cuadrícula 2x2, tabla con scroll horizontal suave sin desbordamiento de la página principal (`scrollWidth <= viewport + 2`).
- **Mobile (390px - iPhone 12/13/14)**: Stat cards apiladas verticalmente, filtros en bloque adaptable y modal a ancho completo adaptado a pantalla táctil.
