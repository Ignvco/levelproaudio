// tests/gate2-pim.browser.mjs — Certificación E2E Playwright Gate 2 PIM
import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { chromium } from "playwright"
import { preview } from "vite"

const ARTIFACT_DIR = process.env.GATE2_SHOTS_DIR || "/Users/levelproaudio/.gemini/antigravity/brain/11ba077a-d7d1-492e-b2b9-3bee19137a13"

const SAMPLE_PRODUCT = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Beyerdynamic DT 770 PRO",
  slug: "beyerdynamic-dt-770-pro",
  sku: "DT770-MASTER",
  category: { id: "cat-hp", name: "Audífonos", slug: "audifonos" },
  brand: { id: "br-bd", name: "Beyerdynamic", slug: "beyerdynamic" },
  short_description: "Audífono cerrado de referencia para estudio.",
  description: "Referencia de estudio cerrada con transductores de alta precisión.",
  price: "169990.00",
  compare_price: null,
  price_usd: "179.00",
  price_ars: "179000.00",
  prices: { CLP: "169990.00", USD: "179.00", ARS: "179000.00" },
  stock: 0,
  effective_stock: 10,
  stock_min: 3,
  in_stock: true,
  is_active: true,
  is_featured: true,
  has_variants: true,
  product_type: "stock",
  images: [],
  variants: [
    {
      id: "var-32",
      sku: "DT770-32",
      barcode: "4010118483668",
      name: "32 Ohm / Negro",
      attributes: { impedance: "32 Ohm", color: "Negro" },
      price: "169990.00",
      compare_price: null,
      prices: { CLP: "169990.00", USD: "179.00", ARS: "179000.00" },
      stock: 5,
      in_stock: true,
      is_active: true,
      is_default: true,
      order: 0,
    },
    {
      id: "var-80",
      sku: "DT770-80",
      barcode: "4010118474741",
      name: "80 Ohm / Gris",
      attributes: { impedance: "80 Ohm", color: "Gris" },
      price: "174990.00",
      compare_price: null,
      prices: { CLP: "174990.00", USD: "185.00", ARS: "185000.00" },
      stock: 3,
      in_stock: true,
      is_active: true,
      is_default: false,
      order: 1,
    },
    {
      id: "var-250",
      sku: "DT770-250",
      barcode: "4010118459045",
      name: "250 Ohm / Estudio",
      attributes: { impedance: "250 Ohm", color: "Negro" },
      price: "179990.00",
      compare_price: null,
      prices: { CLP: "179990.00", USD: "190.00", ARS: "190000.00" },
      stock: 2,
      in_stock: true,
      is_active: true,
      is_default: false,
      order: 2,
    },
  ],
  admin_variants: [
    { id: "var-32", sku: "DT770-32", name: "32 Ohm / Negro", attributes: { impedance: "32 Ohm" }, effective_price: "169990.00", stock: 5, is_active: true, is_default: true },
    { id: "var-80", sku: "DT770-80", name: "80 Ohm / Gris", attributes: { impedance: "80 Ohm" }, effective_price: "174990.00", stock: 3, is_active: true, is_default: false },
    { id: "var-250", sku: "DT770-250", name: "250 Ohm / Estudio", attributes: { impedance: "250 Ohm" }, effective_price: "179990.00", stock: 2, is_active: true, is_default: false },
  ],
  technical_specs: [
    { id: "sp-1", key: "frequency_response", label: "Respuesta en frecuencia", unit: "Hz – kHz", data_type: "text", value_text: "5 Hz – 35 kHz", display_value: "5 Hz – 35 kHz" },
    { id: "sp-2", key: "impedance_ohm", label: "Impedancia", unit: "Ω", data_type: "decimal", value_text: "250", display_value: "250 Ω" },
    { id: "sp-3", key: "thd_percent", label: "THD", unit: "%", data_type: "decimal", value_text: "0.2", display_value: "0.2 %" },
  ],
}

