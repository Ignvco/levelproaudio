# LEVELPRO OS V4.0 — GATE 13 (PHASE 1.1 · RECONCILED)
## BLINDAJE 1 — INVENTARIO EXHAUSTIVO 1 A 1 DE SUPERFICIES ADMINISTRATIVAS

- **Repositorio:** `Ignvco/levelproaudio`
- **Rama / HEAD auditado:** `feature/v4-gate13-admin-experience` @ `fa53c7f9b07ec6b13c4886a3ce4f322a58fe4bf6`
- **Control `UX13-P1-01` aplicado:** Reconciliación matemática directa contra el AST/código fuente real. **Cero rangos agrupados:** cada ruta, superficie de shell, pestaña interna, modo de vista, overlay, tabla, formulario y estado posee su **propio identificador único individual (`1 fila = 1 superficie = 1 ID`)**.

---

## RESUMEN EJECUTIVO RECONCILIADO (`315` SUPERFICIES CON ID ÚNICO)

| Familia de Superficie | Rango de IDs | Total Exacto Verificado | Desglose Verificable en Código Fuente |
|---|---|---|---|
| **1. Rutas, Redirecciones y Enlaces de Navegación** | `SURF-RT-001` .. `SURF-RT-041` | **41** | **39 rutas operativas de certificación** (`36` vistas `<Route>` bajo `/admin` + `/admin/login` + `/admin/procurement?tab=receipts` + `/admin/analytics`) + `1` redirect `/admin/executive` + `1` enlace roto detectado `/admin/fiscal` (`Gate9FinancePanels.jsx:596`) |
| **2. Superficies Estructurales de App Shell** | `SURF-SHL-001` .. `SURF-SHL-005` | **5** | Sidebar expandido (`240px`), Sidebar colapsado (`48px` Nimbus), Drawer mobile (`<1024px`), `AppShell.Header` (`56px`) y `AccountingCurrencySelect` (`CLP`/`USD`/`ARS`) |
| **3. Pestañas Internas y Modos de Sub-Vista** | `SURF-TAB-001` .. `SURF-TAB-090` | **90** | **84 pestañas internas** en `14` módulos (`Orders` 4, `ProductDetail` 4, `Inventory/WMS` 10, `Finance` 12, `Logistics` 8, `Marketing` 12, `Settings/CMS` 13, `Costing` 4, `Procurement` 2, `B2B` 4, `Users` 3, `Roles` 2, `Services` 3, `Loyalty` 3) + **2 modos de vista** (`Tabla`/`Kanban`) + **4 viewports de Preview CMS** (`1440/768/390/320px`) |
| **4. Overlays (Modales, SideModals, Confirmaciones y Popovers)** | `SURF-OVL-001` .. `SURF-OVL-073` | **73** | `42` `<FormModal>` + `13` `<ConfirmationModal>` + `1` `<BulkEditModal>` (deduplicado definición/uso) + `2` Drawers laterales (`OrderPanel`, `crm-360-drawer`) + `6` modales manuales `position:"fixed"` + `2` diálogos globales (`BF-32` Notificaciones, `⌘K` Search) + `4` `window.confirm` nativos + `3` Popovers/Dropdowns (`Perfil`, `Flyout Rail 48px`, `RowMenu ⋮`) |
| **5. Tablas de Datos** | `SURF-TBL-001` .. `SURF-TBL-064` | **64** | `10` instancias `<DataTable>` + `36` `<table className="au-table">` + `13` `<table className="lp-table">` + `5` `<table style={{...}}>` inline |
| **6. Formularios y Editores Fuera de `FormModal`** | `SURF-FRM-001` .. `SURF-FRM-034` | **34** | `28` etiquetas `<form>` explícitas + `6` editores de captura con estado propio (`Variantes`, `Specs BF-44`, `General PIM`, `Ficha Proveedor`, `Builder B2B`, `Config Loyalty`) |
| **7. Estados Transversales de Interfaz** | `SURF-ST-001` .. `SURF-ST-008` | **8** | `Skeleton`, `Spinner/Loading`, `Empty filtro`, `Initial state`, `Alert Error`, `Toast Success`, `RBAC Denied/Disabled`, `UnsavedChangesBar` |
| **TOTAL AUDITADO 1 A 1** | **Sin agrupaciones** | **315** | **100 % reconciliado con Blueprint, Component Mapping, Matriz Visual y Plan QA** |

---

## 1. RUTAS, REDIRECCIONES Y ENLACES (`SURF-RT-001` .. `SURF-RT-041` — 41 ELEMENTOS)

