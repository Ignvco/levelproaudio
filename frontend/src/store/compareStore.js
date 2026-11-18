// store/compareStore.js — Comparador técnico de equipamiento de audio (2 a 4 productos)
import { create } from "zustand"

const MAX_COMPARE = 4

export const useCompareStore = create((set, get) => ({
  items: [],     // lista de objetos producto { id, name, slug, price, prices, images, ... }
  isOpen: false,

  toggleItem: (product) => {
    if (!product?.id) return { added: false, limitReached: false }
    const { items } = get()
    const exists = items.some(p => p.id === product.id)
    if (exists) {
      set({ items: items.filter(p => p.id !== product.id) })
      return { added: false, limitReached: false }
    }
    if (items.length >= MAX_COMPARE) {
      return { added: false, limitReached: true }
    }
    set({ items: [...items, product] })
    return { added: true, limitReached: false }
  },

  removeItem: (productId) => {
    set({ items: get().items.filter(p => p.id !== productId) })
  },

  clear: () => set({ items: [], isOpen: false }),

  openModal: () => set({ isOpen: true }),
  closeModal: () => set({ isOpen: false }),
}))
