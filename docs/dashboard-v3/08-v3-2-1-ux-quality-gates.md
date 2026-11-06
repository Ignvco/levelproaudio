# LevelPro Audio V3.2.1 — UX & UI Quality Gates (lote 1)

**Estado:** implementación en rama, sin merge ni despliegue.  
**Base estable:** `dd052aa7b516b96dd18df04f1d85580868cb9eab` (V3.2, Cloud Build reportado como exitoso por el propietario).  
**Rama:** `feat/v3-2-1-ux-quality-gates`.  
**Patch 14:** permanece pausado, no se modifica lógica de pagos, inventario, contabilidad ni pasarelas.

## Objetivo y diseño

Consolidar una experiencia editorial Bento LevelPro coherente en **las páginas interiores del usuario y del administrador**. Reutilizar las tarjetas, tipografía Geist, colores Obsidian/Canvas y acento `#1AFF6E`; evitar un reemplazo masivo de layouts que podría romper los flujos ya existentes.

### Cambios reales de esta entrega

**Base compartida:**
- `AdminPageHeader`: acepta las dos variantes históricas `breadcrumb` y `breadcrumbs`, con jerarquía de navegación reconocible y marca de página actual.
- `FormField`: vincula de forma accesible etiquetas con inputs/selects/textarea directos; conserva campos compuestos sin imponer IDs incorrectos. Admite ayuda y error con `aria-describedby`.
- `DataTable`: mejores nombres de selectores y encabezados, mensajes de error y opción `onRetry` (retrocompatible).
- `Pagination`: navegación semántica, botones `type=button` y página actual anunciada.
- `Buttons`: los enlaces deshabilitados no mantienen manejadores de clic, y los estados de ejecución tienen spinner de carga.
- `EmptyState`: los errores se anuncian por separado de las listas vacías.
- `admin-ui.css`: densidad y alineaciones editoriales consistentes, superficies suaves, texto y formularios, estados de foco, accesibilidad y responsive. Estilos acotados a `.admin-root` de los dos dashboards.

**Usuario / consultas autenticadas:**
- Cursos, Favoritos, Pedidos, Reservas, Mis servicios y Participaciones: un error de API ya no finge que el usuario tenga cero registros. Se ofrecen reintentos y se evita mostrar KPIs falsos.
- Fidelización: cuando falla la API no permanece el skeleton indefinidamente; se pueden reintentar consultas, los fallos al cargar más movimientos se notifican y la FAQ funciona con teclado. No se inventa un mínimo de canje si la API no lo informa.
- Curso: tarjetas navegables por teclado sin ejecutar acciones hijas dos veces.
- Detalle de servicio: diálogo con nombre accesible, foco inicial, Escape y restauración de foco.

**Administrador:**
- Rewards: muestra fallo de consulta y botón de reintento en lugar de loading infinito.
- Servicios: campo de respuesta vinculado correctamente con su etiqueta.
- Configuración: captura errores de carga sin mostrar formularios incompletos, muestra estado de caché desactualizada, sustituye alerts del navegador por notificaciones LevelPro y comparte labels de formulario.

## Integridad funcional y límites

- Cambios limitados a React, CSS, pruebas y documentación; **no hay migraciones nuevas ni modificaciones a Django**.
- Todos los componentes afectados conservan las props anteriores; se agregan opciones retrocompatibles.
- No se cambió ningún endpoint ni contrato de API. El estado `error` debe diferenciarse del estado `empty`.
- No se declara modificada toda la plataforma ni certificados todos los módulos. Este lote es una base transversal, no un cierre visual 1:1 de las aproximadamente 62 páginas inventariadas en V3.2.
- Sigue pendiente la conciliación contable de movimientos históricos multimoneda de V3.2, fuera del alcance de esta mejora visual.
- Si el backend de configuración no responde y ya existe un formulario cargado, se muestra una advertencia de datos posiblemente desactualizados; se conserva el estado local de edición.

## Pruebas nuevas y validación

Se agrega `frontend/tests/v3-2-1-query-states.test.mjs` a `npm run test:unit`.

Se verificó aisladamente que un error tiene prioridad frente a loading/empty, que un cero válido sigue siendo válido y que los resultados paginados se normalizan sin inventar registros. **No se ha ejecutado aún el frontend build completo de este lote**.

Comandos en tu Mac, desde `frontend/`:

```bash
npm ci
npm run lint
npm run test:unit
npm run build
```

Como alternativa sin instalar Python, desde la raíz:

```bash
gcloud builds submit . --config cloudbuild.v3-2-qa.yaml
```

**El Cloud Build de QA no despliega a producción.** No utilizar `cloudbuild.yaml` estándar como preflight porque sí despliega.

### QA autenticada requerida para aceptar lote 1

| Módulos | Escenarios |
|---|---|
| Admin: Rewards y Configuración | Carga normal; API desconectada; reintento; guardar y validar feedback |
| Admin: Servicios | Editar respuesta y verificar label/foco, permisos y estado |
| Cliente: Pedidos, Cursos, Favoritos | Sin registros reales; con registros reales; API desconectada |
| Cliente: Reservas, Servicios, Participaciones | Datos reales, error, reintento y navegación |
| Cliente: Fidelización | Cero puntos, historial, carga siguiente página, error, FAQ con teclado |
| Componentes transversales | FormField, FormModal, DataTable, Pagination, botones deshabilitados |
| Responsive | 1440, 1280, 1024, 768, 430, 390 y 320 px |
| Accesibilidad | Tab/Shift+Tab, Enter/Espacio, foco visible, contrastes, reduced-motion |

**Pendiente por continuar dentro de V3.2.1:** revisión visual autenticada del resto de rutas, paneles internos, responsive de tablas complejas y acciones con múltiples pasos, así como QA integral de perfiles, formularios y permisos.

## Política de publicación

No marcar QA aprobado hasta recibir logs verificables de lint, unit tests y build y ejecutar revisión visual real. No desplegar automáticamente este lote desde la rama. El propietario puede aplicar un patch generado desde la base indicada después de realizar preflight.
