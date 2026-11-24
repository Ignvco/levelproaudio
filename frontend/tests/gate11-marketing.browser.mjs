import path from "node:path"
import { fileURLToPath } from "node:url"
import { preview } from "vite"
import { chromium } from "playwright"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIR = path.resolve(__dirname, "..")
const OUT_DIR = "/Users/levelproaudio/.gemini/antigravity/brain/11ba077a-d7d1-492e-b2b9-3bee19137a13"
const CHROME_PATH = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

const MOCK_DASHBOARD = {
  kpis: {
    active_coupons: 3,
    active_promotions: 1,
    scheduled_promotions: 2,
    abandoned_eligible: 2,
    abandoned_recovered: 1,
    abandoned_suppressed: 1,
    outbox_messages: 3,
    consented_contacts: 14,
    suppressed_contacts: 1,
  },
  redemptions_by_currency: [
    { currency: "CLP", count: 8, total_discount: "160000.00" },
    { currency: "USD", count: 3, total_discount: "75.00" },
    { currency: "ARS", count: 2, total_discount: "45000.00" },
  ],
  loyalty_summary: { accounts_count: 18, total_points_balance: 42500 },
  rewards_summary: { campaigns_count: 2, active_campaigns: 1, stickers_count: 15, winners_count: 1, domain_separation: "strict_no_cross_discount" },
}

const MOCK_COUPONS = {
  results: [
    { id: 1, code: "STUDIO10CLP", name: "Estudios 10% CLP", currency: "CLP", discount_type: "percentage", discount_value: "10.00", used_count: 4, max_total_uses: 50, accumulation_rule: "blocked", min_eligible_amount: "50000.00", min_margin_percent: "15.00", status: "active" },
    { id: 2, code: "PROAUDIO25USD", name: "25 USD Off", currency: "USD", discount_type: "fixed_amount", discount_value: "25.00", used_count: 2, max_total_uses: 20, accumulation_rule: "allow_with_promotion", min_eligible_amount: "150.00", min_margin_percent: "12.00", status: "active" },
  ],
}

const MOCK_PROMOTIONS = {
  results: [
    { id: 1, name: "Cyber Audio Pro 15%", currency: "CLP", discount_type: "percentage", discount_value: "15.00", status: "active", priority: 1, business_timezone: "America/Santiago", starts_at: "2026-11-24T00:00:00-03:00", ends_at: "2026-11-28T23:59:59-03:00" },
    { id: 2, name: "Black Studio Week USD", currency: "USD", discount_type: "percentage", discount_value: "12.00", status: "scheduled", priority: 5, business_timezone: "America/New_York", starts_at: "2026-11-29T00:00:00-05:00", ends_at: "2026-12-03T23:59:59-05:00" },
  ],
}

const MOCK_ABANDONED = {
  results: [
    { id: 11, cart_id: 401, user_email: "productor@estudio.cl", status: "eligible", attempts_count: 0, max_attempts: 2, suppression_reason: "" },
    { id: 12, cart_id: 402, user_email: "ingeniero@live.cl", status: "recovered", attempts_count: 1, max_attempts: 2, suppression_reason: "converted_to_order" },
  ],
}

const MOCK_CONSENTS = {
  results: [
    { id: 1, email: "productor@estudio.cl", promotional_opt_in: true, consent_source: "explicit_form" },
    { id: 2, email: "optout@cliente.cl", promotional_opt_in: false, consent_source: "unsubscribe_link" },
  ],
}

const MOCK_OUTBOX = {
  results: [
    { id: 1, channel_class: "commercial_cart_recovery", recipient_email: "productor@estudio.cl", subject: "Tu carrito en LevelPro Audio sigue disponible", status: "skipped_qa", attempts: 1 },
  ],
}

