// pages/Dashboard.jsx — alineado al lenguaje del panel admin (credible/app-like)
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  Package, PlayCircle, Wrench, Star, Clock, ShoppingBag,
  ArrowRight, AlertTriangle, ChevronRight,
} from "lucide-react"
import { useAuthStore } from "../store/authStore"
import { StatCard } from "../components/admin/ui"
import { getOrders } from "../api/orders.api"
import { getEnrollments } from "../api/academy.api"
import { getServiceRequests } from "../api/services.api"
import { getMyLoyalty } from "../api/loyalty.api"

const statusConfig = {
  pending:   { label: "Pendiente",  color: "#facc15" },
  paid:      { label: "Pagado",     color: "#1aff6e" },
  shipped:   { label: "Enviado",    color: "#60a5fa" },
  completed: { label: "Completado", color: "#1aff6e" },
  cancelled: { label: "Cancelado",  color: "#f87171" },
}

function StatusBadge({ status }) {
  const c = statusConfig[status] || { label: status, color: "var(--text-3)" }
  return (
    <span style={{ padding: "3px 10px", borderRadius: "var(--r-full)", fontSize: "11px",
      fontWeight: 600, color: c.color, background: `${c.color}18`,
      border: `1px solid ${c.color}33`, whiteSpace: "nowrap" }}>
      {c.label}
    </span>
  )
}

// ── Action card con lista ──
function ActionCard({ title, icon: Icon, count, viewAllTo, accent = "var(--accent)", children, emptyMessage, testId }) {
  return (
    <div data-testid={testId} style={{ background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-xl)", padding: "20px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ padding: "7px", borderRadius: "var(--r-md)", background: `${accent}15`, color: accent,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={15} strokeWidth={1.8} />
          </div>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)" }}>{title}</p>
            {count !== undefined && <p style={{ fontSize: "11px", color: "var(--text-3)" }}>{count} en total</p>}
          </div>
        </div>
        {viewAllTo && (
          <Link to={viewAllTo} style={{ fontSize: "11px", color: "var(--text-3)", textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: "3px" }}>
            Ver todo <ArrowRight size={11} strokeWidth={2} />
          </Link>
        )}
      </div>
      {children || <p style={{ fontSize: "12px", color: "var(--text-3)", padding: "20px 0", textAlign: "center" }}>{emptyMessage}</p>}
    </div>
  )
}

