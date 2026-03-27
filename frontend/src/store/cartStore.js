// store/cartStore.js

import { create } from "zustand"
import { persist } from "zustand/middleware"

export const useCartStore = create(
  persist(
    (set, get) => ({

      items: [],

      // ── Agregar producto ─────────────────────────────────
      addItem: (product, quantity = 1) => {
        const { items } = get()
        const existing = items.find(i => i.product.id === product.id)

        if (existing) {
          set({
            items: items.map(i =>
              i.product.id === product.id
                ? { ...i, quantity: Math.min(i.quantity + quantity, product.stock) }
                : i
            )
          })
        } else {
          set({ items: [...items, { product, quantity }] })
        }
      },

      // ── Actualizar cantidad ──────────────────────────────
      updateQuantity: (productId, quantity) => {
        if (quantity < 1) return
        set({
          items: get().items.map(i =>
            i.product.id === productId ? { ...i, quantity } : i
          )
        })
      },

      // ── Eliminar producto ────────────────────────────────
      removeItem: (productId) => {
        set({ items: get().items.filter(i => i.product.id !== productId) })
      },

      // ── Vaciar carrito ───────────────────────────────────
      clearCart: () => set({ items: [] }),

    }),
    {
      name: "levelproaudio-cart",
    }
  )
)

// ── Selectores computados — úsalos con useCartStore(cartTotal) ──
export const cartTotal = (state) =>
  state.items.reduce(
    (acc, i) => acc + Number(i.product.price) * i.quantity,
    0
  )

export const cartItemsCount = (state) =>
  state.items.reduce((acc, i) => acc + i.quantity, 0)