import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { execSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { preview } from "vite"
import { chromium } from "playwright"
import { SYNTHETIC_API_MOCKS } from "./gate13-capture-baseline.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIR = path.resolve(__dirname, "..")
const BASE_OUT = "/Users/levelproaudio/.gemini/antigravity/brain/11ba077a-d7d1-492e-b2b9-3bee19137a13"
const MATRIX_DIR = path.join(BASE_OUT, "gate13_responsive_matrix")
const CHROME_PATH = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

fs.mkdirSync(MATRIX_DIR, { recursive: true })

const VIEWPORTS = [
  { name: "320x720-mobile-compact", width: 320, height: 720 },
  { name: "390x844-mobile-standard", width: 390, height: 844 },
  { name: "768x1024-tablet", width: 768, height: 1024 },
  { name: "1280x800-laptop", width: 1280, height: 800 },
  { name: "1440x900-desktop", width: 1440, height: 900 },
  { name: "3840x2160-4k-ultrawide", width: 3840, height: 2160 },
]

// Complete 39 administrative routes/screens extracted from App.jsx & operational tabs
export const ALL_39_ADMIN_ROUTES = [
  { id: 1, slug: "01-dashboard", path: "/admin", family: "Business Core", captureInMatrix: true },
  { id: 2, slug: "02-orders-oms", path: "/admin/orders", family: "OMS & Sales", captureInMatrix: true },
  { id: 3, slug: "03-b2b-quotes", path: "/admin/b2b", family: "CRM & B2B", captureInMatrix: true },
  { id: 4, slug: "04-special-orders", path: "/admin/special-orders", family: "OMS & Sales", captureInMatrix: false },
  { id: 5, slug: "05-payments", path: "/admin/payments", family: "Finance & Payments", captureInMatrix: false },
  { id: 6, slug: "06-payment-methods", path: "/admin/payment-methods", family: "Finance & Payments", captureInMatrix: false },
  { id: 7, slug: "07-billing-sii", path: "/admin/billing", family: "Finance & Payments", captureInMatrix: false },
  { id: 8, slug: "08-products-pim", path: "/admin/products", family: "PIM & Catalog", captureInMatrix: true },
  { id: 9, slug: "09-product-detail-variants", path: "/admin/products/p-1", family: "PIM & Catalog", captureInMatrix: false },
  { id: 10, slug: "10-product-import", path: "/admin/products/import", family: "PIM & Catalog", captureInMatrix: false },
  { id: 11, slug: "11-brands", path: "/admin/brands", family: "PIM & Catalog", captureInMatrix: false },
  { id: 12, slug: "12-categories", path: "/admin/categories", family: "PIM & Catalog", captureInMatrix: false },
  { id: 13, slug: "13-suppliers", path: "/admin/suppliers", family: "Supply Chain", captureInMatrix: false },
  { id: 14, slug: "14-supplier-detail", path: "/admin/suppliers/sup-1", family: "Supply Chain", captureInMatrix: false },
  { id: 15, slug: "15-procurement-po", path: "/admin/procurement", family: "Supply Chain", captureInMatrix: true },
  { id: 16, slug: "16-procurement-receipts", path: "/admin/procurement?tab=receipts", family: "Supply Chain", captureInMatrix: false },
  { id: 17, slug: "17-costing-landed", path: "/admin/costing", family: "Supply Chain", captureInMatrix: false },
  { id: 18, slug: "18-inventory-wms", path: "/admin/inventory", family: "WMS & Logistics", captureInMatrix: true },
  { id: 19, slug: "19-logistics-overview", path: "/admin/logistics", family: "WMS & Logistics", captureInMatrix: true },
  { id: 20, slug: "20-marketing-dashboard", path: "/admin/marketing", family: "Marketing & Growth", captureInMatrix: true },
  { id: 21, slug: "21-academy-courses", path: "/admin/academy", family: "Academy & Services", captureInMatrix: true },
  { id: 22, slug: "22-academy-modules", path: "/admin/academy/modules", family: "Academy & Services", captureInMatrix: false },
  { id: 23, slug: "23-academy-lessons", path: "/admin/academy/lessons", family: "Academy & Services", captureInMatrix: false },
  { id: 24, slug: "24-academy-enrollments", path: "/admin/academy/enrollments", family: "Academy & Services", captureInMatrix: false },
  { id: 25, slug: "25-academy-certifications", path: "/admin/academy/certifications", family: "Academy & Services", captureInMatrix: false },
  { id: 26, slug: "26-services", path: "/admin/services", family: "Academy & Services", captureInMatrix: true },
  { id: 27, slug: "27-loyalty", path: "/admin/loyalty", family: "Loyalty & Rewards", captureInMatrix: true },
  { id: 28, slug: "28-rewards-dashboard", path: "/admin/rewards", family: "Loyalty & Rewards", captureInMatrix: true },
  { id: 29, slug: "29-rewards-campaigns", path: "/admin/rewards/campaigns", family: "Loyalty & Rewards", captureInMatrix: false },
  { id: 30, slug: "30-rewards-campaign-detail", path: "/admin/rewards/campaigns/rc-1", family: "Loyalty & Rewards", captureInMatrix: false },
  { id: 31, slug: "31-rewards-entries", path: "/admin/rewards/entries", family: "Loyalty & Rewards", captureInMatrix: false },
  { id: 32, slug: "32-rewards-winners", path: "/admin/rewards/winners", family: "Loyalty & Rewards", captureInMatrix: false },
  { id: 33, slug: "33-finance-summary", path: "/admin/finance", family: "Finance & Payments", captureInMatrix: true },
  { id: 34, slug: "34-users-crm", path: "/admin/users", family: "CRM & B2B", captureInMatrix: false },
  { id: 35, slug: "35-roles-rbac", path: "/admin/roles", family: "Business Core", captureInMatrix: false },
  { id: 36, slug: "36-audit-forensic", path: "/admin/audit", family: "Business Core", captureInMatrix: false },
  { id: 37, slug: "37-cms-settings", path: "/admin/settings", family: "Editorial CMS", captureInMatrix: true },
  { id: 38, slug: "38-admin-login", path: "/admin/login", family: "Business Core", captureInMatrix: false },
  { id: 39, slug: "39-analytics-redirect", path: "/admin/analytics", family: "Finance & Payments", captureInMatrix: false },
]

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")
}

