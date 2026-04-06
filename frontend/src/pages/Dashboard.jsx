// pages/dashboard/Dashboard.jsx
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { useAuthStore } from "../store/authStore"
import { getOrders } from "../api/orders.api"
import { getEnrollments } from "../api/academy.api"
import { getServiceRequests } from "../api/services.api"
import { getMyLoyalty } from "../api/loyalty.api"

const statusConfig = {
  pending:   { label: "Pendiente",  color: "#facc15" },
  paid:      { label: "Pagado",     color: "#4ade80" },
  shipped:   { label: "Enviado",    color: "#60a5fa" },
  completed: { label: "Completado", color: "#4ade80" },
  cancelled: { label: "Cancelado",  color: "#f87171" },
}

const NIVEL_ICONS = {
  bronze:   "🥉", silver: "🥈", gold: "🥇", platinum: "💎"
}

function StatusBadge({ status }) {
  const c = statusConfig[status] || { label: status, color: "var(--text-3)" }
  return (
    <span style={{
      padding:    "2px 10px",
      borderRadius:"var(--r-full)",
      fontSize:   "11px",
      fontWeight: 500,
      color:      c.color,
      background: `${c.color}14`,
      border:     `1px solid ${c.color}30`,
    }}>
      {c.label}
    </span>
  )
}

