// store/authStore.js

import { create } from "zustand"
import { persist } from "zustand/middleware"

export const useAuthStore = create(
  persist(
    (set, get) => ({

      // Estado — todo bajo "accessToken" consistentemente
      accessToken:     null,
      refreshToken:    null,
      user:            null,
      isAuthenticated: false,

      // Guarda tokens y marca al usuario como autenticado
      setTokens: (access, refresh) => {
        localStorage.setItem("accessToken", access)
        localStorage.setItem("refreshToken", refresh)
        set({
          accessToken:     access,
          refreshToken:    refresh,
          isAuthenticated: true,
        })
      },

      // Guarda los datos del perfil del usuario
      setUser: (user) => set({ user }),

      // Limpia todo al hacer logout
      logout: () => {
        localStorage.removeItem("accessToken")
        localStorage.removeItem("refreshToken")
        set({
          accessToken:     null,
          refreshToken:    null,
          user:            null,
          isAuthenticated: false,
        })
      },

      // Helper — retorna el token actual
      getToken: () => get().accessToken,
    }),
    {
      name: "levelproaudio-auth",
      partialize: (state) => ({
        accessToken:     state.accessToken,   // ← corregido
        refreshToken:    state.refreshToken,
        user:            state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)