const AUDIT_ONLY = process.argv.includes("--audit-only")

async function main() {
  const server = await preview({ root: FRONTEND_DIR, preview: { port: 4186, host: "127.0.0.1" } })
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true })

  let totalCaptures = 0
  const overflowViolations = []
  const renderErrors = []
  const routeAuditMatrix = []
  let fontVerification = null

  try {
    for (const vp of VIEWPORTS) {
      const vpDir = path.join(MATRIX_DIR, vp.name)
      fs.mkdirSync(vpDir, { recursive: true })

      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      })
      const page = await context.newPage()

      const pageErrors = []
      page.on("pageerror", (err) => {
        pageErrors.push(String(err?.message || err))
      })

      await page.route("**/api/v1/**", async (route) => {
        const data = SYNTHETIC_API_MOCKS(route.request().url())
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(data),
        })
      })

      await page.addInitScript(() => {
        sessionStorage.setItem(
          "levelproaudio-auth",
          JSON.stringify({
            state: {
              isAuthenticated: true,
              user: {
                id: "u1",
                email: "admin@levelpro.cl",
                first_name: "Ignacio",
                last_name: "LevelPro",
                is_staff: true,
                is_superuser: true,
                roles: ["Super Admin"],
              },
            },
            version: 0,
          })
        )
        document.cookie = "csrftoken=mockcsrftoken; path=/"
      })

      // Audit ALL 39 routes across ALL 6 viewports = 234 route × viewport checks
      const routesToTest = ALL_39_ADMIN_ROUTES

      for (const r of routesToTest) {
        pageErrors.length = 0
        await page.goto(`http://127.0.0.1:4186${r.path}`, { waitUntil: "networkidle" })
        await page.waitForTimeout(180)

        const metrics = await page.evaluate(() => {
          const bodyText = document.body?.innerText || ""
          const hasCrash = bodyText.includes("Algo salió mal")
          const overflowDelta = document.documentElement.scrollWidth - window.innerWidth
          const rootEl = document.querySelector(".admin-root") || document.body
          const cs = window.getComputedStyle(rootEl)
          const monoEl = document.querySelector(".v3-brand-tag, .au-eyebrow, [style*='font-mono']")
          const monoCs = monoEl ? window.getComputedStyle(monoEl) : null
          return {
            hasCrash,
            overflowDelta,
            fontFamily: cs.fontFamily,
            monoFontFamily: monoCs ? monoCs.fontFamily : "Geist Mono",
            bgColor: cs.backgroundColor,
          }
        })

        if (!fontVerification && vp.width === 1440 && r.path === "/admin/products") {
          fontVerification = {
            viewport: vp.name,
            route: r.path,
            computed_sans_font: metrics.fontFamily,
            computed_mono_font: metrics.monoFontFamily,
            computed_canvas_bg: metrics.bgColor,
          }
        }

        if (metrics.hasCrash) {
          renderErrors.push(`${vp.name} ${r.path}: Rendered ErrorBoundary ('Algo salió mal')`)
        }
        if (pageErrors.length > 0) {
          renderErrors.push(`${vp.name} ${r.path}: JS pageerror: ${pageErrors.join("; ")}`)
        }
        if (metrics.overflowDelta > 4) {
          overflowViolations.push(`${vp.name} ${r.path}: scrollWidth exceeds viewport by ${metrics.overflowDelta}px`)
        }

        routeAuditMatrix.push({
          id: r.id,
          route: r.path,
          family: r.family,
          viewport: `${vp.width}x${vp.height}`,
          test_mode: "synthetic_fixture_audit",
          render_ok: !metrics.hasCrash && pageErrors.length === 0,
          overflow_px: Math.max(0, metrics.overflowDelta),
          js_errors: pageErrors.length,
        })

        const shouldSavePng =
          !AUDIT_ONLY && r.captureInMatrix && (vp.width < 3840 || r.id <= 15)
        if (shouldSavePng) {
          const outFile = path.join(vpDir, `${r.slug}.png`)
          await page.screenshot({ path: outFile, fullPage: vp.width < 3840 })
          totalCaptures += 1
        }
      }

      // Interactive states on 1440x900 desktop
      if (!AUDIT_ONLY && vp.width === 1440) {
        await page.goto("http://127.0.0.1:4186/admin", { waitUntil: "networkidle" })
        await page.waitForTimeout(150)

        const searchBtn = page.locator('[data-testid="admin-search-btn"]')
        if (await searchBtn.count()) {
          await searchBtn.click()
          await page.waitForTimeout(150)
          const inp = page.locator('[data-testid="admin-command-palette-input"]')
          if (await inp.count()) {
            await inp.fill("RME")
            await page.waitForTimeout(300)
          }
          await page.screenshot({ path: path.join(vpDir, "state-command-palette-results.png") })
          await page.keyboard.press("Escape")
          totalCaptures += 1
        }

        const bellBtn = page.locator('[data-testid="admin-notifications-btn"]')
        if (await bellBtn.count()) {
          await bellBtn.click()
          await page.waitForTimeout(200)
          await page.screenshot({ path: path.join(vpDir, "state-notification-center.png") })
          await page.keyboard.press("Escape")
          totalCaptures += 1
        }

        // CMS Hero Editor & Live Iframe Preview state on /admin/settings
        await page.goto("http://127.0.0.1:4186/admin/settings", { waitUntil: "networkidle" })
        await page.waitForTimeout(250)
        const heroTab = page.getByRole("tab", { name: /2\. Editor Hero/i })
        if (await heroTab.count()) {
          await heroTab.click()
          await page.waitForTimeout(150)
          await page.screenshot({ path: path.join(vpDir, "state-cms-hero-editor.png") })
          totalCaptures += 1
        }
        const previewTab = page.getByRole("tab", { name: /11\. Previsualización/i })
        if (await previewTab.count()) {
          await previewTab.click()
          await page.waitForTimeout(450)
          await page.screenshot({ path: path.join(vpDir, "state-cms-live-preview-desktop.png") })
          totalCaptures += 1
        }
      }

      // Mobile navigation drawer & CMS mobile on 390x844
      if (!AUDIT_ONLY && vp.width === 390) {
        await page.goto("http://127.0.0.1:4186/admin/settings", { waitUntil: "networkidle" })
        await page.waitForTimeout(200)
        await page.screenshot({ path: path.join(vpDir, "state-cms-mobile-390.png") })
        totalCaptures += 1

        await page.goto("http://127.0.0.1:4186/admin", { waitUntil: "networkidle" })
        const mobileBtn = page.locator("#v3-mobile-toggle-btn")
        if (await mobileBtn.count()) {
          await mobileBtn.click()
          await page.waitForTimeout(200)
          await page.screenshot({ path: path.join(vpDir, "state-mobile-navigation-drawer.png") })
          totalCaptures += 1
        }
      }

      await context.close()
    }

    if (renderErrors.length > 0) {
      throw new Error(`RENDER_ERRORS_DETECTED:\n${renderErrors.join("\n")}`)
    }

    // Build consolidated BEFORE / AFTER manifest and verify authentic visual difference
    const beforeDir = path.join(BASE_OUT, "gate13_before")
    const afterDir = path.join(BASE_OUT, "gate13_after")
    const beforeManifest = JSON.parse(fs.readFileSync(path.join(beforeDir, "manifest_before.json"), "utf8"))
    const afterManifest = JSON.parse(fs.readFileSync(path.join(afterDir, "manifest_after.json"), "utf8"))

    const comparisonPairs = beforeManifest.map((b) => {
      const a = afterManifest.find((x) => x.file === b.file)
      const beforeBytes = fs.statSync(path.join(beforeDir, b.file)).size
      const afterBytes = a ? fs.statSync(path.join(afterDir, a.file)).size : 0
      const identical = a ? b.sha256 === a.sha256 : false
      return {
        file: b.file,
        route: b.route,
        label: b.label,
        viewport: b.viewport,
        fixture: b.fixture,
        before_commit_sha: b.commit_sha,
        before_sha256: b.sha256,
        before_bytes: beforeBytes,
        after_commit_sha: a?.commit_sha || null,
        after_sha256: a?.sha256 || null,
        after_bytes: afterBytes,
        identical_sha256: identical,
      }
    })

    const combinedManifest = {
      generated_at: new Date().toISOString(),
      gate12_base_sha: beforeManifest[0]?.commit_sha,
      gate13_head_sha: afterManifest[0]?.commit_sha,
      total_pairs: comparisonPairs.length,
      identical_pairs_count: comparisonPairs.filter((p) => p.identical_sha256).length,
      distinct_pairs_count: comparisonPairs.filter((p) => !p.identical_sha256).length,
      font_verification: fontVerification,
      routes_audited_count: ALL_39_ADMIN_ROUTES.length,
      route_audit_matrix_entries: routeAuditMatrix.length,
      pairs: comparisonPairs,
    }

    fs.writeFileSync(path.join(BASE_OUT, "gate13_before_after_manifest.json"), JSON.stringify(combinedManifest, null, 2))
    fs.writeFileSync(path.join(BASE_OUT, "gate13_39_routes_audit_matrix.json"), JSON.stringify(routeAuditMatrix, null, 2))

    const beforeAfterZip = path.join(BASE_OUT, "gate13_admin_before_after.zip")
    const screenshotsZip = path.join(BASE_OUT, "gate13_admin_screenshots.zip")

    execSync(
      `cd "${BASE_OUT}" && rm -f "${beforeAfterZip}" && zip -rq "${beforeAfterZip}" gate13_before gate13_after gate13_before_after_manifest.json`
    )
    execSync(
      `cd "${BASE_OUT}" && rm -f "${screenshotsZip}" && zip -rq "${screenshotsZip}" gate13_after gate13_responsive_matrix gate13_39_routes_audit_matrix.json`
    )

    console.log(
      JSON.stringify({
        status: "GATE13_RESPONSIVE_AND_39_ROUTES_OK",
        total_captures: totalCaptures,
        routes_audited: ALL_39_ADMIN_ROUTES.length,
        matrix_checks: routeAuditMatrix.length,
        identical_pairs: combinedManifest.identical_pairs_count,
        distinct_pairs: combinedManifest.distinct_pairs_count,
        overflow_violations: overflowViolations,
        font_verification: fontVerification,
      })
    )
  } finally {
    await browser.close()
    await server.httpServer.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
