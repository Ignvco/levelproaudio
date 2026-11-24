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
  { id: "dashboard", label: "1. Dashboard" },
  { id: "coupons", label: "2. Cupones" },
  { id: "coupon-builder", label: "3. Creador Cupón" },
  { id: "eligibility", label: "4. Elegibilidad" },
  { id: "accumulation", label: "5. Acumulación" },
  { id: "calendar", label: "6. Calendario" },
  { id: "campaigns", label: "7. Campañas" },
  { id: "preview", label: "8. Previsualización" },
  { id: "abandoned", label: "9. Carritos Abandonados" },
  { id: "recovery", label: "10. Recuperación" },
  { id: "consent", label: "11. Consentimiento & Outbox" },
  { id: "loyalty-rewards", label: "12. Loyalty & Rewards" },
]

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
    consent_source: "admin_panel",
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
      setConsentForm((f) => ({ ...f, email: "" }))
      await loadAll()
    } catch (err) {
      setError(err?.response?.data?.detail || "Error guardando consentimiento")
    }
  }

  const kpis = dashboard?.kpis || {}

  return (
    <div className="space-y-6 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-amber-400">Gate 11 · Marketing & Customer Growth</p>
          <h1 className="text-2xl font-bold text-white">Promociones, Cupones & Recuperación de Carritos</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSchedulerTick}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            Ejecutar Tick Scheduler
          </button>
          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
          >
            {loading ? "Actualizando..." : "Refrescar"}
          </button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg border border-emerald-700/60 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-200">
          {feedback}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-700/60 bg-rose-950/50 px-4 py-2 text-sm text-rose-200">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === t.id
                ? "bg-amber-500 text-slate-950 font-semibold"
                : "bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "dashboard" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
              <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-1 text-2xl font-bold text-white">{val}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="text-sm font-semibold text-amber-300">Redenciones por moneda (sin mezclar monedas)</h2>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(dashboard?.redemptions_by_currency || []).map((r) => (
                <div key={r.currency} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs">
                  <p className="font-semibold text-white">{r.currency}</p>
                  <p className="text-slate-400">Usos: {r.count} · Descuento: {r.total_discount}</p>
                </div>
              ))}
              {(!dashboard?.redemptions_by_currency || dashboard.redemptions_by_currency.length === 0) && (
                <p className="text-xs text-slate-400">Sin redenciones registradas aún.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "coupons" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 overflow-x-auto">
          <h2 className="mb-3 text-sm font-semibold text-white">Listado de Cupones ({coupons.length})</h2>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 text-slate-400">
              <tr>
                <th className="py-2 pr-3">Código</th>
                <th className="py-2 pr-3">Moneda</th>
                <th className="py-2 pr-3">Descuento</th>
                <th className="py-2 pr-3">Usos</th>
                <th className="py-2 pr-3">Acumulación</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-b border-slate-800/60">
                  <td className="py-2 pr-3 font-mono font-semibold text-amber-300">{c.code}</td>
                  <td className="py-2 pr-3">{c.currency}</td>
                  <td className="py-2 pr-3">{c.discount_value} ({c.discount_type})</td>
                  <td className="py-2 pr-3">{c.used_count} / {c.max_total_uses ?? "∞"}</td>
                  <td className="py-2 pr-3">{c.accumulation_rule}</td>
                  <td className="py-2 pr-3">{c.status}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => updateMarketingCoupon(c.id, { status: c.status === "active" ? "paused" : "active" }).then(loadAll)}
                      className="rounded border border-slate-700 px-2 py-1 text-[11px] hover:bg-slate-800"
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

      {activeTab === "coupon-builder" && (
        <form onSubmit={handleCreateCoupon} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-3">
          <h2 className="md:col-span-3 text-sm font-semibold text-white">Crear Cupón Multi-Moneda</h2>
          <input required placeholder="Código (ej. STUDIO10)" value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })} className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs" />
          <input required placeholder="Nombre comercial" value={couponForm.name} onChange={(e) => setCouponForm({ ...couponForm, name: e.target.value })} className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs" />
          <select value={couponForm.currency} onChange={(e) => setCouponForm({ ...couponForm, currency: e.target.value })} className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs">
            <option value="CLP">CLP</option>
            <option value="USD">USD</option>
            <option value="ARS">ARS</option>
          </select>
          <select value={couponForm.discount_type} onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })} className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs">
            <option value="percentage">Porcentaje (%)</option>
            <option value="fixed_amount">Importe fijo</option>
          </select>
          <input required type="number" step="0.01" placeholder="Valor descuento" value={couponForm.discount_value} onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })} className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs" />
          <input type="number" step="0.01" placeholder="Margen mínimo %" value={couponForm.min_margin_percent} onChange={(e) => setCouponForm({ ...couponForm, min_margin_percent: e.target.value })} className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs" />
          <button type="submit" className="md:col-span-3 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400">
            Guardar Cupón
          </button>
        </form>
      )}

      {activeTab === "eligibility" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-xs space-y-2">
          <h2 className="text-sm font-semibold text-white">Reglas de Elegibilidad & Margen Mínimo</h2>
          <p className="text-slate-300">Los cupones validan moneda exacta (`CLP`, `USD`, `ARS`), monto mínimo elegible, inclusión/exclusión de productos, categorías, marcas y protección de margen contra `WeightedAverageCostState` (Gate 6).</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {coupons.map((c) => (
              <div key={c.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <span className="font-mono text-amber-300">{c.code}</span> · Min: {c.min_eligible_amount} {c.currency} · Margen min: {c.min_margin_percent ?? "N/A"}%
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "accumulation" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-xs space-y-2">
          <h2 className="text-sm font-semibold text-white">Política de Acumulación & Precedencia Comercial</h2>
          <ul className="list-disc pl-5 text-slate-300 space-y-1">
            <li>Precios B2B contractuales tienen precedencia y bloquean cupones/promociones promocionales por defecto.</li>
            <li>Cupones y promociones no se acumulan salvo regla explícita bilateral (`allow_with_promotion`).</li>
            <li>Canje Loyalty solo es acumulable si el cupón declara `allow_with_loyalty` y moneda `CLP`.</li>
            <li>Sorteos / Stickers (`rewards`) permanecen estrictamente separados sin otorgar descuentos monetarios cruzados.</li>
          </ul>
        </div>
      )}

      {activeTab === "calendar" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-xs space-y-3">
          <h2 className="text-sm font-semibold text-white">Calendario de Promociones Programadas</h2>
          {promotions.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div>
                <p className="font-semibold text-white">{p.name} ({p.currency})</p>
                <p className="text-slate-400">Ventana: {p.starts_at} → {p.ends_at} · TZ: {p.business_timezone}</p>
              </div>
              <span className="rounded bg-slate-800 px-2 py-1 text-[11px] text-amber-300">{p.status} · P{p.priority}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === "campaigns" && (
        <div className="space-y-4">
          <form onSubmit={handleCreatePromo} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-3">
            <h2 className="md:col-span-3 text-sm font-semibold text-white">Nueva Campaña Promocional Programada</h2>
            <input required placeholder="Nombre campaña" value={promoForm.name} onChange={(e) => setPromoForm({ ...promoForm, name: e.target.value })} className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs" />
            <select value={promoForm.currency} onChange={(e) => setPromoForm({ ...promoForm, currency: e.target.value })} className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs">
              <option value="CLP">CLP</option>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
            <input required type="number" step="0.01" placeholder="Valor %" value={promoForm.discount_value} onChange={(e) => setPromoForm({ ...promoForm, discount_value: e.target.value })} className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs" />
            <button type="submit" className="md:col-span-3 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400">
              Programar Campaña
            </button>
          </form>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-2 text-xs">
            {promotions.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span>{p.name} · {p.discount_value} ({p.currency}) · {p.status}</span>
                <button
                  type="button"
                  onClick={() => updateMarketingPromotion(p.id, { status: p.status === "paused" ? "active" : "paused" }).then(loadAll)}
                  className="rounded border border-slate-700 px-2 py-1 text-[11px]"
                >
                  {p.status === "paused" ? "Reanudar" : "Pausar"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "preview" && (
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="text-sm font-semibold text-white">Previsualización de Descuento y Margen (PricingAdjustmentSnapshot)</h2>
          <form onSubmit={handlePreviewPricing} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <select value={previewForm.currency} onChange={(e) => setPreviewForm({ ...previewForm, currency: e.target.value })} className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs">
              <option value="CLP">CLP</option>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
            <input type="number" step="0.01" placeholder="Subtotal" value={previewForm.subtotal} onChange={(e) => setPreviewForm({ ...previewForm, subtotal: e.target.value })} className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs" />
            <input placeholder="Código cupón" value={previewForm.coupon_code} onChange={(e) => setPreviewForm({ ...previewForm, coupon_code: e.target.value })} className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs" />
            <button type="submit" className="md:col-span-3 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500">
              Simular Cálculo Comercial
            </button>
          </form>
          {previewResult && (
            <pre className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-emerald-300 overflow-x-auto">
              {JSON.stringify(previewResult, null, 2)}
            </pre>
          )}
        </div>
      )}

      {activeTab === "abandoned" && (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Carritos Abandonados Detectados ({abandoned.length})</h2>
            <button type="button" onClick={handleDetectAbandoned} className="rounded bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950">
              Detectar Inactivos (60m)
            </button>
          </div>
          {abandoned.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs">
              <div>
                <p className="font-semibold text-white">Trigger #{t.id} · Cart #{t.cart_id} ({t.user_email || "anónimo"})</p>
                <p className="text-slate-400">Estado: {t.status} · Intentos: {t.attempts_count}/{t.max_attempts} {t.suppression_reason ? `· Motivo: ${t.suppression_reason}` : ""}</p>
              </div>
              <button type="button" onClick={() => handleDispatchRecovery(t.id)} className="rounded border border-indigo-600 px-3 py-1 text-[11px] text-indigo-300 hover:bg-indigo-950">
                Preparar Recuperación QA
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === "recovery" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-xs space-y-2">
          <h2 className="text-sm font-semibold text-white">Flujo de Recuperación & Enlaces Opacos</h2>
          <p className="text-slate-300">Cada trigger genera un token opaco `mktrec_...` con expiración de 72h, sin exponer email/PII en URL ni reabrir carritos ya convertidos.</p>
          <p className="text-slate-400">Triggers recuperados: {kpis.abandoned_recovered ?? 0} · Suprimidos: {kpis.abandoned_suppressed ?? 0}</p>
        </div>
      )}

      {activeTab === "consent" && (
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-xs">
          <h2 className="text-sm font-semibold text-white">Consentimiento Comercial & Outbox QA</h2>
          <form onSubmit={handleRecordConsent} className="flex flex-wrap gap-2">
            <input required type="email" placeholder="cliente@dominio.cl" value={consentForm.email} onChange={(e) => setConsentForm({ ...consentForm, email: e.target.value })} className="flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs" />
            <label className="flex items-center gap-2 rounded border border-slate-800 bg-slate-950 px-3 py-2">
              <input type="checkbox" checked={consentForm.promotional_opt_in} onChange={(e) => setConsentForm({ ...consentForm, promotional_opt_in: e.target.checked })} />
              Opt-in promocional
            </label>
            <button type="submit" className="rounded bg-amber-500 px-3 py-2 font-bold text-slate-950">Registrar</button>
          </form>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-1">
              <p className="font-semibold text-amber-300">Consentimientos ({consents.length})</p>
              {consents.map((c) => (
                <p key={c.id} className="text-slate-300">{c.email} · opt_in={String(c.promotional_opt_in)} ({c.consent_source})</p>
              ))}
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-1">
              <p className="font-semibold text-indigo-300">Outbox QA ({outbox.length})</p>
              {outbox.map((m) => (
                <p key={m.id} className="text-slate-300">{m.recipient_email} · {m.status} · {m.channel_class}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "loyalty-rewards" && (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-2 text-xs">
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <h3 className="font-semibold text-amber-300">Loyalty (Puntos CLP)</h3>
            <p className="mt-1 text-slate-300">Cuentas: {dashboard?.loyalty_summary?.accounts_count ?? 0}</p>
            <p className="text-slate-300">Saldo total puntos: {dashboard?.loyalty_summary?.total_points_balance ?? 0}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <h3 className="font-semibold text-emerald-300">Rewards (Sorteos & Stickers)</h3>
            <p className="mt-1 text-slate-300">Campañas: {dashboard?.rewards_summary?.campaigns_count ?? 0} (activas: {dashboard?.rewards_summary?.active_campaigns ?? 0})</p>
            <p className="text-slate-300">Stickers: {dashboard?.rewards_summary?.stickers_count ?? 0} · Ganadores: {dashboard?.rewards_summary?.winners_count ?? 0}</p>
          </div>
        </div>
      )}
    </div>
  )
}
