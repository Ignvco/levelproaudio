import fs from "node:fs"
import path from "node:path"
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

const CORE_ROUTES = [
  { slug: "dashboard", path: "/admin" },
  { slug: "products-pim", path: "/admin/products" },
  { slug: "orders-oms", path: "/admin/orders" },
  { slug: "inventory-wms", path: "/admin/inventory" },
  { slug: "procurement", path: "/admin/procurement" },
  { slug: "finance", path: "/admin/finance" },
  { slug: "crm-b2b", path: "/admin/b2b" },
  { slug: "logistics", path: "/admin/logistics" },
  { slug: "marketing", path: "/admin/marketing" },
  { slug: "cms-settings", path: "/admin/settings" },
  { slug: "academy", path: "/admin/academy" },
  { slug: "services", path: "/admin/services" },
  { slug: "loyalty", path: "/admin/loyalty" },
  { slug: "rewards", path: "/admin/rewards" },
]

async function main() {
  const server = await preview({ root: FRONTEND_DIR, preview: { port: 4186, host: "127.0.0.1" } })
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true })

  let totalCaptures = 0
  const overflowViolations = []

  try {
    for (const vp of VIEWPORTS) {
      const vpDir = path.join(MATRIX_DIR, vp.name)
      fs.mkdirSync(vpDir, { recursive: true })

      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      })
      const page = await context.newPage()

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

      const routesForVp =
        vp.width === 3840
          ? CORE_ROUTES.slice(0, 6) // 4K sample across Dashboard, PIM, OMS, WMS, Procurement, Finance
          : CORE_ROUTES

      for (const r of routesForVp) {
        await page.goto(`http://127.0.0.1:4186${r.path}`, { waitUntil: "networkidle" })
        await page.waitForTimeout(200)

        // Verify zero unwanted document-level horizontal overflow
        const overflowDelta = await page.evaluate(() => {
          return document.documentElement.scrollWidth - window.innerWidth
        })
        if (overflowDelta > 4) {
          overflowViolations.push(`${vp.name} ${r.path}: scrollWidth exceeds viewport by ${overflowDelta}px`)
        }

        const outFile = path.join(vpDir, `${r.slug}.png`)
        await page.screenshot({ path: outFile, fullPage: vp.width < 3840 })
        totalCaptures += 1
      }

      // On 1440x900 desktop, also capture explicit UI states (Command Palette modal, Notification Center, Form state, Empty state)
      if (vp.width === 1440) {
        await page.goto("http://127.0.0.1:4186/admin", { waitUntil: "networkidle" })
        await page.waitForTimeout(150)

        // State 1: Command Palette open with search query
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

          // State 2: Command Palette empty state
          if (await inp.count()) {
            await page.route("**/api/v1/admin/search/global/**", async (route) => {
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                  query: "ZZZZ999",
                  min_length_met: true,
                  results: { products: [], variants: [], serials: [], orders: [], customers: [] },
                  total_count: 0,
                }),
              })
            })
            await inp.fill("ZZZZ999")
            await page.waitForTimeout(300)
            await page.screenshot({ path: path.join(vpDir, "state-command-palette-empty.png") })
          }
          await page.keyboard.press("Escape")
          totalCaptures += 2
        }

        // State 3: Notification Center open
        const bellBtn = page.locator('[data-testid="admin-notifications-btn"]')
        if (await bellBtn.count()) {
          await bellBtn.click()
          await page.waitForTimeout(200)
          await page.screenshot({ path: path.join(vpDir, "state-notification-center.png") })
          await page.keyboard.press("Escape")
          totalCaptures += 1
        }

        // State 4: Marketing Coupon Builder Form
        await page.goto("http://127.0.0.1:4186/admin/marketing", { waitUntil: "networkidle" })
        await page.waitForTimeout(150)
        const builderTab = page.getByRole("tab", { name: /3\. Creador Cupón/i })
        if (await builderTab.count()) {
          await builderTab.click()
          await page.waitForTimeout(150)
          await page.screenshot({ path: path.join(vpDir, "state-marketing-coupon-form.png") })
          totalCaptures += 1
        }
      }

      // On 390x844 mobile, capture mobile drawer menu open
      if (vp.width === 390) {
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

    // Package gate13_admin_before_after.zip and gate13_admin_screenshots.zip
    const beforeAfterZip = path.join(BASE_OUT, "gate13_admin_before_after.zip")
    const screenshotsZip = path.join(BASE_OUT, "gate13_admin_screenshots.zip")

    execSync(
      `cd "${BASE_OUT}" && rm -f "${beforeAfterZip}" && zip -rq "${beforeAfterZip}" gate13_before gate13_after`
    )
    execSync(
      `cd "${BASE_OUT}" && rm -f "${screenshotsZip}" && zip -rq "${screenshotsZip}" gate13_after gate13_responsive_matrix`
    )

    console.log(
      JSON.stringify({
        status: "GATE13_RESPONSIVE_MATRIX_OK",
        total_captures: totalCaptures,
        overflow_violations: overflowViolations,
        before_after_zip: beforeAfterZip,
        screenshots_zip: screenshotsZip,
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