async function setupRoutes(context, baseURL) {
  await context.route("**/*", async (route) => {
    const reqUrl = route.request().url()
    const parsed = new URL(reqUrl)
    if (parsed.origin !== baseURL) return route.abort()
    if (!parsed.pathname.startsWith("/api/v1/")) return route.continue()

    const url = parsed.pathname + parsed.search
    const method = route.request().method()
    const json = (data, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) })

    if (url.includes("/auth/csrf/")) return json({ ok: true })
    if (url.includes("/site-settings/")) return json({ usd_to_clp: "950.00", usd_to_ars: "1000.00", whatsapp_number: "56912345678" })
    if (url.includes("/auth/me/") || url.includes("/auth/profile/")) {
      return json({
        id: "user-admin", email: "admin@levelproaudio.com", is_staff: true, is_superuser: true,
        roles: ["Super Admin"], permissions: ["edit_prices", "edit_costs", "adjust_inventory", "export_data", "view_costs"],
        effective_modules: ["dashboard", "catalog", "orders", "inventory", "audit", "roles", "settings"],
      })
    }
    if (url.includes("/categories/")) return json([{ id: "cat-hp", name: "Audífonos", slug: "audifonos" }])
    if (url.includes("/brands/")) return json([{ id: "br-bd", name: "Beyerdynamic", slug: "beyerdynamic" }])
    if (url.includes("/products/beyerdynamic-dt-770-pro/")) return json(SAMPLE_PRODUCT)
    if (url === "/api/v1/products/" || url.startsWith("/api/v1/products/?")) return json({ count: 1, results: [SAMPLE_PRODUCT] })
    if (url.includes("/rewards/product/")) return json([])
    if (url.includes("/admin/products/bulk-preview/")) {
      return json({
        target_scope: "products", operation: "price_adjust_percent",
        total_matched: 1, valid_count: 1, error_count: 0, warnings_count: 0,
        items: [{ id: SAMPLE_PRODUCT.id, name: SAMPLE_PRODUCT.name, sku: SAMPLE_PRODUCT.sku, before: { price: "169990.00" }, after: { price: "186989.00" }, warnings: [] }],
        errors: [],
      })
    }
    if (url.includes("/admin/products/bulk-apply/")) {
      return json({ status: "completed", atomic_mode: "all_or_nothing", applied_count: 1, failed_count: 0, applied: [], failed: [] })
    }
    if (url.includes("/admin/products/import/")) {
      return json({
        dry_run: url.includes("dry_run=true"),
        filename: "catalogo_sintetico.csv",
        summary: { new: 1, updated: 1, skipped: 0, rejected: 1 },
        total_rows: 3,
        rows: [
          { row: 2, entity: "product", sku: "SHURE-SM58-LC", name: "Shure SM58-LC", status: "updated", changes: { stock: 0 } },
          { row: 3, entity: "product", sku: "QA-MIC-01", name: "Micrófono QA", status: "new", changes: { price: "89990" } },
          { row: 4, entity: "product", sku: "BAD-01", name: "Precio inválido", status: "rejected", error: "price: no puede ser negativo (-500)." },
        ],
        errors: [{ row: 4, sku: "BAD-01", name: "Precio inválido", error: "price: no puede ser negativo (-500)." }],
      })
    }
    if (url.includes(`/admin/products/${SAMPLE_PRODUCT.id}/variants/`)) {
      return json({ results: SAMPLE_PRODUCT.admin_variants, count: 3 })
    }
    if (url.includes(`/admin/products/${SAMPLE_PRODUCT.id}/technical-specs/`)) {
      return json({ product_id: SAMPLE_PRODUCT.id, specs: SAMPLE_PRODUCT.technical_specs })
    }
    if (url.includes("/admin/products/technical-attributes/")) {
      return json({
        attributes: [
          { key: "frequency_response", label: "Respuesta en frecuencia", data_type: "text", unit: "Hz – kHz", options: [] },
          { key: "impedance_ohm", label: "Impedancia", data_type: "decimal", unit: "Ω", options: [] },
          { key: "thd_percent", label: "THD", data_type: "decimal", unit: "%", options: [] },
        ],
        recommended_keys: ["frequency_response", "impedance_ohm", "thd_percent"],
      })
    }
    if (url.includes(`/admin/products/${SAMPLE_PRODUCT.id}/`)) return json(SAMPLE_PRODUCT)
    if (url.includes("/admin/products/") && method === "GET") return json({ count: 1, results: [SAMPLE_PRODUCT] })
    return json({})
  })
}

