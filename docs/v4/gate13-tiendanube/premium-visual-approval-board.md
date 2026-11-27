# TABLERO DE APROBACIÓN VISUAL PREMIUM — `LEVELPRO PRECISION` (GATE 13 · PHASE 1.2)

> **Propósito:** Someter a aprobación expresa del propietario el rediseño artístico `LEVELPRO PRECISION` antes de autorizar cualquier cambio en código de **Phase 2**.  
> **Naturaleza de las capturas:** Las imágenes `BEFORE` preservan exactamente (byte a byte) las 11 propuestas aprobadas estructuralmente en Phase 1.1 (`./visual-board/proposals/*.png`); las imágenes `AFTER` y las 5 variantes responsivas son **mockups estáticos aislados de planificación (`static_isolated_planning_mockup`)** renderizados `@2x` con fuentes `Geist`/`Geist Mono`, iconos `lucide-react` y activos oficiales LevelPro. **No constituyen código implementado ni capturas de producción.**

---

## 1. Controles de marca y transparencia técnica

- **Logotipo principal (`frontend/src/assets/logo.png`):** Integrado en tinta `#09090B` sobre blanco (`240 px` sidebar y drawer mobile) respetando estrictamente su ratio original `10:3` (`2000×600 px`) **sin recuadros negros artificiales**. En entorno oscuro (preview CMS Storefront) se utiliza en blanco directo sobre `#09090B`.
- **Isotipo positivo (`frontend/public/favicon.png`):** Integrado (`24×24 px`, `1:1`) en el rail colapsado de `48 px`, tablet (`768 px`) y cabecera mobile (`390 px` / `320 px`). Se descarta completamente `favicon.svg` (`#863BFF` genérico) y todo monograma `"LP"` inventado.
- **Brecha de activo registrada:** Al no existir todavía una versión SVG/PNG nativa en positivo de `logo.png` en el repositorio, el tablero utiliza máscara alfa exacta sobre `logo.png` sin distorsión. Para Phase 2 se recomienda incorporar `logo-dark.svg`/`logo-dark.png` oficial o mantener máscara CSS validada.
- **Trazabilidad Lumin (`behance.net/gallery/195833195`):** Acceso automatizado devuelve `HTTP 400 Bad Request` desde terminal; el estándar visual se apoya únicamente en los principios editoriales documentados internamente en `docs/dashboard-v3/00-diagnostico-gate0.md` sin declarar clones ni porcentajes sintéticos de similitud.

---

## 2. Comparaciones `BEFORE` (Phase 1.1) vs. `AFTER` (`LEVELPRO PRECISION`) — 11 Láminas

### 01 · Sidebar Expandido (`240 px`) y Rail Colapsado (`48 px`)
![01 Sidebar Before/After](./precision-board/comparisons/01-ba-sidebar.png)

### 02 · Header (`56 px`), Command Palette (`⌘K`) y Centro de Notificaciones
![02 Header Before/After](./precision-board/comparisons/02-ba-header.png)

### 03 · Dashboard (`/admin`) — SummaryStats, Curva Spline y Actividad
![03 Dashboard Before/After](./precision-board/comparisons/03-ba-dashboard.png)

### 04 · Listado de Productos (`/admin/products`) — BulkBar y Catálogo Pro-Audio
![04 Product List Before/After](./precision-board/comparisons/04-ba-product-list.png)

### 05 · Ficha de Producto (`/admin/products/:id`) — Layout Asimétrico `2/3 + 1/3`
![05 Product Form Before/After](./precision-board/comparisons/05-ba-product-form.png)

### 06 · Detalle de Pedido en `SideModal` (`580 px` — Estados Desacoplados y RMA)
![06 Order SideModal Before/After](./precision-board/comparisons/06-ba-order-sidemodal.png)

### 07 · `DataTable` Unificada (`/admin/orders` — Selección Múltiple y Popover)
![07 DataTable Before/After](./precision-board/comparisons/07-ba-datatable.png)

