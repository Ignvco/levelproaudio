import api from "./client"

export const getProducts = async (params = {}) => {
  const response = await api.get("/products/", { params })
  return response.data
}

export const getProduct = async (slug) => {
  const response = await api.get(`/products/${slug}/`)
  return response.data
}