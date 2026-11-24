import path from "node:path"
import { fileURLToPath } from "node:url"
import { preview } from "vite"
import { chromium } from "playwright"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIR = path.resolve(__dirname, "..")
const OUT_DIR = "/Users/levelproaudio/.gemini/antigravity/brain/11ba077a-d7d1-492e-b2b9-3bee19137a13"
const CHROME_PATH = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

const MOCK_OVERVIEW = {
  kpis: {
    ready_orders_count: 2,
    active_shipments_count: 3,
    open_manifests_count: 1,
    open_warranties_count: 2,
    active_repairs_count: 2,
  },
  ready_orders: [
    { id: "ord-g10-1", order_short: "ORD-G101", customer_email: "estudio.pro@levelpro.cl", fulfillment_status: "allocated", currency: "CLP", total: "350000.00", shipping_address: "Av. Providencia 1200, Santiago" },
  ],
}

const MOCK_CARRIERS = {
  results: [
    {
      id: "car-clx", code: "chilexpress", name: "Chilexpress", country: "CL", integration_status: "integration_pending", volumetric_divisor: "4000.00",
      services: [{ id: "svc-clx-1", service_code: "chilexpress_std", name: "Chilexpress Estándar", delivery_window: "2 a 3 días hábiles", currency: "CLP", base_fee: "4990.00", per_kg_fee: "1200.00" }],
    },
    {
      id: "car-stk", code: "starken", name: "Starken", country: "CL", integration_status: "integration_pending", volumetric_divisor: "4000.00",
      services: [{ id: "svc-stk-1", service_code: "starken_agencia", name: "Starken Retiro en Sucursal", delivery_window: "2 a 4 días hábiles", currency: "CLP", base_fee: "3990.00", per_kg_fee: "1000.00" }],
    },
    {
      id: "car-and", code: "andreani", name: "Andreani", country: "AR", integration_status: "integration_pending", volumetric_divisor: "4000.00",
      services: [{ id: "svc-and-1", service_code: "andreani_dom", name: "Andreani Estándar a Domicilio", delivery_window: "3 a 5 días hábiles", currency: "ARS", base_fee: "12500.00", per_kg_fee: "3000.00" }],
    },
    {
      id: "car-ca", code: "correo_argentino", name: "Correo Argentino (MiCorreo / PAQ.AR)", country: "AR", integration_status: "integration_pending", volumetric_divisor: "5000.00",
      services: [{ id: "svc-ca-1", service_code: "correo_ar_suc", name: "Correo Argentino Sucursal", delivery_window: "4 a 6 días hábiles", currency: "ARS", base_fee: "9500.00", per_kg_fee: "2200.00" }],
    },
  ],
}

const MOCK_SHIPMENTS = {
  results: [
    { id: "shp-1", shipment_number: "SHP-20261123-0001", order_id: "ord-g10-1", order_short: "ORD-G101", warehouse_name: "Bodega Central Santiago", carrier_name: "Chilexpress", service_name: "Chilexpress Estándar", packages_count: 2, status: "packed", tracking_number: "SIM-CHI-998877" },
  ],
}

const MOCK_LABELS = {
  results: [
    { id: "lbl-1", shipment_number: "SHP-20261123-0001", label_type: "internal_logistic", barcode_value: "SIM-CHI-998877-P01", tracking_number: "SIM-CHI-998877", pdf_sha256: "e3b0c44298fc1c149afbf4c8996fb924", is_official_dte: false },
    { id: "lbl-2", shipment_number: "SHP-20261123-0001", label_type: "internal_logistic", barcode_value: "SIM-CHI-998877-P02", tracking_number: "SIM-CHI-998877", pdf_sha256: "9f86d081884c7d659a2feaa0c55ad015", is_official_dte: false },
  ],
}

const MOCK_MANIFESTS = {
  results: [
    { id: "man-1", manifest_number: "MAN-20261123-0001", operational_date: "2026-11-23", carrier_name: "Chilexpress", total_shipments: 1, total_packages: 2, status: "closed", pdf_sha256: "a1b2c3d4e5f6" },
  ],
}

const MOCK_TRACKING = {
  results: [
    { id: "trk-1", shipment_number: "SHP-20261123-0001", normalized_status: "in_transit", original_code: "IN_TRANSIT", location: "Hub Lo Boza, Santiago", verification_status: "simulated" },
  ],
}

const MOCK_WARRANTIES = {
  results: [
    { id: "wrn-1", claim_number: "WRN-20261123-0001", product_name: "Genelec 8030C Studio Monitor", serial_number: "SN-G10-WAR-001", coverage_status: "covered", rma_number: "RMA-G10-001", status: "coverage_confirmed" },
  ],
}

const MOCK_REPAIRS = {
  results: [
    { id: "rwo-1", work_order_number: "RWO-20261123-0001", equipment_brand: "Genelec", equipment_model: "8030C", serial_number: "SN-G10-WAR-001", service_mode: "in_warranty", budget_total: "0.00", budget_currency: "CLP", status: "diagnosis_in_progress" },
  ],
}

