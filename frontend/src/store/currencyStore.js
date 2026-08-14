// store/currencyStore.js — moneda que ve el cliente en la tienda.
//
// CLP es el default (mercado principal). La detección por geo-IP setea
// un default inteligente en la primera visita, pero el selector manual
// SIEMPRE manda: si el usuario elige, eso pisa la detección para siempre.

import { create } from "zustand"
import { persist } from "zustand/middleware"

// País → moneda principal. Argentina ve USD (es lo que paga vía Payoneer),
// con ARS referencial. El resto del mundo, CLP por defecto.
const COUNTRY_CURRENCY = {
  AR: "USD",  // Argentina
  CL: "CLP",  // Chile
}

export const CURRENCIES = {
  CLP: { code: "CLP", symbol: "$",   label: "Peso chileno",    flag: "🇨🇱" },
  USD: { code: "USD", symbol: "US$", label: "Dólar",           flag: "🇺🇸" },
  ARS: { code: "ARS", symbol: "$",   label: "Peso argentino",  flag: "🇦🇷" },
}

export const useCurrencyStore = create(
  persist(
    (set, get) => ({
      currency: "CLP",        // moneda activa
      userChose: false,       // ¿el usuario eligió manualmente?
      detected: false,        // ¿ya corrimos la detección?

      // Selector manual — pisa la detección para siempre
      setCurrency: (code) => {
        if (CURRENCIES[code]) set({ currency: code, userChose: true })
      },

      // Detección por geo-IP (solo si el usuario no eligió antes)
      detectCurrency: async () => {
        const { userChose, detected } = get()
        if (userChose || detected) return   // no pisar elección manual
        try {
          const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) })
          const data = await res.json()
          const cur = COUNTRY_CURRENCY[data?.country_code] || "CLP"
          set({ currency: cur, detected: true })
        } catch {
          set({ detected: true })   // si falla, quedamos en CLP (default)
        }
      },
    }),
    { name: "levelpro-currency" }
  )
)
