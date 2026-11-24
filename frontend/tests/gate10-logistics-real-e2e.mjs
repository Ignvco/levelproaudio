import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
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
    with urllib.request.urlopen(r, timeout=20) as resp:
        out_hdrs = [[k, v] for k, v in resp.headers.items()]
        print(json.dumps({"status": resp.status, "headers": out_hdrs, "body_b64": base64.b64encode(resp.read()).decode()}))
except urllib.error.HTTPError as e:
    out_hdrs = [[k, v] for k, v in e.headers.items()]
    print(json.dumps({"status": e.code, "headers": out_hdrs, "body_b64": base64.b64encode(e.read()).decode()}))
`
  const res = spawnSync("docker", ["exec", "-i", CONTAINER, "python", "-c", py], {
    input: payload,
    encoding: "utf8",
    maxBuffer: 15 * 1024 * 1024,
  })
  if (res.status !== 0) throw new Error(`Docker proxy error: ${res.stderr}`)
  return JSON.parse(res.stdout.trim())
}

function execContainerPython(pyCode) {
  const res = spawnSync("docker", ["exec", "-i", CONTAINER, "python", "-c", pyCode], {
    encoding: "utf8",
    maxBuffer: 15 * 1024 * 1024,
  })
  if (res.status !== 0) throw new Error(`Container python error: ${res.stderr}`)
  return res.stdout.trim()
}

test("Gate 10 Logistics & After-Sales Real Integration E2E [E2E A + E2E B -> Real Django API -> PostgreSQL 16 QA]", async () => {
  const ts = Date.now()
  const adminEmail = `e2e_g10_${ts}@test.local`

  const seedOut = execContainerPython(`
import os, json, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()
from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from apps.products.models import Category, Product
from apps.inventory.models import SerialNumberTrack
from apps.inventory.services import get_default_warehouse, receive_stock_into_warehouse, reserve_stock_for_order, consolidate_order_reservations
from apps.orders.models import Order, OrderItem, OrderStatus, ReturnMerchandiseAuthorization
from apps.orders.courier_adapters import ensure_default_carriers_seeded
from apps.orders.logistics_models import WarrantyPolicySnapshot
from core.contracts.states import CommercialStatus, FinancialStatus, FulfillmentStatus

User = get_user_model()
admin = User.objects.create_superuser(username="e2e_g10_${ts}", email="${adminEmail}", password="E2ePassword123!")
access_token = str(RefreshToken.for_user(admin).access_token)
wh = get_default_warehouse()
cat = Category.objects.create(name="G10 E2E ${ts}", slug="g10-e2e-${ts}")
prod = Product.objects.create(name="Monitor E2E ${ts}", slug="mon-e2e-${ts}", sku="MON-E2E-${ts}", category=cat, price=Decimal("300000.00"), stock=5)
part = Product.objects.create(name="Repuesto E2E ${ts}", slug="rep-e2e-${ts}", sku="REP-E2E-${ts}", category=cat, price=Decimal("10000.00"), stock=5)
receive_stock_into_warehouse(warehouse=wh, product=prod, quantity=5, actor=admin)
receive_stock_into_warehouse(warehouse=wh, product=part, quantity=5, actor=admin)
ensure_default_carriers_seeded()

order = Order.objects.create(
    user=admin, email="${adminEmail}", status=OrderStatus.PAID,
    commercial_status=CommercialStatus.CONFIRMED.value,
    financial_status=FinancialStatus.PAID.value,
    fulfillment_status=FulfillmentStatus.ALLOCATED.value,
    total=Decimal("300000.00"), currency="CLP", shipping_address="Av. E2E 1000, Santiago",
)
item = OrderItem.objects.create(order=order, product=prod, product_name=prod.name, quantity=1, price=Decimal("300000.00"))
reserve_stock_for_order(order, demand={prod.id: 1}, actor=admin)
consolidate_order_reservations(order, actor=admin)

sn = "SN-E2E-${ts}"
SerialNumberTrack.objects.create(product=prod, warehouse=wh, serial_number=sn, status=SerialNumberTrack.Status.DISPATCHED, order=order, customer=admin)
WarrantyPolicySnapshot.objects.create(product=prod, manufacturer_days=365, legal_days=180, source_reference="Política E2E")
rma = ReturnMerchandiseAuthorization.objects.create(rma_number="RMA-E2E-${ts}", order=order, requested_by=admin, reason_code=ReturnMerchandiseAuthorization.ReasonCode.DEFECTIVE, reason_details="Falla E2E")

