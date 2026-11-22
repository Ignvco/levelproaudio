import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { preview } from "vite"
import { chromium } from "playwright"

const CHROME_PATH = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

const OUT_DIR =
  process.env.GATE6_SCREENSHOT_DIR ||
  process.env.TEST_ARTIFACT_DIR ||
  path.join(os.tmpdir(), "levelpro-gate6-screenshots")

fs.mkdirSync(OUT_DIR, { recursive: true })

const PO_LIST = [
  {
    id: "po-g6-1",
    po_number: "OC-2026-00061",
    supplier: "sup-1",
    supplier_code: "SUP-NEU",
    supplier_name: "Neumann Berlin GmbH",
    destination_warehouse: "wh-1",
    warehouse_code: "BOD-CENTRAL",
    warehouse_name: "Bodega Central",
    status: "received",
    status_display: "Recibida completa",
    currency: "USD",
    total_amount: "400.00",
    items: [],
  },
]

const GR_LIST = [
  {
    id: "gr-g6-1",
    receipt_number: "REC-2026-00061",
    purchase_order: "po-g6-1",
    po_number: "OC-2026-00061",
    supplier_name: "Neumann Berlin GmbH",
    warehouse: "wh-1",
    warehouse_code: "BOD-CENTRAL",
    status: "confirmed",
  },
]

const LANDED_ALLOCATIONS = [
  {
    id: "lc-1",
    allocation_code: "LC-2026-00001",
    purchase_order: "po-g6-1",
    po_number: "OC-2026-00061",
    supplier_name: "Neumann Berlin GmbH",
    goods_receipt: "gr-g6-1",
    receipt_number: "REC-2026-00061",
    status: "finalized",
    status_display: "Finalizado e Inmutable",
    valuation_currency: "USD",
    total_cif_base: "400.00",
    total_capitalizable_expenses: "210.00",
    total_non_capitalizable_taxes: "0.00",
    total_landed_cost: "610.00",
    rounding_policy: "ROUND_HALF_UP_MAX_BASE_RESIDUAL",
    version: 1,
    is_late_adjustment: false,
    expenses: [
      { id: "e1", category: "international_freight", category_display: "Flete internacional", proration_method: "by_weight", proration_method_display: "Proporcional al peso", amount: "90.00", currency: "USD", converted_amount: "90.00", is_capitalizable: true },
      { id: "e2", category: "insurance", category_display: "Seguro de transporte", proration_method: "by_cif_value", proration_method_display: "Proporcional al valor CIF", amount: "40.00", currency: "USD", converted_amount: "40.00", is_capitalizable: true },
      { id: "e3", category: "customs_duty", category_display: "Aranceles aduaneros", proration_method: "by_cif_value", proration_method_display: "Proporcional al valor CIF", amount: "80.00", currency: "USD", converted_amount: "80.00", is_capitalizable: true },
    ],
    line_allocations: [
      {
        id: "la-1",
        sku_snapshot: "PARTIDA-A-MIC",
        product_name: "Micrófono Condensador Partida A",
        quantity_allocated: 1,
        unit_weight_snapshot: "2.0000",
        total_weight_snapshot: "2.0000",
        cif_base_unit: "100.0000",
        cif_base_total: "100.00",
        allocated_expenses_total: "90.00",
        allocated_expense_unit: "90.0000",
        rounding_adjustment: "0.0000",
        landed_total_cost: "190.00",
        landed_unit_cost: "190.0000",
      },
      {
        id: "la-2",
        sku_snapshot: "PARTIDA-B-PRE",
        product_name: "Preamplificador Valvular Partida B",
        quantity_allocated: 1,
        unit_weight_snapshot: "1.0000",
        total_weight_snapshot: "1.0000",
        cif_base_unit: "300.0000",
        cif_base_total: "300.00",
        allocated_expenses_total: "120.00",
        allocated_expense_unit: "120.0000",
        rounding_adjustment: "0.0000",
        landed_total_cost: "420.00",
        landed_unit_cost: "420.0000",
      },
    ],
  },
]

