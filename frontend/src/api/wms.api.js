// api/wms.api.js — Cliente REST del Warehouse Management System (Gate 4)
import api from "./client"

export const getWarehouses = (params = {}) =>
  api.get("/admin/inventory/warehouses/", { params }).then(r => r.data)

export const createWarehouse = (payload) =>
  api.post("/admin/inventory/warehouses/", payload).then(r => r.data)

export const updateWarehouse = (id, payload) =>
  api.patch(`/admin/inventory/warehouses/${id}/`, payload).then(r => r.data)

export const getWmsStocks = (params = {}) =>
  api.get("/admin/inventory/stocks/", { params }).then(r => r.data)

export const adjustWmsStock = (payload, idempotencyKey) =>
  api.post("/admin/inventory/adjust/", payload, idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined).then(r => r.data)

export const getWmsKardex = (params = {}) =>
  api.get("/admin/inventory/kardex/", { params }).then(r => r.data)

export const getWmsKardexExportUrl = (params = {}) => {
  const qs = new URLSearchParams({ ...params, export: "csv" }).toString()
  return `/api/v1/admin/inventory/kardex/?${qs}`
}

export const getWmsReservations = (params = {}) =>
  api.get("/admin/inventory/reservations/", { params }).then(r => r.data)

export const expireWmsReservations = () =>
  api.post("/admin/inventory/reservations/expire/").then(r => r.data)

export const getWmsTransfers = () =>
  api.get("/admin/inventory/transfers/").then(r => r.data)

export const createWmsTransfer = (payload) =>
  api.post("/admin/inventory/transfers/", payload).then(r => r.data)

export const receiveWmsTransfer = (id) =>
  api.post(`/admin/inventory/transfers/${id}/receive/`).then(r => r.data)

export const getSerials = (params = {}) =>
  api.get("/admin/serials/", { params }).then(r => r.data)

export const registerSerials = (payload) =>
  api.post("/admin/serials/", payload).then(r => r.data)

export const regularizeSerials = (payload) =>
  api.post("/admin/serials/regularize/", payload).then(r => r.data)

export const setProductSerializationMode = (payload) =>
  api.post("/admin/serials/mode/", payload).then(r => r.data)