### 08 · Formularios Especializados (`/admin/costing` — Validaciones `FormField`)
![08 Forms Before/After](./precision-board/comparisons/08-ba-forms.png)

### 09 · Modales de Captura Atómica y Confirmación Destructiva (Contexto WMS)
![09 Modals Before/After](./precision-board/comparisons/09-ba-modals.png)

### 10 · Configuración y Editorial CMS (`/admin/settings` — Preview Storefront Vivo)
![10 Settings CMS Before/After](./precision-board/comparisons/10-ba-settings-cms.png)

### 11 · Experiencia Mobile Responsive (`390×844` Drawer + `320×720` Compacto)
![11 Mobile Before/After](./precision-board/comparisons/11-ba-mobile.png)

---

## 3. Verificación Responsive y Estado Colapsado (`horizontal_overflow_px: 0`)

| Variante | Viewport | Desbordamiento horizontal | Captura individual (`AFTER`) |
| --- | --- | --- | --- |
| Desktop estándar (`240 px` sidebar) | `1440×900` | `0 px` | [var-01-desktop-1440x900.png](./precision-board/variants/var-01-desktop-1440x900.png) |
| Desktop colapsado (`48 px` rail) | `1440×900` | `0 px` | [var-02-desktop-collapsed-1440x900.png](./precision-board/variants/var-02-desktop-collapsed-1440x900.png) |
| Tablet (`1 col` apilada) | `768×1024` | `0 px` | [var-03-tablet-768x1024.png](./precision-board/variants/var-03-tablet-768x1024.png) |
| Mobile estándar (Drawer abierto) | `390×844` | `0 px` | [var-04-mobile-390x844.png](./precision-board/variants/var-04-mobile-390x844.png) |
| Mobile compacto extremo | `320×720` | `0 px` | [var-05-mobile-compact-320x720.png](./precision-board/variants/var-05-mobile-compact-320x720.png) |

![Variante Desktop Colapsado](./precision-board/variants/var-02-desktop-collapsed-1440x900.png)
![Variante Tablet 768px](./precision-board/variants/var-03-tablet-768x1024.png)
![Variante Mobile 320px](./precision-board/variants/var-05-mobile-compact-320x720.png)

---

## 4. Manifiesto íntegro de integridad SHA-256 (`premium-before-after-manifest.json`)

