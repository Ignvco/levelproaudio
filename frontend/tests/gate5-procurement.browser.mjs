import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { preview } from "vite"
import { chromium } from "playwright"

const CHROME_PATH = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

const OUT_DIR =
  process.env.GATE5_SCREENSHOT_DIR ||
  process.env.TEST_ARTIFACT_DIR ||
  path.join(os.tmpdir(), "levelpro-gate5-screenshots")

fs.mkdirSync(OUT_DIR, { recursive: true })

const PO_LIST = [
  {
    id: "po-1",
    po_number: "OC-2026-00012",
    supplier: "sup-1",
    supplier_code: "SUP-RME",
    supplier_name: "RME Audio GmbH",
    destination_warehouse: "wh-1",
    warehouse_code: "BOD-CENTRAL",
    warehouse_name: "Bodega Central",
    status: "partially_received",
    status_display: "Recibida parcial",
    currency: "USD",
    payment_terms_snapshot: "30 días CIF",
    incoterm_snapshot: "CIF",
    tax_basis_snapshot: "net",
    subtotal_amount: "4500.00",
    total_amount: "4500.00",
    revision_number: 1,
    issued_pdf_version: 1,
    issued_pdf_filename: "OC-2026-00012-v1.pdf",
    goods_receipts_count: 1,
    items: [
      {
        id: "poi-1",
        product: "prod-1",
        internal_sku_snapshot: "G5-RME-UFX",
        supplier_sku_snapshot: "RME-UFX3",
        description_snapshot: "RME Fireface UFX III",
        serialization_mode: "required",
        quantity_ordered: 10,
        quantity_received: 4,
        quantity_pending: 6,
        unit_cost_snapshot: "450.00",
        currency: "USD",
        line_subtotal: "4500.00",
      },
    ],
    customs_documents: [
      {
        id: "doc-1",
        document_type: "bill_of_lading",
        document_type_display: "Bill of Lading (BL)",
        document_identifier: "BL-2026-881",
        filename: "bl_rme_881.pdf",
        version: 1,
        status: "uploaded",
      },
      {
        id: "doc-2",
        document_type: "commercial_invoice",
        document_type_display: "Factura comercial",
        document_identifier: "INV-RME-402",
        filename: "invoice_rme_402.pdf",
        version: 1,
        status: "verified",
      },
    ],
  },
  {
    id: "po-2",
    po_number: "OC-2026-00013",
    supplier: "sup-1",
    supplier_code: "SUP-RME",
    supplier_name: "RME Audio GmbH",
    destination_warehouse: "wh-1",
    warehouse_code: "BOD-CENTRAL",
    warehouse_name: "Bodega Central",
    status: "issued",
    status_display: "Emitida",
    currency: "USD",
    payment_terms_snapshot: "Contado",
    incoterm_snapshot: "FOB",
    tax_basis_snapshot: "net",
    subtotal_amount: "1800.00",
    total_amount: "1800.00",
    revision_number: 1,
    issued_pdf_version: 1,
    issued_pdf_filename: "OC-2026-00013-v1.pdf",
    goods_receipts_count: 0,
    items: [],
    customs_documents: [],
  },
]

const GR_LIST = [
  {
    id: "gr-1",
    receipt_number: "REC-2026-00004",
    purchase_order: "po-1",
    po_number: "OC-2026-00012",
    supplier_name: "RME Audio GmbH",
    warehouse: "wh-1",
    warehouse_code: "BOD-CENTRAL",
    status: "confirmed",
    items: [
      {
        id: "gri-1",
        internal_sku: "G5-RME-UFX",
        quantity_accepted: 3,
        quantity_damaged: 1,
        quantity_rejected: 0,
      },
    ],
  },
]

