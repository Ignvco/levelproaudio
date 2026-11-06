// Currency-aware display for original order and settlement amounts.
// Never add dissimilar currencies or guess conversion rates.
export const ACCOUNTING_CURRENCIES = ["CLP", "USD", "ARS"]

export function formatCurrency(value, currency = "CLP") {
  if (value === null || value === undefined || value === "") return "—"
  const n = Number(value)
  if (!Number.isFinite(n) || !ACCOUNTING_CURRENCIES.includes(currency)) return "—"
  return new Intl.NumberFormat("es-CL", {
    style: "currency", currency,
    minimumFractionDigits: currency === "CLP" ? 0 : 2,
    maximumFractionDigits: currency === "CLP" ? 0 : 2,
  }).format(n)
}

export function formatOrderAmount(item) {
  if (!ACCOUNTING_CURRENCIES.includes(item?.currency)) return "—"
  return formatCurrency(item.total, item.currency)
}

export function formatGatewayAmount(payment) {
  if (!ACCOUNTING_CURRENCIES.includes(payment?.currency)) return "—"
  return formatCurrency(payment.amount, payment.currency)
}

export function validMoney(value) {
  const n = Number(value)
  return value != null && value !== "" && Number.isFinite(n) ? n : null
}