| ID | Lámina | `BEFORE` SHA-256 (Bytes) | `AFTER` SHA-256 (Bytes) | `COMPARISON` SHA-256 (Bytes) |
| --- | --- | --- | --- | --- |
| `01` | Sidebar & Rail | `285ad0f20d09a36a826d188fbf07bcfb4af639166f754ea0a073a8a1df7f025a` (`259804`) | `4330b99ae86ac78e1b8ba7f35d77c22e861c35207a09f26f392859c634993906` (`248379`) | `99799eeb3cc925041717b569d83c79a90044b04fd6841cf4ce2e1189b3717993` (`515136`) |
| `02` | Header & `⌘K` | `57fa7aaaf498b828a092810190777a9a06817cc16ac8b7e264e56038412971cc` (`277253`) | `d49a483e74016bd7515dae78ab20123a354d520b5bef48a3a68633429b88b64b` (`304232`) | `bd2eb2fd86ee2d78d0c0453053e35eb5d6a8bfad83a76365ddb2c5f552fd8e84` (`539947`) |
| `03` | Dashboard | `11d5cdbc5fe98e13a4951a82384fc161c5b705b530c79783c5cd3e03329d97a9` (`354760`) | `ff898216e62c8065c8dae1baefcd94e662670622504cfc954613dfbce793ce90` (`383800`) | `428bbdd0f4f475a2d3a72885c77b6470557e3f63d99d0ce63fce16516c496e15` (`719921`) |
| `04` | Product List | `c3412774988208841a60de7e887259d5c98e701517c617bda7adc07063c6dcba` (`420078`) | `709817363eb47c26cbdd3682f473e5445d58ecea9e1698eb0a8407948e9eab4f` (`414414`) | `062c99bf095fcf54019b900fea6028b664b2e5b71b0270b6d0fbcaacb7d0ae79` (`767825`) |
| `05` | Product Form | `4e8b705320d89c5a8907871a908760f4b931de24fc6cec6392381b6ecac41807` (`419875`) | `3c0ffbf702438ae9e806feaeea490947193de4fe3bda81a60f0e3ff2c70795cb` (`443611`) | `34a6c5811453af085fd813a6cb912d7db5ec1bf5d22c6efa66cd3cb78e010ca3` (`813145`) |
| `06` | Order `SideModal` | `7bcd1ce1fb358048e79c7e837e49a001810d02c900ba0860ff0aeada392e4a1b` (`312685`) | `3d0fc8887a1cf95b74f281058d987b33c39e0dffd4ba90bb967af7889d11b056` (`326752`) | `49fdfed58ad163aa1d0f192dc199b76e86749214016dc3cc430a5f4dea4c375b` (`591374`) |
| `07` | `DataTable` | `7b4557ca637cfd69518d3717edd26db9527dd46787684be85142c8298fb43610` (`231344`) | `f38e3fd32e66d9a8a8361f278a807e535fdfc710f13c720fd31b533e1c567545` (`389951`) | `86ee0798c3fc8abf9f8e5def875f298ff8a096960f3ed2f2e5e2f26547746521` (`592511`) |
| `08` | Forms `FormField` | `03c4bf6e778fd642e70775845d6cd2f1419d47cf3bd8bb2cfd9c150825491e33` (`270563`) | `a3d389f0ed495029c02a981ed68dd5a22cd27b5edc3eb6b649ee111398d216ce` (`384522`) | `4ce367fdcd4e9dd256a74d9683032a950317490e7e84c69d3d054e6101019b57` (`679818`) |
| `09` | Modals & Empty | `af82b82daabdcf33490ada5661f6a9ca1a92243b7e80fd6d81ed101864618c05` (`170091`) | `654b71031319b156ed89dc6173703cafc01a9c448016bd2a3a4346e9e6d95c92` (`279752`) | `8695a84879ceeaadef880aac2387ed6e0ca0d8ffbe0115429c375e2ff1213ce2` (`452088`) |
| `10` | Settings & CMS | `3cbf4b53ab5158516f9fc5734aa94ad05e6a2459e6f48405f9ca36edd66155b1` (`383563`) | `3c837ac059bd8ca5d802f4501696f0edeab25f936fd895f8e2ba4bc29af4c878` (`351194`) | `fbf69108ddbfe842c1e2744d58a40f743d0a01a6f82d9afbcf56d865771c1f30` (`707544`) |
| `11` | Mobile Spread | `36a439f38e95c2895fc418dabff6d38c9d1b54d6b11f173ac36decab7b9c5062` (`194001`) | `2d4df4c44df59f30d68625ed104321883ae51b387d59f5f28bb04652aad944fd` (`182028`) | `7e172a09aee960773baee627caaea4934217866e566cb8fedccd9fa617cf8918` (`461247`) |

---

## 5. Compuerta formal de decisión del propietario (Pre-Phase 2)

| Opción de autorización | Implicación operativa |
| --- | --- |
| **Aprobar `LEVELPRO PRECISION`** | Desbloquea la autorización formal para iniciar **Gate 13 — Phase 2 (Implementación sobre los 38 dominios / 315 superficies)** usando `levelpro-precision-design-tokens.md`. |
| **Solicitar ajustes puntuales** | Mantener detenido el código e iterar únicamente sobre los tableros visuales indicados antes de autorizar Phase 2. |

> **Estado actual:** Implementación **DETENIDA** formalmente en espera de aprobación expresa del propietario.
