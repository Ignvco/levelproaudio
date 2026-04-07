// pages/admin/AdminLoyalty.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getLoyaltySummary, getLoyaltyConfig,
  updateLoyaltyConfig, adjustLoyaltyPoints,
} from "../../api/admin.api"

const TABS   = ["Resumen","Top clientes","Configuración"]
const NIVELES = {
  bronze:   { label:"Bronce",  icon:"🥉", color:"#cd7f32" },
  silver:   { label:"Plata",   icon:"🥈", color:"#c0c0c0" },
  gold:     { label:"Oro",     icon:"🥇", color:"#ffd700" },
  platinum: { label:"Platino", icon:"💎", color:"#a8c0d6" },
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
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)",
      backdropFilter:"blur(8px)", zIndex:200, display:"flex",
      alignItems:"center", justifyContent:"center", padding:"24px" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
        borderRadius:"var(--r-2xl)", width:"100%", maxWidth:"380px",
        animation:"scaleIn 200ms var(--ease)" }}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid var(--border)",
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <p style={{ fontSize:"15px", fontWeight:500 }}>Ajustar puntos</p>
            <p style={{ fontSize:"12px", color:"var(--text-3)", marginTop:"2px" }}>
              {account.user_email}
            </p>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none",
            cursor:"pointer", color:"var(--text-3)", fontSize:"22px" }}>×</button>
        </div>
        <div style={{ padding:"24px", display:"flex", flexDirection:"column", gap:"14px" }}>
          {error && (
            <div style={{ padding:"10px 14px", borderRadius:"var(--r-md)",
              background:"rgba(255,77,77,0.08)", border:"1px solid rgba(255,77,77,0.2)",
              color:"var(--danger)", fontSize:"13px" }}>{error}</div>
          )}
          <div>
            <label style={{ display:"block", fontSize:"12px", fontWeight:500,
              color:"var(--text-2)", marginBottom:"7px" }}>
              Puntos (positivo = agregar, negativo = quitar)
            </label>
            <input type="number" value={form.points}
              onChange={e => setForm(p => ({ ...p, points:e.target.value }))}
              style={inputSt} placeholder="Ej: 500 o -200"
              onFocus={e => e.target.style.borderColor="rgba(26,255,110,0.4)"}
              onBlur={e => e.target.style.borderColor="var(--border)"} />
          </div>
          <div>
            <label style={{ display:"block", fontSize:"12px", fontWeight:500,
              color:"var(--text-2)", marginBottom:"7px" }}>Razón</label>
            <input value={form.reason}
              onChange={e => setForm(p => ({ ...p, reason:e.target.value }))}
              style={inputSt} placeholder="Ej: Ajuste manual, compensación..."
              onFocus={e => e.target.style.borderColor="rgba(26,255,110,0.4)"}
              onBlur={e => e.target.style.borderColor="var(--border)"} />
          </div>
          {/* Preview */}
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
                  color: parseInt(form.points) >= 0 ? "var(--accent)" : "#f87171" }}>
                  {(account.puntos_disponibles + parseInt(form.points)).toLocaleString("es-CL")}
                </span>
              </div>
            )}
          </div>
        </div>
        <div style={{ padding:"16px 24px", borderTop:"1px solid var(--border)",
          display:"flex", gap:"10px", justifyContent:"flex-end" }}>
          <button onClick={onClose} className="btn btn-ghost"
            style={{ padding:"9px 18px", fontSize:"13px" }}>Cancelar</button>
          <button onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.points || !form.reason}
            className="btn btn-accent"
            style={{ padding:"9px 18px", fontSize:"13px",
              opacity: mutation.isPending ? 0.7 : 1 }}>
            {mutation.isPending ? "Ajustando..." : "Aplicar"}
          </button>
        </div>
      </div>
    </div>
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
    <div style={{ padding:"clamp(24px, 4vw, 40px)" }}>

      {modal && <AdjustModal account={modal} onClose={() => setModal(null)} />}

      <div style={{ marginBottom:"28px" }}>
        <h1 style={{ fontFamily:"var(--font-serif)", fontSize:"clamp(1.8rem, 3vw, 2.4rem)",
          fontWeight:300, letterSpacing:"-0.02em", marginBottom:"6px" }}>Fidelización</h1>
        <p style={{ fontSize:"13px", color:"var(--text-3)" }}>
          Sistema de puntos y niveles para clientes
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:"0", marginBottom:"28px", borderBottom:"1px solid var(--border)" }}>
        {TABS.map((t,i) => (
          <button key={t} type="button" onClick={() => setTab(i)} style={{
            padding:"9px 20px", fontSize:"13px", cursor:"pointer",
            background:"none", border:"none",
            borderBottom: tab===i ? "2px solid var(--accent)" : "2px solid transparent",
            color:        tab===i ? "var(--accent)"             : "var(--text-3)",
            fontWeight:   tab===i ? 500                         : 400,
            marginBottom:"-1px" }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── RESUMEN ── */}
      {tab===0 && (
        isLoading ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))", gap:"12px" }}>
            {[...Array(4)].map((_,i) => <div key={i} className="skeleton" style={{ height:"100px" }} />)}
          </div>
        ) : (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))",
              gap:"12px", marginBottom:"28px" }}>
              {[
                { label:"Clientes activos", value: kpis.total_accounts||0,                              icon:"👥" },
                { label:"Puntos emitidos",  value: (kpis.total_points_issued||0).toLocaleString("es-CL"),icon:"⭐" },
                { label:"Puntos activos",   value: (kpis.total_points_available||0).toLocaleString("es-CL"),icon:"✨", accent:true },
                { label:"Puntos canjeados", value: (kpis.total_points_redeemed||0).toLocaleString("es-CL"),icon:"🎁" },
              ].map(({ label, value, icon, accent }) => (
                <div key={label} style={{ background:"var(--surface)", border:"1px solid var(--border)",
                  borderRadius:"var(--r-xl)", padding:"18px 20px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"10px" }}>
                    <p style={{ fontSize:"11px", color:"var(--text-3)", fontWeight:500,
                      textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</p>
                    <span style={{ fontSize:"18px" }}>{icon}</span>
                  </div>
                  <p style={{ fontFamily:"var(--font-serif)", fontSize:"1.8rem",
                    color: accent ? "var(--accent)" : "var(--text)", lineHeight:1 }}>{value}</p>
                </div>
              ))}
            </div>

            {kpis.by_nivel && (
              <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
                borderRadius:"var(--r-xl)", padding:"20px 24px" }}>
                <p style={{ fontSize:"13px", fontWeight:500, marginBottom:"16px" }}>
                  Distribución por nivel
                </p>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"12px" }}>
                  {Object.entries(NIVELES).map(([key, { label, icon, color }]) => {
                    const count = kpis.by_nivel[key] || 0
                    const total = kpis.total_accounts || 1
                    return (
                      <div key={key} style={{ textAlign:"center", padding:"14px",
                        borderRadius:"var(--r-lg)", border:"1px solid var(--border)",
                        background:"var(--surface-2)" }}>
                        <span style={{ fontSize:"28px", display:"block", marginBottom:"8px" }}>{icon}</span>
                        <p style={{ fontFamily:"var(--font-serif)", fontSize:"1.6rem",
                          color, lineHeight:1, marginBottom:"4px" }}>{count}</p>
                        <p style={{ fontSize:"12px", color:"var(--text-3)" }}>{label}</p>
                        <p style={{ fontSize:"11px", color:"var(--text-3)", marginTop:"4px" }}>
                          {Math.round((count/total)*100)}%
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )
      )}

      {/* ── TOP CLIENTES ── */}
      {tab===1 && (
        isLoading ? (
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            {[...Array(5)].map((_,i) => <div key={i} className="skeleton" style={{ height:"64px" }} />)}
          </div>
        ) : accounts.length===0 ? (
          <div style={{ padding:"60px", textAlign:"center", background:"var(--surface)",
            border:"1px solid var(--border)", borderRadius:"var(--r-2xl)", color:"var(--text-3)" }}>
            <p style={{ fontSize:"40px", marginBottom:"12px" }}>⭐</p>
            <p style={{ fontSize:"14px" }}>Sin cuentas de fidelización todavía.</p>
          </div>
        ) : (
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
            borderRadius:"var(--r-xl)", overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 80px",
              padding:"10px 20px", borderBottom:"1px solid var(--border)",
              fontSize:"11px", color:"var(--text-3)", textTransform:"uppercase",
              letterSpacing:"0.06em", fontWeight:500 }}>
              <span>Cliente</span><span>Nivel</span>
              <span>Disponibles</span><span>Ganados</span><span>Canjeados</span><span />
            </div>

            {accounts.map((acc,i) => {
              const nivel = NIVELES[acc.nivel] || { label:acc.nivel, icon:"⭐", color:"#888" }
              return (
                <div key={acc.id} style={{ display:"grid",
                  gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 80px",
                  padding:"13px 20px", alignItems:"center",
                  borderTop: i>0 ? "1px solid var(--border)" : "none",
                  gap:"8px", transition:"background var(--dur) var(--ease)" }}
                  onMouseEnter={e => e.currentTarget.style.background="var(--surface-2)"}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  <div>
                    <p style={{ fontSize:"13px", fontWeight:500, overflow:"hidden",
                      textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{acc.user_email}</p>
                    <p style={{ fontSize:"11px", color:"var(--text-3)" }}>
                      Valor: ${(acc.valor_disponible||0).toLocaleString("es-CL")}
                    </p>
                  </div>
                  <span style={{ display:"flex", alignItems:"center", gap:"6px",
                    fontSize:"13px", fontWeight:500, color:nivel.color }}>
                    {nivel.icon} {nivel.label}
                  </span>
                  <span style={{ fontSize:"14px", fontWeight:600, color:"var(--accent)" }}>
                    {(acc.puntos_disponibles||0).toLocaleString("es-CL")}
                  </span>
                  <span style={{ fontSize:"13px", color:"var(--text-2)" }}>
                    {(acc.total_ganados||0).toLocaleString("es-CL")}
                  </span>
                  <span style={{ fontSize:"13px", color:"var(--text-2)" }}>
                    {(acc.total_canjeados||0).toLocaleString("es-CL")}
                  </span>
                  <button onClick={() => setModal(acc)} style={{
                    padding:"6px 12px", borderRadius:"var(--r-md)", fontSize:"12px",
                    cursor:"pointer", color:"#60a5fa",
                    background:"rgba(96,165,250,0.1)", border:"1px solid rgba(96,165,250,0.2)" }}>
                    Ajustar
                  </button>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ── CONFIGURACIÓN ── */}
      {tab===2 && (
        !config ? (
          <div style={{ display:"flex", flexDirection:"column", gap:"12px", maxWidth:"520px" }}>
            {[...Array(3)].map((_,i) => <div key={i} className="skeleton" style={{ height:"60px" }} />)}
          </div>
        ) : (
          <div style={{ maxWidth:"520px" }}>
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
              borderRadius:"var(--r-2xl)", overflow:"hidden" }}>
              <div style={{ padding:"16px 24px", borderBottom:"1px solid var(--border)",
                background:"var(--surface-2)" }}>
                <p style={{ fontSize:"14px", fontWeight:500 }}>Parámetros del programa</p>
              </div>
              <div style={{ padding:"24px", display:"flex", flexDirection:"column", gap:"16px" }}>
                {cfgOk && (
                  <div style={{ padding:"10px 14px", borderRadius:"var(--r-md)",
                    background:"rgba(26,255,110,0.08)", border:"1px solid rgba(26,255,110,0.2)",
                    color:"var(--accent)", fontSize:"13px" }}>
                    ✓ Configuración guardada correctamente
                  </div>
                )}
                {[
                  { key:"puntos_por_peso",      label:"Puntos por cada $1 gastado",           hint:"Ej: 0.01 = 1 punto por $100" },
                  { key:"valor_punto",          label:"Valor de cada punto en $",              hint:"Ej: 1 = $1 de descuento" },
                  { key:"umbral_silver",        label:"Puntos para nivel Plata" },
                  { key:"umbral_gold",          label:"Puntos para nivel Oro" },
                  { key:"umbral_platinum",      label:"Puntos para nivel Platino" },
                  { key:"puntos_expiran_dias",  label:"Días para vencimiento (0 = no vencen)" },
                ].map(({ key, label, hint }) => (
                  <div key={key}>
                    <label style={{ display:"block", fontSize:"12px", fontWeight:500,
                      color:"var(--text-2)", marginBottom:"7px" }}>{label}</label>
                    <input type="number" defaultValue={config[key]}
                      onChange={e => setCfgForm(p => ({
                        ...(p||config), [key]: parseFloat(e.target.value)
                      }))}
                      style={inputSt}
                      onFocus={e => e.target.style.borderColor="rgba(26,255,110,0.4)"}
                      onBlur={e => e.target.style.borderColor="var(--border)"} />
                    {hint && <p style={{ fontSize:"11px", color:"var(--text-3)", marginTop:"4px" }}>{hint}</p>}
                  </div>
                ))}
                <button onClick={saveConfig} disabled={savingCfg || !cfgForm}
                  className="btn btn-accent"
                  style={{ justifyContent:"center", marginTop:"4px",
                    opacity: (savingCfg||!cfgForm) ? 0.6 : 1 }}>
                  {savingCfg ? "Guardando..." : "Guardar configuración"}
                </button>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  )
}
