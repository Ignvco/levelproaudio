// api/client.js
// Cliente axios base con interceptores JWT
// - Adjunta el token Bearer automáticamente en cada request
// - Si el token expiró (401), intenta renovarlo con el refreshToken
// - Si el refresh también falla, hace logout automático

import axios from "axios"
import { useAuthStore } from "../store/authStore"

const api = axios.create({
  baseURL: "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
})

// ── Interceptor de REQUEST ──────────────────────────────
// Antes de cada llamada, adjunta el token si existe
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ── Interceptor de RESPONSE ─────────────────────────────
// Si el backend responde 401 (token expirado), renueva y reintenta
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Evita loop infinito — solo reintenta una vez
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const { refreshToken, setTokens, logout } = useAuthStore.getState()

        if (!refreshToken) {
          logout()
          return Promise.reject(error)
        }

        // Pide un nuevo access token con el refresh token
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1"}/auth/token/refresh/`,
          { refresh: refreshToken }
        )

        const newAccessToken = response.data.access
        const newRefreshToken = response.data.refresh

        // Guarda los nuevos tokens
        setTokens(newAccessToken, newRefreshToken)

        // Reintenta el request original con el nuevo token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return api(originalRequest)

      } catch (refreshError) {
        // Si el refresh falló, cierra sesión
        useAuthStore.getState().logout()
        window.location.href = "/login"
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api