export default function Dashboard() {
  const { user } = useAuthStore()

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["orders"], queryFn: getOrders,
  })
  const { data: enrollData } = useQuery({
    queryKey: ["enrollments"], queryFn: getEnrollments,
  })
  const { data: reqData } = useQuery({
    queryKey: ["service-requests"], queryFn: getServiceRequests,
  })
  const { data: loyalty } = useQuery({
    queryKey: ["my-loyalty"], queryFn: getMyLoyalty,
  })

  const orders      = ordersData?.results || ordersData || []
  const enrollCount = enrollData?.results?.length ?? enrollData?.length ?? 0
  const reqCount    = reqData?.results?.length    ?? reqData?.length    ?? 0
  const recent      = orders.slice(0, 5)

  return (
    <div style={{ padding: "clamp(32px, 5vw, 56px)", maxWidth: "900px" }}>

      {/* Header */}
      <div style={{ marginBottom: "48px" }}
        className="animate-fade-up">
        <p style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 600,
          letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>
          Mi cuenta
        </p>
        <h1 style={{ fontFamily: "var(--font-serif)",
          fontSize: "clamp(2rem, 5vw, 3.5rem)",
          fontWeight: 300, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
          Hola, {user?.first_name || "bienvenido"}.
        </h1>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)", gap: "12px",
        marginBottom: "40px" }}
        className="animate-fade-up delay-100 dashboard-stats"
      >
        {[
          { label: "Pedidos",   value: orders.length, to: "/dashboard/orders",   icon: "◫" },
          { label: "Cursos",    value: enrollCount,   to: "/dashboard/courses",  icon: "▷" },
          { label: "Servicios", value: reqCount,       to: "/dashboard/services", icon: "◈" },
        ].map(({ label, value, to, icon }) => (
          <Link key={label} to={to} style={{
            background:    "var(--surface)",
            border:        "1px solid var(--border)",
            borderRadius:  "var(--r-xl)",
            padding:       "24px",
            transition:    "all var(--dur-slow) var(--ease)",
            display:       "block",
          }}
            className="card card-glow"
          >
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "flex-start", marginBottom: "12px" }}>
              <span style={{ fontSize: "16px", color: "var(--text-3)" }}>{icon}</span>
              <span style={{ fontSize: "11px", color: "var(--text-3)",
                textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Ver todos →
              </span>
            </div>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: "2.8rem",
              lineHeight: 1, marginBottom: "6px", color: "var(--text)" }}>
              {value}
            </p>
            <p style={{ fontSize: "12px", color: "var(--text-3)",
              textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>
              {label}
            </p>
          </Link>
        ))}
      </div>

      {/* Loyalty widget inline */}
      {loyalty && loyalty.puntos_disponibles > 0 && (
        <div style={{
          background:   "var(--surface)",
          border:       "1px solid rgba(26,255,110,0.15)",
          borderRadius: "var(--r-xl)",
          padding:      "20px 24px",
          marginBottom: "32px",
          display:      "flex",
          alignItems:   "center",
          justifyContent:"space-between",
          flexWrap:     "wrap",
          gap:          "16px",
        }}
          className="animate-fade-up delay-200"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <span style={{ fontSize: "28px" }}>
              {NIVEL_ICONS[loyalty.nivel] || "⭐"}
            </span>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 500, marginBottom: "3px" }}>
                {loyalty.puntos_disponibles.toLocaleString("es-CL")} puntos disponibles
              </p>
              <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                Nivel {loyalty.nivel} · Valor: ${loyalty.valor_disponible?.toLocaleString("es-CL")}
              </p>
            </div>
          </div>
          {loyalty.siguiente_nivel && (
            <div style={{ minWidth: "180px" }}>
              <div style={{ display: "flex", justifyContent: "space-between",
                fontSize: "11px", color: "var(--text-3)", marginBottom: "6px" }}>
                <span>Progreso a {loyalty.siguiente_nivel}</span>
                <span style={{ color: "var(--accent)" }}>{loyalty.progreso_nivel}%</span>
              </div>
              <div style={{ height: "4px", borderRadius: "2px",
                background: "var(--surface-3)", overflow: "hidden" }}>
                <div style={{ width: `${loyalty.progreso_nivel}%`, height: "100%",
                  background: "var(--accent)", borderRadius: "2px",
                  transition: "width 1s var(--ease)" }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pedidos recientes */}
      <div className="animate-fade-up delay-300">
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 500 }}>Pedidos recientes</h2>
          <Link to="/dashboard/orders" style={{ fontSize: "13px",
            color: "var(--text-3)", transition: "color var(--dur)" }}
            className="hover-accent">
            Ver todos →
          </Link>
        </div>

        {isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "72px" }} />
            ))}
          </div>
        )}

        {!isLoading && recent.length === 0 && (
          <div style={{
            background:   "var(--surface)",
            border:       "1px solid var(--border)",
            borderRadius: "var(--r-xl)",
            padding:      "56px 32px",
            textAlign:    "center",
          }}>
            <p style={{ fontSize: "40px", marginBottom: "14px" }}>🛒</p>
            <h3 style={{ fontFamily: "var(--font-serif)", fontWeight: 300,
              fontSize: "1.5rem", marginBottom: "8px" }}>
              Sin pedidos todavía
            </h3>
            <p style={{ fontSize: "14px", color: "var(--text-3)", marginBottom: "24px" }}>
              Explorá la tienda y realizá tu primer pedido.
            </p>
            <Link to="/shop" className="btn btn-accent">Ir a la tienda →</Link>
          </div>
        )}

        {!isLoading && recent.length > 0 && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-xl)", overflow: "hidden" }}>
            {recent.map((order, i) => (
              <Link key={order.id} to={`/dashboard/orders/${order.id}`} style={{
                display:        "flex",
                alignItems:     "center",
                justifyContent: "space-between",
                padding:        "18px 24px",
                gap:            "16px",
                borderTop:      i > 0 ? "1px solid var(--border)" : "none",
                transition:     "background var(--dur) var(--ease)",
                textDecoration: "none",
              }}
                className="hover:bg-[var(--surface-2)]"
              >
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 500,
                    fontFamily: "monospace", marginBottom: "4px",
                    color: "var(--text)" }}>
                    #{order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                    {new Date(order.created_at).toLocaleDateString("es-CL", {
                      day: "numeric", month: "long", year: "numeric"
                    })}
                    {" · "}{order.items_count} producto{order.items_count !== 1 ? "s" : ""}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <StatusBadge status={order.status} />
                  <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.2rem",
                    color: "var(--text)" }}>
                    ${Number(order.total).toLocaleString("es-CL")}
                  </p>
                  <span style={{ color: "var(--text-3)" }}>›</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 600px) {
          .dashboard-stats { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}