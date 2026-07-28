// store/authStore.js

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import axios from "axios"

// ── Storage seguro: sessionStorage evita persistir tokens entre pestañas
// cerradas y mitiga vectores de XSS persistente vs localStorage.
// Se migra transparentemente cualquier valor previo de localStorage.
const secureStorage = {
  getItem: (name) => {
    const v = sessionStorage.getItem(name)
    if (v) return v
    // Migración transparente desde localStorage → sessionStorage
    const legacy = localStorage.getItem(name)
    if (legacy) {
      sessionStorage.setItem(name, legacy)
      localStorage.removeItem(name)
    }
    return legacy
  },
  setItem: (name, value) => sessionStorage.setItem(name, value),
  removeItem: (name) => {
    sessionStorage.removeItem(name)
    localStorage.removeItem(name)  // limpia migrar residual
  },
}

// ← Importación directa de axios para evitar dependencia circular con api/client.js
const authAxios = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
})

// Migración one-shot de tokens legacy en localStorage a sessionStorage
;(function migrateLegacyTokens() {
  for (const key of ["accessToken", "refreshToken"]) {
    const legacy = localStorage.getItem(key)
    if (legacy && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, legacy)
    }
    localStorage.removeItem(key)
  }
})()

export const useAuthStore = create(
  persist(
    (set, get) => ({

      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      setTokens: (access, refresh) => {
        sessionStorage.setItem("accessToken", access)
        sessionStorage.setItem("refreshToken", refresh)
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

        // Guarda tokens en sessionStorage
        sessionStorage.setItem("accessToken", data.access)
        sessionStorage.setItem("refreshToken", data.refresh)

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
        sessionStorage.setItem("accessToken", data.access)
        sessionStorage.setItem("refreshToken", data.refresh)
        const { data: user } = await authAxios.get("/auth/profile/", {
          headers: { Authorization: `Bearer ${data.access}` }
        })
        set({ accessToken: data.access, refreshToken: data.refresh, isAuthenticated: true, user })
        return user
      },

      logout: () => {
        sessionStorage.removeItem("accessToken")
        sessionStorage.removeItem("refreshToken")
        localStorage.removeItem("accessToken")   // limpia residuales
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
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)