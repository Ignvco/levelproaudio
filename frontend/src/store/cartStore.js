// store/cartStore.js

import { create } from "zustand"
import { persist } from "zustand/middleware"

const sameCartLine = (item, productId, variantId = null) =>
  item.product?.id === productId && (item.variant?.id || null) === (variantId || null)

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      // ── Loyalty ─────────────────────────────────────────
      pointsToRedeem: 0,   // puntos que el usuario decidió canjear en el checkout
      setPointsToRedeem: (n) => set({ pointsToRedeem: Math.max(0, Number(n) || 0) }),

      addItem: (product, quantity = 1, variant = null) => {
        const { items } = get()
        const variantId = variant?.id || null
        const existing = items.find(i => sameCartLine(i, product.id, variantId))
        const stockSource = variant ? variant.stock : product.stock
        const cap = product.product_type && product.product_type !== "stock" ? 99 : (stockSource || 99)
        if (existing) {
          set({
            items: items.map(i =>
              sameCartLine(i, product.id, variantId)
                ? { ...i, variant: variant || i.variant, quantity: Math.min(i.quantity + quantity, cap) }
                : i
            )
          })
        } else {
          set({ items: [...items, { product, variant: variant || null, quantity }] })
        }
      },

      updateQuantity: (productId, quantity, variantId = null) => {
        if (quantity < 1) return
        set({
          items: get().items.map(i =>
            sameCartLine(i, productId, variantId) ? { ...i, quantity } : i
          )
        })
      },

      removeItem: (productId, variantId = null) => {
        set({ items: get().items.filter(i => !sameCartLine(i, productId, variantId)) })
      },

      clearCart: () => set({ items: [], pointsToRedeem: 0 }),

      // ── Getters seguros ────────────────────────────────
      getTotal: () => {
        return get().items.reduce((acc, i) => {
          const price = Number(i.variant?.price ?? i.product?.price) || 0
          const qty   = Number(i.quantity) || 0
          return acc + price * qty
        }, 0)
      },

      // Total en una moneda específica (CLP/USD/ARS), usando el objeto
      // `prices` que cada variante o producto trae del backend.
      getTotalIn: (currency = "CLP") => {
        return get().items.reduce((acc, i) => {
          const source = i.variant || i.product
          const p = source?.prices
          const price = p && p[currency] != null
            ? Number(p[currency])
            : Number(source?.price ?? i.product?.price) || 0
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
