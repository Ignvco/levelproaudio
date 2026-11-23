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

test("Gate 6 Cost & Pricing Real Integration E2E [Browser -> Real Django API -> PostgreSQL 16 QA]", async () => {
  const ts = Date.now()
  const synthEmail = `e2e_cost6_${ts}@test.local`

  const setupPy = `
from decimal import Decimal
from django.contrib.auth.models import Group
from django.core.management import call_command
from rest_framework_simplejwt.tokens import RefreshToken
from apps.users.models import User
from apps.products.models import Brand, Category, Product
from apps.procurement.models import Supplier
from apps.procurement.po_services import (
    create_purchase_order,
    approve_purchase_order,
    issue_purchase_order,
    create_goods_receipt,
    confirm_goods_receipt,
)
from apps.inventory.services import get_default_warehouse

call_command("setup_rbac")
u = User.objects.create_user(username="${synthEmail}", email="${synthEmail}", password="SynthPass123!", is_staff=True, is_superuser=True)
u.groups.add(Group.objects.get(name="Super Admin"))
wh = get_default_warehouse()
cat, _ = Category.objects.get_or_create(slug="e2e-cost6-cat", defaults={"name": "E2E Cost6"})
brand, _ = Brand.objects.get_or_create(slug="e2e-cost6-brand", defaults={"name": "E2E Brand"})
sup, _ = Supplier.objects.get_or_create(internal_code="SUP-G6E2E-${ts}", defaults={"legal_name": "E2E Supplier ${ts}", "country": "USA", "currency": "USD"})

prod_a = Product.objects.create(name="Partida A ${ts}", slug="part-a-${ts}", sku="G6A-${ts}", category=cat, brand=brand, price=Decimal("350000"), weight=Decimal("2.00"), stock=0)
prod_b = Product.objects.create(name="Partida B ${ts}", slug="part-b-${ts}", sku="G6B-${ts}", category=cat, brand=brand, price=Decimal("650000"), weight=Decimal("1.00"), stock=0)

po = create_purchase_order(
    supplier=sup,
    destination_warehouse=wh,
    currency="USD",
    items=[
        {"product_id": prod_a.id, "quantity_ordered": 1, "unit_cost": Decimal("100.00")},
        {"product_id": prod_b.id, "quantity_ordered": 1, "unit_cost": Decimal("300.00")},
    ],
    actor=u,
)
po = approve_purchase_order(po, actor=u)
po = issue_purchase_order(po, actor=u)
poi_a, poi_b = list(po.items.order_by("created_at"))
gr = create_goods_receipt(
    purchase_order=po,
    warehouse=wh,
    items=[
        {"purchase_order_item_id": poi_a.id, "quantity_accepted": 1},
        {"purchase_order_item_id": poi_b.id, "quantity_accepted": 1},
    ],
    actor=u,
)
gr = confirm_goods_receipt(gr, actor=u)

print(f"JWT_TOKEN={RefreshToken.for_user(u).access_token}")
print(f"PO_ID={po.id}")
print(f"GR_ID={gr.id}")
print(f"SKU_A={prod_a.sku}")
print(f"SKU_B={prod_b.sku}")
`
  const out = execFileSync("docker", ["exec", CONTAINER, "python", "manage.py", "shell", "-c", setupPy], { encoding: "utf8" })
  const token = out.match(/JWT_TOKEN=([^\s]+)/)[1]
  const poId = out.match(/PO_ID=([^\s]+)/)[1]
  const grId = out.match(/GR_ID=([^\s]+)/)[1]
  const skuA = out.match(/SKU_A=([^\s]+)/)[1]
  const skuB = out.match(/SKU_B=([^\s]+)/)[1]

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

    await page.goto(`${baseUrl}/admin/costing`, { waitUntil: "domcontentloaded" })
    await page.waitForSelector('[data-testid="landed-cost-form"]', { timeout: 15000 })

    // Seleccionar PO y GoodsReceipt real en el formulario y enviar cálculo + finalización de Landed Cost
    // Los 3 gastos por defecto en el formulario son: Flete 90 (peso), Seguro 40 (CIF), Aranceles 80 (CIF)
    await page.getByTestId("select-lc-po").selectOption(poId)
    await page.getByTestId("select-lc-gr").selectOption(grId)

    const [lcRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/v1/admin/costing/landed-cost/") && r.request().method() === "POST"),
      page.getByTestId("btn-submit-landed-cost").click(),
    ])
    assert.equal(lcRes.status(), 201, "POST /api/v1/admin/costing/landed-cost/ debe retornar 201")
    const lcBody = await lcRes.json()
    assert.equal(lcBody.status, "finalized")
    assert.equal(lcBody.total_cif_base, "400.00")
    assert.equal(lcBody.total_capitalizable_expenses, "210.00")
    assert.equal(lcBody.total_landed_cost, "610.00")

    const lineA = lcBody.line_allocations.find((l) => l.sku_snapshot === skuA)
    const lineB = lcBody.line_allocations.find((l) => l.sku_snapshot === skuB)
    assert.equal(lineA.landed_total_cost, "190.00")
    assert.equal(lineB.landed_total_cost, "420.00")

    // Navegar a la pestaña de Capas de Costos (BF-09) y verificar persistencia desde PostgreSQL 16 QA
    await page.getByTestId("tab-btn-layers").click()
    await page.waitForSelector('[data-testid="cost-layers-table"]', { timeout: 15000 })
    const layersText = await page.locator('[data-testid="cost-layers-table"]').innerText()
    assert.ok(layersText.includes(skuA), "La tabla de CostLayer debe mostrar la Partida A persistida en PostgreSQL QA")
    assert.ok(layersText.includes("190.0000"), "El costo unitario landed de Partida A (190.0000) debe estar persistido")
    assert.ok(layersText.includes("420.0000"), "El costo unitario landed de Partida B (420.0000) debe estar persistido")
  } finally {
    await browser.close()
    await new Promise((resolve) => server.httpServer.close(resolve))
    execFileSync("docker", [
      "exec", CONTAINER, "python", "manage.py", "shell", "-c",
      `from apps.users.models import User; User.objects.filter(email='${synthEmail}').update(is_active=False)`,
    ])
  }
})
