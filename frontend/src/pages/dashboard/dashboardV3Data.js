// Pure selectors for V3. Do not replace missing business records with demo data.
export const asRows = value => Array.isArray(value) ? value
  : Array.isArray(value?.results) ? value.results : []

export function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export const count = value => finiteNumber(value) ?? 0

export function formatMoney(value, currency = "CLP") {
  const number = finiteNumber(value)
  if (number === null) return "—"
  const code = ["CLP", "USD", "ARS"].includes(currency) ? currency : "CLP"
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: code, maximumFractionDigits: code === "CLP" ? 0 : 2 }).format(number)
}

export function adminRecentOrders(data) {
  const recent = asRows(data?.recent_orders)
  const pending = asRows(data?.actions?.pending_orders)
  return (recent.length ? recent : pending).slice(0, 5).filter(o => o?.id).map(o => ({
    id: o.id,
    shortId: o.short_id || String(o.id).slice(0, 8).toUpperCase(),
    clientName: o.user_name || o.email?.split("@")[0] || "Cliente LevelPro",
    status: o.status || (recent.length ? "unknown" : "pending"),
    total: finiteNumber(o.total),
    currency: o.currency || "CLP",
    created: o.created_at || o.created || null,
  }))
}

export function adminFulfillment(analytics, totalOrders) {
  if (!Array.isArray(analytics?.orders_by_status)) return null
  const managed = analytics.orders_by_status.filter(
    r => ["shipped", "completed"].includes(r.status)
  ).reduce((sum, r) => sum + count(r.count), 0)
  const total = count(totalOrders)
  return { managed, total, percentage: total > 0 ? Math.round(managed * 100 / total) : 0 }
}

export function adminCategoryMix(analytics) {
  const categories = asRows(analytics?.revenue_by_category)
    .map(r => ({ name: r.category || "Sin categoría", units: count(r.count) }))
    .filter(r => r.units > 0)
  const total = categories.reduce((sum, c) => sum + c.units, 0)
  return total > 0 ? categories.slice(0, 3).map(c => ({
    ...c, percentage: c.units / total * 100,
  })) : []
}

export function adminSalesSeries(dashboard, analytics, period, now = new Date()) {
  if (period === "1A") {
    return asRows(analytics?.sales_by_month).map(row => ({
      label: String(row.month || "—"), total: count(row.total),
    }))
  }
  const days = period === "7D" ? 7 : 30
  const threshold = new Date(now)
  threshold.setHours(0, 0, 0, 0)
  threshold.setDate(threshold.getDate() - (days - 1))
  return asRows(dashboard?.sales_chart)
    .filter(row => row.date && new Date(`${row.date}T00:00:00`) >= threshold)
    .map(row => ({
      label: String(row.date).slice(5), total: count(row.total),
    }))
}

export function monthlyShare(revenue) {
  const all = count(revenue?.total), month = count(revenue?.this_month)
  return all > 0 ? Math.max(0, Math.min(100, Math.round(100 * month / all))) : 0
}

export function loyaltyHistory(loyalty) {
  return asRows(loyalty?.transactions).slice(0, 4).map((t, i) => ({
    key: `${t.fecha || i}-${i}`,
    label: t.descripcion || (t.tipo === "earn" ? "Puntos acreditados" : "Movimiento de puntos"),
    points: finiteNumber(t.puntos),
    date: t.fecha || "",
    type: t.tipo || "",
  }))
}

export function firstOrderItem(order) {
  const list = asRows(order?.items)
  return list[0]?.product_name || "Compra LevelPro Audio"
}