print(json.dumps({
    "admin_id": str(admin.id),
    "access_token": access_token,
    "wh_id": str(wh.id),
    "cat_id": str(cat.id),
    "prod_id": str(prod.id),
    "part_id": str(part.id),
    "order_id": str(order.id),
    "order_short": str(order.id)[:8].upper(),
    "item_id": str(item.id),
    "rma_id": str(rma.id),
    "serial": sn,
}))
`)
  const seeded = JSON.parse(seedOut)

  const server = await preview({ configFile: false, preview: { port: 0, host: "127.0.0.1" } })
  const baseUrl = `http://127.0.0.1:${server.httpServer.address().port}`
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  })

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 920 } })
    const page = await context.newPage()

    await page.addInitScript((userObj) => {
      document.cookie = "csrftoken=e2e-csrf; path=/"
      sessionStorage.setItem("levelproaudio-auth", JSON.stringify({
        state: { isAuthenticated: true, user: userObj },
        version: 0,
      }))
    }, { id: seeded.admin_id, email: adminEmail, is_staff: true, is_superuser: true })

    await page.route("**/api/v1/**", async (route) => {
      const req = route.request()
      const urlObj = new URL(req.url())
      const hdrs = { ...req.headers(), Authorization: `Bearer ${seeded.access_token}` }
      const resp = forwardToRealBackend(req.method(), urlObj.pathname + urlObj.search, hdrs, req.postDataBuffer())
      const respHeaders = {}
      for (const [k, v] of resp.headers) {
        if (!["transfer-encoding", "content-encoding", "content-length"].includes(k.toLowerCase())) respHeaders[k] = v
      }
      await route.fulfill({ status: resp.status, headers: respHeaders, body: Buffer.from(resp.body_b64, "base64") })
    })

    // E2E A: Logística completa desde UI + API real
    await page.goto(`${baseUrl}/admin/logistics`, { waitUntil: "networkidle" })
    await page.waitForSelector(`text=${seeded.order_short}`)
    await page.locator("tr", { hasText: seeded.order_short }).getByRole("button", { name: "Crear envío" }).click()
    await page.waitForSelector(`text=#${seeded.order_short}`)

    // Agregar 2 bultos, cotizar, preparar, empacar, generar etiquetas, manifiesto, handover, tracking DELIVERED
    const shpRow = page.locator("tr", { hasText: seeded.order_short })
    await shpRow.getByRole("button", { name: "+ Bulto" }).click()
    await page.getByRole("button", { name: "Guardar" }).click()
    await page.waitForTimeout(400)
    await shpRow.getByRole("button", { name: "+ Bulto" }).click()
    await page.getByRole("button", { name: "Guardar" }).click()
    await page.waitForTimeout(400)
    await shpRow.getByRole("button", { name: "Cotizar" }).click()
    await page.getByRole("button", { name: "Guardar" }).click()
    await page.waitForTimeout(400)
    await shpRow.getByRole("button", { name: "Preparar" }).click()
    await page.waitForTimeout(400)
    await shpRow.getByRole("button", { name: "Empacar" }).click()
    await page.waitForTimeout(400)
    await shpRow.getByRole("button", { name: "Etiqueta" }).click()
    await page.waitForTimeout(500)

    // Manifiesto: crear -> agregar -> cerrar -> confirmar retiro
    await page.getByRole("button", { name: "Manifiestos" }).click()
    await page.getByRole("button", { name: "Nuevo manifiesto" }).click()
    await page.getByRole("button", { name: "Guardar" }).click()
    await page.waitForTimeout(400)
    await page.getByRole("button", { name: "+ Envío" }).first().click()
    await page.waitForTimeout(400)
    await page.getByRole("button", { name: "Cerrar" }).first().click()
    await page.waitForTimeout(400)
    await page.getByRole("button", { name: "Confirmar retiro" }).first().click()
    await page.waitForSelector('text=Evidencia / N° retiro transportista')
    await page.getByRole("button", { name: "Guardar" }).click()
    await page.waitForSelector('text=Evidencia / N° retiro transportista', { state: "detached", timeout: 15000 })

    // Tracking -> DELIVERED
    await page.getByRole("button", { name: "Tracking & Incidencias" }).click()
    await page.getByRole("button", { name: "Registrar evento" }).click()
    await page.getByRole("button", { name: "Guardar" }).click()
    await page.waitForTimeout(600)

    // E2E B: Validador de serial + Garantía + Taller desde UI
    await page.getByRole("button", { name: "Garantías & Seriales" }).click()
    await page.fill('input[placeholder="Ej: SN-G10-WAR-001"]', seeded.serial)
    await page.getByRole("button", { name: "Validar serial" }).click()
    await page.waitForSelector("text=legal_warranty")

    await page.getByRole("button", { name: "Servicio Técnico" }).click()
    await page.getByRole("button", { name: "Nueva orden taller" }).click()
    await page.fill('textarea', "Sin audio en salida L")
    await page.getByRole("button", { name: "Guardar" }).click()
    await page.waitForTimeout(500)

    // Descargar PDFs reales de etiqueta y manifiesto para evidencia documental y verificar PostgreSQL
    const pdfAndVerify = execContainerPython(`
import os, json, base64, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()
from apps.orders.models import Order
from apps.inventory.models import WarehouseStock, InventoryMovement
from apps.orders.logistics_models import Shipment, ShipmentLabel, ShippingManifest, RepairWorkOrder
from apps.orders.logistics_services import consume_repair_part
from apps.orders.logistics_pdf import render_shipping_label_pdf, render_shipping_manifest_pdf
from apps.products.models import Product
from apps.inventory.models import Warehouse
from django.contrib.auth import get_user_model

o = Order.objects.get(pk="${seeded.order_id}")
shp = Shipment.objects.get(order=o)
lbl = shp.labels.first()
man = shp.manifest_item.manifest
rwo = RepairWorkOrder.objects.order_by("-created_at").first()
admin = get_user_model().objects.get(pk="${seeded.admin_id}")
part = Product.objects.get(pk="${seeded.part_id}")
wh = Warehouse.objects.get(pk="${seeded.wh_id}")
consume_repair_part(rwo, product=part, warehouse=wh, quantity=1, idempotency_key="E2E-PART-${ts}", actor=admin)
consume_repair_part(rwo, product=part, warehouse=wh, quantity=1, idempotency_key="E2E-PART-${ts}", actor=admin)

lbl_pdf, _ = render_shipping_label_pdf(lbl)
man_pdf, _ = render_shipping_manifest_pdf(man)

print(json.dumps({
    "order_fulfillment": o.fulfillment_status,
    "shp_status": shp.status,
    "man_status": man.status,
    "pkg_count": shp.packages.count(),
    "part_stock": WarehouseStock.objects.get(warehouse=wh, product=part).physical_quantity,
    "part_moves": InventoryMovement.objects.filter(source_document_type="repair_work_order", source_document_id=str(rwo.id)).count(),
    "lbl_pdf_b64": base64.b64encode(lbl_pdf).decode(),
    "man_pdf_b64": base64.b64encode(man_pdf).decode(),
}))
`)
    const res = JSON.parse(pdfAndVerify)
    assert.equal(res.order_fulfillment, "delivered")
    assert.equal(res.shp_status, "delivered")
    assert.equal(res.man_status, "handed_over")
    assert.equal(res.pkg_count, 2)
    assert.equal(res.part_stock, 4)
    assert.equal(res.part_moves, 1)

    fs.writeFileSync(path.join(OUT_DIR, "gate10_sample_label.pdf"), Buffer.from(res.lbl_pdf_b64, "base64"))
    fs.writeFileSync(path.join(OUT_DIR, "gate10_sample_manifest.pdf"), Buffer.from(res.man_pdf_b64, "base64"))
  } finally {
    await browser.close()
    await new Promise((res) => server.httpServer.close(res))
    execContainerPython(`
import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()
from django.contrib.auth import get_user_model
from apps.orders.logistics_models import (
    RepairWorkOrder, WarrantyClaim, ShippingManifestItem, ShippingManifest, ShipmentLabel, ShipmentPackage, Shipment,
    TrackingEvent, LogisticsNotificationOutbox, WarrantyPolicySnapshot, ShippingQuoteSnapshot
)
from apps.orders.models import ReturnMerchandiseAuthorization, Order
from apps.inventory.models import SerialNumberTrack, StockReservation
from apps.products.models import Product, Category
ShippingManifestItem.objects.filter(shipment__order_id="${seeded.order_id}").delete()
ShippingManifest.objects.filter(items__isnull=True).delete()
TrackingEvent.objects.filter(shipment__order_id="${seeded.order_id}").delete()
ShipmentLabel.objects.filter(shipment__order_id="${seeded.order_id}").delete()
ShipmentPackage.objects.filter(shipment__order_id="${seeded.order_id}").delete()
Shipment.objects.filter(order_id="${seeded.order_id}").delete()
ShippingQuoteSnapshot.objects.filter(order_id="${seeded.order_id}").delete()
LogisticsNotificationOutbox.objects.filter(order_id="${seeded.order_id}").delete()
get_user_model().objects.filter(pk="${seeded.admin_id}").update(is_active=False)
`)
  }
})