const LAYERS_PAYLOAD = {
  layers: [
    {
      id: "lyr-1",
      layer_code: "CL-2026-00001",
      costing_method: "specific_serial",
      costing_method_display: "Identificación específica por serial",
      status: "finalized",
      status_display: "Finalizada (Landed Cost definitivo)",
      po_number: "OC-2026-00061",
      receipt_number: "REC-2026-00061",
      supplier_name: "Neumann Berlin GmbH",
      product_name: "Neumann U87 Ai Studio Set",
      sku_snapshot: "G6-NEU-U87",
      warehouse_code: "BOD-CENTRAL",
      acquisition_currency: "USD",
      valuation_currency: "USD",
      quantity_received: 2,
      quantity_damaged: 0,
      quantity_available: 1,
      quantity_consumed: 1,
      original_unit_cost: "2000.0000",
      base_unit_cost: "2000.0000",
      allocated_expenses_total: "320.00",
      unit_allocated_expense: "160.0000",
      landed_unit_cost: "2160.0000",
      total_layer_cost: "4320.00",
      remaining_layer_value: "2160.00",
      is_finalized: true,
    },
    {
      id: "lyr-2",
      layer_code: "CL-2026-00002",
      costing_method: "weighted_average",
      costing_method_display: "Promedio ponderado móvil",
      status: "adjusted",
      status_display: "Ajustada con gasto tardío",
      po_number: "OC-2026-00062",
      receipt_number: "REC-2026-00062",
      supplier_name: "Mogami Cable Corp",
      product_name: "Cable Mogami Gold Studio XLR 5m",
      sku_snapshot: "G6-MOG-XLR5",
      warehouse_code: "BOD-CENTRAL",
      acquisition_currency: "CLP",
      valuation_currency: "CLP",
      quantity_received: 10,
      quantity_damaged: 0,
      quantity_available: 8,
      quantity_consumed: 2,
      original_unit_cost: "100.0000",
      base_unit_cost: "100.0000",
      allocated_expenses_total: "130.00",
      unit_allocated_expense: "13.5000",
      landed_unit_cost: "113.5000",
      total_layer_cost: "1130.00",
      remaining_layer_value: "908.00",
      is_finalized: true,
    },
  ],
  serial_costs: [
    {
      id: "sc-1",
      serial_number_snapshot: "SN-U87-2026-001",
      product_name: "Neumann U87 Ai Studio Set",
      layer_code: "CL-2026-00001",
      valuation_currency: "USD",
      base_unit_cost: "2000.0000",
      allocated_expense: "160.0000",
      landed_unit_cost: "2160.0000",
      is_damaged: false,
      is_finalized: true,
      is_consumed: true,
    },
    {
      id: "sc-2",
      serial_number_snapshot: "SN-U87-2026-002",
      product_name: "Neumann U87 Ai Studio Set",
      layer_code: "CL-2026-00001",
      valuation_currency: "USD",
      base_unit_cost: "2000.0000",
      allocated_expense: "160.0000",
      landed_unit_cost: "2160.0000",
      is_damaged: false,
      is_finalized: true,
      is_consumed: false,
    },
  ],
  weighted_averages: [
    {
      id: "wac-1",
      sku_snapshot: "G6-MOG-XLR5",
      product_name: "Cable Mogami Gold Studio XLR 5m",
      currency: "CLP",
      sellable_quantity: 8,
      damaged_quantity: 0,
      total_quantity: 8,
      average_unit_cost: "113.5000",
      total_value: "908.0000",
    },
  ],
  adjustments: [
    {
      id: "adj-1",
      adjustment_code: "CADJ-2026-00001",
      layer_code: "CL-2026-00002",
      currency: "CLP",
      total_adjustment_amount: "40.00",
      capitalized_to_inventory_amount: "20.00",
      variance_on_consumed_amount: "20.00",
      new_unit_cost: "113.5000",
    },
  ],
  fx_snapshots: [
    {
      id: "fx-1",
      source_currency: "USD",
      target_currency: "CLP",
      rate: "950.000000",
      rate_source: "DUS Aduana Chile #2026-88",
      effective_date: "2026-11-22",
    },
  ],
}

