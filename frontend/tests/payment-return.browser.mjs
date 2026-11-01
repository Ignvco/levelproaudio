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

async function openReturn(t, options = {}) {
  const context = await browser.newContext({ viewport: options.viewport || { width: 390, height: 844 } })
  t.after(() => context.close())
  await context.addInitScript(({ cart, markerKey, id, marked, changed }) => {
    if (sessionStorage.getItem("payment-test-initialized")) return
    sessionStorage.setItem("payment-test-initialized", "1")
    sessionStorage.setItem("levelproaudio-auth", JSON.stringify({ state: {
      isAuthenticated: true, user: { id: "buyer-1", email: "buyer@example.test", is_staff: false },
    }, version: 0 }))
    const current = structuredClone(cart)
    if (changed) current.items[0].quantity = 2
    localStorage.setItem("levelproaudio-cart", JSON.stringify({ state: current, version: 0 }))
    if (marked) sessionStorage.setItem(markerKey, JSON.stringify({
      orderId: id,
      signature: JSON.stringify({ items: cart.items.map(item => [item.product.id, item.quantity]), points: 0 }),
    }))
  }, { cart, markerKey, id, marked: options.marked, changed: options.changed })
  const counts = { reads: 0, captures: 0, unexpected: [] }
  let currentOrder = options.order || sample("pending")
  await context.route("**/*", async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin !== new URL(baseURL).origin) return route.abort()
    if (!url.pathname.startsWith("/api/")) return route.continue()
    const send = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) })
    if (/\/orders\/[^/]+\/$/.test(url.pathname)) {
      counts.reads++
      if (options.lookup) return options.lookup({ send, counts, url, currentOrder })
      return send(currentOrder, options.lookupStatus || 200)
    }
    if (url.pathname === "/api/v1/payments/paypal/capture/") {
      counts.captures++
      assert.equal(request.method(), "POST")
      if (options.capture) return options.capture({ send, counts, setOrder: order => { currentOrder = order } })
      counts.unexpected.push("unexpected capture")
      return send({ error: "Unexpected capture" }, 500)
    }
    if (url.pathname === "/api/v1/auth/profile/") return send({ id: "buyer-1", email: "buyer@example.test", is_staff: false })
    if (url.pathname === "/api/v1/auth/csrf/") {
      return route.fulfill({ contentType: "application/json", body: "{}", headers: { "set-cookie": `csrftoken=${"x".repeat(32)}; Path=/` } })
    }
    if (url.pathname === "/api/v1/auth/token/refresh/") return send({ detail: "expired" }, 401)
    if (request.method() !== "GET") counts.unexpected.push(`${request.method()} ${url.pathname}`)
    return send({})
  })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", error => errors.push(error.message))
  t.after(() => {
    assert.deepEqual(errors, [], "No uncaught UI exceptions")
    assert.deepEqual(counts.unexpected, [], "No unexpected writes")
  })
  await page.goto(`${baseURL}${options.path || `/payment/success?order=${id}`}`)
  const state = async expected => {
    await page.locator(`[data-payment-state="${expected}"]`).waitFor({ timeout: 10000 })
  }
  const savedCart = () => page.evaluate(() => JSON.parse(localStorage.getItem("levelproaudio-cart")).state)
  const notConfirmed = async () => {
    assert.equal(await page.getByTestId("payment-confetti").count(), 0)
    assert.equal(await page.getByTestId("payment-next-steps").count(), 0)
    assert.ok(!(await page.locator("body").innerText()).includes("¡Compra confirmada!"))
    assert.equal((await savedCart()).items.length, 1)
  }
  return { page, state, counts, savedCart, notConfirmed, setOrder: order => { currentOrder = order } }
}

test("initial loading does not celebrate or clear the cart", async t => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const app = await openReturn(t, { marked: true, lookup: async ({ send }) => { await gate; return send(sample("pending")) } })
  await app.state("loading")
  await app.notConfirmed()
  release()
  await app.state("pending")
  await app.notConfirmed()
})

