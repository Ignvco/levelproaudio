import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { preview } from "vite"
import { chromium } from "playwright"

const OUT_DIR = "/Users/levelproaudio/.gemini/antigravity/brain/11ba077a-d7d1-492e-b2b9-3bee19137a13"
const CHROME_PATH = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

const MOCK_ORGS = [
  {
    id: "org-g8-1",
    code: "ORG-20261123-0001",
    legal_name: "Estudio Mastering Sur SpA",
    trade_name: "Mastering Sur",
    customer_type: "studio",
    country: "CL",
    tax_id: "11111111-1",
    tax_id_validated: true,
    commercial_segment: "pro_studio",
    preferred_currencies: ["CLP", "USD"],
    billing_email: "contacto@masteringsur.test",
    phone: "+56900000001",
    contacts_count: 2,
    is_active: true,
  },
]

const MOCK_CUSTOMERS = [
  {
    id: "cus-g8-1",
    code: "CUS-20261123-0001",
    full_name: "Ingeniero Demo Sur",
    email: "demo.sur@masteringsur.test",
    phone: "+56900000001",
    country: "CL",
    tax_id: "11111111-1",
    tax_id_validated: true,
    commercial_segment: "pro_studio",
    preferred_currency: "CLP",
    is_company_account: true,
    organization_id: "org-g8-1",
    organization_name: "Estudio Mastering Sur SpA",
    sales_rep_email: "ventas@levelpro.cl",
    internal_notes: "Cliente técnico prioritario.",
    is_active: true,
    created_at: "2026-11-23T09:00:00Z",
  },
]

const MOCK_360 = {
  identity: {
    entity_type: "customer",
    id: "cus-g8-1",
    code: "CUS-20261123-0001",
    full_name: "Ingeniero Demo Sur",
    email: "demo.sur@masteringsur.test",
    phone: "+56900000001",
    country: "CL",
    tax_id: "11111111-1",
    tax_id_validated: true,
    commercial_segment: "pro_studio",
    sales_rep_email: "ventas@levelpro.cl",
    authorized_notes: "Sala Atmos calibrada",
    internal_notes: "Margen objetivo 32%",
  },
  technical_profile: {
    primary_activity: "Mastering & Postproducción",
    facility_type: "Estudio Comercial",
    primary_daw: "Pro Tools Ultimate",
    monitors: ["Genelec 8351B", "Genelec 8030C"],
    brands_of_interest: ["Genelec", "Neumann"],
    future_needs: "Expansión 7.1.4",
  },
  history_360: {
    orders: [{ id: "ord-g8-1111-2222", currency: "CLP", total: "1190000.00", status: "paid" }],
    draft_orders: [],
    b2b_quotes: [{ id: "qte-g8-1", quote_number: "QTE-20261123-0001", status: "approved", currency: "CLP", total: "595000.00" }],
    rmas: [],
    academy_enrollments: [],
    service_bookings: [],
    service_requests: [],
    loyalty: { points_balance: 450, tier: "Pro" },
    rewards: { entries_count: 1, wins_count: 0 },
  },
  interactions: [
    { id: "int-1", interaction_type: "opportunity", subject: "Upgrade monitores sala B", sales_rep_email: "ventas@levelpro.cl", created_at: "2026-11-23T09:30:00Z" },
  ],
  credit_accounts: [],
}

const MOCK_PRICE_LISTS = [
  {
    id: "pl-g8-1",
    code: "PL-PRO-2026",
    name: "Tarifa Estudios Pro & Tramos",
    currency: "CLP",
    country: "CL",
    status: "active",
    scope: "segment",
    applicable_segment: "pro_studio",
    priority: 10,
    version: 1,
    min_margin_percent: "15.00",
    items: [
      {
        id: "pli-1",
        product_id: "prod-g8-1",
        product_name: "Genelec 8030C Studio Monitor",
        sku: "GEN-8030C",
        pricing_mode: "fixed_price",
        fixed_price: "95000.00",
        discount_percent: "5.00",
        tiers: [
          { min_quantity: 1, max_quantity: 4, tier_price: "95000.00" },
          { min_quantity: 5, max_quantity: 9, tier_price: "90000.00" },
          { min_quantity: 10, max_quantity: null, tier_price: "85000.00" },
        ],
      },
    ],
  },
]

