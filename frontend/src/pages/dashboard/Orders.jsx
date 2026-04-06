// pages/dashboard/Orders.jsx
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { getOrders } from "../../api/orders.api"

const statusConfig = {
  pending:   { label: "Pendiente",  color: "#facc15" },
  paid:      { label: "Pagado",     color: "#4ade80" },
  shipped:   { label: "Enviado",    color: "#60a5fa" },
  completed: { label: "Completado", color: "#4ade80" },
  cancelled: { label: "Cancelado",  color: "#f87171" },
}

export default function Orders() {
  const { data, isLoading } = useQuery({
    queryKey: ["orders"], queryFn: getOrders,
  })
  const orders = data?.results || data || []

  return (
    <div style={{ padding: "clamp(32px, 5vw, 56px)", maxWidth: "800px" }}>
      <div style={{ marginBottom: "32px" }}>
        <p style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 600,
          letterSpacing: "0.08em", textTransform: "uppercase",
          marginBottom: "8px" }}>
          Mi cuenta
        </p>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2rem, 4vw, 3rem)",
          fontWeight: 300, letterSpacing: "-0.02em" }}>
          Mis pedidos
        </h1>
      </div>

      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "80px" }} />
          ))}
        </div>
      )}

      {!isLoading && orders.length === 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-2xl)", padding: "64px 32px", textAlign: "center" }}>
          <p style={{ fontSize: "48px", marginBottom: "16px" }}>📦</p>
          <h3 style={{ fontFamily: "var(--font-serif)", fontWeight: 300,
            fontSize: "1.6rem", marginBottom: "8px" }}>
            Sin pedidos todavía
          </h3>
          <p style={{ fontSize: "14px", color: "var(--text-3)", marginBottom: "28px" }}>
            Explorá la tienda y realizá tu primer pedido.
          </p>
          <Link to="/shop" className="btn btn-accent">Ir a la tienda →</Link>
        </div>
      )}

      {!isLoading && orders.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-2xl)", overflow: "hidden" }}>
          {orders.map((order, i) => {
            const s = statusConfig[order.status] || { label: order.status, color: "#888" }
            return (
              <Link key={order.id} to={`/dashboard/orders/${order.id}`} style={{
                display:        "flex",
                alignItems:     "center",
                justifyContent: "space-between",
                padding:        "20px 24px",
                gap:            "16px",
                borderTop:      i > 0 ? "1px solid var(--border)" : "none",
                transition:     "background var(--dur) var(--ease)",
                textDecoration: "none",
              }}
                className="hover:bg-[var(--surface-2)]"
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  {/* Status indicator */}
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%",
                    background: s.color, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 500,
                      fontFamily: "monospace", color: "var(--text)",
                      marginBottom: "4px" }}>
                      #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                      {new Date(order.created_at).toLocaleDateString("es-CL", {
                        day: "numeric", month: "short", year: "numeric"
                      })}
                      {" · "}{order.items_count} producto{order.items_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <span style={{
                    padding: "3px 10px", borderRadius: "var(--r-full)",
                    fontSize: "11px", fontWeight: 500,
                    color: s.color, background: `${s.color}14`,
                    border: `1px solid ${s.color}30`,
                  }}>
                    {s.label}
                  </span>
                  <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.2rem",
                    color: "var(--text)", whiteSpace: "nowrap" }}>
                    ${Number(order.total).toLocaleString("es-CL")}
                  </p>
                  <span style={{ color: "var(--text-3)", fontSize: "16px" }}>›</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}