test("pending polls to paid, clears only its checkout, and stops polling", async t => {
  const app = await openReturn(t, { marked: true, lookup: ({ send, counts }) => send(sample(counts.reads < 2 ? "pending" : "paid")) })
  await app.state("pending")
  await app.notConfirmed()
  await app.state("confirmed")
  assert.equal((await app.savedCart()).items.length, 0)
  const reads = app.counts.reads
  await new Promise(resolve => setTimeout(resolve, 3300))
  assert.equal(app.counts.reads, reads)
})

for (const [order, expected] of [
  [sample("cancelled"), "cancelled"],
  [{ ...sample("pending"), payments: [{ status: "rejected" }] }, "rejected"],
  [{ ...sample("pending"), payments: [{ status: "in_review" }] }, "review"],
  [{ ...sample("paid"), payments: [{ status: "refunded" }] }, "refunded"],
  [sample("unexpected"), "unknown"],
]) {
  test(`${expected} never celebrates or clears the cart`, async t => {
    const app = await openReturn(t, { order, marked: true })
    await app.state(expected)
    await app.notConfirmed()
  })
}

for (const status of ["paid", "shipped", "completed"]) {
  test(`${status} confirms without clearing an unrelated cart`, async t => {
    const app = await openReturn(t, { order: sample(status) })
    await app.state("confirmed")
    assert.equal((await app.savedCart()).items.length, 1)
    assert.equal(await app.page.getByTestId("payment-next-steps").count(), 1)
  })
}

test("a changed cart is kept after a successful purchase", async t => {
  const app = await openReturn(t, { order: sample("paid"), marked: true, changed: true })
  await app.state("confirmed")
  assert.equal((await app.savedCart()).items[0].quantity, 2)
})

for (const status of [403, 404, 500]) {
  test(`order lookup ${status} is safe and does not call PayPal`, async t => {
    const app = await openReturn(t, { lookupStatus: status, path: `/payment/success?order=${id}&paymentId=PAY-test&PayerID=PAYER123`, marked: true })
    await app.state("error")
    await app.notConfirmed()
    assert.equal(app.counts.captures, 0)
  })
}

test("status refresh recovers from a query error using GET", async t => {
  const app = await openReturn(t, { lookup: ({ send, counts }) => counts.reads === 1 ? send({}, 500) : send(sample("paid")) })
  await app.state("error")
  await app.page.getByTestId("payment-refresh").click()
  await app.state("confirmed")
  assert.equal(app.counts.captures, 0)
})

test("PayPal captures once under StrictMode and confirms only after reading the order", async t => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const app = await openReturn(t, {
    marked: true, path: `/payment/success?order=${id}&paymentId=PAY-test&PayerID=PAYER123&token=test-token`,
    capture: async ({ send, setOrder }) => { await gate; setOrder(sample("paid")); return send({ status: "approved" }) },
  })
  await app.state("capturing")
  await app.notConfirmed()
  assert.equal(app.counts.captures, 1)
  release()
  await app.state("confirmed")
  assert.equal(app.counts.captures, 1)
  assert.ok(!app.page.url().includes("paymentId="))
  assert.ok(!app.page.url().includes("token="))
  assert.equal((await app.savedCart()).items.length, 0)
})

test("an approved capture with a pending order still waits for the backend", async t => {
  const app = await openReturn(t, {
    path: `/payment/success?order=${id}&paymentId=PAY-test&PayerID=PAYER123`,
    capture: ({ send }) => send({ status: "approved" }),
  })
  await app.state("pending")
  await app.notConfirmed()
  assert.equal(app.counts.captures, 1)
})

