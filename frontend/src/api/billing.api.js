// api/billing.api.js
import api from "./client"

// Cliente
export const getMyDocuments = () =>
  api.get("/billing/my-documents/").then(r => r.data.results || [])

export const downloadMyDocument = (id) =>
  api.get(`/billing/download/${id}/`, { responseType: "blob" })
