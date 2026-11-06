import test, { before, after } from "node:test"
import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { chromium } from "playwright"
import { createServer, preview } from "vite"
import react from "@vitejs/plugin-react"

// Local UI contract tests: every API call and upload uses synthetic fixtures.
let baseURL = process.env.PAYMENT_TEST_URL || "http://127.0.0.1:3000"
assert.ok(["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname))
let browser, server
before(async () => {
  if (!process.env.PAYMENT_TEST_URL) {
    if (process.env.PAYMENT_TEST_MODE === "preview") {
      server = await preview({ configFile: false, preview: { host: "127.0.0.1", port: 0 } })
    } else {
      server = await createServer({ configFile: false, plugins: [react()], server: { host: "127.0.0.1", port: 0, hmr: false } })
      await server.listen()
    }
    baseURL = `http://127.0.0.1:${server.httpServer.address().port}`
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PAYMENT_TEST_CHROMIUM ? { executablePath: process.env.PAYMENT_TEST_CHROMIUM } : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  })
})
after(async () => {
  await browser?.close()
  if (server?.close) await server.close()
  else if (server) await new Promise(resolve => server.httpServer.close(resolve))
})

const root = "/api/v1/admin/"
const endpoint = name => `${root}academy/${name}/`
const course = { id: "c1", title: "Sonido en vivo" }
const module = { id: "m1", title: "Consolas", course: "c1", course_title: course.title, order: 1, lessons_count: 1 }
const lesson = { id: "l1", title: "Ganancia", module: "m1", module_title: module.title, order: 1, duration_minutes: 12, is_free: false, video_url: "https://example.test/video", description: "Conserva la descripción" }
const cert = { id: "r1", title: "Sonidista", courses: [course], is_published: true, seal_label: "LevelPro", description: "Ruta profesional", order: 2 }
const user = { id: "u1", email: "alumno@example.test", first_name: "Ana", last_name: "Prueba", is_staff: false, is_superuser: false, date_joined: "2026-10-01", orders_count: 2 }
const enrollment = { id: "e1", user_email: user.email, course_title: course.title, progress: 75, created_at: "2026-10-01" }
const views = [
  { path: "modules", title: "Módulos", empty: "Sin módulos.", action: /Nuevo módulo/, retry: "Reintentar módulos" },
  { path: "lessons", title: "Lecciones", empty: "Sin lecciones.", action: /Nueva lección/, retry: "Reintentar lecciones" },
  { path: "enrollments", title: "Inscripciones", empty: "Sin inscripciones todavía.", action: /Inscripción manual/, retry: "Reintentar inscripciones" },
  { path: "certifications", title: "Certificaciones", empty: "Sin certificaciones", action: "Nueva certificación", retry: "Reintentar certificaciones" },
  { path: "users", title: "Usuarios", empty: "No hay usuarios", emptyExact: true, retry: "Reintentar" },
]
const viewPath = v => v.path === "users" ? "/admin/users" : `/admin/academy/${v.path}`
const viewEndpoint = v => v.path === "users" ? `${root}users/` : endpoint(v.path)

async function setup(t, width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  await context.addInitScript(() => {
    sessionStorage.setItem("levelproaudio-auth", JSON.stringify({ state: { isAuthenticated: true,
      user: { id: "admin", email: "admin@example.test", is_staff: true, is_superuser: true } }, version: 0 }))
  })
  const state = {
    data: {
      [endpoint("courses")]: { results: [course] },
      [endpoint("modules")]: { results: [module] },
      [endpoint("lessons")]: { results: [lesson] },
      [endpoint("enrollments")]: { results: [enrollment] },
      [endpoint("certifications")]: { results: [cert] },
      [`${root}users/`]: { results: [user], count: 1 },
    },
    failures: new Set(), gates: new Map(), releases: [], reads: [], writes: [], unexpected: [], errors: [],
  }
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== baseURL) return route.abort()
    if (!url.pathname.startsWith("/api/") && url.pathname !== "/__test_upload") return route.continue()
    const send = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) })
    if (request.method() !== "GET") {
      state.writes.push({ path: url.pathname, method: request.method(), body: request.postData() })
      if (state.onWrite && await state.onWrite({ request, url, send, route })) return
      state.unexpected.push(`${request.method()} ${url.pathname}`)
      return send({ detail: "Unexpected test mutation" }, 405)
    }
    state.reads.push(url.pathname)
    assert.ok(!url.search.includes("queryKey"), "React Query context must not become API query parameters")
    if (state.gates.has(url.pathname)) await state.gates.get(url.pathname)
    if (state.failures.has(url.pathname)) return send({ detail: "Synthetic outage" }, 503)
    if (url.pathname === "/api/v1/auth/profile/") return send({ id: "admin", email: "admin@example.test", is_staff: true, is_superuser: true })
    if (url.pathname === "/api/v1/site-settings/") return send({ site_name: "LevelPro Test" })
    return send(state.data[url.pathname] || { results: [], count: 0 })
  })
  const page = await context.newPage()
  page.setDefaultTimeout(7000)
  page.on("pageerror", e => state.errors.push(e.message))
  t.after(async () => {
    state.releases.forEach(release => release())
    try {
      assert.deepEqual(state.errors, [])
      assert.deepEqual(state.unexpected, [])
    } finally { await context.close() }
  })
  return { page, state, goto: path => page.goto(`${baseURL}${path}`) }
}

