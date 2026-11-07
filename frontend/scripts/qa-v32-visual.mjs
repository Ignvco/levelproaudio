// LevelPro Audio V3.2 — auditoría visual REAL en navegador, 100% de solo lectura.
// Las capturas y sesiones quedan en ~/.levelpro-v32-qa; JAMÁS se suben al servidor.
import { chromium } from 'playwright'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

const BASE = new URL(process.env.QA_BASE_URL || 'http://127.0.0.1:3000')
if (!['http:', 'https:'].includes(BASE.protocol)) throw Error('QA_BASE_URL inválida')
const ROOT = process.env.QA_PRIVATE_DIR || join(homedir(), '.levelpro-v32-qa')
const widths = (process.env.QA_WIDTHS || '1440,768,390').split(',').map(x => Number(x.trim()))
if (widths.some(x => !Number.isInteger(x) || x < 320 || x > 3840)) throw Error('QA_WIDTHS inválido')
const filter = (process.env.QA_ROUTE_FILTER || '').trim().toLowerCase()
const outDir = join(ROOT, 'visual-evidence')
const screenshotDir = join(outDir, 'screenshots')
await mkdir(screenshotDir, { recursive: true, mode: 0o700 })

// Inventario alineado con frontend/src/App.jsx en main 9f36745a. Incluye aliases y 404.
const routes = [
  ...['/', '/shop', '/cart', '/academy', '/services', '/bajo-pedido', '/rewards',
    '/terminos', '/privacidad', '/bases-sorteo', '/garantia', '/envios',
    '/login', '/register', '/forgot-password', '/reset-password', '/admin/login',
    '/payment/failure', '/ruta-qa-no-existe'].map(path => ({ role: 'public', path })),
  ...['/dashboard', '/dashboard/orders', '/dashboard/profile', '/dashboard/courses',
    '/dashboard/services', '/dashboard/bookings', '/dashboard/rewards',
    '/dashboard/loyalty', '/dashboard/favorites', '/checkout'].map(path => ({ role: 'customer', path })),
  ...['/admin', '/admin/analytics', '/admin/executive', '/admin/finance', '/admin/billing',
    '/admin/loyalty', '/admin/orders', '/admin/special-orders', '/admin/products',
    '/admin/products/import', '/admin/inventory', '/admin/brands', '/admin/categories',
    '/admin/users', '/admin/payments', '/admin/payment-methods', '/admin/academy',
    '/admin/academy/certifications', '/admin/academy/modules', '/admin/academy/lessons',
    '/admin/services', '/admin/academy/enrollments', '/admin/settings', '/admin/rewards',
    '/admin/rewards/campaigns', '/admin/rewards/entries', '/admin/rewards/winners'].map(path => ({ role: 'admin', path })),
  { role: 'public', path: '/shop/:slug', env: 'QA_PRODUCT_SLUG' },
  { role: 'public', path: '/academy/:slug', env: 'QA_COURSE_SLUG' },
  { role: 'public', path: '/services/:slug', env: 'QA_SERVICE_SLUG' },
  { role: 'admin', path: '/admin/rewards/campaigns/:id', env: 'QA_CAMPAIGN_ID' },
  { role: 'customer', path: '/dashboard/orders/:id', env: 'QA_ORDER_ID' },
  { role: 'customer', path: '/order-confirmation/:id', env: 'QA_ORDER_ID' },
  { role: 'customer', path: '/payment/transfer/:id', env: 'QA_ORDER_ID' },
  // Las pantallas que pueden capturar pagos NO son visitadas en esta auditoría.
  // Auditoría de returns con fixtures en test:browser y sandbox autorizado.
  { role: 'customer', path: '/payment/success', unsafe: true },
  { role: 'customer', path: '/payment/pending', unsafe: true },
]
const selected = routes.filter(r => !filter || r.path.toLowerCase().includes(filter))
const screenshotName = (role, path, width) => `${role}-${path.replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'home'}-${width}.png`
const htmlEscape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const records = []
const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] })
const sessions = {}
async function loadSession(role) {
  if (role === 'public') return null
  if (sessions[role] !== undefined) return sessions[role]
  try {
    const saved = JSON.parse(await readFile(join(ROOT, `${role}-session.json`), 'utf8'))
    if (saved.baseOrigin !== BASE.origin) throw Error(`Sesión ${role} pertenece a otro origen`)
    sessions[role] = saved
  } catch (err) {
    if (err.code === 'ENOENT') { sessions[role] = null; return null }
    throw err
  }
  return sessions[role]
}
try {
  for (const route of selected) {
    if (route.unsafe) { records.push({ ...route, status: 'SKIP', reason: 'Retorno de pagos: solo sandbox con fixtures' }); continue }
    const value = route.env && process.env[route.env]
    if (route.env && (!value || !/^[a-zA-Z0-9_-]{1,150}$/.test(value))) {
      records.push({ ...route, status: 'SKIP', reason: `Indicar ${route.env} de un fixture QA` })
      continue
    }
    const path = route.env ? route.path.replace(/:(?:id|slug)/, encodeURIComponent(value)) : route.path
    const saved = await loadSession(route.role)
    if (route.role !== 'public' && !saved) {
      records.push({ ...route, path, status: 'SKIP', reason: `Falta sesión autenticada ${route.role}` }); continue
    }
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height: width <= 480 ? 844 : 900 },
        deviceScaleFactor: 1, reducedMotion: 'reduce',
        ...(saved ? { storageState: { cookies: saved.cookies, origins: saved.origins } } : {}),
      })
      if (saved?.sessionStorage) await context.addInitScript(items => {
        for (const [key, value] of Object.entries(items)) window.sessionStorage.setItem(key, value)
      }, saved.sessionStorage)
      const page = await context.newPage()
      const errors = [], responses = [], blocked = []
      page.on('pageerror', e => errors.push({ name: e.name || 'UncaughtError', message: String(e.message || '').slice(0, 360) }))
      page.on('response', r => { if (r.status() >= 500) responses.push({ status: r.status(), path: new URL(r.url()).pathname }) })
      // Protege la sesión y la base de datos incluso si algún componente intenta un POST implícito.
      await page.route('**/*', async req => {
        const method = req.request().method()
        if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return req.continue()
        blocked.push({ method, path: new URL(req.request().url()).pathname })
        return req.fulfill({ status: 405, contentType: 'application/json', body: '{"detail":"Bloqueado por QA de solo lectura"}' })
      })
      const row = { role: route.role, path, width }
      try {
        const response = await page.goto(new URL(path, BASE).toString(), { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
        await page.evaluate(() => document.fonts.ready).catch(() => {})
        await page.waitForTimeout(350)
        row.httpStatus = response?.status() ?? null
        row.finalPath = new URL(page.url()).pathname
        const meta = await page.evaluate(() => {
          const viewportWidth = window.innerWidth
          const pageWidth = document.documentElement.scrollWidth
          // No almacenar texto, valores de inputs ni información de usuario.
          const overflowElements = pageWidth > viewportWidth + 2
            ? [...document.querySelectorAll('body *')].map(el => {
                const box = el.getBoundingClientRect()
                return {
                  tag: el.tagName.toLowerCase(),
                  id: String(el.id || '').slice(0, 60),
                  className: String(el.getAttribute('class') || '').slice(0, 100),
                  left: Math.round(box.left), right: Math.round(box.right),
                }
              }).filter(el => el.right > viewportWidth + 2 && el.left < viewportWidth).slice(0, 15)
            : []
          const errorBoundaryVisible = [...document.querySelectorAll('h1')].some(h =>
            h.textContent.trim() === 'Algo salió mal' &&
            h.parentElement?.textContent?.includes('Ocurrió un error inesperado')
          )
          return {
            pageWidth, viewportWidth, overflowElements, errorBoundaryVisible,
            bodyLength: document.body?.innerText?.trim().length ?? 0,
            brokenImages: [...document.images].filter(i => i.complete && i.naturalWidth === 0).length,
            title: document.title,
          }
        })
        Object.assign(row, meta)
        row.jsErrors = errors
        row.serverErrors = responses
        row.blockedWrites = blocked
        const fileName = screenshotName(route.role, path, width)
        await page.screenshot({ path: join(screenshotDir, fileName), fullPage: true, animations: 'disabled', timeout: 20000 })
        row.screenshot = `screenshots/${fileName}`
        row.findings = []
        if (row.httpStatus >= 400) row.findings.push('http_error')
        if (meta.pageWidth > meta.viewportWidth + 2) row.findings.push('horizontal_overflow')
        if (meta.brokenImages) row.findings.push('broken_images')
        if (errors.length) row.findings.push('javascript_errors')
        if (meta.errorBoundaryVisible) row.findings.push('error_boundary_fallback')
        if (responses.length) row.findings.push('server_errors')
        if (meta.bodyLength < 40) row.findings.push('empty_view')
        if (row.finalPath !== path && !['/admin/analytics', '/admin/executive'].includes(path)) row.findings.push('unexpected_redirect_or_auth')
        // Los POST bloqueados pueden ser telemetría o cotizaciones; informar, no marcar PASS operacional.
        if (blocked.length) row.findings.push('blocked_non_readonly_requests')
        row.status = row.findings.length ? 'REVIEW' : 'CAPTURED'
      } catch (err) {
        row.status = 'FAIL'
        row.reason = String(err.message).slice(0,300)
      } finally {
        records.push(row)
        console.log(`${row.status.padEnd(8)} ${width} ${route.role.padEnd(8)} ${path} ${row.findings?.join(', ') || row.reason || ''}`)
        await context.close()
      }
    }
  }
} finally { await browser.close() }
const totals = records.reduce((a,r) => { a[r.status] = (a[r.status] || 0) + 1; return a }, {})
const report = { baseOrigin: BASE.origin, generatedAt: new Date().toISOString(), source: 'Real Chromium screenshots, read-only', widths, totals, records }
await writeFile(join(outDir, 'report.json'), JSON.stringify(report, null, 2), { mode: 0o600 })
const gallery = `<!DOCTYPE html><html lang="es"><meta charset="utf-8"><title>LevelPro V3.2 · QA visual</title><style>body{font:14px system-ui;background:#101114;color:#eee;margin:24px}article{border:1px solid #555;padding:16px;margin:12px 0;border-radius:12px}img{display:block;width:min(100%,700px);margin-top:14px;border-radius:8px}p{color:#bbb}</style><h1>LevelPro V3.2 — Auditoría visual</h1><p>${htmlEscape(BASE.origin)} · evidencia privada · ${htmlEscape(JSON.stringify(totals))}</p>${records.map(r => `<article><strong>${htmlEscape(r.status)} · ${htmlEscape(r.role)} · ${htmlEscape(r.path)}${r.width ? ' · '+r.width+'px' : ''}</strong><p>${htmlEscape(r.findings?.join(', ') || r.reason || 'Sin hallazgos automáticos (revisar captura manualmente)')}</p>${r.screenshot ? `<img loading="lazy" src="${htmlEscape(r.screenshot)}" alt="Captura de ${htmlEscape(r.path)}">` : ''}</article>`).join('')}</html>`
await writeFile(join(outDir, 'index.html'), gallery, { mode: 0o600 })
console.log(`\nReportes privados: ${outDir}/index.html y report.json`)
console.log('CAPTURED no equivale a aprobación visual: revisar manualmente las imágenes y formularios.')
if (totals.FAIL) process.exitCode = 1