const SHOTS = [
  { tab: "1. Dashboard", file: "gate11-01-dashboard.png" },
  { tab: "2. Cupones", file: "gate11-02-coupons.png" },
  { tab: "3. Creador Cupón", file: "gate11-03-coupon-builder.png" },
  { tab: "4. Elegibilidad", file: "gate11-04-eligibility.png" },
  { tab: "5. Acumulación", file: "gate11-05-accumulation.png" },
  { tab: "6. Calendario", file: "gate11-06-calendar.png" },
  { tab: "7. Campañas", file: "gate11-07-campaigns.png" },
  { tab: "8. Previsualización", file: "gate11-08-pricing-preview.png" },
  { tab: "9. Carritos Abandonados", file: "gate11-09-abandoned-carts.png" },
  { tab: "10. Recuperación", file: "gate11-10-recovery.png" },
  { tab: "11. Consentimiento & Outbox", file: "gate11-11-consent-outbox.png" },
  { tab: "12. Loyalty & Rewards", file: "gate11-12-loyalty-rewards.png" },
]

async function main() {
  const server = await preview({ root: FRONTEND_DIR, preview: { port: 4177, host: "127.0.0.1" } })
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
    const page = await context.newPage()

    await page.route("**/api/v1/**", async (route) => {
      const url = route.request().url()
      if (url.includes("/admin/marketing/dashboard/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_DASHBOARD) })
      if (url.includes("/admin/marketing/coupons/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_COUPONS) })
      if (url.includes("/admin/marketing/promotions/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_PROMOTIONS) })
      if (url.includes("/admin/marketing/abandoned-carts/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_ABANDONED) })
      if (url.includes("/admin/marketing/consents/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_CONSENTS) })
      if (url.includes("/admin/marketing/outbox/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_OUTBOX) })
      if (url.includes("/admin/marketing/pricing-preview/")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            valid: true,
            currency: "CLP",
            reference_subtotal: "200000.00",
            promotion_discount: "30000.00",
            coupon_discount: "0.00",
            effective_discount: "30000.00",
            final_total: "170000.00",
            calculated_margin_percent: "17.65",
            cost_status: "known",
          }),
        })
      }
      if (url.includes("/users/me/") || url.includes("/auth/me/") || url.includes("/auth/profile/")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "u1", username: "admin", email: "admin@levelpro.cl", is_staff: true, is_superuser: true, roles: ["Super Admin"], effective_modules: ["dashboard", "orders", "inventory", "finances"] }) })
      }
      if (url.includes("/admin/rbac/me")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ roles: ["Super Admin"], is_superuser: true, modules: ["orders", "inventory", "finances"] }) })
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ results: [] }) })
    })

    await page.addInitScript(() => {
      sessionStorage.setItem("levelproaudio-auth", JSON.stringify({
        state: { isAuthenticated: true, user: { id: "u1", username: "admin", email: "admin@levelpro.cl", is_staff: true, is_superuser: true } },
        version: 0,
      }))
      document.cookie = "csrftoken=mockcsrftoken; path=/"
    })

    await page.goto("http://127.0.0.1:4177/admin/marketing", { waitUntil: "networkidle" })
    await page.waitForSelector("text=Promociones, Cupones & Recuperación de Carritos")

    for (const s of SHOTS) {
      await page.getByRole("tab", { name: s.tab, exact: true }).click()
      await page.waitForTimeout(150)
      if (s.tab === "8. Previsualización") {
        await page.getByRole("button", { name: "Simular Cálculo Comercial" }).click()
        await page.waitForTimeout(150)
      }
      await page.screenshot({ path: path.join(OUT_DIR, s.file), fullPage: true })
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole("tab", { name: "1. Dashboard", exact: true }).click()
    await page.waitForTimeout(150)
    await page.screenshot({ path: path.join(OUT_DIR, "gate11-mobile-responsive.png"), fullPage: true })
    console.log("GATE11_SCREENSHOTS_OK:", SHOTS.length + 1)
  } finally {
    await browser.close()
    await server.httpServer.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