async function enabled(page, locator) {
  await locator.waitFor()
  await page.waitForFunction(el => !el.disabled, await locator.elementHandle())
}
async function noOverflow(page) {
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
  assert.ok(dimensions.document <= dimensions.viewport + 1, JSON.stringify(dimensions))
}

for (const view of views) {
  test(`${view.title}: loading and failure are distinct from empty, retry recovers`, async t => {
    const { page, state, goto } = await setup(t)
    const path = viewEndpoint(view)
    let release
    state.gates.set(path, new Promise(resolve => { release = resolve }))
    state.releases.push(release)
    state.failures.add(path)
    state.data[path] = { results: [], count: 0 }
    await goto(viewPath(view))
    await page.getByRole("heading", { name: view.title, exact: true }).waitFor()
    if (view.action) assert.equal(await page.getByRole("button", { name: view.action }).isDisabled(), true)
    assert.equal(await page.getByText(view.empty, { exact: Boolean(view.emptyExact) }).count(), 0)
    assert.ok((await page.locator(".au-lp__value").allTextContents()).every(text => text === "—"))
    release()
    await page.getByTestId("error-state").waitFor()
    assert.equal(await page.getByText(view.empty, { exact: Boolean(view.emptyExact) }).count(), 0)
    if (view.action) assert.equal(await page.getByRole("button", { name: view.action }).isDisabled(), true)
    state.failures.delete(path)
    await page.getByRole("button", { name: view.retry, exact: true }).click()
    await page.getByText(view.empty, { exact: Boolean(view.emptyExact) }).waitFor()
    if (view.action) await enabled(page, page.getByRole("button", { name: view.action }))
    assert.equal(state.writes.length, 0)
  })
}

for (const [view, dependency, retry] of [[views[0], "courses", "Reintentar cursos"], [views[1], "modules", "Reintentar módulos"], [views[2], "users", "Reintentar usuarios"]]) {
  test(`${view.title}: unavailable options block mutation and can be retried`, async t => {
    const { page, state, goto } = await setup(t)
    const path = dependency === "users" ? `${root}users/` : endpoint(dependency)
    state.failures.add(path)
    await goto(viewPath(view))
    await page.getByTestId("error-state").waitFor()
    assert.equal(await page.getByRole("button", { name: view.action }).isDisabled(), true)
    for (const edit of await page.getByRole("button", { name: /^Editar / }).all()) assert.equal(await edit.isDisabled(), true)
    state.failures.delete(path)
    await page.getByRole("button", { name: retry, exact: true }).click()
    await enabled(page, page.getByRole("button", { name: view.action }))
    assert.equal(state.writes.length, 0)
  })
}