const MOCK_QUOTES = [
  {
    id: "qte-g8-1",
    quote_number: "QTE-20261123-0001",
    company_name: "Estudio Mastering Sur SpA",
    tax_id: "11111111-1",
    contact_name: "Ingeniero Demo Sur",
    email: "demo.sur@masteringsur.test",
    phone: "+56900000001",
    currency: "CLP",
    subtotal: "500000.00",
    discount_amount: "0.00",
    discount_percent: "0.00",
    tax_amount: "95000.00",
    total: "595000.00",
    status: "approved",
    items_count: 1,
    client_notes: "Entrega en sala B",
    admin_notes: "Aprobado por Gerencia",
    created_at: "2026-11-23 10:00",
    items: [
      { id: "qi-1", product_id: "prod-g8-1", product_name: "Genelec 8030C Studio Monitor", unit_price: "100000.00", quantity: 5, subtotal: "500000.00" },
    ],
  },
]

const MOCK_CREDIT = [
  {
    id: "cred-g8-1",
    organization_id: "org-g8-1",
    organization_code: "ORG-20261123-0001",
    organization_name: "Mastering Sur",
    currency: "CLP",
    status: "active",
    payment_terms: "net_30",
    policy_acknowledged: true,
    credit_limit: "2000000.00",
    committed_exposure: "595000.00",
    paid_confirmed: "0.00",
    available_credit: "1405000.00",
    utilization_percent: "29.75",
    is_usable: true,
  },
]

