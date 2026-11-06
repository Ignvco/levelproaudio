// View-only adapters for inventory endpoints (V3.2 API contract).
// Do not replace missing values with zero: missing is not a verified zero.
export const asInventoryRows = (value) =>
  Array.isArray(value) ? value : Array.isArray(value?.results) ? value.results : []

const numeric = value => {
  if (value == null || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function normalizeInventoryRotation(data) {
  return asInventoryRows(data).map(row => ({
    id: row.product_id ?? row.id ?? null,
    name: row.name || "Producto sin nombre",
    units: numeric(row.unidades_vendidas ?? row.units_sold),
    stock: numeric(row.stock_actual ?? row.stock),
    revenue: numeric(row.ingresos ?? row.total_revenue),
    currency: ["CLP", "USD", "ARS"].includes(row.currency) ? row.currency : null,
    sku: row.sku || null,
  }))
}

export function inventoryPreview(data) {
  const products = asInventoryRows(data)
  const count = numeric(data?.count)
  const incomplete = Boolean(data?.next) || (count != null && count > products.length)
  return { products, count, incomplete }
}

export function groupInventoryPreview(products) {
  const groups = new Map()
  for (const p of products) {
    const name = p.category?.name || "Sin categoría"
    if (!groups.has(name)) groups.set(name, {
      name, products: 0, totalStock: 0, knownCost: 0, saleValue: 0,
      missingCostCount: 0, missingPriceCount: 0,
    })
    const g = groups.get(name)
    const stock = numeric(p.stock) ?? 0
    const cost = numeric(p.cost_price)
    const price = numeric(p.price)
    g.products++
    g.totalStock += stock
    if (stock > 0) {
      if (cost === null) g.missingCostCount++
      else g.knownCost += stock * cost
      if (price === null) g.missingPriceCount++
      else g.saleValue += stock * price
    }
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "es"))
}
