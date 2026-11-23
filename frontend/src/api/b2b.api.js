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

// ── GATE 8: CRM, Organizaciones, Ficha 360°, Listas B2B, Cotizador Pro & Crédito ──

export const getCrmCustomers = (params = {}) =>
  api.get("/admin/crm/customers/", { params }).then(r => r.data)

export const saveCrmCustomer = (payload) =>
  api.post("/admin/crm/customers/", payload).then(r => r.data)

export const getCrmCustomer360 = (customerId) =>
  api.get(`/admin/crm/customers/${customerId}/360/`).then(r => r.data)

export const upsertCrmTechnicalProfile = (customerId, payload) =>
  api.post(`/admin/crm/customers/${customerId}/technical-profile/`, payload).then(r => r.data)

export const logCrmInteraction = (customerId, payload) =>
  api.post(`/admin/crm/customers/${customerId}/interactions/`, payload).then(r => r.data)

export const getCrmOrganizations = () =>
  api.get("/admin/crm/organizations/").then(r => r.data)

export const saveCrmOrganization = (payload) =>
  api.post("/admin/crm/organizations/", payload).then(r => r.data)

export const addCrmOrgContact = (orgId, payload) =>
  api.post(`/admin/crm/organizations/${orgId}/contacts/`, payload).then(r => r.data)

export const getB2BPriceLists = () =>
  api.get("/admin/b2b/price-lists/").then(r => r.data)

export const saveB2BPriceList = (payload) =>
  api.post("/admin/b2b/price-lists/", payload).then(r => r.data)

export const resolveB2BPrice = (payload) =>
  api.post("/admin/b2b/price-lists/resolve/", payload).then(r => r.data)

export const createProB2BQuote = (payload) =>
  api.post("/admin/b2b/quotes/pro/", payload).then(r => r.data)

export const transitionB2BQuoteStatus = (quoteId, status) =>
  api.post(`/admin/b2b/quotes/${quoteId}/status/`, { status }).then(r => r.data)

export const getB2BQuotePdfMeta = (quoteId, design = "classic_corporate") =>
  api.get(`/admin/b2b/quotes/${quoteId}/pdf/`, { params: { design, meta: 1 } }).then(r => r.data)

export const downloadB2BQuotePdfBlob = (quoteId, design = "classic_corporate") =>
  api.get(`/admin/b2b/quotes/${quoteId}/pdf/`, { params: { design }, responseType: "blob" }).then(r => r.data)

export const shareB2BQuote = (quoteId, payload = {}) =>
  api.post(`/admin/b2b/quotes/${quoteId}/share/`, payload).then(r => r.data)

export const convertProB2BQuote = (quoteId, payload = {}) =>
  api.post(`/admin/b2b/quotes/${quoteId}/convert-pro/`, payload).then(r => r.data)

export const getB2BCreditAccounts = () =>
  api.get("/admin/b2b/credit-accounts/").then(r => r.data)

export const requestB2BCreditAccount = (payload) =>
  api.post("/admin/b2b/credit-accounts/", payload).then(r => r.data)

export const decideB2BCreditAccount = (accountId, payload) =>
  api.post(`/admin/b2b/credit-accounts/${accountId}/decide/`, payload).then(r => r.data)
