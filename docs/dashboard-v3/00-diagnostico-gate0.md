# LEVELPRO AUDIO — DASHBOARD EXPERIENCE V3
## DOCUMENTO DE AUDITORÍA, DIAGNÓSTICO Y ARQUITECTURA VISUAL (GATE 0)

**Proyecto:** LevelPro Audio Dashboard Experience V3 — Editorial Bento & High-Fidelity UI  
**Fecha:** 2026-11-05  
**Rama Base:** `feat/levelpro-dashboard-v3-editorial-bento` (creada sobre `main` @ `2dd2ae9`)  
**Referencias Obligatorias:** Referencias A, B, C y D (Estilo Lumin / Editorial Bento)  

---

## 1. Estado Actual del Repositorio y Entorno

- **Rama:** `feat/levelpro-dashboard-v3-editorial-bento`
- **Commit Base:** `2dd2ae9` (incluye Dashboard V2 validado al 100% + Parche 13.2 de checkout/pagos).
- **Frontend Stack:** React 19.2, Vite 8, React Router 7, TanStack Query 5, Zustand 5, Recharts 3, Lucide React 0.469.
- **Backend:** Django 5.2 REST Framework con base de datos PostgreSQL, APIs para pedidos, inventario, cursos, servicios, fidelización y sorteos.
- **Guardarraíles Innegociables:**
  - 0 modificaciones a backend, endpoints o migraciones.
  - 0 datos falsos o métricas hardcodeadas en producción.
  - Preservación íntegra de roles (`AdminRoute`, `ProtectedRoute`).
  - Preservación de la identidad LevelPro: tipografías Geist / Geist Mono, verde neón `#1AFF6E`, logo oficial y tokens de botones.

---

## 2. Estudio Profundo de las Cuatro Referencias Visuales

### Referencia A (`webdesign bento style.jpeg`): Dirección Editorial & Proporciones
- **Principios Clave:**
  - Composición editorial asimétrica donde el contenido de texto respira junto a tarjetas visuales y de producto.
  - Jerarquía tipográfica audaz: grandes encabezados con excelente kerning y espaciado negativo generoso.
  - Navegación superior con **píldora negra** para el elemento activo (`Home`) y enlaces limpios sin saturación visual.
  - Controles circulares de navegación (`width: 36px, height: 36px, border-radius: 50%`) y botones de píldora flotantes.
  - Micro-indicadores numerados (`01`, `02`, `03`) integrados como cápsulas.

### Referencia B (`Panel de banca lumin minimalista.png`): Minimalismo Fintech de Lujo
- **Principios Clave:**
  - Lienzo claro ultra suave (`#F7F8FA` / `#EEF0F2`) que proyecta orden, calma y tecnología de alta gama.
  - Tarjetas flotantes con radios amplios (22–28px) y micro-bordes suaves (`#E8ECEF`), eliminando bordes toscos o sombras pesadas.
  - Contraste absoluto entre tarjetas blancas y **tarjetas Obsidian negras** flotantes.
  - Tiles cuadrados con color de acento para destacar productos, promociones o estados especiales.
  - Organización modular en la que cada tarjeta tiene un propósito funcional claro sin repetición de formatos.

### Referencia C (`Panel de Analítica Lumin.png`): Dirección Primaria para Admin Home
- **Principios Clave:**
  - **Navegación horizontal superior flotante:** Barra integrada en la parte superior con logotipo a la izquierda, píldora negra en el ítem activo (`Analytics`), controles circulares a la derecha (búsqueda, notificaciones, perfil).
  - **Barra de contexto / subheader:** Botón de retroceso circular, título "Analytics" con peso limpio y ligero, controles a la derecha (búsqueda, filtro, selector de fecha en píldora y botón "+ Add Widget").
  - **Bento Grid Asimétrico:**
    1. **Tarjeta Hero Obsidian (Izquierda):** Tarjeta negra (`#0C0D0E`) con Donut de gasto/ingresos iluminado en verde neón, selector de categoría en píldora, cifra principal en blanco grande y nota explicativa.
    2. **Tarjeta Ancha de Gráfico:** Curva de evolución fluida (spline line chart) con etiquetas de meses, punto interactivo seleccionado con píldora flotante e indicadores de variación porcentual.
    3. **Micro-listas de transferencias / personas:** Avatares circulares, nombre, montos limpios y mini barras de progreso verde.
    4. **Tarjeta de Categorías:** Barra de progreso segmentada en la parte superior y lista de comercios con íconos circulares negros de alto contraste.

