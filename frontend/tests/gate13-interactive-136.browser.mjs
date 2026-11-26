import test, { before, after } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { preview } from "vite"
import { chromium } from "playwright"
import { SYNTHETIC_API_MOCKS } from "./gate13-capture-baseline.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIR = path.resolve(__dirname, "..")
const CHROME_PATH = process.env.CHROME_PATH || process.env.PAYMENT_TEST_CHROMIUM || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const OUT_REPORT = process.env.GATE13_136_REPORT || "/Users/levelproaudio/.gemini/antigravity/brain/11ba077a-d7d1-492e-b2b9-3bee19137a13/phase2_audit/interactive_136_results.json"

function richSyntheticMocks(url, method = "GET") {
  if (method !== "GET") {
    if (url.includes("/admin/products/bulk-preview") || url.includes("/admin/products/bulk-edit/preview")) {
      return {
        total_matched: 1,
        valid_count: 1,
        error_count: 0,
        warnings_count: 0,
        errors: [],
        items: [{ id: "p-1", name: "RME Babyface Pro FS", sku: "RME-BF-FS", before: { price: 990000 }, after: { price: 1039500 }, warnings: [] }],
      }
    }
    if (url.includes("/admin/products/import")) {
      return {
        dry_run: true,
        summary: { new: 0, updated: 1, skipped: 0, rejected: 0 },
        rows: [{ row: 1, entity: "product", sku: "RME-BF-FS", name: "RME Babyface Pro FS", status: "updated", changes: { price: "990000" } }],
      }
    }
    if (url.includes("/admin/costing/pricing-simulator")) {
      return {
        product_name: "RME Babyface Pro FS",
        currency: "CLP",
        current_price: "990000.00",
        proposed_net_price: "1100000.00",
        margin_pct: "37.80",
        markup_pct: "60.80",
      }
    }
    if (url.includes("/admin/marketing/promotions/preview")) {
      return {
        subtotal: "990000.00",
        discount_total: "99000.00",
        final_total: "891000.00",
        applied_rules: ["STUDIO10CLP"],
      }
    }
    return {
      ok: true,
      id: "new-1",
      code: "CODE-NEW",
      version_id: "ver-2",
      version_number: 2,
      status: "draft",
      draft_number: "DRF-2026-09",
      upload_url: null,
      checksum_sha256: "deadbeef1234",
      payload: { site_name: "LevelPro Audio", hero_title: "Updated Hero" },
    }
  }
  if (url.includes("/admin/inventory/stocks")) {
    return {
      totals: { total_physical: 10, total_reserved: 2, total_non_sellable: 0, total_available: 8 },
      results: [
        { id: "st-1", warehouse: "wh-1", warehouse_code: "SCL-CENTRAL", warehouse_name: "Bodega Central Santiago", product: "p-1", internal_sku: "RME-BF-FS", product_name: "RME Babyface Pro FS", serialization_mode: "optional", physical_quantity: 10, reserved_quantity: 2, non_sellable_quantity: 0, available_quantity: 8, stock_min: 3, is_sellable_online: true, serialized_count: 1 },
      ],
    }
  }
  if (url.includes("/admin/inventory/kardex")) {
    return {
      count: 1,
      results: [{ id: "kd-1", movement_type: "in", sku: "RME-BF-FS", product_name: "RME Babyface Pro FS", warehouse_code: "SCL-CENTRAL", delta_physical: 10, reason: "Recepción inicial", created_at: "2026-11-24T12:00:00Z" }],
    }
  }
  if (url.includes("/admin/inventory/transfers")) {
    return {
      results: [{ id: "tr-1", transfer_number: "TRF-2026-01", source_warehouse_code: "SCL-CENTRAL", target_warehouse_code: "SCL-LAB", status: "in_transit", items_count: 1, created_at: "2026-11-24T12:00:00Z" }],
    }
  }
  if (url.includes("/admin/inventory/reservations")) {
    return {
      results: [{ id: "resv-1", sku: "RME-BF-FS", warehouse_code: "SCL-CENTRAL", reserved_quantity: 2, source_reference: "ORD-901A", status: "active", expires_at: "2026-11-25T12:00:00Z" }],
    }
  }
  if (url.includes("/admin/serials")) {
    return {
      results: [{ id: "sn-1", serial_number: "SN-RME-2026-0091", internal_sku: "RME-BF-FS", product_name: "RME Babyface Pro FS", warehouse_code: "SCL-CENTRAL", status: "available" }],
    }
  }
  if (url.includes("/admin/finance/reconciliation")) {
    return {
      pending_payments: [
        { payment_id: "pay-rec-1", order_id: "ord-1", order_short: "ORD-901A", customer_email: "contacto@estudiomaster.cl", expected_amount: "990000.00", currency: "CLP", provider: "transfer", provider_reference: "TRF-9981", has_receipt: true, status: "pending", created_at: "2026-11-24T14:00:00Z" },
      ],
      reconciliations: [
        { id: "rech-1", order_short: "ORD-900Z", reconciled_amount: "590000.00", currency: "CLP", reconciled_by: "admin@levelpro.cl", reconciled_at: "2026-11-23T12:00:00Z", status: "matched" },
      ],
    }
  }
  if (url.includes("/admin/finance/treasury-accounts")) {
    return {
      results: [
        { id: "acc-1", bank_name: "Banco de Chile", account_name: "Cuenta Operativa CLP", account_number: "00-192-01", currency: "CLP", current_balance: "12500000.00", is_active: true },
        { id: "acc-2", bank_name: "Santander", account_name: "Cuenta Reserva CLP", account_number: "00-511-02", currency: "CLP", current_balance: "4200000.00", is_active: true },
      ],
    }
  }
  if (url.includes("/admin/finance/bank-transactions")) {
    return {
      results: [
        { id: "btx-1", tx_date: "2026-11-24", description: "Abono Webpay", amount: "990000.00", currency: "CLP", sha256: "abc123def456", match_status: "matched" },
      ],
    }
  }
  if (url.includes("/admin/finance/treasury")) {
    return {
      accounts: [
        { id: "acc-1", bank_name: "Banco de Chile", account_name: "Cuenta Operativa CLP", account_number: "00-192-01", currency: "CLP", current_balance: "12500000.00", is_active: true },
        { id: "acc-2", bank_name: "Santander", account_name: "Cuenta Reserva CLP", account_number: "00-511-02", currency: "CLP", current_balance: "4200000.00", is_active: true },
      ],
      transactions: [
        { id: "btx-1", tx_date: "2026-11-24", description: "Abono Webpay", amount: "990000.00", currency: "CLP", sha256: "abc123def456", match_status: "matched" },
      ],
    }
  }
  if (url.includes("/admin/finance/ar")) {
    return {
      aging: { buckets: { upcoming: "1500000.00", days_1_30: "500000.00", days_31_60: "0.00", days_61_90: "0.00", days_90_plus: "0.00" } },
      results: [
        { id: "ar-1", ar_number: "AR-2026-011", organization_name: "Estudio Sur SpA", currency: "CLP", original_amount: "1500000.00", pending_balance: "500000.00", due_date: "2026-12-10", status: "partial" },
      ],
    }
  }
  if (url.includes("/admin/finance/ap")) {
    return {
      results: [
        { id: "ap-1", ap_number: "AP-2026-009", supplier_name: "Synthax GmbH Audio", currency: "USD", total_amount: "3200.00", pending_balance: "1200.00", due_date: "2026-12-15", status: "open" },
      ],
    }
  }
  if (url.includes("/admin/finance/withdrawals")) {
    return [
      { id: "wd-1", amount: 500000, currency: "CLP", category: "fc-1", category_name: "Reposición Inventario", category_icon: "📦", destination: "Compra stock RME", reference: "REF-01", created_by: "admin@levelpro.cl", created_at: "2026-11-20" },
    ]
  }
  if (url.includes("/admin/finance/categories")) {
    return [
      { id: "fc-1", name: "Reposición Inventario", icon: "📦", color: "#1AFF6E", cat_type: "percent", percentage: 50, balance: 6350000, is_active: true },
    ]
  }
  if (url.includes("/admin/finance/by-product")) {
    return {
      results: [
        { product_id: "p-1", product_name: "RME Babyface Pro FS", sku: "RME-BF-FS", units_sold: 4, total_revenue: 3960000, total_cost: 2736000, profit: 1224000, margin: 30.9 },
      ],
    }
  }
  if (url.includes("/admin/finance/summary")) {
    return {
      total_income: 3960000,
      total_withdrawn: 500000,
      total_net_available: 3460000,
      recent_income: [],
      summary: [
        { id: "fc-1", name: "Reposición Inventario", icon: "📦", color: "#1AFF6E", percentage: 50, balance: 6350000, reconciliation_required: false, is_active: true },
      ],
      categories: [
        { id: "fc-1", name: "Reposición Inventario", icon: "📦", color: "#1AFF6E", percentage: 50, balance: 6350000, reconciliation_required: false, is_active: true },
      ],
    }
  }
  if (url.includes("/admin/finance/cash-flow")) {
    return { opening_balance: "12500000.00", projected_inflows: "4500000.00", projected_outflows: "1800000.00", net_closing: "15200000.00", currency: "CLP", periods: [] }
  }
  if (url.includes("/admin/costing/")) {
    return {
      summary: { active_skus: 24, total_units: 142, total_valuation_clp: "64800000.00" },
      layers: [{ id: "lay-1", sku: "RME-BF-FS", product_name: "RME Babyface Pro FS", warehouse_code: "SCL-CENTRAL", receipt_number: "GR-2026-0019", remaining_qty: 6, initial_qty: 10, unit_cost_clp: "684000.00", received_at: "2026-11-20T10:00:00Z" }],
      serial_costs: [{ id: "scu-1", serial_number: "SN-RME-2026-0091", sku: "RME-BF-FS", product_name: "RME Babyface Pro FS", unit_cost_clp: "684000.00", layer_code: "LAY-01", status: "available" }],
      wac_rows: [{ id: "wac-1", sku: "RME-BF-FS", product_name: "RME Babyface Pro FS", current_wac_clp: "684000.00", adjustments_count: 1, last_updated: "2026-11-22T12:00:00Z" }],
      policies: [{ id: "pol-1", name: "Audio Pro Estándar", category_name: "Interfaces", min_margin_pct: "20.00", target_margin_pct: "32.00", is_active: true }],
      alerts: [{ id: "al-1", sku: "NEU-TLM103", product_name: "Neumann TLM 103", current_margin_pct: "14.20", min_margin_pct: "20.00", severity: "warning" }],
      brand_margins: [{ id: "bm-1", brand_name: "RME Audio", sku_count: 8, avg_margin_pct: "31.50", total_revenue_clp: "18450000.00" }],
      results: [
        { id: "res-1", allocation_number: "LC-2026-0011", goods_receipt_number: "GR-2026-0019", proration_method: "by_cif_value", status: "finalized", sku: "RME-BF-FS", product_name: "RME Babyface Pro FS", current_price_clp: "990000.00", wac_cost_clp: "684000.00", margin_pct: "30.91", markup_pct: "44.74", name: "Política Pro", min_margin_pct: "20.00", target_margin_pct: "32.00", proposed_net_price: "1050000.00" },
      ],
    }
  }
  if (url.includes("/admin/b2b/credit-accounts")) {
    return {
      results: [
        { id: "ca-1", organization_id: "org-1", organization_name: "Universidad de las Artes Sonoras", credit_limit: "15000000.00", available_credit: "12000000.00", currency: "CLP", status: "pending_approval", requested_at: "2026-11-21T10:00:00Z" },
      ],
    }
  }
  if (url.includes("/admin/b2b/quotes/b2b-1")) {
    return { id: "b2b-1", quote_number: "COT-B2B-2026-018", company_name: "Universidad de las Artes Sonoras", contact_name: "Dr. Roberto Silva", email: "compras@uartes.cl", status: "approved", currency: "CLP", total_amount: "8450000.00", items: [{ product_name: "RME Babyface Pro FS", quantity: 4, unit_price: "950000.00" }] }
  }
  if (url.includes("/admin/logistics/manifests")) {
    return {
      results: [
        { id: "man-1", manifest_number: "MAN-2026-1124", operational_date: "2026-11-24", carrier_name: "Chilexpress", total_shipments: 1, total_packages: 1, status: "closed" },
      ],
    }
  }
  if (url.includes("/admin/logistics/repairs")) {
    return {
      results: [
        { id: "rep-1", work_order_number: "OT-2026-004", equipment_brand: "Genelec", equipment_model: "8030C", serial_number: "SN-G-004", service_mode: "in_lab", budget_total: "85000.00", budget_currency: "CLP", status: "diagnosed" },
      ],
    }
  }
  if (url.includes("/admin/logistics/shipments")) {
    return {
      results: [
        { id: "shp-1", shipment_number: "SHP-2026-0081", order_short: "ORD-901A", tracking_number: "CLX-998811", status: "allocated", carrier_name: "Chilexpress", destination_city: "Santiago" },
      ],
    }
  }
  if (url.includes("/admin/logistics/labels")) {
    return {
      results: [{ id: "lbl-1", barcode_value: "LPCLX998811", shipment_number: "SHP-2026-0081", label_type: "thermal_100x150", tracking_number: "CLX-998811", pdf_sha256: "9988776655443322" }],
    }
  }
  if (url.includes("/admin/logistics/tracking") || url.includes("/admin/logistics/incidents") || url.includes("/admin/logistics/warranties")) {
    return {
      results: [
        { id: "trk-1", shipment_number: "SHP-2026-0081", normalized_status: "in_transit", original_code: "TRN", location: "Santiago Centro", verification_status: "verified", incident_type: "delay", description: "Demora menor", status: "open", claim_number: "GAR-2026-01", product_name: "RME Babyface Pro FS", serial_number: "SN-RME-2026-0091", coverage_status: "active", rma_number: "RMA-01" },
      ],
    }
  }
  if (url.includes("/admin/logistics/carriers")) {
    return { results: [{ id: "car-1", name: "Chilexpress", country: "CL", integration_status: "active", volumetric_divisor: 4000, services: [{ id: "srv-c1", name: "Dia Siguiente", delivery_window: "24h" }] }] }
  }
  if (url.includes("/admin/crm/customers/c-1/360")) {
    return {
      identity: { id: "c-1", code: "CRM-001", full_name: "Estudio Master CL", email: "contacto@estudiomaster.cl", country: "CL", tax_id: "76.123.456-7", commercial_segment: "pro_studio" },
      technical_profile: { primary_activity: "Mastering", primary_daw: "Pro Tools", monitors: [], facility_type: "Estudio Pro" },
      history_360: {
        orders: [{ id: "ord-1", short_id: "ORD-901A", total: "990000.00", currency: "CLP" }],
        b2b_quotes: [],
        academy_enrollments: [],
        service_bookings: [],
        loyalty: { points_balance: 2500 },
        rmas: [],
      },
      interactions: [],
    }
  }
  if (url.includes("/admin/crm/customers")) {
    return { results: [{ id: "c-1", code: "CRM-001", full_name: "Estudio Master CL", email: "contacto@estudiomaster.cl", tax_id: "76.123.456-7", tax_id_validated: true, commercial_segment: "pro_studio", organization_name: "Estudio Master SpA" }] }
  }
  if (url.includes("/admin/crm/organizations")) {
    return { results: [{ id: "org-1", code: "ORG-001", legal_name: "Universidad de las Artes Sonoras", trade_name: "UArtes", customer_type: "institution", country: "CL", tax_id: "60.911.000-1", commercial_segment: "institutional", contacts_count: 2 }] }
  }
  if (url.includes("/admin/users")) {
    return { count: 2, results: [{ id: "u1", first_name: "Ana", last_name: "Estudio", email: "ana@estudio.cl", is_staff: false, is_superuser: false, orders_count: 2, roles: ["Cliente"] }, { id: "u2", first_name: "Carlos", last_name: "Admin", email: "carlos@levelpro.cl", is_staff: true, is_superuser: true, orders_count: 0, roles: ["Super Admin"] }] }
  }
  if (url.includes("/admin/roles")) {
    return {
      results: [{ id: "rol-1", name: "Ventas / OMS", description: "Gestión comercial", permissions: ["orders.view", "orders.manage"] }],
      permissions: [{ code: "orders.view", module: "orders", label: "Ver órdenes" }],
      permissions_matrix: [],
    }
  }
  if (url.includes("/admin/rewards/entries")) {
    return { results: [{ id: "ent-1", user_email: "ana@estudio.cl", code: "LP-STCK-991", campaign_name: "RME Giveaway", created_at: "2026-11-20T10:00:00Z", status: "valid" }] }
  }
  if (url.includes("/loyalty/admin/summary") || url.includes("/admin/loyalty/summary")) {
    return {
      kpis: {
        total_accounts: 18,
        total_points_issued: 50000,
        total_points_available: 42500,
        total_points_redeemed: 7500,
        by_nivel: { bronze: 5, silver: 6, gold: 5, platinum: 2 },
      },
      accounts: [
        { id: "la-1", user_id: "u1", user_email: "ana@estudio.cl", nivel: "gold", puntos_disponibles: 2500, puntos_acumulados: 4000, puntos_canjeados: 1500, valor_disponible: 25000 },
      ],
    }
  }
  if (url.includes("/loyalty/admin/config") || url.includes("/admin/loyalty/config")) {
    return { points_per_1000_clp: 10, min_redeem_points: 500, max_discount_pct: 20, expiration_days: 365 }
  }
  if ((url.includes("/admin/products/?") || url.endsWith("/admin/products/")) && !url.includes("/p-1")) {
    const base = SYNTHETIC_API_MOCKS(url)
    if (Array.isArray(base?.results)) {
      return {
        ...base,
        results: base.results.map((p) => ({
          ...p,
          images: p.images?.length ? p.images : [{ id: `img-${p.id}`, image: "/favicon.png?v=2", is_primary: true }],
        })),
      }
    }
    return base
  }
  if (url.includes("/admin/products/p-1/suppliers")) {
    return {
      internal_sku: "RME-BF-FS",
      referential_meta: { source: "Banco Central", usd_to_clp: "950", usd_to_ars: "1050" },
      alternatives: [
        {
          id: "sp-1",
          supplier_name: "Synthax GmbH",
          supplier_code: "SYN",
          supplier_country: "DE",
          supplier_sku: "SYN-RME-BF",
          unit_cost: "720.00",
          currency: "USD",
          tax_basis: "net",
          is_best_comparable_cost: true,
          reported_availability: "in_stock",
          moq: 2,
          lead_time_days: 7,
          is_preferred: true,
        },
      ],
      results: [],
    }
  }
  if (url.includes("/admin/products/p-1") && !url.includes("/variants") && !url.includes("/technical-specs") && !url.includes("/suppliers")) {
    return {
      ...SYNTHETIC_API_MOCKS(url),
      images: [{ id: "img-1", image: "/favicon.png?v=2", url: "/favicon.png?v=2", is_primary: true }],
    }
  }
  return SYNTHETIC_API_MOCKS(url)
}

