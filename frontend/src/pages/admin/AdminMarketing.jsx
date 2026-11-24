import { useEffect, useState } from "react"
import {
  createMarketingCoupon,
  createMarketingPromotion,
  detectMarketingAbandonedCarts,
  dispatchMarketingCartRecovery,
  getMarketingAbandonedCarts,
  getMarketingConsents,
  getMarketingCoupons,
  getMarketingDashboard,
  getMarketingOutbox,
  getMarketingPromotions,
  previewMarketingPricing,
  recordMarketingConsentAdmin,
  runMarketingSchedulerTick,
  updateMarketingCoupon,
  updateMarketingPromotion,
} from "../../api/admin.api"

const TABS = [
  { id: "dashboard", label: "1. Dashboard", kind: "operativo" },
  { id: "coupons", label: "2. Cupones", kind: "operativo" },
  { id: "coupon-builder", label: "3. Creador Cupón", kind: "operativo" },
  { id: "eligibility", label: "4. Elegibilidad", kind: "referencia" },
  { id: "accumulation", label: "5. Acumulación", kind: "referencia" },
  { id: "calendar", label: "6. Calendario", kind: "operativo" },
  { id: "campaigns", label: "7. Campañas", kind: "operativo" },
  { id: "preview", label: "8. Previsualización", kind: "operativo" },
  { id: "abandoned", label: "9. Carritos Abandonados", kind: "operativo" },
  { id: "recovery", label: "10. Recuperación", kind: "referencia" },
  { id: "consent", label: "11. Consentimiento & Outbox", kind: "operativo" },
  { id: "loyalty-rewards", label: "12. Loyalty & Rewards", kind: "referencia" },
]

const CURRENCY_BADGE = {
  CLP: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  USD: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  ARS: "bg-violet-500/15 text-violet-300 border-violet-500/30",
}

const INPUT_CLS =
  "w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"

const LABEL_CLS = "mb-1 block text-[11px] font-medium text-neutral-400"