async function run() {
  const server = await preview({ configFile: false, root: FRONTEND_DIR, preview: { port: 0, host: "127.0.0.1" } })
  const baseUrl = `http://127.0.0.1:${server.httpServer.address().port}`
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
        state: { isAuthenticated: true, user: { id: "u1", email: "logistica@levelpro.cl", is_staff: true, is_superuser: true } },
        version: 0,
      }))
    })

    await page.route("**/api/v1/**", async (route) => {
      const url = route.request().url()
      if (url.includes("/users/me/") || url.includes("/auth/me/") || url.includes("/auth/profile/")) {
        return route.fulfill({ json: { id: "u1", email: "logistica@levelpro.cl", is_staff: true, is_superuser: true, roles: ["Super Admin"], effective_modules: ["dashboard", "orders", "inventory", "finances"] } })
      }
      if (url.includes("/admin/rbac/me")) {
        return route.fulfill({ json: { roles: ["Super Admin"], is_superuser: true, modules: ["orders", "inventory", "finances"], capabilities: { adjust_inventory: true } } })
      }
      if (url.includes("/admin/logistics/overview/")) return route.fulfill({ json: MOCK_OVERVIEW })
      if (url.includes("/admin/logistics/carriers/")) return route.fulfill({ json: MOCK_CARRIERS })
      if (url.includes("/admin/logistics/shipments/")) return route.fulfill({ json: MOCK_SHIPMENTS })
      if (url.includes("/admin/logistics/labels/")) return route.fulfill({ json: MOCK_LABELS })
      if (url.includes("/admin/logistics/manifests/")) return route.fulfill({ json: MOCK_MANIFESTS })
      if (url.includes("/admin/logistics/tracking/")) return route.fulfill({ json: MOCK_TRACKING })
      if (url.includes("/admin/logistics/incidents/")) return route.fulfill({ json: { results: [] } })
      if (url.includes("/admin/logistics/warranties/validate/")) return route.fulfill({ json: { serial_number: "SN-G10-WAR-001", status: "covered", warranty_type: "manufacturer_warranty", verified_sale: true } })
      if (url.includes("/admin/logistics/warranties/")) return route.fulfill({ json: MOCK_WARRANTIES })
      if (url.includes("/admin/logistics/repairs/")) return route.fulfill({ json: MOCK_REPAIRS })
      return route.fulfill({ json: {} })
    })

    const shot = async (name) => {
      await page.waitForTimeout(250)
      await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: true })
    }

    await page.goto(`${baseUrl}/admin/logistics`, { waitUntil: "networkidle" })
    await page.waitForSelector('[data-testid="admin-logistics-page"]')
    await shot("gate10-01-logistics-dashboard.png")
    await shot("gate10-02-preparation-queue.png")

    await page.getByRole("button", { name: "Envíos & Bultos" }).click()
    await page.waitForSelector("text=SHP-20261123-0001")
    await page.getByRole("button", { name: "+ Bulto" }).first().click()
    await page.waitForSelector("text=Registrar bulto")
    await shot("gate10-03-packages-and-dimensions.png")
    await page.getByRole("button", { name: "Cancelar" }).click()

    await page.getByRole("button", { name: "Couriers & Tarifas" }).click()
    await page.waitForSelector("text=Chilexpress")
    await shot("gate10-04-courier-selection.png")

    await page.getByRole("button", { name: "Etiquetas" }).click()
    await page.waitForSelector("text=SIM-CHI-998877-P01")
    await shot("gate10-05-dispatch-labels.png")

    await page.getByRole("button", { name: "Manifiestos" }).click()
    await page.waitForSelector("text=MAN-20261123-0001")
    await shot("gate10-06-shipping-manifest.png")

    await page.getByRole("button", { name: "Tracking & Incidencias" }).click()
    await page.waitForSelector("text=Hub Lo Boza, Santiago")
    await shot("gate10-07-tracking-history.png")

    await page.getByRole("button", { name: "Garantías & Seriales" }).click()
    await page.waitForSelector("text=WRN-20261123-0001")
    await shot("gate10-08-warranty-claims.png")

    await page.fill('input[placeholder="Ej: SN-G10-WAR-001"]', "SN-G10-WAR-001")
    await page.getByRole("button", { name: "Validar serial" }).click()
    await page.waitForSelector("text=manufacturer_warranty")
    await shot("gate10-09-serial-validator.png")

    await page.getByRole("button", { name: "Servicio Técnico" }).click()
    await page.waitForSelector("text=RWO-20261123-0001")
    await shot("gate10-10-workshop-desk.png")

    await page.getByRole("button", { name: "Diagnóstico / Presupuesto" }).first().click()
    await page.waitForSelector("text=Hallazgos técnicos")
    await shot("gate10-11-diagnosis-and-budget.png")
    await page.getByRole("button", { name: "Cancelar" }).click()

    await page.getByRole("button", { name: "Entregar" }).first().click()
    await page.waitForSelector("text=Recibido por")
    await shot("gate10-12-testing-and-delivery.png")

    console.log("GATE10_VISUAL_EVIDENCE_OK: 12 screenshots captured.")
  } finally {
    await browser.close()
    await new Promise((res) => server.httpServer.close(res))
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
