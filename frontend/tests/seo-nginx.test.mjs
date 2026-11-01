import test from "node:test"
import assert from "node:assert/strict"
import { createServer } from "node:http"
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve, join } from "node:path"
import { spawn } from "node:child_process"

// Actual production nginx config + built HTML, synthetic metadata backend.
// Django tests independently exercise the real metadata renderer and database.
test("nginx includes original-route metadata and fails safely without forwarding credentials", { timeout: 30000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "levelpro-seo-"))
  let mode = "ok"
  const requests = []
  const backend = createServer((request, response) => {
    requests.push({ url: request.url, headers: request.headers, method: request.method })
    if (mode === "fail") { response.writeHead(503); return response.end() }
    if (mode === "timeout") return
    response.setHeader("Content-Type", "text/html; charset=utf-8")
    response.end('<title data-initial-seo>Producto de prueba · LevelPro Audio</title><meta data-initial-seo property="og:title" content="Producto de prueba"><meta data-initial-seo name="robots" content="index, follow">')
  })
  await new Promise(resolve => backend.listen(0, "127.0.0.1", resolve))
  const portFinder = createServer()
  await new Promise(resolve => portFinder.listen(0, "127.0.0.1", resolve))
  const port = portFinder.address().port
  await new Promise(resolve => portFinder.close(resolve))
  const origin = `http://127.0.0.1:${port}`
  let nginx, spawnError, output = ""
  try {
    let config = await readFile("nginx.conf", "utf8")
    config = config.replace("listen 8080;", `listen 127.0.0.1:${port};`)
      .replace("root /usr/share/nginx/html;", `root "${resolve("dist")}";`)
      .replaceAll("https://levelproaudio-backend-147540000801.us-central1.run.app", `http://127.0.0.1:${backend.address().port}`)
    await mkdir(join(directory, "logs"))
    await writeFile(join(directory, "nginx.conf"), `${process.getuid?.() === 0 ? "user root;" : ""}\npid "${directory}/nginx.pid";\nerror_log stderr;\nevents {}\nhttp { default_type text/html; access_log off; types { text/html html; application/javascript js; text/css css; }\n${config}\n}`)
    nginx = spawn(process.env.NGINX_TEST_BINARY || "nginx", ["-p", directory + "/", "-c", join(directory, "nginx.conf"), "-g", "daemon off; master_process off;"], { stdio: ["ignore", "ignore", "pipe"] })
    nginx.stderr.on("data", data => { output += data })
    nginx.on("error", error => { spawnError = error })
    for (let attempt = 0; attempt < 100; attempt++) {
      if (spawnError) throw spawnError
      if (nginx.exitCode !== null) throw new Error(`nginx exited: ${output}`)
      try { await fetch(origin + "/favicon.png"); break } catch { await new Promise(resolve => setTimeout(resolve, 30)) }
    }
    for (const path of ["/shop/microfono?category=mics&utm_source=test", "/academy/mezcla", "/payment/success?paymentId=synthetic-test", "/"]) {
      const response = await fetch(origin + path, { headers: { Cookie: "session=synthetic", Authorization: "Bearer synthetic" } })
      const html = await response.text()
      assert.equal(response.status, 200)
      assert.equal(response.headers.get("cache-control"), "no-store")
      assert.equal((html.match(/<title\b/g) || []).length, 1, html)
      assert.match(html, /Producto de prueba/)
      assert.doesNotMatch(html, /<!--#|an error occurred/)
      const call = requests.at(-1)
      assert.equal(call.url, "/api/v1/seo/head/")
      assert.equal(call.headers["x-seo-path"], path)
      assert.equal(call.headers.cookie, undefined)
      assert.equal(call.headers.authorization, undefined)
      assert.equal(call.method, "GET")
    }
    for (const failure of ["fail", "timeout"]) {
      mode = failure
      const html = await (await fetch(origin + "/shop/microfono")).text()
      assert.match(html, /<title data-initial-seo>LevelPro Audio<\/title>/)
      assert.match(html, /noindex, nofollow/)
      assert.doesNotMatch(html, /an error occurred|Service Unavailable|Gateway Time-out/)
      assert.equal((html.match(/<title\b/g) || []).length, 1)
    }
    assert.equal((await fetch(origin + "/_seo/head")).status, 404)
  } finally {
    if (nginx && !spawnError && nginx.exitCode === null) {
      nginx.kill("SIGTERM")
      await new Promise(resolve => nginx.once("exit", resolve))
    }
    backend.closeAllConnections()
    await new Promise(resolve => backend.close(resolve))
    await rm(directory, { recursive: true, force: true })
  }
})
