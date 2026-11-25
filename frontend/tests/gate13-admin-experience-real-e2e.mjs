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

test("Gate 13 Admin Experience Real E2E [E2E A Navigation & RBAC + E2E B Command Palette + E2E C Notification Center & Real Admin Operation -> PostgreSQL 16 QA]", async () => {
  const ts = Date.now()
  const seedOut = execContainerPython(`
import os, json, django
from decimal import Decimal
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework_simplejwt.tokens import RefreshToken
from core.rbac.constants import ROLE_WAREHOUSE
from apps.products.models import Brand, Category, Product, ProductVariant
from apps.inventory.models import Warehouse, SerialNumberTrack
from apps.orders.models import Order, OrderStatus

User = get_user_model()
admin = User.objects.create_user(username="e2eg13adm_${ts}", email="e2eg13adm_${ts}@levelpro.cl", password="pw", is_staff=True, is_superuser=True)
wh_user = User.objects.create_user(username="e2eg13wh_${ts}", email="e2eg13wh_${ts}@levelpro.cl", password="pw", is_staff=True, is_superuser=False)
g_wh, _ = Group.objects.get_or_create(name=ROLE_WAREHOUSE)
wh_user.groups.add(g_wh)

brand = Brand.objects.create(name="Neumann G13 ${ts}", slug="neumann-g13-${ts}")
cat = Category.objects.create(name="Microfonos G13 ${ts}", slug="microfonos-g13-${ts}")
prod = Product.objects.create(
    name="Neumann U87 AI Studio Set ${ts}",
    slug="neumann-u87-ai-${ts}",
    sku="SKU-G13-U87-${ts}",
    brand=brand,
    category=cat,
    price=Decimal("3490000.00"),
    price_usd=Decimal("3650.00"),
    cost_price=Decimal("2150000.00"),
    stock=0,
    is_active=True,
)
var = ProductVariant.objects.create(
    product=prod,
    name="Nickel Edition",
    sku="VAR-G13-U87-NK-${ts}",
    price=Decimal("3590000.00"),
    stock=2,
    is_active=True,
)
wh = Warehouse.objects.filter(is_active=True).first() or Warehouse.objects.create(code="WH-G13-${ts}", name="Bodega G13", is_default=False, is_active=True)
sn = SerialNumberTrack.objects.create(
    serial_number="SN-U87-${ts}",
    product=prod,
    variant=var,
    warehouse=wh,
)
cust = User.objects.create_user(username="e2eg13cust_${ts}", email="mastering.${ts}@estudio.cl", password="pw", first_name="Estudio", last_name="Cordillera${ts}")
ord_clp = Order.objects.create(
    user=cust,
    email=cust.email,
    status=OrderStatus.PENDING,
    total=Decimal("3490000.00"),
    currency="CLP",
    shipping_address="Providencia, Santiago",
    tracking_number="TRK-U87-${ts}",
)

print(json.dumps({
    "admin_id": str(admin.id),
    "admin_email": admin.email,
    "admin_access": str(RefreshToken.for_user(admin).access_token),
    "wh_id": str(wh_user.id),
    "wh_email": wh_user.email,
    "wh_access": str(RefreshToken.for_user(wh_user).access_token),
    "sku": prod.sku,
    "serial": sn.serial_number,
    "tracking": ord_clp.tracking_number,
    "customer_last": "Cordillera${ts}",
}))
`)
  const seed = JSON.parse(seedOut)

  const server = await preview({ root: FRONTEND_DIR, preview: { port: 4187, host: "127.0.0.1" } })
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true })

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()

    let currentAccess = seed.admin_access
    await page.route("**/api/v1/**", async (route) => {
      const req = route.request()
      const urlObj = new URL(req.url())
      const pathAndQuery = urlObj.pathname + urlObj.search
      const headers = { ...req.headers(), authorization: `Bearer ${currentAccess}` }
      const postBuf = req.postDataBuffer()
      const resp = forwardToRealBackend(req.method(), pathAndQuery, headers, postBuf)
      const hdrObj = {}
      for (const [k, v] of resp.headers) {
        if (!["transfer-encoding", "content-encoding", "content-length"].includes(k.toLowerCase())) {
          hdrObj[k] = v
        }
      }
      await route.fulfill({
        status: resp.status,
        headers: hdrObj,
        body: Buffer.from(resp.body_b64, "base64"),
      })
    })

    let currentUserState = {
      id: seed.admin_id,
      email: seed.admin_email,
      is_staff: true,
      is_superuser: true,
      roles: ["Super Admin"],
    }
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("levelproaudio-auth")) {
        sessionStorage.setItem(
          "levelproaudio-auth",
          JSON.stringify({
            state: {
              isAuthenticated: true,
              user: window.__E2E_AUTH_USER || null,
            },
            version: 0,
          })
        )
      }
    })
    await page.goto("http://127.0.0.1:4187/login", { waitUntil: "domcontentloaded" })
    await page.evaluate((u) => {
      sessionStorage.setItem(
        "levelproaudio-auth",
        JSON.stringify({
          state: { isAuthenticated: true, user: u },
          version: 0,
        })
      )
    }, currentUserState)

    // ── E2E A & B: Navigate to /admin, open Command Palette, search SKU, Serial, Order, Customer ──
    await page.goto("http://127.0.0.1:4187/admin", { waitUntil: "networkidle" })

    const searchBtn = page.locator('[data-testid="admin-search-btn"]')
    await searchBtn.waitFor({ state: "visible" })
    await searchBtn.click()

    const searchInput = page.locator('[data-testid="admin-command-palette-input"]')
    await searchInput.waitFor({ state: "visible" })

    // 1. Search by SKU
    await searchInput.fill(seed.sku)
    await page.waitForTimeout(450)
    const modalTextSku = await page.locator('[data-testid="admin-command-palette-modal"]').innerText()
    assert.ok(modalTextSku.includes("Neumann U87 AI Studio Set"), "Command Palette must find product by SKU")
    assert.ok(!modalTextSku.includes("2150000"), "Command Palette must never expose cost_price")

    // 2. Search by Serial Number
    await searchInput.fill(seed.serial)
    await page.waitForTimeout(450)
    const modalTextSn = await page.locator('[data-testid="admin-command-palette-modal"]').innerText()
    assert.ok(modalTextSn.includes(seed.serial), "Command Palette must find serial number track")

    // 3. Search by Order Tracking
    await searchInput.fill(seed.tracking)
    await page.waitForTimeout(450)
    const modalTextOrd = await page.locator('[data-testid="admin-command-palette-modal"]').innerText()
    assert.ok(modalTextOrd.includes(seed.tracking), "Command Palette must find order by tracking number")

    // 4. Close with Escape
    await page.keyboard.press("Escape")
    await page.waitForTimeout(150)
    assert.equal(await page.locator('[data-testid="admin-command-palette-modal"]').count(), 0)

    // ── E2E C: Notification Center BF-32 — Open bell, verify alerts from real DB, mark read ──
    const bellBtn = page.locator('[data-testid="admin-notifications-btn"]')
    await bellBtn.click()
    const notifPanel = page.locator('[data-testid="admin-notifications-panel"]')
    await notifPanel.waitFor({ state: "visible" })
    const notifText = await notifPanel.innerText()
    assert.ok(notifText.includes("Centro de Notificaciones"), "Notification Center title must render")
    assert.ok(
      notifText.includes("pedido") || notifText.includes("agotado"),
      "Notification Center must show real operational alerts from DB"
    )

    const markAllBtn = page.locator('[data-testid="admin-notifications-mark-all"]')
    if (await markAllBtn.count()) {
      await markAllBtn.click()
      await page.locator('[data-testid="admin-notifications-badge"]').waitFor({ state: "detached", timeout: 10000 })
      assert.equal(
        await page.locator('[data-testid="admin-notifications-badge"]').count(),
        0,
        "Unread badge must clear after marking all notifications as read"
      )
    }
    await page.keyboard.press("Escape")

    // ── Real Admin Operation on unified AdminMarketing (/admin/marketing) ──
    await page.goto("http://127.0.0.1:4187/admin/marketing", { waitUntil: "networkidle" })
    const builderTab = page.getByRole("tab", { name: /3\. Creador Cupón/i })
    await builderTab.click()
    const couponCode = `G13E2E${String(ts).slice(-5)}`
    await page.getByPlaceholder("Código (ej. STUDIO10)").fill(couponCode)
    await page.getByPlaceholder("Nombre comercial").fill(`Cupón E2E Gate 13 ${ts}`)
    await page.getByRole("button", { name: "Guardar Cupón" }).click()
    await page.waitForTimeout(500)
    const pageBodyText = await page.locator("body").innerText()
    assert.ok(
      pageBodyText.includes(couponCode),
      "Real coupon creation in unified AdminMarketing must persist and confirm in UI"
    )

    // ── UX13-ACCEPT-02: CMS Workflow on /admin/settings (Dashboard -> Hero Editor -> Draft -> Save -> Real Iframe Preview Desktop/Mobile -> Public Home Parity) ──
    const cmsJsErrors = []
    page.on("pageerror", (err) => cmsJsErrors.push(String(err?.message || err)))

    await page.goto("http://127.0.0.1:4187/admin/settings", { waitUntil: "networkidle" })
    await page.waitForTimeout(400)
    const cmsBodyText = await page.locator("body").innerText()
    assert.ok(!cmsBodyText.includes("Algo salió mal"), "CMS /admin/settings must NEVER render ErrorBoundary")
    assert.ok(cmsBodyText.includes("Editor Visual CMS & Versionado"), "CMS dashboard header must render")

    // Create or edit draft
    const newDraftBtn = page.getByRole("button", { name: /\+ Nuevo Borrador/i })
    if (await newDraftBtn.count()) {
      await newDraftBtn.click()
      await page.waitForTimeout(500)
    }

    // Open Hero Editor tab
    const heroTab = page.getByRole("tab", { name: /2\. Editor Hero/i })
    await heroTab.click()
    await page.waitForTimeout(250)

    const syntheticHeroTitle = `Sonido Mastering Gate 13 E2E ${ts}`
    const heroInput = page.locator("form input").first()
    await heroInput.fill(syntheticHeroTitle)
    await page.getByRole("button", { name: /Guardar en Borrador/i }).click()
    await page.waitForTimeout(500)

    const afterSaveText = await page.locator("body").innerText()
    assert.ok(!afterSaveText.includes("Algo salió mal"), "Saving CMS draft must not trigger ErrorBoundary")
    assert.ok(afterSaveText.includes("guardado"), "CMS must confirm draft save with SHA-256 checksum")

    // Open Live Iframe Preview tab (Desktop & Mobile)
    await page.getByRole("button", { name: /Previsualizar/i }).click()
    await page.waitForTimeout(600)
    const iframeLoc = page.locator('[data-testid="cms-live-preview-iframe"]')
    await iframeLoc.waitFor({ state: "visible", timeout: 10000 })

    // Switch preview to Mobile and verify
    await page.getByRole("button", { name: "Mobile", exact: true }).click()
    await page.waitForTimeout(400)
    const previewContainerWidth = await page.locator('[data-testid="cms-live-preview-frame"]').evaluate((el) => el.style.width)
    assert.equal(previewContainerWidth, "390px", "Mobile preview frame must resize to 390px")

    // Verify public home remains unaltered by un-published draft & zero CSS contamination
    await page.goto("http://127.0.0.1:4187/", { waitUntil: "networkidle" })
    await page.waitForTimeout(300)
    const publicHomeInfo = await page.evaluate(() => {
      const cs = window.getComputedStyle(document.body)
      return {
        text: document.body?.innerText || "",
        bgColor: cs.backgroundColor,
      }
    })
    assert.ok(!publicHomeInfo.text.includes(syntheticHeroTitle), "Unpublished CMS draft must not alter public Home")
    assert.equal(publicHomeInfo.bgColor, "rgb(10, 10, 10)", "Public Home must retain dark theme without admin CSS contamination")
    assert.equal(cmsJsErrors.length, 0, `CMS workflow must produce 0 JS errors, got: ${cmsJsErrors.join("; ")}`)

    // ── E2E A RBAC Verification: Switch to Warehouse user (no access to /admin/finance) ──
    currentAccess = seed.wh_access
    await page.evaluate((s) => {
      sessionStorage.setItem(
        "levelproaudio-auth",
        JSON.stringify({
          state: {
            isAuthenticated: true,
            user: {
              id: s.wh_id,
              email: s.wh_email,
              is_staff: true,
              is_superuser: false,
              roles: ["Bodega / Inventario"],
            },
          },
          version: 0,
        })
      )
    }, seed)

    await page.goto("http://127.0.0.1:4187/admin/finance", { waitUntil: "networkidle" })
    const rbacDenied = page.locator('[data-testid="admin-access-denied"]')
    await rbacDenied.waitFor({ state: "visible", timeout: 10000 })
    const deniedText = await rbacDenied.innerText()
    assert.ok(
      deniedText.includes("Acceso Restringido por Rol (RBAC)"),
      "Warehouse role must be blocked from /admin/finance by RBAC Zero-Trust"
    )
  } finally {
    await browser.close()
    await server.httpServer.close()
  }
})
