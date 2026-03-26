// pages/Dashboard.jsx
// Pantalla principal del área privada
// Muestra resumen: pedidos recientes, cursos activos

import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { useAuthStore } from "../store/authStore"
import { getOrders } from "../api/orders.api"

// ── Stat card ────────────────────────────────────────────────
function StatCard({ label, value, icon, to }) {
  const content = (
    <div
      className="rounded-2xl p-5 flex items-center gap-4 transition-all hover:scale-[1.02]"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
        style={{ backgroundColor: "rgba(0,230,118,0.1)" }}
      >
        {icon}
      </div>
      <div>
        <p className="text-2xl font-black">{value}</p>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          {label}
        </p>
      </div>
    </div>
  )

  return to ? <Link to={to}>{content}</Link> : content
}

// ── Status badge ─────────────────────────────────────────────
const statusConfig = {
  pending:   { label: "Pendiente",  color: "#f59e0b" },
  paid:      { label: "Pagado",     color: "#00e676" },
  shipped:   { label: "Enviado",    color: "#3b82f6" },
  completed: { label: "Completado", color: "#00e676" },
  cancelled: { label: "Cancelado",  color: "#ff4444" },
}

function StatusBadge({ status }) {
  const config = statusConfig[status] || { label: status, color: "#888" }
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{
        color: config.color,
        backgroundColor: `${config.color}18`,
      }}
    >
      {config.label}
    </span>
  )
}

// ── Dashboard page ───────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuthStore()

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
  })

  const orders = ordersData?.results || ordersData || []
  const recentOrders = orders.slice(0, 5)

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black">
          Hola, {user?.first_name || "bienvenido"} 👋
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Bienvenido a tu área personal de LevelPro Audio.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <StatCard
          icon="📦"
          label="Pedidos totales"
          value={orders.length}
          to="/dashboard/orders"
        />
        <StatCard
          icon="🎓"
          label="Cursos activos"
          value={0}
          to="/dashboard/courses"
        />
        <StatCard
          icon="🎧"
          label="Servicios contratados"
          value={0}
        />
      </div>

      {/* Pedidos recientes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Pedidos recientes</h2>
          <Link
            to="/dashboard/orders"
            className="text-sm font-medium"
            style={{ color: "var(--color-accent)" }}
          >
            Ver todos →
          </Link>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-xl animate-pulse"
                style={{ backgroundColor: "var(--color-surface)" }}
              />
            ))}
          </div>
        )}

        {!isLoading && recentOrders.length === 0 && (
          <div
            className="rounded-2xl p-10 text-center"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <p className="text-4xl mb-3">🛒</p>
            <p className="font-semibold mb-1">Sin pedidos todavía</p>
            <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
              Explora la tienda y haz tu primer pedido.
            </p>
            <Link
              to="/shop"
              className="inline-block px-5 py-2 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
            >
              Ir a la tienda
            </Link>
          </div>
        )}

        {!isLoading && recentOrders.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              border: "1px solid var(--color-border)",
            }}
          >
            {recentOrders.map((order, i) => (
              <Link
                key={order.id}
                to={`/dashboard/orders/${order.id}`}
                className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-white/5"
                style={{
                  borderTop: i > 0 ? "1px solid var(--color-border)" : "none",
                }}
              >
                <div>
                  <p className="text-sm font-semibold font-mono">
                    #{order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    {new Date(order.created_at).toLocaleDateString("es-CL", {
                      day: "numeric", month: "long", year: "numeric"
                    })}
                    {" · "}{order.items_count} producto{order.items_count !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge status={order.status} />
                  <span className="font-bold text-sm" style={{ color: "var(--color-accent)" }}>
                    ${Number(order.total).toLocaleString("es-CL")}
                  </span>
                  <svg
                    className="w-4 h-4"
                    style={{ color: "var(--color-text-muted)" }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}