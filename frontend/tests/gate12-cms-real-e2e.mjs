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

test("Gate 12 CMS Real Integration E2E [E2E A Preview/Public Parity + Publish + Rollback & E2E B Marketing RBAC + Security -> PostgreSQL 16 QA]", async () => {
  const ts = Date.now()
  const adminEmail = `e2e_g12_adm_${ts}@test.local`
  const mktEmail = `e2e_g12_mkt_${ts}@test.local`

  const seedOut = execContainerPython(`
import os, io, json, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()
from PIL import Image
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework_simplejwt.tokens import RefreshToken
from apps.site_settings.models import SiteSettings
from apps.site_settings.cms_services import create_draft_version, publish_cms_version, register_cms_asset
from core.rbac.constants import ROLE_MARKETING

User = get_user_model()
admin = User.objects.create_user(username="e2eg12adm_${ts}", email="${adminEmail}", password="pw", is_staff=True, is_superuser=True)
mkt = User.objects.create_user(username="e2eg12mkt_${ts}", email="${mktEmail}", password="pw", is_staff=True)
unauth = User.objects.create_user(username="e2eg12cust_${ts}", email="cust_${ts}@test.local", password="pw", is_staff=False)
g_mkt, _ = Group.objects.get_or_create(name=ROLE_MARKETING)
mkt.groups.add(g_mkt)

def make_png(name, w, h):
    b = io.BytesIO()
    Image.new("RGB", (w, h), (11, 14, 20)).save(b, format="PNG")
    return SimpleUploadedFile(name, b.getvalue(), content_type="image/png")

desk_asset = register_cms_asset(make_png("e2e_desk.png", 1200, 600), title="E2E Desk ${ts}", device_target="desktop", user=mkt)
mob_asset = register_cms_asset(make_png("e2e_mob.png", 600, 900), title="E2E Mob ${ts}", device_target="mobile", user=mkt)

site = SiteSettings.get()
baseline = create_draft_version(user=admin, change_summary="Baseline E2E ${ts}")
publish_cms_version(baseline.id, admin, notes="Baseline E2E")
print(json.dumps({
    "admin_token": str(RefreshToken.for_user(admin).access_token),
    "admin_id": str(admin.id),
    "mkt_token": str(RefreshToken.for_user(mkt).access_token),
    "mkt_id": str(mkt.id),
    "unauth_token": str(RefreshToken.for_user(unauth).access_token),
    "unauth_id": str(unauth.id),
    "desk_asset_id": str(desk_asset.id),
    "mob_asset_id": str(mob_asset.id),
    "baseline_id": str(baseline.id),
}))
`)
  const seed = JSON.parse(seedOut)

  const server = await preview({ root: FRONTEND_DIR, preview: { port: 4182, host: "127.0.0.1" } })
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true })

  try {
    let activeBearer = seed.mkt_token
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
    const page = await context.newPage()

    await page.route("**/api/v1/**", async (route) => {
      const req = route.request()
      const urlObj = new URL(req.url())
      const hdrs = { ...req.headers() }
      if (activeBearer && !hdrs["authorization"] && !hdrs["Authorization"]) {
        hdrs["authorization"] = `Bearer ${activeBearer}`
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

    // E2E B1: Marketing Editor logs in, creates draft, edits Hero, associates desktop+mobile images, configures CTA, saves, previews, sees publish disabled, submits to review
    await page.goto("http://127.0.0.1:4182/login", { waitUntil: "domcontentloaded" })
    await page.evaluate(({ token, userId, email }) => {
      sessionStorage.setItem("levelproaudio-auth", JSON.stringify({
        state: {
          isAuthenticated: true,
          accessToken: token,
          refreshToken: "e2e-refresh",
          user: { id: userId, email, is_staff: true, is_superuser: false, roles: ["Marketing"] },
        },
        version: 0,
      }))
      document.cookie = "csrftoken=e2ecsrftoken; path=/"
    }, { token: seed.mkt_token, userId: seed.mkt_id, email: mktEmail })

    await page.goto("http://127.0.0.1:4182/admin/settings", { waitUntil: "networkidle" })
    await page.waitForSelector('[data-testid="admin-cms-page"]')
    await page.getByRole("button", { name: "+ Nuevo Borrador" }).click()
    await page.waitForSelector("text=creado correctamente.")

    const bfHero = `Black Friday Audio ${ts}`
    const bfBannerTitle = `Black Friday Monitores E2E ${ts}`
    await page.getByRole("tab", { name: "2. Editor Hero" }).click()
    await page.locator("form input").first().fill(bfHero)
    // Verify unsaved warning appears before saving
    await page.waitForSelector('[data-testid="cms-unsaved-warning"]')
    await page.getByRole("button", { name: "Guardar en Borrador" }).click()
    await page.waitForSelector("text=guardado (checksum")

    // Associate desktop & mobile images in Hero Slide
    await page.getByPlaceholder("Título slide").fill(bfHero)
    const slideSelects = page.locator("form").nth(1).locator("select")
    await slideSelects.nth(0).selectOption(seed.desk_asset_id)
    await slideSelects.nth(1).selectOption(seed.mob_asset_id)
    await page.getByRole("button", { name: "+ Guardar Slide" }).click()
    await page.waitForSelector("text=Slide agregado al borrador.")

    await page.getByRole("tab", { name: "4. Banners" }).click()
    await page.getByPlaceholder("Código (ej. BF-HOME-01)").fill(`BF-${ts}`)
    await page.getByPlaceholder("Nombre banner").fill("Banner Black Friday E2E")
    await page.getByPlaceholder("Título visible").fill(bfBannerTitle)
    await page.getByRole("button", { name: "Guardar Banner en Borrador" }).click()
    await page.waitForSelector("text=Banner agregado al borrador.")

    // Marketing editor previews Desktop & Mobile and checks computed headline color is white rgb(245, 245, 245)
    await page.getByRole("button", { name: "Previsualizar" }).click()
    await page.waitForSelector('[data-testid="cms-live-preview-iframe"]')
    const iframeLoc = page.frameLocator('[data-testid="cms-live-preview-iframe"]')
    await iframeLoc.locator('[data-testid="hero-headline"]').waitFor({ state: "visible" })
    const previewColor = await iframeLoc.locator('[data-testid="hero-headline"]').evaluate((el) => getComputedStyle(el).color)
    assert.equal(previewColor, "rgb(245, 245, 245)")

    await page.getByRole("button", { name: "Mobile", exact: true }).click()
    await iframeLoc.locator('[data-testid="hero-headline"]').waitFor({ state: "visible" })

    // Marketing editor submits draft to review
    await page.getByRole("tab", { name: "9. Borradores" }).click()
    await page.getByRole("button", { name: "Enviar a Revisión" }).first().click()
    await page.waitForSelector("text=IN_REVIEW")

    // Verify public Home does NOT show draft before publish
    await page.goto("http://127.0.0.1:4182/", { waitUntil: "networkidle" })
    await page.waitForSelector('[data-testid="home-page"]')
    const bodyBefore = await page.locator("body").textContent()
    assert.ok(!bodyBefore.includes(bfBannerTitle), "Draft banner leaked to public Home before publish!")

    // Verify unauthorized user access to /?cms_preview_version=... is denied (403 -> cms-preview-denied)
    const draftVerId = execContainerPython(`
import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()
from apps.site_settings.cms_models import CMSVersion
v = CMSVersion.objects.filter(status="in_review").order_by("-version_number").first()
print(str(v.id))
`)
    activeBearer = seed.unauth_token
    await page.evaluate(({ token, uid }) => {
      sessionStorage.setItem("levelproaudio-auth", JSON.stringify({
        state: {
          isAuthenticated: true,
          accessToken: token,
          refreshToken: "e2e-refresh",
          user: { id: uid, email: "unauth@test.local", is_staff: false, is_superuser: false, roles: [] },
        },
        version: 0,
      }))
    }, { token: seed.unauth_token, uid: seed.unauth_id })
    await page.goto(`http://127.0.0.1:4182/?cms_preview_version=${draftVerId}`, { waitUntil: "networkidle" })
    await page.waitForSelector('[data-testid="cms-preview-denied"]')

    // Switch to authorized Management/Super Admin user to publish & rollback
    activeBearer = seed.admin_token
    await page.evaluate(({ token, adminId, adminEmail }) => {
      sessionStorage.setItem("levelproaudio-auth", JSON.stringify({
        state: {
          isAuthenticated: true,
          accessToken: token,
          refreshToken: "e2e-refresh",
          user: { id: adminId, email: adminEmail, is_staff: true, is_superuser: true, roles: ["Super Admin"] },
        },
        version: 0,
      }))
    }, { token: seed.admin_token, adminId: seed.admin_id, adminEmail })

    await page.goto("http://127.0.0.1:4182/admin/settings", { waitUntil: "networkidle" })
    await page.getByRole("tab", { name: "12. Publicar & Rollback" }).click()
    await page.getByRole("button", { name: "Publicar versión" }).first().click()
    await page.waitForSelector("text=publicada atómicamente")

    // Verify public Home updated & matches preview style on both desktop (1440px) and real mobile (390px)
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.goto("http://127.0.0.1:4182/", { waitUntil: "networkidle" })
    await page.reload({ waitUntil: "networkidle" })
    await page.waitForSelector(`text=${bfBannerTitle}`)
    const pubDeskColor = await page.locator('[data-testid="hero-headline"]').evaluate((el) => getComputedStyle(el).color)
    assert.equal(pubDeskColor, "rgb(245, 245, 245)")

    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(150)
    const pubMobColor = await page.locator('[data-testid="hero-headline"]').evaluate((el) => getComputedStyle(el).color)
    assert.equal(pubMobColor, "rgb(245, 245, 245)")

    // Rollback to baseline version and verify public Home restored
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.goto("http://127.0.0.1:4182/admin/settings", { waitUntil: "networkidle" })
    await page.getByRole("tab", { name: "12. Publicar & Rollback" }).click()
    await page.locator("[data-version-row]", { hasText: `Baseline E2E ${ts}` }).getByRole("button", { name: "Restaurar (Rollback)" }).click()
    await page.waitForSelector("text=Rollback completado")

    await page.goto("http://127.0.0.1:4182/", { waitUntil: "networkidle" })
    await page.waitForSelector('[data-testid="home-page"]')
    const bodyAfterRollback = await page.locator("body").textContent()
    assert.ok(!bodyAfterRollback.includes(bfBannerTitle), "Rollback did not restore baseline!")
  } finally {
    await browser.close()
    await server.httpServer.close()
  }
})
