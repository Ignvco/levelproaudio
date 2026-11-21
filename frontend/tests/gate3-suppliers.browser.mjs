import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { preview } from "vite"
import { chromium } from "playwright"

const ARTIFACT_DIR = "/Users/levelproaudio/.gemini/antigravity/brain/11ba077a-d7d1-492e-b2b9-3bee19137a13"

const SAMPLE_PRODUCT = {
  id: "22222222-2222-2222-2222-222222222222",
  name: "Micrófono Condensador Pro X1",
  slug: "microfono-condensador-pro-x1",
  sku: "LPA-MIC-X1",
  price: "149990.00",
  stock: 12,
  stock_min: 3,
  is_active: true,
  category: { id: "cat-mic", name: "Micrófonos", slug: "microfonos" },
  brand: { id: "br-1", name: "Shure", slug: "shure" },
  technical_specs: [],
  variants: [],
  admin_variants: [],
}

const SAMPLE_SUPPLIERS = [
  {
    id: "aaaa1111-1111-1111-1111-111111111111",
    internal_code: "SUP-0001",
    legal_name: "Pro Audio Exports Inc.",
    trade_name: "ProAudio Miami",
    tax_id: "EIN-99-1234567",
    country: "Estados Unidos",
    supplier_type: "distributor",
    currency: "USD",
    payment_terms: "30 días wire",
    default_min_order_qty: 2,
    default_lead_time_days: 14,
    brands_detail: [{ id: "br-1", name: "Shure", slug: "shure" }],
    contacts: [{ id: "c-1", full_name: "Carlos Méndez", role_title: "Export Manager", email: "cm@proaudio.test", phone: "+1 305 555 0100", is_primary: true }],
    is_active: true,
    internal_notes: "Proveedor oficial costa este.",
    linked_products_count: 14,
    expired_lists_count: 0,
  },
  {
    id: "bbbb2222-2222-2222-2222-222222222222",
    internal_code: "SUP-0002",
    legal_name: "Distribuidora Andes Audio SpA",
    trade_name: "Andes Pro Chile",
    tax_id: "76.123.456-7",
    country: "Chile",
    supplier_type: "importer",
    currency: "CLP",
    payment_terms: "Contado / 15 días",
    default_min_order_qty: 1,
    default_lead_time_days: 3,
    brands_detail: [{ id: "br-1", name: "Shure", slug: "shure" }],
    contacts: [],
    is_active: true,
    internal_notes: "Despacho inmediato Santiago.",
    linked_products_count: 9,
    expired_lists_count: 1,
  },
]

const SAMPLE_COMPARISON = {
  product_id: SAMPLE_PRODUCT.id,
  variant_id: null,
  internal_sku: "LPA-MIC-X1",
  comparable_groups_count: 2,
  has_mixed_currencies: true,
  has_mixed_tax_basis: false,
  referential_meta: { target_currency: "CLP", source: "SiteSettings", usd_to_clp: "950.00", usd_to_ars: "1000.00" },
  alternatives: [
    {
      id: "lnk-1",
      supplier_id: SAMPLE_SUPPLIERS[0].id,
      supplier_code: "SUP-0001",
      supplier_name: "ProAudio Miami",
      supplier_country: "Estados Unidos",
      supplier_sku: "SH-X1-US",
      unit_cost: "92.50",
      currency: "USD",
      tax_basis: "net",
      moq: 2,
      lead_time_days: 14,
      reported_availability: "in_stock",
      reported_available_qty: 30,
      is_cost_expired: false,
      is_preferred: true,
      is_best_comparable_cost: false,
      payment_terms: "30 días wire",
    },
    {
      id: "lnk-2",
      supplier_id: SAMPLE_SUPPLIERS[1].id,
      supplier_code: "SUP-0002",
      supplier_name: "Andes Pro Chile",
      supplier_country: "Chile",
      supplier_sku: "AND-X1-CL",
      unit_cost: "96000.00",
      currency: "CLP",
      tax_basis: "net",
      moq: 1,
      lead_time_days: 3,
      reported_availability: "low_stock",
      reported_available_qty: 4,
      is_cost_expired: false,
      is_preferred: false,
      is_best_comparable_cost: false,
      payment_terms: "Contado / 15 días",
    },
  ],
}