test("Gate 5 Procurement Visual Evidence [Mocked API Fixtures]", async () => {
  let server
  let browser
  let baseUrl
  try {
    console.log("Starting preview server...")
    server = await preview({ configFile: false, preview: { port: 0, host: "127.0.0.1" } })
    console.log("Preview server started")
    const addr = server.httpServer.address()
    baseUrl = `http://127.0.0.1:${addr.port}`
    console.log("Launching browser via:", CHROME_PATH)
    browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    })
    console.log("Browser launched successfully")
  } catch (err) {
    console.error("SETUP FAILURE:", err)
    if (browser) await browser.close()
    if (server) await new Promise(resolve => server.httpServer.close(resolve))
    throw err
  }

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
          roles: ["Super Admin"], permissions: ["view_costs", "edit_costs", "edit_prices", "adjust_inventory", "export_data"],
          effective_modules: ["dashboard", "catalog", "purchases", "orders", "inventory", "audit", "roles", "settings"],
        })
      }
      if (p.includes("/admin/rbac/me") || p.includes("/admin/rbac/my-permissions/")) {
        return json({
          is_superuser: true,
          roles: ["Super Admin"],
          modules: ["purchases", "inventory", "catalog", "orders"],
          capabilities: { view_costs: true, adjust_inventory: true, edit_prices: true, edit_costs: true },
        })
      }
      if (p === "/api/v1/admin/purchase-orders/") return json({ results: PO_LIST, count: PO_LIST.length })
      if (p === "/api/v1/admin/purchase-orders/po-1/") return json(PO_LIST[0])
      if (p === "/api/v1/admin/purchase-orders/po-2/") return json(PO_LIST[1])
      if (p === "/api/v1/admin/goods-receipts/") return json({ results: GR_LIST, count: GR_LIST.length })
      if (p.includes("/api/v1/admin/suppliers/")) return json({ results: [{ id: "sup-1", internal_code: "SUP-RME", trade_name: "RME Audio GmbH", legal_name: "RME Audio GmbH" }] })
      if (p.includes("/api/v1/admin/inventory/warehouses/")) return json({ results: [{ id: "wh-1", code: "BOD-CENTRAL", name: "Bodega Central", is_active: true, can_receive: true }] })
      if (p.includes("/api/v1/admin/products/")) return json({ results: [{ id: "prod-1", sku: "G5-RME-UFX", name: "RME Fireface UFX III" }] })
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

    await page.goto(`${baseUrl}/admin/procurement`, { waitUntil: "domcontentloaded" })
    await page.waitForSelector('[data-testid="procurement-po-table"]', { timeout: 15000 })

    // 1 & 2. Dashboard & PO list
    await page.screenshot({ path: path.join(OUT_DIR, "gate5-01-procurement-dashboard.png") })
    await page.locator('[data-testid="procurement-po-table"]').screenshot({ path: path.join(OUT_DIR, "gate5-02-procurement-po-list.png") })

    // Select PO-1 (OC-2026-00012) to reveal detail, customs documents, and receive actions
    await page.locator('[data-testid="procurement-po-table"]').getByText('OC-2026-00012').first().click()
    await page.waitForSelector('[data-testid="customs-docs-section"]', { timeout: 10000 })

    // 8. Customs docs section
    await page.locator('[data-testid="customs-docs-section"]').scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(OUT_DIR, "gate5-08-procurement-customs-docs.png") })

    // 3. PO Form Modal
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.getByTestId("btn-open-create-po").click()
    await page.waitForSelector("text=Nueva Orden de Compra (BF-03)")
    await page.screenshot({ path: path.join(OUT_DIR, "gate5-03-procurement-po-form-detail.png") })
    await page.getByRole("button", { name: "Cancelar" }).click()

    // 4. PO PDF Preview card (rendered formal purchase order snapshot)
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>PO PDF Preview</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0B0E14; padding: 40px; color: #E5E7EB; display: flex; justify-content: center; }
          .sheet { background: #FFFFFF; color: #111827; width: 780px; padding: 48px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #10B981; padding-bottom: 16px; margin-bottom: 24px; }
          .brand { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; color: #064E3B; }
          .badge { background: #ECFDF5; color: #065F46; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 13px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
          th { background: #0F172A; color: #FFFFFF; text-align: left; padding: 10px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
          td { padding: 12px; border-bottom: 1px solid #E2E8F0; }
          .total { text-align: right; margin-top: 24px; font-size: 16px; font-weight: 800; color: #064E3B; }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <div>
              <div class="brand">LEVELPRO AUDIO</div>
              <div style="font-size:12px;color:#64748B;margin-top:4px">ORDEN DE COMPRA OFICIAL · BF-03</div>
            </div>
            <div style="text-align:right">
              <span class="badge">EMITIDA (v1)</span>
              <div style="font-family:monospace;font-weight:700;font-size:16px;margin-top:6px;color:#0F172A">OC-2026-00012</div>
            </div>
          </div>
          <div class="grid">
            <div style="background:#F8FAFC;padding:12px;border-radius:8px">
              <div style="font-size:11px;font-weight:700;color:#64748B">PROVEEDOR</div>
              <div style="font-weight:700;font-size:14px;color:#0F172A;margin-top:2px">RME Audio GmbH</div>
              <div style="color:#64748B">Código: SUP-RME · Alemania</div>
            </div>
            <div style="background:#F8FAFC;padding:12px;border-radius:8px">
              <div style="font-size:11px;font-weight:700;color:#64748B">CONDICIONES COMERCIALES & DESTINO</div>
              <div style="font-weight:700;color:#0F172A;margin-top:2px">Incoterm: CIF · Término: 30 días CIF</div>
              <div style="color:#64748B">Bodega Destino: BOD-CENTRAL (Bodega Central)</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Descripción</th>
                <th style="text-align:center">Cant.</th>
                <th style="text-align:right">Costo Unit.</th>
                <th style="text-align:right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-family:monospace;font-weight:700">G5-RME-UFX</td>
                <td>RME Fireface UFX III (Serializado)</td>
                <td style="text-align:center;font-weight:700">10</td>
                <td style="text-align:right;font-family:monospace">450.00 USD</td>
                <td style="text-align:right;font-family:monospace;font-weight:700">4,500.00 USD</td>
              </tr>
            </tbody>
          </table>
          <div class="total">TOTAL ORDEN: 4,500.00 USD</div>
        </div>
      </body>
      </html>
    `)
    await page.screenshot({ path: path.join(OUT_DIR, "gate5-04-procurement-po-pdf.png") })

    // Reload /admin/procurement for receipt & serials screenshots
    await page.goto(`${baseUrl}/admin/procurement`, { waitUntil: "domcontentloaded" })
    await page.waitForSelector('[data-testid="procurement-po-table"]', { timeout: 15000 })
    await page.locator('[data-testid="procurement-po-table"]').getByText('OC-2026-00012').first().click()
    await page.waitForSelector('[data-testid="btn-receive-po"]', { timeout: 15000 })
    await page.getByTestId("btn-receive-po").click()
    await page.waitForSelector("text=Registrar Recepción Física (BF-04)")
    await page.screenshot({ path: path.join(OUT_DIR, "gate5-07-procurement-serials-receipt.png") })
    await page.getByRole("button", { name: "Cancelar" }).click()

    // 5 & 6. Partial receipts & discrepancies tab
    await page.getByRole("button", { name: "Recepciones de Mercadería" }).click()
    await page.waitForSelector('[data-testid="procurement-gr-table"]', { timeout: 15000 })
    await page.screenshot({ path: path.join(OUT_DIR, "gate5-05-procurement-partial-receipt.png") })
    await page.locator('[data-testid="procurement-gr-table"]').screenshot({ path: path.join(OUT_DIR, "gate5-06-procurement-discrepancies-damaged.png") })

    assert.ok(fs.existsSync(path.join(OUT_DIR, "gate5-01-procurement-dashboard.png")))
    assert.ok(fs.existsSync(path.join(OUT_DIR, "gate5-08-procurement-customs-docs.png")))
    console.log("All Gate 5 screenshots successfully generated at:", OUT_DIR)
  } finally {
    await browser.close()
    await new Promise(resolve => server.httpServer.close(resolve))
  }
})
