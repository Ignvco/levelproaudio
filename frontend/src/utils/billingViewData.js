// Billing records describe externally issued tax documents.
// Native order prices in USD/ARS are never presumed equal to the SII document amount.
export function initialTaxDocumentAmount(doc, order) {
  if (doc?.monto !== null && doc?.monto !== undefined) return doc.monto
  if (order?.currency !== "CLP") return ""
  return order?.total ?? ""
}