function OrderRow({ o, accent }) {
  return (
    <Link to={`/dashboard/orders/${o.id}`} style={{ display: "flex", justifyContent: "space-between",
      alignItems: "center", padding: "10px 12px", background: "var(--surface-2)",
      border: "1px solid var(--border)", borderRadius: "var(--r-md)", textDecoration: "none", gap: "10px" }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text)", fontFamily: "monospace" }}>
          #{o.id.slice(0, 8).toUpperCase()}
        </p>
        <p style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "2px" }}>
          {o.items_count} item{o.items_count !== 1 ? "s" : ""} · {new Date(o.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
        </p>
      </div>
      <p style={{ fontSize: "13px", fontWeight: 700, color: accent || "var(--text)",
        fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        ${Number(o.total).toLocaleString("es-CL")}
      </p>
    </Link>
  )
}

export default function Dashboard() {
  const { user } = useAuthStore()

  const { data: ordersData, isLoading } = useQuery({ queryKey: ["orders"], queryFn: getOrders })
  const { data: enrollData } = useQuery({ queryKey: ["enrollments"], queryFn: getEnrollments })
  const { data: reqData }    = useQuery({ queryKey: ["service-requests"], queryFn: getServiceRequests })
  const { data: loyalty }    = useQuery({ queryKey: ["my-loyalty"], queryFn: getMyLoyalty })

  const orders      = ordersData?.results || ordersData || []
  const enrollCount = enrollData?.results?.length ?? enrollData?.length ?? 0
  const reqCount    = reqData?.results?.length    ?? reqData?.length    ?? 0
  const points      = loyalty?.puntos_disponibles ?? 0

  const pending = orders.filter(o => o.status === "pending")
  const recent  = orders.slice(0, 4)
  const todayCount = orders.filter(o => {
    const d = new Date(o.created_at); const n = new Date()
    return d.toDateString() === n.toDateString()
  }).length

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }} data-testid="dashboard-home">

      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <p style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 700,
          letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "10px" }}>· Mi cuenta</p>
        <h1 className="display-bold" style={{ fontFamily: "var(--font-display)",
          fontSize: "clamp(1.7rem, 3vw, 2.4rem)", fontWeight: 800, letterSpacing: "-0.03em",
          lineHeight: 1.05, marginBottom: "6px", color: "var(--text)" }}>
          Hola, {user?.first_name || "bienvenido"}.
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
          Tu resumen de cuenta y actividad reciente.
        </p>
      </div>

      {/* Alerta: pagos pendientes */}
      {pending.length > 0 && (
        <div data-testid="dash-alert" style={{ padding: "14px 18px", marginBottom: "24px",
          background: "linear-gradient(135deg, rgba(250,204,21,0.06) 0%, transparent 100%)",
          border: "1px solid rgba(250,204,21,0.25)", borderRadius: "var(--r-xl)",
          display: "flex", gap: "14px", alignItems: "center" }}>
          <AlertTriangle size={16} strokeWidth={1.8} style={{ color: "#facc15", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)" }}>Tenés pagos pendientes</p>
            <p style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "2px" }}>
              {pending.length} pedido{pending.length !== 1 ? "s" : ""} esperan completar el pago.
            </p>
          </div>
          <Link to="/dashboard/orders" style={{ fontSize: "12px", color: "#facc15", textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
            Resolver <ArrowRight size={12} />
          </Link>
        </div>
      )}

      {/* KPIs — mismas cards que el panel admin (StatCard) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "14px", marginBottom: "24px" }} className="dash-kpis">
        <StatCard label="Pedidos" value={orders.length}
          sub={`${pending.length} pendientes${todayCount ? ` · ${todayCount} hoy` : ""}`}
          Icon={Package} to="/dashboard/orders" testId="dash-kpi-pedidos" />
        <StatCard label="Puntos" value={points.toLocaleString("es-CL")}
          sub={loyalty ? `Nivel ${loyalty.nivel}` : "Programa de fidelidad"}
          variant="primary" Icon={Star} to="/dashboard/loyalty" testId="dash-kpi-puntos" />
        <StatCard label="Cursos" value={enrollCount}
          sub={enrollCount === 1 ? "inscripción activa" : "inscripciones"}
          Icon={PlayCircle} to="/dashboard/courses" testId="dash-kpi-cursos" />
        <StatCard label="Servicios" value={reqCount}
          sub={reqCount === 1 ? "solicitud" : "solicitudes"}
          Icon={Wrench} to="/dashboard/services" testId="dash-kpi-servicios" />
      </div>

      {/* Loyalty progress (si aplica) */}
      {loyalty && loyalty.puntos_disponibles > 0 && loyalty.siguiente_nivel && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)", padding: "18px 22px", marginBottom: "24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ width: "36px", height: "36px", borderRadius: "50%",
              background: "rgba(26,255,110,0.1)", border: "1px solid rgba(26,255,110,0.25)",
              color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Star size={16} fill="var(--accent)" />
            </span>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)" }}>
                Nivel {loyalty.nivel} — {loyalty.puntos_disponibles.toLocaleString("es-CL")} pts
              </p>
              <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {loyalty.progreso_nivel}% hacia {loyalty.siguiente_nivel}
              </p>
            </div>
          </div>
          <div style={{ flex: "0 1 260px", minWidth: "180px" }}>
            <div style={{ height: "6px", borderRadius: "3px", background: "var(--surface-2)", overflow: "hidden" }}>
              <div style={{ width: `${loyalty.progreso_nivel}%`, height: "100%", background: "var(--accent)",
                borderRadius: "3px", transition: "width 1s var(--ease)" }} />
            </div>
          </div>
        </div>
      )}

      {/* Action cards: pendientes + recientes */}
      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "14px" }}>
          {[...Array(2)].map((_, i) => <div key={i} className="skeleton" style={{ height: "200px" }} />)}
        </div>
      ) : orders.length === 0 ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)", padding: "56px 32px", textAlign: "center" }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "50%",
            background: "rgba(26,255,110,0.08)", border: "1px solid rgba(26,255,110,0.2)",
            color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 18px" }}><ShoppingBag size={28} /></div>
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.3rem",
            letterSpacing: "-0.02em", marginBottom: "8px", color: "var(--text)" }}>
            Sin pedidos todavía
          </p>
          <p style={{ fontSize: "14px", color: "var(--text-3)", marginBottom: "22px" }}>
            Explorá la tienda y realizá tu primer pedido.
          </p>
          <Link to="/shop" style={{ display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "12px 22px", borderRadius: "var(--r-full)", background: "var(--accent)",
            color: "#000", fontWeight: 700, fontSize: "14px", textDecoration: "none" }}>
            Ir a la tienda <ChevronRight size={15} />
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "14px" }} className="dash-actions">
          <ActionCard title="Pagos pendientes" icon={Clock} count={pending.length}
            viewAllTo="/dashboard/orders" accent="#facc15" testId="dash-pending"
            emptyMessage="No tenés pagos pendientes ✓">
            {pending.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                {pending.slice(0, 4).map(o => <OrderRow key={o.id} o={o} accent="#facc15" />)}
              </div>
            )}
          </ActionCard>

          <ActionCard title="Últimos pedidos" icon={ShoppingBag} count={orders.length}
            viewAllTo="/dashboard/orders" accent="var(--accent)" testId="dash-recent"
            emptyMessage="Sin pedidos aún">
            <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
              {recent.map(o => (
                <Link key={o.id} to={`/dashboard/orders/${o.id}`} style={{ display: "flex",
                  justifyContent: "space-between", alignItems: "center", padding: "10px 12px",
                  background: "var(--surface-2)", border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)", textDecoration: "none", gap: "10px" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text)", fontFamily: "monospace" }}>
                      #{o.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "2px" }}>
                      ${Number(o.total).toLocaleString("es-CL")} · {new Date(o.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                </Link>
              ))}
            </div>
          </ActionCard>
        </div>
      )}

      <style>{`
        .kpi-hover:hover { border-color: rgba(26,255,110,0.28) !important; }
      `}</style>
    </div>
  )
}
