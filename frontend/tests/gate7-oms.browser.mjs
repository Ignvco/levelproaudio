import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { preview } from "vite"
import { chromium } from "playwright"

const CHROME_PATH = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

const OUT_DIR =
  process.env.GATE7_SCREENSHOT_DIR ||
  process.env.TEST_ARTIFACT_DIR ||
  path.join(os.tmpdir(), "levelpro-gate7-screenshots")

fs.mkdirSync(OUT_DIR, { recursive: true })

const ORDERS_FIXTURE = [
  {
    id: "7701a111-2222-3333-4444-555566667777",
    status: "pending",
    status_display: "Pendiente",
    commercial_status: "confirmed",
    commercial_status_display: "Confirmada",
    financial_status: "partially_paid",
    financial_status_display: "Pagado parcialmente",
    fulfillment_status: "allocated",
    fulfillment_status_display: "Reservado / En preparación",
    order_origin: "whatsapp",
    customer_name: "Estudio Horizonte SpA",
    customer_phone: "+56998887766",
    customer_tax_id: "76.543.210-K",
    sales_rep_email: "ejecutivo@levelpro.cl",
    assigned_warehouse_code: "BOD-CENTRAL",
    email: "contacto@horizonte.cl",
    shipping_address: "Av. Italia 1450, Providencia",
    shipping_carrier: "Chilexpress",
    tracking_number: "",
    notes: "Propuesta WhatsApp Checkout con reserva activa",
    total: "2020000.00",
    currency: "CLP",
    items_count: 3,
    created_at: "2026-11-22T15:30:00Z",
    items: [
      {
        id: "oi-1",
        product_name: "SSL SiX Desktop Mixer",
        variant_name: "",
        variant_sku: "G7-SSL-SIX",
        price: "1500000.00",
        quantity: 1,
        subtotal: "1500000.00",
      },
      {
        id: "oi-2",
        product_name: "Auriculares Beyer DT-990 Pro",
        variant_name: "250 Ohm",
        variant_sku: "G7-DT990-250",
        price: "260000.00",
        quantity: 2,
        subtotal: "520000.00",
      },
    ],
    payments: [
      {
        id: "pay-1",
        provider: "transfer",
        status: "approved",
        amount: "1000000.00",
        currency: "CLP",
        paid_at: "2026-11-22T16:00:00Z",
        created_at: "2026-11-22T16:00:00Z",
      },
    ],
  },
  {
    id: "8802b222-3333-4444-5555-666677778888",
    status: "paid",
    status_display: "Pagado",
    commercial_status: "confirmed",
    financial_status: "paid",
    fulfillment_status: "allocated",
    order_origin: "manual",
    customer_name: "Mastering Lab Chile",
    email: "mastering@lab.cl",
    shipping_address: "Las Condes 450, Santiago",
    shipping_carrier: "Starken",
    tracking_number: "STK-445566",
    total: "3500000.00",
    currency: "CLP",
    items_count: 1,
    created_at: "2026-11-22T14:00:00Z",
    items: [
      {
        id: "oi-3",
        product_name: "Universal Audio Apollo x8p",
        variant_name: "",
        variant_sku: "G7-UA-X8P",
        price: "3500000.00",
        quantity: 1,
        subtotal: "3500000.00",
      },
    ],
    payments: [
      {
        id: "pay-2",
        provider: "transfer",
        status: "approved",
        amount: "3500000.00",
        currency: "CLP",
        paid_at: "2026-11-22T14:20:00Z",
        created_at: "2026-11-22T14:20:00Z",
      },
    ],
  },
  {
    id: "9903c333-4444-5555-6666-777788889999",
    status: "shipped",
    status_display: "Enviado",
    commercial_status: "confirmed",
    financial_status: "paid",
    fulfillment_status: "shipped",
    order_origin: "online",
    customer_name: "Estudio Acústico Austral",
    email: "austral@estudio.cl",
    shipping_address: "Valdivia 220",
    shipping_carrier: "Chilexpress",
    tracking_number: "CLX-998877",
    total: "2800000.00",
    currency: "CLP",
    items_count: 2,
    created_at: "2026-11-21T18:00:00Z",
    items: [
      {
        id: "oi-4",
        product_name: "Neumann TLM 103 Studio Set",
        variant_name: "",
        variant_sku: "G7-TLM-103",
        price: "1400000.00",
        quantity: 2,
        subtotal: "2800000.00",
      },
    ],
    payments: [],
  },
]

