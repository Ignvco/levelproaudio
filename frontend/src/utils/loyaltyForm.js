// Validación de formularios administrativos; no define tasas, saldos ni reglas de negocio.
const CONFIG_NUMBERS = ["puntos_por_peso", "peso_por_punto", "minimo_canje", "expiracion_dias"]

export function validLoyaltyConfigDraft(draft) {
  if (!draft || typeof draft !== "object") return false
  return CONFIG_NUMBERS.every(key => {
    const raw = draft[key]
    if (raw === undefined || raw === null || raw === "" || typeof raw === "boolean") return false
    const value = Number(raw)
    if (!Number.isFinite(value) || value < 0) return false
    return ["minimo_canje", "expiracion_dias"].includes(key) ? Number.isInteger(value) : true
  })
}

export function parseLoyaltyAdjustment(raw) {
  if (typeof raw !== "string" && typeof raw !== "number") return null
  const str = String(raw).trim()
  if (!/^[+-]?\d+$/.test(str)) return null
  const value = Number(str)
  return Number.isInteger(value) && value !== 0 && Math.abs(value) <= 2147483647 ? value : null
}