test("module creation, edit and delete retain validation, accessible icons and error recovery", async t => {
  const { page, state, goto } = await setup(t)
  const path = endpoint("modules")
  state.data[path] = { results: [] }
  let failSave = true
  state.onWrite = async ({ request, url, send }) => {
    if (!url.pathname.startsWith(path)) return false
    if (request.method() === "DELETE") state.data[path] = { results: [] }
    else {
      const payload = request.postDataJSON()
      assert.equal(payload.course, "c1")
      if (failSave) { await send({ detail: "Conflicto de prueba" }, 400); return true }
      state.data[path] = { results: [{ ...module, ...payload }] }
    }
    await send({})
    return true
  }
  await goto("/admin/academy/modules?course=c1")
  const trigger = page.getByRole("button", { name: /Nuevo módulo/ })
  await enabled(page, trigger)
  await trigger.click()
  const dialog = page.getByRole("dialog", { name: "Nuevo módulo" })
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click()
  await dialog.getByRole("alert").waitFor()
  assert.equal(state.writes.length, 0)
  await dialog.getByLabel("Título *", { exact: true }).fill("Ecualización")
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click()
  await dialog.getByText("Conflicto de prueba").waitFor()
  assert.equal(await dialog.getByLabel("Título *", { exact: true }).inputValue(), "Ecualización")
  failSave = false
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click()
  const edit = page.getByRole("button", { name: "Editar módulo Ecualización" })
  await edit.waitFor()
  assert.equal(await edit.locator("svg").count(), 1)
  await edit.focus()
  await page.keyboard.press("Enter")
  await page.getByRole("dialog").getByLabel("Título *", { exact: true }).fill("Ecualización avanzada")
  await page.getByRole("dialog").getByRole("button", { name: "Guardar", exact: true }).click()
  await page.getByRole("button", { name: "Eliminar módulo Ecualización avanzada" }).click()
  await page.getByTestId("confirm-accept").click()
  await page.getByText("Sin módulos.", { exact: false }).waitFor()
  assert.deepEqual(state.writes.map(w => w.method), ["POST", "POST", "PATCH", "DELETE"])
})

test("lesson URL edit preserves fields and local upload remains a signed PUT followed by create", async t => {
  const { page, state, goto } = await setup(t)
  const path = endpoint("lessons")
  const payloads = []
  state.onWrite = async ({ request, url, send, route }) => {
    if (url.pathname === `${path}upload-url/`) {
      assert.equal(request.postDataJSON().content_type, "video/mp4")
      await send({ upload_url: `${baseURL}/__test_upload`, object_path: "test/video.mp4", content_type: "video/mp4" })
    } else if (url.pathname === "/__test_upload") {
      assert.equal(request.method(), "PUT")
      assert.equal(request.headers()["content-type"], "video/mp4")
      assert.equal(request.postDataBuffer().toString(), "synthetic-video")
      await route.fulfill({ status: 200, body: "" })
    } else if (url.pathname.startsWith(path)) {
      if (request.method() === "DELETE") state.data[path] = { results: [] }
      else {
        const payload = request.postDataJSON()
        payloads.push(payload)
        state.data[path] = { results: [{ ...lesson, ...payload }] }
      }
      await send({})
    } else return false
    return true
  }
  await goto("/admin/academy/lessons")
  await enabled(page, page.getByRole("button", { name: "Editar lección Ganancia" }))
  await page.getByRole("button", { name: "Editar lección Ganancia" }).click()
  let dialog = page.getByRole("dialog", { name: "Editar lección" })
  await dialog.getByLabel("Título *", { exact: true }).fill("Ganancia editada")
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click()
  await page.getByRole("button", { name: "Editar lección Ganancia editada" }).waitFor()
  assert.equal(payloads[0].video_url, lesson.video_url)
  assert.equal(payloads[0].description, lesson.description)
  assert.equal(payloads[0].duration_minutes, lesson.duration_minutes)
  assert.equal(payloads[0].is_free, false)
  await page.getByRole("button", { name: /Nueva lección/ }).click()
  dialog = page.getByRole("dialog", { name: "Nueva lección" })
  await dialog.getByLabel("Archivo de video").setInputFiles({ name: "video.mp4", mimeType: "video/mp4", buffer: Buffer.from("synthetic-video") })
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click()
  await dialog.getByRole("alert").waitFor()
  assert.equal(state.writes.length, 1, "missing title/module must not request an upload")
  await dialog.getByLabel("Título *", { exact: true }).fill("Video nuevo")
  await dialog.getByLabel("Módulo *", { exact: true }).selectOption("m1")
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click()
  await page.getByRole("button", { name: "Editar lección Video nuevo" }).waitFor()
  assert.equal(payloads[1].video_file_path, "test/video.mp4")
  assert.ok(!Object.hasOwn(payloads[1], "video_url"))
  assert.deepEqual(state.writes.map(w => w.method), ["PATCH", "POST", "PUT", "POST"])
  await page.getByRole("button", { name: "Eliminar lección Video nuevo" }).click()
  await page.getByTestId("confirm-accept").click()
  await page.getByText("Sin lecciones.", { exact: false }).waitFor()
})

