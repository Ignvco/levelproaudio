// hooks/usePrice.js — formatea precios de producto en la moneda activa.
//
// Los productos traen un objeto `prices` {CLP, USD, ARS} del backend.
// Este hook devuelve helpers para mostrar el precio correcto según la
// moneda elegida por el cliente, y — para Argentina — el precio ARS
// secundario (referencial, en chico).

import { useCurrencyStore, CURRENCIES } from "../store/currencyStore"

function fmt(value, code) {
  const n = Number(value || 0)
  const { symbol } = CURRENCIES[code] || CURRENCIES.CLP
  // USD con 2 decimales; CLP y ARS sin decimales (montos grandes)
  if (code === "USD") {
    return `${symbol}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `${symbol}${Math.round(n).toLocaleString("es-CL")}`
}

export function usePrice() {
  const currency = useCurrencyStore(s => s.currency)

  // Precio principal de un producto en la moneda activa.
  // product.prices = { CLP, USD, ARS } (strings del backend).
  const price = (product) => {
    const prices = product?.prices
    if (!prices) {
      // Fallback: si no vino `prices`, usamos el price crudo como CLP
      return fmt(product?.price, "CLP")
    }
    return fmt(prices[currency] ?? prices.CLP, currency)
  }

  // Precio secundario (solo para USD → mostramos ARS referencial en chico).
  // Devuelve null si no aplica.
  const secondaryPrice = (product) => {
    if (currency !== "USD") return null
    const ars = product?.prices?.ARS
    if (!ars) return null
    return fmt(ars, "ARS")
  }

  // Formatea un monto suelto (ej: total del carrito) en la moneda activa.
  const format = (value, code = currency) => fmt(value, code)

  return { currency, price, secondaryPrice, format }
}
