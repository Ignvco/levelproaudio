import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  ACCOUNTING_CURRENCIES, formatCurrency, formatOrderAmount,
  formatGatewayAmount, validMoney,
} from "../src/utils/accountingCurrency.js"

test("formatos CLP USD ARS explícitos y cero legítimo", () => {
  assert.deepEqual(ACCOUNTING_CURRENCIES, ["CLP", "USD", "ARS"])
  assert.match(formatCurrency(0, "CLP"), /0/)
  assert.match(formatCurrency(100, "USD"), /100/)
  assert.match(formatCurrency(200, "ARS"), /200/)
  assert.notEqual(formatCurrency(1000, "USD"), formatCurrency(1000, "CLP"))
  assert.equal(formatCurrency(null, "CLP"), "—")
  assert.equal(formatCurrency("abc", "USD"), "—")
  assert.equal(formatCurrency(10, "EUR"), "—")
  assert.equal(validMoney(null), null)
  assert.equal(validMoney("0"), 0)
})

test("no confundir moneda de pedido con divisa del cobro PayPal", () => {
  const order = { total: "90000", currency: "CLP" }
  const settlement = { amount: "95.00", currency: "USD" }
  assert.equal(formatOrderAmount(order), formatCurrency(90000, "CLP"))
  assert.equal(formatGatewayAmount(settlement), formatCurrency(95, "USD"))
  assert.notEqual(formatOrderAmount(order), formatGatewayAmount(settlement))
})

test("formatos de moneda ausente nunca inventan CLP para una orden", () => {
  assert.equal(formatOrderAmount({ total: 10 }), "—")
  assert.equal(formatGatewayAmount({ amount: 10 }), "—")
})

test("dashboards financieros y pagos consultan la divisa seleccionada", () => {
  const root = new URL("../src/", import.meta.url)
  const read = name => readFileSync(new URL(name, root), "utf8")
  assert.match(read("pages/admin/AdminDashboard.jsx"), /getAdminDashboard\(currency\)/)
  assert.match(read("pages/admin/AdminPayments.jsx"), /formatGatewayAmount\(p\)/)
  assert.match(read("pages/admin/AdminFinance.jsx"), /getFinanceSummary\(currency\)/)
  assert.doesNotMatch(read("pages/dashboard/Orders.jsx"), /reduce\(\(acc, o\) => acc \+ \(Number\(o\.total\)/)
})


test("Rewards consulta y formatea importes en la moneda seleccionada sin suma FX", () => {
  const root = new URL("../src/", import.meta.url)
  const read = name => readFileSync(new URL(name, root), "utf8")
  assert.match(read("api/rewards.api.js"), /params: \{ currency \}/)
  const rewards = read("pages/admin/AdminRewards.jsx")
  assert.match(rewards, /adminGetRewardsDashboard\(currency\)/)
  assert.match(rewards, /formatCurrency\(data\.totals\.related_revenue, currency\)/)
  assert.match(rewards, /data\?\.currency === currency/)
  const entries = read("pages/admin/AdminRewardsEntries.jsx")
  assert.match(entries, /adminExportEntriesCsvUrl\(filters\)/)
})
