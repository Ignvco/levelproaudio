// api/b2b.api.js — Cotizaciones B2B mayoristas e institucionales (V3.3)
import api from "./client"

export const createB2BQuote = (payload) =>
  api.post("/b2b/quotes/", payload).then(r => r.data)

export const getAdminB2BQuotes = (params = {}) =>
  api.get("/admin/b2b/quotes/", { params }).then(r => r.data)

export const getAdminB2BQuoteDetail = (quoteId) =>
  api.get(`/admin/b2b/quotes/${quoteId}/`).then(r => r.data)

export const updateAdminB2BQuote = (quoteId, payload) =>
  api.patch(`/admin/b2b/quotes/${quoteId}/`, payload).then(r => r.data)

export const convertAdminB2BQuote = (quoteId) =>
  api.post(`/admin/b2b/quotes/${quoteId}/convert/`).then(r => r.data)