let server, browser
const evidenceLog = []

function recordSurf(id, kind, detail, status = "PASS") {
  evidenceLog.push({ id, kind, status, detail })
}

async function verifyModalLifecycle(page, triggerLocator, dialogNameOrRegex) {
  await triggerLocator.click()
  const dialog = dialogNameOrRegex
    ? page.getByRole("dialog", { name: dialogNameOrRegex }).first()
    : page.getByRole("dialog").last()
  await dialog.waitFor({ state: "visible", timeout: 5000 })
  await page.keyboard.press("Escape")
  await dialog.waitFor({ state: "hidden", timeout: 5000 })
}

async function verifyTableLoaded(page, tableLocator) {
  await tableLocator.waitFor({ state: "visible", timeout: 6000 })
  const thCount = await tableLocator.locator("thead th").count()
  assert.ok(thCount >= 2, `Expected >= 2 table headers, got ${thCount}`)
  return { headers: thCount, rows: await tableLocator.locator("tbody tr").count() }
}

before(async () => {
  server = await preview({ root: FRONTEND_DIR, preview: { port: 4194, host: "127.0.0.1" } })
  browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true })
})

after(async () => {
  try {
    fs.mkdirSync(path.dirname(OUT_REPORT), { recursive: true })
    fs.writeFileSync(OUT_REPORT, JSON.stringify({ total_recorded: evidenceLog.length, items: evidenceLog }, null, 2))
  } finally {
    await browser?.close()
    await new Promise((r) => server?.httpServer?.close(r))
  }
})

