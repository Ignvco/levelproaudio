// pages/admin/AdminDashboard.jsx

import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { getAdminDashboard } from "../../api/admin.api"

// ── Mini chart bars ──────────────────────────────────────────
function SparkBar({ data }) {
  if (!data?.length) return null
  const max = Math.max(...data.map(d => d.total), 1)

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "48px" }}>
      {data.slice(-30).map((d, i) => (
        <div key={i} style={{
          flex: 1, borderRadius: "2px",
          background: `rgba(26,255,110,${0.15 + (d.total / max) * 0.85})`,
          height: `${Math.max(4, (d.total / max) * 48)}px`,
          transition: "height 0.3s ease",
          cursor: "default",
        }} title={`${d.date}: $${Number(d.total).toLocaleString("es-CL")}`} />
      ))}
    </div>
  )
}

// ── Stat card ────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, to }) {
  const content = (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-lg)", padding: "20px 22px",
      transition: "all var(--dur) var(--ease)",
    }}
      className="hover:border-[var(--border-hover)] hover:-translate-y-0.5"
    >
      <p style={{ fontSize: "11px", color: "var(--text-3)", textTransform: "uppercase",
        letterSpacing: "0.08em", fontWeight: 500, marginBottom: "10px" }}>
        {label}
      </p>
      <p style={{ fontFamily: "var(--font-serif)", fontSize: "2rem",
        lineHeight: 1, color: accent ? "var(--accent)" : "var(--text)", marginBottom: "6px" }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: "12px", color: "var(--text-3)" }}>{sub}</p>}
    </div>
  )
  return to ? <Link to={to} style={{ display: "block" }}>{content}</Link> : content
}

// ── Status badge ─────────────────────────────────────────────
const statusColors = {
  pending:   "#facc15",
  paid:      "#4ade80",
  shipped:   "#60a5fa",
  completed: "#4ade80",
  cancelled: "#f87171",
}
const statusLabels = {
  pending: "Pendiente", paid: "Pagado", shipped: "Enviado",
  completed: "Completado", cancelled: "Cancelado",
}

function Badge({ status }) {
  const color = statusColors[status] || "var(--text-3)"
  return (
    <span style={{
      padding: "2px 8px", borderRadius: "100px", fontSize: "11px", fontWeight: 500,
      color, background: `${color}14`, border: `1px solid ${color}30`,
    }}>
      {statusLabels[status] || status}
    </span>
  )
}

// ── AdminDashboard ───────────────────────────────────────────
export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn:  getAdminDashboard,
    refetchInterval: 60000,
  })

  if (isLoading) return (
    <div style={{ padding: "40px", display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
      {[...Array(8)].map((_, i) => (
        <div key={i} className="skeleton" style={{ height: "100px" }} />
      ))}
    </div>
  )

  const { revenue, orders, users, products, academy, sales_chart, top_products, recent_orders } = data

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)", maxWidth: "1200px" }}>

      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)",
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px" }}>
          Dashboard
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
          Visión general del negocio en tiempo real.
        </p>
      </div>

      {/* Stats principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" style={{ marginBottom: "24px" }}>
        <StatCard
          label="Ingresos totales"
          value={`$${Number(revenue.total).toLocaleString("es-CL")}`}
          sub={`Este mes: $${Number(revenue.this_month).toLocaleString("es-CL")}`}
          accent
          to="/admin/payments"
        />
        <StatCard
          label="Pedidos totales"
          value={orders.total}
          sub={`${orders.pending} pendientes · ${orders.today} hoy`}
          to="/admin/orders"
        />
        <StatCard
          label="Usuarios"
          value={users.total}
          sub={`${users.new_week} nuevos esta semana`}
          to="/admin/users"
        />
        <StatCard
          label="Productos activos"
          value={products.total}
          sub={`${products.out_of_stock} sin stock · ${products.low_stock} bajo stock`}
          to="/admin/products"
        />
      </div>

      {/* Segunda fila */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" style={{ marginBottom: "32px" }}>
        <StatCard
          label="Ingresos últimos 30 días"
          value={`$${Number(revenue.last_30_days).toLocaleString("es-CL")}`}
        />
        <StatCard
          label="Pedidos este mes"
          value={orders.this_month}
        />
        <StatCard
          label="Inscripciones academia"
          value={academy.total_enrollments}
          sub={`${academy.enrollments_month} este mes`}
          to="/admin/academy"
        />
        <StatCard
          label="Nuevos usuarios (mes)"
          value={users.new_month}
        />
      </div>

      {/* Gráfico + Top productos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" style={{ marginBottom: "32px" }}>

        {/* Gráfico ventas */}
        <div style={{
          gridColumn: "span 2",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", padding: "24px",
        }}
          className="lg:col-span-2"
        >
          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "flex-start", marginBottom: "20px" }}>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 500, marginBottom: "4px" }}>
                Ventas — últimos 30 días
              </p>
              <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem",
                color: "var(--accent)", lineHeight: 1 }}>
                ${Number(revenue.last_30_days).toLocaleString("es-CL")}
              </p>
            </div>
          </div>
          <SparkBar data={sales_chart} />
          <div style={{ display: "flex", justifyContent: "space-between",
            marginTop: "8px", fontSize: "11px", color: "var(--text-3)" }}>
            <span>Hace 30 días</span>
            <span>Hoy</span>
          </div>
        </div>

        {/* Top productos */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", padding: "24px",
        }}>
          <p style={{ fontSize: "13px", fontWeight: 500, marginBottom: "16px" }}>
            Productos más vendidos
          </p>
          {top_products.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--text-3)" }}>Sin datos todavía.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {top_products.map((p, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px",
                    minWidth: 0 }}>
                    <span style={{ fontSize: "11px", color: "var(--text-3)",
                      width: "16px", flexShrink: 0 }}>{i + 1}</span>
                    <p style={{ fontSize: "13px", overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.product_name}
                    </p>
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--text-3)",
                    flexShrink: 0 }}>
                    ×{p.total_sold}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Últimas órdenes */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)", overflow: "hidden",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", padding: "16px 20px",
          borderBottom: "1px solid var(--border)" }}>
          <p style={{ fontSize: "13px", fontWeight: 500 }}>Últimas órdenes</p>
          <Link to="/admin/orders" style={{ fontSize: "12px", color: "var(--text-3)",
            transition: "color var(--dur)" }} className="hover:text-white">
            Ver todas →
          </Link>
        </div>
        {recent_orders.map((o, i) => (
          <div key={o.id} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "13px 20px", gap: "12px", flexWrap: "wrap",
            borderTop: i > 0 ? "1px solid var(--border)" : "none",
            transition: "background var(--dur) var(--ease)",
          }}
            className="hover:bg-[var(--surface-2)]"
          >
            <div>
              <p style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: 500 }}>
                #{o.id.slice(0, 8).toUpperCase()}
              </p>
              <p style={{ fontSize: "11px", color: "var(--text-3)" }}>{o.email}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "11px", color: "var(--text-3)" }}>{o.created}</span>
              <Badge status={o.status} />
              <span style={{ fontSize: "14px", fontWeight: 500 }}>
                ${Number(o.total).toLocaleString("es-CL")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}