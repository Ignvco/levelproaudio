// api/services.api.js

import api from "./client"

// ── Servicios ────────────────────────────────────────────────
export const getServices = async (params = {}) => {
  const response = await api.get("/services/", { params })
  return response.data
}

export const getService = async (slug) => {
  const response = await api.get(`/services/${slug}/`)
  return response.data
}

export const getServiceCategories = async () => {
  const response = await api.get("/service-categories/")
  return response.data
}

// ── Reservas ─────────────────────────────────────────────────
export const getBookings = async () => {
  const response = await api.get("/bookings/")
  return response.data
}

export const createBooking = async (payload) => {
  const response = await api.post("/bookings/", payload)
  return response.data
}

export const cancelBooking = async (id) => {
  await api.delete(`/bookings/${id}/`)
}

// ── Solicitudes ──────────────────────────────────────────────
export const getServiceRequests = async () => {
  const response = await api.get("/service-requests/")
  return response.data
}

export const createServiceRequest = async (payload) => {
  const response = await api.post("/service-requests/", payload)
  return response.data
}