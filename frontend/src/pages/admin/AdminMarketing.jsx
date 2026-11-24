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
import {
  AdminPageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  PrimaryButton,
  SecondaryButton,
  FormField,
  formInputStyle,
} from "../../components/admin/ui"

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

const CURRENCY_TONE = {
  CLP: "info",
  USD: "success",
  ARS: "accent",
}

const subCardStyle = {
  background: "rgba(255,255,255,0.025)",
  border: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
  borderRadius: 12,
  padding: 16,
}

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
    <div className="au-stack">
      <AdminPageHeader
        eyebrow="Gate 11 · Marketing & Customer Growth"
        title="Promociones, Cupones & Recuperación de Carritos"
        description="Motor comercial multi-moneda con protección de margen real, reglas explícitas de acumulación y consentimiento verificable."
        actions={
          <>
            <SecondaryButton onClick={handleSchedulerTick}>
              Ejecutar Tick Scheduler
            </SecondaryButton>
            <PrimaryButton onClick={loadAll} disabled={loading}>
              {loading ? "Actualizando..." : "Refrescar"}
            </PrimaryButton>
          </>
        }
      />

      {feedback && (
        <div
          role="status"
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            background: "rgba(34, 197, 94, 0.12)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            color: "#4ade80",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {feedback}
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#f87171",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      <nav aria-label="Secciones de Marketing" role="tablist" className="au-tabs" style={{ flexWrap: "wrap" }}>
        {TABS.map((t) => {
          const isSelected = activeTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setActiveTab(t.id)}
              className={`au-tab${isSelected ? " is-active" : ""}`}
            >
              {t.label}
            </button>
          )
        })}
      </nav>

      {currentTabMeta?.kind === "referencia" && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(59, 130, 246, 0.1)",
            border: "1px solid rgba(59, 130, 246, 0.25)",
            color: "#60a5fa",
            fontSize: 12,
          }}
        >
          Vista informativa de políticas y estado sincronizado (solo lectura).
        </div>
      )}

      {activeTab === "dashboard" && (
        <div className="au-stack">
          <div className="au-grid-kpi">
            <StatCard label="Cupones activos" value={kpis.active_coupons ?? 0} tone="accent" />
            <StatCard label="Promociones activas" value={kpis.active_promotions ?? 0} tone="success" />
            <StatCard label="Promociones programadas" value={kpis.scheduled_promotions ?? 0} tone="info" />
            <StatCard label="Carritos elegibles" value={kpis.abandoned_eligible ?? 0} tone="warning" />
            <StatCard label="Carritos recuperados" value={kpis.abandoned_recovered ?? 0} tone="success" />
            <StatCard label="Carritos suprimidos" value={kpis.abandoned_suppressed ?? 0} />
            <StatCard label="Mensajes QA Outbox" value={kpis.outbox_messages ?? 0} tone="info" />
            <StatCard label="Contactos Opt-in" value={kpis.consented_contacts ?? 0} tone="accent" />
          </div>

          <SectionCard
            title="Redenciones por moneda (sin mezclar monedas)"
            subtitle="Consolidación estrictamente aislada por divisa transaccional original (CLP, USD, ARS)."
          >
            <div className="au-grid-3">
              {(dashboard?.redemptions_by_currency || []).map((r) => (
                <div key={r.currency} style={subCardStyle}>
                  <StatusBadge tone={CURRENCY_TONE[r.currency] || "neutral"}>{r.currency}</StatusBadge>
                  <p style={{ marginTop: 10, marginBottom: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                    Usos: <strong style={{ color: "var(--text-primary)" }}>{r.count}</strong> · Descuento:{" "}
                    <strong style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                      {r.total_discount}
                    </strong>
                  </p>
                </div>
              ))}
              {(!dashboard?.redemptions_by_currency || dashboard.redemptions_by_currency.length === 0) && (
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                  Sin redenciones registradas aún.
                </p>
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "coupons" && (
        <SectionCard title={`Listado de Cupones (${coupons.length})`}>
          {coupons.length === 0 ? (
            <p style={{ padding: "24px 0", textAlign: "center", fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              No hay cupones registrados.
            </p>
          ) : (
            <div className="au-table-wrap">
              <table className="au-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Moneda</th>
                    <th>Descuento</th>
                    <th>Usos</th>
                    <th>Acumulación</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "#1AFF6E" }}>{c.code}</td>
                      <td>
                        <StatusBadge tone={CURRENCY_TONE[c.currency] || "neutral"}>{c.currency}</StatusBadge>
                      </td>
                      <td>
                        {c.discount_value} ({c.discount_type})
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)" }}>
                        {c.used_count} / {c.max_total_uses ?? "∞"}
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>{c.accumulation_rule}</td>
                      <td>
                        <StatusBadge tone={c.status === "active" ? "success" : "warning"}>{c.status}</StatusBadge>
                      </td>
                      <td>
                        <SecondaryButton
                          size="sm"
                          onClick={() =>
                            updateMarketingCoupon(c.id, {
                              status: c.status === "active" ? "paused" : "active",
                            }).then(loadAll)
                          }
                        >
                          {c.status === "active" ? "Pausar" : "Activar"}
                        </SecondaryButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {activeTab === "coupon-builder" && (
        <SectionCard title="Crear Cupón Multi-Moneda" subtitle="Define reglas de descuento, moneda aislada y protección de margen mínimo.">
          <form onSubmit={handleCreateCoupon} className="au-stack">
            <div className="au-grid-3">
              <FormField label="Código">
                <input
                  required
                  placeholder="Código (ej. STUDIO10)"
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })}
                  style={formInputStyle}
                />
              </FormField>
              <FormField label="Nombre comercial">
                <input
                  required
                  placeholder="Nombre comercial"
                  value={couponForm.name}
                  onChange={(e) => setCouponForm({ ...couponForm, name: e.target.value })}
                  style={formInputStyle}
                />
              </FormField>
              <FormField label="Moneda (aislada)">
                <select
                  value={couponForm.currency}
                  onChange={(e) => setCouponForm({ ...couponForm, currency: e.target.value })}
                  style={formInputStyle}
                >
                  <option value="CLP">CLP</option>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
              </FormField>
              <FormField label="Tipo de descuento">
                <select
                  value={couponForm.discount_type}
                  onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })}
                  style={formInputStyle}
                >
                  <option value="percentage">Porcentaje (%)</option>
                  <option value="fixed_amount">Importe fijo</option>
                </select>
              </FormField>
              <FormField label="Valor del descuento">
                <input
                  required
                  type="number"
                  step="0.01"
                  placeholder="Valor descuento"
                  value={couponForm.discount_value}
                  onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })}
                  style={formInputStyle}
                />
              </FormField>
              <FormField label="Margen mínimo requerido (%)">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Margen mínimo %"
                  value={couponForm.min_margin_percent}
                  onChange={(e) => setCouponForm({ ...couponForm, min_margin_percent: e.target.value })}
                  style={formInputStyle}
                />
              </FormField>
            </div>
            <div>
              <PrimaryButton type="submit">Guardar Cupón</PrimaryButton>
            </div>
          </form>
        </SectionCard>
      )}

      {activeTab === "eligibility" && (
        <SectionCard
          title="Reglas de Elegibilidad & Margen Mínimo"
          subtitle="Los cupones validan moneda exacta (CLP, USD, ARS), monto mínimo elegible y protección de margen contra WeightedAverageCostState / CostLayer (Gate 6)."
        >
          <div className="au-grid-2">
            {coupons.map((c) => (
              <div key={c.id} style={subCardStyle}>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "#1AFF6E" }}>{c.code}</span> · Min:{" "}
                {c.min_eligible_amount} {c.currency} · Margen min: {c.min_margin_percent ?? "N/A"}%
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {activeTab === "accumulation" && (
        <SectionCard title="Política de Acumulación & Precedencia Comercial">
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            <li>Precios B2B contractuales tienen precedencia y bloquean cupones/promociones promocionales por defecto.</li>
            <li>Cupones y promociones no se acumulan salvo regla explícita bilateral (`allow_with_promotion`).</li>
            <li>Canje Loyalty solo es acumulable si el cupón declara `allow_with_loyalty` y moneda `CLP`.</li>
            <li>Sorteos / Stickers (`rewards`) permanecen estrictamente separados sin otorgar descuentos monetarios cruzados.</li>
          </ul>
        </SectionCard>
      )}

      {activeTab === "calendar" && (
        <SectionCard title={`Calendario de Promociones Programadas (${promotions.length})`}>
          {promotions.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Sin campañas programadas.</p>
          ) : (
            <div className="au-stack-sm">
              {promotions.map((p) => (
                <div
                  key={p.id}
                  style={{
                    ...subCardStyle,
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
                      {p.name} ({p.currency})
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                      Ventana: {p.starts_at} → {p.ends_at} · TZ: {p.business_timezone}
                    </p>
                  </div>
                  <StatusBadge tone="accent">
                    {p.status} · P{p.priority}
                  </StatusBadge>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {activeTab === "campaigns" && (
        <div className="au-stack">
          <SectionCard title="Nueva Campaña Promocional Programada">
            <form onSubmit={handleCreatePromo} className="au-stack">
              <div className="au-grid-3">
                <FormField label="Nombre campaña">
                  <input
                    required
                    placeholder="Nombre campaña"
                    value={promoForm.name}
                    onChange={(e) => setPromoForm({ ...promoForm, name: e.target.value })}
                    style={formInputStyle}
                  />
                </FormField>
                <FormField label="Moneda">
                  <select
                    value={promoForm.currency}
                    onChange={(e) => setPromoForm({ ...promoForm, currency: e.target.value })}
                    style={formInputStyle}
                  >
                    <option value="CLP">CLP</option>
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                  </select>
                </FormField>
                <FormField label="Descuento (%)">
                  <input
                    required
                    type="number"
                    step="0.01"
                    placeholder="Valor %"
                    value={promoForm.discount_value}
                    onChange={(e) => setPromoForm({ ...promoForm, discount_value: e.target.value })}
                    style={formInputStyle}
                  />
                </FormField>
              </div>
              <div>
                <PrimaryButton type="submit">Programar Campaña</PrimaryButton>
              </div>
            </form>
          </SectionCard>

          <SectionCard title="Campañas Registradas">
            <div className="au-stack-sm">
              {promotions.map((p) => (
                <div
                  key={p.id}
                  style={{
                    ...subCardStyle,
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
                    {p.name} · {p.discount_value} ({p.currency}) ·{" "}
                    <strong style={{ color: "#1AFF6E" }}>{p.status}</strong>
                  </span>
                  <SecondaryButton
                    size="sm"
                    onClick={() =>
                      updateMarketingPromotion(p.id, {
                        status: p.status === "paused" ? "active" : "paused",
                      }).then(loadAll)
                    }
                  >
                    {p.status === "paused" ? "Reanudar" : "Pausar"}
                  </SecondaryButton>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "preview" && (
        <SectionCard title="Previsualización de Descuento y Margen (PricingAdjustmentSnapshot)">
          <div className="au-stack">
            <form onSubmit={handlePreviewPricing} className="au-grid-3">
              <FormField label="Moneda">
                <select
                  value={previewForm.currency}
                  onChange={(e) => setPreviewForm({ ...previewForm, currency: e.target.value })}
                  style={formInputStyle}
                >
                  <option value="CLP">CLP</option>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
              </FormField>
              <FormField label="Subtotal">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Subtotal"
                  value={previewForm.subtotal}
                  onChange={(e) => setPreviewForm({ ...previewForm, subtotal: e.target.value })}
                  style={formInputStyle}
                />
              </FormField>
              <FormField label="Código de cupón">
                <input
                  placeholder="Código cupón"
                  value={previewForm.coupon_code}
                  onChange={(e) => setPreviewForm({ ...previewForm, coupon_code: e.target.value })}
                  style={formInputStyle}
                />
              </FormField>
              <div style={{ gridColumn: "1 / -1" }}>
                <PrimaryButton type="submit">Simular Cálculo Comercial</PrimaryButton>
              </div>
            </form>

            {previewResult &&
              (previewResult.valid === false ? (
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: 10,
                    background: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#f87171",
                    fontSize: 13,
                  }}
                >
                  {previewResult.detail}
                </div>
              ) : (
                <div data-testid="pricing-breakdown" className="au-grid-kpi" style={subCardStyle}>
                  <div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Moneda</span>
                    <p style={{ margin: "4px 0 0", fontWeight: 700 }}>{previewResult.currency}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Subtotal Ref.</span>
                    <p style={{ margin: "4px 0 0", fontWeight: 700 }}>{previewResult.reference_subtotal}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Desc. Promoción</span>
                    <p style={{ margin: "4px 0 0", fontWeight: 700, color: "#4ade80" }}>{previewResult.promotion_discount}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Desc. Cupón</span>
                    <p
                      data-testid="preview-coupon-discount"
                      style={{ margin: "4px 0 0", fontWeight: 700, color: "#4ade80" }}
                    >
                      {previewResult.coupon_discount}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Desc. Efectivo</span>
                    <p style={{ margin: "4px 0 0", fontWeight: 700, color: "#fbbf24" }}>{previewResult.effective_discount}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Total Final</span>
                    <p style={{ margin: "4px 0 0", fontWeight: 800 }}>{previewResult.final_total}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Margen (%)</span>
                    <p style={{ margin: "4px 0 0", fontWeight: 700, color: "#60a5fa" }}>
                      {previewResult.calculated_margin_percent ?? "Restringido / N/A"}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Estado Costo</span>
                    <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{previewResult.cost_status}</p>
                  </div>
                </div>
              ))}
          </div>
        </SectionCard>
      )}

      {activeTab === "abandoned" && (
        <SectionCard
          title={`Carritos Abandonados Detectados (${abandoned.length})`}
          actions={
            <PrimaryButton size="sm" onClick={handleDetectAbandoned}>
              Detectar Inactivos (60m)
            </PrimaryButton>
          }
        >
          {abandoned.length === 0 ? (
            <p style={{ padding: "16px 0", textAlign: "center", fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              No hay carritos abandonados detectados.
            </p>
          ) : (
            <div className="au-stack-sm">
              {abandoned.map((t) => {
                const isBlocked = t.status === "recovered" || t.status === "suppressed"
                return (
                  <div
                    key={t.id}
                    style={{
                      ...subCardStyle,
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>
                        Trigger #{String(t.id).slice(0, 8)} · Cart #{String(t.cart_id).slice(0, 8)} (
                        {t.user_email || "anónimo"})
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                        Estado: <strong>{t.status}</strong> · Intentos: {t.attempts_count}/{t.max_attempts}
                        {t.suppression_reason ? ` · Motivo: ${t.suppression_reason}` : ""}
                      </p>
                    </div>
                    {isBlocked ? (
                      <StatusBadge tone="neutral">
                        {t.status === "recovered" ? "Recuperado (bloqueado)" : "Suprimido (bloqueado)"}
                      </StatusBadge>
                    ) : (
                      <SecondaryButton size="sm" onClick={() => handleDispatchRecovery(t.id)}>
                        Preparar Recuperación QA
                      </SecondaryButton>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      )}

      {activeTab === "recovery" && (
        <SectionCard title="Flujo de Recuperación & Enlaces Opacos">
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 8px", lineHeight: 1.6 }}>
            Cada trigger genera un token opaco `mktrec_...` con expiración de 72h, verificación de pertenencia de
            usuario, revalidación de stock/precio y bloqueo automático tras conversión.
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            Triggers recuperados: {kpis.abandoned_recovered ?? 0} · Suprimidos: {kpis.abandoned_suppressed ?? 0}
          </p>
        </SectionCard>
      )}

      {activeTab === "consent" && (
        <SectionCard title="Consentimiento Comercial Documentado & Outbox QA">
          <div className="au-stack">
            <form onSubmit={handleRecordConsent} className="au-grid-2">
              <FormField label="Email del contacto">
                <input
                  required
                  type="email"
                  placeholder="cliente@dominio.cl"
                  value={consentForm.email}
                  onChange={(e) => setConsentForm({ ...consentForm, email: e.target.value })}
                  style={formInputStyle}
                />
              </FormField>
              <FormField label="Evidencia documental">
                <input
                  required={consentForm.promotional_opt_in}
                  placeholder="Evidencia (ej. TKT-2026-8841)"
                  value={consentForm.evidence_reference}
                  onChange={(e) => setConsentForm({ ...consentForm, evidence_reference: e.target.value })}
                  style={formInputStyle}
                />
              </FormField>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={consentForm.promotional_opt_in}
                    onChange={(e) => setConsentForm({ ...consentForm, promotional_opt_in: e.target.checked })}
                  />
                  Opt-in promocional
                </label>
                <PrimaryButton type="submit" size="sm">
                  Registrar
                </PrimaryButton>
              </div>
            </form>

            <div className="au-grid-2">
              <div style={subCardStyle}>
                <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 13, color: "#fbbf24" }}>
                  Consentimientos ({consents.length})
                </p>
                {consents.map((c) => (
                  <p key={c.id} style={{ margin: "4px 0", fontSize: 12, color: "var(--text-secondary)" }}>
                    {c.email} · opt_in={String(c.promotional_opt_in)} · {c.consent_origin} (
                    {c.evidence_reference || c.consent_source})
                  </p>
                ))}
              </div>
              <div style={subCardStyle}>
                <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 13, color: "#60a5fa" }}>
                  Outbox QA ({outbox.length})
                </p>
                {outbox.map((m) => (
                  <p key={m.id} style={{ margin: "4px 0", fontSize: 12, color: "var(--text-secondary)" }}>
                    {m.recipient_email} · {m.status} · {m.channel_class}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {activeTab === "loyalty-rewards" && (
        <SectionCard title="Integración Loyalty & Rewards">
          <div className="au-grid-2">
            <div style={subCardStyle}>
              <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "#fbbf24" }}>
                Loyalty (Puntos CLP)
              </h3>
              <p style={{ margin: "4px 0", fontSize: 13, color: "var(--text-secondary)" }}>
                Cuentas: {dashboard?.loyalty_summary?.accounts_count ?? 0}
              </p>
              <p style={{ margin: "4px 0", fontSize: 13, color: "var(--text-secondary)" }}>
                Saldo total puntos: {dashboard?.loyalty_summary?.total_points_balance ?? 0}
              </p>
            </div>
            <div style={subCardStyle}>
              <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "#1AFF6E" }}>
                Rewards (Sorteos & Stickers)
              </h3>
              <p style={{ margin: "4px 0", fontSize: 13, color: "var(--text-secondary)" }}>
                Campañas: {dashboard?.rewards_summary?.campaigns_count ?? 0} (activas:{" "}
                {dashboard?.rewards_summary?.active_campaigns ?? 0})
              </p>
              <p style={{ margin: "4px 0", fontSize: 13, color: "var(--text-secondary)" }}>
                Stickers: {dashboard?.rewards_summary?.stickers_count ?? 0} · Ganadores:{" "}
                {dashboard?.rewards_summary?.winners_count ?? 0}
              </p>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
