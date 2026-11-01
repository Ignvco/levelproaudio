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

async function openRoute(t, path) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await context.addInitScript(() => {
    sessionStorage.setItem("levelproaudio-auth", JSON.stringify({ state: { isAuthenticated: true, user: { id: "buyer-1", email: "buyer@example.test" } }, version: 0 }))
    localStorage.setItem("levelproaudio-cart", JSON.stringify({ state: { items: [{ product: { id: "p1", name: "Test", slug: "test", price: 100, prices: { CLP: 100 }, stock: 5 }, quantity: 1 }], pointsToRedeem: 0 }, version: 0 }))
  })
  const scripts = [], errors = [], writes = []
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== baseURL) return route.abort()
    if (url.pathname.endsWith(".js")) scripts.push(url.pathname)
    if (!url.pathname.startsWith("/api/")) return route.continue()
    const send = data => route.fulfill({ contentType: "application/json", body: JSON.stringify(data) })
    // This existing POST is a read-only quote, not an order or payment write.
    if (url.pathname === "/api/v1/rewards/preview/" && request.method() === "POST") return send({ campaigns: [], total_entries: 0 })
    if (request.method() !== "GET") writes.push(url.pathname)
    if (url.pathname === "/api/v1/site-settings/") return send({ site_name: "LevelPro Test", seo_title: "Home test", seo_description: "Descripción de prueba", hero_title: "Audio de prueba" })
    if (url.pathname === "/api/v1/auth/profile/") return send({ id: "buyer-1", email: "buyer@example.test", is_staff: false })
    if (url.pathname === "/api/v1/products/test/") return send({ id: "p1", name: "Producto test", slug: "test", price: "100", stock: 2, product_type: "stock", images: [], related_products: [] })
    if (url.pathname === "/api/v1/courses/test/") return send({ id: "c1", title: "Curso test", slug: "test", price: "100", is_free: false, description: "Test", modules: [], total_lessons: 0, is_enrolled: false })
    if (url.pathname === "/api/v1/services/test/") return send({ id: "s1", name: "Servicio test", slug: "test", price_type: "quote", description: "Test", features: [], images: [] })
    if (url.pathname === "/api/v1/payments/methods/") return send({ methods: [{ id: "transfer", label: "Transferencia" }], bank_accounts: [] })
    if (url.pathname === "/api/v1/loyalty/me/") return send({ puntos_disponibles: 0, transactions: [] })
    if (url.pathname === "/api/v1/products/") return send({ count: 0, results: [] })
    return send([])
  })
  const page = await context.newPage()
  page.on("pageerror", error => errors.push(error.message))
  t.after(async () => {
    try {
      assert.deepEqual(errors, [])
      assert.deepEqual(writes, [])
      assert.equal(await page.getByRole("heading", { name: "Algo salió mal", exact: true }).count(), 0)
    } finally { await context.close() }
  })
  await page.goto(`${baseURL}${path}`)
  await page.waitForLoadState("networkidle")
  return { page, scripts }
}

test("home does not download checkout, account or admin route chunks", async t => {
  const { page, scripts } = await openRoute(t, "/")
  await page.getByTestId("home-hero").waitFor()
  if (process.env.PAYMENT_TEST_MODE === "preview") {
    assert.ok(scripts.some(path => /index-/.test(path)))
    assert.ok(!scripts.some(path => /Checkout-|CourseDetail-|Dashboard-|Admin/.test(path)), scripts.join("\n"))
  }
  await page.getByTestId("hero-cta-primary").click()
  await page.waitForFunction(() => document.title.startsWith("Tienda"))
  if (process.env.PAYMENT_TEST_MODE === "preview") assert.ok(scripts.some(path => /Shop-/.test(path)))
})
for (const [path, title] of [["/shop", "Tienda"], ["/shop/test", "Producto test"], ["/academy", "Academia"], ["/academy/test", "Curso test"], ["/services", "Servicios"], ["/services/test", "Servicio test"], ["/cart", "Carrito"], ["/terminos", "Términos"], ["/privacidad", "Privacidad"], ["/garantia", "Garant"], ["/envios", "Envíos"]]) {
  test(`lazy route ${path} renders`, async t => {
    const { page } = await openRoute(t, path)
    assert.match(await page.locator("body").innerText(), new RegExp(title, "i"))
  })
}
test("checkout lazy chunk loads without creating an order on visit", async t => {
  const { page, scripts } = await openRoute(t, "/checkout")
  await page.getByTestId("checkout-submit").waitFor()
  if (process.env.PAYMENT_TEST_MODE === "preview") assert.ok(scripts.some(path => /Checkout-/.test(path)))
})
