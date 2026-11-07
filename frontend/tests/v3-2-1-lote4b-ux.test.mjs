import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { validLoyaltyConfigDraft, parseLoyaltyAdjustment } from "../src/utils/loyaltyForm.js"

test("ajustes de fidelización requieren entero distinto de cero dentro del límite del backend", () => {
  assert.equal(parseLoyaltyAdjustment("500"), 500)
  assert.equal(parseLoyaltyAdjustment("-200"), -200)
  for (const value of ["", "-", "0", "1.5", "abc", "2147483648", null, undefined]) {
    assert.equal(parseLoyaltyAdjustment(value), null, String(value))
  }
})

test("configuración no envía NaN, campos vacíos ni días fraccionarios", () => {
  const good = { puntos_por_peso: 0.01, peso_por_punto: 1, minimo_canje: 500, expiracion_dias: 0 }
  assert.equal(validLoyaltyConfigDraft(good), true)
  for (const [key, value] of [["minimo_canje", ""], ["expiracion_dias", 1.2], ["puntos_por_peso", NaN], ["peso_por_punto", -1]]) {
    assert.equal(validLoyaltyConfigDraft({ ...good, [key]: value }), false)
  }
})

test("Servicios y Rewards distinguen error de lista vacía sin fingir ceros", () => {
  const root = new URL("../src/", import.meta.url)
  const read = file => readFileSync(new URL(file, root), "utf8")
  assert.match(read("pages/Services.jsx"), /data-testid="services-error"/)
  assert.match(read("pages/admin/AdminServices.jsx"), /bookingsReliable \? bookings\.length : "—"/)
  assert.match(read("pages/admin/AdminLoyalty.jsx"), /validLoyaltyConfigDraft\(cfgForm\)/)
  assert.match(read("pages/admin/AdminRewardsCampaigns.jsx"), /isError && <ErrorState/)
  assert.match(read("pages/admin/AdminRewardsWinners.jsx"), /winnersError && <ErrorState/)
})