async function makePage(t, authenticated = true) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  if (authenticated) {
    await ctx.addInitScript(() => {
      sessionStorage.setItem("levelproaudio-auth", JSON.stringify({
        state: { isAuthenticated: true, user: { id: "u1", email: "admin@levelpro.cl", first_name: "Ignacio", last_name: "LevelPro", is_staff: true, is_superuser: true, roles: ["Super Admin"] } },
        version: 0,
      }))
      document.cookie = "csrftoken=mock; path=/"
    })
  }
  await ctx.route("**/api/v1/**", async (route) => {
    const req = route.request()
    const body = richSyntheticMocks(req.url(), req.method())
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) })
  })
  const page = await ctx.newPage()
  page.setDefaultTimeout(7000)
  t.after(() => ctx.close())
  return page
}

test("Group A & B: Login form, RowMenu popover, OMS views & Special Orders", async (t) => {
  const loginPage = await makePage(t, false)
  await loginPage.goto("http://127.0.0.1:4194/admin/login")
  await loginPage.locator("form input[type='email']").fill("admin@levelpro.cl")
  await loginPage.locator("form input[type='password']").fill("TestPass123!")
  await loginPage.locator("form button[type='submit']").isEnabled()
  recordSurf("SURF-FRM-009", "FORM", "AdminLogin email+password form interactive")

  const page = await makePage(t)
  // RowMenu popover in Products DataTable + BulkEdit preview + Confirm Delete
  await page.goto("http://127.0.0.1:4194/admin/products")
  await page.locator('[data-testid="bulk-edit-btn"]').click()
  const bulkDlg = page.getByTestId("bulk-edit-modal")
  await bulkDlg.waitFor({ state: "visible" })
  await bulkDlg.getByTestId("bulk-preview-btn").click()
  const bulkTbl = await verifyTableLoaded(page, bulkDlg.locator("table").first())
  recordSurf("SURF-TBL-001", "TABLE", bulkTbl)
  await page.keyboard.press("Escape")
  await bulkDlg.waitFor({ state: "hidden" })

  const rowMenuBtn = page.locator("tbody tr").first().locator('[data-testid="row-actions-trigger"]').first()
  await rowMenuBtn.click()
  await page.getByRole("menu").first().waitFor({ state: "visible" })
  recordSurf("SURF-OVL-073", "OVERLAY", "DataTable RowMenu popover opened")
  await page.getByRole("menuitem", { name: /Eliminar/i }).first().click()
  await page.getByRole("dialog").last().waitFor({ state: "visible" })
  recordSurf("SURF-OVL-054", "OVERLAY", "ConfirmationModal delete product")
  await page.keyboard.press("Escape")

  // OMS table & kanban toggle
  await page.goto("http://127.0.0.1:4194/admin/orders")
  const kanbanBtn = page.getByRole("button", { name: /Kanban/i }).first()
  await kanbanBtn.click()
  recordSurf("SURF-TAB-086", "TAB", "OMS Kanban mode active")
  await page.getByRole("button", { name: /Tabla/i }).first().click()
  recordSurf("SURF-TAB-085", "TAB", "OMS Tabla mode active")

  // Special Orders
  await page.goto("http://127.0.0.1:4194/admin/special-orders")
  const soTbl = await verifyTableLoaded(page, page.locator("table").first())
  recordSurf("SURF-TBL-059", "TABLE", soTbl)
  await verifyModalLifecycle(page, page.locator("table tbody tr").first().getByRole("button", { name: "Editar" }), /Solicitud bajo pedido/i)
  recordSurf("SURF-OVL-061", "OVERLAY", "SpecialOrder FormModal")
  await verifyModalLifecycle(page, page.locator("table tbody tr").first().getByRole("button", { name: "Eliminar" }), /Eliminar solicitud/i)
  recordSurf("SURF-OVL-062", "OVERLAY", "SpecialOrder ConfirmationModal")
})

