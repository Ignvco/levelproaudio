import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { gzipSync } from "node:zlib"
import { resolve } from "node:path"

const root = resolve(process.argv[2] || "dist")
const manifest = JSON.parse(await readFile(`${root}/.vite/manifest.json`, "utf8"))
const visited = new Set()
function visit(key) {
  if (visited.has(key)) return
  assert.ok(manifest[key], `Missing manifest entry: ${key}`)
  visited.add(key)
  for (const dependency of manifest[key].imports || []) visit(dependency)
}
for (const [key, entry] of Object.entries(manifest)) if (entry.isEntry) visit(key)
assert.ok(visited.size > 0, "No initial entry found")
let bytes = 0, gzip = 0
const files = []
for (const key of visited) {
  const file = manifest[key].file
  if (!file.endsWith(".js")) continue
  const content = await readFile(`${root}/${file}`)
  bytes += content.length
  gzip += gzipSync(content).length
  files.push(file)
}
console.log(JSON.stringify({ initial_js_bytes: bytes, initial_js_gzip_bytes: gzip, files }, null, 2))
// Includes the full static import graph, so moving code to a preloaded vendor
// chunk cannot hide a regression. Dynamic route chunks are excluded by design.
assert.ok(bytes <= 600000, `Initial JS exceeds 600 kB: ${bytes}`)
assert.ok(gzip <= 180000, `Initial JS exceeds 180 kB gzip: ${gzip}`)
