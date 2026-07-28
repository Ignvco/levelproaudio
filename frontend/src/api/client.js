// api/client.js
import axios from "axios"
import { useAuthStore } from "../store/authStore"

const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
})

api.interceptors.request.use(
  (config) => {
    const storeToken = useAuthStore.getState().accessToken
    const ssToken = sessionStorage.getItem("accessToken")
      || localStorage.getItem("accessToken")   // fallback legacy
    const token = storeToken || ssToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // Si el body es FormData, borrar Content-Type para que el browser
    // inyecte el boundary del multipart automáticamente.
    // El default del client es "application/json" — si no lo sacamos,
    // se pisa el multipart y Django no recibe el archivo.
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

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = useAuthStore.getState().refreshToken
          || sessionStorage.getItem("refreshToken")
          || localStorage.getItem("refreshToken")

        if (!refreshToken) {
          useAuthStore.getState().logout()
          return Promise.reject(error)
        }

        // ← Esta URL SÍ existe: /auth/token/refresh/
        const { data } = await axios.post("/api/v1/auth/token/refresh/", {
          refresh: refreshToken,
        })

        const newAccess = data.access
        useAuthStore.getState().setTokens(newAccess, refreshToken)
        sessionStorage.setItem("accessToken", newAccess)
        original.headers.Authorization = `Bearer ${newAccess}`
        return api(original)
      } catch {
        useAuthStore.getState().logout()
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

export default api