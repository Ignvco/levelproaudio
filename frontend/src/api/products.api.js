import api from "./client"

export const getProducts = (params) =>
  api.get("/products/", { params }).then(r => r.data)  // ← .then obligatorio

export const getProduct = (slug) =>
  api.get(`/products/${slug}/`).then(r => r.data)

export const getCategories = () =>
  api.get("/categories/").then(r => r.data)

export const getBrands = () =>
  api.get("/brands/").then(r => r.data)