const MARGINS_PAYLOAD = {
  sku_margins: [
    {
      product_id: "prod-1",
      sku: "G6-NEU-U87",
      name: "Neumann U87 Ai Studio Set",
      brand_name: "Neumann",
      category_name: "Micrófonos",
      currency: "USD",
      cost_source: "specific_serial",
      unit_cost: "2160.0000",
      sale_price: "3400.00",
      status: "calculated",
      gross_margin_unit: "1240.0000",
      margin_on_sales_percent: "36.47",
      markup_on_cost_percent: "57.41",
      min_margin_threshold_percent: "20.00",
      target_margin_percent: "35.00",
      below_min_margin: false,
    },
    {
      product_id: "prod-2",
      sku: "G6-RME-ADI2",
      name: "RME ADI-2 DAC FS",
      brand_name: "RME Audio",
      category_name: "Conversores",
      currency: "USD",
      cost_source: "weighted_average",
      unit_cost: "900.0000",
      sale_price: "1000.00",
      status: "calculated",
      gross_margin_unit: "100.0000",
      margin_on_sales_percent: "10.00",
      markup_on_cost_percent: "11.11",
      min_margin_threshold_percent: "20.00",
      target_margin_percent: "35.00",
      below_min_margin: true,
    },
  ],
  brand_reports: [
    {
      brand_name: "Neumann",
      currency: "USD",
      sku_count: 1,
      alerts_count: 0,
      avg_margin_on_sales_percent: "36.47",
      avg_markup_on_cost_percent: "57.41",
    },
    {
      brand_name: "RME Audio",
      currency: "USD",
      sku_count: 1,
      alerts_count: 1,
      avg_margin_on_sales_percent: "10.00",
      avg_markup_on_cost_percent: "11.11",
    },
  ],
  margin_alerts: [
    {
      product_id: "prod-2",
      sku: "G6-RME-ADI2",
      name: "RME ADI-2 DAC FS",
      brand_name: "RME Audio",
      currency: "USD",
      unit_cost: "900.0000",
      sale_price: "1000.00",
      margin_on_sales_percent: "10.00",
      markup_on_cost_percent: "11.11",
      min_margin_threshold_percent: "20.00",
      below_min_margin: true,
    },
  ],
  policies: [
    {
      id: "pol-1",
      name: "Política General Pro Audio",
      min_margin_percent: "20.00",
      target_margin_percent: "35.00",
      is_active: true,
    },
  ],
}

const PROPOSALS_PAYLOAD = {
  results: [
    {
      id: "prop-1",
      product: "prod-2",
      product_name: "RME ADI-2 DAC FS",
      sku: "G6-RME-ADI2",
      currency: "USD",
      base_landed_cost: "900.0000",
      current_net_price: "1000.00",
      proposed_net_price: "1384.62",
      projected_margin_percent: "35.00",
      projected_markup_percent: "53.85",
      projected_gross_profit: "484.62",
      status: "proposed",
      status_display: "Propuesta pendiente de aprobación",
    },
  ],
}