const DRAFTS_FIXTURE = [
  {
    id: "drf-g7-1",
    draft_number: "DRF-20261122-0001",
    status: "shared",
    status_display: "Enlace de pago compartido",
    channel: "whatsapp",
    channel_display: "WhatsApp Checkout",
    customer_name: "Estudio Horizonte SpA",
    customer_email: "contacto@horizonte.cl",
    customer_phone: "+56998887766",
    customer_tax_id: "76.543.210-K",
    shipping_address: "Av. Italia 1450, Providencia",
    currency: "CLP",
    subtotal: "2020000.00",
    discount_percent: "0.00",
    discount_amount: "0.00",
    total: "2020000.00",
    valid_until: "2026-11-25T18:00:00Z",
    reserve_inventory: true,
    warehouse_code: "BOD-CENTRAL",
    notes: "Incluye despacho prioritario asegurado",
    items: [
      {
        id: "dit-1",
        sku_snapshot: "G7-SSL-SIX",
        product_name_snapshot: "SSL SiX Desktop Mixer",
        variant_name_snapshot: "",
        quantity: 1,
        authorized_unit_price: "1500000.00",
        subtotal: "1500000.00",
      },
      {
        id: "dit-2",
        sku_snapshot: "G7-DT990-250",
        product_name_snapshot: "Auriculares Beyer DT-990 Pro (250 Ohm)",
        variant_name_snapshot: "250 Ohm",
        quantity: 2,
        authorized_unit_price: "260000.00",
        subtotal: "520000.00",
      },
    ],
  },
]

const FULFILLMENT_FIXTURE = [
  {
    id: "8802b222-3333-4444-5555-666677778888",
    email: "mastering@lab.cl",
    customer_name: "Mastering Lab Chile",
    shipping_address: "Las Condes 450, Santiago",
    shipping_carrier: "Chilexpress",
    tracking_number: "CLX-776655",
    status: "paid",
    commercial_status: "confirmed",
    financial_status: "paid",
    fulfillment_status: "allocated",
    order_origin: "manual",
    currency: "CLP",
    total: "3500000.00",
    assigned_warehouse_code: "BOD-CENTRAL",
    created_at: "2026-11-22T14:00:00Z",
    items: [
      {
        id: "oi-3",
        product_id: "prod-ua",
        product_name: "Universal Audio Apollo x8p",
        quantity: 1,
        price: "3500000.00",
        serialization_mode: "required",
      },
    ],
    reservations: [
      {
        id: "res-1",
        warehouse_code: "BOD-CENTRAL",
        product_id: "prod-ua",
        product_name: "Universal Audio Apollo x8p",
        serialization_mode: "required",
        quantity: 1,
        status: "consolidated",
        available_serials: ["SN-X8P-001", "SN-X8P-002"],
      },
    ],
  },
]

