import test, { before, after } from "node:test"
import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { chromium } from "playwright"
import { createServer, preview } from "vite"
import react from "@vitejs/plugin-react"

// Starts a local frontend unless an existing local URL is supplied.
// All API requests are intercepted with synthetic data.
let baseURL = process.env.PAYMENT_TEST_URL || "http://127.0.0.1:3000"
assert.ok(["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname), "Run only against a local frontend")
const id = "12345678-1234-1234-1234-123456789abc"
const otherId = "12345678-1234-1234-1234-123456789abd"
const markerKey = "levelproaudio-checkout-return"
const cart = { items: [{ product: { id: "p1", name: "Test product", price: 50000, stock: 5 }, quantity: 1 }], pointsToRedeem: 0 }
const sample = status => ({
  id, status, email: "buyer@example.test", currency: "CLP", total: "50000",
  created_at: "2026-10-01T12:00:00Z", payments: [],
  items: [{ product_name: "Test product", price: "50000", subtotal: "50000", quantity: 1 }],
})
let browser
let testServer
before(async () => {
  if (!process.env.PAYMENT_TEST_URL) {
    if (process.env.PAYMENT_TEST_MODE === "preview") {
      testServer = await preview({ configFile: false, preview: { host: "127.0.0.1", port: 0 } })
    } else {
      testServer = await createServer({ configFile: false, plugins: [react()], server: { host: "127.0.0.1", port: 0, hmr: false } })
      await testServer.listen()
    }
    baseURL = `http://127.0.0.1:${testServer.httpServer.address().port}`
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PAYMENT_TEST_CHROMIUM ? { executablePath: process.env.PAYMENT_TEST_CHROMIUM } : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  })
})
after(async () => {
  await browser?.close()
  if (testServer?.close) await testServer.close()
  else if (testServer) await new Promise(resolve => testServer.httpServer.close(resolve))
})

async function openTransfer(t, options = {}) {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } })
  t.after(() => context.close())
  await context.addInitScript(() => {
    sessionStorage.setItem("levelproaudio-auth", JSON.stringify({ state: {
      isAuthenticated: true, user: { id: "buyer-1", email: "buyer@example.test", is_staff: false },
    }, version: 0 }))
  })
  let current = options.data || { state: "ready", amount: "49.99", currency: "USD", reference: "LEVELPRO-12345678", provider: "payoneer", bank_accounts: [{ id: "test", label: "Payoneer USD", bank_name: "Test bank", account_number: "TEST-USD-123", holder_name: "Test holder", currency: "USD" }] }
  let status = options.status || 200
  let reads = 0
  const writes = [], errors = []
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== baseURL) return route.abort()
    if (!url.pathname.startsWith("/api/")) return route.continue()
    if (request.method() !== "GET") writes.push(url.pathname)
    const send = (data, code = 200) => route.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(data) })
    if (url.pathname.includes("/payments/transfer/")) { reads++; return send(current, status) }
    if (url.pathname === "/api/v1/auth/profile/") return send({ id: "buyer-1", email: "buyer@example.test", is_staff: false })
    return send({})
  })
  const page = await context.newPage()
  page.on("pageerror", e => errors.push(e.message))
  t.after(() => { assert.deepEqual(errors, []); assert.deepEqual(writes, []) })
  await page.goto(`${baseURL}/payment/transfer/${options.id || id}`)
  const state = name => page.locator(`[data-transfer-state="${name}"]`).waitFor()
  return { page, state, reads: () => reads, setResponse: (data, code = 200) => { current = data; status = code } }
}

test("direct visit and reload recover exact USD instructions without router state or writes", async t => {
  const app = await openTransfer(t)
  await app.state("ready")
  assert.match(await app.page.getByTestId("transfer-account").innerText(), /49[.,]99/)
  assert.match(await app.page.getByTestId("transfer-account").innerText(), /TEST-USD-123/)
  await app.page.reload()
  await app.state("ready")
  assert.ok(app.reads() >= 2)
  assert.equal(await app.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
})
for (const state of ["confirmed", "cancelled", "refunded", "review", "unavailable"]) {
  test(`${state} does not offer a transfer or invent bank details`, async t => {
    const app = await openTransfer(t, { data: { state, bank_accounts: [] } })
    await app.state(state)
    assert.equal(await app.page.getByTestId("transfer-account").count(), 0)
    assert.ok(!(await app.page.locator("body").innerText()).includes("Alias / Cuenta"))
  })
}
for (const status of [403, 404, 500]) {
  test(`lookup ${status} hides details and allows read-only refresh`, async t => {
    const app = await openTransfer(t, { status })
    await app.state("error")
    assert.equal(await app.page.getByTestId("transfer-account").count(), 0)
    app.setResponse({ state: "confirmed", bank_accounts: [] })
    await app.page.getByRole("button", { name: "Actualizar estado" }).click()
    await app.state("confirmed")
  })
}
test("invalid order never queries transfer instructions", async t => {
  const app = await openTransfer(t, { id: "invalid" })
  await app.state("invalid")
  assert.equal(app.reads(), 0)
})
test("refresh replaces shown instructions when payment is confirmed", async t => {
  const app = await openTransfer(t)
  await app.state("ready")
  app.setResponse({ state: "confirmed", bank_accounts: [] })
  await app.page.getByRole("button", { name: "Actualizar estado" }).click()
  await app.state("confirmed")
  assert.equal(await app.page.getByTestId("transfer-account").count(), 0)
})
