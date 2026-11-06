# LevelPro Audio V3.2.1 — Lote 3: Academia, Usuarios y validación

Base: `480d7c0c7ceb5e2d973711c7f41d80a726844ca3` (`feat:LEVELPRO_AUDIO_V3.2.1_LOTE2`).

Este lote continúa el refinamiento V3.2 y conserva la identidad Editorial Bento, las rutas y las capacidades existentes. **Patch 14 permanece pausado.** No incluye funciones de ese roadmap ni conversiones cambiarias.

## Hallazgos comprobados y correcciones

| Área | Problema anterior | Resultado |
| --- | --- | --- |
| Módulos y lecciones | Un fallo de consulta aparecía como listado vacío; se podía abrir la creación sin las opciones necesarias. | Carga, error y vacío diferenciados; reintento; creación y edición bloqueadas mientras faltan cursos o módulos. |
| Inscripciones | La pantalla leía `progress_percentage`, pero la API administrativa devuelve `progress`. Todos los avances parecían cero. | Campo real de la API, cero válido, datos ausentes como «—», barras accesibles y promedio sin sustituir datos desconocidos por cero. |
| Alcance de indicadores | Inscripciones y roles de Usuarios se presentaban como totales completos, aunque las consultas tienen límites. | Inscripciones identifica la vista de hasta 200 recientes. Roles se cuentan sobre la vista; Usuarios conserva el total real `count` e informa cuando muestra una lista parcial de hasta 100. |
| Inscripción manual | Una selección incompleta no daba respuesta; las consultas auxiliares recibían accidentalmente el contexto de React Query como parámetros HTTP. | Validación visible, consultas con parámetros explícitos y conservación de selecciones ante rechazo del servidor. |
| Certificaciones | Fallos de cursos se confundían con ausencia de cursos. Un administrador podía guardar sin poder revisar los requisitos. | Error y reintento dentro del formulario; guardado bloqueado hasta cargar opciones; conserva requisitos seleccionados y borrador. Cero cursos continúa siendo válido cuando la consulta responde correctamente. |
| Usuarios | El frontend deducía todos los roles como Cliente porque la API no devolvía los indicadores necesarios. | API administrativa añade `is_staff` e `is_superuser`; UI presenta Super/Admin/Cliente con datos explícitos y «Sin datos» cuando faltan. Permisos existentes conservados. |
| Botones compartidos | Algunos consumidores entregaban `icon` y `label`, pero `IconButton` no los renderizaba: acciones sin icono ni nombre accesible. | Iconos SVG y nombres accesibles, manteniendo soporte para hijos, enlaces, carga y deshabilitado. |
| Modales en móvil | `PageTransition` transformaba la raíz de la aplicación incluso en reposo. Los elementos `fixed` se posicionaban contra la altura de la página y podían quedar fuera de pantalla. | Se conserva la transición de opacidad, retirando la transformación global. La capa de modales cubre la navegación; botones visibles y foco dentro del diálogo. |
| Video de lecciones | El selector de archivo estaba oculto con `display:none`, fuera del recorrido de teclado. | Selector accesible, foco visible y validación de título/módulo antes de pedir una URL de carga. Se conserva el PUT firmado, la URL externa y el video existente cuando no se reemplaza. |
| Dashboard / productos vendidos | `revenue=Sum("price")` sumaba precios unitarios, ignorando cantidades mayores que uno. | Suma `price × quantity`, manteniendo el filtro de la moneda elegida y los estados de orden existentes. |
| ESLint y compilación | El lint tenía errores/advertencias pendientes y no formaba parte del Dockerfile de producción. | Limpieza de símbolos sin uso y dependencias de efectos; emisor de toast separado del componente React; lint con cero advertencias incorporado al build antes de unitarias/Vite/control del bundle. |

El ingreso por producto representa el importe de sus líneas: no se redefine como utilidad ni como total neto después de descuentos o despacho. No se reescriben órdenes, pagos, monedas ni historiales. No hay migraciones ni cambios de dependencias o lockfile.

## Componentes y archivos relevantes