test("uncertain capture shows a safe reference and GET refresh/reload never recaptures", async t => {
  const reference = "a".repeat(32)
  const app = await openReturn(t, {
    marked: true, path: `/payment/success?order=${id}&paymentId=PAY-test&PayerID=PAYER123`,
    capture: ({ send }) => send({ error: "private-exception-test", detail: "private-exception-test", error_id: reference }, 500),
  })
  await app.state("capture_error")
  await app.notConfirmed()
  assert.ok((await app.page.getByTestId("payment-error-reference").innerText()).includes(reference))
  assert.ok(!(await app.page.locator("body").innerText()).includes("private-exception-test"))
  await app.page.getByTestId("payment-refresh").click()
  await app.page.waitForFunction(() => !document.querySelector('[data-testid="payment-refresh"]').disabled)
  assert.equal(app.counts.captures, 1)
  await app.page.reload()
  await app.state("pending")
  await app.notConfirmed()
  assert.equal(app.counts.captures, 1)
})

test("an error after a successful charge is resolved by the paid order", async t => {
  const app = await openReturn(t, {
    path: `/payment/success?order=${id}&paymentId=PAY-test&PayerID=PAYER123`,
    capture: ({ send, setOrder }) => { setOrder(sample("paid")); return send({ error_id: "b".repeat(32) }, 500) },
  })
  await app.state("confirmed")
  assert.equal(app.counts.captures, 1)
})

test("incomplete PayPal parameters do not start a capture", async t => {
  const app = await openReturn(t, { path: `/payment/success?order=${id}&paymentId=PAY-test` })
  await app.state("capture_error")
  await app.notConfirmed()
  assert.equal(app.counts.captures, 0)
})

for (const path of ["/payment/success", "/payment/success?order=not-a-uuid", "/payment/failure"]) {
  test(`${path} makes no order or capture request`, async t => {
    const app = await openReturn(t, { path })
    await app.state("missing")
    await app.notConfirmed()
    assert.equal(app.counts.reads, 0)
    assert.equal(app.counts.captures, 0)
  })
}

test("failure return checks the order and cannot capture even with PayPal parameters", async t => {
  const app = await openReturn(t, { path: `/payment/failure?order=${id}&paymentId=PAY-test&PayerID=PAYER123` })
  await app.state("pending")
  await app.notConfirmed()
  assert.equal(app.counts.captures, 0)
  assert.ok(!(await app.page.locator("body").innerText()).includes("No se realizó ningún cobro"))
})

test("an already paid failure-return order still shows the server confirmation", async t => {
  const app = await openReturn(t, { path: `/payment/failure?order=${id}`, order: sample("paid") })
  await app.state("confirmed")
})

test("changing the URL to another order never reuses the previous confirmation", async t => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const app = await openReturn(t, { lookup: async ({ send, url }) => {
    if (url.pathname.includes(otherId)) { await gate; return send({ ...sample("cancelled"), id: otherId }) }
    return send(sample("paid"))
  } })
  await app.state("confirmed")
  await app.page.evaluate(otherId => {
    history.pushState(null, "", `/payment/success?order=${otherId}`)
    dispatchEvent(new PopStateEvent("popstate"))
  }, otherId)
  await app.state("loading")
  await app.notConfirmed()
  release()
  await app.state("cancelled")
})

for (const [width, status] of [[360, "pending"], [390, "paid"], [1280, "paid"]]) {
  test(`${status} layout and USD amounts at ${width}px`, async t => {
    const order = { ...sample(status), currency: "USD", total: "49.99", items: [] }
    const app = await openReturn(t, { order, viewport: { width, height: 900 } })
    await app.state(status === "paid" ? "confirmed" : "pending")
    const amount = await app.page.getByTestId("success-total").innerText()
    assert.ok(amount.includes("USD"))
    assert.ok(/49[,.]99/.test(amount))
    assert.equal(await app.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
    if (process.env.PAYMENT_TEST_SCREENSHOTS) {
      await mkdir(process.env.PAYMENT_TEST_SCREENSHOTS, { recursive: true })
      await app.page.screenshot({ path: join(process.env.PAYMENT_TEST_SCREENSHOTS, `${status}-${width}.png`), fullPage: true })
    }
  })
}
