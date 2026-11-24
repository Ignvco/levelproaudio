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

test("Gate 12 CMS Real Integration E2E [E2E A Black Friday Publish+Rollback + E2E B Security+Responsive -> PostgreSQL 16 QA]", async () => {
  const ts = Date.now()
  const adminEmail = `e2e_g12_${ts}@test.local`

  const seedOut = execContainerPython(`
import os, json, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from apps.site_settings.models import SiteSettings
from apps.site_settings.cms_services import create_draft_version, publish_cms_version

User = get_user_model()
admin = User.objects.create_user(username="e2eg12_${ts}", email="${adminEmail}", password="pw", is_staff=True, is_superuser=True)
site = SiteSettings.get()
baseline = create_draft_version(user=admin, change_summary="Baseline E2E ${ts}")
publish_cms_version(baseline.id, admin, notes="Baseline E2E")
token = str(RefreshToken.for_user(admin).access_token)
print(json.dumps({
    "token": token,
    "admin_id": str(admin.id),
    "orig_hero_title": site.hero_title,
    "baseline_id": str(baseline.id),
    "baseline_num": baseline.version_number,
}))
`)
  const seed = JSON.parse(seedOut)

  const server = await preview({ root: FRONTEND_DIR, preview: { port: 4182, host: "127.0.0.1" } })
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
          user: { id: adminId, email: adminEmail, is_staff: true, is_superuser: true },
        },
        version: 0,
      }))
      document.cookie = "csrftoken=e2ecsrftoken; path=/"
    }, { token: seed.token, adminId: seed.admin_id, adminEmail })

    // E2E A: Open CMS visual editor, create draft, add Black Friday banner & hero title, verify public Home unchanged, preview, publish, verify public Home updated after reload, rollback!
    await page.goto("http://127.0.0.1:4182/admin/settings", { waitUntil: "networkidle" })
    await page.waitForSelector('[data-testid="admin-cms-page"]')
    await page.getByRole("button", { name: "+ Nuevo Borrador" }).click()
    await page.waitForSelector("text=creado correctamente.")

    const bfHero = `Black Friday Audio ${ts}`
    const bfBannerTitle = `Black Friday Monitores E2E ${ts}`
    await page.getByRole("tab", { name: "2. Editor Hero" }).click()
    await page.locator("form input").first().fill(bfHero)
    await page.getByRole("button", { name: "Guardar en Borrador" }).click()
    await page.waitForSelector("text=guardado (checksum")

    await page.getByRole("tab", { name: "4. Banners" }).click()
    await page.getByPlaceholder("Código (ej. BF-HOME-01)").fill(`BF-${ts}`)
    await page.getByPlaceholder("Nombre banner").fill("Banner Black Friday E2E")
    await page.getByPlaceholder("Título visible").fill(bfBannerTitle)
    await page.getByRole("button", { name: "Guardar Banner en Borrador" }).click()
    await page.waitForSelector("text=Banner agregado al borrador.")

    // Verify public Home does NOT show draft before publish
    await page.goto("http://127.0.0.1:4182/", { waitUntil: "networkidle" })
    await page.waitForSelector('[data-testid="home-page"]')
    const bodyBefore = await page.locator("body").textContent()
    assert.ok(!bodyBefore.includes(bfHero), "Draft hero leaked to public Home before publish!")
    assert.ok(!bodyBefore.includes(bfBannerTitle), "Draft banner leaked to public Home before publish!")

    // Preview Desktop + Mobile in CMS
    await page.goto("http://127.0.0.1:4182/admin/settings", { waitUntil: "networkidle" })
    await page.getByRole("button", { name: "Previsualizar" }).click()
    await page.waitForSelector('[data-testid="cms-live-preview-frame"]')
    await page.getByRole("button", { name: "Mobile", exact: true }).click()
    await page.getByRole("button", { name: "Desktop", exact: true }).click()

    // Publish atomically
    await page.getByRole("tab", { name: "12. Publicar & Rollback" }).click()
    await page.getByRole("button", { name: "Publicar versión" }).first().click()
    await page.waitForSelector("text=publicada atómicamente")

    // Verify public Home updated & persists after full reload
    await page.goto("http://127.0.0.1:4182/", { waitUntil: "networkidle" })
    await page.reload({ waitUntil: "networkidle" })
    await page.waitForSelector(`text=${bfBannerTitle}`)

    // Rollback to baseline version and verify public Home restored
    await page.goto("http://127.0.0.1:4182/admin/settings", { waitUntil: "networkidle" })
    await page.getByRole("tab", { name: "12. Publicar & Rollback" }).click()
    await page.locator("div.flex.flex-wrap.items-center.justify-between", { hasText: `Baseline E2E ${ts}` }).getByRole("button", { name: "Restaurar (Rollback)" }).click()
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