export default function AdminMarketing() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [dashboard, setDashboard] = useState(null)
  const [coupons, setCoupons] = useState([])
  const [promotions, setPromotions] = useState([])
  const [abandoned, setAbandoned] = useState([])
  const [consents, setConsents] = useState([])
  const [outbox, setOutbox] = useState([])
  const [feedback, setFeedback] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const [couponForm, setCouponForm] = useState({
    code: "",
    name: "",
    currency: "CLP",
    discount_type: "percentage",
    discount_value: "10.00",
    min_eligible_amount: "0.00",
    max_total_uses: "100",
    max_uses_per_customer: "1",
    accumulation_rule: "blocked",
    min_margin_percent: "15.00",
  })

  const [promoForm, setPromoForm] = useState({
    name: "",
    currency: "CLP",
    market: "CL",
    discount_type: "percentage",
    discount_value: "15.00",
    priority: "10",
    business_timezone: "America/Santiago",
    accumulation_rule: "blocked",
    min_margin_percent: "15.00",
  })

  const [previewForm, setPreviewForm] = useState({
    currency: "CLP",
    subtotal: "200000.00",
    coupon_code: "",
    b2b_discount: "0.00",
    loyalty_discount: "0.00",
    has_already_discounted_items: false,
  })
  const [previewResult, setPreviewResult] = useState(null)

  const [consentForm, setConsentForm] = useState({
    email: "",
    promotional_opt_in: true,
    channel: "email",
    consent_source: "ticket_soporte",
    evidence_reference: "",
  })

  const loadAll = async () => {
    setLoading(true)
    setError("")
    try {
      const [d, c, p, a, cs, ob] = await Promise.all([
        getMarketingDashboard(),
        getMarketingCoupons(),
        getMarketingPromotions(),
        getMarketingAbandonedCarts(),
        getMarketingConsents(),
        getMarketingOutbox(),
      ])
      setDashboard(d)
      setCoupons(c.results || [])
      setPromotions(p.results || [])
      setAbandoned(a.results || [])
      setConsents(cs.results || [])
      setOutbox(ob.results || [])
    } catch (err) {
      setError(err?.response?.data?.detail || "Error cargando módulo de Marketing")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const handleCreateCoupon = async (e) => {
    e.preventDefault()
    setError("")
    setFeedback("")
    try {
      const created = await createMarketingCoupon({
        ...couponForm,
        max_total_uses: couponForm.max_total_uses ? Number(couponForm.max_total_uses) : null,
        max_uses_per_customer: Number(couponForm.max_uses_per_customer || 1),
      })
      setFeedback(`Cupón ${created.code} (${created.currency}) creado correctamente.`)
      setCouponForm((f) => ({ ...f, code: "", name: "" }))
      await loadAll()
    } catch (err) {
      setError(err?.response?.data?.detail || "No se pudo crear el cupón")
    }
  }

  const handleCreatePromo = async (e) => {
    e.preventDefault()
    setError("")
    setFeedback("")
    try {
      const created = await createMarketingPromotion({
        ...promoForm,
        priority: Number(promoForm.priority || 10),
      })
      setFeedback(`Promoción '${created.name}' creada en estado ${created.status}.`)
      setPromoForm((f) => ({ ...f, name: "" }))
      await loadAll()
    } catch (err) {
      setError(err?.response?.data?.detail || "No se pudo crear la promoción")
    }
  }

  const handleSchedulerTick = async () => {
    setError("")
    setFeedback("")
    try {
      const res = await runMarketingSchedulerTick()
      setFeedback(`Scheduler ejecutado: activadas=${res.activated}, finalizadas=${res.finished}`)
      await loadAll()
    } catch (err) {
      setError(err?.response?.data?.detail || "Error ejecutando scheduler")
    }
  }

  const handlePreviewPricing = async (e) => {
    e.preventDefault()
    setError("")
    try {
      const res = await previewMarketingPricing(previewForm)
      setPreviewResult(res)
    } catch (err) {
      setPreviewResult({ valid: false, detail: err?.response?.data?.detail || "Regla rechazada" })
    }
  }

  const handleDetectAbandoned = async () => {
    setError("")
    setFeedback("")
    try {
      const res = await detectMarketingAbandonedCarts(60)
      setFeedback(`Detección completada: ${res.detected_count} carritos evaluados.`)
      await loadAll()
    } catch (err) {
      setError(err?.response?.data?.detail || "Error detectando carritos abandonados")
    }
  }

  const handleDispatchRecovery = async (triggerId) => {
    setError("")
    setFeedback("")
    try {
      const res = await dispatchMarketingCartRecovery(triggerId)
      setFeedback(`Recuperación #${triggerId}: ${res.status}${res.reason ? ` (${res.reason})` : ""}`)
      await loadAll()
    } catch (err) {
      setError(err?.response?.data?.detail || "Error preparando recuperación")
    }
  }

  const handleRecordConsent = async (e) => {
    e.preventDefault()
    setError("")
    setFeedback("")
    try {
      const res = await recordMarketingConsentAdmin(consentForm)
      setFeedback(`Consentimiento actualizado para ${res.email}: opt_in=${String(res.promotional_opt_in)}`)
      setConsentForm((f) => ({ ...f, email: "", evidence_reference: "" }))
      await loadAll()
    } catch (err) {
      setError(err?.response?.data?.detail || "Error guardando consentimiento")
    }
  }

  const kpis = dashboard?.kpis || {}
  const currentTabMeta = TABS.find((t) => t.id === activeTab)

  return (
    <div className="space-y-6 text-neutral-100">
      <div className="flex flex-col gap-3 border-b border-neutral-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
            Gate 11 · Marketing & Customer Growth
          </p>
          <h1 className="text-xl font-bold text-white sm:text-2xl">
            Promociones, Cupones & Recuperación de Carritos
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSchedulerTick}
            className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
          >
            Ejecutar Tick Scheduler
          </button>
          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3.5 py-2 text-xs font-medium text-neutral-200 transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {loading ? "Actualizando..." : "Refrescar"}
          </button>
        </div>
      </div>

      {feedback && (
        <div role="status" className="rounded-xl border border-emerald-700/60 bg-emerald-950/50 px-4 py-3 text-xs text-emerald-200">
          {feedback}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-rose-700/60 bg-rose-950/50 px-4 py-3 text-xs text-rose-200">
          {error}
        </div>
      )}

      <nav aria-label="Secciones de Marketing" role="tablist" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const isSelected = activeTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setActiveTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                isSelected
                  ? "bg-amber-500 text-neutral-950 font-semibold shadow-sm"
                  : "border border-neutral-800 bg-neutral-900/90 text-neutral-300 hover:bg-neutral-800"
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </nav>

      {currentTabMeta?.kind === "referencia" && (
        <div className="rounded-lg border border-sky-800/50 bg-sky-950/30 px-3.5 py-2 text-[11px] text-sky-200">
          Vista informativa de políticas y estado sincronizado (solo lectura).
        </div>
      )}

      {activeTab === "dashboard" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Cupones activos", kpis.active_coupons ?? 0],
              ["Promociones activas", kpis.active_promotions ?? 0],
              ["Promociones programadas", kpis.scheduled_promotions ?? 0],
              ["Carritos elegibles", kpis.abandoned_eligible ?? 0],
              ["Carritos recuperados", kpis.abandoned_recovered ?? 0],
              ["Carritos suprimidos", kpis.abandoned_suppressed ?? 0],
              ["Mensajes QA Outbox", kpis.outbox_messages ?? 0],
              ["Contactos Opt-in", kpis.consented_contacts ?? 0],
            ].map(([label, val]) => (
              <div key={label} className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-4">
                <p className="text-xs text-neutral-400">{label}</p>
                <p className="mt-1.5 text-2xl font-bold text-white">{val}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-5">
            <h2 className="text-sm font-semibold text-amber-300">Redenciones por moneda (sin mezclar monedas)</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(dashboard?.redemptions_by_currency || []).map((r) => (
                <div key={r.currency} className="rounded-lg border border-neutral-800 bg-neutral-950 p-3.5 text-xs">
                  <span className={`inline-block rounded border px-2 py-0.5 text-[11px] font-semibold ${CURRENCY_BADGE[r.currency] || "text-white"}`}>
                    {r.currency}
                  </span>
                  <p className="mt-2 text-neutral-300">Usos: <strong className="text-white">{r.count}</strong> · Descuento: <strong className="text-white">{r.total_discount}</strong></p>
                </div>
              ))}
              {(!dashboard?.redemptions_by_currency || dashboard.redemptions_by_currency.length === 0) && (
                <p className="text-xs text-neutral-400">Sin redenciones registradas aún.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "coupons" && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Listado de Cupones ({coupons.length})</h2>
          </div>
          {coupons.length === 0 ? (
            <p className="py-6 text-center text-xs text-neutral-400">No hay cupones registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="border-b border-neutral-800 text-neutral-400">
                  <tr>
                    <th className="py-2.5 pr-4">Código</th>
                    <th className="py-2.5 pr-4">Moneda</th>
                    <th className="py-2.5 pr-4">Descuento</th>
                    <th className="py-2.5 pr-4">Usos</th>
                    <th className="py-2.5 pr-4">Acumulación</th>
                    <th className="py-2.5 pr-4">Estado</th>
                    <th className="py-2.5">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id} className="border-b border-neutral-800/60">
                      <td className="py-3 pr-4 font-mono font-semibold text-amber-300">{c.code}</td>
                      <td className="py-3 pr-4">
                        <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${CURRENCY_BADGE[c.currency] || ""}`}>
                          {c.currency}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-neutral-200">{c.discount_value} ({c.discount_type})</td>
                      <td className="py-3 pr-4 text-neutral-300">{c.used_count} / {c.max_total_uses ?? "∞"}</td>
                      <td className="py-3 pr-4 text-neutral-400">{c.accumulation_rule}</td>
                      <td className="py-3 pr-4 font-medium text-neutral-200">{c.status}</td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => updateMarketingCoupon(c.id, { status: c.status === "active" ? "paused" : "active" }).then(loadAll)}
                          className="rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-1 text-[11px] font-medium hover:bg-neutral-800"
                        >
                          {c.status === "active" ? "Pausar" : "Activar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "coupon-builder" && (
        <form onSubmit={handleCreateCoupon} className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Crear Cupón Multi-Moneda</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className={LABEL_CLS}>Código</label>
              <input required placeholder="Código (ej. STUDIO10)" value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })} className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Nombre comercial</label>
              <input required placeholder="Nombre comercial" value={couponForm.name} onChange={(e) => setCouponForm({ ...couponForm, name: e.target.value })} className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Moneda (aislada)</label>
              <select value={couponForm.currency} onChange={(e) => setCouponForm({ ...couponForm, currency: e.target.value })} className={INPUT_CLS}>
                <option value="CLP">CLP</option>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>Tipo de descuento</label>
              <select value={couponForm.discount_type} onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })} className={INPUT_CLS}>
                <option value="percentage">Porcentaje (%)</option>
                <option value="fixed_amount">Importe fijo</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>Valor del descuento</label>
              <input required type="number" step="0.01" placeholder="Valor descuento" value={couponForm.discount_value} onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })} className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Margen mínimo requerido (%)</label>
              <input type="number" step="0.01" placeholder="Margen mínimo %" value={couponForm.min_margin_percent} onChange={(e) => setCouponForm({ ...couponForm, min_margin_percent: e.target.value })} className={INPUT_CLS} />
            </div>
          </div>
          <button type="submit" className="rounded-lg bg-amber-500 px-5 py-2.5 text-xs font-bold text-neutral-950 transition hover:bg-amber-400">
            Guardar Cupón
          </button>
        </form>
      )}

      {activeTab === "eligibility" && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-5 text-xs space-y-3">
          <h2 className="text-sm font-semibold text-white">Reglas de Elegibilidad & Margen Mínimo</h2>
          <p className="text-neutral-300">Los cupones validan moneda exacta (`CLP`, `USD`, `ARS`), monto mínimo elegible y protección de margen contra `WeightedAverageCostState` / `CostLayer` (Gate 6).</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {coupons.map((c) => (
              <div key={c.id} className="rounded-lg border border-neutral-800 bg-neutral-950 p-3.5">
                <span className="font-mono font-semibold text-amber-300">{c.code}</span> · Min: {c.min_eligible_amount} {c.currency} · Margen min: {c.min_margin_percent ?? "N/A"}%
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "accumulation" && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-5 text-xs space-y-2.5">
          <h2 className="text-sm font-semibold text-white">Política de Acumulación & Precedencia Comercial</h2>
          <ul className="list-disc pl-5 text-neutral-300 space-y-1.5">
            <li>Precios B2B contractuales tienen precedencia y bloquean cupones/promociones promocionales por defecto.</li>
            <li>Cupones y promociones no se acumulan salvo regla explícita bilateral (`allow_with_promotion`).</li>
            <li>Canje Loyalty solo es acumulable si el cupón declara `allow_with_loyalty` y moneda `CLP`.</li>
            <li>Sorteos / Stickers (`rewards`) permanecen estrictamente separados sin otorgar descuentos monetarios cruzados.</li>
          </ul>
        </div>
      )}

      {activeTab === "calendar" && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-5 text-xs space-y-3">
          <h2 className="text-sm font-semibold text-white">Calendario de Promociones Programadas ({promotions.length})</h2>
          {promotions.length === 0 ? (
            <p className="py-4 text-neutral-400">Sin campañas programadas.</p>
          ) : (
            promotions.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-950 p-3.5">
                <div>
                  <p className="font-semibold text-white">{p.name} ({p.currency})</p>
                  <p className="mt-0.5 text-neutral-400">Ventana: {p.starts_at} → {p.ends_at} · TZ: {p.business_timezone}</p>
                </div>
                <span className="rounded-md bg-neutral-800 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                  {p.status} · P{p.priority}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "campaigns" && (
        <div className="space-y-4">
          <form onSubmit={handleCreatePromo} className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Nueva Campaña Promocional Programada</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className={LABEL_CLS}>Nombre campaña</label>
                <input required placeholder="Nombre campaña" value={promoForm.name} onChange={(e) => setPromoForm({ ...promoForm, name: e.target.value })} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Moneda</label>
                <select value={promoForm.currency} onChange={(e) => setPromoForm({ ...promoForm, currency: e.target.value })} className={INPUT_CLS}>
                  <option value="CLP">CLP</option>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>Descuento (%)</label>
                <input required type="number" step="0.01" placeholder="Valor %" value={promoForm.discount_value} onChange={(e) => setPromoForm({ ...promoForm, discount_value: e.target.value })} className={INPUT_CLS} />
              </div>
            </div>
            <button type="submit" className="rounded-lg bg-amber-500 px-5 py-2.5 text-xs font-bold text-neutral-950 transition hover:bg-amber-400">
              Programar Campaña
            </button>
          </form>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-5 space-y-2.5 text-xs">
            {promotions.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-2.5 last:border-b-0 last:pb-0">
                <span className="text-neutral-200">{p.name} · {p.discount_value} ({p.currency}) · <strong className="text-amber-300">{p.status}</strong></span>
                <button
                  type="button"
                  onClick={() => updateMarketingPromotion(p.id, { status: p.status === "paused" ? "active" : "paused" }).then(loadAll)}
                  className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1 text-[11px] hover:bg-neutral-800"
                >
                  {p.status === "paused" ? "Reanudar" : "Pausar"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "preview" && (
        <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/80 p-5">
          <h2 className="text-sm font-semibold text-white">Previsualización de Descuento y Margen (PricingAdjustmentSnapshot)</h2>
          <form onSubmit={handlePreviewPricing} className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className={LABEL_CLS}>Moneda</label>
              <select value={previewForm.currency} onChange={(e) => setPreviewForm({ ...previewForm, currency: e.target.value })} className={INPUT_CLS}>
                <option value="CLP">CLP</option>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>Subtotal</label>
              <input type="number" step="0.01" placeholder="Subtotal" value={previewForm.subtotal} onChange={(e) => setPreviewForm({ ...previewForm, subtotal: e.target.value })} className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Código de cupón</label>
              <input placeholder="Código cupón" value={previewForm.coupon_code} onChange={(e) => setPreviewForm({ ...previewForm, coupon_code: e.target.value })} className={INPUT_CLS} />
            </div>
            <button type="submit" className="md:col-span-3 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-500">
              Simular Cálculo Comercial
            </button>
          </form>
          {previewResult && (
            previewResult.valid === false ? (
              <div className="rounded-lg border border-rose-700/60 bg-rose-950/40 p-3.5 text-xs text-rose-200">
                {previewResult.detail}
              </div>
            ) : (
              <div data-testid="pricing-breakdown" className="grid grid-cols-2 gap-3 rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-xs sm:grid-cols-4">
                <div><span className="text-neutral-400">Moneda</span><p className="font-semibold text-white">{previewResult.currency}</p></div>
                <div><span className="text-neutral-400">Subtotal Ref.</span><p className="font-semibold text-white">{previewResult.reference_subtotal}</p></div>
                <div><span className="text-neutral-400">Desc. Promoción</span><p className="font-semibold text-emerald-300">{previewResult.promotion_discount}</p></div>
                <div><span className="text-neutral-400">Desc. Cupón</span><p className="font-semibold text-emerald-300" data-testid="preview-coupon-discount">{previewResult.coupon_discount}</p></div>
                <div><span className="text-neutral-400">Desc. Efectivo</span><p className="font-semibold text-amber-300">{previewResult.effective_discount}</p></div>
                <div><span className="text-neutral-400">Total Final</span><p className="font-bold text-white">{previewResult.final_total}</p></div>
                <div><span className="text-neutral-400">Margen (%)</span><p className="font-semibold text-sky-300">{previewResult.calculated_margin_percent ?? "Restringido / N/A"}</p></div>
                <div><span className="text-neutral-400">Estado Costo</span><p className="font-semibold text-neutral-300">{previewResult.cost_status}</p></div>
              </div>
            )
          )}
        </div>
      )}

      {activeTab === "abandoned" && (
        <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/80 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">Carritos Abandonados Detectados ({abandoned.length})</h2>
            <button type="button" onClick={handleDetectAbandoned} className="rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-bold text-neutral-950 hover:bg-amber-400">
              Detectar Inactivos (60m)
            </button>
          </div>
          {abandoned.length === 0 ? (
            <p className="py-4 text-center text-xs text-neutral-400">No hay carritos abandonados detectados.</p>
          ) : (
            abandoned.map((t) => {
              const isBlocked = t.status === "recovered" || t.status === "suppressed"
              return (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950 p-3.5 text-xs">
                  <div>
                    <p className="font-semibold text-white">Trigger #{String(t.id).slice(0, 8)} · Cart #{String(t.cart_id).slice(0, 8)} ({t.user_email || "anónimo"})</p>
                    <p className="mt-0.5 text-neutral-400">
                      Estado: <strong className="text-neutral-200">{t.status}</strong> · Intentos: {t.attempts_count}/{t.max_attempts}
                      {t.suppression_reason ? ` · Motivo: ${t.suppression_reason}` : ""}
                    </p>
                  </div>
                  {isBlocked ? (
                    <span className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-[11px] font-medium text-neutral-400">
                      {t.status === "recovered" ? "Recuperado (bloqueado)" : "Suprimido (bloqueado)"}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDispatchRecovery(t.id)}
                      className="rounded-lg border border-indigo-600 bg-indigo-950/40 px-3 py-1.5 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-900/50"
                    >
                      Preparar Recuperación QA
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {activeTab === "recovery" && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-5 text-xs space-y-2">
          <h2 className="text-sm font-semibold text-white">Flujo de Recuperación & Enlaces Opacos</h2>
          <p className="text-neutral-300">Cada trigger genera un token opaco `mktrec_...` con expiración de 72h, verificación de pertenencia de usuario, revalidación de stock/precio y bloqueo automático tras conversión.</p>
          <p className="text-neutral-400">Triggers recuperados: {kpis.abandoned_recovered ?? 0} · Suprimidos: {kpis.abandoned_suppressed ?? 0}</p>
        </div>
      )}

      {activeTab === "consent" && (
        <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/80 p-5 text-xs">
          <h2 className="text-sm font-semibold text-white">Consentimiento Comercial Documentado & Outbox QA</h2>
          <form onSubmit={handleRecordConsent} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input required type="email" placeholder="cliente@dominio.cl" value={consentForm.email} onChange={(e) => setConsentForm({ ...consentForm, email: e.target.value })} className={INPUT_CLS} />
            <input required={consentForm.promotional_opt_in} placeholder="Evidencia (ej. TKT-2026-8841)" value={consentForm.evidence_reference} onChange={(e) => setConsentForm({ ...consentForm, evidence_reference: e.target.value })} className={INPUT_CLS} />
            <label className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-200">
              <input type="checkbox" checked={consentForm.promotional_opt_in} onChange={(e) => setConsentForm({ ...consentForm, promotional_opt_in: e.target.checked })} />
              Opt-in promocional
            </label>
            <button type="submit" className="rounded-lg bg-amber-500 px-3 py-2 font-bold text-neutral-950 hover:bg-amber-400">Registrar</button>
          </form>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3.5 space-y-1.5">
              <p className="font-semibold text-amber-300">Consentimientos ({consents.length})</p>
              {consents.map((c) => (
                <p key={c.id} className="text-neutral-300">
                  {c.email} · opt_in={String(c.promotional_opt_in)} · {c.consent_origin} ({c.evidence_reference || c.consent_source})
                </p>
              ))}
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3.5 space-y-1.5">
              <p className="font-semibold text-indigo-300">Outbox QA ({outbox.length})</p>
              {outbox.map((m) => (
                <p key={m.id} className="text-neutral-300">{m.recipient_email} · {m.status} · {m.channel_class}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "loyalty-rewards" && (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-neutral-800 bg-neutral-900/80 p-5 md:grid-cols-2 text-xs">
          <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
            <h3 className="font-semibold text-amber-300">Loyalty (Puntos CLP)</h3>
            <p className="mt-1.5 text-neutral-300">Cuentas: {dashboard?.loyalty_summary?.accounts_count ?? 0}</p>
            <p className="text-neutral-300">Saldo total puntos: {dashboard?.loyalty_summary?.total_points_balance ?? 0}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
            <h3 className="font-semibold text-emerald-300">Rewards (Sorteos & Stickers)</h3>
            <p className="mt-1.5 text-neutral-300">Campañas: {dashboard?.rewards_summary?.campaigns_count ?? 0} (activas: {dashboard?.rewards_summary?.active_campaigns ?? 0})</p>
            <p className="text-neutral-300">Stickers: {dashboard?.rewards_summary?.stickers_count ?? 0} · Ganadores: {dashboard?.rewards_summary?.winners_count ?? 0}</p>
          </div>
        </div>
      )}
    </div>
  )
}
