// store/favoritesStore.js — favoritos del usuario (solo logueado)
import { create } from "zustand"
import api from "../api/client"
import { useAuthStore } from "./authStore"

export const useFavoritesStore = create((set, get) => ({
  ids: [],
  loaded: false,

  load: async () => {
    if (!useAuthStore.getState().isAuthenticated) {
      set({ ids: [], loaded: true })
      return
    }
    try {
      const { data } = await api.get("/favorites/ids/")
      set({ ids: data.ids || [], loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  isFavorite: (id) => get().ids.includes(id),

  toggle: async (productId) => {
    if (!useAuthStore.getState().isAuthenticated) return { needAuth: true }
    const prev = get().ids
    const has  = prev.includes(productId)
    // Optimista
    set({ ids: has ? prev.filter(x => x !== productId) : [...prev, productId] })
    try {
      const { data } = await api.post("/favorites/toggle/", { product_id: productId })
      set(s => ({
        ids: data.favorited
          ? Array.from(new Set([...s.ids, productId]))
          : s.ids.filter(x => x !== productId),
      }))
      return { favorited: data.favorited }
    } catch {
      set({ ids: prev })
      return { error: true }
    }
  },

  clear: () => set({ ids: [], loaded: false }),
}))