test("Gate 8 CRM & B2B Visual Evidence [Mocked API Fixtures — 10 Capturas]", async () => {
  const server = await preview({ configFile: false, preview: { port: 0, host: "127.0.0.1" } })
  const addr = server.httpServer.address()
  const baseUrl = `http://127.0.0.1:${addr.port}`
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  })

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 920 } })
    const page = await context.newPage()

    await page.addInitScript(() => {
      document.cookie = "csrftoken=mock-csrf; path=/"
      sessionStorage.setItem("levelproaudio-auth", JSON.stringify({
        state: { isAuthenticated: true, user: { id: "u1", email: "admin@levelpro.cl", is_staff: true, is_superuser: true } },
        version: 0,
      }))
    })

    await page.route("**/api/v1/**", async (route) => {
      const url = route.request().url()
      const method = route.request().method()
      const json = (data, status = 200) =>
        route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) })

      if (url.includes("/users/me/") || url.includes("/auth/me/") || url.includes("/auth/profile/")) {
        return json({ id: "usr-admin-1", email: "admin@levelpro.cl", is_staff: true, is_superuser: true, roles: ["Super Admin"], effective_modules: ["dashboard", "orders", "finances", "roles"] })
      }
      if (url.includes("/admin/rbac/me")) {
        return json({ roles: ["Super Admin"], is_superuser: true, modules: ["orders", "finances", "roles"], capabilities: { view_costs: true, view_margins: true, manage_finances: true, edit_prices: true, apply_discounts: true } })
      }
      if (url.includes("/admin/users/")) {
        return json({ results: [{ id: "usr-1", email: "demo.sur@masteringsur.test", first_name: "Ingeniero", last_name: "Sur", roles: [], orders_count: 1, date_joined: "2026-11-01T10:00:00Z" }], count: 1 })
      }
      if (url.includes("/admin/roles/")) return json({ results: [{ name: "Super Admin" }, { name: "Ventas" }] })
      if (url.includes("/admin/crm/customers/cus-g8-1/360/")) return json(MOCK_360)
      if (url.includes("/admin/crm/customers/")) return json({ results: MOCK_CUSTOMERS, count: 1 })
      if (url.includes("/admin/crm/organizations/")) return json({ results: MOCK_ORGS, count: 1 })
      if (url.includes("/admin/b2b/price-lists/resolve/")) {
        return json({ currency: "CLP", quantity: 5, catalog_unit_price: "100000.00", b2b_proposed_price: "90000.00", discount_percent: "10.00", pricing_source: "PL-PRO-2026:v1:tier_5_9" })
      }
      if (url.includes("/admin/b2b/price-lists/")) return json({ results: MOCK_PRICE_LISTS, count: 1 })
      if (url.includes("/admin/b2b/credit-accounts/")) return json({ results: MOCK_CREDIT, count: 1 })
      if (url.includes("/admin/b2b/quotes/qte-g8-1/pdf/")) {
        return json({ quote_id: "qte-g8-1", quote_number: "QTE-20261123-0001", version: 1, design_variant: "classic_corporate", sha256_checksum: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", file_size_bytes: 2450, generated_at: "2026-11-23T10:05:00Z" })
      }
      if (url.includes("/admin/b2b/quotes/qte-g8-1/") && method === "GET") return json(MOCK_QUOTES[0])
      if (url.includes("/admin/b2b/quotes/")) return json({ results: MOCK_QUOTES, count: 1 })
      if (url.includes("/admin/products/")) {
        return json({ results: [{ id: "prod-g8-1", sku: "GEN-8030C", name: "Genelec 8030C Studio Monitor", price: "100000.00" }], count: 1 })
      }
      return json({ results: [] })
    })

    // 1. CRM Dashboard
    await page.goto(`${baseUrl}/admin/users`, { waitUntil: "domcontentloaded" })
    await page.waitForSelector('[data-testid="admin-users-page"]', { timeout: 15000 })
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(OUT_DIR, "gate8-01-crm-dashboard.png"), fullPage: true })

    // 2. Directorio de clientes y organizaciones
    await page.click('[data-testid="crm-tab-organizations"]')
    await page.waitForSelector('[data-testid="crm-organizations-table"]', { timeout: 10000 })
    await page.screenshot({ path: path.join(OUT_DIR, "gate8-02-crm-directory-orgs.png"), fullPage: true })

    // 3. Ficha 360°
    await page.click('[data-testid="crm-tab-crm"]')
    await page.waitForSelector('[data-testid="open-360-cus-g8-1"]', { timeout: 10000 })
    await page.click('[data-testid="open-360-cus-g8-1"]')
    await page.waitForSelector('[data-testid="crm-360-drawer"]', { timeout: 10000 })
    await page.screenshot({ path: path.join(OUT_DIR, "gate8-03-crm-ficha-360.png"), fullPage: true })

    // 4. Perfil técnico de estudio
    await page.locator('[data-testid="crm-technical-profile-card"]').scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(OUT_DIR, "gate8-04-crm-technical-profile.png"), fullPage: true })
    await page.click('[data-testid="close-360-btn"]')

    // 5. Listas de precios B2B
    await page.goto(`${baseUrl}/admin/b2b`, { waitUntil: "domcontentloaded" })
    await page.waitForSelector('[data-testid="admin-b2b-page"]', { timeout: 15000 })
    await page.click('[data-testid="b2b-tab-pricelists"]')
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(OUT_DIR, "gate8-05-b2b-price-lists.png"), fullPage: true })

    // 6. Tramos mayoristas (Modal nueva lista con tramos)
    await page.click('[data-testid="new-pricelist-btn"]')
    await page.waitForTimeout(250)
    await page.screenshot({ path: path.join(OUT_DIR, "gate8-06-b2b-volume-tiers.png"), fullPage: true })
    await page.keyboard.press("Escape")

    // 7. Generador de cotizaciones
    await page.click('[data-testid="b2b-tab-builder"]')
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(OUT_DIR, "gate8-07-b2b-quote-generator.png"), fullPage: true })

    // 8. Historial de cotizaciones
    await page.click('[data-testid="b2b-tab-quotes"]')
    await page.waitForSelector('[data-testid="b2b-quotes-table"]', { timeout: 10000 })
    await page.screenshot({ path: path.join(OUT_DIR, "gate8-09-b2b-quote-history.png"), fullPage: true })

    // 9. Vista previa de PDF
    await page.click('[data-testid="open-quote-qte-g8-1"]')
    await page.waitForSelector('[data-testid="b2b-pdf-preview-card"]', { timeout: 10000 })
    await page.click('[data-testid="b2b-pdf-preview-btn"]')
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(OUT_DIR, "gate8-08-b2b-pdf-preview.png"), fullPage: true })
    await page.keyboard.press("Escape")

    // 10. Cuentas de crédito y aprobaciones
    await page.click('[data-testid="b2b-tab-credit"]')
    await page.waitForSelector('[data-testid="credit-accounts-list"]', { timeout: 10000 })
    await page.screenshot({ path: path.join(OUT_DIR, "gate8-10-b2b-credit-accounts.png"), fullPage: true })

    for (let i = 1; i <= 10; i++) {
      const files = fs.readdirSync(OUT_DIR).filter(f => f.startsWith(`gate8-${String(i).padStart(2, "0")}-`))
      assert.equal(files.length, 1, `Missing screenshot ${i}`)
    }
  } finally {
    await browser.close()
    server.httpServer.close()
  }
})