- `backend/apps/analytics/views.py`: multiplicación por cantidad en `dashboard_overview` y flags de rol en `admin_users`.
- `backend/apps/analytics/tests_lote3_reporting.py`: regresión para CLP/USD/ARS, roles reales y acceso administrativo.
- `frontend/src/pages/admin/AdminModules.jsx`, `AdminLessons.jsx`, `AdminEnrollments.jsx`, `AdminCertifications.jsx`, `AdminUsers.jsx`: estados, recuperación, formularios y contrato de datos.
- `frontend/src/utils/adminListData.js`: progreso y roles sin valores inventados.
- `frontend/src/components/admin/ui/Buttons.jsx`, `FormModal.jsx`: iconos, accesibilidad y bloqueo de guardado por dependencias.
- `frontend/src/components/ui/PageTransition.jsx`, `frontend/src/styles/admin-ui.css`: posición y capas de modales, selector de video accesible.
- `frontend/src/utils/toast.js` y `frontend/src/components/ui/ToastNotification.jsx`: emisor compartido, avisos accesibles y limpieza del temporizador. Los consumidores solo cambian su import.
- Limpieza de lint en `AuthShell`, `ProductRow`, `ShopFilters`, `ServiceProcess`, `StudioUI`, `useMagneticHover`, `CourseDetail`, `Home`, `NotFound`, `ServiceDetail`, `Shop` y `AdminCategories`; sin rediseñar esas pantallas.
- `frontend/eslint.config.js`: excepción acotada para parámetros `Icon`, usados como componentes JSX que la regla básica no reconoce. Se mantienen las desactivaciones preexistentes de reglas de React Compiler; este lote no certifica compatibilidad con React Compiler.
- `frontend/package.json`, `frontend/Dockerfile.prod`: inclusión de pruebas nuevas y puerta de lint.
- `frontend/tests/v3-2-1-admin-data.test.mjs`, `frontend/tests/v3-2-1-academy.browser.mjs`: contratos y regresiones de interacción.

## Validación

La prueba de ingresos por producto y la de roles fallaron sobre el código anterior antes de aplicar las correcciones. Luego pasaron con los cambios.

| Comprobación local | Resultado |
| --- | --- |
| Backend completo, Django/Python 3.12, SQLite de pruebas | 720 aprobadas, 12 omitidas; 6 subpruebas nuevas aprobadas. 8 advertencias de dependencias preexistentes. |
| `manage.py check` | Sin problemas ni comprobaciones silenciadas. |
| `makemigrations --check --dry-run` | Sin cambios. |
| `npm run lint` | Cero errores y advertencias de ESLint. |
| `npm run test:unit` | 91 aprobadas. |
| `npm run build` | Vite compiló correctamente. |
| `npm run check:bundle` | Dentro del presupuesto: JS inicial 460.788 bytes; gzip 143.682 bytes. |
| Navegador sobre compilación de producción local | 79 aprobadas: 56 existentes y 23 nuevas. Cero fallos y cero omitidas. |
| Aplicación del patch sobre una copia limpia de la base | Verificada con `git apply --check`, aplicación y comparación del árbol resultante. Una segunda aplicación se rechaza; no aplicar dos veces. |

Frontend validado con Node 24.22.1/npm 11.9.0, dentro del rango del proyecto. La imagen de producción conserva Node 24.19.0. El proyecto usa JavaScript/JSX: no hay una compilación TypeScript que declarar aprobada.

La suite de navegador intercepta todas las API y subidas con datos sintéticos. Cubre las cinco pantallas, carga/error/vacío y reintento, bloqueos por dependencias, creación/edición/eliminación, recuperación de formularios, requisitos de certificados, progreso, roles, toast, teclado y vistas de 320/390/768/1024/1280/1440 px. El resto de la suite conserva regresiones de retorno de pagos, transferencias, SEO y rutas públicas. No se crean cobros, inscripciones ni archivos reales en producción.

**Límites de esta validación:** no equivale a una sesión autenticada contra la base real, ni a pruebas de pasarelas, correo o almacenamiento de producción. PostgreSQL y sus pruebas específicas no se ejecutaron en este entorno. No se ha ejecutado Cloud Build ni desplegado este lote desde esta sesión.

## Aplicación y comprobación en el repositorio

Con el Lote 2 aplicado y el árbol de trabajo limpio, desde la raíz del repositorio:

```bash
git apply --check ~/Downloads/LEVELPRO_AUDIO_V3.2.1_LOTE3.patch
git apply ~/Downloads/LEVELPRO_AUDIO_V3.2.1_LOTE3.patch
git diff --check
```

Para ejecutar la QA de Cloud Build, incluidas las comprobaciones de PostgreSQL, sin desplegar:

```bash
gcloud builds submit . --config cloudbuild.v3-2-qa.yaml
```

Esta configuración ejecuta backend, migraciones en dry-run, pruebas específicas de PostgreSQL, lint, unitarias, build y presupuesto de bundle. La suite Playwright se ejecuta por separado con `npm run test:browser` y Chromium instalado; no forma parte de esa configuración. El `cloudbuild.yaml` habitual sí despliega y no debe confundirse con la configuración de QA.

