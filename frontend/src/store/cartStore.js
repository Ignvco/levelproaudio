// store/cartStore.js

import { create } from "zustand"
import { persist } from "zustand/middleware"

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, quantity = 1) => {
        const { items } = get()
        const existing = items.find(i => i.product?.id === product.id)
        if (existing) {
          set({
            items: items.map(i =>
              i.product?.id === product.id
                ? { ...i, quantity: Math.min(i.quantity + quantity, product.stock || 99) }
                : i
            )
          })
        } else {
          set({ items: [...items, { product, quantity }] })
        }
      },

      updateQuantity: (productId, quantity) => {
        if (quantity < 1) return
        set({
          items: get().items.map(i =>
            i.product?.id === productId ? { ...i, quantity } : i
          )
        })
      },

      removeItem: (productId) => {
        set({ items: get().items.filter(i => i.product?.id !== productId) })
      },

      clearCart: () => set({ items: [] }),

      // ── Getters seguros ────────────────────────────────
      getTotal: () => {
        return get().items.reduce((acc, i) => {
          const price = Number(i.product?.price) || 0
          const qty   = Number(i.quantity) || 0
          return acc + price * qty
        }, 0)
      },

      getCount: () => {
        return get().items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0)
      },
    }),
    { name: "levelproaudio-cart" }
  )
)