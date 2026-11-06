import test from "node:test"
import assert from "node:assert/strict"

import {
  completedOrderTotalsByCurrency, formatMoney, adminRecentOrders,
} from "../src/pages/dashboard/dashboardV3Data.js"

test("separa compras pagadas CLP/USD/ARS y excluye pendientes o cancelados", () => {
  const rows = [
    { id: "a", currency: "CLP", total: "12500", status: "paid" },
    { id: "b", currency: "USD", total: "34.50", status: "shipped" },
    { id: "c", currency: "ARS", total: "8500", status: "completed" },
    { id: "d", currency: "USD", total: "2.50", status: "paid" },
    { id: "e", currency: "USD", total: "500", status: "pending" },
    { id: "f", currency: "ARS", total: "300", status: "cancelled" },
  ]
  const { totals, unknown } = completedOrderTotalsByCurrency(rows)
  assert.deepEqual(totals, { CLP: 12500, USD: 37, ARS: 8500 })
  assert.deepEqual(unknown, [])
})

test("revela monedas ausentes o inválidas, sin atribuir CLP por defecto", () => {
  const { totals, unknown } = completedOrderTotalsByCurrency([
    { id: "a", currency: "", total: 123, status: "paid" },
    { id: "b", currency: "EUR", total: 45, status: "paid" },
    { id: "c", currency: "USD", total: null, status: "shipped" },
  ])
  assert.deepEqual(totals, { CLP: 0, USD: 0, ARS: 0 })
  assert.equal(unknown.length, 3)
})

test("formatea por moneda nativa sin convertir montos", () => {
  assert.match(formatMoney(3000, "CLP"), /3.000/)
  assert.match(formatMoney(19.99, "USD"), /19,99/)
  assert.match(formatMoney(5000, "ARS"), /5.000/)
  assert.equal(formatMoney(null, "CLP"), "—")
  assert.match(formatMoney(50, "EUR"), /EUR/)
  assert.match(formatMoney(50, null), /moneda sin definir/)
})

test("órdenes admin sin moneda no se reportan erróneamente como CLP", () => {
  const rows = adminRecentOrders({ recent_orders: [
    { id: "abc", total: 1250, status: "paid" },
  ] })
  assert.equal(rows[0].currency, null)
})
