import test from "node:test"
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { preview } from "vite"
import { chromium } from "playwright"

const CONTAINER = "levelpro-v32-qa-backend-1"
const CHROME_PATH = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

function forwardToRealBackend(method, pathAndQuery, headers, bodyBuf) {
  const payload = JSON.stringify({
    method,
    path: pathAndQuery,
    headers,
    body_b64: bodyBuf ? bodyBuf.toString("base64") : "",
  })
  const py = `
import sys, json, base64, urllib.request, urllib.error
req_data = json.loads(sys.stdin.read())
url = "http://127.0.0.1:8000" + req_data["path"]
body = base64.b64decode(req_data["body_b64"]) if req_data["body_b64"] else None
hdrs = {k: v for k, v in req_data["headers"].items() if k.lower() not in ("host", "content-length", "connection")}
r = urllib.request.Request(url, data=body, headers=hdrs, method=req_data["method"])
try:
    with urllib.request.urlopen(r, timeout=15) as resp:
        out_hdrs = [[k, v] for k, v in resp.headers.items()]
        print(json.dumps({"status": resp.status, "headers": out_hdrs, "body_b64": base64.b64encode(resp.read()).decode()}))
except urllib.error.HTTPError as e:
    out_hdrs = [[k, v] for k, v in e.headers.items()]
    print(json.dumps({"status": e.code, "headers": out_hdrs, "body_b64": base64.b64encode(e.read()).decode()}))
`
  const res = spawnSync("docker", ["exec", "-i", CONTAINER, "python", "-c", py], {
    input: payload,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  })
  if (res.status !== 0) {
    throw new Error(`Docker backend proxy error: ${res.stderr}`)
  }
  return JSON.parse(res.stdout.trim())
}

