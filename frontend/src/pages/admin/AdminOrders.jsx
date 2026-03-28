// pages/admin/AdminOrders.jsx

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getAdminOrders, updateOrderStatus } from "../../api/admin.api"

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
const allStatuses = Object.keys(statusLabels)

function Badge({ status }) {
  const color = statusColors[status] || "var(--text-3)"
  return (
    <span style={{ padding: "2px 8px", borderRadius: "100px", fontSize: "11px",
      fontWeight: 500, color, background: `${color}14`, border: `1px solid ${color}30` }}>
      {statusLabels[status] || status}
    </span>
  )
}

function StatusSelect({ orderId, currentStatus }) {
  const queryClient = useQueryClient()
  const mutation    = useMutation({
    mutationFn: (s) => updateOrderStatus(orderId, s),
    onSuccess:  () => queryClient.invalidateQueries(["admin-orders"]),
  })

  return (
    <select
      value={currentStatus}
      onChange={e => mutation.mutate(e.target.value)}
      disabled={mutation.isPending}
      style={{
        padding: "5px 10px", borderRadius: "var(--r-sm)", fontSize: "12px",
        background: "var(--surface-2)", border: "1px solid var(--border)",
        color: "var(--text)", cursor: "pointer", outline: "none",
        opacity: mutation.isPending ? 0.5 : 1,
      }}
    >
      {allStatuses.map(s => (
        <option key={s} value={s}>{statusLabels[s]}</option>
      ))}
    </select>
  )
}

export default function AdminOrders() {
  const [statusFilter, setStatusFilter] = useState("")
  const [search, setSearch]             = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", statusFilter, search],
    queryFn:  () => getAdminOrders({
      ...(statusFilter && { status: statusFilter }),
      ...(search && { search }),
    }),
  })

  const orders = data?.results || []

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>

      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)",
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px" }}>
          Órdenes
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
          {data?.count || 0} pedidos totales
        </p>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        <input
          placeholder="Buscar por email o ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input"
          style={{ maxWidth: "280px" }}
        />
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {["", ...allStatuses].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: "7px 14px", borderRadius: "100px", fontSize: "12px",
              cursor: "pointer", transition: "all var(--dur) var(--ease)",
              background: statusFilter === s ? "var(--text)" : "transparent",
              color: statusFilter === s ? "var(--bg)" : "var(--text-2)",
              border: `1px solid ${statusFilter === s ? "var(--text)" : "var(--border)"}`,
            }}>
              {s ? statusLabels[s] : "Todos"}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: "56px" }} />)}
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", overflow: "hidden" }}>
          {/* Header tabla */}
          <div style={{ display: "grid",
            gridTemplateColumns: "1.5fr 2fr 1fr 1fr 1fr 1.2fr",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>ID</span>
            <span>Email</span>
            <span>Total</span>
            <span>Items</span>
            <span>Estado</span>
            <span>Cambiar estado</span>
          </div>

          {orders.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-3)",
              fontSize: "14px" }}>
              No hay órdenes con estos filtros.
            </div>
          ) : orders.map((order, i) => (
            <div key={order.id} style={{
              display: "grid",
              gridTemplateColumns: "1.5fr 2fr 1fr 1fr 1fr 1.2fr",
              padding: "13px 20px", alignItems: "center", gap: "8px",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              transition: "background var(--dur) var(--ease)",
            }}
              className="hover:bg-[var(--surface-2)]"
            >
              <span style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--text-2)" }}>
                #{order.id.slice(0, 8).toUpperCase()}
              </span>
              <span style={{ fontSize: "13px", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {order.email}
              </span>
              <span style={{ fontSize: "13px", fontWeight: 500 }}>
                ${Number(order.total).toLocaleString("es-CL")}
              </span>
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {order.items_count} items
              </span>
              <Badge status={order.status} />
              <StatusSelect orderId={order.id} currentStatus={order.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}