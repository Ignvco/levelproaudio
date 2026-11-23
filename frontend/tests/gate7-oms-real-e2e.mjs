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

test("Gate 7 OMS Real Integration E2E [Browser -> Real Django API -> PostgreSQL 16 QA: Manual Sale, WhatsApp Checkout, WMS Reservation & RMA Compensatory Return]", async () => {
  const ts = Date.now()
  const synthEmail = `e2e_oms7_${ts}@test.local`
  const custEmail = `cliente_oms7_${ts}@estudio.cl`

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
cat, _ = Category.objects.get_or_create(slug="e2e-oms7-cat", defaults={"name": "E2E OMS7"})
brand, _ = Brand.objects.get_or_create(slug="e2e-oms7-brand", defaults={"name": "E2E Brand OMS7"})
sup, _ = Supplier.objects.get_or_create(internal_code="SUP-G7E2E-${ts}", defaults={"legal_name": "E2E Supplier ${ts}", "country": "Chile", "currency": "CLP"})

prod = Product.objects.create(
    name="Preamp Neve 1073 E2E ${ts}",
    slug="neve-1073-e2e-${ts}",
    sku="G7E2E-${ts}",
    category=cat,
    brand=brand,
    price=Decimal("1800000"),
    cost_price=Decimal("1100000"),
    serialization_mode=Product.SerializationMode.REQUIRED,
    stock=0,
)

po = create_purchase_order(
    supplier=sup,
    destination_warehouse=wh,
    currency="CLP",
    items=[{"product_id": prod.id, "quantity_ordered": 2, "unit_cost": Decimal("1100000.00")}],
    actor=u,
)
po = approve_purchase_order(po, actor=u)
po = issue_purchase_order(po, actor=u)
poi = po.items.first()
gr = create_goods_receipt(
    purchase_order=po,
    warehouse=wh,
    items=[{
        "purchase_order_item_id": poi.id,
        "quantity_accepted": 2,
        "serial_numbers": ["SN-E2E7-01-${ts}", "SN-E2E7-02-${ts}"],
    }],
    actor=u,
)
gr = confirm_goods_receipt(gr, actor=u)

print(f"JWT_TOKEN={RefreshToken.for_user(u).access_token}")
print(f"PROD_ID={prod.id}")
print(f"SKU={prod.sku}")
`
  const out = execFileSync("docker", ["exec", CONTAINER, "python", "manage.py", "shell", "-c", setupPy], { encoding: "utf8" })
  const jwtToken = out.match(/JWT_TOKEN=([^\s]+)/)[1]
  const prodId = out.match(/PROD_ID=([^\s]+)/)[1]
  const serial1 = `SN-E2E7-01-${ts}`

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
      const pathAndQuery = u.pathname + u.search
      const headers = {
        ...req.headers(),
        Authorization: `Bearer ${jwtToken}`,
      }
      const postBuf = req.postDataBuffer()
      const resp = forwardToRealBackend(req.method(), pathAndQuery, headers, postBuf)
      const respHeaders = {}
      for (const [k, v] of resp.headers) {
        if (!["transfer-encoding", "content-encoding", "content-length"].includes(k.toLowerCase())) {
          respHeaders[k] = v
        }
      }
      await route.fulfill({
        status: resp.status,
        headers: respHeaders,
        body: Buffer.from(resp.body_b64, "base64"),
      })
    })

    const page = await context.newPage()
    await page.addInitScript((email) => {
      sessionStorage.setItem("levelproaudio-auth", JSON.stringify({
        state: { isAuthenticated: true, user: { id: "u-e2e", email, is_staff: true, is_superuser: true } },
        version: 0,
      }))
    }, synthEmail)

    // ═══════════════════════════════════════════════════════════════════════
    // FLUJO E2E REAL 1: Navegador -> API -> PostgreSQL (Venta Manual, Enlace WhatsApp Checkout y Reserva WMS)
    // ═══════════════════════════════════════════════════════════════════════
    await page.goto(`${baseUrl}/admin/orders`, { waitUntil: "domcontentloaded" })
    await page.waitForSelector('[data-testid="open-manual-sale-modal-btn"]', { timeout: 15000 })
    await page.getByTestId("open-manual-sale-modal-btn").click()
    await page.waitForSelector('[data-testid="manual-order-form"]', { timeout: 10000 })

    await page.getByTestId("manual-customer-name").fill(`Estudio E2E ${ts}`)
    await page.getByTestId("manual-customer-email").fill(custEmail)
    await page.getByTestId("manual-customer-phone").fill("+56991112233")
    await page.getByTestId("manual-shipping-address").fill("Providencia 2500, Santiago")
    await page.getByTestId("manual-product-select").selectOption(prodId)
    await page.getByTestId("manual-product-qty").fill("1")
    await page.getByTestId("submit-manual-order-btn").click()

    await page.waitForSelector('[data-testid="draft-order-detail-card"]', { timeout: 15000 })

    // Generar enlace de WhatsApp Checkout desde el navegador
    await page.getByTestId("generate-whatsapp-link-btn").click()
    await page.waitForSelector('[data-testid="whatsapp-checkout-url-input"]', { timeout: 15000 })
    const generatedCheckoutUrl = await page.getByTestId("whatsapp-checkout-url-input").inputValue()
    assert.ok(generatedCheckoutUrl.startsWith("https://"))
    const tokenPart = decodeURIComponent(generatedCheckoutUrl.split("/checkout/assisted/")[1])

    // Abrir la ruta pública de checkout asistido en el navegador y confirmar la conversión a Order
    await page.goto(`${baseUrl}/checkout/assisted/${encodeURIComponent(tokenPart)}`, { waitUntil: "domcontentloaded" })
    await page.waitForSelector('[data-testid="assisted-checkout-confirm-btn"]', { timeout: 15000 })
    await page.getByTestId("assisted-checkout-confirm-btn").click()
    await page.waitForSelector('text=Pedido Confirmado', { timeout: 15000 })

    // ═══════════════════════════════════════════════════════════════════════
    // FLUJO E2E REAL 2: API -> WMS -> Despacho -> Inspección de Devolución RMA y Movimientos Compensatorios
    // ═══════════════════════════════════════════════════════════════════════
    const verifyAndRunRmaPy = `
from decimal import Decimal
from apps.orders.models import DraftOrder, Order, ReturnMerchandiseAuthorization, RMAItem
from apps.orders.oms_services import (
    record_order_payment_attempt,
    transition_order_dimensions,
    create_rma_request,
    authorize_or_reject_rma,
    receive_and_inspect_rma,
)
from apps.inventory.models import WarehouseStock, InventoryMovement, SerialNumberTrack
from apps.procurement.models import CostLayer, CostConsumptionRecord, WeightedAverageCostState
from apps.users.models import User

u = User.objects.get(email="${synthEmail}")
draft = DraftOrder.objects.get(customer_email="${custEmail}")
assert draft.status == DraftOrder.Status.CONVERTED, f"Expected CONVERTED, got {draft.status}"
order = draft.converted_order
assert order is not None

# Verificar reserva en WMS
ws = WarehouseStock.objects.get(product_id="${prodId}")
assert ws.physical_quantity == 2 and ws.reserved_quantity == 1, f"Unexpected stock: phys={ws.physical_quantity}, res={ws.reserved_quantity}"

# Aprobar pago y despachar unidad serializada
record_order_payment_attempt(order, provider="transfer", amount=Decimal("1800000.00"), external_id="E2E-PAY-${ts}", approve_immediately=True, actor=u)
transition_order_dimensions(order, fulfillment_status="shipped", serial_assignments={"${prodId}": ["${serial1}"]}, actor=u)

ws.refresh_from_db()
assert ws.physical_quantity == 1 and ws.reserved_quantity == 0

oi = order.items.first()
assert oi.unit_cost_snapshot == Decimal("1100000.0000")

# Crear RMA, autorizar, recepcionar e inspeccionar físicamente como SELLABLE_GOOD
rma = create_rma_request(
    order=order,
    reason_code="retract",
    items=[{"order_item_id": oi.id, "quantity_requested": 1, "serial_number": "${serial1}"}],
    actor=u,
)
authorize_or_reject_rma(rma, approve=True, actor=u)
rma_item = rma.items.first()
receive_and_inspect_rma(
    rma,
    inspections=[{
        "rma_item_id": str(rma_item.id),
        "quantity_received": 1,
        "condition_status": "sellable_good",
        "restock_decision": "restock_sellable",
    }],
    actor=u,
)

# Verificar movimientos compensatorios en WMS, Kardex, SerialNumberTrack, CostLayer y WAC
ws.refresh_from_db()
assert ws.physical_quantity == 2 and ws.available_quantity == 2
sn_track = SerialNumberTrack.objects.get(serial_number="${serial1}")
assert sn_track.status == SerialNumberTrack.Status.IN_STOCK
assert InventoryMovement.objects.filter(source_document_type="RMA", source_document_id=str(rma.id), movement_type="return_in").exists()
assert CostConsumptionRecord.objects.filter(order=order).count() == 1
assert CostLayer.objects.filter(source_document_type="RMA_RETURN", source_document_id=str(rma.id), landed_unit_cost=Decimal("1100000.0000")).exists()
wac = WeightedAverageCostState.objects.get(product_id="${prodId}", currency="CLP")
assert wac.sellable_quantity == 2 and wac.average_unit_cost == Decimal("1100000.0000")
print("E2E_OMS_RMA_COMPENSATORY_OK=1")
`
    const verifyOut = execFileSync("docker", ["exec", CONTAINER, "python", "manage.py", "shell", "-c", verifyAndRunRmaPy], { encoding: "utf8" })
    assert.ok(verifyOut.includes("E2E_OMS_RMA_COMPENSATORY_OK=1"))
  } finally {
    await browser.close()
    await new Promise((resolve) => server.httpServer.close(resolve))
    const cleanupPy = `
from apps.users.models import User
User.objects.filter(email="${synthEmail}").update(is_active=False)
`
    try {
      execFileSync("docker", ["exec", CONTAINER, "python", "manage.py", "shell", "-c", cleanupPy], { encoding: "utf8" })
    } catch {
      // ignore cleanup errors
    }
  }
})
