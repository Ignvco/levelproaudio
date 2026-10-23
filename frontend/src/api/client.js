// api/client.js
import { createApiClient, authClient } from "./http"
import { useAuthStore } from "../store/authStore"

// withCredentials: envía/recibe las cookies HTTPOnly de auth en cada request.
const api = createApiClient()

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
    const isAuthCall = url.includes("/auth/login") || url.includes("/auth/token/refresh") || url.includes("/auth/logout") || url.includes("/auth/csrf")
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true
      try {
        if (!refreshing) {
          refreshing = authClient.post("/auth/token/refresh/", {})
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
