// store/authStore.js

import { create } from "zustand"
import { persist } from "zustand/middleware"
import axios from "axios"

// ← Importación directa de axios para evitar dependencia circular con api/client.js
const authAxios = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
})

export const useAuthStore = create(
  persist(
    (set, get) => ({

      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      setTokens: (access, refresh) => {
        localStorage.setItem("accessToken", access)
        localStorage.setItem("refreshToken", refresh)
        set({
          accessToken: access,
          refreshToken: refresh,
          isAuthenticated: true,
        })
      },

      setUser: (user) => set({ user }),

      login: async (email, password) => {
        // ← URL correcta según las rutas del backend
        const { data } = await authAxios.post("/auth/login/", { email, password })

        // Guarda tokens
        localStorage.setItem("accessToken", data.access)
        localStorage.setItem("refreshToken", data.refresh)

        // Obtiene el perfil — URL correcta es /auth/profile/
        const { data: user } = await authAxios.get("/auth/profile/", {
          headers: { Authorization: `Bearer ${data.access}` }
        })

        set({
          accessToken: data.access,
          refreshToken: data.refresh,
          isAuthenticated: true,
          user,
        })

        return user
      },

      register: async (formData) => {
      const username = formData.email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "") + Math.floor(Math.random() * 1000)
      await authAxios.post("/auth/register/", { ...formData, username })
        // Auto-login después del registro
        const { data } = await authAxios.post("/auth/login/", {
          email: formData.email,
          password: formData.password,
        })
        localStorage.setItem("accessToken", data.access)
        localStorage.setItem("refreshToken", data.refresh)
        const { data: user } = await authAxios.get("/auth/profile/", {
          headers: { Authorization: `Bearer ${data.access}` }
        })
        set({ accessToken: data.access, refreshToken: data.refresh, isAuthenticated: true, user })
        return user
      },

      logout: () => {
        localStorage.removeItem("accessToken")
        localStorage.removeItem("refreshToken")
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        })
      },

      getToken: () => get().accessToken,
    }),
    {
      name: "levelproaudio-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)