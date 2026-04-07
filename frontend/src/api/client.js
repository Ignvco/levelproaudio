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
    const lsToken = localStorage.getItem("accessToken")
    const token = storeToken || lsToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
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
        localStorage.setItem("accessToken", newAccess)
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