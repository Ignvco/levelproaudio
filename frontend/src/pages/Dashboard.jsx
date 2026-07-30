// pages/Dashboard.jsx
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  Package, PlayCircle, Wrench, Star, Clock, ChevronRight, ShoppingBag,
} from "lucide-react"
import { useAuthStore } from "../store/authStore"
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

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]

function StatusBadge({ status }) {
  const c = statusConfig[status] || { label: status, color: "var(--text-3)" }
  return (
    <span style={{ padding: "4px 12px", borderRadius: "var(--r-full)", fontSize: "11px",
      fontWeight: 600, color: c.color, background: `${c.color}18`,
      border: `1px solid ${c.color}33`, whiteSpace: "nowrap" }}>
      {c.label}
    </span>
  )
}

// ── Panel base ──
function Panel({ children, style, ...rest }) {
  return (
    <div style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: "24px", ...style }} {...rest}>
      {children}
    </div>
  )
}

const eyebrow = { fontSize: "11px", fontWeight: 700, color: "var(--accent)",
  textTransform: "uppercase", letterSpacing: "0.15em" }
const panelTitle = { fontFamily: "var(--font-display)", fontSize: "17px", fontWeight: 700,
  letterSpacing: "-0.01em", color: "var(--text)" }

// ── Gráfico de barras (pedidos por mes, dato real) ──
function ActivityChart({ orders }) {
  const now = new Date()
  const counts = Array(12).fill(0)
  orders.forEach(o => {
    const d = new Date(o.created_at)
    if (d.getFullYear() === now.getFullYear()) counts[d.getMonth()] += 1
  })
  const max = Math.max(1, ...counts)
  const totalYear = counts.reduce((a, b) => a + b, 0)

  return (
    <Panel style={{ padding: "24px" }} data-testid="dash-activity">
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <p style={eyebrow}>· Actividad</p>
          <h2 style={{ ...panelTitle, marginTop: "8px" }}>Tus pedidos por mes</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px",
          fontSize: "12px", color: "var(--text-3)" }}>
          <span style={{ width: "9px", height: "9px", borderRadius: "3px",
            background: "var(--accent)", display: "inline-block" }} />
          Pedidos {now.getFullYear()} · <strong style={{ color: "var(--text)" }}>{totalYear}</strong>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: "clamp(4px,1vw,12px)",
        height: "180px" }}>
        {counts.map((c, i) => {
          const h = Math.round((c / max) * 100)
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", gap: "10px", height: "100%" }}>
              <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end",
                justifyContent: "center", position: "relative" }}
                title={`${c} pedido${c !== 1 ? "s" : ""}`}>
                {/* track */}
                <div style={{ position: "absolute", inset: 0, borderRadius: "8px",
                  background: "rgba(255,255,255,0.03)" }} />
                <div style={{ position: "relative", width: "62%", maxWidth: "26px",
                  height: `${Math.max(c > 0 ? 8 : 0, h)}%`, minHeight: c > 0 ? "8px" : "0",
                  borderRadius: "8px 8px 4px 4px",
                  background: c > 0 ? "var(--accent)" : "transparent",
                  boxShadow: c > 0 ? "0 0 16px rgba(26,255,110,0.25)" : "none",
                  transition: "height 600ms var(--ease)" }} />
              </div>
              <span style={{ fontSize: "10px", color: i === now.getMonth() ? "var(--accent)" : "var(--text-3)",
                fontWeight: i === now.getMonth() ? 700 : 400 }}>{MONTHS[i]}</span>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

// ── Pendientes ──
function PendingPanel({ orders }) {
  const pending = orders.filter(o => o.status === "pending").slice(0, 4)
  return (
    <Panel style={{ padding: "24px" }} data-testid="dash-pending">
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: "20px" }}>
        <div>
          <p style={eyebrow}>· Pendientes</p>
          <h2 style={{ ...panelTitle, marginTop: "8px" }}>Pagos pendientes</h2>
        </div>
        <span style={{ width: "34px", height: "34px", borderRadius: "50%",
          background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.25)",
          color: "#facc15", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Clock size={16} />
        </span>
      </div>

      {pending.length === 0 ? (
        <div style={{ padding: "28px 8px", textAlign: "center" }}>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            No tenés pagos pendientes. ✓
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {pending.map(o => (
            <Link key={o.id} to={`/dashboard/orders/${o.id}`}
              style={{ display: "flex", alignItems: "center", gap: "12px",
                padding: "12px", borderRadius: "14px", textDecoration: "none",
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                transition: "border-color var(--dur)" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(250,204,21,0.3)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"}>
              <span style={{ width: "38px", height: "38px", borderRadius: "11px", flexShrink: 0,
                background: "rgba(255,255,255,0.04)", color: "var(--text-2)",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShoppingBag size={17} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)",
                  fontFamily: "monospace" }}>#{o.id.slice(0, 8).toUpperCase()}</p>
                <p style={{ fontSize: "11px", color: "var(--text-3)" }}>
                  {new Date(o.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                  {" · $"}{Number(o.total).toLocaleString("es-CL")}
                </p>
              </div>
              <StatusBadge status="pending" />
            </Link>
          ))}
        </div>
      )}
    </Panel>
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
  const recent      = orders.slice(0, 6)

  const stats = [
    { label: "Pedidos",   value: orders.length, to: "/dashboard/orders",   Icon: Package },
    { label: "Cursos",    value: enrollCount,   to: "/dashboard/courses",  Icon: PlayCircle },
    { label: "Puntos",    value: points.toLocaleString("es-CL"), to: "/dashboard/loyalty", Icon: Star, accent: true },
    { label: "Servicios", value: reqCount,      to: "/dashboard/services", Icon: Wrench },
  ]

  return (
    <div style={{ padding: "clamp(20px, 3vw, 40px) clamp(20px, 4vw, 48px)" }} data-testid="dashboard-home">

      {/* Quick Stats header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end",
        flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
        <div>
          <p style={eyebrow}>· Mi cuenta</p>
          <h1 className="display-bold" style={{ fontFamily: "var(--font-display)",
            fontSize: "clamp(1.8rem, 3.4vw, 2.6rem)", fontWeight: 800, letterSpacing: "-0.03em",
            lineHeight: 1.05, marginTop: "10px", color: "var(--text)" }}>
            Hola, {user?.first_name || "bienvenido"}.
          </h1>
        </div>
        <p style={{ fontSize: "13px", color: "var(--text-3)", maxWidth: "260px" }}>
          Tu resumen de cuenta y actividad reciente.
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px",
        marginBottom: "16px" }} className="dash-stats">
        {stats.map(({ label, value, to, Icon, accent }) => (
          <Link key={label} to={to} data-testid={`dash-stat-${label.toLowerCase()}`}
            style={{ display: "block", padding: "22px", borderRadius: "22px",
              textDecoration: "none", transition: "transform var(--dur) var(--ease)",
              background: accent ? "var(--accent)" : "#121212",
              border: accent ? "none" : "1px solid rgba(255,255,255,0.06)",
              boxShadow: accent ? "0 12px 36px rgba(26,255,110,0.2)" : "none" }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-3px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
            <span style={{ width: "42px", height: "42px", borderRadius: "13px",
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "18px",
              background: accent ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.05)",
              color: accent ? "#000" : "var(--accent)" }}>
              <Icon size={20} />
            </span>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 800,
              letterSpacing: "-0.03em", lineHeight: 1, marginBottom: "6px",
              color: accent ? "#000" : "var(--text)" }}>
              {value}
            </p>
            <p style={{ fontSize: "12px", fontWeight: 600,
              color: accent ? "rgba(0,0,0,0.6)" : "var(--text-3)" }}>
              {label}
            </p>
          </Link>
        ))}
      </div>

      {/* Middle row: actividad + pendientes */}
      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: "16px",
        marginBottom: "16px" }} className="dash-mid">
        <ActivityChart orders={orders} />
        <PendingPanel orders={orders} />
      </div>

      {/* Loyalty inline (si tiene puntos) */}
      {loyalty && loyalty.puntos_disponibles > 0 && loyalty.siguiente_nivel && (
        <Panel style={{ padding: "20px 24px", marginBottom: "16px", display: "flex",
          alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <span style={{ width: "40px", height: "40px", borderRadius: "50%",
              background: "rgba(26,255,110,0.1)", border: "1px solid rgba(26,255,110,0.25)",
              color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Star size={18} fill="var(--accent)" />
            </span>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>
                Nivel {loyalty.nivel} · {loyalty.puntos_disponibles.toLocaleString("es-CL")} pts
              </p>
              <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                Progreso a {loyalty.siguiente_nivel}
              </p>
            </div>
          </div>
          <div style={{ minWidth: "200px", flex: "0 1 240px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px",
              color: "var(--text-3)", marginBottom: "6px" }}>
              <span>{loyalty.progreso_nivel}%</span>
            </div>
            <div style={{ height: "6px", borderRadius: "3px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{ width: `${loyalty.progreso_nivel}%`, height: "100%",
                background: "var(--accent)", borderRadius: "3px", transition: "width 1s var(--ease)" }} />
            </div>
          </div>
        </Panel>
      )}

      {/* Tabla de pedidos */}
      <Panel style={{ overflow: "hidden" }} data-testid="dash-orders-table">
        <div style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between",
          alignItems: "center", flexWrap: "wrap", gap: "12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h2 style={panelTitle}>Mis pedidos</h2>
          <Link to="/dashboard/orders" style={{ display: "inline-flex", alignItems: "center", gap: "6px",
            fontSize: "13px", color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
            Ver todos <ChevronRight size={14} />
          </Link>
        </div>

        {isLoading ? (
          <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: "56px" }} />)}
          </div>
        ) : recent.length === 0 ? (
          <div style={{ padding: "56px 24px", textAlign: "center" }}>
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
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "620px" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  {["Pedido", "Productos", "Total", "Estado", "Fecha", ""].map((h, i) => (
                    <th key={i} style={{ padding: "12px 24px", fontSize: "11px", fontWeight: 700,
                      color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em",
                      borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((o, i) => (
                  <tr key={o.id} data-testid={`dash-order-row-${o.id}`}
                    style={{ borderBottom: i < recent.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
                    className="dash-row">
                    <td style={{ padding: "16px 24px" }}>
                      <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: 600,
                        color: "var(--text)" }}>#{o.id.slice(0, 8).toUpperCase()}</span>
                    </td>
                    <td style={{ padding: "16px 24px", fontSize: "13px", color: "var(--text-2)" }}>
                      {o.items_count} producto{o.items_count !== 1 ? "s" : ""}
                    </td>
                    <td style={{ padding: "16px 24px", fontSize: "14px", fontWeight: 700,
                      color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                      ${Number(o.total).toLocaleString("es-CL")}
                    </td>
                    <td style={{ padding: "16px 24px" }}><StatusBadge status={o.status} /></td>
                    <td style={{ padding: "16px 24px", fontSize: "13px", color: "var(--text-3)", whiteSpace: "nowrap" }}>
                      {new Date(o.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td style={{ padding: "16px 24px", textAlign: "right" }}>
                      <Link to={`/dashboard/orders/${o.id}`} style={{ color: "var(--text-3)",
                        display: "inline-flex", transition: "color var(--dur)" }}
                        onMouseEnter={e => e.currentTarget.style.color = "var(--accent)"}
                        onMouseLeave={e => e.currentTarget.style.color = "var(--text-3)"}>
                        <ChevronRight size={18} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <style>{`
        .dash-row { transition: background var(--dur) var(--ease); }
        .dash-row:hover { background: rgba(255,255,255,0.02); }
        @media (max-width: 1024px) {
          .dash-stats { grid-template-columns: repeat(2, 1fr) !important; }
          .dash-mid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 520px) {
          .dash-stats { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}
