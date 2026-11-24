import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { preview } from "vite"
import { chromium } from "playwright"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIR = path.resolve(__dirname, "..")
const OUT_DIR = "/Users/levelproaudio/.gemini/antigravity/brain/11ba077a-d7d1-492e-b2b9-3bee19137a13"
const CHROME_PATH = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

const MOCK_VERSIONS = {
  results: [
    { id: "ver-2", version_number: 2, status: "draft", change_summary: "Black Friday Audio Pro", checksum_sha256: "b1c2d3e4f5a67890", is_rollback: false, created_by_email: "marketing@levelpro.cl", created_at: "2026-11-24T03:00:00Z" },
    { id: "ver-1", version_number: 1, status: "published", change_summary: "Baseline Oficial", checksum_sha256: "a1b2c3d4e5f60987", is_rollback: false, published_by_email: "gerencia@levelpro.cl", published_at: "2026-11-24T02:00:00Z", created_at: "2026-11-24T01:50:00Z" },
  ],
}

const MOCK_VERSION_DETAIL = {
  version_id: "ver-2",
  version_number: 2,
  status: "draft",
  change_summary: "Black Friday Audio Pro",
  checksum_sha256: "b1c2d3e4f5a67890",
  payload: {
    hero_title: "Black Friday Studio Pro",
    hero_subtitle: "Equipos profesionales seleccionados en edición limitada.",
    hero_cta1_text: "Ver Black Friday",
    hero_cta1_link: "/shop",
    hero_cta2_text: "Ver academia",
    hero_cta2_link: "/academy",
    site_name: "LevelPro Audio",
    tagline: "Audio profesional · Chile & Argentina",
    seo_title: "Black Friday LevelPro Audio",
    seo_description: "Equipamiento de audio profesional en Chile y Argentina.",
    show_trust_strip: true,
    show_pillars: true,
    show_products: true,
    show_courses: true,
    show_services: true,
    show_about: true,
    show_testimonial: true,
    show_brands: true,
    show_final_cta: true,
  },
  hero_slides: [
    {
      id: "sl-1",
      order: 1,
      title: "Black Friday Studio Pro",
      subtitle: "Equipos profesionales seleccionados en edición limitada.",
      desktop_image: { id: "as-1", title: "Hero Studio Desktop", url: "/og-image.png" },
      mobile_image: { id: "as-2", title: "Hero Studio Mobile", url: "/og-image.png" },
      cta1_text: "Ver Black Friday",
      cta1_link: "/shop",
      cta2_text: "Ver academia",
      cta2_link: "/academy",
    },
  ],
  banners: [
    { id: "bn-1", code: "BF-HOME-01", name: "Banner Black Friday", banner_type: "home_mid", target_page: "home", title: "Black Friday Monitores", body_text: "Stock real verificado", cta_text: "Ver catálogo", cta_link: "/shop", status: "active" },
  ],
  announcements: [
    { id: "an-1", text: "Evento Editorial Black Friday — Revisa términos comerciales", link_url: "/shop", currency: "CLP", status: "active" },
  ],
}

const MOCK_ASSETS = {
  results: [
    { id: "as-1", title: "Hero Studio Desktop", device_target: "desktop", width: 1920, height: 1080, file_format: "WEBP", sha256: "8f4b2e9c1a7d3e5f00112233", url: "/og-image.png" },
    { id: "as-2", title: "Hero Studio Mobile", device_target: "mobile", width: 800, height: 1200, file_format: "PNG", sha256: "9a1c3d5e7f2b4a6c88990011", url: "/og-image.png" },
  ],
}

const MOCK_EVENTS = {
  results: [
    { id: "ev-1", version_number: 1, event_type: "published", actor_email: "gerencia@levelpro.cl", checksum_sha256: "a1b2c3d4e5f60987", occurred_at: "2026-11-24T02:00:00Z" },
    { id: "ev-2", version_number: 2, event_type: "draft_created", actor_email: "marketing@levelpro.cl", checksum_sha256: "b1c2d3e4f5a67890", occurred_at: "2026-11-24T03:00:00Z" },
  ],
}

const SHOTS = [
  { tab: "1. Vista General", file: "gate12-01-cms-dashboard.png" },
  { tab: "2. Editor Hero", file: "gate12-02-hero-editor.png" },
  { tab: "2. Editor Hero", file: "gate12-03-hero-slides.png" },
  { tab: "3. Imágenes", file: "gate12-04-assets-manager.png" },
  { tab: "4. Banners", file: "gate12-05-category-banners.png" },
  { tab: "5. Anuncios", file: "gate12-06-announcement-bar.png" },
  { tab: "6. Secciones Home", file: "gate12-07-home-sections.png" },
  { tab: "8. SEO", file: "gate12-10-seo-metadata.png" },
  { tab: "9. Borradores", file: "gate12-11-drafts.png" },
  { tab: "10. Historial", file: "gate12-12-version-history.png" },
  { tab: "12. Publicar & Rollback", file: "gate12-13-publish.png" },
  { tab: "12. Publicar & Rollback", file: "gate12-14-rollback.png" },
]

