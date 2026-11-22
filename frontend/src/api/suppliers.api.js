// api/suppliers.api.js — Cliente API para Gestión de Proveedores (Gate 3)

import api from "./client"

const BASE = "/admin"

export const getAdminSuppliers = (params) =>
  api.get(`${BASE}/suppliers/`, { params }).then(r => r.data)

export const createAdminSupplier = (data) =>
  api.post(`${BASE}/suppliers/`, data).then(r => r.data)

export const getAdminSupplier = (id) =>
  api.get(`${BASE}/suppliers/${id}/`).then(r => r.data)

export const updateAdminSupplier = (id, data) =>
  api.patch(`${BASE}/suppliers/${id}/`, data).then(r => r.data)

export const deactivateAdminSupplier = (id) =>
  api.delete(`${BASE}/suppliers/${id}/`).then(r => r.data)

export const reactivateAdminSupplier = (id) =>
  api.post(`${BASE}/suppliers/${id}/reactivate/`).then(r => r.data)

export const createAdminSupplierContact = (supplierId, data) =>
  api.post(`${BASE}/suppliers/${supplierId}/contacts/`, data).then(r => r.data)

export const deleteAdminSupplierContact = (supplierId, contactId) =>
  api.delete(`${BASE}/suppliers/${supplierId}/contacts/${contactId}/`).then(r => r.data)

export const getAdminSupplierProducts = (supplierId) =>
  api.get(`${BASE}/suppliers/${supplierId}/products/`).then(r => r.data)

export const linkAdminSupplierProduct = (supplierId, data) =>
  api.post(`${BASE}/suppliers/${supplierId}/products/`, data).then(r => r.data)

export const updateAdminSupplierProduct = (supplierId, linkId, data) =>
  api.patch(`${BASE}/suppliers/${supplierId}/products/${linkId}/`, data).then(r => r.data)

export const deactivateAdminSupplierProduct = (supplierId, linkId) =>
  api.delete(`${BASE}/suppliers/${supplierId}/products/${linkId}/`).then(r => r.data)

export const getAdminSupplierPriceHistory = (supplierId) =>
  api.get(`${BASE}/suppliers/${supplierId}/price-history/`).then(r => r.data)

export const importSupplierPriceLists = (file, { dryRun = true, allowExpired = false } = {}) => {
  const formData = new FormData()
  formData.append("file", file)
  return api.post(`${BASE}/suppliers/price-lists/import/`, formData, {
    params: {
      dry_run: dryRun ? "true" : "false",
      confirm: dryRun ? "false" : "true",
      allow_expired: allowExpired ? "true" : "false",
    },
    headers: { "Content-Type": "multipart/form-data" },
  }).then(r => r.data)
}

export const getSupplierPriceListsExportUrl = (format = "xlsx", supplierId = "") => {
  const q = new URLSearchParams({ format })
  if (supplierId) q.set("supplier_id", supplierId)
  return `/api/v1/admin/suppliers/price-lists/export/?${q.toString()}`
}

export const getSupplierPriceListTemplateUrl = (format = "xlsx") =>
  `/api/v1/admin/suppliers/price-lists/template/?format=${format}`

export const getAdminProductSuppliers = (productId, params) =>
  api.get(`${BASE}/products/${productId}/suppliers/`, { params }).then(r => r.data)

export const linkProductSupplier = (productId, data) =>
  api.post(`${BASE}/products/${productId}/suppliers/`, data).then(r => r.data)

export const selectPreferredProductSupplier = (productId, linkId) =>
  api.post(`${BASE}/products/${productId}/suppliers/${linkId}/select-preferred/`).then(r => r.data)

export const getAdminProductSupplierPriceHistory = (productId, variantId = "") =>
  api.get(`${BASE}/products/${productId}/supplier-price-history/`, {
    params: variantId ? { variant_id: variantId } : undefined,
  }).then(r => r.data)