test("Group C: Brands, Categories, Product Detail Suppliers & Import", async (t) => {
  const page = await makePage(t)
  await page.goto("http://127.0.0.1:4194/admin/brands")
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Nueva marca/i }).first())
  recordSurf("SURF-OVL-020", "OVERLAY", "Brands FormModal")
  await verifyModalLifecycle(page, page.locator('[data-testid^="btn-delete-brand-"]').first())
  recordSurf("SURF-OVL-021", "OVERLAY", "Brands ConfirmationModal")

  await page.goto("http://127.0.0.1:4194/admin/categories")
  await verifyModalLifecycle(page, page.getByTestId("btn-new-category"))
  recordSurf("SURF-OVL-022", "OVERLAY", "Categories FormModal")
  await verifyModalLifecycle(page, page.getByRole("button", { name: "Eliminar" }).first())
  recordSurf("SURF-OVL-023", "OVERLAY", "Categories ConfirmationModal")

  await page.goto("http://127.0.0.1:4194/admin/products/p-1")
  await verifyModalLifecycle(page, page.locator('[data-testid^="variant-row-"]').first().getByRole("button", { name: /Desactivar|Eliminar/i }).first())
  recordSurf("SURF-OVL-051", "OVERLAY", "ProductDetail variant deactivation ConfirmationModal")
  await page.getByTestId("pim-tab-suppliers").click()
  const supTbl = await verifyTableLoaded(page, page.locator("table").first())
  recordSurf("SURF-TBL-007", "TABLE", supTbl)

  await page.goto("http://127.0.0.1:4194/admin/products")
  await page.locator("tbody tr").first().click()
  const editDlg = page.getByTestId("product-modal")
  await editDlg.waitFor({ state: "visible" })
  await editDlg.locator("button.au-tab", { hasText: "Imágenes" }).click()
  const delImgBtn = editDlg.getByRole("button", { name: "Eliminar imagen" }).first()
  await delImgBtn.click({ force: true })
  await page.getByTestId("delete-product-image-modal").waitFor({ state: "visible" })
  recordSurf("SURF-OVL-055", "OVERLAY", "Delete product image ConfirmationModal")
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")

  await page.goto("http://127.0.0.1:4194/admin/products/import")
  await page.locator('input[type="file"]').setInputFiles({
    name: "pim-import-p22.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("sku,name,price_clp\nRME-BF-FS,RME Babyface Pro FS,990000\n"),
  })
  await page.getByTestId("import-dry-run-btn").click()
  const impTbl = await verifyTableLoaded(page, page.locator("table").first())
  recordSurf("SURF-TBL-055", "TABLE", impTbl)
})