test("Gate 6 Cost & Pricing Intelligence Visual Evidence [Mocked API Fixtures — 8 Full Page PNGs]", async () => {
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
          permissions: ["view_costs", "edit_costs", "view_margins", "edit_prices", "manage_finances"],
          effective_modules: ["dashboard", "catalog", "purchases", "orders", "inventory", "finances", "audit", "roles", "settings"],
        })
      }
      if (p.includes("/admin/rbac/me") || p.includes("/admin/rbac/my-permissions/")) {
        return json({
          is_superuser: true,
          roles: ["Super Admin"],
          modules: ["purchases", "finances", "inventory", "catalog", "orders"],
          capabilities: { view_costs: true, edit_costs: true, view_margins: true, edit_prices: true, manage_finances: true },
        })
      }
      if (p === "/api/v1/admin/costing/landed-cost/") return json({ results: LANDED_ALLOCATIONS, count: LANDED_ALLOCATIONS.length })
      if (p === "/api/v1/admin/costing/layers/") return json(LAYERS_PAYLOAD)
      if (p === "/api/v1/admin/pricing/margins/") return json(MARGINS_PAYLOAD)
      if (p === "/api/v1/admin/pricing/simulator/") {
        if (route.request().method() === "POST") {
          return json({
            proposal_id: "prop-2",
            sku: "G6-RME-ADI2",
            product_name: "RME ADI-2 DAC FS",
            currency: "USD",
            base_landed_cost: "900.0000",
            current_catalog_price: "1000.00",
            min_safe_net_price: "1125.00",
            recommended_net_price: "1384.62",
            simulated_net_price: "1384.62",
            projected_margin_on_sales_percent: "35.00",
            projected_markup_on_cost_percent: "53.85",
            catalog_mutated: false,
          })
        }
        return json(PROPOSALS_PAYLOAD)
      }
      if (p === "/api/v1/admin/purchase-orders/") return json({ results: PO_LIST, count: PO_LIST.length })
      if (p === "/api/v1/admin/goods-receipts/") return json({ results: GR_LIST, count: GR_LIST.length })
      if (p.includes("/api/v1/admin/products/")) {
        return json({
          results: [
            { id: "prod-1", sku: "G6-NEU-U87", name: "Neumann U87 Ai Studio Set" },
            { id: "prod-2", sku: "G6-RME-ADI2", name: "RME ADI-2 DAC FS" },
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

    await page.goto(`${baseUrl}/admin/costing`, { waitUntil: "domcontentloaded" })
    await page.waitForSelector('[data-testid="landed-cost-section"]', { timeout: 15000 })

    // 1, 2 & 3. Dashboard Cost & Pricing, Calculadora Landed Cost y Prorrateo Matemático (Partida A=190, Partida B=420, Total=610)
    await page.screenshot({ path: path.join(OUT_DIR, "gate6-01-cost-pricing-dashboard.png") })
    await page.screenshot({ path: path.join(OUT_DIR, "gate6-02-landed-cost-calculator.png") })
    await page.locator('[data-testid="landed-allocations-list"]').scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(OUT_DIR, "gate6-03-landed-cost-proration-proof.png") })

    // 4 & 5. Capas históricas de costos, costeo por serial y promedio ponderado (WAC)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.getByTestId("tab-btn-layers").click()
    await page.waitForSelector('[data-testid="cost-layers-table"]', { timeout: 10000 })
    await page.screenshot({ path: path.join(OUT_DIR, "gate6-04-cost-layers-history.png") })
    await page.locator('[data-testid="serial-costs-table"]').scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(OUT_DIR, "gate6-05-serial-costing-wac.png") })

    // 6 & 7. Rentabilidad por SKU, reportes por marca y alertas de margen mínimo
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.getByTestId("tab-btn-margins").click()
    await page.waitForSelector('[data-testid="sku-margins-table"]', { timeout: 10000 })
    await page.screenshot({ path: path.join(OUT_DIR, "gate6-07-brand-reports-margin-alerts.png") })
    await page.locator('[data-testid="sku-margins-table"]').scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(OUT_DIR, "gate6-06-sku-profitability-margins.png") })

    // 8. Simulador de precios y propuestas comerciales
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.getByTestId("tab-btn-simulator").click()
    await page.waitForSelector('[data-testid="pricing-simulator-form"]', { timeout: 10000 })
    await page.getByTestId("select-sim-product").selectOption("prod-2")
    await page.getByTestId("btn-run-simulation").click()
    await page.waitForSelector('[data-testid="simulation-result-card"]', { timeout: 10000 })
    await page.screenshot({ path: path.join(OUT_DIR, "gate6-08-pricing-simulator-proposals.png") })

    assert.ok(fs.existsSync(path.join(OUT_DIR, "gate6-01-cost-pricing-dashboard.png")))
    assert.ok(fs.existsSync(path.join(OUT_DIR, "gate6-08-pricing-simulator-proposals.png")))
  } finally {
    await browser.close()
    await new Promise((resolve) => server.httpServer.close(resolve))
  }
})
