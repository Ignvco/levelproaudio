// LevelPro V3.2 — captura local de sesión QA. Nunca subir la salida al repositorio.
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const BASE = new URL(process.env.QA_BASE_URL || 'http://127.0.0.1:3000')
if (!['http:', 'https:'].includes(BASE.protocol)) throw Error('QA_BASE_URL inválida')
const role = process.argv.find(x => x.startsWith('--role='))?.slice(7)
if (!['admin', 'customer'].includes(role)) throw Error('Usa --role=admin o --role=customer')
if (!process.stdin.isTTY) throw Error('Captura interactiva: ejecutar desde una terminal local')
const dest = process.env.QA_PRIVATE_DIR || join(homedir(), '.levelpro-v32-qa')
const browser = await chromium.launch({ headless: false })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(new URL('/login', BASE).toString(), { waitUntil: 'domcontentloaded' })
  console.log(`\nInicia sesión MANUALMENTE con la cuenta QA de ${role}, en ${BASE.origin}.`)
  console.log('Usa una cuenta de PRUEBAS; no registres claves en scripts ni consola.')
  const rl = createInterface({ input, output })
  await rl.question('Cuando hayas iniciado sesión, presiona ENTER aquí. ')
  rl.close()
  if (new URL(page.url()).origin !== BASE.origin) throw Error('La página final no corresponde al origen esperado')
  const profileResponse = await context.request.get(new URL('/api/v1/auth/profile/', BASE).toString())
  if (profileResponse.status() !== 200) throw Error(`Sesión no válida: auth/profile retornó ${profileResponse.status()}`)
  const profile = await profileResponse.json()
  if (role === 'admin' && !profile.is_staff && !profile.is_superuser) throw Error('Sesión no corresponde a un administrador')
  if (role === 'customer' && (profile.is_staff || profile.is_superuser)) throw Error('Usa una cuenta cliente no administradora')
  const storageState = await context.storageState()
  const sessionStorage = await page.evaluate(() => Object.fromEntries(
    Array.from({ length: window.sessionStorage.length }, (_, i) => {
      const key = window.sessionStorage.key(i)
      return [key, window.sessionStorage.getItem(key)]
    })
  ))
  await mkdir(dest, { recursive: true, mode: 0o700 })
  const file = join(dest, `${role}-session.json`)
  await writeFile(file, JSON.stringify({ ...storageState, sessionStorage, baseOrigin: BASE.origin }, null, 2), { mode: 0o600 })
  console.log(`Sesión ${role} guardada localmente en ${file}. No compartas este archivo: contiene cookies.`)
  await context.close()
} finally {
  await browser.close()
}
