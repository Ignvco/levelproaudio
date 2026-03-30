// store/authStore.js
// Estado global de autenticación con persistencia en localStorage
// Zustand mantiene el token entre recargas de página

import { create } from "zustand"
import { persist } from "zustand/middleware"

export const useAuthStore = create(
  persist(
    (set, get) => ({

      // Estado
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      // Guarda tokens y marca al usuario como autenticado
      setTokens: (access, refresh) => {
        localStorage.setItem("accessToken", access)
        localStorage.setItem("refreshToken", refresh)
        set({ accessToken: access, refreshToken: refresh, isAuthenticated: true })
      },

      // Guarda los datos del perfil del usuario
      setUser: (user) => set({ user }),

      // Limpia todo al hacer logout
      logout: () => set({
        token: null,
        refreshToken: null,
        user: null,
        isAuthenticated: false,
      }),

      // Helper — retorna el token actual
      getToken: () => get().token,

    }),
    {
      name: "levelproaudio-auth",  // Clave en localStorage
      // Solo persistimos lo necesario, no funciones
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)