test("Gate 5 Procurement Real Integration E2E [Browser -> Real Django API -> PostgreSQL 16 QA]", async () => {
  const ts = Date.now()
  const synthEmail = `e2e_proc5_${ts}@test.local`

  // Preparar usuario sintético + PO emitida (10 unidades) en PostgreSQL 16 QA
  const setupPy = `
from decimal import Decimal
from django.contrib.auth.models import Group
from django.core.management import call_command
from rest_framework_simplejwt.tokens import RefreshToken
from apps.users.models import User
from apps.products.models import Brand, Category, Product
from apps.procurement.models import Supplier
from apps.procurement.po_services import create_purchase_order, approve_purchase_order, issue_purchase_order
from apps.inventory.services import get_default_warehouse

call_command("setup_rbac")
u = User.objects.create_user(username="${synthEmail}", email="${synthEmail}", password="SynthPass123!", is_staff=True, is_superuser=True)
u.groups.add(Group.objects.get(name="Super Admin"))
wh = get_default_warehouse()
cat, _ = Category.objects.get_or_create(slug="e2e-proc5-cat", defaults={"name": "E2E Proc5"})
brand, _ = Brand.objects.get_or_create(slug="e2e-proc5-brand", defaults={"name": "E2E Brand"})
sup, _ = Supplier.objects.get_or_create(internal_code="SUP-E2E-${ts}", defaults={"legal_name": "E2E Supplier ${ts}", "country": "Chile", "currency": "USD"})
prod = Product.objects.create(name="E2E Console ${ts}", slug="e2e-con-${ts}", sku="E2E-G5-${ts}", category=cat, brand=brand, price=Decimal("500000"), stock=0)
po = create_purchase_order(supplier=sup, destination_warehouse=wh, items=[{"product_id": prod.id, "quantity_ordered": 10, "unit_cost": Decimal("200.00")}], actor=u)
po = approve_purchase_order(po, actor=u)
po = issue_purchase_order(po, actor=u)
print(f"JWT_TOKEN={RefreshToken.for_user(u).access_token}")
print(f"PO_ID={po.id}")
print(f"PO_NUM={po.po_number}")
print(f"PROD_SKU={prod.sku}")
`
  const out = execFileSync("docker", ["exec", CONTAINER, "python", "manage.py", "shell", "-c", setupPy], { encoding: "utf8" })
  const token = out.match(/JWT_TOKEN=([^\s]+)/)[1]
  const poId = out.match(/PO_ID=([^\s]+)/)[1]
  const poNum = out.match(/PO_NUM=([^\s]+)/)[1]
  const prodSku = out.match(/PROD_SKU=([^\s]+)/)[1]

  const server = await preview({ configFile: false, preview: { port: 0, host: "127.0.0.1" } })
  const addr = server.httpServer.address()
  const baseUrl = `http://127.0.0.1:${addr.port}`
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  })

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    await context.route("**/api/**", async (route) => {
      const req = route.request()
      const u = new URL(req.url())
      const fwdHeaders = { ...req.headers(), authorization: `Bearer ${token}` }
      const resp = forwardToRealBackend(req.method(), u.pathname + u.search, fwdHeaders, req.postDataBuffer())
      const hdrMap = {}
      for (const [k, v] of resp.headers) {
        if (k.toLowerCase() !== "transfer-encoding") hdrMap[k] = v
      }
      await route.fulfill({ status: resp.status, headers: hdrMap, body: Buffer.from(resp.body_b64, "base64") })
    })

    const page = await context.newPage()
    await page.addInitScript((email) => {
      sessionStorage.setItem("levelproaudio-auth", JSON.stringify({
        state: { isAuthenticated: true, user: { id: "synth", email, is_staff: true, is_superuser: true } },
        version: 0,
      }))
    }, synthEmail)

    await page.goto(`${baseUrl}/admin/procurement`, { waitUntil: "domcontentloaded" })
    await page.waitForSelector('[data-testid="procurement-po-table"]', { timeout: 15000 })

    // Seleccionar PO emitida y abrir modal de recepción parcial (4 de 10)
    await page.locator('[data-testid="procurement-po-table"]').getByText(poNum).click()
    await page.waitForSelector('[data-testid="btn-receive-po"]', { timeout: 10000 })
    await page.getByTestId("btn-receive-po").click()

    const modal = page.locator("form").filter({ hasText: "Registrar Recepción Física (BF-04)" })
    await modal.waitFor({ state: "visible", timeout: 5000 })
    await modal.locator('input[type="number"]').first().fill("4")
    const [grRes] = await Promise.all([
      page.waitForResponse(r => r.url().includes("/api/v1/admin/goods-receipts/") && r.request().method() === "POST"),
      modal.getByTestId("btn-submit-gr").click(),
    ])
    assert.equal(grRes.status(), 201, "POST /api/v1/admin/goods-receipts/ debe retornar 201")
    await modal.waitFor({ state: "hidden", timeout: 5000 })

    // Verificar en API real que PO quedó PARTIALLY_RECEIVED con 4 recibidas y 6 pendientes
    const poResp = forwardToRealBackend("GET", `/api/v1/admin/purchase-orders/${poId}/`, { authorization: `Bearer ${token}` }, null)
    assert.equal(poResp.status, 200)
    const poData = JSON.parse(Buffer.from(poResp.body_b64, "base64").toString("utf8"))
    assert.equal(poData.status, "partially_received")
    assert.equal(poData.items[0].quantity_received, 4)
    assert.equal(poData.items[0].quantity_pending, 6)

    // Navegar a WMS (/admin/inventory) y verificar WarehouseStock (+4) y Kardex (GOODS_RECEIPT +4)
    await page.goto(`${baseUrl}/admin/inventory`, { waitUntil: "domcontentloaded" })
    await page.waitForSelector(".lp-seg-tabs", { timeout: 15000 })
    await page.getByRole("button", { name: "Stock Dimensional" }).click()
    await page.waitForSelector('[data-testid="wms-dimensional-table"]', { timeout: 15000 })
    const stockText = await page.locator('[data-testid="wms-dimensional-table"]').innerText()
    assert.ok(stockText.includes(prodSku), "WarehouseStock debe mostrar el SKU recepcionado desde PostgreSQL QA")

    await page.getByRole("button", { name: "Kardex" }).click()
    await page.waitForSelector('[data-testid="wms-kardex-table"]', { timeout: 15000 })
    const kardexText = await page.locator('[data-testid="wms-kardex-table"]').innerText()
    assert.ok(kardexText.includes("GOODS_RECEIPT"), "Kardex debe mostrar el movimiento GOODS_RECEIPT en PostgreSQL QA")
  } finally {
    await browser.close()
    await new Promise(resolve => server.httpServer.close(resolve))
    execFileSync("docker", [
      "exec", CONTAINER, "python", "manage.py", "shell", "-c",
      `from apps.users.models import User; User.objects.filter(email='${synthEmail}').update(is_active=False)`,
    ])
  }
})