### Referencia D (`Laptop con panel financiero Lumin.png`): Dirección Primaria para Usuario Home
- **Principios Clave:**
  - **Saludo editorial:** `+ Hello, Michael!` con tipografía amable y sofisticada.
  - **Tarjeta Hero Obsidian vertical:** Ubicada en la columna izquierda, abarca toda la altura de la sección. Muestra saldo/estado principal, 4 botones de acción circulares, barra de progreso segmentada y detalles de cuenta.
  - **Tiles de acento en verde neón:** 3 tarjetas compactas en verde neón con íconos 3D y botón de acción circular con flecha `→`.
  - **Gráfico de actividad y lista de historial:** Historial agrupado por fecha ("Today", "Yesterday") con íconos circulares, montos con signo (`-$45.90`, `+$1,250.00`) y marcas asociadas.

---

## 3. Diagnóstico de Brecha: ¿Por qué Dashboard V2 no alcanza esta estética?

Tras auditar el código actual (`AdminLayout.jsx`, `DashboardLayout.jsx`, `AdminDashboard.jsx`, `Dashboard.jsx`, `admin-ui.css`):

1. **Dependencia del Riel Lateral Oscuro:**
   - En V2, el riel vertical izquierdo (80px–240px) impone una división rígida en la pantalla y reduce el espacio horizontal disponible, impidiendo la sensación de lienzo abierto que tienen las referencias de Lumin.
2. **Rejillas Simétricas de KPIs Tradicionales:**
   - V2 utiliza strips de 3 o 4 tarjetas `StatCard` idénticas en una sola fila horizontal. Esto aplana la jerarquía visual; ninguna métrica parece más importante que otra.
3. **Falta de Controles Circulares y Píldoras:**
   - Los botones de V2 son mayormente rectangulares con esquinas redondeadas estándar. Faltan los botones circulares minimalistas (`36px` a `40px` de diámetro) para acciones secundarias (`↗`, filtros, botones de acción) que caracterizan a Lumin.
4. **Gráficos Convencionales:**
   - El gráfico de barras actual de Recharts en V2, aunque funcional, se siente como un dashboard estándar de administración, sin la elegancia de los donuts con segmentación de ticks ni las líneas de onda fluidas con tooltips en cápsula negra.
5. **Acentos de Color:**
   - En V2, el verde `#1AFF6E` se usa como un color complementario, pero no produce el contraste dramático de "elemento luminoso sobre fondo oscuro" o "tile de alta energía" de las referencias B, C y D.

---

## 4. Arquitectura Visual V3: Sistema "Editorial Bento"

### 4.1. Paleta de Tokens V3
```css
:root {
  --v3-obsidian:     #0C0D0E;  /* Negro absoluto de alto contraste */
  --v3-carbon:       #17191B;  /* Superficie secundaria oscura */
  --v3-canvas:       #F7F8FA;  /* Fondo de pantalla ultra suave */
  --v3-surface:      #FFFFFF;  /* Tarjetas blancas principales */
  --v3-surface-soft: #F0F2F5;  /* Rellenos secundarios y hover */
  --v3-border:       #E8ECEF;  /* Borde ultra sutil */
  --v3-border-light: rgba(0, 0, 0, 0.04);
  --v3-text-primary: #101214;  /* Texto principal de alto contraste */
  --v3-text-muted:   #7D858E;  /* Etiquetas y metadatos secundarios */
  --v3-accent:       #1AFF6E;  /* Verde neón oficial LevelPro */
  --v3-accent-dim:   rgba(26, 255, 110, 0.12);
  --v3-accent-glow:  rgba(26, 255, 110, 0.35);
  --btn-green:       #1A9D4E;  /* Verde de botón oficial LevelPro */

  /* Radios y Geometría */
  --v3-radius-hero:  28px;
  --v3-radius-card:  22px;
  --v3-radius-tile:  16px;
  --v3-radius-pill:  9999px;

  /* Sombras Lumin */
  --v3-shadow-card: 0 4px 20px -2px rgba(12, 13, 14, 0.03), 0 1px 3px rgba(12, 13, 14, 0.02);
  --v3-shadow-hero: 0 24px 48px -12px rgba(12, 13, 14, 0.28);
}
```

