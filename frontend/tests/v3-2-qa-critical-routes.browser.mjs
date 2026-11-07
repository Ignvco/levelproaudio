import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

let browser, server, baseURL
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()], server: {
    host: '127.0.0.1', port: 0, hmr: false,
  } })
  await server.listen()
  baseURL = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ headless: true })
})
after(async () => { await browser?.close(); await server?.close() })

const cases = [
  ['/dashboard/profile', 'dashboard-profile-page'],
  ['/dashboard/services', 'dashboard-services-page'],
  ['/dashboard/bookings', 'dashboard-bookings-page'],
  ['/dashboard/rewards', 'dashboard-rewards-page'],
  ['/dashboard/loyalty', 'dashboard-loyalty-page'],
  ['/order-confirmation/12345678-1234-1234-1234-123456789abc', null],
]
for (const [path, testId] of cases) {
  test(`V3.2 route ${path} renders without global crash`, async t => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    t.after(() => context.close())
    await context.addInitScript(() => sessionStorage.setItem('levelproaudio-auth', JSON.stringify({
      state: { isAuthenticated: true, user: {
        id: 'synthetic', email: 'customer@example.test', is_staff: false,
        first_name: 'Cliente', last_name: 'QA',
      } }, version: 0,
    })))
    const writes = [], errors = []
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url())
      if (url.origin !== baseURL) return route.abort()
      if (!url.pathname.startsWith('/api/')) return route.continue()
      if (req.method() !== 'GET') { writes.push(`${req.method()} ${url.pathname}`); return route.fulfill({ status: 405, body: '{}' }) }
      const data = url.pathname === '/api/v1/auth/profile/'
        ? { id: 'synthetic', email: 'customer@example.test', first_name: 'Cliente', is_staff: false, is_superuser: false }
        : url.pathname.includes('/loyalty/me/')
          ? { nivel: 'bronze', puntos_totales: 0, puntos_canjeados: 0, puntos_disponibles: 0, puntos_expirados: 0, transactions: [] }
          : { results: [], count: 0 }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    if (testId) await page.getByTestId(testId).waitFor({ timeout: 12000 })
    else {
      await page.getByTestId('order-confirmation-page').waitFor({ timeout: 12000 })
      await page.getByRole('heading', { name: 'No pudimos verificar el pedido' }).waitFor({ timeout: 12000 })
      assert.equal(await page.getByRole('heading', { name: 'Pago confirmado' }).count(), 0)
    }
    assert.equal(await page.getByRole('heading', { name: 'Algo salió mal', exact: true }).count(), 0)
    assert.deepEqual(writes, [])
    assert.deepEqual(errors, [])
  })
}