async function main() {
  const server = await preview({ root: FRONTEND_DIR, preview: { port: 4181, host: "127.0.0.1" } })
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
    const page = await context.newPage()

    await page.route("**/api/v1/**", async (route) => {
      const url = route.request().url()
      if (url.includes("/users/me/") || url.includes("/auth/me/") || url.includes("/auth/profile/")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "u1", email: "admin@levelpro.cl", is_staff: true, is_superuser: true, roles: ["Super Admin"], effective_modules: ["dashboard", "orders", "marketing", "settings"] }) })
      }
      if (url.includes("/admin/rbac/me")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ roles: ["Super Admin"], is_superuser: true, modules: ["orders", "marketing", "settings"] }) })
      }
      if (url.includes("/admin/site-settings/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ usd_to_clp: "950.00", usd_to_ars: "1000.00", contact_whatsapp: "+5492622635045", contact_email: "ventas@levelproaudio.com" }) })
      if (url.includes("/site-settings/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...MOCK_VERSION_DETAIL.payload, cms: { version_number: 2, hero_slides: MOCK_VERSION_DETAIL.hero_slides, banners: MOCK_VERSION_DETAIL.banners, announcements: MOCK_VERSION_DETAIL.announcements } }) })
      if (url.includes("/admin/cms/versions/ver-2/preview/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_VERSION_DETAIL) })
      if (url.includes("/admin/cms/versions/ver-2/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_VERSION_DETAIL) })
      if (url.includes("/admin/cms/versions/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_VERSIONS) })
      if (url.includes("/admin/cms/assets/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_ASSETS) })
      if (url.includes("/admin/cms/banners/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ results: MOCK_VERSION_DETAIL.banners }) })
      if (url.includes("/admin/cms/events/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_EVENTS) })
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ results: [] }) })
    })

    await page.addInitScript(() => {
      sessionStorage.setItem("levelproaudio-auth", JSON.stringify({
        state: { isAuthenticated: true, user: { id: "u1", email: "admin@levelpro.cl", is_staff: true, is_superuser: true } },
        version: 0,
      }))
      document.cookie = "csrftoken=mockcsrftoken; path=/"
    })

    await page.goto("http://127.0.0.1:4181/admin/settings", { waitUntil: "networkidle" })
    await page.waitForSelector('[data-testid="admin-cms-page"]')

    for (const s of SHOTS) {
      await page.getByRole("tab", { name: s.tab, exact: true }).click()
      await page.waitForTimeout(150)
      await page.screenshot({ path: path.join(OUT_DIR, s.file), fullPage: true })
    }

    // 08. Preview Desktop (1440px) — Wait for iframe Home to render and verify headline color is pure white #F5F5F5
    await page.getByRole("button", { name: "Previsualizar" }).click()
    await page.waitForSelector('[data-testid="cms-live-preview-iframe"]')
    const iframeLoc = page.frameLocator('[data-testid="cms-live-preview-iframe"]')
    await iframeLoc.locator('[data-testid="hero-headline"]').waitFor({ state: "visible" })
    const previewDeskColor = await iframeLoc.locator('[data-testid="hero-headline"]').evaluate((el) => getComputedStyle(el).color)
    assert.equal(previewDeskColor, "rgb(245, 245, 245)", `Preview desktop headline color mismatch: ${previewDeskColor}`)
    await page.waitForTimeout(200)
    await page.screenshot({ path: path.join(OUT_DIR, "gate12-08-preview-desktop.png"), fullPage: true })

    // Verify Tablet 768px and Mobile 320px viewports in preview
    await page.getByRole("button", { name: "Tablet", exact: true }).click()
    await iframeLoc.locator('[data-testid="hero-headline"]').waitFor({ state: "visible" })
    await page.getByRole("button", { name: "Mobile 320px", exact: true }).click()
    await iframeLoc.locator('[data-testid="hero-headline"]').waitFor({ state: "visible" })

    // 09. Preview Mobile (390px) — Verify headline color & no clipping
    await page.getByRole("button", { name: "Mobile", exact: true }).click()
    await iframeLoc.locator('[data-testid="hero-headline"]').waitFor({ state: "visible" })
    const previewMobColor = await iframeLoc.locator('[data-testid="hero-headline"]').evaluate((el) => getComputedStyle(el).color)
    assert.equal(previewMobColor, "rgb(245, 245, 245)", `Preview mobile headline color mismatch: ${previewMobColor}`)
    await page.waitForTimeout(200)
    await page.screenshot({ path: path.join(OUT_DIR, "gate12-09-preview-mobile.png"), fullPage: true })

    // 15. Public Home Desktop (1440x960) — Same content & version
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.goto("http://127.0.0.1:4181/", { waitUntil: "networkidle" })
    await page.waitForSelector('[data-testid="cms-announcement-bar"]')
    const pubDeskColor = await page.locator('[data-testid="hero-headline"]').evaluate((el) => getComputedStyle(el).color)
    assert.equal(pubDeskColor, previewDeskColor, "Public Home desktop color must match Preview desktop color")
    await page.screenshot({ path: path.join(OUT_DIR, "gate12-15-public-home-updated.png"), fullPage: true })

    // 16. Public Home Mobile (390x844 real mobile viewport) — Same content & version
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(200)
    const pubMobColor = await page.locator('[data-testid="hero-headline"]').evaluate((el) => getComputedStyle(el).color)
    assert.equal(pubMobColor, previewMobColor, "Public Home mobile color must match Preview mobile color")
    await page.screenshot({ path: path.join(OUT_DIR, "gate12-16-public-home-mobile.png"), fullPage: true })

    console.log("GATE12_SCREENSHOTS_OK: 16")
  } finally {
    await browser.close()
    await server.httpServer.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
