// api/admin.api.js

import api from "./client"

const BASE = "/admin"

// React Query also passes a context object to a queryFn reference.
const reportingCurrency = value => typeof value === "string" && ["CLP", "USD", "ARS"].includes(value) ? value : "CLP"

// ── Dashboard & Analytics ────────────────────────────────────
export const getAdminDashboard  = (currency = "CLP") => api.get(`${BASE}/dashboard/`, { params: { currency: reportingCurrency(currency) } }).then(r => r.data)
export const getAnalytics       = (currency = "CLP") => api.get(`${BASE}/analytics/`, { params: { currency: reportingCurrency(currency) } }).then(r => r.data)

// ── Orders ───────────────────────────────────────────────────
export const getAdminOrders     = (params) => api.get(`${BASE}/orders/`, { params }).then(r => r.data)
export const getAdminOrder      = (id) => api.get(`${BASE}/orders/${id}/`).then(r => r.data)
export const updateOrderStatus  = (id, status) =>
  api.post(`${BASE}/orders/${id}/update_status/`, { status }).then(r => r.data)
export const updateOrderShipping = (id, data) =>
  api.patch(`${BASE}/orders/${id}/`, data).then(r => r.data)

// ── GATE 7: Order Management System (OMS) ─────────────────────
export const getAdminManualOrders = (params) =>
  api.get(`${BASE}/orders/manual/`, { params }).then(r => r.data)
export const getAdminManualOrder = (draftId) =>
  api.get(`${BASE}/orders/manual/${draftId}/`).then(r => r.data)
export const createAdminManualOrder = (data) =>
  api.post(`${BASE}/orders/manual/`, data).then(r => r.data)
export const updateAdminManualOrder = (draftId, data) =>
  api.patch(`${BASE}/orders/manual/${draftId}/`, data).then(r => r.data)
export const convertAdminManualOrder = (draftId, data = {}) =>
  api.post(`${BASE}/orders/manual/${draftId}/convert/`, data).then(r => r.data)
export const cancelAdminManualOrder = (draftId, data = {}) =>
  api.post(`${BASE}/orders/manual/${draftId}/cancel/`, data).then(r => r.data)
export const generateManualOrderWhatsappLink = (draftId, data = {}) =>
  api.post(`${BASE}/orders/manual/${draftId}/whatsapp-link/`, data).then(r => r.data)

export const getOrderStates3D = (orderId) =>
  api.get(`${BASE}/orders/${orderId}/states/`).then(r => r.data)
export const transitionOrderStates3D = (orderId, data) =>
  api.post(`${BASE}/orders/${orderId}/states/`, data).then(r => r.data)
export const getFulfillmentQueue = (params) =>
  api.get(`${BASE}/orders/fulfillment-queue/`, { params }).then(r => r.data)
export const dispatchOrderWMS = (orderId, data) =>
  api.post(`${BASE}/orders/${orderId}/dispatch/`, data).then(r => r.data)
export const recordOrderPaymentAttempt = (orderId, data) =>
  api.post(`${BASE}/orders/${orderId}/payment-attempt/`, data).then(r => r.data)

export const getAdminRMAs = (params) =>
  api.get(`${BASE}/orders/rmas/`, { params }).then(r => r.data)
export const getOrderRMAs = (orderId) =>
  api.get(`${BASE}/orders/${orderId}/rma/`).then(r => r.data)
export const createOrderRMA = (orderId, data) =>
  api.post(`${BASE}/orders/${orderId}/rma/`, data).then(r => r.data)
export const authorizeAdminRMA = (rmaId, data) =>
  api.post(`${BASE}/orders/rmas/${rmaId}/authorize/`, data).then(r => r.data)
export const inspectAdminRMA = (rmaId, data) =>
  api.post(`${BASE}/orders/rmas/${rmaId}/inspect/`, data).then(r => r.data)
export const refundAdminRMA = (rmaId, data) =>
  api.post(`${BASE}/orders/rmas/${rmaId}/refund/`, data).then(r => r.data)

