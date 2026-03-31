// api/products.api.js

import api from "./client"

export const getProducts = async (params = {}) => {
  const response = await api.get("/products/", { params })
  return response.data
}

export const getProduct = async (slug) => {
  const response = await api.get(`/products/${slug}/`)
  return response.data
}

export const getCategories = async () => {
  const response = await api.get("/categories/")
  return response.data
}

export const getBrands = async () => {
  const response = await api.get("/brands/")
  return response.data
}