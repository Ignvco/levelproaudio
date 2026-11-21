# LEVELPRO OS V4.0 — GATE 1.1: RBAC ROLE & PERMISSION MATRIX
## Documento 02: Matriz Exhaustiva de Roles Empresariales y Segregación de Funciones

**Estado:** Certificado  
**Versión:** 1.0  
**Fecha:** 20 de Noviembre, 2026  
**Ambiente:** LEVELPRO OS V4.0 Production Baseline  

---

### 1. Matriz Cruzada de Módulos Operativos vs. Roles

A continuación se detalla el mapa oficial de pertenencia a los 12 módulos para cada uno de los 10 roles:

| Módulo Operativo | Super Admin | Gerencia | Ventas | Compras | Bodega | Logística | Finanzas | Marketing | Academia | Soporte |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`dashboard`** |  |  |  |  | ❌ | ❌ |  |  |  | ❌ |
| **`catalog`** |  |  |  |  | ❌ | ❌ |  |  | ❌ | ❌ |
| **`orders`** |  |  |  | ❌ | ❌ |  |  | ❌ | ❌ |  |
| **`inventory`** |  |  | ❌ |  |  | ❌ | ❌ | ❌ | ❌ | ❌ |
| **`purchases`** |  |  | ❌ |  | ❌ | ❌ |  | ❌ | ❌ | ❌ |
| **`logistics`** |  |  | ❌ | ❌ |  |  | ❌ | ❌ | ❌ |  |
| **`finances`** |  |  | ❌ | ❌ | ❌ | ❌ |  | ❌ | ❌ | ❌ |
| **`marketing`** |  |  |  | ❌ | ❌ | ❌ | ❌ |  | ❌ | ❌ |
| **`academy`** |  |  | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |  | ❌ |
| **`services`** |  |  | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |  |
| **`roles`** |  | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **`settings`** |  |  | ❌ | ❌ | ❌ | ❌ | ❌ |  | ❌ | ❌ |
| **Total Módulos** | **12 / 12** | **11 / 12** | **4 / 12** | **4 / 12** | **2 / 12** | **2 / 12** | **5 / 12** | **4 / 12** | **2 / 12** | **3 / 12** |

---

### 2. Matriz Cruzada de Capacidades Sensibles vs. Roles

Detalle de las 11 capacidades sensibles protegidas y su asignación a los roles empresariales:

| Capacidad Sensible | Codename | Super Admin | Gerencia | Ventas | Compras | Bodega | Logística | Finanzas | Marketing | Academia | Soporte |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Ver Costos Adquisición | `view_costs` |  |  | ❌ |  | ❌ | ❌ |  | ❌ | ❌ | ❌ |
| Editar Costos Adquisición | `edit_costs` |  |  | ❌ |  | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ver Márgenes Rentabilidad | `view_margins` |  |  | ❌ | ❌ | ❌ | ❌ |  | ❌ | ❌ | ❌ |
| Acceder Módulo Finanzas | `view_finances` |  |  | ❌ | ❌ | ❌ | ❌ |  | ❌ | ❌ | ❌ |
| Aprobar Pagos Manuales | `approve_payments` |  |  | ❌ | ❌ | ❌ | ❌ |  | ❌ | ❌ | ❌ |
| Modificar Precios Venta | `edit_prices` |  |  | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Aplicar Descuentos/Cupones | `apply_discounts` |  |  |  | ❌ | ❌ | ❌ | ❌ |  | ❌ | ❌ |
| Ajustar Físico Inventario | `adjust_inventory` |  |  | ❌ | ❌ |  | ❌ | ❌ | ❌ | ❌ | ❌ |
| Exportar Datos y Reportes | `export_data` |  |  | ❌ |  | ❌ | ❌ |  | ❌ | ❌ | ❌ |
| Gestionar Roles y Staff | `manage_roles` |  | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Modificar Config. Sistema | `manage_settings` |  |  | ❌ | ❌ | ❌ | ❌ | ❌ |  | ❌ | ❌ |
| **Total Capacidades** | | **11 / 11** | **10 / 11** | **1 / 11** | **3 / 11** | **1 / 11** | **0 / 11** | **5 / 11** | **2 / 11** | **0 / 11** | **0 / 11** |

---

### 3. Justificación de Segregación de Funciones (SoD)

1. **Aislamiento Comercial de Costos (Ventas):**
   - El equipo comercial necesita conocer precios de lista (`price`), precios comparativos (`compare_price`) y aplicar descuentos autorizados (`apply_discounts`).
   - Conocer el `cost_price` y los márgenes de contribución genera riesgo de colusión comercial, desincentivo de venta de productos con menor margen o negociación indebida con clientes B2B. Por ello, `cost_price` y `view_margins` están expresamente vedados.
2. **Aislamiento de Bodega y Existencias:**
   - Bodega gestiona entradas y salidas de almacén (`adjust_inventory`), empaque y despacho físico.
   - No tiene injerencia en contabilidad, conciliación de pagos ni edición de precios de venta.
3. **Aislamiento Financiero:**
   - Finanzas valida comprobantes, aprueba transferencias manuales (`approve_payments`) y audita rentabilidad (`view_margins`, `view_costs`).
   - No modifica costos de proveedores (responsabilidad de Compras) ni precios al público (responsabilidad de Gerencia).
4. **Protección Anti-Escalada (Super Admin):**
   - La capacidad `manage_roles` está reservada con exclusividad absoluta al rol `Super Admin`. Ningún otro usuario administrativo puede modificar grupos de usuarios ni atribuirse capacidades sensibles.