// ── Products ─────────────────────────────────────────────────
export const getAdminProducts   = (params) => api.get(`${BASE}/products/`, { params }).then(r => r.data)
export const getAdminProduct    = (id) => api.get(`${BASE}/products/${id}/`).then(r => r.data)
export const createAdminProduct = (data) => api.post(`${BASE}/products/`, data).then(r => r.data)
export const updateAdminProduct = (id, data) =>
  api.patch(`${BASE}/products/${id}/`, data).then(r => r.data)
export const deleteAdminProduct = (id) =>
  api.delete(`${BASE}/products/${id}/`).then(r => r.data)

// ── Product Images ───────────────────────────────────────────
export const getProductImages   = (productId) =>
  api.get(`${BASE}/products/${productId}/images/`).then(r => r.data)

export const uploadProductImage = (productId, formData) =>
  api.post(`${BASE}/products/${productId}/images/upload/`, formData, {
    headers: { "Content-Type": "multipart/form-data" }
  }).then(r => r.data)

export const deleteProductImage = (imageId) =>           // ← sin productId
  api.delete(`${BASE}/images/${imageId}/delete/`).then(r => r.data)

export const setPrimaryImage    = (imageId) =>
  api.patch(`${BASE}/images/${imageId}/primary/`).then(r => r.data)

// ── Categories ───────────────────────────────────────────────
export const getAdminCategories  = (params) => api.get(`${BASE}/categories/`, { params }).then(r => r.data)
export const createAdminCategory = (data) => api.post(`${BASE}/categories/`, data).then(r => r.data)
export const updateAdminCategory = (id, data) =>
  api.patch(`${BASE}/categories/${id}/`, data).then(r => r.data)
export const deleteAdminCategory = (id) =>
  api.delete(`${BASE}/categories/${id}/`).then(r => r.data)

// ── Brands ───────────────────────────────────────────────────
export const getAdminBrands  = (params) => api.get(`${BASE}/brands/`, { params }).then(r => r.data)
export const createAdminBrand = (data) =>
  api.post(`${BASE}/brands/`, data, {
    headers: { "Content-Type": "multipart/form-data" }
  }).then(r => r.data)

export const updateAdminBrand = (id, data) =>
  api.patch(`${BASE}/brands/${id}/`, data, {
    headers: { "Content-Type": "multipart/form-data" }
  }).then(r => r.data)
export const deleteAdminBrand = (id) =>
  api.delete(`${BASE}/brands/${id}/`).then(r => r.data)

// ── Users ────────────────────────────────────────────────────
export const getAdminUsers  = (params) => api.get(`${BASE}/users/`, { params }).then(r => r.data)

// ── Payments ─────────────────────────────────────────────────
export const getAdminPayments = (params) => api.get(`${BASE}/payments/`, { params }).then(r => r.data)

// ── Academy — cursos ─────────────────────────────────────────
export const getAdminAcademy    = () => api.get(`${BASE}/academy/`).then(r => r.data)
export const getAdminCourses    = (params) => api.get(`${BASE}/academy/courses/`, { params }).then(r => r.data)
export const getAdminCourse     = (id) => api.get(`${BASE}/academy/courses/${id}/`).then(r => r.data)
export const createAdminCourse  = (data) => api.post(`${BASE}/academy/courses/`, data, {
  headers: { "Content-Type": "multipart/form-data" }
}).then(r => r.data)
export const updateAdminCourse  = (id, data) =>
  api.patch(`${BASE}/academy/courses/${id}/`, data, {
    headers: { "Content-Type": "multipart/form-data" }
  }).then(r => r.data)
export const deleteAdminCourse  = (id) =>
  api.delete(`${BASE}/academy/courses/${id}/`).then(r => r.data)

// ── Academy — módulos ────────────────────────────────────────
export const getAdminModules   = (params) => api.get(`${BASE}/academy/modules/`, { params }).then(r => r.data)
export const createAdminModule = (data) => api.post(`${BASE}/academy/modules/`, data).then(r => r.data)
export const updateAdminModule = (id, data) =>
  api.patch(`${BASE}/academy/modules/${id}/`, data).then(r => r.data)
export const deleteAdminModule = (id) =>
  api.delete(`${BASE}/academy/modules/${id}/`).then(r => r.data)

