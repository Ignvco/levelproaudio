# LEVELPRO OS V4.0 — GATE 13 · PHASE 2
## Accessibility & Contrast Report (WCAG AA)

**Estado:** `COMPLETE` (verificado estática y computacionalmente en `234/234` checks DOM; pruebas interactivas adicionales recomendadas en revisión humana).

### Cumplimiento de Contraste Cromático (WCAG 2.1 AA)

| Superficie / Rol | Foreground | Background | Ratio / Estado | Verificación |
| :--- | :--- | :--- | :---: | :--- |
| Texto primario | `#09090B` (Deep Black) | `#FFFFFF` / `#F5F5F5` | `>= 18.4:1` (`AAA`) | Computed DOM `234/234` |
| Texto secundario / Labels | `#52525B` / `#71717A` | `#FFFFFF` | `>= 4.8:1` (`AA`) | Auditoría CSS & Módulos M |
| Verde semántico en texto / badges (`--admin-primary-text`) | `#0F7A38` | `#FFFFFF` / `#F0FDF4` | `>= 5.3:1` (`AA`) | Reemplazado `#1AFF6E` texto en Marketing, B2B, Roles, Audit, Users, Rewards |
| Botón primario (`PrimaryButton`) | `#FFFFFF` | `#09090B` | `19.6:1` (`AAA`) | Tokens A–B |
| Restricción `#1AFF6E` texto (`VIS-BAN-06`) | Prohibido sobre fondos claros | Indicadores `2.5px` / dots / badge fills solamente | `0` violaciones | Auditado en `234` celdas DOM |

### Accesibilidad Estructural y Teclado

1. **Modales y Drawers (`FormModal`, `SideModal`, `ConfirmationModal`):**
   - `role="dialog"`, `aria-modal="true"`, `aria-labelledby` único (`useId`).
   - Trampa de foco (`Tab` / `Shift+Tab`), cierre con tecla `Escape`, restauración del foco previo al cerrar y bloqueo de scroll en `body`.
2. **Tabs y Controles (`AdminTabs`, `.au-tabs`, `SwitchToggle`):**
   - `role="tablist"`, `role="tab"`, `aria-selected={isActive}` en Orders OMS, B2B, CRM, Costing, Marketing, CMS Settings y Roles.
   - `SwitchToggle` implementado con `role="switch"` y `aria-checked`.
3. **Navegación Sidebar / Mobile (`AdminLayout.jsx`):**
   - Submenús con `aria-expanded` y botón hamburguesa con `aria-label="Abrir menú lateral"` (`#v3-mobile-toggle-btn` / `data-testid="admin-mobile-menu"`).
4. **Remediación Crítica de Legibilidad (Bloque M):**
   - `AdminAudit.jsx` y `AdminRoles.jsx` contenían tarjetas/tablas heredadas con fondos oscuros `#0D0E11` / `#14161B` y texto translúcido claro incompatible con modales y shell claros. Reescritos integralmente a superficies claras `#FFFFFF` / `#FAFAFA` y `SideModal` legible.