### 4.2. Nueva Navegación Horizontal Flotante (Floating Topbar)
En lugar de un sidebar lateral invasivo, diseñamos una **isla horizontal superior**:
- **Izquierda:** Isotipo de LevelPro Audio con tipografía nítida en negro o blanco.
- **Centro:** Barra de píldoras:
  - Admin: `Dashboard` (píldora negra activa), `Ventas`, `Catálogo`, `Academia`, `Servicios`, `Fidelización`, `Finanzas`.
  - Usuario: `Inicio` (píldora negra activa), `Mis pedidos`, `Favoritos`, `Mis cursos`, `Servicios`, `Puntos`, `Rewards`, `Perfil`.
- **Derecha:** Herramientas circulares:
  - Botón circular de búsqueda global.
  - Botón circular de notificaciones con badge verde neón.
  - Avatar circular del usuario con iniciales o foto.

### 4.3. Biblioteca de Componentes Bento V3
1. `<V3TopNav />`: Barra de navegación horizontal superior flotante con píldoras activas y menú colapsable para pantallas compactas.
2. `<V3SubHeader />`: Cabecera editorial con botón circular de retroceso, título grande de peso elegante y barra de filtros temporales (`24 Ene - 27 Feb, 2026`).
3. `<V3BentoGrid />`: Grid CSS asimétrico modular con soporte de proporciones complejas (columnas de 3fr, 4fr, 5fr y filas combinadas).
4. `<V3ObsidianHeroCard />`: Tarjeta protagonista negra con fondo `#0C0D0E`, grandes cifras en blanco, botón circular `↗` y widget integrado (Donut en Admin, Balance/Estado en Usuario).
5. `<V3WhiteCard />`: Tarjeta blanca pura `#FFFFFF` con radio de 22px, micro-borde `#E8ECEF` y padding espacioso.
6. `<V3AccentTile />`: Tile de acento verde neón (`#1AFF6E`) con texto en negro para acciones promocionales de alta visibilidad.
7. `<V3CircularButton />`: Botón circular (`width: 36px, height: 36px, border-radius: 50%`) para acciones rápidas, filtros y enlaces `↗`.
8. `<V3SplineChart />`: Gráfico de línea suave Recharts con curva de onda tipo spline, tooltip en cápsula oscura y puntos interactivos.
9. `<V3DonutGauge />`: Medidor circular con arco en verde neón LevelPro y base segmentada.

---

## 5. Plan de Ejecución para GATE 1

Para cumplir rigurosamente con Gate 1 y no saltar a páginas interiores sin aprobación:
1. Implementar la nueva capa de estilos y componentes V3 en `admin-ui.css`.
2. Crear los dos prototipos funcionales de **Admin Home** y **Usuario Home**.
3. Capturar las 4 vistas maestras exactas:
   - `Admin Home Desktop (1440x900)`
   - `Usuario Home Desktop (1440x900)`
   - `Admin Home Mobile (390x844)`
   - `Usuario Home Mobile (390x844)`
4. Presentar el reporte comparativo visual explicando cómo cada bloque refleja las referencias B, C y D.
5. **DETENERSE Y SOLICITAR APROBACIÓN VISUAL EXPLÍCITA DEL USUARIO**.