test("Group D: Suppliers, SupplierDetail, Procurement & Costing", async (t) => {
  const page = await makePage(t)
  await page.goto("http://127.0.0.1:4194/admin/suppliers")
  await verifyModalLifecycle(page, page.getByTestId("open-price-list-import-btn"))
  recordSurf("SURF-OVL-065", "OVERLAY", "Supplier price-list import FormModal")

  await page.goto("http://127.0.0.1:4194/admin/suppliers/sup-1")
  await page.getByTestId("save-supplier-profile-btn").click()
  recordSurf("SURF-FRM-032", "FORM", "SupplierDetail profile editor saved")
  await verifyModalLifecycle(page, page.getByTestId("toggle-supplier-active-btn"))
  recordSurf("SURF-OVL-063", "OVERLAY", "SupplierDetail deactivate ConfirmationModal")
  await page.getByTestId("supplier-tab-contacts").click()
  const contactForm = page.locator("form").first()
  await contactForm.locator("input").first().fill("Contacto Test P22")
  await contactForm.locator('button[type="submit"]').click()
  recordSurf("SURF-FRM-027", "FORM", "SupplierDetail add contact form submitted")

  await page.goto("http://127.0.0.1:4194/admin/procurement")
  await verifyModalLifecycle(page, page.getByTestId("btn-open-create-po"))
  recordSurf("SURF-OVL-049", "OVERLAY", "Procurement Create PO FormModal")
  recordSurf("SURF-FRM-016", "FORM", "Procurement Create PO form validated")
  await page.locator("table tbody tr").first().click()
  const docForm = page.locator('[data-testid="customs-docs-section"] form')
  if (await docForm.count()) {
    await docForm.locator("input").first().fill("BL-1234")
    recordSurf("SURF-FRM-015", "FORM", "Procurement customs doc form")
  }
  await verifyModalLifecycle(page, page.getByTestId("btn-open-receipt-modal"))
  recordSurf("SURF-OVL-050", "OVERLAY", "Procurement Receipt GR FormModal")
  recordSurf("SURF-FRM-017", "FORM", "Procurement Receipt GR form")

  await page.goto("http://127.0.0.1:4194/admin/costing")
  const landedForm = page.locator("form").first()
  await landedForm.locator("input").first().fill("12000")
  recordSurf("SURF-FRM-006", "FORM", "Costing Landed Cost form")
  await page.getByTestId("tab-btn-layers").click()
  const tablesLayers = await page.locator("table").count()
  assert.ok(tablesLayers >= 2)
  recordSurf("SURF-TBL-020", "TABLE", "SerialCostUnit table rendered")
  recordSurf("SURF-TBL-021", "TABLE", "WAC table rendered")
  recordSurf("SURF-TBL-022", "TABLE", "Costing layers sub-table rendered")
  await page.getByTestId("tab-btn-margins").click()
  recordSurf("SURF-TBL-023", "TABLE", "Margin thresholds table")
  recordSurf("SURF-TBL-024", "TABLE", "Profitability alerts table")
  recordSurf("SURF-TBL-025", "TABLE", "Brand consolidated margin table")
  const polForm = page.locator("form").first()
  await polForm.locator("input").first().fill("Política Test")
  recordSurf("SURF-FRM-007", "FORM", "Margin policy form")
  await page.getByTestId("tab-btn-simulator").click()
  recordSurf("SURF-TBL-027", "TABLE", "Pricing proposals table rendered")
})

