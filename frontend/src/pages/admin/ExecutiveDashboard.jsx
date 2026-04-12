// pages/admin/ExecutiveDashboard.jsx
import { useQuery } from "@tanstack/react-query"
import { Link }     from "react-router-dom"
import { getExecutiveDashboard } from "../../api/admin.api"

const fmt = n => `$${Number(n||0).toLocaleString("es-CL")}`

function Sparkline({ data=[], color="var(--accent)", height=40 }) {
  if (!data.length) return null
  const values = data.map(d => d.total || 0)
  const max    = Math.max(...values, 1)
  const points = values.map((v,i) => {
    const x = (i / Math.max(values.length-1,1)) * 100
    const y = height - (v/max)*height
    return `${x},${y}`
  }).join(" ")
  const lastV = values[values.length-1]
  const lastX = 100
  const lastY = height - (lastV/max)*height
  return (
    <svg width="100%" height={height} viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none" style={{ overflow:"visible" }}>
      <polyline points={points} fill="none" stroke={color}
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
    </svg>
  )
}

function KPICard({ label, value, sub, sparkData, icon, color="var(--accent)", badge }) {
  return (
    <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:"var(--r-xl)", padding:"20px 24px",
      display:"flex", flexDirection:"column", gap:"8px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <p style={{ fontSize:"11px", color:"var(--text-3)", fontWeight:500,
          textTransform:"uppercase", letterSpacing:"0.08em" }}>{label}</p>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          {badge !== undefined && badge !== null && (
            <span style={{ fontSize:"11px", fontWeight:600, padding:"2px 8px",
              borderRadius:"var(--r-full)",
              color:      badge >= 0 ? "#4ade80" : "#f87171",
              background: badge >= 0 ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
              border:     `1px solid ${badge>=0 ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}` }}>
              {badge >= 0 ? "↑" : "↓"} {Math.abs(badge)}%
            </span>
          )}
          {icon && <span style={{ fontSize:"18px" }}>{icon}</span>}
        </div>
      </div>
      <p style={{ fontFamily:"var(--font-serif)", fontSize:"2.2rem", color, lineHeight:1 }}>
        {value}
      </p>
      {sparkData?.length > 0 && (
        <div style={{ marginTop:"4px" }}>
          <Sparkline data={sparkData} color={color} />
        </div>
      )}
      {sub && <p style={{ fontSize:"12px", color:"var(--text-3)" }}>{sub}</p>}
    </div>
  )
}

