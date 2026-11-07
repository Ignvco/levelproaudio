// QA V3.2 FIX04: pruebas UI con fixtures, navegación sólo GET y sin pasarelas reales.
import test, { before, after } from "node:test"
import assert from "node:assert/strict"
import { chromium } from "playwright"
import { createServer } from "vite"
import react from "@vitejs/plugin-react"

const ORDER_ID = "12345678-1234-1234-1234-123456789abc"
let browser, server, baseURL
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()], server: {
    host: "127.0.0.1", port: 0, hmr: false,
  } })
  await server.listen()
  baseURL = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
})
after(async () => { await browser?.close(); await server?.close() })

const COURSE = { id: "course1", title: "Ingeniería de sonido en vivo" }
const MODULE = { id: "module1", title: "Introducción QA al procesamiento de audio", order: 1,
  course: COURSE.id, course_title: COURSE.title, lessons_count: 1 }
const LESSON = { id: "lesson1", title: "Lección sin contenido externo", order: 1,
  module: MODULE.id, module_title: MODULE.title, duration_minutes: 12, is_free: true }

async function fixture(t, { role = "customer", status = "pending", orderHttp = 200,
  orderGate, financeSummary, withdrawalHttp = 200, payments = [], width = 390 } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 840 } })
  t.after(() => context.close())
  const admin = role === "admin"
  const writes = [], reads = [], errors = []
  await context.addInitScript(({ admin }) => {
    sessionStorage.setItem("levelproaudio-auth", JSON.stringify({ state: {
      isAuthenticated: true,
      user: { id: "synthetic", email: "qa@example.test", is_staff: admin, is_superuser: admin },
    }, version: 0 }))
  }, { admin })
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== baseURL) return route.abort()
    if (!url.pathname.startsWith("/api/")) return route.continue()
    const send = (value, code = 200) => route.fulfill({ status: code,
      contentType: "application/json", body: JSON.stringify(value) })
    if (request.method() !== "GET") {
      writes.push(`${request.method()} ${url.pathname}`)
      return send({ detail: "Mutations are not permitted in QA" }, 405)
    }
    reads.push(url.pathname)
    if (url.pathname === "/api/v1/auth/profile/") {
      return send({ id: "synthetic", email: "qa@example.test", is_staff: admin, is_superuser: admin })
    }
    if (url.pathname === "/api/v1/site-settings/") return send({ site_name: "LevelPro QA" })
    if (url.pathname === `/api/v1/orders/${ORDER_ID}/`) {
      if (orderGate) await orderGate
      return orderHttp === 200
        ? send({ id: ORDER_ID, status, payments, total: "10000", currency: "CLP" })
        : send({ detail: "El pedido no está disponible" }, orderHttp)
    }
    if (url.pathname === "/api/v1/admin/academy/courses/") return send({ results: [COURSE] })
    if (url.pathname === "/api/v1/admin/academy/modules/") return send({ results: [MODULE] })
    if (url.pathname === "/api/v1/admin/academy/lessons/") return send({ results: [LESSON] })
    if (url.pathname === "/api/v1/admin/finance/summary/") {
      return send(financeSummary ?? { total_income: 0, total_withdrawn: 0,
        net_balance: 0, summary: [], recent_income: [] })
    }
    if (url.pathname === "/api/v1/admin/finance/categories/") return send([])
    if (url.pathname === "/api/v1/admin/finance/withdrawals/") {
      return send(withdrawalHttp === 200 ? [] : { detail: "Sin acceso" }, withdrawalHttp)
    }
    return send({ results: [], count: 0 })
  })
  const page = await context.newPage()
  page.on("pageerror", error => errors.push(error.message))
  return { page, reads, writes, errors, visit: path => page.goto(`${baseURL}${path}`, {
    waitUntil: "domcontentloaded", timeout: 20000,
  }) }
}

async function noDocumentOverflow(page) {
  const { width, viewport } = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth, viewport: window.innerWidth,
  }))
  assert.ok(width <= viewport + 2, `Overflow ${width} > ${viewport}`)
}

test("pedido pendiente: el GET autoritativo no es pago confirmado", async t => {
  const q = await fixture(t, { status: "pending", width: 320 })
  await q.visit(`/order-confirmation/${ORDER_ID}`)
  await q.page.getByRole("heading", { name: "Pedido recibido · Pago pendiente" }).waitFor()
  assert.equal(await q.page.getByRole("heading", { name: "Pago confirmado" }).count(), 0)
  assert.equal(await q.page.getByRole("link", { name: "Ver pedido y opciones de pago" }).count(), 1)
  assert.ok(q.reads.includes(`/api/v1/orders/${ORDER_ID}/`))
  assert.deepEqual(q.writes, [])
  assert.deepEqual(q.errors, [])
  await noDocumentOverflow(q.page)
})