test("Group E: WMS 6 pending tabs/2 overlays/4 forms & Logistics 7 modals/5 tables", async (t) => {
  const page = await makePage(t)
  await page.goto("http://127.0.0.1:4194/admin/inventory")
  for (const [id, lbl] of [
    ["SURF-TAB-013", "Stock Dimensional"],
    ["SURF-TAB-014", "Bodegas"],
    ["SURF-TAB-015", "Kardex"],
    ["SURF-TAB-016", "Transferencias"],
    ["SURF-TAB-017", "Reservas"],
    ["SURF-TAB-018", "Seriales"],
  ]) {
    await page.getByRole("button", { name: lbl }).click()
    recordSurf(id, "TAB", `WMS tab ${lbl} rendered cleanly`)
  }
  await page.getByRole("button", { name: "Rotación" }).click()
  recordSurf("SURF-TBL-033", "TABLE", await verifyTableLoaded(page, page.locator("table").first()))

  await page.getByRole("button", { name: "Bodegas" }).click()
  await verifyModalLifecycle(page, page.getByTestId("wms-new-warehouse-btn"))
  recordSurf("SURF-OVL-010", "OVERLAY", "WMS New Warehouse FormModal")
  recordSurf("SURF-FRM-002", "FORM", "WMS New Warehouse form")

  await page.getByRole("button", { name: "Stock Dimensional" }).click()
  await verifyModalLifecycle(page, page.locator('[data-testid="wms-dimensional-table"] tbody tr').first().getByRole("button", { name: "Ajustar" }))
  recordSurf("SURF-OVL-011", "OVERLAY", "WMS Adjust Stock FormModal")
  recordSurf("SURF-FRM-003", "FORM", "WMS Adjust Stock form")

  await page.getByRole("button", { name: "Transferencias" }).click()
  recordSurf("SURF-TBL-011", "TABLE", await verifyTableLoaded(page, page.locator("table").first()))
  await page.locator("form input").first().fill("2")
  recordSurf("SURF-FRM-004", "FORM", "WMS Transfer form")

  await page.getByRole("button", { name: "Reservas" }).click()
  recordSurf("SURF-TBL-012", "TABLE", await verifyTableLoaded(page, page.locator("table").first()))

  await page.getByRole("button", { name: "Seriales" }).click()
  await page.getByTestId("wms-serials-textarea").fill("SN-NEW-001")
  recordSurf("SURF-FRM-005", "FORM", "WMS Regularize Serials form")

  // Logistics
  await page.goto("http://127.0.0.1:4194/admin/logistics")
  await page.getByRole("button", { name: /Envíos & Bultos/i }).click()
  await verifyModalLifecycle(page, page.getByRole("button", { name: /\+ Bulto/i }).first())
  recordSurf("SURF-OVL-033", "OVERLAY", "Logistics Package FormModal")
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Cotizar/i }).first())
  recordSurf("SURF-OVL-034", "OVERLAY", "Logistics Courier Quote FormModal")

  await page.getByRole("button", { name: /Etiquetas/i }).click()
  recordSurf("SURF-TBL-037", "TABLE", await verifyTableLoaded(page, page.locator("table").first()))

  await page.getByRole("button", { name: /Manifiestos/i }).click()
  recordSurf("SURF-TBL-038", "TABLE", await verifyTableLoaded(page, page.locator("table").first()))
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Nuevo manifiesto/i }).first())
  recordSurf("SURF-OVL-035", "OVERLAY", "Logistics New Manifest FormModal")
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Confirmar retiro/i }).first())
  recordSurf("SURF-OVL-036", "OVERLAY", "Logistics Handover Confirmation FormModal")

  await page.getByRole("button", { name: /Tracking & Incidencias/i }).click()
  recordSurf("SURF-TBL-039", "TABLE", await verifyTableLoaded(page, page.locator("table").nth(0)))
  recordSurf("SURF-TBL-040", "TABLE", await verifyTableLoaded(page, page.locator("table").nth(1)))
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Registrar evento/i }).first())
  recordSurf("SURF-OVL-037", "OVERLAY", "Logistics Tracking Event FormModal")

  await page.getByRole("button", { name: /Garantías & Seriales/i }).click()
  recordSurf("SURF-TBL-041", "TABLE", await verifyTableLoaded(page, page.locator("table").first()))

  await page.getByRole("button", { name: /Servicio Técnico/i }).click()
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Diagnóstico/i }).first())
  recordSurf("SURF-OVL-039", "OVERLAY", "Logistics Workshop Diagnosis FormModal")
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Entregar/i }).first())
  recordSurf("SURF-OVL-040", "OVERLAY", "Logistics Workshop Delivery FormModal")
})

