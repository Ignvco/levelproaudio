import path from "node:path"
import fs from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { preview } from "vite"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIR = path.resolve(__dirname, "..")
const ARTIFACTS_DIR = "/Users/levelproaudio/.gemini/antigravity/brain/11ba077a-d7d1-492e-b2b9-3bee19137a13"

const MOCK_SUMMARY = {
  currency: "CLP",
  total_income: 4850000,
  total_withdrawn: 950000,
  net_balance: 3900000,
  reconciliation_required: false,
  unclassified_income_count: 0,
  unclassified_withdrawals_count: 0,
  summary: [
    { id: "cat-1", name: "Capital Inventario", cat_type: "fixed", percentage: 0, color: "#0f766e", icon: "📦", total_in: 2850000, total_out: 450000, balance: 2400000 },
    { id: "cat-2", name: "Operación & Logística", cat_type: "percent", percentage: 20, color: "#0284c7", icon: "🚚", total_in: 970000, total_out: 300000, balance: 670000 },
    { id: "cat-3", name: "Utilidad Neta", cat_type: "remainder", percentage: 0, color: "#16a34a", icon: "💵", total_in: 1030000, total_out: 200000, balance: 830000 },
  ],
  recent_income: [
    { id: "inc-1", order_id: "a1b2c3d4-0000-0000-0000-000000000001", amount: 650000, currency: "CLP", date: "2026-11-22", description: "Orden #A1B2C3D4" },
  ],
}

const MOCK_RECON = {
  pending_payments: [
    {
      payment_id: "pay-1",
      order_id: "ord-11111111-1111-1111-1111-111111111111",
      order_short: "ORD-1111",
      customer_email: "estudio.sur@levelpro.cl",
      provider: "transfer",
      expected_amount: "450000.00",
      currency: "CLP",
      status: "IN_REVIEW",
      provider_reference: "TRF-88210",
      declared_at: "2026-11-23T14:00:00Z",
      has_receipt: true,
    },
  ],
  reconciliations: [
    {
      id: "rec-1",
      payment_id: "pay-0",
      order_id: "ord-0000",
      status: "APPROVED",
      expected_amount: "650000.00",
      reconciled_amount: "650000.00",
      currency: "CLP",
      bank_reference: "TRF-88105",
      effective_bank_date: "2026-11-22",
      reviewed_by_email: "finanzas@levelpro.cl",
      reviewed_at: "2026-11-22T18:10:00Z",
    },
  ],
}

const MOCK_ACCOUNTS = {
  results: [
    { id: "acct-1", code: "BCI-CLP-01", bank_name: "Banco BCI", account_number_masked: "****7766", currency: "CLP", operational_status: "ACTIVE", ledger_balance: "3900000.00", reconciled_balance: "3900000.00" },
    { id: "acct-2", code: "SANT-CLP-02", bank_name: "Banco Santander", account_number_masked: "****3322", currency: "CLP", operational_status: "ACTIVE", ledger_balance: "1250000.00", reconciled_balance: "1250000.00" },
  ],
}

const MOCK_TXS = {
  results: [
    { id: "tx-1", account_code: "BCI-CLP-01", effective_date: "2026-11-23", direction: "CREDIT", amount: "450000.00", unallocated_amount: "450000.00", currency: "CLP", reference: "TRF-88210", description: "Transferencia Estudio Sur", reconciliation_status: "UNRECONCILED" },
    { id: "tx-2", account_code: "BCI-CLP-01", effective_date: "2026-11-22", direction: "CREDIT", amount: "650000.00", unallocated_amount: "0.00", currency: "CLP", reference: "TRF-88105", description: "Transferencia Productora Norte", reconciliation_status: "RECONCILED" },
  ],
}

const MOCK_AR = {
  results: [
    { id: "ar-1", ar_number: "AR-202611-0001", order_id: "ord-1", customer_email: "productora@levelpro.cl", organization_name: "Productora Sonora SpA", currency: "CLP", original_amount: "1200000.00", collected_amount: "400000.00", pending_balance: "800000.00", due_date: "2026-12-05", status: "PARTIALLY_PAID" },
  ],
}

const MOCK_AGING = {
  currency: "CLP",
  buckets: { current: "800000.00", "1_30": "350000.00", "31_60": "0.00", "61_90": "0.00", over_90: "0.00" },
}

const MOCK_AP = {
  results: [
    { id: "ap-1", ap_number: "AP-202611-0001", supplier_name: "Audio Tech Distribuidora", supplier_invoice_number: "FAC-9001", po_number: "PO-2026-0012", currency: "CLP", original_amount: "750000.00", paid_amount: "0.00", pending_balance: "750000.00", due_date: "2026-12-10", status: "APPROVED_FOR_PAYMENT" },
  ],
}

const MOCK_CF = {
  currency: "CLP",
  scenario: "base",
  scenario_label: "Escenario Base (100% AR / 100% AP)",
  opening_cash_balance: "5150000.00",
  horizons: [
    { days: 30, expected_inflows: "1150000.00", expected_outflows: "750000.00", projected_balance: "5550000.00" },
    { days: 60, expected_inflows: "1500000.00", expected_outflows: "900000.00", projected_balance: "5750000.00" },
    { days: 90, expected_inflows: "1850000.00", expected_outflows: "1100000.00", projected_balance: "5900000.00" },
  ],
}