Revisión de aceptación: abrir las cinco pantallas en escritorio/móvil; comprobar altas y ediciones de prueba, recuperación ante errores, selección de cursos, subida de video y roles con cuentas apropiadas. Los nombres y porcentajes deben coincidir con los registros reales.

## Checklist que sigue pendiente en la fase V3.2

- Refinamiento y QA específicos de Servicios, Loyalty administrativo, Rewards detallado y las rutas públicas restantes.
- Revisión visual autenticada de todas las rutas y estados sobre datos reales. Este lote cubre cinco pantallas y componentes compartidos, no certifica las 62 páginas de la plataforma.
- Conciliación manual de movimientos históricos sin moneda y documentos tributarios extranjeros previos; no inferir monedas ni convertir importes automáticamente.
- Resolver la cobertura de listas extensas: usuarios por encima de 100, inscripciones por encima de 200 y categorías de inventario por encima de 200 SKUs. Este lote informa la cobertura actual, no implementa paginación de servidor adicional.
- Validación operativa controlada de pagos, correo, cursos/video, stock y despacho en el entorno correspondiente.
- Informe y aceptación final de la fase integral antes de reanudar Patch 14.

Este documento actualiza los pendientes de Academia interna y Usuarios enumerados en `09-v3-2-1-operaciones-e-inventario.md`; los demás pendientes siguen abiertos.

## Inventario de archivos del lote

56 archivos; gran parte de los cambios de una línea actualiza el import del emisor de avisos.

```text
backend/apps/analytics/tests_lote3_reporting.py
backend/apps/analytics/views.py
docs/dashboard-v3/10-v3-2-1-lote3-academia-usuarios-qa.md
frontend/Dockerfile.prod
frontend/eslint.config.js
frontend/package.json
frontend/src/components/admin/BulkImportPanel.jsx
frontend/src/components/admin/ui/Buttons.jsx
frontend/src/components/admin/ui/FormModal.jsx
frontend/src/components/auth/AuthShell.jsx
frontend/src/components/product/FavoriteButton.jsx
frontend/src/components/product/ProductCard.jsx
frontend/src/components/product/ProductRow.jsx
frontend/src/components/product/ShopFilters.jsx
frontend/src/components/services/ServiceProcess.jsx
frontend/src/components/ui/PageTransition.jsx
frontend/src/components/ui/StudioUI.jsx
frontend/src/components/ui/ToastNotification.jsx
frontend/src/hooks/useMagneticHover.js
frontend/src/pages/Academy.jsx
frontend/src/pages/CourseDetail.jsx
frontend/src/pages/Home.jsx
frontend/src/pages/NotFound.jsx
frontend/src/pages/ProductDetail.jsx
frontend/src/pages/Rewards.jsx
frontend/src/pages/ServiceDetail.jsx
frontend/src/pages/Shop.jsx
frontend/src/pages/admin/AdminAcademy.jsx
frontend/src/pages/admin/AdminBilling.jsx
frontend/src/pages/admin/AdminBrands.jsx
frontend/src/pages/admin/AdminCategories.jsx
frontend/src/pages/admin/AdminCertifications.jsx
frontend/src/pages/admin/AdminEnrollments.jsx
frontend/src/pages/admin/AdminFinance.jsx
frontend/src/pages/admin/AdminLessons.jsx
frontend/src/pages/admin/AdminModules.jsx
frontend/src/pages/admin/AdminOrders.jsx
frontend/src/pages/admin/AdminPaymentMethods.jsx
frontend/src/pages/admin/AdminPayments.jsx
frontend/src/pages/admin/AdminProducts.jsx
frontend/src/pages/admin/AdminRewardsCampaignDetail.jsx
frontend/src/pages/admin/AdminRewardsCampaigns.jsx
frontend/src/pages/admin/AdminRewardsWinners.jsx
frontend/src/pages/admin/AdminServices.jsx
frontend/src/pages/admin/AdminSettings.jsx
frontend/src/pages/admin/AdminSpecialOrders.jsx
frontend/src/pages/admin/AdminUsers.jsx
frontend/src/pages/dashboard/MyBookings.jsx
frontend/src/pages/dashboard/MyCourses.jsx
frontend/src/pages/dashboard/MyLoyalty.jsx
frontend/src/pages/dashboard/Profile.jsx
frontend/src/styles/admin-ui.css
frontend/src/utils/adminListData.js
frontend/src/utils/toast.js
frontend/tests/v3-2-1-academy.browser.mjs
frontend/tests/v3-2-1-admin-data.test.mjs
```
