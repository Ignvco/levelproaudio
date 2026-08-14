import api from "./client"

export const getProducts = (params) =>
  api.get("/products/", { params }).then(r => r.data)  // ← .then obligatorio

export const getProduct = (slug) =>
  api.get(`/products/${slug}/`).then(r => r.data)

export const getCategories = () =>
  api.get("/categories/").then(r => r.data)

export const getBrands = () =>
  api.get("/brands/").then(r => r.data)
// Solicitud de equipo bajo pedido (público)
export const createSpecialOrder = (data) =>
  api.post("/special-orders/", data).then(r => r.data)