// ── Academy — lecciones ──────────────────────────────────────
export const getAdminLessons   = (params) => api.get(`${BASE}/academy/lessons/`, { params }).then(r => r.data)
export const createAdminLesson = (data) => api.post(`${BASE}/academy/lessons/`, data).then(r => r.data)
export const updateAdminLesson = (id, data) =>
  api.patch(`${BASE}/academy/lessons/${id}/`, data).then(r => r.data)
export const deleteAdminLesson = (id) =>
  api.delete(`${BASE}/academy/lessons/${id}/`).then(r => r.data)
export const getLessonVideoUploadUrl = (filename, contentType) =>
  api.post(`${BASE}/academy/lessons/upload-url/`, { filename, content_type: contentType }).then(r => r.data)

// ── Academy — inscripciones ──────────────────────────────────
export const getAdminEnrollments     = (params) =>
  api.get(`${BASE}/academy/enrollments/`, { params }).then(r => r.data)   // ← URL corregida
export const createAdminEnrollment   = (data) =>
  api.post(`${BASE}/academy/enrollments/create/`, data).then(r => r.data)

// ── Services ─────────────────────────────────────────────────
export const getAdminServices      = () => api.get(`${BASE}/services/list/`).then(r => r.data)
export const getAdminServiceRequests = () => api.get(`${BASE}/service-requests/`).then(r => r.data)
export const getAdminBookings      = () => api.get(`${BASE}/bookings/`).then(r => r.data)
export const updateBookingStatus   = (id, status) =>
  api.patch(`${BASE}/bookings/${id}/status/`, { status }).then(r => r.data)
export const updateRequestStatus   = (id, data) =>
  api.patch(`${BASE}/requests/${id}/status/`, data).then(r => r.data)

// ── Import / Export / Bulk PIM (Gate 2) ──────────────────────
export const importProducts    = (formData, { dryRun = false, confirm = false } = {}) =>
  api.post(`${BASE}/products/import/`, formData, {
    params: { dry_run: dryRun ? "true" : "false", confirm: confirm ? "true" : "false" },
    headers: { "Content-Type": "multipart/form-data" }
  }).then(r => r.data)
export const downloadTemplate  = (format = "xlsx") =>
  api.get(`${BASE}/products/template/`, { params: { format }, responseType: "blob" }).then(r => r.data)
export const exportAdminCatalog = (params = {}) =>
  api.get(`${BASE}/products/export/`, { params, responseType: "blob" }).then(r => r.data)

export const previewBulkProductsUpdate = (payload) =>
  api.post(`${BASE}/products/bulk-preview/`, payload).then(r => r.data)
export const applyBulkProductsUpdate = (payload, idempotencyKey) =>
  api.post(`${BASE}/products/bulk-apply/`, payload, {
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  }).then(r => r.data)

// ── Variants & Technical Specs (Gate 2 PIM) ──────────────────
export const getAdminProductVariants = (productId) =>
  api.get(`${BASE}/products/${productId}/variants/`).then(r => r.data)
export const createAdminProductVariant = (productId, data) =>
  api.post(`${BASE}/products/${productId}/variants/`, data).then(r => r.data)
export const updateAdminProductVariant = (productId, variantId, data) =>
  api.patch(`${BASE}/products/${productId}/variants/${variantId}/`, data).then(r => r.data)
export const deleteAdminProductVariant = (productId, variantId) =>
  api.delete(`${BASE}/products/${productId}/variants/${variantId}/`).then(r => r.data)

export const getTechnicalAttributesCatalog = (categoryId) =>
  api.get(`${BASE}/products/technical-attributes/`, { params: categoryId ? { category_id: categoryId } : {} }).then(r => r.data)
export const getAdminProductSpecs = (productId) =>
  api.get(`${BASE}/products/${productId}/technical-specs/`).then(r => r.data)
export const saveAdminProductSpecs = (productId, specs) =>
  api.put(`${BASE}/products/${productId}/technical-specs/`, { specs }).then(r => r.data)


// Al final del archivo, agrega:

