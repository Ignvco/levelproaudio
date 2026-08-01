// pages/admin/AdminRewards.jsx — Dashboard del módulo Rewards
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Gift, Ticket, Users, DollarSign } from "lucide-react"
import { adminGetRewardsDashboard } from "../../api/rewards.api"

function KpiCard({ label, value, subtitle, accent, testId, Icon }) {
  return (
    <div data-testid={testId} className="a-kpi-hover" style={{
      padding:"22px 24px", background:"var(--surface)",
      border:"1px solid var(--border)", borderRadius:"var(--r-xl)",
    }}>
      {Icon && <span className="a-kpi-tile" style={{ marginBottom:"14px" }}><Icon size={20} strokeWidth={2} /></span>}
      <p style={{ fontSize:"11px", color:"var(--text-3)",
        letterSpacing:"0.1em", textTransform:"uppercase",
        fontWeight:600, marginBottom:"10px" }}>
        {label}
      </p>
      <p style={{
        fontSize:"32px", fontWeight:600,
        color: accent ? "var(--accent)" : "var(--text)",
        fontVariantNumeric:"tabular-nums", lineHeight:1,
      }}>
        {value}
      </p>
      {subtitle && (
        <p style={{ fontSize:"12px", color:"var(--text-3)", marginTop:"8px" }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

function useCountdownDisplay(seconds) {
  const [rem, setRem] = useState(seconds || 0)
  useEffect(() => {
    setRem(seconds || 0)
    if (!seconds) return
    const id = setInterval(() => setRem(r => Math.max(0, r - 1)), 1000)
    return () => clearInterval(id)
  }, [seconds])
  const d = Math.floor(rem / 86400)
  const h = Math.floor((rem % 86400) / 3600)
  const m = Math.floor((rem % 3600) / 60)
  const s = rem % 60
  return `${d}d ${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`
}

export default function AdminRewards() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-rewards-dashboard"],
    queryFn:  adminGetRewardsDashboard,
    refetchInterval: 15_000,
  })

  const remainingLabel = useCountdownDisplay(data?.current_campaign?.seconds_remaining)

  if (isLoading) return (
    <div style={{ padding:"40px" }}>
      <p style={{ color:"var(--text-3)" }}>Cargando…</p>
    </div>
  )

  return (
    <div style={{ padding:"clamp(28px, 4vw, 40px)" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"start", marginBottom:"32px", flexWrap:"wrap", gap:"12px" }}>
        <div>
          <p style={{ fontSize:"12px", color:"var(--accent)",
            letterSpacing:"0.1em", textTransform:"uppercase",
            fontWeight:600, marginBottom:"6px" }}>
            LevelPro Rewards
          </p>
          <h1 style={{ fontSize:"28px", fontWeight:500, letterSpacing:"-0.01em" }}>
            Dashboard de campañas
          </h1>
        </div>
        <div style={{ display:"flex", gap:"8px" }}>
          <Link to="/admin/rewards/campaigns"
            data-testid="btn-manage-campaigns"
            className="btn btn-accent"
            style={{ padding:"10px 20px", fontSize:"13px" }}>
            + Nueva campaña
          </Link>
        </div>
      </div>

      {/* KPIs globales */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))",
        gap:"14px", marginBottom:"32px",
      }}>
        <KpiCard testId="kpi-campaigns" label="Campañas totales" value={data.totals.campaigns} Icon={Gift} />
        <KpiCard testId="kpi-entries" label="Participaciones" value={data.totals.entries} accent Icon={Ticket} />
        <KpiCard testId="kpi-participants" label="Participantes únicos" value={data.totals.participants} Icon={Users} />
        <KpiCard testId="kpi-revenue" label="Ingresos relacionados"
          value={`$${Number(data.totals.related_revenue).toLocaleString("es-CL")}`}
          subtitle="Órdenes que generaron tickets" Icon={DollarSign} />
      </div>

      {/* Campaña actual */}
      {data.current_campaign ? (
        <div style={{
          padding:"28px 32px",
          background:"linear-gradient(135deg, rgba(26,255,110,0.06) 0%, rgba(26,255,110,0.01) 100%)",
          border:"1px solid rgba(26,255,110,0.2)",
          borderRadius:"var(--r-2xl)",
          marginBottom:"32px",
        }}>
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"start", flexWrap:"wrap", gap:"20px" }}>
            <div style={{ minWidth:0, flex:1 }}>
              <p style={{ fontSize:"11px", color:"var(--accent)",
                letterSpacing:"0.1em", textTransform:"uppercase",
                fontWeight:700, marginBottom:"8px" }}>
                Campaña activa
              </p>
              <h2 style={{ fontFamily:"var(--font-display)",
                fontSize:"28px", fontWeight:800,
                letterSpacing:"-0.01em", marginBottom:"6px" }}>
                {data.current_campaign.name}
              </h2>
              <p style={{ fontSize:"14px", color:"var(--text-2)" }}>
                🏆 {data.current_campaign.main_prize}
              </p>
            </div>
            <div style={{ textAlign:"right" }}>
              <p style={{ fontSize:"11px", color:"var(--text-3)",
                textTransform:"uppercase", letterSpacing:"0.08em",
                marginBottom:"4px" }}>
                Tiempo restante
              </p>
              <p style={{ fontSize:"22px", fontWeight:600,
                color:"var(--accent)", fontVariantNumeric:"tabular-nums" }}>
                {remainingLabel}
              </p>
            </div>
          </div>

          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",
            gap:"12px", marginTop:"24px",
            paddingTop:"20px", borderTop:"1px solid rgba(26,255,110,0.15)",
          }}>
            {[
              ["Participaciones", data.current_campaign.total_entries],
              ["Participantes",   data.current_campaign.total_participants],
              ["Productos",       data.current_campaign.products_count],
              ["Conversión",      `${data.current_campaign.conversion_rate}%`],
            ].map(([label, value]) => (
              <div key={label}>
                <p style={{ fontSize:"11px", color:"var(--text-3)",
                  textTransform:"uppercase", letterSpacing:"0.08em",
                  marginBottom:"4px" }}>{label}</p>
                <p style={{ fontSize:"20px", fontWeight:600,
                  color:"var(--text)", fontVariantNumeric:"tabular-nums" }}>{value}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop:"20px", display:"flex", gap:"10px",
            flexWrap:"wrap" }}>
            <Link to={`/admin/rewards/campaigns/${data.current_campaign.id}`}
              className="btn btn-accent"
              style={{ padding:"9px 18px", fontSize:"13px" }}>
              Gestionar campaña →
            </Link>
            <Link to={`/admin/rewards/entries?campaign=${data.current_campaign.id}`}
              style={{
                padding:"9px 18px", fontSize:"13px",
                border:"1px solid var(--border)", color:"var(--text-2)",
                borderRadius:"var(--r-full)", textDecoration:"none",
              }}>
              Ver participaciones
            </Link>
          </div>
        </div>
      ) : (
        <div style={{
          padding:"32px", background:"var(--surface)",
          border:"1px solid var(--border)", borderRadius:"var(--r-xl)",
          textAlign:"center", marginBottom:"32px",
        }}>
          <p style={{ fontSize:"14px", color:"var(--text-2)" }}>
            No hay campañas activas.
          </p>
          <Link to="/admin/rewards/campaigns" className="btn btn-accent"
            style={{ marginTop:"14px", padding:"10px 20px", fontSize:"13px" }}>
            Crear la primera campaña
          </Link>
        </div>
      )}

      {/* Historial */}
      <h3 style={{ fontSize:"14px", fontWeight:600, color:"var(--text-2)",
        letterSpacing:"0.08em", textTransform:"uppercase",
        marginBottom:"14px" }}>
        Campañas recientes
      </h3>
      <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
        {data.recent_campaigns.map(c => (
          <Link key={c.id} to={`/admin/rewards/campaigns/${c.id}`}
            style={{
              padding:"14px 20px", background:"var(--surface)",
              border:"1px solid var(--border)", borderRadius:"var(--r-lg)",
              display:"flex", justifyContent:"space-between", alignItems:"center",
              textDecoration:"none", transition:"background 150ms",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)"}
            onMouseLeave={e => e.currentTarget.style.background = "var(--surface)"}>
            <div style={{ minWidth:0 }}>
              <p style={{ fontSize:"14px", fontWeight:500, color:"var(--text)" }}>
                {c.name}
              </p>
              <p style={{ fontSize:"12px", color:"var(--text-3)",
                marginTop:"2px" }}>
                Sorteo · {new Date(c.draw_date).toLocaleDateString("es-CL")}
              </p>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
              <span style={{ fontSize:"13px", color:"var(--text-2)",
                fontVariantNumeric:"tabular-nums" }}>
                {c.entries} tickets
              </span>
              <span style={{
                fontSize:"11px", padding:"3px 10px",
                borderRadius:"var(--r-full)", fontWeight:600,
                letterSpacing:"0.06em", textTransform:"uppercase",
                background: c.status === "active"
                  ? "rgba(26,255,110,0.1)" : "rgba(255,255,255,0.04)",
                color: c.status === "active"
                  ? "var(--accent)" : "var(--text-3)",
              }}>
                {c.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
