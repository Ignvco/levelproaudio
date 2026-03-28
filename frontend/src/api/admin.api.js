// api/admin.api.js

import api from "./client"

const BASE = "/admin"

export const getAdminDashboard  = () => api.get(`${BASE}/dashboard/`).then(r => r.data)
export const getAdminOrders     = (params) => api.get(`${BASE}/orders/`, { params }).then(r => r.data)
export const updateOrderStatus  = (id, status) => api.post(`${BASE}/orders/${id}/update_status/`, { status }).then(r => r.data)
export const getAdminProducts   = (params) => api.get(`${BASE}/products/`, { params }).then(r => r.data)
export const getAdminUsers      = (params) => api.get(`${BASE}/users/`, { params }).then(r => r.data)
export const getAdminPayments   = (params) => api.get(`${BASE}/payments/`, { params }).then(r => r.data)
export const getAdminAcademy    = () => api.get(`${BASE}/academy/`).then(r => r.data)
export const getAdminServices   = () => api.get(`${BASE}/services/`).then(r => r.data)
export const updateBookingStatus = (id, status) => api.patch(`${BASE}/bookings/${id}/status/`, { status }).then(r => r.data)
export const updateRequestStatus = (id, data)   => api.patch(`${BASE}/requests/${id}/status/`, data).then(r => r.data)
export const getAnalytics = () => api.get("/admin/analytics/").then(r => r.data)