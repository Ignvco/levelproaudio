import api from "./client"

export async function listPurchaseOrders(params = {}) {
  const res = await api.get("/admin/purchase-orders/", { params })
  return res.data
}

export async function getPurchaseOrder(poId) {
  const res = await api.get(`/admin/purchase-orders/${poId}/`)
  return res.data
}

export async function createPurchaseOrder(payload) {
  const res = await api.post("/admin/purchase-orders/", payload)
  return res.data
}

export async function updatePurchaseOrder(poId, payload) {
  const res = await api.patch(`/admin/purchase-orders/${poId}/`, payload)
  return res.data
}

export async function approvePurchaseOrder(poId) {
  const res = await api.post(`/admin/purchase-orders/${poId}/approve/`)
  return res.data
}

export async function issuePurchaseOrder(poId) {
  const res = await api.post(`/admin/purchase-orders/${poId}/issue/`)
  return res.data
}

export async function cancelPurchaseOrder(poId, reason = "") {
  const res = await api.post(`/admin/purchase-orders/${poId}/cancel/`, { reason })
  return res.data
}

export async function closePurchaseOrder(poId, reason = "") {
  const res = await api.post(`/admin/purchase-orders/${poId}/close/`, { reason })
  return res.data
}

export function getPurchaseOrderPdfUrl(poId) {
  return `/api/v1/admin/purchase-orders/${poId}/pdf/`
}

export async function uploadCustomsDocument(poId, formData) {
  const res = await api.post(`/admin/purchase-orders/${poId}/documents/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return res.data
}

export function getCustomsDocumentDownloadUrl(poId, docId) {
  return `/api/v1/admin/purchase-orders/${poId}/documents/${docId}/download/`
}

export async function listGoodsReceipts(params = {}) {
  const res = await api.get("/admin/goods-receipts/", { params })
  return res.data
}

export async function createGoodsReceipt(payload, idempotencyKey = "") {
  const headers = idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}
  const res = await api.post("/admin/goods-receipts/", payload, { headers })
  return res.data
}

export async function confirmGoodsReceipt(grId, idempotencyKey = "") {
  const headers = idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}
  const res = await api.post(`/admin/goods-receipts/${grId}/confirm/`, {}, { headers })
  return res.data
}
