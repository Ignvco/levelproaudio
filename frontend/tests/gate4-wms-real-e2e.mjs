import test from "node:test"
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { preview } from "vite"
import { chromium } from "playwright"

const CONTAINER = "levelpro-v32-qa-backend-1"

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

test("Gate 4 WMS Real Integration Smoke [Browser -> Real Django API -> PostgreSQL 16 QA]", async () => {
  const synthEmail = `e2e_wms_${Date.now()}@test.local`
  const synthPass = "SynthPass123!"

  // Crear usuario sintético en PostgreSQL QA y emitir JWT real (SimpleJWT)
  const tokenOut = execFileSync("docker", [
    "exec", CONTAINER, "python", "manage.py", "shell", "-c",
    `from apps.users.models import User; from django.contrib.auth.models import Group; from django.core.management import call_command; from rest_framework_simplejwt.tokens import RefreshToken; call_command('setup_rbac'); u = User.objects.create_user(username='${synthEmail}', email='${synthEmail}', password='${synthPass}', is_staff=True, is_superuser=True); u.groups.add(Group.objects.get(name='Super Admin')); print('JWT_TOKEN=' + str(RefreshToken.for_user(u).access_token))`,
  ], { encoding: "utf8" })
  const jwtMatch = tokenOut.match(/JWT_TOKEN=([^\s]+)/)
  assert.ok(jwtMatch, "Debe emitirse un JWT real desde Django")
  const realJwt = jwtMatch[1]

  const server = await preview({ configFile: false, preview: { port: 0, host: "127.0.0.1" } })
  const baseUrl = `http://127.0.0.1:${server.httpServer.address().port}`
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] })

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    await context.route("**/api/**", async (route) => {
      const req = route.request()
      const u = new URL(req.url())
      const pathAndQuery = u.pathname + u.search
      const fwdHeaders = { ...req.headers(), authorization: `Bearer ${realJwt}` }
      const resp = forwardToRealBackend(req.method(), pathAndQuery, fwdHeaders, req.postDataBuffer())
      const hdrMap = {}
      for (const [k, v] of resp.headers) {
        if (k.toLowerCase() !== "transfer-encoding") hdrMap[k] = v
      }
      await route.fulfill({
        status: resp.status,
        headers: hdrMap,
        body: Buffer.from(resp.body_b64, "base64"),
      })
    })

    const page = await context.newPage()
    await page.addInitScript((email) => {
      sessionStorage.setItem("levelproaudio-auth", JSON.stringify({
        state: {
          isAuthenticated: true,
          user: { id: "synth", email, is_staff: true, is_superuser: true },
        },
        version: 0,
      }))
    }, synthEmail)

    await page.goto(`${baseUrl}/admin/inventory`, { waitUntil: "domcontentloaded" })
    await page.waitForSelector(".lp-seg-tabs", { timeout: 15000 })

    // Verificar Bodegas reales desde PostgreSQL QA
    await page.getByRole("button", { name: "Bodegas" }).click()
    await page.waitForSelector('[data-testid="wms-warehouses-table"]', { timeout: 15000 })
    const whText = await page.locator('[data-testid="wms-warehouses-table"]').innerText()
    assert.ok(whText.includes("BOD-CENTRAL"), "BOD-CENTRAL real debe renderizarse desde PostgreSQL QA")

    // Verificar Stock Dimensional real desde PostgreSQL QA
    await page.getByRole("button", { name: "Stock Dimensional" }).click()
    await page.waitForSelector('[data-testid="wms-dimensional-table"]', { timeout: 15000 })
    const stockText = await page.locator('[data-testid="wms-dimensional-table"]').innerText()
    assert.ok(stockText.includes("BOD-CENTRAL"), "Stock dimensional real debe renderizarse desde PostgreSQL QA")

    // Verificar Kardex real desde PostgreSQL QA
    await page.getByRole("button", { name: "Kardex" }).click()
    await page.waitForSelector('[data-testid="wms-kardex-table"]', { timeout: 15000 })
    const kardexText = await page.locator('[data-testid="wms-kardex-table"]').innerText()
    assert.ok(kardexText.includes("Apertura"), "Movimientos de apertura reales deben renderizarse desde PostgreSQL QA")
  } finally {
    await browser.close()
    await new Promise(resolve => server.httpServer.close(resolve))
    // Limpiar usuario sintético
    execFileSync("docker", [
      "exec", CONTAINER, "python", "manage.py", "shell", "-c",
      `from apps.users.models import User; User.objects.filter(email='${synthEmail}').delete()`,
    ])
  }
})
