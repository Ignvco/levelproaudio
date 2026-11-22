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

// ── GATE 6: Cost & Pricing Intelligence (BF-09 & BF-18) ─────────────────────

export async function listLandedCostAllocations(params = {}) {
  const res = await api.get("/admin/costing/landed-cost/", { params })
  return res.data
}

export async function getLandedCostAllocation(allocId) {
  const res = await api.get(`/admin/costing/landed-cost/${allocId}/`)
  return res.data
}

export async function createLandedCostAllocation(payload, idempotencyKey = "") {
  const headers = idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}
  const res = await api.post("/admin/costing/landed-cost/", payload, { headers })
  return res.data
}

export async function finalizeLandedCostAllocation(allocId, idempotencyKey = "") {
  const headers = idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}
  const res = await api.post(`/admin/costing/landed-cost/${allocId}/finalize/`, {}, { headers })
  return res.data
}

export async function getCostLayersDashboard(params = {}) {
  const res = await api.get("/admin/costing/layers/", { params })
  return res.data
}

export async function getPricingMarginsReport(params = {}) {
  const res = await api.get("/admin/pricing/margins/", { params })
  return res.data
}

export async function createMarginPolicy(payload) {
  const res = await api.post("/admin/pricing/margins/", payload)
  return res.data
}

export async function runPricingSimulation(payload) {
  const res = await api.post("/admin/pricing/simulator/", payload)
  return res.data
}

export async function listPricingProposals() {
  const res = await api.get("/admin/pricing/simulator/")
  return res.data
}

export async function approvePricingProposal(proposalId) {
  const res = await api.post(`/admin/pricing/proposals/${proposalId}/approve/`, {})
  return res.data
}

