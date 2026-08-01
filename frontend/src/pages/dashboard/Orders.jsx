// pages/dashboard/Orders.jsx
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { ChevronRight, ShoppingBag } from "lucide-react"
import { getOrders } from "../../api/orders.api"

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
    <span style={{ padding: "4px 12px", borderRadius: "var(--r-full)", fontSize: "11px",
      fontWeight: 600, color: c.color, background: `${c.color}18`,
      border: `1px solid ${c.color}33`, whiteSpace: "nowrap" }}>
      {c.label}
    </span>
  )
}

export default function Orders() {
  const { data, isLoading } = useQuery({ queryKey: ["orders"], queryFn: getOrders })
  const orders = data?.results || data || []

  return (
    <div style={{ padding: "clamp(20px, 3vw, 40px) clamp(20px, 4vw, 48px)" }} data-testid="orders-page">
      <div style={{ marginBottom: "24px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)",
          textTransform: "uppercase", letterSpacing: "0.15em" }}>· Mi cuenta</p>
        <h1 className="display-bold" style={{ fontFamily: "var(--font-display)",
          fontSize: "clamp(1.8rem, 3.4vw, 2.6rem)", fontWeight: 800, letterSpacing: "-0.03em",
          marginTop: "10px", color: "var(--text)" }}>
          Mis pedidos
        </h1>
      </div>

      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: "64px" }} />)}
        </div>
      )}

      {!isLoading && orders.length === 0 && (
        <div style={{ background: "#fff", border: "1px solid var(--border)",
          borderRadius: "24px", padding: "64px 32px", textAlign: "center" }}>
          <div style={{ width: "68px", height: "68px", borderRadius: "50%",
            background: "rgba(26,255,110,0.08)", border: "1px solid rgba(26,255,110,0.2)",
            color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 18px" }}><ShoppingBag size={30} /></div>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.5rem",
            letterSpacing: "-0.02em", marginBottom: "8px", color: "var(--text)" }}>
            Sin pedidos todavía
          </h3>
          <p style={{ fontSize: "14px", color: "var(--text-3)", marginBottom: "26px" }}>
            Explorá la tienda y realizá tu primer pedido.
          </p>
          <Link to="/shop" style={{ display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "13px 24px", borderRadius: "var(--r-full)", background: "var(--accent)",
            color: "#000", fontWeight: 700, fontSize: "14px", textDecoration: "none" }}>
            Ir a la tienda <ChevronRight size={15} />
          </Link>
        </div>
      )}

      {!isLoading && orders.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid var(--border)",
          borderRadius: "24px", overflow: "hidden", boxShadow: "var(--card-shadow)" }} data-testid="orders-table">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "620px" }}>
              <thead>
                <tr>
                  {["Pedido", "Productos", "Total", "Estado", "Fecha", ""].map((h, i) => (
                    <th key={i} style={{ padding: "14px 24px", textAlign: "left", fontSize: "11px",
                      fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase",
                      letterSpacing: "0.08em", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr key={o.id} data-testid={`order-row-${o.id}`} className="dash-row"
                    style={{ borderBottom: i < orders.length - 1 ? "1px solid var(--border)" : "none" }}>
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
                      <Link to={`/dashboard/orders/${o.id}`} data-testid={`order-view-${o.id}`}
                        style={{ color: "var(--text-3)", display: "inline-flex", transition: "color var(--dur)" }}
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
        </div>
      )}

      <style>{`
        .dash-row { transition: background var(--dur) var(--ease); }
        .dash-row:nth-child(even) { background: rgba(20,30,24,0.022); }
        .dash-row:hover { background: var(--accent-dim); box-shadow: inset 3px 0 0 var(--accent); }
      `}</style>
    </div>
  )
}