async function setupRoutes(context, baseURL) {
  await context.route("**/api/v1/**", async (route) => {
    const req = route.request()
    const url = req.url().replace(baseURL, "")
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) })

    if (url.includes("/site-settings/")) return json({ usd_to_clp: "950.00", usd_to_ars: "1000.00", whatsapp_number: "56912345678" })
    if (url.includes("/auth/me/") || url.includes("/auth/profile/")) {
      return json({
        id: "user-admin", email: "admin@levelproaudio.com", is_staff: true, is_superuser: true,
        roles: ["Super Admin"], permissions: ["view_costs", "edit_costs", "edit_prices", "export_data"],
        effective_modules: ["dashboard", "catalog", "purchases", "orders", "inventory", "audit", "roles", "settings"],
      })
    }
    if (url.includes("/admin/dashboard/")) return json({ actions: { pending_orders: [], low_stock: [] }, kpis: {} })
    if (url.includes("/admin/categories/")) return json([{ id: "cat-mic", name: "Micrófonos", slug: "microfonos" }])
    if (url.includes("/admin/brands/")) return json([{ id: "br-1", name: "Shure", slug: "shure" }])
    if (url.includes("/admin/suppliers/price-lists/import/")) {
      return json({
        dry_run: true,
        filename: "lista_costos_pro.csv",
        summary: { new: 1, updated: 1, skipped: 0, rejected: 1 },
        total_rows: 3,
        rows: [],
        errors: [{ row: 4, sku: "BAD-SKU", error: "SKU 'BAD-SKU' no existe en SkuRegistry del catálogo." }],
      })
    }
    if (url.includes(`/admin/suppliers/${SAMPLE_SUPPLIERS[0].id}/products/`)) {
      return json({
        results: [{
          id: "lnk-1", internal_sku: "LPA-MIC-X1", product_name: "Micrófono Condensador Pro X1",
          supplier_sku: "SH-X1-US", unit_cost: "92.50", currency: "USD", tax_basis: "net",
          moq: 2, lead_time_days: 14, is_cost_expired: false, is_preferred: true,
        }],
        count: 1,
      })
    }
    if (url.includes(`/admin/suppliers/${SAMPLE_SUPPLIERS[0].id}/price-history/`)) return json({ results: [], count: 0 })
    if (url.includes(`/admin/suppliers/${SAMPLE_SUPPLIERS[0].id}/`)) return json(SAMPLE_SUPPLIERS[0])
    if (url.includes("/admin/suppliers/")) {
      return json({
        count: 2,
        results: SAMPLE_SUPPLIERS,
        summary: { total: 2, active: 2, national: 1, international: 1, linked_skus: 23, expired_lists: 1 },
      })
    }
    if (url.includes(`/admin/products/${SAMPLE_PRODUCT.id}/suppliers/`)) return json(SAMPLE_COMPARISON)
    if (url.includes(`/admin/products/${SAMPLE_PRODUCT.id}/supplier-price-history/`)) {
      return json({
        results: [{
          id: "h-1", supplier_code: "SUP-0001", supplier_name: "ProAudio Miami",
          previous_cost: "95.00", previous_currency: "USD", new_cost: "92.50", new_currency: "USD",
          source: "import", recorded_at: "2026-11-21T18:00:00Z",
        }],
        count: 1,
      })
    }
    if (url.includes(`/admin/products/${SAMPLE_PRODUCT.id}/variants/`)) return json({ results: [], count: 0 })
    if (url.includes(`/admin/products/${SAMPLE_PRODUCT.id}/technical-specs/`)) return json({ product_id: SAMPLE_PRODUCT.id, specs: [] })
    if (url.includes("/admin/products/technical-attributes/")) return json({ attributes: [], recommended_keys: [] })
    if (url.includes(`/admin/products/${SAMPLE_PRODUCT.id}/`)) return json(SAMPLE_PRODUCT)
    return json({})
  })
}

test("Gate 3 Suppliers Browser E2E: directorio, ficha proveedor, comparación producto e importador", async () => {
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
            roles: ["Super Admin"], permissions: ["view_costs", "edit_costs", "edit_prices", "export_data"],
            effective_modules: ["dashboard", "catalog", "purchases", "orders", "inventory", "audit", "roles", "settings"],
          },
        },
        version: 0,
      }))
    })
    await setupRoutes(context, baseURL)
    const page = await context.newPage()
    page.on("pageerror", (err) => console.error("PAGEERROR:", err.message))

    // 1. Directorio de proveedores
    await page.goto(`${baseURL}/admin/suppliers`, { waitUntil: "domcontentloaded" })
    await page.getByTestId("suppliers-table").waitFor({ timeout: 15000 })
    await page.getByTestId("supplier-row-SUP-0001").waitFor()
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "gate3-01-admin-suppliers-directory.png"), fullPage: false })

    // 2. Modal de importación dry-run de listas de costos
    await page.getByTestId("open-price-list-import-btn").click()
    await page.getByTestId("price-list-import-modal").waitFor()
    await page.setInputFiles('input[type="file"]', {
      name: "lista_costos_pro.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("supplier_code,sku,unit_cost,currency\nSUP-0001,LPA-MIC-X1,92.50,USD\n"),
    })
    await page.getByTestId("import-price-dry-run-btn").click()
    await page.getByTestId("import-price-summary").waitFor()
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "gate3-04-admin-supplier-price-import.png"), fullPage: false })

    // 3. Ficha individual de proveedor
    await page.goto(`${baseURL}/admin/suppliers/${SAMPLE_SUPPLIERS[0].id}`, { waitUntil: "domcontentloaded" })
    await page.getByTestId("save-supplier-profile-btn").waitFor({ timeout: 15000 })
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "gate3-02-admin-supplier-detail.png"), fullPage: false })

    // 4. Pestaña Proveedores en ficha de producto (matriz comparativa)
    await page.goto(`${baseURL}/admin/products/${SAMPLE_PRODUCT.id}`, { waitUntil: "domcontentloaded" })
    await page.getByTestId("pim-tab-suppliers").waitFor({ timeout: 15000 })
    await page.getByTestId("pim-tab-suppliers").click()
    await page.getByTestId("product-suppliers-comparison-table").waitFor()
    await page.getByTestId("comparison-row-SUP-0001").waitFor()
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "gate3-03-admin-product-suppliers-comparison.png"), fullPage: false })
  } finally {
    await browser.close()
    await new Promise(resolve => testServer.httpServer.close(resolve))
  }
})
