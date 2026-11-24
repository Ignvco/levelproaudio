import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { preview } from "vite"
import { chromium } from "playwright"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIR = path.resolve(__dirname, "..")
const BASE_OUT = "/Users/levelproaudio/.gemini/antigravity/brain/11ba077a-d7d1-492e-b2b9-3bee19137a13"
const MODE = process.argv[2] || "before" // "before" | "after"
const OUT_DIR = path.join(BASE_OUT, `gate13_${MODE}`)
const CHROME_PATH = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

fs.mkdirSync(OUT_DIR, { recursive: true })

export const SYNTHETIC_API_MOCKS = (url) => {
  if (url.includes("/users/me/") || url.includes("/auth/me/") || url.includes("/auth/profile/")) {
    return {
      id: "u1",
      email: "admin@levelpro.cl",
      first_name: "Ignacio",
      last_name: "LevelPro",
      is_staff: true,
      is_superuser: true,
      roles: ["Super Admin"],
      effective_modules: ["dashboard", "catalog", "orders", "inventory", "purchases", "logistics", "finances", "marketing", "academy", "services", "roles", "settings", "audit"],
    }
  }
  if (url.includes("/admin/rbac/me")) {
    return {
      roles: ["Super Admin"],
      is_superuser: true,
      modules: ["dashboard", "catalog", "orders", "inventory", "purchases", "logistics", "finances", "marketing", "academy", "services", "roles", "settings", "audit"],
      capabilities: { view_costs: true, view_margins: true, view_finances: true, manage_finances: true, manage_settings: true, manage_roles: true, view_audit: true },
    }
  }
  if (url.includes("/admin/search/global/")) {
    return {
      query: "RME",
      results: {
        products: [{ id: "p-1", name: "RME Babyface Pro FS", sku: "RME-BF-FS", currency: "CLP", price: "990000.00", stock: 6, link: "/admin/products?highlight=p-1" }],
        variants: [{ id: "v-1", sku: "RME-BF-FS-BLK", name: "Edición Black", product_name: "RME Babyface Pro FS", currency: "USD", price: "1050.00", link: "/admin/products?highlight=p-1" }],
        serials: [{ id: "sn-1", serial_number: "SN-RME-2026-0091", sku: "RME-BF-FS", product_name: "RME Babyface Pro FS", status: "available", warehouse_name: "Bodega Central Santiago", link: "/admin/inventory?tab=serials&q=SN-RME-2026-0091" }],
        orders: [{ id: "ord-1", short_id: "ORD-901A", customer: "Estudio Master CL", status: "paid", currency: "CLP", total: "990000.00", link: "/admin/orders?id=ord-1" }],
        customers: [{ id: "c-1", name: "Estudio Master CL", email: "contacto@estudiomaster.cl", role: "Cliente B2B", link: "/admin/users?q=contacto%40estudiomaster.cl" }],
      },
      total: 5,
    }
  }
  if (url.includes("/admin/notifications/")) {
    return {
      unread_count: 4,
      total_count: 4,
      polling_interval_seconds: 60,
      delivery_mode: "controlled_polling",
      delivery_disclosure: "Actualización por polling controlado (60s) y refresco manual.",
      notifications: [
        { key: "notif:order:ord-1", category: "orders", priority: "high", title: "Pedido #ORD-901A pendiente de confirmación", description: "Estudio Master CL · CLP 990.000", target_route: "/admin/orders?id=ord-1", created_at: "2026-11-24T15:00:00Z", is_read: false },
        { key: "notif:stock_out:p-2", category: "inventory", priority: "critical", title: "Stock agotado: Neumann TLM 103", description: "SKU NEU-TLM103 · 0 unidades disponibles", target_route: "/admin/inventory", created_at: "2026-11-24T14:40:00Z", is_read: false },
        { key: "notif:stock_low:p-3", category: "inventory", priority: "warning", title: "Stock bajo: Focusrite Scarlett 2i2 Gen 4", description: "SKU FOC-2I2-G4 · 2 unidades", target_route: "/admin/inventory", created_at: "2026-11-24T14:20:00Z", is_read: false },
        { key: "notif:service:srv-1", category: "services", priority: "medium", title: "Solicitud de servicio pendiente: Calibración Estudio", description: "Cliente: diegoproductor@estudio.cl", target_route: "/admin/services", created_at: "2026-11-24T13:50:00Z", is_read: false },
      ],
    }
  }
  if (url.includes("/admin/dashboard")) {
    return {
      total_revenue: 4850000,
      orders_count: 14,
      pending_orders: 2,
      products_count: 48,
      users_count: 120,
      pending_orders_list: [{ id: "ord-1", short_id: "ORD-901A", user_name: "Estudio Master CL", total: 990000, currency: "CLP", status: "pending" }],
      low_stock_products: [{ id: "p-2", name: "Neumann TLM 103", stock: 0 }, { id: "p-3", name: "Focusrite Scarlett 2i2 Gen 4", stock: 2 }],
    }
  }
  if (url.includes("/admin/products")) {
    return {
      count: 2,
      results: [
        { id: "p-1", name: "RME Babyface Pro FS", sku: "RME-BF-FS", category_name: "Interfaces de Audio", brand_name: "RME", price: "990000.00", price_usd: "1050.00", stock: 6, is_active: true },
        { id: "p-2", name: "Neumann TLM 103", sku: "NEU-TLM103", category_name: "Micrófonos", brand_name: "Neumann", price: "1250000.00", price_usd: "1320.00", stock: 0, is_active: true },
      ],
    }
  }
  if (url.includes("/admin/orders")) {
    return {
      count: 2,
      results: [
        { id: "ord-1", short_id: "ORD-901A", user_name: "Estudio Master CL", email: "contacto@estudiomaster.cl", status: "paid", commercial_status: "confirmed", payment_status: "paid", fulfillment_status: "allocated", currency: "CLP", total: "990000.00", created_at: "2026-11-24T14:00:00Z" },
        { id: "ord-2", short_id: "ORD-902B", user_name: "Acoustic Lab BA", email: "compras@acousticlab.ar", status: "pending", commercial_status: "pending_payment", payment_status: "pending", fulfillment_status: "unfulfilled", currency: "USD", total: "1050.00", created_at: "2026-11-24T15:00:00Z" },
      ],
    }
  }
  if (url.includes("/admin/marketing/dashboard/")) {
    return {
      kpis: { active_coupons: 3, active_promotions: 1, scheduled_promotions: 2, abandoned_eligible: 2, abandoned_recovered: 1, abandoned_suppressed: 1, outbox_messages: 3, consented_contacts: 14, suppressed_contacts: 1 },
      redemptions_by_currency: [
        { currency: "CLP", count: 8, total_discount: "160000.00" },
        { currency: "USD", count: 3, total_discount: "75.00" },
        { currency: "ARS", count: 2, total_discount: "45000.00" },
      ],
      loyalty_summary: { accounts_count: 18, total_points_balance: 42500 },
      rewards_summary: { campaigns_count: 2, active_campaigns: 1, stickers_count: 15, winners_count: 1 },
    }
  }
  if (url.includes("/admin/marketing/coupons/")) {
    return {
      results: [
        { id: "c-1", code: "STUDIO10CLP", name: "Estudios 10% CLP", currency: "CLP", discount_type: "percentage", discount_value: "10.00", used_count: 4, max_total_uses: 50, accumulation_rule: "blocked", min_eligible_amount: "50000.00", min_margin_percent: "15.00", status: "active" },
        { id: "c-2", code: "PROAUDIO25USD", name: "25 USD Off", currency: "USD", discount_type: "fixed_amount", discount_value: "25.00", used_count: 2, max_total_uses: 20, accumulation_rule: "allow_with_promotion", min_eligible_amount: "150.00", min_margin_percent: "12.00", status: "active" },
      ],
    }
  }
  if (url.includes("/admin/cms/versions/")) {
    return {
      results: [
        { id: "ver-2", version_number: 2, status: "draft", change_summary: "Black Friday Audio Pro", checksum_sha256: "b1c2d3e4f5a67890", is_rollback: false, created_by_email: "marketing@levelpro.cl", created_at: "2026-11-24T03:00:00Z" },
        { id: "ver-1", version_number: 1, status: "published", change_summary: "Baseline Oficial", checksum_sha256: "a1b2c3d4e5f60987", is_rollback: false, published_by_email: "gerencia@levelpro.cl", published_at: "2026-11-24T02:00:00Z", created_at: "2026-11-24T01:50:00Z" },
      ],
    }
  }
  if (url.includes("/admin/logistics/overview/")) {
    return {
      kpis: { ready_orders_count: 2, active_shipments_count: 3, open_manifests_count: 1, open_warranties_count: 2, active_repairs_count: 2 },
      ready_orders: [{ id: "ord-1", order_short: "ORD-901A", customer_email: "contacto@estudiomaster.cl", fulfillment_status: "allocated", currency: "CLP", total: "990000.00", shipping_address: "Av. Providencia 1200, Santiago" }],
    }
  }
  return { count: 0, results: [] }
}

