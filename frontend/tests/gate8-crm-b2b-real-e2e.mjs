import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import { spawnSync } from "node:child_process"
import { preview } from "vite"
import { chromium } from "playwright"

const CONTAINER = "levelpro-v32-qa-backend-1"
const OUT_DIR = "/Users/levelproaudio/.gemini/antigravity/brain/11ba077a-d7d1-492e-b2b9-3bee19137a13"
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
  if (res.status !== 0) throw new Error(`Docker proxy error: ${res.stderr}`)
  return JSON.parse(res.stdout.trim())
}

function execContainerPython(pyCode) {
  const res = spawnSync("docker", ["exec", "-i", CONTAINER, "python", "-c", pyCode], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  })
  if (res.status !== 0) throw new Error(`Container python error: ${res.stderr}`)
  return res.stdout.trim()
}

test("Gate 8 CRM & B2B Real Integration E2E [Browser -> Real Django API -> PostgreSQL 16 QA]", async () => {
  const ts = Date.now()
  const adminEmail = `e2e_g8_${ts}@test.local`

  // 1. Seed datos sintéticos en PostgreSQL 16 QA
  const seedOut = execContainerPython(`
import os, json, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.management import call_command
from rest_framework_simplejwt.tokens import RefreshToken
from apps.products.models import Brand, Category, Product
from apps.inventory.models import Warehouse, WarehouseStock
from apps.orders.crm_services import create_or_update_organization, create_or_update_b2b_price_list

call_command("setup_rbac")
User = get_user_model()
u = User.objects.create_superuser(username="e2e_g8_${ts}", email="${adminEmail}", password="TestPassword123!")
refresh = RefreshToken.for_user(u)

cat, _ = Category.objects.get_or_create(slug="e2e-g8-cat", defaults={"name": "Estudio E2E"})
brand, _ = Brand.objects.get_or_create(slug="e2e-g8-brand", defaults={"name": "LevelPro Lab"})
wh = Warehouse.objects.filter(is_default=True).first()
if not wh:
    wh = Warehouse.objects.create(code="WH-E2E8", name="Bodega E2E 8", is_default=True, is_active=True)

prod = Product.objects.create(
    name="Monitor E2E Gate8 ${ts}",
    slug="mon-e2e-g8-${ts}",
    sku="E2E8-${ts}",
    category=cat,
    brand=brand,
    price=Decimal("100000.00"),
    cost_price=Decimal("60000.00"),
    stock=10,
    product_type=Product.ProductType.STOCK,
    is_active=True,
)
WarehouseStock.objects.create(warehouse=wh, product=prod, physical_quantity=10, reserved_quantity=0)

org = create_or_update_organization(
    legal_name="Estudio Sintético E2E SpA",
    trade_name="Sintético E2E",
    country="CL",
    tax_id="11.111.111-1",
    commercial_segment="pro_studio",
    billing_email="sintetico@e2e.test",
    actor=u,
)

create_or_update_b2b_price_list(
    code="PL-E2E8-${ts}",
    name="Lista E2E Gate8",
    currency="CLP",
    scope="organization",
    organization=org,
    items=[{
        "product_id": str(prod.id),
        "pricing_mode": "fixed_price",
        "fixed_price": "95000.00",
        "tiers": [
            {"min_quantity": 1, "max_quantity": 4, "tier_price": "95000.00"},
            {"min_quantity": 5, "max_quantity": 9, "tier_price": "90000.00"},
            {"min_quantity": 10, "max_quantity": None, "tier_price": "85000.00"},
        ],
    }],
    actor=u,
)

print(json.dumps({
    "access": str(refresh.access_token),
    "refresh": str(refresh),
    "org_id": str(org.id),
    "prod_id": str(prod.id),
}))
`)
  const seed = JSON.parse(seedOut.split("\n").pop())

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

    await page.addInitScript(({ email }) => {
      document.cookie = "csrftoken=e2e-csrf; path=/"
      sessionStorage.setItem("levelproaudio-auth", JSON.stringify({
        state: { isAuthenticated: true, user: { id: "e2e-admin", email, is_staff: true, is_superuser: true } },
        version: 0,
      }))
    }, { email: adminEmail })

    await page.route("**/api/v1/**", async (route) => {
      const req = route.request()
      const urlObj = new URL(req.url())
      const hdrs = { ...req.headers(), authorization: `Bearer ${seed.access}` }
      const proxied = forwardToRealBackend(
        req.method(),
        urlObj.pathname + urlObj.search,
        hdrs,
        req.postDataBuffer()
      )
      const headersObj = {}
      for (const [k, v] of proxied.headers) {
        if (!["transfer-encoding", "connection", "content-encoding"].includes(k.toLowerCase())) {
          headersObj[k] = v
        }
      }
      await route.fulfill({
        status: proxied.status,
        headers: headersObj,
        body: Buffer.from(proxied.body_b64, "base64"),
      })
    })

    // 2. Navegar a CRM (/admin/users) y abrir Ficha 360° de la organización
    await page.goto(`${baseUrl}/admin/users`, { waitUntil: "domcontentloaded" })
    await page.waitForSelector('[data-testid="crm-tab-organizations"]', { timeout: 15000 })
    await page.click('[data-testid="crm-tab-organizations"]')
    await page.waitForSelector(`[data-testid="open-org-360-${seed.org_id}"]`, { timeout: 10000 })
    await page.click(`[data-testid="open-org-360-${seed.org_id}"]`)
    await page.waitForSelector('[data-testid="crm-360-drawer"]', { timeout: 10000 })
    await page.click('[data-testid="close-360-btn"]')

    // 3. Navegar a Centro B2B (/admin/b2b) -> Generador Pro -> Crear Cotización con tramo 5-9 (90.000) -> Aprobar -> PDF -> Convertir a OMS
    await page.goto(`${baseUrl}/admin/b2b`, { waitUntil: "domcontentloaded" })
    await page.waitForSelector('[data-testid="b2b-tab-builder"]', { timeout: 15000 })
    await page.click('[data-testid="b2b-tab-builder"]')
    await page.selectOption('[data-testid="builder-org-select"]', seed.org_id)
    await page.selectOption('[data-testid="builder-product-select"]', seed.prod_id)
    await page.click('[data-testid="builder-add-line-btn"]')
    await page.click('[data-testid="builder-create-quote-btn"]')

    await page.waitForSelector('[data-testid="b2b-quotes-table"]', { timeout: 15000 })
    // Abrir la cotización recién creada
    const openBtns = page.locator('[data-testid^="open-quote-"]')
    await openBtns.first().click()
    await page.waitForSelector('[data-testid="b2b-pdf-preview-btn"]', { timeout: 10000 })
    await page.click('[data-testid="b2b-pdf-preview-btn"]')
    await page.waitForTimeout(500)

    // Convertir a Pedido OMS/WMS
    await page.click('[data-testid="b2b-convert-order-btn"]')
    await page.waitForTimeout(1200)

    // 4. Verificar en PostgreSQL 16 QA: Order creada, StockReservation = 5, PDF Snapshot guardado, y exportar PDF sintético
    const verifyOut = execContainerPython(`
import os, json, base64, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()
from apps.orders.models import B2BQuote, Order
from apps.orders.crm_models import B2BQuotePDFSnapshot
from apps.inventory.models import StockReservation, WarehouseStock

q = B2BQuote.objects.filter(organization_id="${seed.org_id}").order_by("-created_at").first()
assert q is not None and q.status == "converted", f"Quote status unexpected: {q.status if q else None}"
o = q.converted_order
assert o is not None and o.order_origin == "b2b", "Order not linked"
res_qty = sum(r.quantity for r in StockReservation.objects.filter(order=o))
assert res_qty == 5, f"Expected 5 reserved, got {res_qty}"
ws = WarehouseStock.objects.filter(product_id="${seed.prod_id}").first()
assert ws.reserved_quantity >= 5, "WarehouseStock reserved_quantity not updated"
snap = B2BQuotePDFSnapshot.objects.filter(quote=q).first()
assert snap is not None and bytes(snap.pdf_bytes).startswith(b"%PDF-"), "PDF snapshot missing"

print(json.dumps({
    "quote_number": q.quote_number,
    "order_id": str(o.id),
    "order_total": str(o.total),
    "reserved_qty": res_qty,
    "pdf_sha256": snap.sha256_checksum,
    "pdf_b64": base64.b64encode(bytes(snap.pdf_bytes)).decode(),
}))
`)
    const verified = JSON.parse(verifyOut.split("\n").pop())
    assert.equal(verified.reserved_qty, 5)
    assert.equal(verified.order_total, "535500.00") // 5 * 90.000 = 450.000 + 19% IVA = 535.500!

    // Guardar PDF sintético de muestra en Artifacts
    fs.writeFileSync(`${OUT_DIR}/gate8_sample_b2b_quote.pdf`, Buffer.from(verified.pdf_b64, "base64"))
  } finally {
    await browser.close()
    server.httpServer.close()
  }
})
