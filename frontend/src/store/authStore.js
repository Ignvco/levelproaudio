// store/authStore.js
import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import axios from "axios"

// Los tokens JWT viven en cookies HTTPOnly (no accesibles desde JS).
// El store sólo guarda el objeto `user` y el flag `isAuthenticated` para la UI;
// la fuente de verdad de la sesión es la cookie, que se valida con checkAuth().
const authAxios = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
})

// Limpieza one-shot de tokens legacy que quedaron en storage de versiones previas.
;(function purgeLegacyTokens() {
  try {
    for (const key of ["accessToken", "refreshToken"]) {
      sessionStorage.removeItem(key)
      localStorage.removeItem(key)
    }
  } catch { /* noop */ }
})()

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,

      setUser: (user) => set({ user }),

      login: async (email, password) => {
        await authAxios.post("/auth/login/", { email, password })
        const { data: user } = await authAxios.get("/auth/profile/")
        set({ isAuthenticated: true, user })
        return user
      },

      register: async (formData) => {
        const username =
          formData.email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "") +
          Math.floor(Math.random() * 1000)
        await authAxios.post("/auth/register/", { ...formData, username })
        await authAxios.post("/auth/login/", {
          email: formData.email,
          password: formData.password,
        })
        const { data: user } = await authAxios.get("/auth/profile/")
        set({ isAuthenticated: true, user })
        return user
      },

      // Valida la sesión contra la cookie al cargar la app.
      checkAuth: async () => {
        try {
          const { data: user } = await authAxios.get("/auth/profile/")
          set({ isAuthenticated: true, user })
          return user
        } catch {
          set({ isAuthenticated: false, user: null })
          return null
        }
      },

      logout: async () => {
        try {
          await authAxios.post("/auth/logout/")
        } catch { /* noop */ }
        set({ user: null, isAuthenticated: false })
      },

      // Limpieza local sin llamada al backend (usado por el interceptor en 401).
      clearSession: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: "levelproaudio-auth",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
