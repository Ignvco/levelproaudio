// pages/admin/AdminLoyalty.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getLoyaltySummary, getLoyaltyConfig,
  updateLoyaltyConfig, adjustLoyaltyPoints,
} from "../../api/admin.api"
import { Users, Star, Sparkles, Gift, Medal, Award, Gem } from "lucide-react"
import { StatCard, AdminPageHeader, SectionCard, PrimaryButton, SecondaryButton, FormModal, FormField, formInputStyle } from "../../components/admin/ui"

const TABS   = ["Resumen","Top clientes","Configuración"]
const NIVELES = {
  bronze:   { label:"Bronce",  Icon: Medal, color:"#b45309" },
  silver:   { label:"Plata",   Icon: Medal, color:"#6b7280" },
  gold:     { label:"Oro",     Icon: Award, color:"#ca8a04" },
  platinum: { label:"Platino", Icon: Gem,   color:"#0891b2" },
}

const inputSt = {
  width:"100%", padding:"10px 14px",
  background:"var(--surface-2)", border:"1px solid var(--border)",
  borderRadius:"var(--r-md)", color:"var(--text)", fontSize:"13px", outline:"none",
}

function AdjustModal({ account, onClose }) {
  const [form, setForm]     = useState({ points:"", reason:"" })
  const [error, setError]   = useState("")
  const queryClient         = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => adjustLoyaltyPoints({
      user_id: account.user_id,
      points:  parseInt(form.points),
      reason:  form.reason,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(["admin-loyalty-summary"])
      onClose()
    },
    onError: (e) => setError(e?.response?.data?.detail || "Error al ajustar."),
  })

  return (
    <FormModal
      open
      title="Ajustar puntos"
      onClose={onClose}
      onSave={() => mutation.mutate()}
      saving={mutation.isPending}
      saveLabel="Aplicar"
      error={error}
      maxWidth="380px"
      testId="adjust-loyalty-modal"
    >
      <p style={{ fontSize:"12px", color:"var(--text-3)", marginTop:"-8px" }}>
        {account.user_email}
      </p>
      <FormField label="Puntos (positivo = agregar, negativo = quitar)">
        <input type="number" value={form.points}
          onChange={e => setForm(p => ({ ...p, points:e.target.value }))}
          style={formInputStyle} placeholder="Ej: 500 o -200" />
      </FormField>
      <FormField label="Razón">
        <input value={form.reason}
          onChange={e => setForm(p => ({ ...p, reason:e.target.value }))}
          style={formInputStyle} placeholder="Ej: Ajuste manual, compensación..." />
      </FormField>
      <div style={{ padding:"12px 14px", borderRadius:"var(--r-lg)",
        background:"var(--surface-2)", border:"1px solid var(--border)", fontSize:"13px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
          <span style={{ color:"var(--text-3)" }}>Puntos actuales</span>
          <span style={{ fontWeight:600 }}>
            {account.puntos_disponibles?.toLocaleString("es-CL")}
          </span>
        </div>
        {form.points && !isNaN(form.points) && (
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <span style={{ color:"var(--text-3)" }}>Después del ajuste</span>
            <span style={{ fontWeight:600,
              color: parseInt(form.points) >= 0 ? "var(--accent-text)" : "#EF4444" }}>
              {(account.puntos_disponibles + parseInt(form.points)).toLocaleString("es-CL")}
            </span>
          </div>
        )}
      </div>
    </FormModal>
  )
}

export default function AdminLoyalty() {
  const [tab, setTab]     = useState(0)
  const [modal, setModal] = useState(null)
  const queryClient       = useQueryClient()

  const { data:summary, isLoading } = useQuery({
    queryKey:["admin-loyalty-summary"], queryFn:getLoyaltySummary,
  })
  const { data:config } = useQuery({
    queryKey:["admin-loyalty-config"], queryFn:getLoyaltyConfig,
    enabled: tab===2,
  })

  const [cfgForm, setCfgForm]     = useState(null)
  const [savingCfg, setSavingCfg] = useState(false)
  const [cfgOk, setCfgOk]         = useState(false)

  const saveConfig = async () => {
    if (!cfgForm) return
    setSavingCfg(true)
    try {
      await updateLoyaltyConfig(cfgForm)
      queryClient.invalidateQueries(["admin-loyalty-config"])
      setCfgOk(true); setTimeout(() => setCfgOk(false), 3000)
    } finally { setSavingCfg(false) }
  }

  const accounts = summary?.accounts || []
  const kpis     = summary?.kpis     || {}

  return (
    <div className="au-page">

      {modal && <AdjustModal account={modal} onClose={() => setModal(null)} />}

      <AdminPageHeader
        eyebrow="LEVELPRO / FIDELIZACIÓN"
        title="Fidelización"
        description="Sistema de puntos, niveles VIP y beneficios acumulables para clientes"
      />

      {/* Tabs */}
      <div className="lp-seg-tabs">
        {TABS.map((t, i) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(i)}
            className={`lp-seg-tab${tab === i ? " is-active" : ""}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── RESUMEN ── */}
      {tab===0 && (
        isLoading ? (
          <div className="lp-grid-kpi">
            {[...Array(4)].map((_,i) => <div key={i} className="skeleton" style={{ height:"130px", borderRadius: "20px" }} />)}
          </div>
        ) : (
          <>
            <div className="lp-grid-kpi">
              <StatCard variant="ink" Icon={Users} label="Clientes activos" value={kpis.total_accounts || 0} sub="Con cuenta de puntos" />
              <StatCard variant="light" Icon={Star} label="Puntos emitidos" value={(kpis.total_points_issued || 0).toLocaleString("es-CL")} sub="Histórico acumulado" />
              <StatCard variant="primary" Icon={Sparkles} label="Puntos activos" value={(kpis.total_points_available || 0).toLocaleString("es-CL")} sub="Disponibles para canje" />
              <StatCard variant="light" Icon={Gift} label="Puntos canjeados" value={(kpis.total_points_redeemed || 0).toLocaleString("es-CL")} sub="Utilizados en compras" />
            </div>

            {kpis.by_nivel && (
              <SectionCard eyebrow="ESTRUCTURA VIP" title="Distribución por nivel">
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(170px, 1fr))", gap:"12px" }}>
                  {Object.entries(NIVELES).map(([key, { label, Icon, color }]) => {
                    const count = kpis.by_nivel[key] || 0
                    const total = kpis.total_accounts || 1
                    return (
                      <div key={key} style={{ textAlign:"center", padding:"18px 14px",
                        borderRadius:"16px", border:"1px solid var(--admin-border)",
                        background:"var(--admin-surface-soft)" }}>
                        <span style={{ display:"inline-flex", marginBottom:"10px" }}>
                          {Icon && <Icon size={28} color={color} strokeWidth={2} />}
                        </span>
                        <p style={{ fontFamily:"var(--font-display)", fontSize:"1.8rem", fontWeight: 800,
                          color, lineHeight:1, marginBottom:"4px" }}>{count}</p>
                        <p style={{ fontSize:"12.5px", fontWeight: 700, color:"var(--admin-text)" }}>{label}</p>
                        <p style={{ fontSize:"11px", color:"var(--admin-text-muted)", marginTop:"4px", fontFamily: "var(--font-mono)" }}>
                          {Math.round((count/total)*100)}%
                        </p>
                      </div>
                    )
                  })}
                </div>
              </SectionCard>
            )}
          </>
        )
      )}

      {/* ── TOP CLIENTES ── */}
      {tab===1 && (
        isLoading ? (
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            {[...Array(5)].map((_,i) => <div key={i} className="skeleton" style={{ height:"64px", borderRadius: "14px" }} />)}
          </div>
        ) : accounts.length===0 ? (
          <div className="au-card au-panel" style={{ padding:"56px", textAlign:"center", color:"var(--admin-text-secondary)" }}>
            <p style={{ fontSize:"38px", marginBottom:"10px" }}>⭐</p>
            <p style={{ fontSize:"14px", fontWeight: 600 }}>Sin cuentas de fidelización todavía.</p>
          </div>
        ) : (
          <div className="au-card au-table-wrap">
            <div className="au-tscroll">
              <table className="au-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Nivel</th>
                    <th style={{ textAlign: "right" }}>Disponibles</th>
                    <th style={{ textAlign: "right" }}>Ganados</th>
                    <th style={{ textAlign: "right" }}>Canjeados</th>
                    <th style={{ textAlign: "right" }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acc) => {
                    const nivel = NIVELES[acc.nivel] || { label:acc.nivel, Icon: Star, color:"#888" }
                    const NivelIcon = nivel.Icon
                    return (
                      <tr key={acc.id}>
                        <td>
                          <p style={{ fontSize:"13px", fontWeight:700, color:"var(--admin-text)" }}>{acc.user_email}</p>
                          <p style={{ fontSize:"11px", color:"var(--admin-text-muted)", fontFamily: "var(--font-mono)" }}>
                            Valor: ${(acc.valor_disponible||0).toLocaleString("es-CL")}
                          </p>
                        </td>
                        <td>
                          <span style={{ display:"inline-flex", alignItems:"center", gap:"6px",
                            fontSize:"12.5px", fontWeight:700, color:nivel.color }}>
                            {NivelIcon && <NivelIcon size={15} strokeWidth={2.2} />} {nivel.label}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontSize:"14px", fontWeight:800, color:"var(--admin-primary-text)", fontFamily: "var(--font-mono)" }}>
                          {(acc.puntos_disponibles||0).toLocaleString("es-CL")}
                        </td>
                        <td style={{ textAlign: "right", fontSize:"13px", color:"var(--admin-text-secondary)", fontFamily: "var(--font-mono)" }}>
                          {(acc.total_ganados||0).toLocaleString("es-CL")}
                        </td>
                        <td style={{ textAlign: "right", fontSize:"13px", color:"var(--admin-text-secondary)", fontFamily: "var(--font-mono)" }}>
                          {(acc.total_canjeados||0).toLocaleString("es-CL")}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <SecondaryButton size="sm" onClick={() => setModal(acc)}>
                            Ajustar
                          </SecondaryButton>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── CONFIGURACIÓN ── */}
      {tab===2 && (
        !config ? (
          <div style={{ display:"flex", flexDirection:"column", gap:"12px", maxWidth:"560px" }}>
            {[...Array(3)].map((_,i) => <div key={i} className="skeleton" style={{ height:"60px", borderRadius: "14px" }} />)}
          </div>
        ) : (
          <div style={{ maxWidth:"560px" }}>
            <SectionCard eyebrow="REGLAS DE CONVERSIÓN" title="Parámetros del programa">
              <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
                {cfgOk && (
                  <div className="lp-callout lp-callout--success">
                    ✓ Configuración guardada correctamente
                  </div>
                )}
                {[
                  { key:"puntos_por_peso",  label:"Puntos por cada $1 gastado",           hint:"Ej: 0.01 = 1 punto por cada $100", step:"0.001" },
                  { key:"peso_por_punto",   label:"Valor de cada punto en $",              hint:"Ej: 1 = cada punto vale $1 de descuento", step:"0.01" },
                  { key:"minimo_canje",     label:"Mínimo de puntos para canjear",         hint:"Ej: 500 = no se puede canjear menos" },
                  { key:"expiracion_dias",  label:"Días para vencimiento (0 = no vencen)" },
                ].map(({ key, label, hint, step }) => (
                  <div key={key}>
                    <label style={{ display:"block", fontSize:"12px", fontWeight:700,
                      color:"var(--admin-text-secondary)", marginBottom:"7px" }}>{label}</label>
                    <input type="number" step={step || "1"} defaultValue={config[key]}
                      onChange={e => setCfgForm(p => ({
                        ...(p||config), [key]: parseFloat(e.target.value)
                      }))}
                      style={inputSt} />
                    {hint && <p style={{ fontSize:"11px", color:"var(--admin-text-muted)", marginTop:"4px" }}>{hint}</p>}
                  </div>
                ))}
                <PrimaryButton
                  onClick={saveConfig}
                  disabled={savingCfg || !cfgForm}
                  loading={savingCfg}
                  style={{ width: "100%" }}
                >
                  {savingCfg ? "Guardando..." : "Guardar configuración"}
                </PrimaryButton>
              </div>
            </SectionCard>
          </div>
        )
      )}
    </div>
  )
}
