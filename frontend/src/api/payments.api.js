// api/payments.api.js

import api from "./client"

// Métodos de pago activos + cuentas bancarias, filtrados por moneda.
// El checkout lee de acá (configurable desde el admin, nada hardcodeado).
export const getPaymentMethods = async (currency = "CLP") => {
  const response = await api.get("/payments/methods/", { params: { currency } })
  return response.data
}

export const createPayment = async (orderId, provider) => {
  const response = await api.post("/payments/create/", {
    order_id: orderId,
    provider,
  })
  return response.data
}

export const capturePayPal = async (paypalPaymentId, payerId) => {
  const response = await api.post("/payments/paypal/capture/", {
    paypal_payment_id: paypalPaymentId,
    payer_id:          payerId,
  })
  return response.data
}

export const getPaymentStatus = async (orderId) => {
  const response = await api.get(`/payments/status/${orderId}/`)
  return response.data
}