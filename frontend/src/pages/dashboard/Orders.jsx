// pages/dashboard/Orders.jsx

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { getOrders } from "../../api/orders.api"
import api from "../../api/client"

const statusConfig = {
  pending:   { label: "Pendiente",  color: "#facc15" },
  paid:      { label: "Pagado",     color: "#4ade80" },
  shipped:   { label: "Enviado",    color: "#60a5fa" },
  completed: { label: "Completado", color: "#4ade80" },
  cancelled: { label: "Cancelado",  color: "#f87171" },
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

export default function Orders() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["orders"], queryFn: getOrders })
  const queryClient = useQueryClient()
  const orders = data?.results || data || []

  const cancelMutation = useMutation({
    mutationFn: (id) => api.delete(`/orders/${id}/`),
    onSuccess: () => queryClient.invalidateQueries(["orders"]),
  })

  return (
    <div style={{ padding: "clamp(32px, 5vw, 56px)", maxWidth: "720px" }}>
      <h1 style={{ fontFamily: "var(--font-serif)",
        fontSize: "clamp(2rem, 4vw, 2.8rem)", marginBottom: "40px" }}>
        Mis pedidos
      </h1>

      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "96px" }} />
          ))}
        </div>
      )}

      {isError && (
        <p style={{ color: "var(--danger)", fontSize: "14px" }}>
          Error al cargar los pedidos.
        </p>
      )}

      {!isLoading && !isError && orders.length === 0 && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)", padding: "64px", textAlign: "center",
        }}>
          <p style={{ fontSize: "40px", marginBottom: "16px" }}>📦</p>
          <p style={{ fontSize: "16px", fontWeight: 500, marginBottom: "8px" }}>
            Sin pedidos todavía
          </p>
          <p style={{ fontSize: "14px", color: "var(--text-3)", marginBottom: "28px" }}>
            Cuando realices una compra, aparecerá aquí.
          </p>
          <Link to="/shop" className="btn btn-accent">Explorar tienda</Link>
        </div>
      )}

      {!isLoading && !isError && orders.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {orders.map(order => (
            <div key={order.id} style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)", overflow: "hidden",
              transition: "all var(--dur) var(--ease)",
            }}>
              {/* Fila principal — clickeable */}
              <Link to={`/dashboard/orders/${order.id}`} style={{
                display: "flex", alignItems: "center", gap: "16px",
                padding: "18px 20px",
                transition: "background var(--dur) var(--ease)",
              }}
                className="hover:bg-[var(--surface-2)] block"
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center",
                    gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "13px", fontWeight: 500,
                      fontFamily: "monospace" }}>
                      #{order.id.slice(0, 8).toUpperCase()}
                    </span>
                    <StatusBadge status={order.status} />
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                    {new Date(order.created_at).toLocaleDateString("es-CL", {
                      weekday: "long", day: "numeric",
                      month: "long", year: "numeric",
                    })}
                  </p>
                  <div style={{ marginTop: "6px" }}>
                    {order.items?.slice(0, 2).map((item, i) => (
                      <p key={i} style={{ fontSize: "12px", color: "var(--text-3)" }}>
                        {item.product_name} ×{item.quantity}
                      </p>
                    ))}
                    {order.items?.length > 2 && (
                      <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                        +{order.items.length - 2} más
                      </p>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column",
                  alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
                  <span style={{ fontSize: "16px", fontWeight: 500 }}>
                    ${Number(order.total).toLocaleString("es-CL")}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--text-3)" }}>›</span>
                </div>
              </Link>

              {/* Acciones — solo si está pendiente */}
              {order.status === "pending" && (
                <div style={{
                  padding: "12px 20px",
                  borderTop: "1px solid var(--border)",
                  display: "flex", gap: "10px", alignItems: "center",
                  background: "var(--surface-2)",
                }}>
                  <Link
                    to={`/dashboard/orders/${order.id}`}
                    className="btn btn-accent"
                    style={{ padding: "8px 16px", fontSize: "12px" }}
                  >
                    Completar pago →
                  </Link>
                  <button
                    onClick={() => {
                      if (window.confirm("¿Cancelar este pedido?")) {
                        cancelMutation.mutate(order.id)
                      }
                    }}
                    disabled={cancelMutation.isPending}
                    style={{
                      padding: "8px 16px", borderRadius: "100px",
                      fontSize: "12px", cursor: "pointer",
                      background: "rgba(255,59,59,0.08)",
                      border: "1px solid rgba(255,59,59,0.2)",
                      color: "var(--danger)",
                      transition: "all var(--dur) var(--ease)",
                      opacity: cancelMutation.isPending ? 0.5 : 1,
                    }}
                  >
                    Cancelar pedido
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}