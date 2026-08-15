// store/cartStore.js

import { create } from "zustand"
import { persist } from "zustand/middleware"

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      // ── Loyalty ─────────────────────────────────────────
      pointsToRedeem: 0,   // puntos que el usuario decidió canjear en el checkout
      setPointsToRedeem: (n) => set({ pointsToRedeem: Math.max(0, Number(n) || 0) }),

      addItem: (product, quantity = 1) => {
        const { items } = get()
        const existing = items.find(i => i.product?.id === product.id)
        const cap = product.product_type && product.product_type !== "stock" ? 99 : (product.stock || 99)
        if (existing) {
          set({
            items: items.map(i =>
              i.product?.id === product.id
                ? { ...i, quantity: Math.min(i.quantity + quantity, cap) }
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

      clearCart: () => set({ items: [], pointsToRedeem: 0 }),

      // ── Getters seguros ────────────────────────────────
      getTotal: () => {
        return get().items.reduce((acc, i) => {
          const price = Number(i.product?.price) || 0
          const qty   = Number(i.quantity) || 0
          return acc + price * qty
        }, 0)
      },

      // Total en una moneda específica (CLP/USD/ARS), usando el objeto
      // `prices` que cada producto trae del backend. Si un producto no
      // tiene ese precio, cae al CLP crudo (no deber­ía pasar en prod).
      getTotalIn: (currency = "CLP") => {
        return get().items.reduce((acc, i) => {
          const p = i.product?.prices
          const price = p && p[currency] != null
            ? Number(p[currency])
            : Number(i.product?.price) || 0
          const qty = Number(i.quantity) || 0
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