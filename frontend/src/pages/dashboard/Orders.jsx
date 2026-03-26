// pages/dashboard/Orders.jsx
// Historial completo de pedidos del usuario

import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { getOrders } from "../../api/orders.api"

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

export default function Orders() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
  })

  const orders = data?.results || data || []

  return (
    <div className="p-8 max-w-4xl mx-auto">

      <h1 className="text-3xl font-black mb-8">Mis pedidos</h1>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-2xl animate-pulse"
              style={{ backgroundColor: "var(--color-surface)" }}
            />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <p className="text-sm" style={{ color: "var(--color-danger)" }}>
          Error al cargar los pedidos.
        </p>
      )}

      {/* Sin pedidos */}
      {!isLoading && !isError && orders.length === 0 && (
        <div
          className="rounded-2xl p-12 text-center"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <p className="text-5xl mb-4">📦</p>
          <p className="font-bold text-lg mb-2">Sin pedidos todavía</p>
          <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
            Cuando realices una compra, aparecerá aquí.
          </p>
          <Link
            to="/shop"
            className="inline-block px-6 py-2.5 rounded-lg font-semibold text-sm"
            style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
          >
            Explorar tienda
          </Link>
        </div>
      )}

      {/* Lista de pedidos */}
      {!isLoading && !isError && orders.length > 0 && (
        <div className="space-y-3">
          {orders.map(order => (
            <Link
              key={order.id}
              to={`/dashboard/orders/${order.id}`}
              className="block rounded-2xl p-5 transition-all hover:scale-[1.01]"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="flex items-start justify-between gap-4">

                {/* Info principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="font-bold font-mono text-sm">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </span>
                    <StatusBadge status={order.status} />
                  </div>

                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {new Date(order.created_at).toLocaleDateString("es-CL", {
                      weekday: "long", day: "numeric",
                      month: "long", year: "numeric"
                    })}
                  </p>

                  {/* Items del pedido */}
                  <div className="mt-3 space-y-1">
                    {order.items?.slice(0, 2).map((item, i) => (
                      <p key={i} className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {item.product_name} × {item.quantity}
                      </p>
                    ))}
                    {order.items?.length > 2 && (
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        +{order.items.length - 2} producto{order.items.length - 2 !== 1 ? "s" : ""} más
                      </p>
                    )}
                  </div>
                </div>

                {/* Total + flecha */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <p className="font-black text-lg" style={{ color: "var(--color-accent)" }}>
                    ${Number(order.total).toLocaleString("es-CL")}
                  </p>
                  <svg
                    className="w-4 h-4"
                    style={{ color: "var(--color-text-muted)" }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}