import test from "node:test"
import assert from "node:assert/strict"
import { normalizeInventoryRotation, inventoryPreview, groupInventoryPreview } from "../src/utils/inventoryViewData.js"

test("inventory rotation reads the real Django keys, not obsolete frontend names", () => {
  const rows = normalizeInventoryRotation([
    { product_id: "p1", name: "Micrófono", unidades_vendidas: 5, stock_actual: 13,
      ingresos: "399.95", currency: "USD" },
    { product_id: "p2", name: "Platillo", unidades_vendidas: 2, stock_actual: 0,
      ingresos: "45000", currency: "CLP" },
  ])
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], {
    id: "p1", name: "Micrófono", units: 5, stock: 13,
    revenue: 399.95, currency: "USD", sku: null,
  })
  assert.equal(rows[1].revenue, 45000)
  assert.equal(rows[1].stock, 0)
})

test("missing rotation metrics are unknown, not verified zeroes", () => {
  const [row] = normalizeInventoryRotation([{ name: "Sin datos", currency: "EUR" }])
  assert.equal(row.revenue, null)
  assert.equal(row.units, null)
  assert.equal(row.stock, null)
  assert.equal(row.currency, null)
})

test("a paginated inventory preview is not a total inventory valuation", () => {
  const data = { count: 253, next: "/api/admin/products/?page=2", results: [{ id: 1 }, { id: 2 }] }
  const result = inventoryPreview(data)
  assert.equal(result.count, 253)
  assert.equal(result.products.length, 2)
  assert.equal(result.incomplete, true)
  assert.equal(inventoryPreview([{ id: "x" }]).incomplete, false)
})

test("category preview tracks unidentified costs separately from known cost", () => {
  const groups = groupInventoryPreview([
    { category: { name: "Micrófonos" }, stock: 2, cost_price: "10000", price: "25000" },
    { category: { name: "Micrófonos" }, stock: 1, cost_price: null, price: "15000" },
    { category: { name: "Cables" }, stock: 4, cost_price: "0", price: "900" },
  ])
  const mics = groups.find(g => g.name === "Micrófonos")
  assert.equal(mics.products, 2)
  assert.equal(mics.totalStock, 3)
  assert.equal(mics.knownCost, 20000)
  assert.equal(mics.missingCostCount, 1)
  assert.equal(mics.saleValue, 65000)
  assert.equal(groups.find(g => g.name === "Cables").missingCostCount, 0)
})
