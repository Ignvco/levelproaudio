// pages/admin/ExecutiveDashboard.jsx

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { getExecutiveDashboard } from "../../api/admin.api"

// ── Mini sparkline SVG ────────────────────────────────────────
function Sparkline({ data, color = "var(--accent)" }) {
  if (!data || data.length < 2) return null
  const values = data.map(d => d.total)
  const max    = Math.max(...values, 1)
  const min    = Math.min(...values, 0)
  const range  = max - min || 1
  const w = 120, h = 40, pad = 4

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${x},${y}`
  }).join(" ")

  const areaPoints = `${pad},${h - pad} ${points} ${w - pad},${h - pad}`

  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#sparkGrad)" />
      <polyline points={points} fill="none"
        stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      {/* Último punto resaltado */}
      <circle
        cx={pad + ((values.length - 1) / (values.length - 1)) * (w - pad * 2)}
        cy={h - pad - ((values[values.length - 1] - min) / range) * (h - pad * 2)}
        r="3" fill={color}
      />
    </svg>
  )
}

// ── Variación % ───────────────────────────────────────────────
function Variacion({ value }) {
  if (value === undefined || value === null) return null
  const positive = value >= 0
  return (
    <span style={{
      fontSize: "12px", fontWeight: 600, padding: "2px 7px",
      borderRadius: "100px",
      color:       positive ? "#4ade80" : "#f87171",
      background:  positive ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
    }}>
      {positive ? "↑" : "↓"} {Math.abs(value)}%
    </span>
  )
}

// ── KPI Card principal ────────────────────────────────────────
function KPIBig({ label, value, sub, variacion: v, sparkData, color = "var(--accent)", icon }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-xl)", padding: "22px 24px",
      display: "flex", flexDirection: "column", gap: "12px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start" }}>
        <div>
          <p style={{ fontSize: "12px", color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.06em",
            fontWeight: 500, marginBottom: "8px" }}>
            {icon} {label}
          </p>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: "2rem",
            lineHeight: 1, color, marginBottom: "6px" }}>
            {value}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {sub && <p style={{ fontSize: "12px", color: "var(--text-3)" }}>{sub}</p>}
            {v !== undefined && <Variacion value={v} />}
          </div>
        </div>
        {sparkData && (
          <div style={{ opacity: 0.8 }}>
            <Sparkline data={sparkData} color={color} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────
function StatusDot({ status }) {
  const map = {
    pending:   "#facc15",
    paid:      "#4ade80",
    shipped:   "#60a5fa",
    completed: "#4ade80",
    cancelled: "#f87171",
  }
  return (
    <span style={{
      display: "inline-block", width: "7px", height: "7px",
      borderRadius: "50%", background: map[status] || "#888",
      flexShrink: 0,
    }} />
  )
}

// ── Barra de ventas 7 días ────────────────────────────────────
function BarChart({ data }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map(d => d.total), 1)

  return (
    <div style={{ display: "flex", alignItems: "flex-end",
      gap: "6px", height: "80px", padding: "0 4px" }}>
      {data.map((d, i) => {
        const pct  = (d.total / max) * 100
        const isToday = i === data.length - 1
        return (
          <div key={i} style={{ flex: 1, display: "flex",
            flexDirection: "column", alignItems: "center", gap: "4px",
            height: "100%", justifyContent: "flex-end" }}>
            <div
              title={`${d.fecha}: $${Math.round(d.total).toLocaleString("es-CL")}`}
              style={{
                width: "100%", borderRadius: "3px 3px 0 0",
                height: `${Math.max(pct, 3)}%`,
                background: isToday ? "var(--accent)"
                  : d.total > 0 ? "rgba(26,255,110,0.3)"
                  : "var(--surface-3)",
                transition: "height 0.5s ease",
                cursor: "default",
              }}
            />
            <span style={{ fontSize: "10px", color: "var(--text-3)",
              whiteSpace: "nowrap" }}>
              {d.dia}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────
export default function ExecutiveDashboard() {
  const { data, isLoading, refetch } = useQuery({
    queryKey:      ["executive-dashboard"],
    queryFn:       getExecutiveDashboard,
    refetchInterval: 60000, // refresca cada minuto
  })

  if (isLoading) return (
    <div style={{ padding: "clamp(20px, 4vw, 36px)",
      display: "flex", flexDirection: "column", gap: "16px" }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="skeleton"
          style={{ height: i === 0 ? "60px" : "100px" }} />
      ))}
    </div>
  )

  const v = data?.ventas || {}

  return (
    <div style={{
      padding: "clamp(20px, 4vw, 36px)",
      display: "flex", flexDirection: "column", gap: "20px",
      maxWidth: "800px",
    }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.6rem, 3vw, 2rem)", marginBottom: "4px" }}>
            Vista ejecutiva
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
            {new Date().toLocaleDateString("es-CL", {
              weekday: "long", day: "numeric",
              month: "long", year: "numeric",
            })}
          </p>
        </div>
        <button onClick={() => refetch()} style={{
          background: "none", border: "1px solid var(--border)",
          borderRadius: "var(--r-md)", padding: "8px 14px",
          fontSize: "12px", color: "var(--text-3)", cursor: "pointer",
          transition: "all var(--dur) var(--ease)",
        }}>
          ↻ Actualizar
        </button>
      </div>

      {/* ── KPIs principales ── */}
      <div style={{ display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "14px" }}>

        <KPIBig
          icon="💰"
          label="Ventas hoy"
          value={`$${Math.round(v.hoy || 0).toLocaleString("es-CL")}`}
          sub={`${v.hoy_count || 0} orden${v.hoy_count !== 1 ? "es" : ""}`}
          variacion={v.var_dia}
          color="var(--accent)"
          sparkData={data?.ventas_7dias}
        />

        <KPIBig
          icon="📅"
          label="Ventas este mes"
          value={`$${Math.round(v.mes || 0).toLocaleString("es-CL")}`}
          sub="Últimos 30 días"
          variacion={v.var_mes}
          color="#60a5fa"
        />

        <KPIBig
          icon="💵"
          label="Utilidad neta mes"
          value={`$${Math.round(data?.utilidad_mes || 0).toLocaleString("es-CL")}`}
          sub="Después de costos"
          color="#4ade80"
        />
      </div>

      {/* ── Gráfico 7 días ── */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)", padding: "20px 24px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: "16px" }}>
          <p style={{ fontSize: "13px", fontWeight: 600 }}>
            Ventas últimos 7 días
          </p>
          <p style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 500 }}>
            ${ Math.round(v.semana || 0).toLocaleString("es-CL")}
          </p>
        </div>
        <BarChart data={data?.ventas_7dias} />
      </div>

      {/* ── Grid inferior ── */}
      <div style={{ display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "14px" }}>

        {/* Órdenes del día */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)", overflow: "hidden",
        }}>
          <div style={{ padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between",
            alignItems: "center" }}>
            <p style={{ fontSize: "13px", fontWeight: 600 }}>
              🛒 Órdenes de hoy
            </p>
            <Link to="/admin/orders"
              style={{ fontSize: "12px", color: "var(--text-3)" }}>
              Ver todas →
            </Link>
          </div>

          {!data?.ordenes_hoy?.length ? (
            <div style={{ padding: "32px", textAlign: "center",
              color: "var(--text-3)", fontSize: "13px" }}>
              Sin órdenes hoy todavía
            </div>
          ) : data.ordenes_hoy.map((o, i) => (
            <div key={o.id} style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", padding: "12px 20px",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              gap: "12px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <StatusDot status={o.status} />
                <div>
                  <p style={{ fontSize: "12px", fontFamily: "monospace",
                    color: "var(--text-2)" }}>
                    #{o.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p style={{ fontSize: "11px", color: "var(--text-3)" }}>
                    {o.email.split("@")[0]} · {o.hora}
                  </p>
                </div>
              </div>
              <span style={{ fontSize: "13px", fontWeight: 500,
                whiteSpace: "nowrap" }}>
                ${Math.round(o.total).toLocaleString("es-CL")}
              </span>
            </div>
          ))}
        </div>

        {/* Top productos + Alertas */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

          {/* Top 3 productos */}
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-xl)", overflow: "hidden",
          }}>
            <div style={{ padding: "16px 20px",
              borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontSize: "13px", fontWeight: 600 }}>
                🏆 Top productos del mes
              </p>
            </div>
            {!data?.top_productos?.length ? (
              <div style={{ padding: "24px", textAlign: "center",
                color: "var(--text-3)", fontSize: "13px" }}>
                Sin datos este mes
              </div>
            ) : data.top_productos.map((p, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "12px 20px",
                borderTop: i > 0 ? "1px solid var(--border)" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{
                    fontFamily: "var(--font-serif)", fontSize: "1.2rem",
                    color: i === 0 ? "var(--accent)" : "var(--text-3)",
                    minWidth: "20px",
                  }}>
                    {i + 1}
                  </span>
                  <p style={{ fontSize: "13px", overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap",
                    maxWidth: "140px" }}>
                    {p.product_name}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: "12px", fontWeight: 500 }}>
                    ${Math.round(p.ingresos).toLocaleString("es-CL")}
                  </p>
                  <p style={{ fontSize: "11px", color: "var(--text-3)" }}>
                    {p.unidades} u.
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Alertas de inventario */}
          {(data?.inventario?.criticos > 0 || data?.inventario?.sin_stock > 0) && (
            <Link to="/admin/inventory?tab=1" style={{ textDecoration: "none" }}>
              <div style={{
                background: "rgba(248,113,113,0.06)",
                border: "1px solid rgba(248,113,113,0.2)",
                borderRadius: "var(--r-xl)", padding: "16px 20px",
                display: "flex", alignItems: "center",
                justifyContent: "space-between",
                transition: "all var(--dur) var(--ease)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "22px" }}>⚠️</span>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 600,
                      color: "#f87171", marginBottom: "3px" }}>
                      Alertas de stock
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                      {data.inventario.sin_stock > 0 &&
                        `${data.inventario.sin_stock} sin stock`}
                      {data.inventario.sin_stock > 0 &&
                        data.inventario.criticos > 0 && " · "}
                      {data.inventario.criticos > 0 &&
                        `${data.inventario.criticos} críticos`}
                    </p>
                  </div>
                </div>
                <span style={{ color: "#f87171", fontSize: "16px" }}>→</span>
              </div>
            </Link>
          )}

          {/* Accesos rápidos */}
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-xl)", padding: "16px 20px",
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px",
          }}>
            {[
              { to: "/admin/orders",    icon: "📦", label: "Órdenes" },
              { to: "/admin/products",  icon: "🎧", label: "Productos" },
              { to: "/admin/finance",   icon: "◎",  label: "Finanzas" },
              { to: "/admin/inventory", icon: "◫",  label: "Inventario" },
            ].map(({ to, icon, label }) => (
              <Link key={to} to={to} style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 12px", borderRadius: "var(--r-md)",
                background: "var(--surface-2)", border: "1px solid var(--border)",
                fontSize: "13px", color: "var(--text-2)",
                textDecoration: "none",
                transition: "all var(--dur) var(--ease)",
              }}>
                <span>{icon}</span>
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}