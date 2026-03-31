// api/admin.api.js

import api from "./client"

const BASE = "/admin"

// ── Dashboard & Analytics ────────────────────────────────────
export const getAdminDashboard  = () => api.get(`${BASE}/dashboard/`).then(r => r.data)
export const getAnalytics       = () => api.get(`${BASE}/analytics/`).then(r => r.data)

// ── Orders ───────────────────────────────────────────────────
export const getAdminOrders     = (params) => api.get(`${BASE}/orders/`, { params }).then(r => r.data)
export const getAdminOrder      = (id) => api.get(`${BASE}/orders/${id}/`).then(r => r.data)
export const updateOrderStatus  = (id, status) =>
  api.post(`${BASE}/orders/${id}/update_status/`, { status }).then(r => r.data)

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
export const createAdminBrand = (data) => api.post(`${BASE}/brands/`, data).then(r => r.data)
export const updateAdminBrand = (id, data) =>
  api.patch(`${BASE}/brands/${id}/`, data).then(r => r.data)
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

// ── Academy — inscripciones ──────────────────────────────────
export const getAdminEnrollments     = (params) =>
  api.get(`${BASE}/academy/enrollments/`, { params }).then(r => r.data)   // ← URL corregida
export const createAdminEnrollment   = (data) =>
  api.post(`${BASE}/academy/enrollments/create/`, data).then(r => r.data)

// ── Services ─────────────────────────────────────────────────
export const getAdminServices      = () => api.get(`${BASE}/services/`).then(r => r.data)
export const updateBookingStatus   = (id, status) =>
  api.patch(`${BASE}/bookings/${id}/status/`, { status }).then(r => r.data)
export const updateRequestStatus   = (id, data) =>
  api.patch(`${BASE}/requests/${id}/status/`, data).then(r => r.data)

// ── Import ───────────────────────────────────────────────────
export const importProducts    = (formData) =>
  api.post(`${BASE}/products/import/`, formData, {
    headers: { "Content-Type": "multipart/form-data" }
  }).then(r => r.data)
export const downloadTemplate  = () =>
  api.get(`${BASE}/products/template/`, { responseType: "blob" }).then(r => r.data)