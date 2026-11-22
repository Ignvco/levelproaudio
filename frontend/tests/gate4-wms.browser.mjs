import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { preview } from "vite"
import { chromium } from "playwright"

// Prueba visual UI con interceptación de rutas API y fixtures sintéticos en Chromium
// (no sustituye la integración E2E contra API + PostgreSQL real).
const ARTIFACT_DIR =
  process.env.GATE4_SCREENSHOT_DIR ||
  process.env.TEST_ARTIFACT_DIR ||
  path.join(os.tmpdir(), "levelpro-gate4-artifacts")
fs.mkdirSync(ARTIFACT_DIR, { recursive: true })

const WAREHOUSES = [
  {
    id: "wh-1", code: "BOD-CENTRAL", name: "Bodega Central Santiago",
    warehouse_type: "central", address: "Parque Logístico Sur, Módulo 4",
    internal_locations: ["A-01", "A-02", "B-01"], is_active: true,
    is_sellable_online: true, fulfillment_priority: 10,
  },
  {
    id: "wh-2", code: "SHOW-PROV", name: "Showroom Providencia",
    warehouse_type: "showroom", address: "Av. Providencia 1234",
    internal_locations: ["V-01", "V-02"], is_active: true,
    is_sellable_online: true, fulfillment_priority: 20,
  },
  {
    id: "wh-3", code: "TRN-ADUANA", name: "Bodega Tránsito Aduana",
    warehouse_type: "transit", address: "",
    internal_locations: [], is_active: true,
    is_sellable_online: false, fulfillment_priority: 99,
  },
]

const STOCKS = [
  {
    id: "st-1", warehouse: "wh-1", warehouse_code: "BOD-CENTRAL", warehouse_name: "Bodega Central Santiago",
    warehouse_type: "central", is_sellable_online: true, product: "pr-1",
    product_name: "Sintetizador Modular Pro 8", variant: null, variant_name: null,
    internal_sku: "LPA-SYN-PRO8", serialization_mode: "required",
    physical_quantity: 5, reserved_quantity: 1, non_sellable_quantity: 0,
    available_quantity: 4, stock_min: 2, serialized_count: 5,
  },
  {
    id: "st-2", warehouse: "wh-2", warehouse_code: "SHOW-PROV", warehouse_name: "Showroom Providencia",
    warehouse_type: "showroom", is_sellable_online: true, product: "pr-2",
    product_name: "Micrófono Condensador X1", variant: null, variant_name: null,
    internal_sku: "LPA-MIC-X1", serialization_mode: "optional",
    physical_quantity: 8, reserved_quantity: 2, non_sellable_quantity: 1,
    available_quantity: 5, stock_min: 3, serialized_count: 3,
  },
]

const KARDEX = [
  {
    id: "mv-1", warehouse_code: "BOD-CENTRAL", sku_snapshot: "LPA-SYN-PRO8",
    product_name: "Sintetizador Modular Pro 8", movement_type: "reserve", quantity: 1,
    physical_before: 5, physical_after: 5, reserved_before: 0, reserved_after: 1,
    available_before: 5, available_after: 4, reason: "Reserva temporal por orden #4012",
    source_document_type: "ORDER", actor_email: "checkout@levelproaudio.com",
    serial_numbers: [], recorded_at: "2026-11-21T20:15:00Z",
  },
  {
    id: "mv-2", warehouse_code: "BOD-CENTRAL", sku_snapshot: "LPA-SYN-PRO8",
    product_name: "Sintetizador Modular Pro 8", movement_type: "regularization", quantity: 5,
    physical_before: 5, physical_after: 5, reserved_before: 0, reserved_after: 0,
    available_before: 5, available_after: 5, reason: "Registro/regularización de 5 seriales",
    source_document_type: "REGULARIZATION", actor_email: "bodega@levelproaudio.com",
    serial_numbers: ["SN-PRO8-001", "SN-PRO8-002"], recorded_at: "2026-11-21T19:40:00Z",
  },
]

const TRANSFERS = [
  {
    id: "tr-1", code: "TRF-0001", source_code: "BOD-CENTRAL", destination_code: "SHOW-PROV",
    status: "in_transit", created_at: "2026-11-21T20:00:00Z",
    items: [{ id: "ti-1", internal_sku: "LPA-MIC-X1", quantity: 2 }],
  },
]

const RESERVATIONS = [
  {
    id: "rs-1", warehouse_code: "BOD-CENTRAL", internal_sku: "LPA-SYN-PRO8",
    product_name: "Sintetizador Modular Pro 8", quantity: 1, status: "consolidated",
    order: "4012aaaa-1111-1111-1111-111111111111", order_status: "paid", expires_at: null,
  },
  {
    id: "rs-2", warehouse_code: "SHOW-PROV", internal_sku: "LPA-MIC-X1",
    product_name: "Micrófono Condensador X1", quantity: 2, status: "temporary",
    order: "4013bbbb-2222-2222-2222-222222222222", order_status: "pending", expires_at: "2026-11-21T23:59:00Z",
  },
]

const SERIALS = [
  {
    id: "sn-1", serial_number: "SN-PRO8-001", internal_sku: "LPA-SYN-PRO8",
    product_name: "Sintetizador Modular Pro 8", warehouse_code: "BOD-CENTRAL",
    status: "in_stock", order: null, customer_email: null, received_at: "2026-11-21T19:40:00Z",
  },
  {
    id: "sn-2", serial_number: "SN-PRO8-002", internal_sku: "LPA-SYN-PRO8",
    product_name: "Sintetizador Modular Pro 8", warehouse_code: null,
    status: "dispatched", order: "4010cccc-3333-3333-3333-333333333333",
    customer_email: "cliente@estudio.cl", received_at: "2026-11-20T14:00:00Z",
  },
]

