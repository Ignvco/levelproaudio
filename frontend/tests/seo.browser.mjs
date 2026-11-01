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

test("initial metadata is replaced once and page priority survives fallback updates", async t => {
  const page = await browser.newPage()
  t.after(() => page.close())
  const { readFile } = await import("node:fs/promises")
  const source = (await readFile("src/utils/seoHead.js", "utf8")).replace(/^export /gm, "")
  await page.setContent('<html><head><title data-initial-seo>Initial</title><title>Duplicate</title><meta name="description" content="Initial"><meta name="description" content="Duplicate"><meta property="og:title" content="Initial"></head><body></body></html>')
  await page.addScriptTag({ content: source + ";window.seoTest={applyHead,registerHead};" })
  await page.evaluate(() => {
    const data = { title: "Base", description: "Default", image: "https://example.test/base.png", type: "website", canonical: "https://example.test", siteName: "Test", noindex: true }
    window.baseCleanup = window.seoTest.registerHead(data, 0)
    window.pageCleanup = window.seoTest.registerHead({ ...data, title: '<script>unsafe()</script>', description: '" onclick="bad', noindex: false }, 10)
    window.baseCleanup()
    window.baseCleanup = window.seoTest.registerHead({ ...data, title: "Updated baseline" }, 0)
  })
  assert.equal(await page.title(), '<script>unsafe()</script>')
  assert.equal(await page.locator("head title").count(), 1)
  assert.equal(await page.locator('meta[name="description"]').count(), 1)
  assert.equal(await page.locator('meta[property="og:title"]').count(), 1)
  assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "index, follow")
  assert.equal(await page.locator('[onclick]').count(), 0)
  await page.evaluate(() => window.pageCleanup())
  assert.equal(await page.title(), "Updated baseline")
  assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow")
})

test("SPA navigation replaces product metadata and marks payment pages noindex", async t => {
  const context = await browser.newContext()
  t.after(() => context.close())
  const errors = []
  await context.route("**/*", async route => {
    const url = new URL(route.request().url())
    if (url.origin !== baseURL) return route.abort()
    if (!url.pathname.startsWith("/api/")) return route.continue()
    const send = data => route.fulfill({ contentType: "application/json", body: JSON.stringify(data) })
    if (url.pathname === "/api/v1/site-settings/") return send({ site_name: "LevelPro Test", seo_title: "Home test", seo_description: "Descripción base" })
    if (url.pathname === "/api/v1/products/mic-test/") return send({ id: "product-test", slug: "mic-test", name: "Mic test", seo_title: "Mic SEO", seo_description: "Descripción especial", price: "100", stock: 2, product_type: "stock", images: [], related_products: [] })
    if (url.pathname === "/api/v1/auth/profile/") return send({ id: "buyer-1", email: "buyer@example.test", is_staff: false })
    return send([])
  })
  const page = await context.newPage()
  page.on("pageerror", error => errors.push(error.message))
  await page.goto(`${baseURL}/shop/mic-test`)
  await page.waitForFunction(() => document.title === "Mic SEO · LevelPro Test")
  assert.equal(await page.locator('meta[property="og:title"]').count(), 1)
  assert.equal(await page.locator('meta[name="description"]').getAttribute("content"), "Descripción especial")
  // A real router link changes the route without a page reload.
  await page.locator('a[href="/shop"]').first().click()
  await page.waitForFunction(() => document.title === "Tienda · LevelPro Test")
  assert.equal(await page.locator('meta[name="description"]').count(), 1)
  assert.ok(!(await page.locator('meta[name="description"]').getAttribute("content")).includes("especial"))
  await page.goto(`${baseURL}/payment/success`)
  await page.locator('[data-payment-state="missing"]').waitFor()
  assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow")
  assert.deepEqual(errors, [])
})