const RMAS_FIXTURE = [
  {
    id: "rma-g7-1",
    rma_number: "RMA-20261122-0001",
    order: "9903c333-4444-5555-6666-777788889999",
    order_email: "austral@estudio.cl",
    status: "authorized",
    status_display: "2. Retorno autorizado",
    reason_code: "defective",
    reason_code_display: "Falla técnica / Defecto de fábrica",
    reason_details: "Revisión de cápsula en unidad serializada SN-TLM-101",
    warehouse_code: "BOD-CENTRAL",
    refund_status: "pending_approval",
    refund_status_display: "Pendiente de aprobación financiera",
    refund_amount: "1400000.00",
    refund_currency: "CLP",
    items: [
      {
        id: "rmai-1",
        order_item: "oi-4",
        product_name: "Neumann TLM 103 Studio Set",
        sku_snapshot: "G7-TLM-103",
        serial_number: "SN-TLM-101",
        quantity_requested: 1,
        quantity_received: 1,
        quantity_accepted_sellable: 1,
        quantity_damaged_non_sellable: 0,
        condition_status: "sellable_good",
        condition_status_display: "Apto para venta (Sellable)",
        restock_decision: "restock_sellable",
        is_restocked: true,
      },
    ],
  },
]

test("Gate 7 Order Management System Visual Evidence [Mocked API Fixtures — 9 Full Page PNGs]", async () => {
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
    await context.route("**/api/**", async (route) => {
      const u = new URL(route.request().url())
      const p = u.pathname
      const json = (data, status = 200) =>
        route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) })

      if (p.includes("/users/me/") || p.includes("/auth/me/") || p.includes("/auth/profile/")) {
        return json({
          id: "u-admin", email: "admin@levelproaudio.com", is_staff: true, is_superuser: true,
          roles: ["Super Admin"],
          permissions: ["view_costs", "edit_costs", "view_margins", "edit_prices", "approve_payments", "manage_finances"],
          effective_modules: ["dashboard", "catalog", "purchases", "orders", "inventory", "logistics", "finances", "audit", "roles", "settings"],
        })
      }
      if (p.includes("/admin/rbac/me") || p.includes("/admin/rbac/my-permissions/")) {
        return json({
          is_superuser: true,
          roles: ["Super Admin"],
          modules: ["orders", "finances", "inventory", "logistics", "catalog"],
          capabilities: { view_costs: true, edit_prices: true, approve_payments: true, manage_finances: true },
        })
      }
      if (p === "/api/v1/admin/orders/") return json({ results: ORDERS_FIXTURE, count: ORDERS_FIXTURE.length })
      if (p === "/api/v1/admin/orders/manual/") return json({ results: DRAFTS_FIXTURE, count: DRAFTS_FIXTURE.length })
      if (p.includes("/whatsapp-link/")) {
        return json({
          draft_id: "drf-g7-1",
          draft_number: "DRF-20261122-0001",
          checkout_token: "7701a111222233334444555566667777.a1b2c3d4:signed_hmac_token",
          checkout_url: "https://levelproaudio.cl/checkout/assisted/7701a111222233334444555566667777.a1b2c3d4%3Asigned_hmac_token",
          wa_me_url: "https://wa.me/?text=Propuesta%20LevelPro%20Audio%20DRF-20261122-0001",
          expires_at: "2026-11-25T18:00:00Z",
          currency: "CLP",
          total: "2020000.00",
          status: "shared",
        })
      }
      if (p === "/api/v1/admin/orders/fulfillment-queue/") return json({ results: FULFILLMENT_FIXTURE, count: FULFILLMENT_FIXTURE.length })
      if (p === "/api/v1/admin/orders/rmas/") return json({ results: RMAS_FIXTURE, count: RMAS_FIXTURE.length })
      if (p.includes("/api/v1/admin/products/")) {
        return json({
          results: [
            { id: "prod-1", sku: "G7-SSL-SIX", name: "SSL SiX Desktop Mixer", price: "1500000", stock: 4 },
            { id: "prod-2", sku: "G7-UA-X8P", name: "Universal Audio Apollo x8p", price: "3500000", stock: 2 },
          ],
        })
      }
      return json({ results: [], count: 0 })
    })

    const page = await context.newPage()
    await page.addInitScript(() => {
      document.cookie = "csrftoken=mock-csrf; path=/"
      sessionStorage.setItem("levelproaudio-auth", JSON.stringify({
        state: { isAuthenticated: true, user: { id: "u1", email: "admin@levelpro.cl", is_staff: true, is_superuser: true } },
        version: 0,
      }))
    })

    await page.goto(`${baseUrl}/admin/orders`, { waitUntil: "domcontentloaded" })
    await page.waitForSelector('[data-testid="orders-table"]', { timeout: 15000 })

    // 1. Centro OMS (Vista Tabla)
    await page.screenshot({ path: path.join(OUT_DIR, "gate7-01-oms-center-table.png") })

    // 2. Vista Kanban
    await page.getByTestId("oms-view-kanban").click()
    await page.waitForSelector('[data-testid="orders-kanban-board"]', { timeout: 10000 })
    await page.screenshot({ path: path.join(OUT_DIR, "gate7-02-oms-kanban-board.png") })

    // 3. Seguimiento de pagos y estados 3D (Drawer de orden)
    await page.getByTestId("oms-view-table").click()
    await page.waitForSelector('[data-testid="orders-table"]', { timeout: 10000 })
    await page.locator('[data-testid="orders-table"] tbody tr').first().click()
    await page.waitForSelector('.lp-drawer', { timeout: 10000 })
    await page.screenshot({ path: path.join(OUT_DIR, "gate7-06-payment-tracking-3d-states.png") })

    // 8. Cerrar el drawer de orden
    await page.locator('.lp-drawer button[aria-label="Cerrar panel"]').dispatchEvent("click")

    // 3, 4 & 5. Creador de ventas manuales, Detalle de DraftOrder y Generador de enlace WhatsApp
    await page.getByTestId("oms-tab-manual").click()
    await page.getByTestId("open-manual-sale-modal-btn").click()
    await page.waitForSelector('[data-testid="manual-order-form"]', { timeout: 10000 })
    await page.screenshot({ path: path.join(OUT_DIR, "gate7-03-manual-sales-creator.png") })

    // Abrir detalle de DraftOrder
    await page.locator('button:has-text("Gestionar / WhatsApp")').first().click()
    await page.waitForSelector('[data-testid="draft-order-detail-card"]', { timeout: 10000 })
    await page.screenshot({ path: path.join(OUT_DIR, "gate7-04-draft-order-detail.png") })

    // Generar enlace WhatsApp
    await page.getByTestId("generate-whatsapp-link-btn").click()
    await page.waitForSelector('[data-testid="whatsapp-link-generated-box"]', { timeout: 10000 })
    await page.screenshot({ path: path.join(OUT_DIR, "gate7-05-whatsapp-link-generator.png") })

    // 7. Preparación y despacho WMS
    await page.getByTestId("oms-tab-fulfillment").click()
    await page.waitForSelector('[data-testid="oms-fulfillment-queue-panel"]', { timeout: 10000 })
    await page.screenshot({ path: path.join(OUT_DIR, "gate7-07-fulfillment-dispatch-wms.png") })

    // 8 & 9. Solicitud RMA e Inspección y devolución
    await page.getByTestId("oms-tab-rma").click()
    await page.waitForSelector('[data-testid="oms-rma-center-panel"]', { timeout: 10000 })
    await page.screenshot({ path: path.join(OUT_DIR, "gate7-08-rma-requests-list.png") })

    await page.locator('button:has-text("Inspeccionar / Resolver")').first().click()
    await page.waitForSelector('[data-testid="rma-inspection-detail-card"]', { timeout: 10000 })
    await page.screenshot({ path: path.join(OUT_DIR, "gate7-09-rma-inspection-and-return.png") })

    assert.ok(fs.existsSync(path.join(OUT_DIR, "gate7-01-oms-center-table.png")))
    assert.ok(fs.existsSync(path.join(OUT_DIR, "gate7-09-rma-inspection-and-return.png")))
  } finally {
    await browser.close()
    await new Promise((resolve) => server.httpServer.close(resolve))
  }
})
