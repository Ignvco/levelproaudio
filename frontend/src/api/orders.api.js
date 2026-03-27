// api/orders.api.js
// Llamadas al backend para órdenes y carrito

import api from "./client"

// ── Órdenes ──────────────────────────────────────────────────
export const getOrders = async () => {
  const response = await api.get("/orders/")
  return response.data
}

export const getOrder = async (id) => {
  const response = await api.get(`/orders/${id}/`)
  return response.data
}

export const createOrder = async (payload) => {
  const response = await api.post("/orders/", payload)
  return response.data
}



// ── Carrito ──────────────────────────────────────────────────
export const getActiveCart = async () => {
  const response = await api.get("/cart/active/")
  return response.data
}

export const addToCart = async (productId, quantity = 1) => {
  const response = await api.post("/cart/add_item/", {
    product_id: productId,
    quantity,
  })
  return response.data
}

export const clearCart = async () => {
  await api.delete("/cart/clear/")
}

export const cancelOrder = async (id) => {
  const response = await api.delete(`/orders/${id}/`)
  return response.data
}