const ROUTES_TO_CAPTURE = [
  { path: "/admin", file: "01-dashboard.png" },
  { path: "/admin/products", file: "04-pim-products.png" },
  { path: "/admin/orders", file: "05-orders-oms.png" },
  { path: "/admin/inventory", file: "06-wms-inventory.png" },
  { path: "/admin/procurement", file: "07-procurement.png" },
  { path: "/admin/finance", file: "08-finance.png" },
  { path: "/admin/b2b", file: "09-crm-b2b.png" },
  { path: "/admin/logistics", file: "10-logistics.png" },
  { path: "/admin/marketing", file: "11-marketing.png" },
  { path: "/admin/settings", file: "12-cms-settings.png" },
  { path: "/admin/academy", file: "13-academy.png" },
  { path: "/admin/services", file: "14-services.png" },
  { path: "/admin/loyalty", file: "15-loyalty.png" },
  { path: "/admin/rewards", file: "16-rewards.png" },
]

async function main() {
  const server = await preview({ root: FRONTEND_DIR, preview: { port: 4185, host: "127.0.0.1" } })
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()

    await page.route("**/api/v1/**", async (route) => {
      const data = SYNTHETIC_API_MOCKS(route.request().url())
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) })
    })

    await page.addInitScript(() => {
      sessionStorage.setItem("levelproaudio-auth", JSON.stringify({
        state: { isAuthenticated: true, user: { id: "u1", email: "admin@levelpro.cl", is_staff: true, is_superuser: true, roles: ["Super Admin"] } },
        version: 0,
      }))
      document.cookie = "csrftoken=mockcsrftoken; path=/"
    })

    for (const r of ROUTES_TO_CAPTURE) {
      await page.goto(`http://127.0.0.1:4185${r.path}`, { waitUntil: "networkidle" })
      await page.waitForTimeout(250)
      await page.screenshot({ path: path.join(OUT_DIR, r.file), fullPage: true })
    }

    // Capture Command Palette (02) and Notifications (03) on /admin
    await page.goto("http://127.0.0.1:4185/admin", { waitUntil: "networkidle" })
    await page.waitForTimeout(200)
    const searchBtn = page.locator('[data-testid="admin-search-btn"]')
    if (await searchBtn.count()) {
      await searchBtn.click()
      await page.waitForTimeout(150)
      const inp = page.locator('[data-testid="admin-command-palette-input"]')
      if (await inp.count()) {
        await inp.fill("RME")
        await page.waitForTimeout(350)
      }
      await page.screenshot({ path: path.join(OUT_DIR, "02-command-palette.png"), fullPage: false })
      await page.keyboard.press("Escape")
    }

    const bellBtn = page.locator('[data-testid="admin-notifications-btn"]')
    if (await bellBtn.count()) {
      await bellBtn.click()
      await page.waitForTimeout(200)
      await page.screenshot({ path: path.join(OUT_DIR, "03-notifications.png"), fullPage: false })
    }

    console.log(`GATE13_${MODE.toUpperCase()}_SCREENSHOTS_OK: 16`)
  } finally {
    await browser.close()
    await server.httpServer.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
