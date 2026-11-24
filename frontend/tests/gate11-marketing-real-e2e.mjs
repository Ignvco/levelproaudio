import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { preview } from "vite"
import { chromium } from "playwright"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIR = path.resolve(__dirname, "..")
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

test("Gate 11 Marketing & Growth Real Integration E2E [E2E A + E2E B -> Real Django API -> PostgreSQL 16 QA]", async () => {
  const ts = Date.now()
  const adminEmail = `e2e_g11_adm_${ts}@test.local`
  const custEmail = `e2e_g11_cust_${ts}@test.local`
  const couponCode = `E2E11USD${String(ts).slice(-4)}`

  const seedOut = execContainerPython(`
import os, json, django
from datetime import timedelta
from decimal import Decimal
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken
from apps.products.models import Category, Product
from apps.orders.models import Cart, CartItem

User = get_user_model()
admin = User.objects.create_user(username="e2eg11adm_${ts}", email="${adminEmail}", password="pw", is_staff=True, is_superuser=True)
cust = User.objects.create_user(username="e2eg11cust_${ts}", email="${custEmail}", password="pw")
cat, _ = Category.objects.get_or_create(slug="e2e-g11-cat", defaults={"name": "E2E G11 Cat"})
prod = Product.objects.create(name="Monitor Studio E2E ${ts}", slug="mon-e2e-${ts}", sku="MON-E2E-${ts}", category=cat, price=Decimal("200000.00"), price_usd=Decimal("250.00"), price_ars=Decimal("300000.00"), stock=5)
cart = Cart.objects.create(user=cust, is_active=True)
CartItem.objects.create(cart=cart, product=prod, quantity=1)
Cart.objects.filter(id=cart.id).update(updated_at=timezone.now() - timedelta(minutes=90))
token = str(RefreshToken.for_user(admin).access_token)
print(json.dumps({"token": token, "admin_id": str(admin.id), "cust_id": str(cust.id), "prod_id": str(prod.id), "cart_id": str(cart.id)}))
`)
  const seed = JSON.parse(seedOut)

  const server = await preview({ root: FRONTEND_DIR, preview: { port: 4178, host: "127.0.0.1" } })
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true })

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
    const page = await context.newPage()

    await page.route("**/api/v1/**", async (route) => {
      const req = route.request()
      const urlObj = new URL(req.url())
      const hdrs = { ...req.headers() }
      if (!hdrs["authorization"] && !hdrs["Authorization"]) {
        hdrs["authorization"] = `Bearer ${seed.token}`
      }
      const resp = forwardToRealBackend(
        req.method(),
        urlObj.pathname + urlObj.search,
        hdrs,
        req.postDataBuffer()
      )
      const headersObj = {}
      for (const [k, v] of resp.headers) {
        if (!["transfer-encoding", "content-encoding", "content-length"].includes(k.toLowerCase())) {
          headersObj[k] = v
        }
      }
      await route.fulfill({
        status: resp.status,
        headers: headersObj,
        body: Buffer.from(resp.body_b64, "base64"),
      })
    })

    await page.addInitScript(({ token, adminId, adminEmail }) => {
      sessionStorage.setItem("levelproaudio-auth", JSON.stringify({
        state: {
          isAuthenticated: true,
          accessToken: token,
          refreshToken: "e2e-refresh",
          user: { id: adminId, username: "e2eg11adm", email: adminEmail, is_staff: true, is_superuser: true },
        },
        version: 0,
      }))
      document.cookie = "csrftoken=e2ecsrftoken; path=/"
    }, { token: seed.token, adminId: seed.admin_id, adminEmail })

    await page.goto("http://127.0.0.1:4178/admin/marketing", { waitUntil: "networkidle" })
    await page.waitForSelector("text=Promociones, Cupones & Recuperación de Carritos")

    // E2E A: Create USD 10% coupon via real UI -> real Django -> PostgreSQL 16 QA
    await page.getByRole("button", { name: "3. Creador Cupón" }).click()
    await page.getByPlaceholder("Código (ej. STUDIO10)").fill(couponCode)
    await page.getByPlaceholder("Nombre comercial").fill("E2E 10% USD")
    await page.locator("form select").first().selectOption("USD")
    await page.getByRole("button", { name: "Guardar Cupón" }).click()
    await page.waitForSelector(`text=Cupón ${couponCode} (USD) creado correctamente.`)

    // E2E A2: Pricing preview via real UI
    await page.getByRole("button", { name: "8. Previsualización" }).click()
    await page.locator("form select").first().selectOption("USD")
    await page.getByPlaceholder("Subtotal").fill("250.00")
    await page.getByPlaceholder("Código cupón").fill(couponCode)
    await page.getByRole("button", { name: "Simular Cálculo Comercial" }).click()
    await page.waitForSelector("pre")
    const preText = await page.locator("pre").textContent()
    assert.ok(preText.includes('"coupon_discount": "25.00"'), `Unexpected preview output: ${preText}`)

    // E2E B: Record opt-in consent, detect abandoned cart, dispatch QA outbox
    await page.getByRole("button", { name: "11. Consentimiento & Outbox" }).click()
    await page.getByPlaceholder("cliente@dominio.cl").fill(custEmail)
    await page.getByRole("button", { name: "Registrar" }).click()
    await page.waitForSelector(`text=Consentimiento actualizado para ${custEmail}`)

    await page.getByRole("button", { name: "9. Carritos Abandonados" }).click()
    await page.getByRole("button", { name: "Detectar Inactivos (60m)" }).click()
    await page.waitForSelector(`text=${custEmail}`)
    await page.locator("div.flex.flex-wrap.items-center.justify-between", { hasText: custEmail }).getByRole("button", { name: "Preparar Recuperación QA" }).click()
    await page.waitForSelector("text=skipped_qa")

    // Verify recovery token resolution + order conversion suppression in PostgreSQL 16 QA
    const verifyDb = execContainerPython(`
import os, json, django
from decimal import Decimal
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()
from apps.orders.marketing_models import AbandonedCartTrigger, Coupon, MarketingMessageOutbox
from apps.orders.marketing_services import resolve_cart_recovery_token, mark_cart_recovered_for_order, prepare_and_dispatch_cart_recovery
from apps.orders.models import Order, OrderStatus

c = Coupon.objects.get(code="${couponCode}")
trg = AbandonedCartTrigger.objects.filter(user__email="${custEmail}").first()
resolved = resolve_cart_recovery_token(trg.recovery_token)
order = Order.objects.create(user=trg.user, total=Decimal("200000.00"), status=OrderStatus.PAID)
updated = mark_cart_recovered_for_order(order, cart=trg.cart)
sup = prepare_and_dispatch_cart_recovery(trg.id)
outbox_count = MarketingMessageOutbox.objects.filter(recipient_email="${custEmail}", status="skipped_qa").count()
print(json.dumps({
    "coupon_currency": c.currency,
    "resolved_valid": resolved["valid"],
    "recovered_updated": updated,
    "post_conversion_reason": sup.get("reason"),
    "outbox_count": outbox_count,
}))
`)
    const dbRes = JSON.parse(verifyDb)
    assert.equal(dbRes.coupon_currency, "USD")
    assert.equal(dbRes.resolved_valid, true)
    assert.equal(dbRes.recovered_updated, 1)
    assert.equal(dbRes.post_conversion_reason, "already_recovered")
    assert.equal(dbRes.outbox_count, 1)
  } finally {
    await browser.close()
    await server.httpServer.close()
  }
})