test("editing an existing uploaded lesson without choosing a file preserves its video", async t => {
  const { page, state, goto } = await setup(t)
  state.data[endpoint("lessons")] = { results: [{ ...lesson, video_url: "", video_file: "original.mp4", video_source: "https://example.test/original.mp4" }] }
  state.onWrite = async ({ request, url, send }) => {
    assert.equal(url.pathname, `${endpoint("lessons")}l1/`)
    assert.equal(request.method(), "PATCH")
    const payload = request.postDataJSON()
    assert.ok(!Object.hasOwn(payload, "video_file_path"))
    assert.ok(!Object.hasOwn(payload, "video_url"))
    await send({})
    return true
  }
  await goto("/admin/academy/lessons")
  await enabled(page, page.getByRole("button", { name: "Editar lección Ganancia" }))
  await page.getByRole("button", { name: "Editar lección Ganancia" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Guardar", exact: true }).click()
  await page.getByRole("dialog").waitFor({ state: "hidden" })
  assert.equal(state.writes.length, 1)
})

test("certification course outage preserves selected requirements and draft through retry", async t => {
  const { page, state, goto } = await setup(t)
  state.failures.add(endpoint("courses"))
  state.onWrite = async ({ request, url, send }) => {
    assert.equal(url.pathname, `${endpoint("certifications")}r1/`)
    const payload = request.postDataJSON()
    assert.deepEqual(payload.course_ids, ["c1"])
    assert.equal(payload.description, "Descripción conservada")
    assert.equal(payload.is_published, true)
    await send({})
    return true
  }
  await goto("/admin/academy/certifications")
  await page.getByRole("button", { name: "Editar certificación Sonidista" }).click()
  const dialog = page.getByRole("dialog", { name: "Editar certificación" })
  await dialog.getByTestId("error-state").waitFor()
  assert.equal(await dialog.getByRole("button", { name: "Guardar", exact: true }).isDisabled(), true)
  assert.equal(await dialog.getByText("No hay cursos disponibles.").count(), 0)
  await dialog.getByLabel("Descripción", { exact: true }).fill("Descripción conservada")
  state.failures.delete(endpoint("courses"))
  await dialog.getByRole("button", { name: "Reintentar cursos" }).click()
  await enabled(page, dialog.getByRole("button", { name: "Guardar", exact: true }))
  assert.equal(await dialog.getByRole("checkbox", { name: course.title }).isChecked(), true)
  assert.equal(await dialog.getByLabel("Descripción", { exact: true }).inputValue(), "Descripción conservada")
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click()
  await page.getByRole("status").filter({ hasText: "Certificación actualizada" }).waitFor()
  assert.equal(state.writes.length, 1)
})

test("certification create keeps empty requirements valid, failed save keeps draft, delete emits error then retries", async t => {
  const { page, state, goto } = await setup(t)
  const path = endpoint("certifications")
  state.data[path] = { results: [] }
  state.data[endpoint("courses")] = { results: [] }
  let fail = true
  state.onWrite = async ({ request, url, send }) => {
    if (!url.pathname.startsWith(path)) return false
    if (fail) { await send({ detail: "Guardado rechazado" }, 400); return true }
    if (request.method() === "DELETE") state.data[path] = { results: [] }
    else {
      const payload = request.postDataJSON()
      assert.deepEqual(payload.course_ids, [])
      state.data[path] = { results: [{ ...cert, ...payload, courses: [] }] }
    }
    await send({})
    return true
  }
  await goto("/admin/academy/certifications")
  const create = page.getByRole("button", { name: "Nueva certificación", exact: true })
  await enabled(page, create)
  assert.equal(await create.locator("svg").count(), 1)
  await create.click()
  const dialog = page.getByRole("dialog")
  await enabled(page, dialog.getByRole("button", { name: "Guardar", exact: true }))
  await dialog.getByLabel("Título", { exact: true }).fill("Nueva ruta")
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click()
  await dialog.getByText("Guardado rechazado").waitFor()
  assert.equal(await dialog.getByLabel("Título", { exact: true }).inputValue(), "Nueva ruta")
  fail = false
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click()
  await page.getByRole("button", { name: "Eliminar certificación Nueva ruta" }).click()
  fail = true
  await page.getByTestId("confirm-accept").click()
  await page.getByRole("alert").filter({ hasText: "No se pudo eliminar." }).waitFor()
  fail = false
  await page.getByTestId("confirm-accept").click()
  await page.getByText("Sin certificaciones", { exact: true }).waitFor()
})

test("enrollment progress and summary use backend progress; manual enrollment preserves selections on rejection", async t => {
  const { page, state, goto } = await setup(t)
  state.data[endpoint("enrollments")] = { results: [{ ...enrollment, progress: 100 }, { ...enrollment, id: "e2", progress: 0 }] }
  state.onWrite = async ({ request, url, send }) => {
    assert.equal(url.pathname, `${endpoint("enrollments")}create/`)
    assert.deepEqual(request.postDataJSON(), { user: "u1", course: "c1" })
    await send({ detail: "Ya está inscrito" }, 400)
    return true
  }
  await goto("/admin/academy/enrollments")
  const create = page.getByRole("button", { name: /Inscripción manual/ })
  await enabled(page, create)
  assert.deepEqual(await page.locator(".au-lp__value").allTextContents(), ["2", "1", "50%"])
  assert.deepEqual(await page.getByRole("progressbar").evaluateAll(elements => elements.map(e => e.getAttribute("aria-valuenow"))), ["100", "0"])
  await create.click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "Inscribir", exact: true }).click()
  await dialog.getByText("Selecciona un usuario y un curso.").waitFor()
  assert.equal(state.writes.length, 0)
  await dialog.getByLabel("Usuario *", { exact: true }).selectOption("u1")
  await dialog.getByLabel("Curso *", { exact: true }).selectOption("c1")
  await dialog.getByRole("button", { name: "Inscribir", exact: true }).click()
  await dialog.getByText("Ya está inscrito").waitFor()
  assert.equal(await dialog.getByLabel("Usuario *", { exact: true }).inputValue(), "u1")
  assert.equal(await dialog.getByLabel("Curso *", { exact: true }).inputValue(), "c1")
  state.onWrite = async ({ send }) => { await send({ id: "e3" }); return true }
  await dialog.getByRole("button", { name: "Inscribir", exact: true }).click()
  await dialog.waitFor({ state: "hidden" })
  assert.equal(state.writes.length, 2)
})