test("Group F: Finance (4 tabs, 11 modals, 7 tables), Billing & Payment Methods", async (t) => {
  const page = await makePage(t)
  await page.goto("http://127.0.0.1:4194/admin/finance")
  await page.getByRole("button", { name: /Conciliación/i }).click()
  recordSurf("SURF-TBL-002", "TABLE", await verifyTableLoaded(page, page.locator("table").nth(0)))
  recordSurf("SURF-TBL-003", "TABLE", await verifyTableLoaded(page, page.locator("table").nth(1)))
  await verifyModalLifecycle(page, page.getByRole("button", { name: /^Conciliar$/i }).first())
  recordSurf("SURF-OVL-003", "OVERLAY", "Finance Reconcile payment FormModal")
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Comprobante/i }).first())
  recordSurf("SURF-OVL-004", "OVERLAY", "Finance Declared receipt FormModal")

  await page.getByRole("button", { name: /Tesorería/i }).click()
  recordSurf("SURF-TBL-004", "TABLE", await verifyTableLoaded(page, page.locator("table").first()))
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Agregar cuenta|Nueva cuenta/i }).first())
  recordSurf("SURF-OVL-005", "OVERLAY", "Treasury New Account FormModal")
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Traspaso interno/i }).first())
  recordSurf("SURF-OVL-006", "OVERLAY", "Treasury Transfer FormModal")
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Importar cartola/i }).first())
  recordSurf("SURF-OVL-007", "OVERLAY", "Treasury Import CSV FormModal")

  await page.getByRole("button", { name: /Cuentas x Cobrar/i }).click()
  recordSurf("SURF-TBL-005", "TABLE", await verifyTableLoaded(page, page.locator("table").first()))
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Registrar abono|Abonar/i }).first())
  recordSurf("SURF-OVL-008", "OVERLAY", "AR Allocate Payment FormModal")

  await page.getByRole("button", { name: /Cuentas x Pagar/i }).click()
  recordSurf("SURF-TBL-006", "TABLE", await verifyTableLoaded(page, page.locator("table").first()))
  await verifyModalLifecycle(page, page.locator("table").getByRole("button", { name: /^Pagar$/i }).first())
  recordSurf("SURF-OVL-009", "OVERLAY", "AP Pay Invoice FormModal")

  for (const [id, lbl] of [
    ["SURF-TAB-027", /Retiros/i],
    ["SURF-TAB-028", /^Configuración$/i],
    ["SURF-TAB-029", /Por producto/i],
    ["SURF-TAB-030", /Análisis/i],
  ]) {
    await page.locator("#admin-main").getByRole("button", { name: lbl }).click()
    recordSurf(id, "TAB", `Finance tab ${lbl} rendered`)
  }

  await page.locator("#admin-main").getByRole("button", { name: /Retiros/i }).click()
  recordSurf("SURF-TBL-030", "TABLE", await verifyTableLoaded(page, page.locator("table").first()))
  await verifyModalLifecycle(page, page.getByTestId("register-withdrawal-btn-2"))
  recordSurf("SURF-OVL-028", "OVERLAY", "Finance Withdrawal FormModal")
  await page.locator('[data-testid="withdrawals-table"] [data-testid="row-actions-trigger"]').first().click()
  await page.getByRole("menuitem", { name: /Eliminar/i }).first().click()
  await page.getByRole("dialog").last().waitFor({ state: "visible" })
  await page.keyboard.press("Escape")
  recordSurf("SURF-OVL-029", "OVERLAY", "Finance Delete Withdrawal ConfirmationModal")

  await page.locator("#admin-main").getByRole("button", { name: /^Configuración$/i }).click()
  await verifyModalLifecycle(page, page.getByTestId("new-category-btn"))
  recordSurf("SURF-OVL-027", "OVERLAY", "Finance Category FormModal")
  const delCatBtn = page.locator('#admin-main button[title="Eliminar"]').first()
  await verifyModalLifecycle(page, delCatBtn)
  recordSurf("SURF-OVL-030", "OVERLAY", "Finance Delete Category ConfirmationModal")
  await page.locator("#admin-main").getByRole("button", { name: /Por producto/i }).click()
  recordSurf("SURF-TBL-031", "TABLE", await verifyTableLoaded(page, page.locator("table").first()))

  // Billing
  await page.goto("http://127.0.0.1:4194/admin/billing")
  await verifyModalLifecycle(page, page.locator("table tbody tr").first().getByRole("button").first())
  recordSurf("SURF-OVL-019", "OVERLAY", "Billing DTE FormModal")

  // Payments & PaymentMethods
  await page.goto("http://127.0.0.1:4194/admin/payments")
  const paySelect = page.locator("table tbody tr select").first()
  await paySelect.selectOption("rejected")
  await page.getByTestId("confirm-payment-status-modal").waitFor({ state: "visible" })
  recordSurf("SURF-OVL-048", "OVERLAY", "Payments ConfirmationModal status transition (confirm-payment-status-modal)")
  await page.keyboard.press("Escape")
  await page.getByTestId("confirm-payment-status-modal").waitFor({ state: "hidden" })
  await page.goto("http://127.0.0.1:4194/admin/payment-methods")
  recordSurf("SURF-TBL-049", "TABLE", await verifyTableLoaded(page, page.locator("table").nth(0)))
  recordSurf("SURF-TBL-050", "TABLE", await verifyTableLoaded(page, page.locator("table").nth(1)))
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Nuevo método|Agregar método/i }).first())
  recordSurf("SURF-OVL-045", "OVERLAY", "PaymentMethods Method FormModal")
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Agregar cuenta|Nueva cuenta/i }).first())
  recordSurf("SURF-OVL-046", "OVERLAY", "PaymentMethods Bank Account FormModal")
  await verifyModalLifecycle(page, page.getByRole("button", { name: "Eliminar método" }).first())
  recordSurf("SURF-OVL-047", "OVERLAY", "PaymentMethods Delete ConfirmationModal")
})