// ── FINANZAS ─────────────────────────────────────────────────
export const getFinanceSummary     = (currency = "CLP") =>
  api.get(`${BASE}/finance/summary/`, { params: { currency: reportingCurrency(currency) } }).then(r => r.data)

export const getFinanceCategories  = () =>
  api.get(`${BASE}/finance/categories/`).then(r => r.data)

export const createFinanceCategory = (data) =>
  api.post(`${BASE}/finance/categories/`, data).then(r => r.data)

export const updateFinanceCategory = (id, data) =>
  api.patch(`${BASE}/finance/categories/${id}/`, data).then(r => r.data)

export const deleteFinanceCategory = (id) =>
  api.delete(`${BASE}/finance/categories/${id}/`).then(r => r.data)

export const getWithdrawals        = (currency = "CLP") =>
  api.get(`${BASE}/finance/withdrawals/`, { params: { currency: reportingCurrency(currency) } }).then(r => r.data)

export const createWithdrawal      = (data) =>
  api.post(`${BASE}/finance/withdrawals/`, data).then(r => r.data)

export const deleteWithdrawal      = (id) =>
  api.delete(`${BASE}/finance/withdrawals/${id}/`)

export const updatePaymentStatus = (id, status) =>
  api.patch(`${BASE}/payments/${id}/status/`, { status }).then(r => r.data)


// Inventario
export const getInventorySummary    = () =>
  api.get(`${BASE}/inventory/summary/`).then(r => r.data)

export const getInventoryAlerts     = () =>
  api.get(`${BASE}/inventory/alerts/`).then(r => r.data)

export const getInventoryRotation   = (currency = "CLP") =>
  api.get(`${BASE}/inventory/rotation/`, { params: { currency } }).then(r => r.data)

export const getInventoryByCategory = () =>
  api.get(`${BASE}/inventory/by-category/`).then(r => r.data)


// Loyalty — admin
// ← Estaban apuntando a ${BASE}/loyalty/admin/... 
// donde BASE = /api/v1/admin
// Eso genera /api/v1/admin/loyalty/admin/summary/ → INCORRECTO

// Cambia a rutas directas:
export const getLoyaltySummary   = () =>
  api.get("/loyalty/admin/summary/").then(r => r.data)

export const getLoyaltyConfig    = () =>
  api.get("/loyalty/admin/config/").then(r => r.data)

export const updateLoyaltyConfig = (data) =>
  api.patch("/loyalty/admin/config/", data).then(r => r.data)

export const adjustLoyaltyPoints = (data) =>
  api.post("/loyalty/admin/adjust/", data).then(r => r.data)

// Documentación Tributaria (registro/seguimiento — ya no facturador)
export const getTaxDashboard  = () =>
  api.get("/billing/dashboard/").then(r => r.data)

// Registra o actualiza el documento de una orden (número real del SII, etc.)
export const upsertTaxDocument = (data) =>
  api.post("/billing/record/", data).then(r => r.data)

// Sube el PDF real del SII (opcional) a un documento registrado
export const uploadTaxDocumentPdf = (docId, formData) =>
  api.post(`/billing/record/${docId}/pdf/`, formData).then(r => r.data)
// ── Services CRUD ────────────────────────────────────────
export const listAdminServicesCrud = () =>
  api.get(`${BASE}/services/list/`).then(r => r.data.results || [])

export const createAdminService = (data) =>
  api.post(`${BASE}/services/list/`, data).then(r => r.data)

export const updateAdminService = (id, data) =>
  api.patch(`${BASE}/services/${id}/`, data).then(r => r.data)

export const deleteAdminService = (id) =>
  api.delete(`${BASE}/services/${id}/`).then(r => r.data)

// ── Métodos de pago y cuentas bancarias (config) ─────────
export const listPaymentMethods = () =>
  api.get("/payments/admin/payment-methods/").then(r => r.data.results || r.data)

export const createPaymentMethod = (data) =>
  api.post("/payments/admin/payment-methods/", data).then(r => r.data)

export const updatePaymentMethod = (id, data) =>
  api.patch(`/payments/admin/payment-methods/${id}/`, data).then(r => r.data)

