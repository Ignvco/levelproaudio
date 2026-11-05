// dashboardPaymentMethods.js — lógica pura del panel de pedidos.
const EXECUTABLE_METHODS = new Set([
  "mercadopago_cl", "mercadopago_ar", "paypal",
  "transfer", "payoneer", "global66",
])

export function availableOrderPaymentMethods(response) {
  return Array.isArray(response?.methods)
    ? response.methods.filter(m => EXECUTABLE_METHODS.has(m?.id))
    : []
}

export function selectedOrderPaymentMethod(requested, methods) {
  if (!Array.isArray(methods) || methods.length === 0) return ""
  return methods.some(m => m.id === requested) ? requested : methods[0].id
}

export function paymentNextStep(provider, response, orderId) {
  if (provider === "mercadopago_cl" || provider === "mercadopago_ar") {
    const url = response?.init_point || response?.sandbox_url
    return typeof url === "string" && url.startsWith("https://")
      ? { type: "external", url }
      : null
  }
  if (provider === "paypal") {
    const url = response?.approve_url
    return typeof url === "string" && url.startsWith("https://")
      ? { type: "external", url }
      : null
  }
  if (["transfer", "payoneer", "global66"].includes(provider) && orderId) {
    return { type: "internal", url: `/payment/transfer/${orderId}` }
  }
  return null
}