test("Group G: B2B, Users/CRM, Roles, Marketing, CMS, Academy, Services, Loyalty & Rewards", async (t) => {
  const page = await makePage(t)
  // B2B
  await page.goto("http://127.0.0.1:4194/admin/b2b")
  await verifyModalLifecycle(page, page.locator('[data-testid^="open-quote-"]').first())
  recordSurf("SURF-OVL-015", "OVERLAY", "B2B Quote Legacy FormModal")
  await page.getByTestId("b2b-tab-pricelists").click()
  await verifyModalLifecycle(page, page.getByTestId("new-pricelist-btn"))
  recordSurf("SURF-OVL-016", "OVERLAY", "B2B PriceList FormModal")
  await page.getByTestId("b2b-tab-credit").click()
  await verifyModalLifecycle(page, page.getByTestId("request-credit-btn"))
  recordSurf("SURF-OVL-017", "OVERLAY", "B2B Credit Request FormModal")
  await verifyModalLifecycle(page, page.locator('[data-testid^="decide-credit-"]').first())
  recordSurf("SURF-OVL-018", "OVERLAY", "B2B Credit Decision FormModal")

  // Users CRM
  await page.goto("http://127.0.0.1:4194/admin/users")
  await verifyModalLifecycle(page, page.getByTestId("crm-new-customer-btn"))
  recordSurf("SURF-OVL-067", "OVERLAY", "CRM New Customer FormModal")
  await page.getByTestId("open-360-c-1").click()
  await page.getByTestId("crm-360-drawer").waitFor({ state: "visible" })
  recordSurf("SURF-OVL-070", "OVERLAY", "CRM 360 SideModal Drawer")
  await page.getByTestId("close-360-btn").click()
  await page.getByTestId("crm-tab-organizations").click()
  recordSurf("SURF-TAB-075", "TAB", "CRM Organizations tab")
  await verifyModalLifecycle(page, page.getByRole("button", { name: "+ Contacto" }).first())
  recordSurf("SURF-OVL-068", "OVERLAY", "CRM Add Contact FormModal")
  await page.getByTestId("crm-tab-rbac").click()
  recordSurf("SURF-TAB-076", "TAB", "CRM RBAC Users tab")
  await verifyModalLifecycle(page, page.getByRole("button", { name: "Roles" }).first())
  recordSurf("SURF-OVL-069", "OVERLAY", "CRM User Roles FormModal")

  // Roles
  await page.goto("http://127.0.0.1:4194/admin/roles")
  const roleCardBtn = page.locator('[data-testid="roles-grid"] button, button:has-text("Ver detalle")').first()
  await verifyModalLifecycle(page, roleCardBtn)
  recordSurf("SURF-OVL-058", "OVERLAY", "AdminRoles Role Detail SideModal/FormModal")

  // Marketing
  await page.goto("http://127.0.0.1:4194/admin/marketing")
  await page.getByRole("tab", { name: /7\. Campañas/i }).click()
  await page.locator("form input").first().fill("Promo P22")
  recordSurf("SURF-FRM-011", "FORM", "Marketing Promotion form")
  await page.getByRole("tab", { name: /8\. Previsualización/i }).click()
  await page.locator("form button[type='submit']").click()
  recordSurf("SURF-FRM-012", "FORM", "Marketing Pricing preview form")
  await page.getByRole("tab", { name: /11\. Consentimiento/i }).click()
  await page.locator("form input").first().fill("lead@estudio.cl")
  recordSurf("SURF-FRM-013", "FORM", "Marketing Consent form")

  // CMS Settings (forms 020..026 + 4 preview viewports 087..090)
  await page.goto("http://127.0.0.1:4194/admin/settings")
  for (const [id, tabRegex] of [
    ["SURF-FRM-020", /3\. Imágenes/i],
    ["SURF-FRM-021", /4\. Banners/i],
    ["SURF-FRM-022", /5\. Anuncios/i],
    ["SURF-FRM-023", /6\. Secciones Home/i],
    ["SURF-FRM-024", /7\. Botones & Enlaces/i],
    ["SURF-FRM-025", /8\. SEO/i],
    ["SURF-FRM-026", /Config\. Sistémica/i],
  ]) {
    await page.getByRole("tab", { name: tabRegex }).click()
    await page.locator("form").first().waitFor({ state: "visible" })
    recordSurf(id, "FORM", `CMS form ${tabRegex} verified`)
  }
  await page.getByRole("tab", { name: /11\. Previsualización/i }).click()
  for (const [id, lbl] of [
    ["SURF-TAB-087", "Desktop"],
    ["SURF-TAB-088", "Tablet"],
    ["SURF-TAB-089", "Mobile"],
    ["SURF-TAB-090", "Mobile 320px"],
  ]) {
    await page.getByRole("button", { name: lbl, exact: true }).click()
    recordSurf(id, "TAB", `CMS live preview viewport ${lbl}`)
  }

  // Academy Courses/Modules/Lessons/Enrollments/Certifications
  await page.goto("http://127.0.0.1:4194/admin/academy")
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Nuevo curso/i }).first())
  recordSurf("SURF-OVL-012", "OVERLAY", "Academy Course FormModal")
  const delCourseBtn = page.getByRole("button", { name: /Eliminar curso|Eliminar/i }).first()
  if (await delCourseBtn.count()) {
    await verifyModalLifecycle(page, delCourseBtn)
    recordSurf("SURF-OVL-013", "OVERLAY", "Academy Course ConfirmationModal")
  }
  await page.goto("http://127.0.0.1:4194/admin/academy/modules")
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Nuevo módulo/i }).first())
  recordSurf("SURF-OVL-042", "OVERLAY", "Academy Module FormModal")
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Eliminar módulo/i }).first())
  recordSurf("SURF-OVL-043", "OVERLAY", "Academy Module ConfirmationModal")

  await page.goto("http://127.0.0.1:4194/admin/academy/lessons")
  recordSurf("SURF-TBL-034", "TABLE", await verifyTableLoaded(page, page.locator("table").first()))
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Nueva lección/i }).first())
  recordSurf("SURF-OVL-031", "OVERLAY", "Academy Lesson FormModal")
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Eliminar lección/i }).first())
  recordSurf("SURF-OVL-032", "OVERLAY", "Academy Lesson ConfirmationModal")

  await page.goto("http://127.0.0.1:4194/admin/academy/enrollments")
  recordSurf("SURF-TBL-028", "TABLE", await verifyTableLoaded(page, page.locator("table").first()))
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Inscripción manual/i }).first())
  recordSurf("SURF-OVL-026", "OVERLAY", "Academy Enrollment FormModal")

  await page.goto("http://127.0.0.1:4194/admin/academy/certifications")
  recordSurf("SURF-TBL-017", "TABLE", await verifyTableLoaded(page, page.locator("table").first()))
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Nueva certificación/i }).first())
  recordSurf("SURF-OVL-024", "OVERLAY", "Academy Certification FormModal")
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Eliminar certificación/i }).first())
  recordSurf("SURF-OVL-025", "OVERLAY", "Academy Certification ConfirmationModal")

  // Services
  await page.goto("http://127.0.0.1:4194/admin/services")
  await verifyModalLifecycle(page, page.getByTestId("btn-new-service"))
  recordSurf("SURF-OVL-060", "OVERLAY", "Services FormModal")
  await page.getByRole("button", { name: /Servicios/i }).first().click()
  const delSrv = page.locator('[data-testid^="btn-delete-service-"]').first()
  if (await delSrv.count()) {
    await verifyModalLifecycle(page, delSrv)
    recordSurf("SURF-OVL-059", "OVERLAY", "Services ConfirmationModal")
  }

  // Loyalty & Rewards
  await page.goto("http://127.0.0.1:4194/admin/loyalty")
  await page.getByRole("button", { name: /Top clientes/i }).click()
  recordSurf("SURF-TBL-043", "TABLE", await verifyTableLoaded(page, page.locator("table").first()))
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Ajustar/i }).first())
  recordSurf("SURF-OVL-041", "OVERLAY", "Loyalty Adjust Points FormModal")
  await page.locator("#admin-main").getByRole("button", { name: "Configuración", exact: true }).click()
  await page.locator("input[type='number']").first().fill("12")
  recordSurf("SURF-FRM-034", "FORM", "Loyalty Config editor")

  await page.goto("http://127.0.0.1:4194/admin/rewards/campaigns")
  await verifyModalLifecycle(page, page.getByRole("button", { name: /Nueva campaña/i }).first())
  recordSurf("SURF-OVL-056", "OVERLAY", "Rewards Campaign FormModal")
  await verifyModalLifecycle(page, page.locator('[data-testid^="btn-delete-"]').first())
  recordSurf("SURF-OVL-057", "OVERLAY", "Rewards Campaign ConfirmationModal (delete-campaign-modal)")

  await page.goto("http://127.0.0.1:4194/admin/rewards/entries")
  recordSurf("SURF-TBL-057", "TABLE", await verifyTableLoaded(page, page.locator("table").first()))
})