export const deletePaymentMethod = (id) =>
  api.delete(`/payments/admin/payment-methods/${id}/`).then(r => r.data)

export const listBankAccounts = () =>
  api.get("/payments/admin/bank-accounts/").then(r => r.data.results || r.data)

export const createBankAccount = (data) =>
  api.post("/payments/admin/bank-accounts/", data).then(r => r.data)

export const updateBankAccount = (id, data) =>
  api.patch(`/payments/admin/bank-accounts/${id}/`, data).then(r => r.data)

export const deleteBankAccount = (id) =>
  api.delete(`/payments/admin/bank-accounts/${id}/`).then(r => r.data)

// ── Rutas de certificación ───────────────────────────────
export const listAdminCertifications = () =>
  api.get(`${BASE}/academy/certifications/`).then(r => r.data.results || r.data)

export const createAdminCertification = (data) =>
  api.post(`${BASE}/academy/certifications/`, data).then(r => r.data)

export const updateAdminCertification = (id, data) =>
  api.patch(`${BASE}/academy/certifications/${id}/`, data).then(r => r.data)

export const deleteAdminCertification = (id) =>
  api.delete(`${BASE}/academy/certifications/${id}/`).then(r => r.data)

// ── Solicitudes bajo pedido ──────────────────────────────
export const listSpecialOrders = (params) =>
  api.get("/admin/special-orders/", { params }).then(r => r.data.results || r.data)

export const updateSpecialOrder = (id, data) =>
  api.patch(`/admin/special-orders/${id}/`, data).then(r => r.data)

export const deleteSpecialOrder = (id) =>
  api.delete(`/admin/special-orders/${id}/`).then(r => r.data)

// ── Gate 9: Financial Management (BF-24, BF-36, BF-37, BF-38, BF-39) ──
export const getFinanceReconciliation = (params = {}) =>
  api.get(`${BASE}/finance/reconciliation/`, { params }).then(r => r.data)

export const postFinanceReconciliation = (data) =>
  api.post(`${BASE}/finance/reconciliation/`, data).then(r => r.data)

export const getTreasuryAccounts = (params = {}) =>
  api.get(`${BASE}/finance/treasury-accounts/`, { params }).then(r => r.data)

export const createTreasuryAccount = (data) =>
  api.post(`${BASE}/finance/treasury-accounts/`, data).then(r => r.data)

export const postInternalTransfer = (data) =>
  api.post(`${BASE}/finance/treasury-accounts/internal-transfer/`, data).then(r => r.data)

export const importBankStatement = (formData) =>
  api.post(`${BASE}/finance/bank-statements/import/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then(r => r.data)

export const getBankTransactions = (params = {}) =>
  api.get(`${BASE}/finance/bank-transactions/`, { params }).then(r => r.data)

export const getAccountsReceivable = (params = {}) =>
  api.get(`${BASE}/finance/ar/`, { params }).then(r => r.data)

export const createAccountReceivable = (data) =>
  api.post(`${BASE}/finance/ar/`, data).then(r => r.data)

export const getArAging = (currency = "CLP") =>
  api.get(`${BASE}/finance/ar/aging/`, { params: { currency } }).then(r => r.data)

export const allocateReceivable = (arId, data) =>
  api.post(`${BASE}/finance/ar/${arId}/allocate/`, data).then(r => r.data)

export const getAccountsPayable = (params = {}) =>
  api.get(`${BASE}/finance/ap/`, { params }).then(r => r.data)

export const createAccountPayable = (data) =>
  api.post(`${BASE}/finance/ap/`, data).then(r => r.data)

export const payAccountPayable = (apId, data) =>
  api.post(`${BASE}/finance/ap/${apId}/pay/`, data).then(r => r.data)

export const getCashFlowProjection = (currency = "CLP", scenario = "base") =>
  api.get(`${BASE}/finance/cash-flow/`, { params: { currency, scenario } }).then(r => r.data)

export const downloadAccountingExportCsv = (currency = "CLP") =>
  api.get(`${BASE}/finance/accounting-export/`, {
    params: { currency },
    responseType: "blob",
  }).then(r => r.data)
