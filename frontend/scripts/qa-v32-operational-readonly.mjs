// LevelPro V3.2 — probes REALES autenticados con HTTP GET exclusivamente.
// No crea órdenes, no ejecuta pagos, no altera stock, no modifica datos.
import { chromium } from 'playwright'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

const BASE = new URL(process.env.QA_BASE_URL || 'http://127.0.0.1:3000')
const ROOT = process.env.QA_PRIVATE_DIR || join(homedir(), '.levelpro-v32-qa')
const evidence = join(ROOT, 'operational-evidence')
await mkdir(evidence, { recursive: true, mode: 0o700 })
const browser = await chromium.launch({ headless: true })
const findings = []

const checks = [
  ...['CLP', 'USD', 'ARS'].flatMap(currency => [
    { role: 'public', path: `/api/v1/payments/methods/?currency=${currency}`, name: `Métodos de pago ${currency}` },
    { role: 'admin', path: `/api/v1/admin/dashboard/?currency=${currency}`, expectedCurrency: currency, name: `Dashboard ${currency}` },
    { role: 'admin', path: `/api/v1/admin/analytics/?currency=${currency}`, expectedCurrency: currency, name: `Analítica ${currency}` },
    { role: 'admin', path: `/api/v1/admin/payments/?currency=${currency}`, expectedCurrency: currency, name: `Pagos ${currency}` },
    { role: 'admin', path: `/api/v1/admin/finance/summary/?currency=${currency}`, expectedCurrency: currency, name: `Finanzas ${currency}` },
    { role: 'admin', path: `/api/v1/admin/rewards/dashboard/?currency=${currency}`, expectedCurrency: currency, name: `Rewards ${currency}` },
  ]),
  ...[
    ['/api/v1/services/', 'Servicios públicos'],
    ['/api/v1/rewards/campaigns/', 'Campañas públicas'],
    ['/api/v1/rewards/winners/', 'Ganadores públicos'],
    ['/api/v1/products/', 'Tienda pública'],
  ].map(([path, name]) => ({ role:'public', path, name })),
  ...[
    ['/api/v1/admin/orders/', 'Órdenes admin'],
    ['/api/v1/admin/products/', 'Productos admin'],
    ['/api/v1/admin/users/', 'Usuarios admin'],
    ['/api/v1/admin/inventory/summary/', 'Inventario admin'],
    ['/api/v1/admin/finance/categories/', 'Categorías financieras'],
    ['/api/v1/admin/finance/withdrawals/?currency=CLP', 'Retiros CLP'],
    ['/api/v1/admin/service-requests/', 'Solicitudes servicios'],
    ['/api/v1/admin/bookings/', 'Reservas admin'],
    ['/api/v1/admin/rewards/campaigns/', 'Campañas admin'],
    ['/api/v1/admin/rewards/entries/', 'Participaciones admin'],
    ['/api/v1/admin/rewards/winners/', 'Ganadores admin'],
    ['/api/v1/loyalty/admin/summary/', 'Fidelización admin'],
    ['/api/v1/loyalty/admin/config/', 'Configuración fidelización'],
    ['/api/v1/billing/dashboard/', 'Facturación admin'],
  ].map(([path,name]) => ({ role:'admin', path, name })),
  ...[
    ['/api/v1/auth/profile/', 'Perfil de cliente'],
    ['/api/v1/orders/', 'Pedidos de cliente'],
    ['/api/v1/service-requests/', 'Mis solicitudes'],
    ['/api/v1/bookings/', 'Mis reservas'],
    ['/api/v1/rewards/my-entries/', 'Mis participaciones'],
    ['/api/v1/loyalty/me/', 'Mis puntos'],
  ].map(([path,name]) => ({ role:'customer', path, name })),
  { role:'customer', path:'/api/v1/admin/users/', expectedDenied:true, name:'Aislamiento usuarios admin' },
  { role:'customer', path:'/api/v1/admin/finance/summary/?currency=CLP', expectedDenied:true, name:'Aislamiento finanzas admin' },
  { role:'public', path:'/api/v1/admin/orders/', expectedDenied:true, name:'Aislamiento admin anónimo' },
]
const contexts = {}
const roleValidation = {}
async function getContext(role) {
  if (contexts[role] !== undefined) return contexts[role]
  let session
  if (role !== 'public') {
    try { session = JSON.parse(await readFile(join(ROOT, `${role}-session.json`), 'utf8')) }
    catch (err) { if (err.code === 'ENOENT') { contexts[role] = null; return null }; throw err }
    if (session.baseOrigin !== BASE.origin) throw Error(`La sesión ${role} es de otro origen, no se reutilizará`)
  }
  const context = await browser.newContext({
    ...(session ? { storageState: { cookies: session.cookies, origins: session.origins } } : {}),
  })
  contexts[role] = context
  return context
}
try {
  for (const check of checks) {
    const context = await getContext(check.role)
    if (!context) { findings.push({ ...check, status: 'SKIP', reason: 'Falta sesión QA de este rol' }); continue }
    const row = { role:check.role, name:check.name, path:check.path }
    try {
      if (check.role !== 'public') {
        if (roleValidation[check.role] === undefined) {
          const probe = await context.request.get(new URL('/api/v1/auth/profile/', BASE).toString(), {
            timeout: 25000, maxRedirects: 0, failOnStatusCode: false,
          })
          const profile = probe.status() === 200 ? await probe.json().catch(() => null) : null
          roleValidation[check.role] = probe.status() === 200 && Boolean(profile) && (
            check.role === 'admin' ? Boolean(profile.is_staff || profile.is_superuser) :
              !profile.is_staff && !profile.is_superuser
          )
        }
        if (!roleValidation[check.role]) {
          row.status = 'BLOCKED_AUTH'
          row.reason = `Sesión QA ${check.role} vencida o rol incorrecto: recapturar y reejecutar`
          findings.push(row)
          console.log(`${row.status} ${check.role} ${check.name}`)
          continue
        }
      }
      const response = await context.request.get(new URL(check.path, BASE).toString(), {
        timeout: 25000, maxRedirects: 0, failOnStatusCode: false,
      })
      row.httpStatus = response.status()
      if (check.expectedDenied) {
        row.status = [401, 403].includes(row.httpStatus) ? 'PASS' : 'FAIL'
        row.contract = 'La API debe negar acceso HTTP 401/403'
      } else {
        row.status = row.httpStatus >= 200 && row.httpStatus < 300 ? 'PASS' : 'FAIL'
        if (row.status === 'PASS' && check.expectedCurrency) {
          const data = await response.json().catch(() => null)
          row.contract = `Respuesta debe declarar currency=${check.expectedCurrency}`
          row.status = data?.currency === check.expectedCurrency ? 'PASS' : 'FAIL'
        }
      }
    } catch (e) { row.status = 'FAIL'; row.reason = String(e.message).slice(0,160) }
    findings.push(row)
    console.log(`${row.status.padEnd(5)} ${check.role.padEnd(8)} ${check.name} (${row.httpStatus ?? '-'})`)
  }
} finally { for (const ctx of Object.values(contexts)) await ctx?.close(); await browser.close() }
const totals = findings.reduce((a,r) => { a[r.status]=(a[r.status]||0)+1; return a }, {})
const report = {
  generatedAt:new Date().toISOString(), baseOrigin:BASE.origin, mode:'GET/HEAD ONLY',
  limits:['GET exitoso no prueba lógica mutacional','No ejecuta pasarelas reales','Datos/PII y tokens no se guardan en el reporte'],
  totals, findings,
}
await writeFile(join(evidence,'report.json'), JSON.stringify(report,null,2), { mode:0o600 })
console.log(`Reporte de solo lectura: ${join(evidence, 'report.json')}`)
if (totals.FAIL || totals.BLOCKED_AUTH) process.exitCode=1