test("unknown enrollment progress is unavailable and does not enter an average as zero", async t => {
  const { page, state, goto } = await setup(t)
  state.data[endpoint("enrollments")] = { results: [{ ...enrollment, progress: null }] }
  await goto("/admin/academy/enrollments")
  await page.getByRole("cell", { name: user.email }).waitFor()
  assert.deepEqual(await page.locator(".au-lp__value").allTextContents(), ["1", "—", "—"])
  assert.equal(await page.getByRole("progressbar").count(), 0)
})

test("users expose actual roles, filter the visible list and state the API limit", async t => {
  const { page, state, goto } = await setup(t)
  state.data[`${root}users/`] = { count: 150, results: [user,
    { ...user, id: "u2", email: "staff@example.test", is_staff: true },
    { ...user, id: "u3", email: "super@example.test", is_staff: true, is_superuser: true }] }
  await goto("/admin/users")
  await page.getByRole("cell", { name: "Super", exact: true }).waitFor()
  assert.deepEqual(await page.locator(".au-lp__value").allTextContents(), ["150", "1", "2"])
  await page.getByText("Mostrando 3 de 150 usuarios.", { exact: false }).waitFor()
  await page.getByRole("combobox", { name: "Rol", exact: true }).selectOption("admin")
  assert.equal(await page.locator("tbody tr").count(), 1)
  assert.match(await page.locator("tbody").innerText(), /staff@example.test/)
})

