// store/cartStore.js
// Estado global del carrito con persistencia en localStorage
// Maneja items, cantidades, totales y operaciones CRUD

import { create } from "zustand"
import { persist } from "zustand/middleware"

export const useCartStore = create(
  persist(
    (set, get) => ({

      // Estado — array de { product, quantity }
      items: [],

      // ── Agregar producto ─────────────────────────────────
      // Si ya existe, incrementa la cantidad
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

      // ── Computed values ──────────────────────────────────
      // Total de productos (suma de cantidades)
      get itemsCount() {
        return get().items.reduce((acc, i) => acc + i.quantity, 0)
      },

      // Total en pesos
      get total() {
        return get().items.reduce(
          (acc, i) => acc + Number(i.product.price) * i.quantity,
          0
        )
      },

    }),
    {
      name: "levelproaudio-cart",
    }
  )
)