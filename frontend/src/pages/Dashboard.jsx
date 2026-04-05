// pages/Dashboard.jsx

import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { useAuthStore } from "../store/authStore"
import { getOrders } from "../api/orders.api"
import { getEnrollments } from "../api/academy.api"
import { getServiceRequests } from "../api/services.api"
import LoyaltyWidget from "./dashboard/LoyaltyWidget"

const statusConfig = {
  pending: { label: "Pendiente", color: "#facc15" },
  paid: { label: "Pagado", color: "#4ade80" },
  shipped: { label: "Enviado", color: "#60a5fa" },
  completed: { label: "Completado", color: "#4ade80" },
  cancelled: { label: "Cancelado", color: "#f87171" },
}

function StatusBadge({ status }) {
  const c = statusConfig[status] || { label: status, color: "var(--text-3)" }
  return (
    <span style={{
      padding: "2px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: 500,
      color: c.color, background: `${c.color}14`, border: `1px solid ${c.color}30`,
    }}>
      {c.label}
    </span>
  )
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const { data, isLoading } = useQuery({ queryKey: ["orders"], queryFn: getOrders })
  const orders = data?.results || data || []
  const recent = orders.slice(0, 5)

  const { data: enrollData } = useQuery({
    queryKey: ["enrollments"],
    queryFn: getEnrollments,
  })
  const { data: reqData } = useQuery({
    queryKey: ["service-requests"],
    queryFn: getServiceRequests,
  })

  const enrollCount = enrollData?.results?.length || enrollData?.length || 0
  const reqCount = reqData?.results?.length || reqData?.length || 0


  return (
    <div style={{ padding: "clamp(32px, 5vw, 56px)", maxWidth: "880px" }}>

      {/* Header */}
      <div style={{ marginBottom: "40px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2rem, 4vw, 2.8rem)", marginBottom: "6px" }}>
          Hola, {user?.first_name || "bienvenido"}.
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-3)" }}>
          Bienvenido a tu área personal de LevelPro Audio.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: "48px" }}>
        {[
          { label: "Pedidos", value: orders.length, to: "/dashboard/orders" },
          { label: "Cursos", value: enrollCount, to: "/dashboard/courses" },  
          { label: "Servicios", value: reqCount, to: "/dashboard/services" }, 
        ]
          .map(({ label, value, to }) => (
            <Link key={label} to={to} style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)", padding: "20px 24px",
              transition: "all var(--dur) var(--ease)",
              display: "block",
            }}
              className="hover:border-[var(--border-hover)] hover:-translate-y-0.5"
            >
              <p style={{ fontFamily: "var(--font-serif)", fontSize: "2.2rem", lineHeight: 1, marginBottom: "6px" }}>
                {value}
              </p>
              <p style={{
                fontSize: "12px", color: "var(--text-3)", textTransform: "uppercase",
                letterSpacing: "0.06em", fontWeight: 500
              }}>
                {label}
              </p>
            </Link>
          ))}
      </div>

      {/* Pedidos recientes */}
      <div>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: "20px"
        }}>
          <h2 style={{ fontSize: "16px", fontWeight: 500 }}>Pedidos recientes</h2>
          <Link to="/dashboard/orders" style={{
            fontSize: "13px", color: "var(--text-3)",
            transition: "color var(--dur)"
          }} className="hover:text-white">
            Ver todos →
          </Link>
        </div>

        {isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "64px" }} />
            ))}
          </div>
        )}

        {!isLoading && recent.length === 0 && (
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)", padding: "48px", textAlign: "center",
          }}>
            <p style={{ fontSize: "32px", marginBottom: "12px" }}>🛒</p>
            <p style={{ fontSize: "15px", fontWeight: 500, marginBottom: "8px" }}>Sin pedidos todavía</p>
            <p style={{ fontSize: "13px", color: "var(--text-3)", marginBottom: "24px" }}>
              Explora la tienda y haz tu primer pedido.
            </p>
            <Link to="/shop" className="btn btn-accent" style={{ padding: "10px 24px" }}>
              Ir a la tienda
            </Link>
          </div>
        )}

        {!isLoading && recent.length > 0 && (
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)", overflow: "hidden"
          }}>
            {recent.map((order, i) => (
              <Link key={order.id} to={`/dashboard/orders/${order.id}`}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 20px", gap: "16px",
                  borderTop: i > 0 ? "1px solid var(--border)" : "none",
                  transition: "background var(--dur) var(--ease)",
                }}
                className="hover:bg-[var(--surface-2)]"
              >
                <div>
                  <p style={{
                    fontSize: "13px", fontWeight: 500, fontVariantNumeric: "tabular-nums",
                    fontFamily: "monospace", marginBottom: "3px"
                  }}>
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
                  <span style={{ fontSize: "14px", fontWeight: 500, whiteSpace: "nowrap" }}>
                    ${Number(order.total).toLocaleString("es-CL")}
                  </span>
                  <span style={{ color: "var(--text-3)", fontSize: "14px" }}>›</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <LoyaltyWidget />
    </div>
  )
}