test("missing role flags are displayed as unavailable, never assumed to be a customer", async t => {
  const { page, state, goto } = await setup(t)
  state.data[`${root}users/`] = { count: 1, results: [{ ...user, is_staff: undefined, is_superuser: undefined }] }
  await goto("/admin/users")
  await page.getByRole("cell", { name: "Sin datos", exact: true }).waitFor()
  assert.deepEqual(await page.locator(".au-lp__value").allTextContents(), ["1", "—", "—"])
})

for (const width of [320, 390, 768, 1024, 1280, 1440]) {
  test(`Academy and users fit ${width}px; form actions remain visible and focus is contained`, async t => {
    const { page, goto } = await setup(t, width)
    for (const view of views) {
      await goto(viewPath(view))
      await page.getByRole("table").waitFor()
      await noOverflow(page)
      if (!view.action) continue
      const trigger = page.getByRole("button", { name: view.action })
      await enabled(page, trigger)
      await trigger.click()
      const dialog = page.getByRole("dialog")
      const save = dialog.getByRole("button", { name: view.path === "enrollments" ? "Inscribir" : "Guardar", exact: true })
      await enabled(page, save)
      const bounds = await dialog.boundingBox(), action = await save.boundingBox()
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1)
      if (action.y < 0 || action.y + action.height > 900) {
        if (process.env.ACADEMY_TEST_SCREENSHOTS) {
          await mkdir(process.env.ACADEMY_TEST_SCREENSHOTS, { recursive: true })
          await page.screenshot({ path: join(process.env.ACADEMY_TEST_SCREENSHOTS, `failure-${view.path}-${width}.png`), fullPage: true })
        }
      }
      assert.ok(action.y >= 0 && action.y + action.height <= 900, `${view.path}: ${JSON.stringify({ bounds, action })}`)
      await noOverflow(page)
      assert.equal(await page.locator(".v3-brand").evaluate(el => {
        const box = el.getBoundingClientRect()
        return Boolean(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest(".au-modal__backdrop"))
      }), true, "The modal backdrop must cover navigation as well as page content")
      await save.focus()
      await page.keyboard.press("Tab")
      assert.equal(await dialog.getByRole("button", { name: "Cerrar", exact: true }).evaluate(el => document.activeElement === el), true)
      await page.keyboard.press("Shift+Tab")
      assert.equal(await save.evaluate(el => document.activeElement === el), true)
      if (process.env.ACADEMY_TEST_SCREENSHOTS && [390, 1440].includes(width)) {
        await mkdir(process.env.ACADEMY_TEST_SCREENSHOTS, { recursive: true })
        await page.screenshot({ path: join(process.env.ACADEMY_TEST_SCREENSHOTS, `${view.path}-${width}.png`), fullPage: true })
      }
      await page.keyboard.press("Escape")
      await dialog.waitFor({ state: "hidden" })
      assert.equal(await trigger.evaluate(el => document.activeElement === el), true)
    }
  })
}
