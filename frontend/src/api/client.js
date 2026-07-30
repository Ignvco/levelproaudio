// api/client.js
import axios from "axios"
import { useAuthStore } from "../store/authStore"

// withCredentials: envía/recibe las cookies HTTPOnly de auth en cada request.
const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
})

api.interceptors.request.use(
  (config) => {
    // Si el body es FormData, borrar Content-Type para que el browser
    // inyecte el boundary del multipart automáticamente.
    if (config.data instanceof FormData) {
      if (config.headers) {
        delete config.headers["Content-Type"]
        delete config.headers["content-type"]
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// En 401 intenta renovar el access usando el refresh (cookie HTTPOnly) y reintenta.
let refreshing = null
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const url = original?.url || ""
    // No intentar refrescar en los propios endpoints de auth
    const isAuthCall = url.includes("/auth/login") || url.includes("/auth/token/refresh") || url.includes("/auth/logout")
    if (error.response?.status === 401 && !original._retry && !isAuthCall) {
      original._retry = true
      try {
        if (!refreshing) {
          refreshing = axios.post("/api/v1/auth/token/refresh/", {}, { withCredentials: true })
        }
        await refreshing
        refreshing = null
        return api(original)
      } catch {
        refreshing = null
        useAuthStore.getState().clearSession()
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

export default api