test("pago confirmado: nunca se muestra antes de que termine el GET", async t => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const q = await fixture(t, { status: "paid", orderGate: gate })
  t.after(() => release())
  await q.visit(`/order-confirmation/${ORDER_ID}`)
  await q.page.getByRole("heading", { name: "Verificando pedido…" }).waitFor()
  assert.equal(await q.page.getByRole("heading", { name: "Pago confirmado" }).count(), 0)
  release()
  await q.page.getByRole("heading", { name: "Pago confirmado" }).waitFor()
  assert.deepEqual(q.writes, [])
  assert.deepEqual(q.errors, [])
})

test("cancelado, reembolsado, revisión, rechazo y 404 no celebran pagos", async t => {
  for (const option of [
    { status: "cancelled", heading: "Pedido cancelado" },
    { status: "paid", payments: [{ status: "refunded" }], heading: "Pago reembolsado" },
    { status: "pending", payments: [{ status: "in_review" }], heading: "Pago en revisión" },
    { status: "pending", payments: [{ status: "rejected" }], heading: "El pago no fue aprobado" },
    { orderHttp: 404, heading: "No pudimos verificar el pedido" },
  ]) {
    const q = await fixture(t, option)
    await q.visit(`/order-confirmation/${ORDER_ID}`)
    await q.page.getByRole("heading", { name: option.heading }).waitFor()
    assert.equal(await q.page.getByRole("heading", { name: "Pago confirmado" }).count(), 0)
    assert.deepEqual(q.writes, [])
    assert.deepEqual(q.errors, [])
  }
})

test("un ID inválido no hace GET a pedidos ni muestra confirmación", async t => {
  const q = await fixture(t)
  await q.visit("/order-confirmation/not-a-uuid")
  await q.page.getByRole("heading", { name: "No pudimos verificar el pedido" }).waitFor()
  assert.equal(q.reads.some(x => x.startsWith("/api/v1/orders/")), false)
  assert.deepEqual(q.writes, [])
  assert.deepEqual(q.errors, [])
})

for (const [path, label, name] of [
  ["/admin/academy/modules", "módulo", MODULE.title],
  ["/admin/academy/lessons", "lección", LESSON.title],
]) {
  for (const width of [320, 390, 430]) {
    test(`${label}: tarjeta legible, acciones accesibles a ${width}px`, async t => {
      const q = await fixture(t, { role: "admin", width })
      await q.visit(path)
      const table = q.page.locator(".qa-academy-mobile-table .au-table")
      await table.waitFor()
      await table.getByText(name, { exact: true }).waitFor()
      const row = table.locator("tbody tr").filter({ hasText: name })
      assert.equal(await row.count(), 1)
      assert.equal(await row.evaluate(el => getComputedStyle(el).display), "flex")
      await q.page.getByRole("button", { name: `Editar ${label} ${name}` }).click()
      await q.page.getByTestId(label === "módulo" ? "module-modal" : "lesson-modal").waitFor()
      assert.deepEqual(q.errors, [])
      assert.deepEqual(q.writes, [])
      await noDocumentOverflow(q.page)
    })
  }
}

test("Finanzas: estado vacío solo con consultas correctas", async t => {
  const q = await fixture(t, { role: "admin", width: 320 })
  await q.visit("/admin/finance")
  await q.page.getByTestId("finance-overview-empty").waitFor()
  await q.page.getByText("Sin categorías ni retiros en esta vista").waitFor()
  assert.deepEqual(q.writes, [])
  assert.deepEqual(q.errors, [])
  await noDocumentOverflow(q.page)
})

test("Finanzas: error de retiros nunca se muestra como vacío", async t => {
  const q = await fixture(t, { role: "admin", withdrawalHttp: 503 })
  await q.visit("/admin/finance")
  await q.page.getByText("No pudimos cargar los retiros recientes.", { exact: false }).waitFor({ timeout: 12000 })
  assert.equal(await q.page.getByTestId("finance-overview-empty").count(), 0)
  assert.deepEqual(q.writes, [])
  assert.deepEqual(q.errors, [])
})