test("Gate 2 PIM Browser E2E: variantes en tienda, edición masiva, ficha PIM e importador", async () => {
  const testServer = await preview({ configFile: false, preview: { host: "127.0.0.1", port: 0 } })
  const baseURL = `http://127.0.0.1:${testServer.httpServer.address().port}`
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await context.addInitScript(() => {
      document.cookie = "csrftoken=mock-csrf; path=/"
      sessionStorage.setItem("levelproaudio-auth", JSON.stringify({
        state: {
          isAuthenticated: true,
          user: {
            id: "user-admin", email: "admin@levelproaudio.com", is_staff: true, is_superuser: true,
            roles: ["Super Admin"],
            permissions: ["edit_prices", "edit_costs", "adjust_inventory", "export_data", "view_costs"],
            effective_modules: ["dashboard", "catalog", "orders", "inventory", "audit", "roles", "settings"],
          },
        },
        version: 0,
      }))
    })
    await setupRoutes(context, baseURL)
    const page = await context.newPage()

    // 1. Tienda Pública: Selector de variantes y especificaciones técnicas
    await page.goto(`${baseURL}/shop/beyerdynamic-dt-770-pro`, { waitUntil: "domcontentloaded" })
    await page.getByTestId("variant-selector").waitFor({ timeout: 15000 })
    await page.getByTestId("variant-option-DT770-80").click()
    const skuText = await page.getByTestId("product-detail-sku").textContent()
    assert.match(skuText, /DT770-80/)
    await page.getByTestId("product-technical-specs").waitFor()
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "gate2-01-storefront-variants-specs.png"), fullPage: false })

    // 2. Admin Productos + Bulk Edit Modal
    await page.goto(`${baseURL}/admin/products`, { waitUntil: "domcontentloaded" })
    await page.getByTestId("bulk-edit-btn").waitFor({ timeout: 15000 })
    await page.getByTestId("bulk-edit-btn").click()
    await page.getByTestId("bulk-edit-modal").waitFor()
    await page.getByTestId("bulk-preview-btn").click()
    await page.getByTestId("bulk-preview-table").waitFor()
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "gate2-02-admin-bulk-edit-preview.png"), fullPage: false })

    // 3. Admin Ficha PIM (Variantes + Specs)
    await page.goto(`${baseURL}/admin/products/${SAMPLE_PRODUCT.id}`, { waitUntil: "domcontentloaded" })
    await page.getByTestId("variant-row-DT770-250").waitFor({ timeout: 15000 })
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "gate2-03-admin-pim-variants.png"), fullPage: false })

    await page.getByTestId("pim-tab-specs").click()
    await page.getByTestId("spec-input-frequency_response").waitFor()
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "gate2-04-admin-pim-specs.png"), fullPage: false })

    // 4. Admin Importador Dry-Run
    await page.goto(`${baseURL}/admin/products/import`, { waitUntil: "domcontentloaded" })
    await page.getByTestId("import-dry-run-btn").waitFor({ timeout: 15000 })
    const csvBuffer = Buffer.from("sku,nombre,precio_clp,stock\nQA-MIC-01,Micrófono QA,89990,4\n")
    await page.setInputFiles('input[type="file"]', {
      name: "catalogo_sintetico.csv",
      mimeType: "text/csv",
      buffer: csvBuffer,
    })
    await page.getByTestId("import-dry-run-btn").click()
    await page.getByTestId("import-confirm-btn").waitFor()
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "gate2-05-admin-import-dry-run.png"), fullPage: false })
  } finally {
    await browser.close()
    await new Promise(resolve => testServer.httpServer.close(resolve))
  }
})
