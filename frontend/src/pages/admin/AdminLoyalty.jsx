// pages/admin/AdminLoyalty.jsx

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getLoyaltySummary,
  getLoyaltyConfig,
  updateLoyaltyConfig,
  adjustLoyaltyPoints,
} from "../../api/admin.api"

const NIVEL_COLORS = {
  bronze:   { color: "#cd7f32", bg: "rgba(205,127,50,0.1)",  label: "Bronze"   },
  silver:   { color: "#9ca3af", bg: "rgba(156,163,175,0.1)", label: "Silver"   },
  gold:     { color: "#facc15", bg: "rgba(250,204,21,0.1)",  label: "Gold"     },
  platinum: { color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  label: "Platinum" },
}

const TABS = ["Resumen", "Top Clientes", "Configuración"]

function NivelBadge({ nivel }) {
  const n = NIVEL_COLORS[nivel] || NIVEL_COLORS.bronze
  return (
    <span style={{
      padding: "2px 10px", borderRadius: "100px", fontSize: "11px",
      fontWeight: 600, color: n.color, background: n.bg,
      border: `1px solid ${n.color}30`,
    }}>
      {n.label}
    </span>
  )
}

// ── Tab Resumen ───────────────────────────────────────────────
function TabResumen({ data }) {
  if (!data) return null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* KPIs */}
      <div style={{ display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "14px" }}>
        {[
          { label: "Cuentas activas",  value: data.total_cuentas, icon: "👥" },
          { label: "Puntos emitidos",  value: data.total_puntos?.toLocaleString("es-CL"), icon: "⭐" },
          { label: "Clientes Gold+",   value: (data.niveles?.gold || 0) + (data.niveles?.platinum || 0), icon: "🏆" },
        ].map(({ label, value, icon }) => (
          <div key={label} style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)", padding: "18px 20px",
          }}>
            <p style={{ fontSize: "12px", color: "var(--text-3)",
              textTransform: "uppercase", letterSpacing: "0.06em",
              marginBottom: "8px" }}>
              {icon} {label}
            </p>
            <p style={{ fontFamily: "var(--font-serif)",
              fontSize: "1.8rem", color: "var(--accent)" }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Distribución de niveles */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)", padding: "20px 24px",
      }}>
        <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "16px" }}>
          Distribución por nivel
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {Object.entries(NIVEL_COLORS).map(([nivel, cfg]) => {
            const count = data.niveles?.[nivel] || 0
            const pct   = data.total_cuentas > 0
              ? Math.round((count / data.total_cuentas) * 100) : 0
            return (
              <div key={nivel}>
                <div style={{ display: "flex", justifyContent: "space-between",
                  fontSize: "13px", marginBottom: "6px" }}>
                  <span style={{ color: cfg.color, fontWeight: 500 }}>
                    {cfg.label}
                  </span>
                  <span style={{ color: "var(--text-3)" }}>
                    {count} clientes ({pct}%)
                  </span>
                </div>
                <div style={{ height: "6px", borderRadius: "3px",
                  background: "var(--surface-3)", overflow: "hidden" }}>
                  <div style={{
                    width: `${pct}%`, height: "100%",
                    background: cfg.color, borderRadius: "3px",
                    transition: "width 0.5s ease",
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Tab Top Clientes ──────────────────────────────────────────
function TabTopClientes({ data }) {
  const queryClient = useQueryClient()
  const [adjusting, setAdjusting] = useState(null)
  const [pts, setPts]             = useState("")
  const [desc, setDesc]           = useState("")

  const adjustMutation = useMutation({
    mutationFn: (payload) => adjustLoyaltyPoints(payload),
    onSuccess: () => {
      queryClient.invalidateQueries(["loyalty-summary"])
      setAdjusting(null)
      setPts("")
      setDesc("")
    },
  })

  if (!data?.top_clientes?.length) return (
    <div style={{ padding: "48px", textAlign: "center",
      color: "var(--text-3)", fontSize: "14px" }}>
      No hay clientes con puntos todavía.
    </div>
  )

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-lg)", overflow: "hidden" }}>

      <div style={{
        display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 80px",
        padding: "10px 20px", borderBottom: "1px solid var(--border)",
        fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
        textTransform: "uppercase", letterSpacing: "0.08em",
      }}>
        <span>Cliente</span>
        <span>Nivel</span>
        <span>Disponibles</span>
        <span>Histórico</span>
        <span>Ajuste</span>
      </div>

      {data.top_clientes.map((c, i) => (
        <div key={c.email}>
          <div style={{
            display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 80px",
            padding: "13px 20px", alignItems: "center",
            borderTop: i > 0 ? "1px solid var(--border)" : "none",
          }}>
            <span style={{ fontSize: "13px", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.email}
            </span>
            <NivelBadge nivel={c.nivel} />
            <span style={{ fontSize: "13px", fontWeight: 600,
              color: "var(--accent)" }}>
              {c.puntos.toLocaleString("es-CL")} pts
            </span>
            <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
              {c.total.toLocaleString("es-CL")}
            </span>
            <button
              onClick={() => setAdjusting(adjusting === c.email ? null : c.email)}
              style={{
                padding: "5px 10px", borderRadius: "var(--r-sm)",
                fontSize: "11px", cursor: "pointer",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-2)",
              }}>
              Ajustar
            </button>
          </div>

          {/* Panel de ajuste inline */}
          {adjusting === c.email && (
            <div style={{
              padding: "14px 20px", background: "var(--surface-2)",
              borderTop: "1px solid var(--border)",
              display: "flex", gap: "10px", alignItems: "center",
              flexWrap: "wrap",
            }}>
              <input
                type="number"
                value={pts}
                onChange={e => setPts(e.target.value)}
                placeholder="Puntos (+/-)"
                style={{
                  padding: "8px 12px", borderRadius: "var(--r-sm)",
                  background: "var(--surface)", border: "1px solid var(--border)",
                  color: "var(--text)", fontSize: "13px", width: "140px",
                }}
              />
              <input
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="Descripción"
                style={{
                  padding: "8px 12px", borderRadius: "var(--r-sm)",
                  background: "var(--surface)", border: "1px solid var(--border)",
                  color: "var(--text)", fontSize: "13px", flex: 1,
                  minWidth: "200px",
                }}
              />
              <button
                onClick={() => adjustMutation.mutate({
                  user_id:     c.user_id || c.email,
                  puntos:      parseInt(pts),
                  descripcion: desc || "Ajuste manual admin",
                })}
                disabled={adjustMutation.isPending || !pts}
                style={{
                  padding: "8px 16px", borderRadius: "var(--r-sm)",
                  background: "var(--accent)", border: "none",
                  color: "#000", fontSize: "13px", fontWeight: 600,
                  cursor: "pointer",
                }}>
                {adjustMutation.isPending ? "..." : "Aplicar"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Tab Configuración ─────────────────────────────────────────
function TabConfig() {
  const queryClient = useQueryClient()

  const { data: config, isLoading } = useQuery({
    queryKey: ["loyalty-config"],
    queryFn:  getLoyaltyConfig,
  })

  const [form, setForm] = useState(null)

  const mutation = useMutation({
    mutationFn: (data) => updateLoyaltyConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["loyalty-config"])
    },
  })

  const current = form || config

  if (isLoading || !current) return (
    <div className="skeleton" style={{ height: "300px" }} />
  )

  const inputSt = {
    padding: "10px 14px", borderRadius: "var(--r-md)",
    background: "var(--surface-2)", border: "1px solid var(--border)",
    color: "var(--text)", fontSize: "13px", width: "100%",
  }

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-lg)", padding: "24px",
      display: "flex", flexDirection: "column", gap: "20px",
      maxWidth: "560px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "center" }}>
        <p style={{ fontSize: "14px", fontWeight: 600 }}>
          Reglas del programa
        </p>
        {/* Toggle activo */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
            {current.is_active ? "Activo" : "Inactivo"}
          </span>
          <div
            onClick={() => setForm(f => ({
              ...(f || config), is_active: !(f || config).is_active
            }))}
            style={{
              width: "40px", height: "22px", borderRadius: "11px",
              background: current.is_active ? "var(--accent)" : "var(--surface-3)",
              cursor: "pointer", position: "relative",
              transition: "background var(--dur) var(--ease)",
            }}>
            <div style={{
              position: "absolute", top: "3px",
              left: current.is_active ? "20px" : "3px",
              width: "16px", height: "16px", borderRadius: "50%",
              background: current.is_active ? "#000" : "var(--text-3)",
              transition: "left var(--dur) var(--ease)",
            }} />
          </div>
        </div>
      </div>

      {[
        {
          key: "puntos_por_peso",
          label: "Puntos por cada $1 gastado",
          sub: `Ej: 0.01 = 1 punto por $100. Actualmente: 1 punto por $${Math.round(1 / (current.puntos_por_peso || 0.01))}`,
          type: "number", step: "0.001",
        },
        {
          key: "peso_por_punto",
          label: "Valor en pesos de cada punto",
          sub: `Ej: 1.0 = 1 punto vale $1 al canjear`,
          type: "number", step: "0.1",
        },
        {
          key: "minimo_canje",
          label: "Mínimo de puntos para canjear",
          sub: `Actualmente: ${current.minimo_canje} puntos mínimos`,
          type: "number",
        },
        {
          key: "expiracion_dias",
          label: "Días hasta expiración",
          sub: "0 = nunca expiran",
          type: "number",
        },
      ].map(({ key, label, sub, type, step }) => (
        <div key={key}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
            color: "var(--text-2)", marginBottom: "6px" }}>
            {label}
          </label>
          <input
            type={type}
            step={step}
            value={(form || config)?.[key] ?? ""}
            onChange={e => setForm(f => ({
              ...(f || config), [key]: e.target.value
            }))}
            style={inputSt}
          />
          <p style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "4px" }}>
            {sub}
          </p>
        </div>
      ))}

      {/* Previsualización */}
      <div style={{
        padding: "14px 16px", borderRadius: "var(--r-md)",
        background: "rgba(26,255,110,0.05)",
        border: "1px solid rgba(26,255,110,0.15)",
        fontSize: "13px",
      }}>
        <p style={{ fontWeight: 600, marginBottom: "8px", color: "var(--accent)" }}>
          Vista previa
        </p>
        <p style={{ color: "var(--text-2)", lineHeight: 1.8 }}>
          Por una compra de <strong>$100.000</strong> →{" "}
          <strong style={{ color: "var(--accent)" }}>
            {Math.round(100000 * (current.puntos_por_peso || 0.01))} puntos
          </strong>
          <br />
          {current.minimo_canje} puntos mínimos = descuento de{" "}
          <strong style={{ color: "var(--accent)" }}>
            ${Math.round(current.minimo_canje * (current.peso_por_punto || 1)).toLocaleString("es-CL")}
          </strong>
        </p>
      </div>

      <button
        onClick={() => mutation.mutate(form || config)}
        disabled={mutation.isPending || !form}
        style={{
          padding: "12px", borderRadius: "var(--r-md)",
          background: form ? "var(--accent)" : "var(--surface-2)",
          border: "none", color: form ? "#000" : "var(--text-3)",
          fontSize: "13px", fontWeight: 600,
          cursor: form ? "pointer" : "default",
          transition: "all var(--dur) var(--ease)",
        }}>
        {mutation.isPending ? "Guardando..." : "Guardar configuración"}
      </button>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────
export default function AdminLoyalty() {
  const [tab, setTab] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ["loyalty-summary"],
    queryFn:  getLoyaltySummary,
  })

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>

      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)",
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px" }}>
          Fidelización
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
          Programa de puntos y niveles para clientes
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "24px",
        borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: "8px 16px", fontSize: "13px", cursor: "pointer",
            background: "none", border: "none",
            borderBottom: tab === i ? "2px solid var(--accent)" : "2px solid transparent",
            color: tab === i ? "var(--accent)" : "var(--text-3)",
            fontWeight: tab === i ? 500 : 400,
            marginBottom: "-1px",
            transition: "all var(--dur) var(--ease)",
          }}>
            {t}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "80px" }} />
          ))}
        </div>
      ) : (
        <>
          {tab === 0 && <TabResumen data={data} />}
          {tab === 1 && <TabTopClientes data={data} />}
          {tab === 2 && <TabConfig />}
        </>
      )}
    </div>
  )
}