export default function ExecutiveDashboard() {
  const { data, isLoading, refetch } = useQuery({
    queryKey:["executive-dashboard"],
    queryFn: getExecutiveDashboard,
    refetchInterval: 120000,
  })

  // ── campos reales del backend ──
  // data.ventas.hoy / .ayer / .semana / .mes / .mes_anterior / .hoy_count
  // data.ventas.var_dia / .var_mes
  // data.utilidad_mes
  // data.inventario.criticos / .sin_stock
  // data.ordenes_hoy[] { id, email, total, status, hour }
  // data.ventas_7dias[] { day, day_label, total }
  // data.top_productos[] { product_name, units_sold, total_revenue }

  const ventas     = data?.ventas      || {}
  const inventario = data?.inventario  || {}
  const chart7     = data?.ventas_7dias || []
  const topProds   = data?.top_productos || []
  const ordenesHoy = data?.ordenes_hoy   || []

  const today = new Date().toLocaleDateString("es-CL", {
    weekday:"long", day:"numeric", month:"long", year:"numeric"
  })
  const todayStr = today.charAt(0).toUpperCase() + today.slice(1)

  if (isLoading) return (
    <div style={{ padding:"clamp(24px, 4vw, 40px)" }}>
      <div style={{ display:"grid",
        gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))",
        gap:"12px", marginBottom:"24px" }}>
        {[...Array(4)].map((_,i) => (
          <div key={i} className="skeleton" style={{ height:"130px" }} />
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr",
        gap:"16px", marginBottom:"16px" }}>
        <div className="skeleton" style={{ height:"240px" }} />
        <div className="skeleton" style={{ height:"240px" }} />
      </div>
    </div>
  )

  return (
    <div style={{ padding:"clamp(24px, 4vw, 40px)" }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"flex-end", marginBottom:"32px", flexWrap:"wrap", gap:"16px" }}>
        <div>
          <p style={{ fontSize:"12px", color:"var(--accent)", fontWeight:600,
            letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"8px" }}>
            Vista ejecutiva
          </p>
          <h1 style={{ fontFamily:"var(--font-serif)", fontSize:"clamp(1.8rem, 3vw, 2.6rem)",
            fontWeight:300, letterSpacing:"-0.02em", marginBottom:"6px" }}>
            Vista ejecutiva
          </h1>
          <p style={{ fontSize:"13px", color:"var(--text-3)" }}>{todayStr}</p>
        </div>
        <button onClick={() => refetch()} className="btn btn-ghost"
          style={{ padding:"9px 18px", fontSize:"13px" }}>
          ↻ Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid",
        gridTemplateColumns:"repeat(auto-fill, minmax(210px, 1fr))",
        gap:"14px", marginBottom:"24px" }}>
        <KPICard label="Ventas hoy"
          value={fmt(ventas.hoy)}
          sub={`${ventas.hoy_count||0} órdenes`}
          sparkData={chart7}
          badge={ventas.var_dia}
          icon="📅" color="var(--accent)" />
        <KPICard label="Ventas esta semana"
          value={fmt(ventas.semana)}
          sub="Últimos 7 días"
          sparkData={chart7}
          icon="📊" color="#60a5fa" />
        <KPICard label="Ventas este mes"
          value={fmt(ventas.mes)}
          sub="Últimos 30 días"
          badge={ventas.var_mes}
          icon="🗓" color="var(--text)" />
        <KPICard label="Utilidad neta mes"
          value={fmt(data?.utilidad_mes)}
          sub="Después de costos"
          icon="💼"
          color={(data?.utilidad_mes||0) > 0 ? "var(--accent)" : "#f87171"} />
      </div>

      {/* Gráfico 7 días + Órdenes de hoy */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr",
        gap:"16px", marginBottom:"16px" }}>

        {/* Barras 7 días */}
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:"var(--r-xl)", padding:"22px 24px" }}>
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"flex-start", marginBottom:"20px" }}>
            <div>
              <p style={{ fontSize:"13px", fontWeight:500, marginBottom:"3px" }}>
                Ventas últimos 7 días
              </p>
              <p style={{ fontSize:"12px", color:"var(--accent)", fontWeight:600 }}>
                {fmt(ventas.semana)}
              </p>
            </div>
          </div>
          {chart7.length > 0 ? (
            <div style={{ display:"flex", alignItems:"flex-end",
              gap:"8px", height:"120px" }}>
              {(() => {
                const vals = chart7.map(d => d.total||0)
                const max  = Math.max(...vals, 1)
                return chart7.map((d,i) => {
                  const pct     = (d.total||0)/max
                  const isToday = i === chart7.length-1
                  return (
                    <div key={i} style={{ flex:1, display:"flex",
                      flexDirection:"column", alignItems:"center", gap:"8px" }}>
                      <div style={{ width:"100%", borderRadius:"4px 4px 0 0",
                        background: isToday ? "var(--accent)" : "rgba(26,255,110,0.2)",
                        height:`${Math.max(pct*100, 4)}%`, minHeight:"4px",
                        transition:"height 600ms var(--ease)" }}
                        title={fmt(d.total)} />
                      <span style={{ fontSize:"11px",
                        color: isToday ? "var(--text-2)" : "var(--text-3)",
                        textAlign:"center", lineHeight:1.2 }}>
                        {d.day_label || d.day || ""}
                      </span>
                    </div>
                  )
                })
              })()}
            </div>
          ) : (
            <div style={{ height:"120px", display:"flex", alignItems:"center",
              justifyContent:"center", color:"var(--text-3)", fontSize:"13px" }}>
              Sin datos de ventas todavía.
            </div>
          )}
        </div>

        {/* Órdenes de hoy */}
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:"var(--r-xl)", overflow:"hidden",
          display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)",
            display:"flex", justifyContent:"space-between", alignItems:"center",
            background:"var(--surface-2)", flexShrink:0 }}>
            <p style={{ fontSize:"13px", fontWeight:500 }}>Órdenes de hoy</p>
            <Link to="/admin/orders" style={{ fontSize:"12px",
              color:"var(--accent)", textDecoration:"none" }}>
              Ver todas →
            </Link>
          </div>
          <div style={{ flex:1, overflowY:"auto" }}>
            {!ordenesHoy.length ? (
              <div style={{ padding:"40px", textAlign:"center",
                color:"var(--text-3)", fontSize:"13px" }}>
                Sin órdenes hoy todavía.
              </div>
            ) : ordenesHoy.map((o,i) => (
              <div key={o.id} style={{
                display:"flex", justifyContent:"space-between",
                alignItems:"center", padding:"12px 20px",
                borderTop: i>0 ? "1px solid var(--border)" : "none",
                transition:"background var(--dur) var(--ease)" }}
                onMouseEnter={e => e.currentTarget.style.background="var(--surface-2)"}
                onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                <div>
                  <p style={{ fontSize:"12px", fontFamily:"monospace",
                    fontWeight:600, marginBottom:"2px" }}>
                    #{o.id?.slice(0,8).toUpperCase()}
                  </p>
                  <p style={{ fontSize:"11px", color:"var(--text-3)" }}>
                    {o.email}
                    {o.hour && ` · ${o.hour}`}
                  </p>
                </div>
                <div style={{ textAlign:"right" }}>
                  <p style={{ fontSize:"13px", fontWeight:600,
                    color:"var(--accent)" }}>
                    {fmt(o.total)}
                  </p>
                  <p style={{ fontSize:"10px", marginTop:"2px",
                    color: o.status==="paid" ? "#4ade80"
                      : o.status==="pending" ? "#facc15" : "#f87171" }}>
                    {o.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top productos + Alertas */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>

        {/* Top productos */}
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:"var(--r-xl)", overflow:"hidden" }}>
          <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)",
            background:"var(--surface-2)" }}>
            <p style={{ fontSize:"13px", fontWeight:500 }}>Top productos del mes</p>
          </div>
          {!topProds.length ? (
            <div style={{ padding:"40px", textAlign:"center",
              color:"var(--text-3)", fontSize:"13px" }}>
              Sin ventas este mes todavía.
            </div>
          ) : topProds.map((p,i) => {
            const max = topProds[0]?.total_revenue || 1
            return (
              <div key={i} style={{ padding:"13px 20px",
                borderTop: i>0 ? "1px solid var(--border)" : "none" }}>
                <div style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"center", marginBottom:"7px" }}>
                  <div style={{ display:"flex", alignItems:"center",
                    gap:"8px", minWidth:0, flex:1 }}>
                    <span style={{ fontSize:"13px", fontWeight:700,
                      color:"var(--text-3)", flexShrink:0, width:"18px" }}>
                      {i+1}
                    </span>
                    <span style={{ fontSize:"13px", overflow:"hidden",
                      textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {p.product_name}
                    </span>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0, marginLeft:"12px" }}>
                    <span style={{ fontSize:"13px", fontWeight:600,
                      color:"var(--accent)" }}>
                      {fmt(p.total_revenue)}
                    </span>
                    <span style={{ fontSize:"11px", color:"var(--text-3)",
                      marginLeft:"6px" }}>
                      ×{p.units_sold}
                    </span>
                  </div>
                </div>
                <div style={{ height:"3px", borderRadius:"2px",
                  background:"var(--surface-3)", overflow:"hidden" }}>
                  <div style={{ height:"100%", borderRadius:"2px",
                    width:`${(p.total_revenue/max)*100}%`,
                    background:"var(--accent)",
                    transition:"width 600ms var(--ease)" }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Alertas inventario */}
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:"var(--r-xl)", overflow:"hidden" }}>
          <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)",
            display:"flex", justifyContent:"space-between", alignItems:"center",
            background:"var(--surface-2)" }}>
            <p style={{ fontSize:"13px", fontWeight:500 }}>Alertas de inventario</p>
            <Link to="/admin/inventory" style={{ fontSize:"12px",
              color:"var(--accent)", textDecoration:"none" }}>
              Ver todo →
            </Link>
          </div>
          {!inventario.criticos && !inventario.sin_stock ? (
            <div style={{ padding:"40px", textAlign:"center",
              color:"var(--accent)", fontSize:"13px" }}>
              <p style={{ fontSize:"36px", marginBottom:"8px" }}>✅</p>
              Stock OK en todos los productos.
            </div>
          ) : (
            <div style={{ padding:"20px 24px",
              display:"flex", flexDirection:"column", gap:"14px" }}>
              {[
                { label:"Sin stock",    value:inventario.sin_stock||0, color:"var(--danger)" },
                { label:"Stock crítico", value:inventario.criticos||0, color:"#facc15" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"center", padding:"14px 16px",
                  borderRadius:"var(--r-lg)", background:"var(--surface-2)",
                  border:`1px solid ${color}20` }}>
                  <span style={{ fontSize:"13px", color:"var(--text-2)" }}>{label}</span>
                  <span style={{ fontFamily:"var(--font-serif)", fontSize:"1.8rem", color }}>
                    {value}
                  </span>
                </div>
              ))}
              <Link to="/admin/inventory" style={{ fontSize:"12px",
                color:"var(--accent)", textDecoration:"none", textAlign:"center",
                padding:"8px" }}>
                Ver alertas detalladas →
              </Link>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media(max-width:900px) {
          .exec-grid { grid-template-columns:1fr !important; }
        }
      `}</style>
    </div>
  )
}