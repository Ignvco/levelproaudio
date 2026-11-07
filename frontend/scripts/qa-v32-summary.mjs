// Shareable high-level QA counts. Do not print cookies, emails, IDs, or monetary amounts.
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
const root = process.env.QA_PRIVATE_DIR || join(homedir(), '.levelpro-v32-qa')
for (const [title, filename] of [
  ['VISUAL', join(root, 'visual-evidence/report.json')],
  ['OPERATIVA GET', join(root, 'operational-evidence/report.json')],
]) {
  try {
    const data = JSON.parse(await readFile(filename, 'utf8'))
    console.log(`\n${title} — ${data.generatedAt}`)
    console.log('Contadores:', JSON.stringify(data.totals))
    if (title === 'VISUAL') {
      const flags = {}
      for (const row of data.records || []) for (const finding of row.findings || []) flags[finding] = (flags[finding] || 0) + 1
      console.log('Hallazgos por tipo:', JSON.stringify(flags))
      console.log('Revisión humana de capturas: PENDIENTE hasta que el usuario la confirme')
    } else {
      const checks = data.findings || []
      console.log('Denegaciones/controles FAIL:', checks.filter(x => x.status === 'FAIL').map(x => x.name).join(' | ') || 'Ninguna detectada')
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
    console.log(`${title}: PENDIENTE (aún no hay reporte)`)
  }
}
console.log('\nPASARELAS REALES: NO PROBADAS — requieren sandbox aislado')
console.log('HISTÓRICOS DE PRODUCCIÓN: NO CONSULTADOS — requieren acceso SELECT-only')
console.log('PATCH 14: PAUSADO. STAGING: DIFERIDO.')