function json(data, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(data) }
}

async function setupRoutes(context) {
  await context.route("**/api/v1/**", async (route) => {
    const url = route.request().url()
    if (url.includes("/site-settings/")) {
      return route.fulfill(json({ usd_to_clp: "950.00", usd_to_ars: "1000.00", whatsapp_number: "56912345678" }))
    }
    if (url.includes("/users/me/") || url.includes("/auth/me/") || url.includes("/auth/profile/")) {
      return route.fulfill(json({
        id: "u-admin", email: "admin@levelproaudio.com", is_staff: true, is_superuser: true,
        roles: ["Super Admin"], permissions: ["view_costs", "edit_costs", "edit_prices", "adjust_inventory", "export_data"],
        effective_modules: ["dashboard", "catalog", "purchases", "orders", "inventory", "audit", "roles", "settings"],
      }))
    }
    if (url.includes("/admin/rbac/my-permissions/")) {
      return route.fulfill(json({
        is_superuser: true,
        roles: ["Super Admin"],
        modules: ["dashboard", "catalog", "orders", "inventory", "purchases", "finances", "audit", "settings"],
        capabilities: { view_costs: true, view_margins: true, view_finances: true, edit_prices: true, edit_costs: true, adjust_inventory: true, export_data: true },
      }))
    }
    if (url.includes("/admin/inventory-summary/") || url.includes("/admin/inventory/summary/")) {
      return route.fulfill(json({
        valor_inventario: 14500000, valor_venta: 21800000, ganancia_potencial: 7300000,
        total_productos: 24, sin_stock: 1, stock_critico: 2, stock_ok: 21,
      }))
    }
    if (url.includes("/admin/inventory-alerts/") || url.includes("/admin/inventory/alerts/")) return route.fulfill(json([]))
    if (url.includes("/admin/inventory-rotation/")) return route.fulfill(json([]))
    if (url.includes("/admin/inventory/warehouses/")) return route.fulfill(json({ results: WAREHOUSES, count: WAREHOUSES.length }))
    if (url.includes("/admin/inventory/stocks/")) {
      return route.fulfill(json({
        results: STOCKS, count: STOCKS.length,
        totals: { total_physical: 13, total_reserved: 3, total_non_sellable: 1, total_available: 9 },
      }))
    }
    if (url.includes("/admin/inventory/kardex/")) return route.fulfill(json({ results: KARDEX, count: KARDEX.length }))
    if (url.includes("/admin/inventory/transfers/")) return route.fulfill(json({ results: TRANSFERS }))
    if (url.includes("/admin/inventory/reservations/")) return route.fulfill(json({ results: RESERVATIONS, count: RESERVATIONS.length }))
    if (url.includes("/admin/serials/")) return route.fulfill(json({ results: SERIALS, count: SERIALS.length }))
    if (url.includes("/admin/products/")) return route.fulfill(json({ results: [], count: 0 }))
    return route.fulfill(json({}))
  })
}

test("Gate 4 WMS Visual UI Smoke [Mocked API Fixtures]: 7 vistas WMS", async () => {
  const server = await preview({ configFile: false, preview: { port: 0, host: "127.0.0.1" } })
  const address = server.httpServer.address()
  const baseUrl = `http://127.0.0.1:${address.port}`
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] })

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 920 } })
    await context.addInitScript(() => {
      document.cookie = "csrftoken=mock-csrf; path=/"
      sessionStorage.setItem("levelproaudio-auth", JSON.stringify({
        state: {
          isAuthenticated: true,
          user: {
            id: "u-admin", email: "admin@levelproaudio.com", is_staff: true, is_superuser: true,
            roles: ["Super Admin"], permissions: ["view_costs", "edit_costs", "edit_prices", "adjust_inventory", "export_data"],
            effective_modules: ["dashboard", "catalog", "purchases", "orders", "inventory", "audit", "roles", "settings"],
          },
        },
        version: 0,
      }))
    })
    await setupRoutes(context)
    const page = await context.newPage()
    page.on("pageerror", (err) => console.error("PAGEERROR:", err.message))
    await page.goto(`${baseUrl}/admin/inventory`, { waitUntil: "domcontentloaded" })
    await page.waitForSelector(".lp-seg-tabs", { timeout: 15000 })
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "gate4-01-wms-dashboard.png") })

    await page.getByRole("button", { name: "Stock Dimensional" }).click()
    await page.waitForSelector('[data-testid="wms-dimensional-table"]')
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "gate4-02-wms-dimensional-stock.png") })

    await page.getByRole("button", { name: "Bodegas" }).click()
    await page.waitForSelector('[data-testid="wms-warehouses-table"]')
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "gate4-03-wms-warehouses.png") })

    await page.getByRole("button", { name: "Kardex" }).click()
    await page.waitForSelector('[data-testid="wms-kardex-table"]')
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "gate4-04-wms-kardex.png") })

    await page.getByRole("button", { name: "Transferencias" }).click()
    await page.waitForTimeout(250)
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "gate4-05-wms-transfers.png") })

    await page.getByRole("button", { name: "Reservas" }).click()
    await page.waitForTimeout(250)
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "gate4-06-wms-reservations.png") })

    await page.getByRole("button", { name: "Seriales" }).click()
    await page.waitForSelector('[data-testid="wms-serials-table"]')
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "gate4-07-wms-serials-regularization.png") })

    assert.ok(true)
  } finally {
    await browser.close()
    await new Promise(resolve => server.httpServer.close(resolve))
  }
})