const CHROME_PATH = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

async function run() {
  const server = await preview({
    configFile: false,
    root: FRONTEND_DIR,
    preview: { port: 0, host: "127.0.0.1" },
  })
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
      sessionStorage.setItem(
        "levelproaudio-auth",
        JSON.stringify({
          state: {
            isAuthenticated: true,
            user: {
              id: "usr-g9-admin",
              email: "finanzas@levelpro.cl",
              first_name: "Finanzas",
              last_name: "Admin",
              is_staff: true,
              is_superuser: true,
            },
          },
          version: 0,
        })
      )
      document.cookie = "csrftoken=test-csrf-token; path=/"
    })

    await page.route("**/api/v1/**", async (route) => {
      const url = route.request().url()
      if (url.includes("/admin/finance/summary/")) return route.fulfill({ json: MOCK_SUMMARY })
      if (url.includes("/admin/finance/categories/")) return route.fulfill({ json: MOCK_SUMMARY.summary })
      if (url.includes("/admin/finance/withdrawals/")) return route.fulfill({ json: [] })
      if (url.includes("/admin/finance/reconciliation/")) return route.fulfill({ json: MOCK_RECON })
      if (url.includes("/admin/finance/treasury-accounts/")) return route.fulfill({ json: MOCK_ACCOUNTS })
      if (url.includes("/admin/finance/bank-transactions/")) return route.fulfill({ json: MOCK_TXS })
      if (url.includes("/admin/finance/ar/aging/")) return route.fulfill({ json: MOCK_AGING })
      if (url.includes("/admin/finance/ar/")) return route.fulfill({ json: MOCK_AR })
      if (url.includes("/admin/finance/ap/")) return route.fulfill({ json: MOCK_AP })
      if (url.includes("/admin/finance/cash-flow/")) return route.fulfill({ json: MOCK_CF })
      if (url.includes("/users/me/") || url.includes("/auth/me/") || url.includes("/auth/profile/")) {
        return route.fulfill({ json: { id: "usr-g9-admin", email: "finanzas@levelpro.cl", is_staff: true, is_superuser: true, roles: ["Super Admin"], effective_modules: ["dashboard", "orders", "finances", "roles"] } })
      }
      if (url.includes("/admin/rbac/me")) {
        return route.fulfill({ json: { roles: ["Super Admin"], is_superuser: true, modules: ["orders", "finances", "roles"], capabilities: { view_costs: true, view_margins: true, manage_finances: true, approve_payments: true, view_finances: true } } })
      }
      return route.fulfill({ json: {} })
    })

    await page.goto(`${baseUrl}/admin/finance`, { waitUntil: "networkidle" })
    await page.waitForSelector("text=Finanzas")

    const shot = async (name) => {
      await page.waitForTimeout(250)
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, name), fullPage: true })
    }

    await shot("gate9-01-finance-overview.png")

    await page.getByRole("button", { name: "Conciliación" }).click()
    await page.waitForSelector("text=ORD-1111")
    await shot("gate9-02-reconciliation-queue.png")

    await page.getByRole("button", { name: "Conciliar", exact: true }).first().click()
    await page.waitForSelector("text=Conciliar pago")
    await shot("gate9-03-reconciliation-modal.png")
    await page.getByRole("button", { name: "Cancelar" }).click()

    await page.getByRole("button", { name: "Comprobante" }).first().click()
    await page.waitForSelector("text=Comprobante declarado")
    await shot("gate9-04-receipt-viewer-modal.png")
    await page.getByRole("button", { name: "Cancelar" }).click()

    await page.getByRole("button", { name: "Tesorería" }).click()
    await page.waitForSelector("text=BCI-CLP-01")
    await shot("gate9-05-treasury-accounts.png")

    await page.getByRole("button", { name: "Importar cartola CSV" }).click()
    await page.waitForSelector("text=Importar cartola CSV (SHA-256)")
    await shot("gate9-06-treasury-import-modal.png")
    await page.getByRole("button", { name: "Cancelar" }).click()

    await page.getByRole("button", { name: "Cuentas x Cobrar" }).click()
    await page.waitForSelector("text=AR-202611-0001")
    await shot("gate9-07-ar-aging.png")

    await page.getByRole("button", { name: "Registrar abono" }).first().click()
    await page.waitForSelector("text=Abonar AR-202611-0001")
    await shot("gate9-08-ar-allocate-modal.png")
    await page.getByRole("button", { name: "Cancelar" }).click()

    await page.getByRole("button", { name: "Cuentas x Pagar" }).click()
    await page.waitForSelector("text=AP-202611-0001")
    await shot("gate9-09-ap-ledger.png")

    await page.getByRole("button", { name: "Flujo de Caja" }).click()
    await page.waitForSelector("text=HORIZONTE 30 DÍAS")
    await shot("gate9-10-cash-flow-projection.png")

    await page.getByRole("button", { name: "Tributario" }).click()
    await page.waitForSelector("text=Registro Tributario Externo")
    await shot("gate9-11-external-tax-records.png")

    console.log("GATE9_VISUAL_EVIDENCE_OK: 11 screenshots captured.")
  } finally {
    await browser.close()
    await new Promise((res) => server.httpServer.close(res))
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