| ID | Ruta | Archivo Fuente | Tipo | Nombre Visible | Disparador | Permiso RBAC | API Principal | Estado Visual Actual | Patrón Nimbus Objetivo | Complej. | Riesgo | Prueba |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `SURF-RT-001` | `/admin` | `pages/admin/AdminDashboard.jsx` | Ruta certificada (01/39) | Inicio (Dashboard) | Login staff / Sidebar Inicio | is_staff | getAdminDashboard, getAnalytics | Bento Lumin oscuro (.v3-card-obsidian + donut neón) | Page + SummaryStats + CalloutCard + Card ventas/órdenes | Alta | Medio | E2E + 6 VP |
| `SURF-RT-002` | `/admin/orders` | `pages/admin/AdminOrders.jsx` | Ruta certificada (02/39) | Órdenes & Operaciones OMS | Sidebar Ventas > Lista de ventas | orders.view / approve_payments | getAdminOrders, getAdminManualOrders, getFulfillmentQueue, getAdminRMAs | Hero negro + botones #065F46 + thead negro | Page + SummaryStats + Tabs + DataTable + SideModal | Muy Alta | Alto | E2E PG16 + 6 VP |
| `SURF-RT-003` | `/admin/b2b` | `pages/admin/AdminB2BQuotes.jsx` | Ruta certificada (03/39) | Cotizaciones B2B, Listas y Crédito | Sidebar Ventas > Cotizaciones B2B | b2b.view / b2b.approve_credit | getAdminB2BQuotes, getB2BPriceLists, getB2BCreditAccounts | Hero negro + DataTable thead negro | Page + SummaryStats + Tabs + DataTable + Layout 2 cols | Alta | Alto | E2E B2B + 6 VP |
| `SURF-RT-004` | `/admin/special-orders` | `pages/admin/AdminSpecialOrders.jsx` | Ruta certificada (04/39) | Solicitudes Bajo Pedido | Sidebar Ventas > Bajo pedido | orders.view | listSpecialOrders, updateSpecialOrder, deleteSpecialOrder | Hero negro + .au-table negra | Page + SummaryStats + DataTable + FormModal | Baja | Bajo | Fixture + 6 VP |
| `SURF-RT-005` | `/admin/payments` | `pages/admin/AdminPayments.jsx` | Ruta certificada (05/39) | Transacciones de Pago | Sidebar Ventas > Transacciones | payments.view / approve_payments | getAdminPayments, updatePaymentStatus | Hero negro + DataTable + window.confirm | Page + SummaryStats + DataTable + ConfirmationModal | Media | Alto | E2E pagos + 6 VP |
| `SURF-RT-006` | `/admin/payment-methods` | `pages/admin/AdminPaymentMethods.jsx` | Ruta certificada (06/39) | Medios de Pago y Cuentas | Sidebar Configuración > Medios de pago | settings.manage | listPaymentMethods, listBankAccounts | Hero negro + 2 .au-table | SettingsPage + Card + DataTable + FormModal | Media | Medio | E2E CRUD + 6 VP |
| `SURF-RT-007` | `/admin/billing` | `pages/admin/AdminBilling.jsx` | Ruta certificada (07/39) | Documentos Tributarios (DTE Asistido) | Sidebar Finanzas > Doc. tributarios | billing.manage | getTaxDashboard, upsertTaxDocument | Hero negro + .au-table | Page + CalloutCard + DataTable + FormModal | Media | Alto | E2E DTE + 6 VP |
| `SURF-RT-008` | `/admin/products` | `pages/admin/AdminProducts.jsx` | Ruta certificada (08/39) | Productos (Catálogo PIM) | Sidebar Productos > Lista de productos | catalog.view / catalog.edit | getAdminProducts, createAdminProduct, updateAdminProduct, exportAdminCatalog | Hero negro + thead negro + BulkEditModal #0B0E14 | ProductList + DataTable + BulkActions sticky + SideModal | Muy Alta | Alto | E2E PIM + 6 VP |
| `SURF-RT-009` | `/admin/products/:id` | `pages/admin/AdminProductDetail.jsx` | Ruta certificada (09/39) | Ficha PIM, Variantes, Specs y Proveedores | Clic fila/editar en /admin/products | catalog.edit | getAdminProduct, getAdminProductVariants, getAdminProductSpecs | Hero negro + tabs #121722 + inputs negros bentoInput | Page + Tabs + Layout 2 cols (2/3+1/3) + Card + FormField claro | Muy Alta | Alto | E2E variantes + 6 VP |
| `SURF-RT-010` | `/admin/products/import` | `pages/admin/AdminProductImport.jsx` | Ruta certificada (10/39) | Importar Catálogo CSV/Excel | Botón Importar / Sidebar Productos | catalog.edit | importProducts, downloadTemplate | Hero negro + dropzone custom + tabla inline | Page + CalloutCard + FileUploader + DataTable | Media | Medio | E2E import + 6 VP |
| `SURF-RT-011` | `/admin/brands` | `pages/admin/AdminBrands.jsx` | Ruta certificada (11/39) | Marcas Oficiales | Sidebar Productos > Marcas | catalog.manage | getAdminBrands, createAdminBrand, updateAdminBrand, deleteAdminBrand | Hero negro + cards custom | Page + DataTable/Card list + FormModal + ConfirmationModal | Baja | Bajo | E2E CRUD + 6 VP |
| `SURF-RT-012` | `/admin/categories` | `pages/admin/AdminCategories.jsx` | Ruta certificada (12/39) | Categorías Jerárquicas | Sidebar Productos > Categorías | catalog.manage | /admin/categories/ CRUD | Hero negro + árbol custom | Page + InteractiveList/Sortable claro + FormModal | Media | Medio | E2E árbol + 6 VP |
| `SURF-RT-013` | `/admin/suppliers` | `pages/admin/AdminSuppliers.jsx` | Ruta certificada (13/39) | Maestro de Proveedores | Sidebar Compras > Proveedores | procurement.manage | getAdminSuppliers, createAdminSupplier, importSupplierPriceLists | Hero negro + .au-table + 2 modales fixed manuales | Page + DataTable + FormModal homologado | Media | Medio | E2E proveedor + 6 VP |
| `SURF-RT-014` | `/admin/suppliers/:id` | `pages/admin/AdminSupplierDetail.jsx` | Ruta certificada (14/39) | Detalle de Proveedor y Precios | Clic fila en /admin/suppliers | procurement.manage | getAdminSupplier, updateAdminSupplier, getAdminSupplierProducts | Hero negro + secciones mixtas + window.confirm | Page + Layout 2 cols + Card + DataTable + ConfirmationModal | Media | Medio | E2E proveedor + 6 VP |
| `SURF-RT-015` | `/admin/procurement` | `pages/admin/AdminProcurement.jsx` | Ruta certificada (15/39) | Órdenes de Compra e Importaciones | Sidebar Compras > Órdenes de compra | procurement.manage | listPurchaseOrders, createPurchaseOrder, approvePurchaseOrder, issuePurchaseOrder | Hero negro + .au-table + 2 modales fixed manuales | Page + Tabs + DataTable + FormModal | Alta | Alto | E2E OC + 6 VP |
| `SURF-RT-016` | `/admin/procurement?tab=receipts` | `pages/admin/AdminProcurement.jsx` | Ruta certificada (16/39) | Recepciones Físicas (GoodsReceipt) | Sidebar Compras > Recepciones / Link Kardex | procurement.receive | listGoodsReceipts, createGoodsReceipt, confirmGoodsReceipt | Hero negro + .au-table + modal fixed manual | Page + Tabs (?tab=receipts) + DataTable + FormModal | Alta | Alto | E2E GR + 6 VP |
| `SURF-RT-017` | `/admin/costing` | `pages/admin/AdminCostPricing.jsx` | Ruta certificada (17/39) | Costos, Landed Cost, WAC y Precios | Sidebar Operaciones > Costos y precios | costing.manage | listLandedCostAllocations, getCostLayersDashboard, getPricingMarginsReport, runPricingSimulation | Hero negro + 10 .au-table + forms inline | Page + SummaryStats + Tabs + Layout 2 cols + DataTable | Muy Alta | Muy Alto | E2E Landed + 6 VP |
| `SURF-RT-018` | `/admin/inventory` | `pages/admin/AdminInventory.jsx` | Ruta certificada (18/39) | Inventario Multi-Bodega, Kardex y Seriales | Sidebar Productos > Inventario y WMS | wms.view / adjust_inventory | getInventorySummary, getWarehouses, getWmsStocks, getWmsKardex, getSerials | Hero negro + 10 tabs + 8 .au-table + 2 modales fixed | Page + SummaryStats + Tabs + DataTable + FormModal | Muy Alta | Muy Alto | E2E Kardex + 6 VP |
| `SURF-RT-019` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx` | Ruta certificada (19/39) | Logística, Etiquetas, Garantías y Taller | Sidebar Operaciones > Logística y postventa | logistics.manage | getLogisticsOverview, getLogisticsShipments, getLogisticsManifests, getLogisticsRepairs | Hero negro + 8 .lp-table + 8 FormModal | Page + SummaryStats + Tabs + DataTable + FormModal | Muy Alta | Alto | E2E envío/OT + 6 VP |
| `SURF-RT-020` | `/admin/marketing` | `pages/admin/AdminMarketing.jsx` | Ruta certificada (20/39) | Marketing, Cupones y Carritos Abandonados | Sidebar Marketing > Cupones y promociones | marketing.manage | getMarketingDashboard, getMarketingCoupons, getMarketingPromotions, getMarketingAbandonedCarts | Hero negro + 12 tabs custom + .au-table | Page + SummaryStats + Tabs + DataTable + Layout 2 cols | Alta | Alto | E2E cupón + 6 VP |
| `SURF-RT-021` | `/admin/academy` | `pages/admin/AdminAcademy.jsx` | Ruta certificada (21/39) | Academia — Cursos | Sidebar Academia > Cursos | academy.manage | getAdminCourses, createAdminCourse, updateAdminCourse, deleteAdminCourse | Hero negro + cards cursos | Page + SummaryStats + DataTable/Card + FormModal | Media | Bajo | E2E curso + 6 VP |
| `SURF-RT-022` | `/admin/academy/modules` | `pages/admin/AdminModules.jsx` | Ruta certificada (22/39) | Academia — Módulos | Sidebar Academia > Módulos | academy.manage | getAdminModules, createAdminModule, updateAdminModule, deleteAdminModule | Hero negro + .au-table | Page + DataTable + FormModal + ConfirmationModal | Baja | Bajo | E2E módulo + 6 VP |
| `SURF-RT-023` | `/admin/academy/lessons` | `pages/admin/AdminLessons.jsx` | Ruta certificada (23/39) | Academia — Lecciones | Sidebar Academia > Lecciones | academy.manage | getAdminLessons, getLessonVideoUploadUrl, deleteAdminLesson | Hero negro + .au-table | Page + DataTable + FormModal + FileUploader | Media | Medio | Fixture/E2E + 6 VP |
| `SURF-RT-024` | `/admin/academy/enrollments` | `pages/admin/AdminEnrollments.jsx` | Ruta certificada (24/39) | Academia — Inscripciones | Sidebar Academia > Inscripciones | academy.manage | getAdminEnrollments, createAdminEnrollment | Hero negro + .au-table | Page + SummaryStats + DataTable + FormModal | Baja | Bajo | Fixture + 6 VP |
| `SURF-RT-025` | `/admin/academy/certifications` | `pages/admin/AdminCertifications.jsx` | Ruta certificada (25/39) | Academia — Certificaciones | Sidebar Academia > Certificaciones | academy.manage | getAdminCertifications CRUD | Hero negro + .au-table | Page + SummaryStats + DataTable + FormModal | Baja | Bajo | Fixture + 6 VP |
| `SURF-RT-026` | `/admin/services` | `pages/admin/AdminServices.jsx` | Ruta certificada (26/39) | Servicios Técnicos y Reservas | Sidebar Canales > Servicios técnicos | services.manage | getAdminServiceRequests, listAdminServicesCrud, getAdminBookings | Hero negro + 3 tabs + cards | Page + SummaryStats + Tabs + DataTable + FormModal | Media | Medio | E2E servicio + 6 VP |
| `SURF-RT-027` | `/admin/loyalty` | `pages/admin/AdminLoyalty.jsx` | Ruta certificada (27/39) | Programa de Fidelización (Loyalty) | Sidebar Marketing > Fidelización | marketing.manage | getLoyaltySummary, getLoyaltyConfig, updateLoyaltyConfig, adjustLoyaltyPoints | Hero negro + 3 tabs + .au-table | Page + SummaryStats + Tabs + DataTable + Card + FormModal | Media | Medio | E2E puntos + 6 VP |
| `SURF-RT-028` | `/admin/rewards` | `pages/admin/AdminRewards.jsx` | Ruta certificada (28/39) | Resumen LevelPro Rewards | Sidebar Rewards > Resumen | marketing.manage | adminGetRewardsDashboard | Hero negro + KPIs Bento | Page + SummaryStats + Card | Baja | Bajo | Fixture + 6 VP |
| `SURF-RT-029` | `/admin/rewards/campaigns` | `pages/admin/AdminRewardsCampaigns.jsx` | Ruta certificada (29/39) | Campañas de Rewards | Sidebar Rewards > Campañas | marketing.manage | adminListCampaigns, adminCreateCampaign, adminDuplicateCampaign, adminDeleteCampaign | Hero negro + lista + FormModal | Page + DataTable/Card + FormModal + ConfirmationModal | Media | Medio | E2E campaña + 6 VP |
| `SURF-RT-030` | `/admin/rewards/campaigns/:id` | `pages/admin/AdminRewardsCampaignDetail.jsx` | Ruta certificada (30/39) | Detalle de Campaña y Sorteo | Clic campaña en /admin/rewards/campaigns | marketing.manage | adminGetCampaign, adminUpdateCampaign, adminAddRewardProduct, adminDrawCampaign | Hero negro + paneles sorteo | Page + Layout 2 cols + Card + ProductDataList | Alta | Alto | E2E sorteo + 6 VP |
| `SURF-RT-031` | `/admin/rewards/entries` | `pages/admin/AdminRewardsEntries.jsx` | Ruta certificada (31/39) | Participaciones de Rewards | Sidebar Rewards > Participaciones | marketing.view | adminListEntries, adminExportEntriesCsvUrl | Hero negro + .au-table | Page + DataTable + exportar CSV | Baja | Bajo | Fixture + 6 VP |
| `SURF-RT-032` | `/admin/rewards/winners` | `pages/admin/AdminRewardsWinners.jsx` | Ruta certificada (32/39) | Ganadores de Rewards | Sidebar Rewards > Ganadores | marketing.manage | adminListWinners, adminUpdateWinner | Hero negro + tarjetas ganadores | Page + DataTable/Card + estado auditado | Baja | Medio | Fixture + 6 VP |
| `SURF-RT-033` | `/admin/finance` | `pages/admin/AdminFinance.jsx` | Ruta certificada (33/39) | Finanzas, Conciliación, Tesorería y AR/AP | Sidebar Finanzas > Finanzas y tesorería | finance.view / reconcile / treasury | getFinanceSummary, getFinanceReconciliation, getTreasuryAccounts, getAccountsReceivable, getAccountsPayable | Hero negro + 12 tabs + 3 DataTable + 5 .lp-table + 11 modales | Page + AccountingCurrencySelect + SummaryStats + Tabs + DataTable | Muy Alta | Muy Alto | E2E PG16 + 6 VP |
| `SURF-RT-034` | `/admin/users` | `pages/admin/AdminUsers.jsx` | Ruta certificada (34/39) | Clientes CRM 360°, Organizaciones y Usuarios | Sidebar Clientes | crm.view / rbac.assign_roles | getCrmCustomers, getCrmCustomer360, getCrmOrganizations, getAdminUsers, manageUserRole | Hero negro + 3 DataTable + drawer oscuro zIndex 1200 | Page + Tabs + DataTable + SideModal 360° + FormModal | Alta | Alto | E2E CRM/RBAC + 6 VP |
| `SURF-RT-035` | `/admin/roles` | `pages/admin/AdminRoles.jsx` | Ruta certificada (35/39) | Roles y Matriz RBAC 360° | Sidebar Configuración > Roles y permisos | rbac.view_roles | getAdminRoles, getPermissionsCatalog, getAdminRoleDetail | Hero negro + tabla inline + clases sueltas | Page + Tabs + Card + DataTable matriz + SideModal | Media | Alto | E2E RBAC + 6 VP |
| `SURF-RT-036` | `/admin/audit` | `pages/admin/AdminAudit.jsx` | Ruta certificada (36/39) | Auditoría Forense Inmutable | Sidebar Configuración > Auditoría | audit.view | getAuditEvents, getAuditEventDetail, getAuditSummary, exportAuditCsv | Hero negro + clases Tailwind huérfanas + tabla custom | Page + SummaryStats + DataTable server-side + SideModal diff | Alta | Medio | E2E audit + 6 VP |
| `SURF-RT-037` | `/admin/settings` | `pages/admin/AdminSettings.jsx` | Ruta certificada (37/39) | Tienda Online (CMS) y Config. Sistémica | Sidebar Tienda online | cms.edit / cms.publish / settings.manage | getAdminSiteSettings, createCmsDraft, updateCmsDraft, publishCmsVersion, rollbackCmsVersion | Hero negro + 13 tabs + iframe preview | Page + Tabs + Layout split editor/iframe aislado | Muy Alta | Muy Alto | E2E CMS + 6 VP |
| `SURF-RT-038` | `/admin/login` | `pages/admin/AdminLogin.jsx` | Ruta certificada (38/39) | Acceso Administrativo | Navegación sin sesión staff | Público (valida is_staff) | useAuthStore.login | Pantalla oscura legacy | Templates/Login Nimbus claro (#F5F5F5 + Card #FFFFFF) | Baja | Alto | E2E login + 6 VP |
| `SURF-RT-039` | `/admin/analytics` | `App.jsx:193` | Ruta certificada (39/39 - Redirect) | Redirección Analítica -> Finanzas | URL directa | AdminRoute | — | <Navigate to='/admin/finance' replace /> | Preservar redirección limpia | Mínima | Bajo | Router test + 6 VP |
| `SURF-RT-040` | `/admin/executive` | `App.jsx:194` | Redirección adicional | Redirección Ejecutivo -> Finanzas | URL directa | AdminRoute | — | <Navigate to='/admin/finance' replace /> | Preservar redirección limpia | Mínima | Bajo | Router test |
| `SURF-RT-041` | `/admin/fiscal` | `components/admin/Gate9FinancePanels.jsx:596` | Enlace roto detectado | Link 'Abrir módulo fiscal' en ExternalTaxPanel | Clic en tab Tributario de /admin/finance | finance.view | — | Apunta a /admin/fiscal inexistente (404) | Corregir link a /admin/billing + redirect defensivo en App.jsx | Baja | Medio | Test navegación |

---

## 2. SUPERFICIES ESTRUCTURALES DE APP SHELL (`SURF-SHL-001` .. `SURF-SHL-005` — 5 ELEMENTOS)

| ID | Ruta Padre | Archivo Fuente | Tipo | Nombre Visible | Disparador | Permiso RBAC | API | Estado Visual Actual | Patrón Nimbus Objetivo | Complej. | Riesgo | Prueba |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `SURF-SHL-001` | `/admin/*` | `layouts/AdminLayout.jsx` | AppShell Sidebar Expandido | Menú lateral fijo de 240px (7 secciones + acordeones) | Permanente en >= 1024px (menuExpanded=true) | Filtrado por getMyPermissions | getMyPermissions | Inexistente (hoy usa v3-floating-header oscuro) | AppShell (menuExpandedWidth=240px) + Menu v2.0.3 | Alta | Alto | Playwright desktop nav |
| `SURF-SHL-002` | `/admin/*` | `layouts/AdminLayout.jsx` | AppShell Sidebar Colapsado | Rail lateral de íconos de 48px | Toggle colapsar en desktop >= 1024px | Filtrado por getMyPermissions | — | Inexistente | AppShell (menuCollapsedWidth=48px) + Menu Collapsed | Media | Medio | Playwright rail 48px |
| `SURF-SHL-003` | `/admin/*` | `layouts/AdminLayout.jsx:788` | AppShell Drawer Mobile | Menú lateral deslizable en móvil/tablet | Botón hamburguesa en < 1024px | Filtrado por getMyPermissions | — | Menú móvil oscuro ad-hoc | Sidebar (position='left') + Menu v2.0.3 | Media | Medio | Playwright 320px/390px |
| `SURF-SHL-004` | `/admin/*` | `layouts/AdminLayout.jsx` | AppShell Header | Barra superior fija de 56px | Permanente en /admin/* | is_staff | — | Isla flotante negra v3-floating-header | AppShell.Header (56px, #FFFFFF, borde inferior 1px) | Media | Medio | Visual + axe-core |
| `SURF-SHL-005` | `/admin, /admin/finance` | `components/admin/ui/AccountingCurrencySelect.jsx:4` | Control Global Contable | Selector explícito de moneda (CLP/USD/ARS) | Cambio de select en cabecera | is_staff / finance.view | Parametriza queries por moneda sin FX implícito | Select .au-select legacy | Select compacto Nimbus (36px) con etiqueta Moneda | Baja | Alto | Unit + E2E multi-moneda |

---

## 3. PESTAÑAS INTERNAS Y MODOS DE SUB-VISTA (`SURF-TAB-001` .. `SURF-TAB-090` — 90 ELEMENTOS INDIVIDUALES)

| ID | Ruta Padre | Archivo Fuente:Línea | Tipo | Nombre Visible / Clave | Disparador | Permiso RBAC | API / Datos | Patrón Nimbus Objetivo | Prueba |
|---|---|---|---|---|---|---|---|---|---|
| `SURF-TAB-001` | `/admin/orders` | `pages/admin/AdminOrders.jsx:1106` | Pestaña interna | orders — 1. Centro de Pedidos | Clic tab / default | `orders.view` | `getAdminOrders` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-002` | `/admin/orders` | `pages/admin/AdminOrders.jsx:1107` | Pestaña interna | manual — 2. Ventas Manuales & WhatsApp | Clic tab / CTA Nueva Venta | `orders.create_manual` | `getAdminManualOrders` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-003` | `/admin/orders` | `pages/admin/AdminOrders.jsx:1108` | Pestaña interna | fulfillment — 3. Preparación y Despacho WMS | Clic tab | `orders.fulfill` | `getFulfillmentQueue, dispatchOrderWMS` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-004` | `/admin/orders` | `pages/admin/AdminOrders.jsx:1109` | Pestaña interna | rma — 4. Devoluciones e Inspección RMA | Clic tab | `orders.manage_rma` | `getAdminRMAs` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-005` | `/admin/products/:id` | `pages/admin/AdminProductDetail.jsx:283` | Pestaña interna | variants — Variantes | Clic tab / default | `catalog.edit` | `getAdminProductVariants` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-006` | `/admin/products/:id` | `pages/admin/AdminProductDetail.jsx:284` | Pestaña interna | specs — Especificaciones Técnicas | Clic tab | `catalog.edit` | `getTechnicalAttributesCatalog, getAdminProductSpecs` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-007` | `/admin/products/:id` | `pages/admin/AdminProductDetail.jsx:285` | Pestaña interna | suppliers — Proveedores | Clic tab | `catalog.edit` | `getAdminProductSuppliers` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-008` | `/admin/products/:id` | `pages/admin/AdminProductDetail.jsx:286` | Pestaña interna | general — General & Precios | Clic tab | `catalog.edit` | `updateAdminProduct` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-009` | `/admin/inventory` | `pages/admin/AdminInventory.jsx:23` | Pestaña interna | Resumen (Inventario) | Clic tab / default | `wms.view` | `getInventorySummary` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-010` | `/admin/inventory` | `pages/admin/AdminInventory.jsx:24` | Pestaña interna | Alertas (Stock bajo) | Clic tab | `wms.view` | `getInventoryAlerts` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-011` | `/admin/inventory` | `pages/admin/AdminInventory.jsx:25` | Pestaña interna | Rotación | Clic tab | `wms.view` | `getInventoryRotation` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-012` | `/admin/inventory` | `pages/admin/AdminInventory.jsx:26` | Pestaña interna | Por categoría | Clic tab | `wms.view` | `getInventorySummary` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-013` | `/admin/inventory` | `components/admin/WmsInventoryTabs.jsx:255` | Pestaña interna | Stock Dimensional | Clic tab | `wms.view / adjust_inventory` | `getWmsStocks, adjustWmsStock` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-014` | `/admin/inventory` | `components/admin/WmsInventoryTabs.jsx:86` | Pestaña interna | Bodegas | Clic tab | `manage_warehouses` | `getWarehouses` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-015` | `/admin/inventory` | `components/admin/WmsInventoryTabs.jsx:421` | Pestaña interna | Kardex | Clic tab | `wms.view` | `getWmsKardex` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-016` | `/admin/inventory` | `components/admin/WmsInventoryTabs.jsx:508` | Pestaña interna | Transferencias | Clic tab | `adjust_inventory` | `getWmsTransfers` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-017` | `/admin/inventory` | `components/admin/WmsInventoryTabs.jsx:657` | Pestaña interna | Reservas | Clic tab | `adjust_inventory` | `getWmsReservations` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-018` | `/admin/inventory` | `components/admin/WmsInventoryTabs.jsx:745` | Pestaña interna | Seriales | Clic tab | `adjust_inventory` | `getSerials, regularizeSerials` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-019` | `/admin/finance` | `pages/admin/AdminFinance.jsx:27` | Pestaña interna | overview — Resumen | Clic tab / default | `finance.view` | `getFinanceSummary` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-020` | `/admin/finance` | `components/admin/Gate9FinancePanels.jsx:55` | Pestaña interna | reconciliation — Conciliación | Clic tab | `finance.reconcile` | `getFinanceReconciliation` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-021` | `/admin/finance` | `components/admin/Gate9FinancePanels.jsx:255` | Pestaña interna | treasury — Tesorería | Clic tab | `treasury.manage` | `getTreasuryAccounts, getBankTransactions` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-022` | `/admin/finance` | `components/admin/Gate9FinancePanels.jsx:423` | Pestaña interna | ar — Cuentas x Cobrar | Clic tab | `finance.manage_ar` | `getAccountsReceivable, getArAging` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-023` | `/admin/finance` | `components/admin/Gate9FinancePanels.jsx:520` | Pestaña interna | ap — Cuentas x Pagar | Clic tab | `finance.manage_ap` | `getAccountsPayable` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-024` | `/admin/finance` | `components/admin/Gate9FinancePanels.jsx:609` | Pestaña interna | cash_flow — Flujo de Caja | Clic tab | `finance.view` | `getCashFlowProjection` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-025` | `/admin/finance` | `components/admin/Gate9FinancePanels.jsx:589` | Pestaña interna | tax_records — Tributario | Clic tab | `finance.view` | `ExternalTaxPanel` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-026` | `/admin/finance` | `pages/admin/AdminFinance.jsx:34` | Pestaña interna | income — Ingresos | Clic tab | `finance.view` | `getFinanceSummary` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-027` | `/admin/finance` | `pages/admin/AdminFinance.jsx:35` | Pestaña interna | withdrawals — Retiros | Clic tab | `finance.manage` | `getWithdrawals` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-028` | `/admin/finance` | `pages/admin/AdminFinance.jsx:36` | Pestaña interna | categories — Configuración | Clic tab | `finance.manage` | `getFinanceCategories` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-029` | `/admin/finance` | `pages/admin/AdminFinance.jsx:37` | Pestaña interna | by_product — Por producto | Clic tab | `finance.view` | `getAnalytics` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-030` | `/admin/finance` | `pages/admin/AdminFinance.jsx:38` | Pestaña interna | analysis — Análisis | Clic tab | `finance.view` | `getAnalytics` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-031` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:23` | Pestaña interna | overview — Dashboard & Cola | Clic tab / default | `logistics.view` | `getLogisticsOverview` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-032` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:24` | Pestaña interna | shipments — Envíos & Bultos | Clic tab | `logistics.manage` | `getLogisticsShipments` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-033` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:25` | Pestaña interna | couriers — Couriers & Tarifas | Clic tab | `logistics.view` | `getLogisticsCarriers` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-034` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:26` | Pestaña interna | labels — Etiquetas | Clic tab | `logistics.manage` | `getLogisticsLabels` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-035` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:27` | Pestaña interna | manifests — Manifiestos | Clic tab | `logistics.manage` | `getLogisticsManifests` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-036` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:28` | Pestaña interna | tracking — Tracking & Incidencias | Clic tab | `logistics.manage` | `getLogisticsTracking, getLogisticsIncidents` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-037` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:29` | Pestaña interna | warranties — Garantías & Seriales | Clic tab | `logistics.view` | `getLogisticsWarranties` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-038` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:30` | Pestaña interna | workshop — Servicio Técnico | Clic tab | `logistics.manage` | `getLogisticsRepairs` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-039` | `/admin/marketing` | `pages/admin/AdminMarketing.jsx:31` | Pestaña interna | dashboard — 1. Dashboard | Clic tab / default | `marketing.view` | `getMarketingDashboard` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-040` | `/admin/marketing` | `pages/admin/AdminMarketing.jsx:32` | Pestaña interna | coupons — 2. Cupones | Clic tab | `marketing.manage` | `getMarketingCoupons` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-041` | `/admin/marketing` | `pages/admin/AdminMarketing.jsx:33` | Pestaña interna | coupon-builder — 3. Creador Cupón | Clic tab | `marketing.manage` | `createMarketingCoupon` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-042` | `/admin/marketing` | `pages/admin/AdminMarketing.jsx:34` | Pestaña interna | eligibility — 4. Elegibilidad | Clic tab | `marketing.view` | `Reglas de elegibilidad` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-043` | `/admin/marketing` | `pages/admin/AdminMarketing.jsx:35` | Pestaña interna | accumulation — 5. Acumulación | Clic tab | `marketing.view` | `Matriz anti-colisión` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-044` | `/admin/marketing` | `pages/admin/AdminMarketing.jsx:36` | Pestaña interna | calendar — 6. Calendario | Clic tab | `marketing.manage` | `getMarketingPromotions` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-045` | `/admin/marketing` | `pages/admin/AdminMarketing.jsx:37` | Pestaña interna | campaigns — 7. Campañas | Clic tab | `marketing.manage` | `createMarketingPromotion` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-046` | `/admin/marketing` | `pages/admin/AdminMarketing.jsx:38` | Pestaña interna | preview — 8. Previsualización | Clic tab | `marketing.manage` | `previewMarketingPricing` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-047` | `/admin/marketing` | `pages/admin/AdminMarketing.jsx:39` | Pestaña interna | abandoned — 9. Carritos Abandonados | Clic tab | `marketing.manage` | `getMarketingAbandonedCarts` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-048` | `/admin/marketing` | `pages/admin/AdminMarketing.jsx:40` | Pestaña interna | recovery — 10. Recuperación | Clic tab | `marketing.manage` | `dispatchMarketingCartRecovery` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-049` | `/admin/marketing` | `pages/admin/AdminMarketing.jsx:41` | Pestaña interna | consent — 11. Consentimiento & Outbox | Clic tab | `marketing.manage` | `getMarketingConsents, getMarketingOutbox` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-050` | `/admin/marketing` | `pages/admin/AdminMarketing.jsx:42` | Pestaña interna | loyalty-rewards — 12. Loyalty & Rewards | Clic tab | `marketing.view` | `Enlaces integrados Growth` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-051` | `/admin/settings` | `pages/admin/AdminSettings.jsx:37` | Pestaña interna | overview — 1. Vista General | Clic tab / default | `cms.edit` | `getAdminSiteSettings, getCmsVersions` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-052` | `/admin/settings` | `pages/admin/AdminSettings.jsx:38` | Pestaña interna | hero — 2. Editor Hero | Clic tab | `cms.edit` | `saveCmsHeroSlide` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-053` | `/admin/settings` | `pages/admin/AdminSettings.jsx:39` | Pestaña interna | assets — 3. Imágenes | Clic tab | `cms.edit` | `getCmsAssets, uploadCmsAsset` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-054` | `/admin/settings` | `pages/admin/AdminSettings.jsx:40` | Pestaña interna | banners — 4. Banners | Clic tab | `cms.edit` | `getCmsBanners, saveCmsBanner` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-055` | `/admin/settings` | `pages/admin/AdminSettings.jsx:41` | Pestaña interna | announcements — 5. Anuncios | Clic tab | `cms.edit` | `saveCmsAnnouncement` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-056` | `/admin/settings` | `pages/admin/AdminSettings.jsx:42` | Pestaña interna | sections — 6. Secciones Home | Clic tab | `cms.edit` | `updateCmsDraft` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-057` | `/admin/settings` | `pages/admin/AdminSettings.jsx:43` | Pestaña interna | buttons — 7. Botones & Enlaces | Clic tab | `cms.edit` | `updateCmsDraft` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-058` | `/admin/settings` | `pages/admin/AdminSettings.jsx:44` | Pestaña interna | seo — 8. SEO | Clic tab | `cms.edit` | `updateCmsDraft` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-059` | `/admin/settings` | `pages/admin/AdminSettings.jsx:45` | Pestaña interna | drafts — 9. Borradores | Clic tab | `cms.edit` | `createCmsDraft, getCmsVersions` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-060` | `/admin/settings` | `pages/admin/AdminSettings.jsx:46` | Pestaña interna | history — 10. Historial | Clic tab | `cms.edit` | `getCmsEvents, getCmsVersions` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-061` | `/admin/settings` | `pages/admin/AdminSettings.jsx:47` | Pestaña interna | preview — 11. Previsualización | Clic tab | `cms.edit` | `previewCmsVersion (iframe aislado)` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-062` | `/admin/settings` | `pages/admin/AdminSettings.jsx:48` | Pestaña interna | publish — 12. Publicar & Rollback | Clic tab | `cms.publish` | `publishCmsVersion, rollbackCmsVersion` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-063` | `/admin/settings` | `pages/admin/AdminSettings.jsx:49` | Pestaña interna | systemic — Config. Sistémica (FX) | Clic tab | `settings.manage` | `updateSiteSettings` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-064` | `/admin/costing` | `pages/admin/AdminCostPricing.jsx:74` | Pestaña interna | landed — Landed Cost & Internación | Clic tab / default | `costing.manage` | `listLandedCostAllocations, createLandedCostAllocation` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-065` | `/admin/costing` | `pages/admin/AdminCostPricing.jsx:390` | Pestaña interna | layers — Capas FIFO, Seriales & WAC | Clic tab | `costing.view` | `getCostLayersDashboard` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-066` | `/admin/costing` | `pages/admin/AdminCostPricing.jsx:391` | Pestaña interna | margins — Márgenes & Políticas | Clic tab | `costing.manage` | `getPricingMarginsReport, createMarginPolicy` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-067` | `/admin/costing` | `pages/admin/AdminCostPricing.jsx:392` | Pestaña interna | simulator — Simulador & Propuestas | Clic tab | `costing.manage` | `runPricingSimulation, listPricingProposals` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-068` | `/admin/procurement` | `pages/admin/AdminProcurement.jsx:70` | Pestaña interna | orders — Órdenes de Compra (OC) | Clic tab / default | `procurement.manage` | `listPurchaseOrders` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-069` | `/admin/procurement?tab=receipts` | `pages/admin/AdminProcurement.jsx:71` | Pestaña interna | receipts — Recepciones Físicas (GR) | Clic tab / ?tab=receipts | `procurement.receive` | `listGoodsReceipts` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-070` | `/admin/b2b` | `pages/admin/AdminB2BQuotes.jsx:450` | Pestaña interna | quotes — Historial de Cotizaciones | Clic tab / default | `b2b.view` | `getAdminB2BQuotes` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-071` | `/admin/b2b` | `pages/admin/AdminB2BQuotes.jsx:451` | Pestaña interna | builder — Generador Pro de Cotizaciones | Clic tab | `b2b.manage` | `createProB2BQuote, resolveB2BPrice` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-072` | `/admin/b2b` | `pages/admin/AdminB2BQuotes.jsx:452` | Pestaña interna | pricelists — Listas de Precios y Tramos | Clic tab | `b2b.manage` | `getB2BPriceLists, saveB2BPriceList` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-073` | `/admin/b2b` | `pages/admin/AdminB2BQuotes.jsx:453` | Pestaña interna | credit — Crédito Comercial B2B | Clic tab | `b2b.approve_credit` | `getB2BCreditAccounts` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-074` | `/admin/users` | `pages/admin/AdminUsers.jsx:365` | Pestaña interna | crm — Directorio CRM & Ficha 360° | Clic tab / default | `crm.view` | `getCrmCustomers` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-075` | `/admin/users` | `pages/admin/AdminUsers.jsx:366` | Pestaña interna | organizations — Organizaciones y Contactos | Clic tab | `crm.view` | `getCrmOrganizations` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-076` | `/admin/users` | `pages/admin/AdminUsers.jsx:367` | Pestaña interna | rbac — Usuarios y Roles RBAC | Clic tab | `rbac.assign_roles` | `getAdminUsers` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-077` | `/admin/roles` | `pages/admin/AdminRoles.jsx:185` | Pestaña interna | roles — Roles Empresariales | Clic tab / default | `rbac.view_roles` | `getAdminRoles` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-078` | `/admin/roles` | `pages/admin/AdminRoles.jsx:186` | Pestaña interna | matrix — Matriz de Permisos 360° | Clic tab | `rbac.view_roles` | `getPermissionsCatalog` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-079` | `/admin/services` | `pages/admin/AdminServices.jsx:135` | Pestaña interna | Solicitudes (Servicios) | Clic tab / default | `services.manage` | `getAdminServiceRequests` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-080` | `/admin/services` | `pages/admin/AdminServices.jsx:135` | Pestaña interna | Servicios (Catálogo técnico) | Clic tab | `services.manage` | `listAdminServicesCrud` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-081` | `/admin/services` | `pages/admin/AdminServices.jsx:135` | Pestaña interna | Reservas (Bookings) | Clic tab | `services.manage` | `getAdminBookings` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-082` | `/admin/loyalty` | `pages/admin/AdminLoyalty.jsx:12` | Pestaña interna | Resumen (Loyalty) | Clic tab / default | `marketing.view` | `getLoyaltySummary` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-083` | `/admin/loyalty` | `pages/admin/AdminLoyalty.jsx:12` | Pestaña interna | Top clientes (Loyalty) | Clic tab | `marketing.view` | `getLoyaltySummary` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-084` | `/admin/loyalty` | `pages/admin/AdminLoyalty.jsx:12` | Pestaña interna | Configuración (Loyalty) | Clic tab | `marketing.manage` | `getLoyaltyConfig, updateLoyaltyConfig` | Tabs Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-085` | `/admin/orders` | `pages/admin/AdminOrders.jsx:1134` | Modo de vista | table — Vista Tabla OMS | Toggle en tab Centro de Pedidos | `orders.view` | `getAdminOrders` | SegmentedControl Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-086` | `/admin/orders` | `pages/admin/AdminOrders.jsx:1148` | Modo de vista | kanban — Vista Kanban OMS (4 columnas) | Toggle en tab Centro de Pedidos | `orders.view` | `getAdminOrders` | SegmentedControl + Card Kanban claro | QA-INT-03 + E2E |
| `SURF-TAB-087` | `/admin/settings` | `pages/admin/AdminSettings.jsx:54` | Sub-viewport Preview | desktop — Preview CMS 1440px | Selector en tab Previsualización | `cms.edit` | `previewCmsVersion` | SegmentedControl Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-088` | `/admin/settings` | `pages/admin/AdminSettings.jsx:55` | Sub-viewport Preview | tablet — Preview CMS 768px | Selector en tab Previsualización | `cms.edit` | `previewCmsVersion` | SegmentedControl Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-089` | `/admin/settings` | `pages/admin/AdminSettings.jsx:56` | Sub-viewport Preview | mobile — Preview CMS 390px | Selector en tab Previsualización | `cms.edit` | `previewCmsVersion` | SegmentedControl Nimbus | QA-INT-03 + E2E |
| `SURF-TAB-090` | `/admin/settings` | `pages/admin/AdminSettings.jsx:57` | Sub-viewport Preview | mobile320 — Preview CMS 320px | Selector en tab Previsualización | `cms.edit` | `previewCmsVersion` | SegmentedControl Nimbus | QA-INT-03 + E2E |

---

## 4. OVERLAYS: MODALES, SIDEMODALS, DRAWERS, CONFIRMACIONES Y POPOVERS (`SURF-OVL-001` .. `SURF-OVL-073` — 73 ELEMENTOS INDIVIDUALES)

*(Nota de reconciliación `UX13-P1-01`: `BulkEditModal` se contabiliza una sola vez en `SURF-OVL-053` vinculando su montaje en `AdminProducts.jsx:1011` y su definición en `BulkEditModal.jsx:119`. Cada uno de los 73 overlays posee fila e ID exclusivos.)*

| ID | Ruta Padre | Archivo Fuente:Línea | Implementación Actual | Nombre Visible / Propósito | Patrón Nimbus Objetivo | Método de Prueba |
|---|---|---|---|---|---|---|
| `SURF-OVL-001` | `/admin/*` | `layouts/AdminLayout.jsx:222` | `Dialog Popover` | Centro de Notificaciones Operativas (BF-32) | Popover / SideModal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-002` | `/admin/*` | `components/admin/AdminSearch.jsx:285` | `Dialog Modal` | Command Palette y Búsqueda Global (⌘K) | Modal Comando Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-003` | `/admin/finance` | `components/admin/Gate9FinancePanels.jsx:191` | `FormModal` | Conciliar pago #${selectedPay?.order_short ··  | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-004` | `/admin/finance` | `components/admin/Gate9FinancePanels.jsx:234` | `FormModal` | Comprobante declarado #${receiptModal?.order_short ··  | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-005` | `/admin/finance` | `components/admin/Gate9FinancePanels.jsx:383` | `FormModal` | FormModal | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-006` | `/admin/finance` | `components/admin/Gate9FinancePanels.jsx:390` | `FormModal` | Traspaso interno entre cuentas | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-007` | `/admin/finance` | `components/admin/Gate9FinancePanels.jsx:407` | `FormModal` | Importar cartola CSV (SHA-256) | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-008` | `/admin/finance` | `components/admin/Gate9FinancePanels.jsx:504` | `FormModal` | Abonar ${allocTarget?.ar_number ··  | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-009` | `/admin/finance` | `components/admin/Gate9FinancePanels.jsx:580` | `FormModal` | Pagar ${payTarget?.ap_number ··  | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-010` | `/admin/inventory` | `components/admin/WmsInventoryTabs.jsx:205` | `InlineFixed Modal` | Nueva Bodega WMS | Modal Nimbus (FormModal) | QA-INT-05 / E2E |
| `SURF-OVL-011` | `/admin/inventory` | `components/admin/WmsInventoryTabs.jsx:393` | `InlineFixed Modal` | Ajuste Atómico de Inventario (Kardex) | Modal Nimbus (FormModal) | QA-INT-05 / E2E |
| `SURF-OVL-012` | `/admin/academy` | `pages/admin/AdminAcademy.jsx:52` | `FormModal` | Editar / Nuevo curso | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-013` | `/admin/academy` | `pages/admin/AdminAcademy.jsx:177` | `ConfirmationModal` | ¿Eliminar curso? | ConfirmationModal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-014` | `/admin/audit` | `pages/admin/AdminAudit.jsx:782` | `FormModal` | Detalle Forense de Evento de Auditoría | SideModal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-015` | `/admin/b2b` | `pages/admin/AdminB2BQuotes.jsx:135` | `FormModal` | Cotización B2B Legacy | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-016` | `/admin/b2b` | `pages/admin/AdminB2BQuotes.jsx:647` | `FormModal` | Nueva Lista de Precios B2B | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-017` | `/admin/b2b` | `pages/admin/AdminB2BQuotes.jsx:684` | `FormModal` | Solicitar Línea de Crédito B2B | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-018` | `/admin/b2b` | `pages/admin/AdminB2BQuotes.jsx:705` | `FormModal` | Autorización Gerencial de Crédito | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-019` | `/admin/billing` | `pages/admin/AdminBilling.jsx:53` | `FormModal` | FormModal | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-020` | `/admin/brands` | `pages/admin/AdminBrands.jsx:40` | `FormModal` | Nueva/Editar marca | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-021` | `/admin/brands` | `pages/admin/AdminBrands.jsx:145` | `ConfirmationModal` | ¿Eliminar marca? | ConfirmationModal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-022` | `/admin/categories` | `pages/admin/AdminCategories.jsx:72` | `FormModal` | Nueva/Editar categoría | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-023` | `/admin/categories` | `pages/admin/AdminCategories.jsx:321` | `ConfirmationModal` | ¿Eliminar categoría? | ConfirmationModal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-024` | `/admin/academy/certifications` | `pages/admin/AdminCertifications.jsx:61` | `FormModal` | FormModal | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-025` | `/admin/academy/certifications` | `pages/admin/AdminCertifications.jsx:191` | `ConfirmationModal` | Eliminar certificación | ConfirmationModal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-026` | `/admin/academy/enrollments` | `pages/admin/AdminEnrollments.jsx:31` | `FormModal` | Inscripción manual | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-027` | `/admin/finance` | `pages/admin/AdminFinance.jsx:113` | `FormModal` | Nueva/Editar categoría financiera | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-028` | `/admin/finance` | `pages/admin/AdminFinance.jsx:216` | `FormModal` | FormModal | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-029` | `/admin/finance` | `pages/admin/AdminFinance.jsx:373` | `ConfirmationModal` | ¿Eliminar retiro? | ConfirmationModal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-030` | `/admin/finance` | `pages/admin/AdminFinance.jsx:383` | `ConfirmationModal` | ¿Eliminar categoría? | ConfirmationModal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-031` | `/admin/academy/lessons` | `pages/admin/AdminLessons.jsx:117` | `FormModal` | Nueva/Editar lección | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-032` | `/admin/academy/lessons` | `pages/admin/AdminLessons.jsx:342` | `ConfirmationModal` | ¿Eliminar lección? | ConfirmationModal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-033` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:483` | `FormModal` | Registrar bulto — ${pkgTarget?.shipment_number ··  | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-034` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:493` | `FormModal` | Cotizar courier — ${quoteTarget?.shipment_number ··  | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-035` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:506` | `FormModal` | Nuevo manifiesto de despacho | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-036` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:514` | `FormModal` | Confirmar retiro — ${handoverTarget?.manifest_number ··  | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-037` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:518` | `FormModal` | Registrar evento de tracking | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-038` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:535` | `FormModal` | Nueva orden de taller | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-039` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:542` | `FormModal` | Diagnóstico y presupuesto — ${diagTarget?.work_order_number ··  | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-040` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:552` | `FormModal` | Entregar equipo — ${deliverTarget?.work_order_number ··  | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-041` | `/admin/loyalty` | `pages/admin/AdminLoyalty.jsx:55` | `FormModal` | Ajustar puntos | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-042` | `/admin/academy/modules` | `pages/admin/AdminModules.jsx:46` | `FormModal` | Nuevo/Editar módulo | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-043` | `/admin/academy/modules` | `pages/admin/AdminModules.jsx:127` | `ConfirmationModal` | ¿Eliminar módulo? | ConfirmationModal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-044` | `/admin/orders` | `pages/admin/AdminOrders.jsx:247` | `Drawer (.lp-drawer)` | OrderPanel — Detalle 3D de Orden OMS, Pagos y RMA | SideModal Nimbus (580px) | QA-INT-05 / E2E |
| `SURF-OVL-045` | `/admin/payment-methods` | `pages/admin/AdminPaymentMethods.jsx:58` | `FormModal` | FormModal | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-046` | `/admin/payment-methods` | `pages/admin/AdminPaymentMethods.jsx:147` | `FormModal` | FormModal | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-047` | `/admin/payment-methods` | `pages/admin/AdminPaymentMethods.jsx:230` | `ConfirmationModal` | Eliminar | ConfirmationModal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-048` | `/admin/payments` | `pages/admin/AdminPayments.jsx:47` | `window.confirm` | Confirmación nativa: ¿Cambiar a "${STATUS[v]?.label}"? Esto afecta finanzas. | ConfirmationModal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-049` | `/admin/procurement` | `pages/admin/AdminProcurement.jsx:587` | `InlineFixed Modal` | Nueva Orden de Compra (BF-03) | Modal Nimbus (FormModal) | QA-INT-05 / E2E |
| `SURF-OVL-050` | `/admin/procurement?tab=receipts` | `pages/admin/AdminProcurement.jsx:649` | `InlineFixed Modal` | Registrar Recepción Física GR (BF-04) | Modal Nimbus (FormModal) | QA-INT-05 / E2E |
| `SURF-OVL-051` | `/admin/products/:id` | `pages/admin/AdminProductDetail.jsx:224` | `window.confirm` | Confirmación nativa: ¿Desactivar esta variante? Se conservarán sus referencias históricas y | ConfirmationModal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-052` | `/admin/products` | `pages/admin/AdminProducts.jsx:310` | `FormModal` | Nuevo/Editar producto | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-053` | `/admin/products` | `pages/admin/AdminProducts.jsx:1011` | `BulkEditModal` | Edición Masiva de Catálogo (BF-15) | SideModal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-054` | `/admin/products` | `pages/admin/AdminProducts.jsx:1027` | `ConfirmationModal` | ¿Eliminar producto? | ConfirmationModal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-055` | `/admin/products` | `pages/admin/AdminProducts.jsx:283` | `window.confirm` | Confirmación nativa: ¿Eliminar imagen? | ConfirmationModal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-056` | `/admin/rewards/campaigns` | `pages/admin/AdminRewardsCampaigns.jsx:145` | `FormModal` | Nueva campaña | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-057` | `/admin/rewards/campaigns` | `pages/admin/AdminRewardsCampaigns.jsx:391` | `ConfirmationModal` | ¿Eliminar campaña? | ConfirmationModal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-058` | `/admin/roles` | `pages/admin/AdminRoles.jsx:458` | `FormModal` | FormModal | SideModal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-059` | `/admin/services` | `pages/admin/AdminServices.jsx:428` | `ConfirmationModal` | ¿Eliminar servicio? | ConfirmationModal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-060` | `/admin/services` | `pages/admin/AdminServices.jsx:521` | `FormModal` | FormModal | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-061` | `/admin/special-orders` | `pages/admin/AdminSpecialOrders.jsx:47` | `FormModal` | Solicitud bajo pedido | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-062` | `/admin/special-orders` | `pages/admin/AdminSpecialOrders.jsx:118` | `ConfirmationModal` | Eliminar solicitud | ConfirmationModal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-063` | `/admin/suppliers/:id` | `pages/admin/AdminSupplierDetail.jsx:110` | `window.confirm` | Confirmación nativa: ¿Desactivar lógicamente este proveedor? Su historial y relaciones se c | ConfirmationModal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-064` | `/admin/suppliers` | `pages/admin/AdminSuppliers.jsx:274` | `InlineFixed Modal` | Nuevo Proveedor | Modal Nimbus (FormModal) | QA-INT-05 / E2E |
| `SURF-OVL-065` | `/admin/suppliers` | `pages/admin/AdminSuppliers.jsx:342` | `InlineFixed Modal` | Importación de Listas de Costos (Excel / CSV) | Modal Nimbus (FormModal) | QA-INT-05 / E2E |
| `SURF-OVL-066` | `/admin/users` | `pages/admin/AdminUsers.jsx:603` | `FormModal` | Nueva Organización B2B | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-067` | `/admin/users` | `pages/admin/AdminUsers.jsx:641` | `FormModal` | Nueva Ficha Cliente CRM | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-068` | `/admin/users` | `pages/admin/AdminUsers.jsx:671` | `FormModal` | Agregar Contacto a Organización | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-069` | `/admin/users` | `pages/admin/AdminUsers.jsx:687` | `FormModal` | Gestionar Roles RBAC de Usuario | Modal Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-070` | `/admin/users` | `pages/admin/AdminUsers.jsx:452` | `InlineFixed Drawer` | Ficha Cliente CRM 360° (crm-360-drawer) | SideModal Nimbus (580px) | QA-INT-05 / E2E |
| `SURF-OVL-071` | `/admin/*` | `layouts/AdminLayout.jsx:715` | `Dropdown Popover` | Menú de Cuenta de Usuario, Rol Activo y Cerrar Sesión | Popover + MenuButton Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-072` | `/admin/*` | `layouts/AdminLayout.jsx:651` | `Navigation Flyout` | Flyout de Submenús (migra a Popover del rail colapsado 48px) | AppShell menuFlyout Popover Nimbus | QA-INT-05 / E2E |
| `SURF-OVL-073` | `/admin/* (DataTable)` | `components/admin/ui/DataTable.jsx:180` | `Dropdown Popover` | RowMenu — Menú contextual de acciones por fila (⋮) | DataTable.Dropdown Nimbus | QA-INT-05 / E2E |

---

## 5. TABLAS DE DATOS (`SURF-TBL-001` .. `SURF-TBL-064` — 64 ELEMENTOS INDIVIDUALES)

| ID | Ruta Padre | Archivo Fuente:Línea | Clase / Componente Actual | Contexto / Listado | Patrón Nimbus Objetivo | Método de Prueba |
|---|---|---|---|---|---|---|
| `SURF-TBL-001` | `/admin/products` | `components/admin/BulkEditModal.jsx:308` | `table inline` | Tabla operativa en BulkEditModal | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-002` | `/admin/finance` | `components/admin/Gate9FinancePanels.jsx:130` | `lp-table` | Cola de transferencias y pagos por conciliar | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-003` | `/admin/finance` | `components/admin/Gate9FinancePanels.jsx:170` | `lp-table` | Historial reciente de conciliaciones | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-004` | `/admin/finance` | `components/admin/Gate9FinancePanels.jsx:362` | `lp-table` | Cartola bancaria importada | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-005` | `/admin/finance` | `components/admin/Gate9FinancePanels.jsx:477` | `lp-table` | Cuentas por cobrar (AR) | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-006` | `/admin/finance` | `components/admin/Gate9FinancePanels.jsx:552` | `lp-table` | BF-37 · CUENTAS POR PAGAR | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-007` | `/admin/products/:id` | `components/admin/ProductSuppliersTab.jsx:170` | `au-table` | Tabla operativa en ProductSuppliersTab | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-008` | `/admin/inventory` | `components/admin/WmsInventoryTabs.jsx:152` | `au-table` | Bodegas y Ubicaciones | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-009` | `/admin/inventory` | `components/admin/WmsInventoryTabs.jsx:340` | `au-table` | Existencias por Bodega y SKU | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-010` | `/admin/inventory` | `components/admin/WmsInventoryTabs.jsx:452` | `au-table` | Kardex de Movimientos | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-011` | `/admin/inventory` | `components/admin/WmsInventoryTabs.jsx:613` | `au-table` | Transferencias Registradas | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-012` | `/admin/inventory` | `components/admin/WmsInventoryTabs.jsx:703` | `au-table` | Reservas de Stock | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-013` | `/admin/inventory` | `components/admin/WmsInventoryTabs.jsx:850` | `au-table` | Registro Maestro de Seriales | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-014` | `/admin/audit` | `pages/admin/AdminAudit.jsx:559` | `table inline` | Sin eventos de auditoría | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-015` | `/admin/b2b` | `pages/admin/AdminB2BQuotes.jsx:478` | `DataTable` | Sin cotizaciones B2B | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-016` | `/admin/billing` | `pages/admin/AdminBilling.jsx:170` | `au-table` | Sin órdenes pagadas | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-017` | `/admin/academy/certifications` | `pages/admin/AdminCertifications.jsx:218` | `au-table` | Sin certificaciones | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-018` | `/admin/costing` | `pages/admin/AdminCostPricing.jsx:713` | `au-table` | Tabla operativa en AdminCostPricing | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-019` | `/admin/costing` | `pages/admin/AdminCostPricing.jsx:766` | `au-table` | Capas de Costos por Lote y Recepción (CostLayer) | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-020` | `/admin/costing` | `pages/admin/AdminCostPricing.jsx:832` | `au-table` | Costeo Unitario por Número de Serie (SerialCostUnit) | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-021` | `/admin/costing` | `pages/admin/AdminCostPricing.jsx:878` | `au-table` | Promedio Ponderado Móvil (WAC) y Ajustes Tardíos | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-022` | `/admin/costing` | `pages/admin/AdminCostPricing.jsx:913` | `au-table` | Tabla operativa en AdminCostPricing | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-023` | `/admin/costing` | `pages/admin/AdminCostPricing.jsx:943` | `au-table` | Tabla operativa en AdminCostPricing | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-024` | `/admin/costing` | `pages/admin/AdminCostPricing.jsx:979` | `au-table` | ALERTAS DE RENTABILIDAD | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-025` | `/admin/costing` | `pages/admin/AdminCostPricing.jsx:1017` | `au-table` | Rentabilidad Consolidada por Marca | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-026` | `/admin/costing` | `pages/admin/AdminCostPricing.jsx:1109` | `au-table` | Rentabilidad por SKU (Margen sobre Ventas vs Markup sobre Co | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-027` | `/admin/costing` | `pages/admin/AdminCostPricing.jsx:1301` | `au-table` | Propuestas Comerciales de Precios (Confirmación Explícita) | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-028` | `/admin/academy/enrollments` | `pages/admin/AdminEnrollments.jsx:172` | `au-table` | No se pudieron cargar las inscripciones | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-029` | `/admin/finance` | `pages/admin/AdminFinance.jsx:554` | `DataTable` | Tabla operativa en AdminFinance | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-030` | `/admin/finance` | `pages/admin/AdminFinance.jsx:592` | `DataTable` | Tabla operativa en AdminFinance | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-031` | `/admin/finance` | `pages/admin/AdminFinance.jsx:701` | `DataTable` | Eliminar | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-032` | `/admin/inventory` | `pages/admin/AdminInventory.jsx:216` | `au-table` | EXISTENCIAS POR SKU | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-033` | `/admin/inventory` | `pages/admin/AdminInventory.jsx:362` | `au-table` | VELOCIDAD DE SALIDA | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-034` | `/admin/academy/lessons` | `pages/admin/AdminLessons.jsx:384` | `au-table` | No pudimos cargar las lecciones | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-035` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:265` | `lp-table` | Pedidos listos para despacho | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-036` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:286` | `lp-table` | Envíos, bultos y estados operativos | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-037` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:332` | `lp-table` | Etiquetas generadas (No equivalen a DTE) | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-038` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:355` | `lp-table` | Manifiestos de retiro | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-039` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:390` | `lp-table` | Eventos de tracking normalizados | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-040` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:407` | `lp-table` | Incidencias de entrega | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-041` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:434` | `lp-table` | Garantías registradas | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-042` | `/admin/logistics` | `pages/admin/AdminLogistics.jsx:459` | `lp-table` | Órdenes de trabajo de taller | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-043` | `/admin/loyalty` | `pages/admin/AdminLoyalty.jsx:234` | `au-table` | No se pudo cargar el listado de clientes | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-044` | `/admin/marketing` | `pages/admin/AdminMarketing.jsx:373` | `au-table` | Tabla operativa en AdminMarketing | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-045` | `/admin/academy/modules` | `pages/admin/AdminModules.jsx:168` | `au-table` | No pudimos cargar los módulos | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-046` | `/admin/orders` | `pages/admin/AdminOrders.jsx:1167` | `DataTable` | Tabla operativa en AdminOrders | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-047` | `/admin/orders` | `pages/admin/AdminOrders.jsx:1706` | `table inline` | Tabla operativa en AdminOrders | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-048` | `/admin/orders` | `pages/admin/AdminOrders.jsx:2128` | `table inline` | Tabla operativa en AdminOrders | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-049` | `/admin/payment-methods` | `pages/admin/AdminPaymentMethods.jsx:265` | `au-table` | Sin métodos | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-050` | `/admin/payment-methods` | `pages/admin/AdminPaymentMethods.jsx:316` | `au-table` | Sin cuentas | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-051` | `/admin/payments` | `pages/admin/AdminPayments.jsx:163` | `DataTable` | Tabla operativa en AdminPayments | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-052` | `/admin/procurement` | `pages/admin/AdminProcurement.jsx:376` | `au-table` | Órdenes de Compra | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-053` | `/admin/procurement` | `pages/admin/AdminProcurement.jsx:458` | `au-table` | Tabla operativa en AdminProcurement | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-054` | `/admin/procurement` | `pages/admin/AdminProcurement.jsx:544` | `au-table` | Recepciones de Mercadería | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-055` | `/admin/products/import` | `pages/admin/AdminProductImport.jsx:165` | `table inline` | Tabla operativa en AdminProductImport | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-056` | `/admin/products` | `pages/admin/AdminProducts.jsx:1155` | `DataTable` | Tabla operativa en AdminProducts | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-057` | `/admin/rewards/entries` | `pages/admin/AdminRewardsEntries.jsx:108` | `au-table` | No se pudieron cargar las participaciones | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-058` | `/admin/roles` | `pages/admin/AdminRoles.jsx:373` | `table inline` | Tabla operativa en AdminRoles | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-059` | `/admin/special-orders` | `pages/admin/AdminSpecialOrders.jsx:154` | `au-table` | Sin solicitudes | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-060` | `/admin/suppliers/:id` | `pages/admin/AdminSupplierDetail.jsx:330` | `au-table` | Productos y variantes suministradas | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-061` | `/admin/suppliers` | `pages/admin/AdminSuppliers.jsx:218` | `au-table` | Tabla operativa en AdminSuppliers | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-062` | `/admin/users` | `pages/admin/AdminUsers.jsx:391` | `DataTable` | Tabla operativa en AdminUsers | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-063` | `/admin/users` | `pages/admin/AdminUsers.jsx:407` | `DataTable` | Tabla operativa en AdminUsers | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |
| `SURF-TBL-064` | `/admin/users` | `pages/admin/AdminUsers.jsx:423` | `DataTable` | Tabla operativa en AdminUsers | DataTable Nimbus (thead claro #F9FAFB) | QA-INT-02 + 234 VP |

---

## 6. FORMULARIOS Y EDITORES DE CAPTURA (`SURF-FRM-001` .. `SURF-FRM-034` — 34 ELEMENTOS INDIVIDUALES)

*(Adicionales a los campos contenidos dentro de las `42` instancias de `<FormModal>` inventariadas en la Sección 4.)*

| ID | Ruta Padre | Archivo Fuente:Línea | Tipo Actual | Propósito / Handler | Patrón Nimbus Objetivo | Método de Prueba |
|---|---|---|---|---|---|---|
| `SURF-FRM-001` | `/admin/products/:id` | `components/admin/ProductSuppliersTab.jsx:253` | `<form>` | Formulario handleLink en ProductSuppliersTab | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-002` | `/admin/inventory` | `components/admin/WmsInventoryTabs.jsx:206` | `<form>` | Formulario handleCreate en WmsInventoryTabs | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-003` | `/admin/inventory` | `components/admin/WmsInventoryTabs.jsx:394` | `<form>` | Formulario handleAdjust en WmsInventoryTabs | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-004` | `/admin/inventory` | `components/admin/WmsInventoryTabs.jsx:571` | `<form>` | Formulario handleTransfer en WmsInventoryTabs | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-005` | `/admin/inventory` | `components/admin/WmsInventoryTabs.jsx:797` | `<form>` | Formulario handleRegularize en WmsInventoryTabs | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-006` | `/admin/costing` | `pages/admin/AdminCostPricing.jsx:418` | `<form>` | Formulario handleCreateLandedCost en AdminCostPricing | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-007` | `/admin/costing` | `pages/admin/AdminCostPricing.jsx:1056` | `<form>` | Formulario handleCreatePolicy en AdminCostPricing | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-008` | `/admin/costing` | `pages/admin/AdminCostPricing.jsx:1172` | `<form>` | Formulario handleRunSimulation en AdminCostPricing | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-009` | `/admin/login` | `pages/admin/AdminLogin.jsx:65` | `<form>` | Formulario handleSubmit en AdminLogin | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-010` | `/admin/marketing` | `pages/admin/AdminMarketing.jsx:425` | `<form>` | Formulario handleCreateCoupon en AdminMarketing | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-011` | `/admin/marketing` | `pages/admin/AdminMarketing.jsx:561` | `<form>` | Formulario handleCreatePromo en AdminMarketing | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-012` | `/admin/marketing` | `pages/admin/AdminMarketing.jsx:639` | `<form>` | Formulario handlePreviewPricing en AdminMarketing | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-013` | `/admin/marketing` | `pages/admin/AdminMarketing.jsx:806` | `<form>` | Formulario handleRecordConsent en AdminMarketing | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-014` | `/admin/orders` | `pages/admin/AdminOrders.jsx:1310` | `<form>` | Formulario handleCreateManualOrderSubmit en AdminOrders | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-015` | `/admin/procurement` | `pages/admin/AdminProcurement.jsx:505` | `<form>` | Formulario handleUploadDoc en AdminProcurement | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-016` | `/admin/procurement` | `pages/admin/AdminProcurement.jsx:588` | `<form>` | Formulario handleCreatePo en AdminProcurement | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-017` | `/admin/procurement` | `pages/admin/AdminProcurement.jsx:650` | `<form>` | Formulario handleCreateGr en AdminProcurement | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-018` | `/admin/settings` | `pages/admin/AdminSettings.jsx:665` | `<form>` | Formulario handleSaveDraft en AdminSettings | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-019` | `/admin/settings` | `pages/admin/AdminSettings.jsx:691` | `<form>` | Formulario handleAddSlide en AdminSettings | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-020` | `/admin/settings` | `pages/admin/AdminSettings.jsx:749` | `<form>` | Formulario handleUploadAsset en AdminSettings | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-021` | `/admin/settings` | `pages/admin/AdminSettings.jsx:797` | `<form>` | Formulario handleAddBanner en AdminSettings | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-022` | `/admin/settings` | `pages/admin/AdminSettings.jsx:843` | `<form>` | Formulario handleAddAnnouncement en AdminSettings | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-023` | `/admin/settings` | `pages/admin/AdminSettings.jsx:882` | `<form>` | Formulario handleSaveDraft en AdminSettings | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-024` | `/admin/settings` | `pages/admin/AdminSettings.jsx:913` | `<form>` | Formulario handleSaveDraft en AdminSettings | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-025` | `/admin/settings` | `pages/admin/AdminSettings.jsx:932` | `<form>` | Formulario handleSaveDraft en AdminSettings | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-026` | `/admin/settings` | `pages/admin/AdminSettings.jsx:1089` | `<form>` | Formulario handleSaveSystemic en AdminSettings | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-027` | `/admin/suppliers/:id` | `pages/admin/AdminSupplierDetail.jsx:303` | `<form>` | Formulario handleAddContact en AdminSupplierDetail | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-028` | `/admin/suppliers` | `pages/admin/AdminSuppliers.jsx:275` | `<form>` | Formulario handleCreateSupplier en AdminSuppliers | Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-029` | `/admin/products/:id` | `pages/admin/AdminProductDetail.jsx:310` | `Stateful Editor` | Editor de Creación/Edición de Variante Comercial (handleSaveVariant) | Card + FormField Nimbus claro (sin bentoInput) | QA-INT-04 + E2E |
| `SURF-FRM-030` | `/admin/products/:id` | `pages/admin/AdminProductDetail.jsx:421` | `Stateful Editor` | Editor de Especificaciones Técnicas Estructuradas BF-44 (handleSaveSpecs) | Card + FormField Nimbus claro | QA-INT-04 + E2E |
| `SURF-FRM-031` | `/admin/products/:id` | `pages/admin/AdminProductDetail.jsx:487` | `Stateful Editor` | Editor General y Precios Multi-Moneda del Producto Maestro (handleSaveGeneral) | Layout 2/3+1/3 + Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-032` | `/admin/suppliers/:id` | `pages/admin/AdminSupplierDetail.jsx:175` | `Stateful Editor` | Editor de Ficha Maestra y Condiciones de Proveedor (handleSaveProfile) | Layout 2 cols + Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-033` | `/admin/b2b` | `pages/admin/AdminB2BQuotes.jsx:510` | `Stateful Editor` | Generador Pro de Cotizaciones B2B Multi-Ítem | Layout 2 cols + Card + FormField Nimbus | QA-INT-04 + E2E |
| `SURF-FRM-034` | `/admin/loyalty` | `pages/admin/AdminLoyalty.jsx:270` | `Stateful Editor` | Editor de Reglas del Programa LevelPro Club (saveConfig) | Card + FormField Nimbus | QA-INT-04 + E2E |

---

## 7. ESTADOS TRANSVERSALES OBLIGATORIOS (`SURF-ST-001` .. `SURF-ST-008` — 8 ELEMENTOS)

| ID | Estado | Componente `ui/` | Patrón Nimbus | Regla de Verificación |
|---|---|---|---|---|
| `SURF-ST-001` | Carga Inicial (`Skeleton`) | `SkeletonCard`, `SkeletonTable` | `Skeleton` (`atomic/Skeleton`) | Sin pantallas vacías ni saltos bruscos de layout |
| `SURF-ST-002` | Mutación en Curso (`Loading`) | `PrimaryButton loading` | `Spinner` (`atomic/Spinner`) | Bloquea doble submit durante petición HTTP |
| `SURF-ST-003` | Vacío por Búsqueda / Filtro | `EmptyState` | `EmptyMessage` (*With icon*, `v1.2.6`) | Incluye acción directa `Limpiar filtros` |
| `SURF-ST-004` | Estado Inicial de Módulo | `EmptyState` | `InitialScreen` / `EmptyMessage` | Guía contextual + CTA primario según permiso RBAC |
| `SURF-ST-005` | Error de Carga o Validación | `ErrorState` / `AlertBanner` | `Alert appearance="danger"` | Expone mensaje claro y acción `Reintentar` |
| `SURF-ST-006` | Confirmación Efímera | `showToast` | `Toast` (`4000ms`, `zIndex: 800`) | Retroalimentación no bloqueante tras guardar/exportar |
| `SURF-ST-007` | Restricción RBAC Zero-Trust | `AdminLayout` / controles | `Disabled` (`#E7E7E7`/`#6D6D6D`) u ocultación | Coherente con `getMyPermissions()` y backend `403` |
| `SURF-ST-008` | Cambios sin Guardar | `UnsavedChangesBar` | Sticky Save Bar Tiendanube | Se activa cuando `isDirty === true` en editores maestros |

