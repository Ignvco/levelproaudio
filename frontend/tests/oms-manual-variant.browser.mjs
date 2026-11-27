// ISS-10 — regresión visual/contrato UI con API sintética.
// No sustituye validación E2E contra Django/PostgreSQL 16 QA.
import test from "node:test"
import assert from "node:assert/strict"
import { preview } from "vite"
import { chromium } from "playwright"

const products = [
  { id: "p-simple", sku: "SIMPLE", name: "Producto Simple", price: "100000", stock: 9, has_variants: false, variants: [], admin_variants: [] },
  {
    id: "p-var", sku: "MASTER", name: "Auriculares profesionales", stock: 12, has_variants: true,
    variants: [
      { id: "v-a", sku: "SKU-80", name: "80 Ohm", attributes: { impedance: "80 Ohm" }, stock: 7, is_active: true, prices: { CLP: "160000", USD: "170.00", ARS: "240000" } },
      { id: "v-b", sku: "SKU-250", name: "250 Ohm", attributes: { impedance: "250 Ohm" }, stock: 5, is_active: true, prices: { CLP: "180000", USD: "190.00", ARS: "260000" } },
      { id: "v-off", sku: "INACTIVO", name: "Descontinuado", is_active: false, stock: 0 },
    ],
  },
  { id: "p-noactive", sku: "NO-ACTIVE", name: "Solo variantes inactivas", has_variants: false, variants: [], admin_variants: [{ id: "v-old", is_active: false }] },
]

test("ISS-10: UI requiere variante, envía ID válido y preserva producto simple [synthetic fixture]", async () => {
  const vite = await preview({ configFile: false, preview: { port: 0, host: "127.0.0.1" } })
  const baseUrl = `http://127.0.0.1:${vite.httpServer.address().port}`
  const executablePath = process.env.CHROME_PATH || process.env.PAYMENT_TEST_CHROMIUM
  const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true, args: ["--no-sandbox"] })
  const captured = []
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await context.route("**/api/**", async (route) => {
      const { pathname } = new URL(route.request().url())
      const method = route.request().method()
      const json = (payload, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) })
      if (pathname === "/api/v1/auth/me/permissions/") {
        return json({ is_superuser: true, modules: ["orders", "catalog", "inventory"], capabilities: { edit_prices: true } })
      }
      if (pathname.includes("/auth/me/") || pathname.includes("/users/me/") || pathname.includes("/auth/profile/")) {
        return json({ id: "u-1", email: "admin@example.test", is_staff: true, is_superuser: true, roles: ["Super Admin"], effective_modules: ["orders", "catalog", "inventory", "finances", "audit"] })
      }
      if (pathname.includes("/admin/rbac/") || pathname.includes("/admin/rbac/my-permissions/")) {
        return json({ is_superuser: true, modules: ["orders", "catalog", "inventory"], capabilities: { edit_prices: true } })
      }
      if (pathname === "/api/v1/admin/products/") return json({ results: products, count: products.length })
      if (pathname === "/api/v1/admin/orders/manual/" && method === "POST") {
        const body = route.request().postDataJSON()
        captured.push(body)
        return json({ id: `drf-${captured.length}`, draft_number: `DRAFT-${captured.length}`, status: "proposed", customer_name: body.customer_name, customer_email: body.customer_email, currency: body.currency, items: body.items }, 201)
      }
      if (pathname === "/api/v1/admin/orders/manual/") return json({ count: 0, results: [] })
      return json({ count: 0, results: [] })
    })
    const page = await context.newPage()
    await page.addInitScript(() => {
      document.cookie = "csrftoken=mock-csrf; path=/"
      sessionStorage.setItem("levelproaudio-auth", JSON.stringify({ state: { isAuthenticated: true, user: { id: "u-1", email: "admin@example.test", is_staff: true, is_superuser: true } }, version: 0 }))
    })
    await page.goto(`${baseUrl}/admin/orders`, { waitUntil: "domcontentloaded" })
    await page.getByTestId("open-manual-sale-modal-btn").click()
    await page.getByTestId("manual-customer-name").fill("Cliente QA")
    await page.getByTestId("manual-customer-email").fill("qa@example.test")
    const product = page.getByTestId("manual-product-select")
    const variant = page.getByTestId("manual-variant-select")
    await product.selectOption("p-var")
    await variant.waitFor({ state: "visible" })
    assert.equal(await variant.locator('option[value="v-off"]').count(), 0, "no ofrece variante inactiva")

    // Sin selección de variante el cliente debe detenerse antes de ejecutar POST.
    await page.getByTestId("submit-manual-order-btn").click()
    assert.equal(captured.length, 0)
    assert.equal(await variant.evaluate((el) => el === document.activeElement), true)

    // Variante válida, SKU correcto y payload sin metadatos visuales.
    await variant.selectOption("v-a")
    await page.getByRole("spinbutton", { name: "Precio unitario autorizado" }).fill("165000.50")
    await variant.selectOption("v-b")
    assert.equal(await page.getByRole("spinbutton", { name: "Precio unitario autorizado" }).inputValue(), "")
    await page.getByTestId("manual-product-qty").fill("2")
    await page.getByTestId("submit-manual-order-btn").click()
    await page.getByTestId("draft-order-detail-card").waitFor({ state: "visible" })
    assert.equal(captured[0].items[0].variant_id, "v-b")
    assert.equal(captured[0].items[0].quantity, 2)
    assert.equal(Object.hasOwn(captured[0].items[0], "authorized_unit_price"), false)
    assert.equal(Object.hasOwn(captured[0].items[0], "sku"), false)

    // Producto simple no exige ni envía variant_id.
    await page.getByTestId("open-manual-sale-modal-btn").click()
    await product.selectOption("p-simple")
    assert.equal(await variant.count(), 0)
    await page.getByTestId("submit-manual-order-btn").click()
    await page.getByTestId("draft-order-detail-card").waitFor({ state: "visible" })
    assert.equal(captured.length, 2)
    assert.equal(Object.hasOwn(captured[1].items[0], "variant_id"), false)

    // Dos líneas mixtas: la variante se preserva y una línea simple no hereda el ID.
    await page.getByTestId("open-manual-sale-modal-btn").click()
    await product.selectOption("p-var")
    await variant.selectOption("v-a")
    await page.getByRole("button", { name: "+ Añadir línea" }).click()
    await product.selectOption("p-simple")
    await page.getByRole("button", { name: "+ Añadir línea" }).click()
    await page.getByTestId("submit-manual-order-btn").click()
    await page.getByTestId("draft-order-detail-card").waitFor({ state: "visible" })
    assert.equal(captured.length, 3)
    assert.equal(captured[2].items[0].variant_id, "v-a")
    assert.equal(Object.hasOwn(captured[2].items[1], "variant_id"), false)

    // Solo inactivas: muestra bloqueo y nunca genera un POST nuevo.
    await page.getByTestId("open-manual-sale-modal-btn").click()
    await product.selectOption("p-noactive")
    await variant.waitFor({ state: "visible" })
    assert.equal(await variant.isDisabled(), true)
    await page.getByTestId("submit-manual-order-btn").click()
    assert.equal(captured.length, 3)
  } finally {
    await browser.close()
    await new Promise((resolve) => vite.httpServer.close(resolve))
  }
})
