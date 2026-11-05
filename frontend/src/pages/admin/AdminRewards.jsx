// pages/admin/AdminRewards.jsx — Dashboard del módulo Rewards
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Gift, Ticket, Users, DollarSign } from "lucide-react"
import { adminGetRewardsDashboard } from "../../api/rewards.api"
import { StatCard, AdminPageHeader, SectionCard, SecondaryButton, StatusBadge } from "../../components/admin/ui"
import { useSiteSettings } from "../../hooks/useSiteSettings"

function KpiCard({ label, value, subtitle, variant = "light", testId, Icon }) {
  return <StatCard variant={variant} Icon={Icon} label={label} value={value} sub={subtitle} testId={testId} />
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
  const { siteName } = useSiteSettings()
  const { data, isLoading } = useQuery({
    queryKey: ["admin-rewards-dashboard"],
    queryFn:  adminGetRewardsDashboard,
    refetchInterval: 15_000,
  })

  const remainingLabel = useCountdownDisplay(data?.current_campaign?.seconds_remaining)

  if (isLoading || !data || !data.totals) return (
    <div className="au-page">
      <div className="lp-grid-kpi">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: "130px", borderRadius: "20px" }} />
        ))}
      </div>
    </div>
  )

  return (
    <div className="au-page">
      {/* Header */}
      <AdminPageHeader
        eyebrow={`LEVELPRO / ${(siteName || "LEVELPRO").toUpperCase()} REWARDS`}
        title="Dashboard de campañas"
        description="Seguimiento de sorteos, participaciones y conversión en tienda"
        actions={
          <>
            <SecondaryButton to="/admin/rewards/entries" size="sm">Participaciones</SecondaryButton>
            <SecondaryButton to="/admin/rewards/winners" size="sm">Ganadores</SecondaryButton>
            <Link to="/admin/rewards/campaigns" data-testid="btn-manage-campaigns"
              className="au-btn au-btn--primary" style={{ textDecoration:"none" }}>
              + Nueva campaña
            </Link>
          </>
        }
      />

      {/* KPIs globales */}
      <div className="lp-grid-kpi">
        <KpiCard testId="kpi-campaigns" variant="ink" label="Campañas totales" value={data.totals.campaigns} subtitle="Histórico en sistema" Icon={Gift} />
        <KpiCard testId="kpi-entries" variant="primary" label="Participaciones" value={data.totals.entries} subtitle="Tickets generados" Icon={Ticket} />
        <KpiCard testId="kpi-participants" variant="light" label="Participantes únicos" value={data.totals.participants} subtitle="Clientes participando" Icon={Users} />
        <KpiCard testId="kpi-revenue" variant="light" label="Ingresos relacionados"
          value={`$${Number(data.totals.related_revenue).toLocaleString("es-CL")}`}
          subtitle="Órdenes que generaron tickets" Icon={DollarSign} />
      </div>

      {/* Campaña actual */}
      {data.current_campaign ? (
        <div className="lp-user-hero">
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"flex-start", flexWrap:"wrap", gap:"20px", position: "relative", zIndex: 1 }}>
            <div style={{ minWidth:0, flex:1 }}>
              <div className="au-eyebrow">
                <span className="lp-hero-dot" />
                CAMPAÑA ACTIVA EN TIENDA
              </div>
              <h2 style={{ fontFamily:"var(--font-display)",
                fontSize:"clamp(1.6rem, 2.4vw, 2.2rem)", fontWeight:800,
                letterSpacing:"-0.03em", marginBottom:"6px", color: "#fff" }}>
                {data.current_campaign.name}
              </h2>
              <p style={{ fontSize:"14px", color:"rgba(255,255,255,0.78)" }}>
                🏆 {data.current_campaign.main_prize}
              </p>
            </div>
            <div style={{ textAlign:"right" }}>
              <p style={{ fontSize:"11px", color:"rgba(255,255,255,0.6)",
                textTransform:"uppercase", letterSpacing:"0.08em",
                marginBottom:"4px", fontWeight: 700 }}>
                Tiempo restante
              </p>
              <p style={{ fontSize:"22px", fontWeight:800,
                color:"#1AFF6E", fontFamily:"var(--font-mono)" }}>
                {remainingLabel}
              </p>
            </div>
          </div>

          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",
            gap:"12px", marginTop:"22px",
            paddingTop:"18px", borderTop:"1px solid rgba(255,255,255,0.1)",
            position: "relative", zIndex: 1,
          }}>
            {[
              ["Participaciones", data.current_campaign.total_entries],
              ["Participantes",   data.current_campaign.total_participants],
              ["Productos",       data.current_campaign.products_count],
              ["Conversión",      `${data.current_campaign.conversion_rate}%`],
            ].map(([label, value]) => (
              <div key={label}>
                <p style={{ fontSize:"11px", color:"rgba(255,255,255,0.58)",
                  textTransform:"uppercase", letterSpacing:"0.08em",
                  marginBottom:"4px", fontWeight: 700 }}>{label}</p>
                <p style={{ fontSize:"20px", fontWeight:800,
                  color:"#fff", fontFamily:"var(--font-mono)" }}>{value}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop:"20px", display:"flex", gap:"10px",
            flexWrap:"wrap", position: "relative", zIndex: 1 }}>
            <Link to={`/admin/rewards/campaigns/${data.current_campaign.id}`}
              className="au-btn au-btn--primary"
              style={{ textDecoration:"none" }}>
              Gestionar campaña →
            </Link>
            <Link to={`/admin/rewards/entries?campaign=${data.current_campaign.id}`}
              className="au-btn au-btn--secondary"
              style={{
                textDecoration:"none",
                background:"rgba(255,255,255,0.08)",
                borderColor:"rgba(255,255,255,0.16)",
                color:"#fff",
              }}>
              Ver participaciones
            </Link>
          </div>
        </div>
      ) : (
        <div className="au-card au-panel" style={{ padding:"40px", textAlign:"center" }}>
          <p style={{ fontSize:"14px", color:"var(--admin-text-secondary)", marginBottom: "14px" }}>
            No hay campañas activas en este momento.
          </p>
          <Link to="/admin/rewards/campaigns" className="au-btn au-btn--primary"
            style={{ textDecoration:"none" }}>
            Crear la primera campaña
          </Link>
        </div>
      )}

      {/* Historial */}
      <SectionCard eyebrow="HISTORIAL" title="Campañas recientes">
        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          {data.recent_campaigns.map(c => (
            <Link key={c.id} to={`/admin/rewards/campaigns/${c.id}`}
              style={{
                padding:"14px 18px", background:"var(--admin-surface-soft)",
                border:"1px solid var(--admin-border)", borderRadius:"14px",
                display:"flex", justifyContent:"space-between", alignItems:"center",
                textDecoration:"none", transition:"background 150ms", gap: "12px", flexWrap: "wrap",
              }}>
              <div style={{ minWidth:0 }}>
                <p style={{ fontSize:"14px", fontWeight:700, color:"var(--admin-text)" }}>
                  {c.name}
                </p>
                <p style={{ fontSize:"12px", color:"var(--admin-text-muted)",
                  marginTop:"2px", fontFamily: "var(--font-mono)" }}>
                  Sorteo · {new Date(c.draw_date).toLocaleDateString("es-CL")}
                </p>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
                <span style={{ fontSize:"13px", fontWeight: 700, color:"var(--admin-text-secondary)",
                  fontFamily:"var(--font-mono)" }}>
                  {c.entries} tickets
                </span>
                <StatusBadge tone={c.status === "active" ? "success" : c.status === "finished" ? "warning" : "neutral"}>
                  {c.status}
                </StatusBadge>
              </div>
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
