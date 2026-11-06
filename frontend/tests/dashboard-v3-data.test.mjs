import test from "node:test"
import assert from "node:assert/strict"
import {
  asRows, finiteNumber, count, formatMoney, adminRecentOrders, adminFulfillment,
  adminCategoryMix, adminSalesSeries, monthlyShare, loyaltyHistory, firstOrderItem,
} from "../src/pages/dashboard/dashboardV3Data.js"

test("no fabrica cifras cuando las API están vacías o en cero", () => {
  assert.deepEqual(adminRecentOrders(null), [])
  assert.deepEqual(adminCategoryMix({}), [])
  assert.deepEqual(loyaltyHistory(null), [])
  assert.equal(monthlyShare({ total: 0, this_month: 0 }), 0)
  assert.equal(count(0), 0)
  assert.equal(finiteNumber(null), null)
  assert.equal(formatMoney(null), "—")
  assert.equal(firstOrderItem({ items: [] }), "Compra LevelPro Audio")
})

test("lee órdenes reales y mantiene ceros y estados", () => {
  assert.deepEqual(adminRecentOrders({
    recent_orders: [{ id: "abc123", email: "user@example.test", status: "pending", total: 0, created: "2026-11-06" }],
  }), [{
    id: "abc123", shortId: "ABC123", clientName: "user", status: "pending", total: 0,
    currency: "CLP", created: "2026-11-06",
  }])
  assert.equal(adminRecentOrders({ actions: { pending_orders: [{ id: "p1", total: 0 }] } })[0].status, "pending")
})

test("despachos y mix de categorías solo dependen de las API", () => {
  assert.equal(adminFulfillment({}, 10), null)
  assert.deepEqual(adminFulfillment({
    orders_by_status: [{ status: "shipped", count: 2 }, { status: "completed", count: 1 }, { status: "pending", count: 7 }],
  }, 10), { managed: 3, total: 10, percentage: 30 })
  const categories = adminCategoryMix({
    revenue_by_category: [{ category: "Monitores", total: 30 }, { category: "Micrófonos", total: 70 }],
  })
  assert.equal(Math.round(categories[0].percentage), 30)
  assert.equal(Math.round(categories[1].percentage), 70)
})

test("las series varían según 7 días, 30 días y 1 año", () => {
  const dashboard = { sales_chart: [
    { date: "2026-10-10", total: 10 }, { date: "2026-11-04", total: 20 },
  ] }
  const analytics = { sales_by_month: [{ month: "Nov 2026", total: 20 }] }
  const now = new Date("2026-11-06T12:00:00")
  assert.equal(adminSalesSeries(dashboard, analytics, "7D", now).length, 1)
  assert.equal(adminSalesSeries(dashboard, analytics, "30D", now).length, 2)
  assert.deepEqual(adminSalesSeries(dashboard, analytics, "1A", now), [{ label: "Nov 2026", total: 20 }])
})

test("respeta puntos y movimientos reales, incluso cero", () => {
  const items = loyaltyHistory({ transactions: [{ tipo: "earn", descripcion: "Compra", puntos: 0, fecha: "06/11/2026" }] })
  assert.equal(items[0].points, 0)
  assert.deepEqual(asRows({ results: [{ id: 1 }] }), [{ id: 1 }])
})
