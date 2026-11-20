// api/audit.api.js
/**
 * Cliente de API para el Registro de Actividad y Auditoría LEVELPRO OS V4.0 (Gate 1.2).
 */

import api from "./client"

export const getAuditEvents = (params = {}) =>
  api.get("/admin/audit/events/", { params }).then((r) => r.data)

export const getAuditEventDetail = (eventId) =>
  api.get(`/admin/audit/events/${eventId}/`).then((r) => r.data)

export const getAuditSummary = () =>
  api.get("/admin/audit/summary/").then((r) => r.data)

export const getAuditCatalog = () =>
  api.get("/admin/audit/catalog/").then((r) => r.data)

export const exportAuditCsv = (params = {}) =>
  api.get("/admin/audit/events/export/", {
    params,
    responseType: "blob",
  })
