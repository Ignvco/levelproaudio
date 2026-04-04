// pages/admin/AdminPayments.jsx

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getAdminPayments, updatePaymentStatus } from "../../api/admin.api"

const statusColors = {
  pending:  "#facc15",
  approved: "#4ade80",
  rejected: "#f87171",
  cancelled:"#888888",
  refunded: "#60a5fa",
}
const statusLabels = {
  pending:   "Pendiente",
  approved:  "Aprobado",
  rejected:  "Rechazado",
  cancelled: "Cancelado",
  refunded:  "Reembolsado",
}
const providerLabels = {
  mercadopago_cl: "MP Chile",
  mercadopago_ar: "MP Argentina",
  paypal:         "PayPal",
  global66:       "Global66",
  transfer:       "Transferencia",
  cash:           "Manual",
}

function Badge({ status }) {
  const color = statusColors[status] || "var(--text-3)"
  return (
    <span style={{
      padding: "2px 8px", borderRadius: "100px", fontSize: "11px",
      fontWeight: 500, color, background: `${color}14`,
      border: `1px solid ${color}30`, whiteSpace: "nowrap",
    }}>
      {statusLabels[status] || status}
    </span>
  )
}

// ── Selector inline de estado ────────────────────────────────
function StatusSelect({ paymentId, current }) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (newStatus) => updatePaymentStatus(paymentId, newStatus),
    onSuccess: (data) => {
      queryClient.invalidateQueries(["admin-payments"])
      queryClient.invalidateQueries(["admin-orders"])
      queryClient.invalidateQueries(["admin-finance-summary"])
      queryClient.invalidateQueries(["admin-dashboard"])
    },
  })

  return (
    <select
      value={current}
      onChange={e => {
        const newVal = e.target.value
        const label  = statusLabels[newVal]
        // Confirmación para acciones destructivas
        if (["rejected", "cancelled", "refunded"].includes(newVal)) {
          if (!window.confirm(`¿Cambiar a "${label}"? Esto afectará la orden y finanzas.`)) return
        }
        mutation.mutate(newVal)
      }}
      disabled={mutation.isPending}
      onClick={e => e.stopPropagation()}
      style={{
        padding: "5px 10px", borderRadius: "var(--r-sm)", fontSize: "12px",
        background: "var(--surface-2)", border: "1px solid var(--border)",
        color: "var(--text)", cursor: "pointer", outline: "none",
        opacity: mutation.isPending ? 0.5 : 1,
        minWidth: "130px",
      }}
    >
      {Object.entries(statusLabels).map(([val, label]) => (
        <option key={val} value={val}>{label}</option>
      ))}
    </select>
  )
}

export default function AdminPayments() {
  const [statusFilter, setStatusFilter] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["admin-payments", statusFilter],
    queryFn:  () => getAdminPayments({ ...(statusFilter && { status: statusFilter }) }),
  })

  const payments = data?.results || []

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>

      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)",
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px" }}>
          Pagos
        </h1>
        {data?.total_approved > 0 && (
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            Total aprobado:{" "}
            <span style={{ color: "var(--accent)", fontWeight: 500 }}>
              ${Number(data.total_approved).toLocaleString("es-CL")}
            </span>
          </p>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "20px", flexWrap: "wrap" }}>
        {["", ...Object.keys(statusLabels)].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: "6px 14px", borderRadius: "100px", fontSize: "12px",
            cursor: "pointer", transition: "all var(--dur) var(--ease)",
            background: statusFilter === s ? "var(--text)" : "transparent",
            color: statusFilter === s ? "var(--bg)" : "var(--text-2)",
            border: `1px solid ${statusFilter === s ? "var(--text)" : "var(--border)"}`,
          }}>
            {s ? statusLabels[s] : "Todos"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "52px" }} />
          ))}
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", overflow: "hidden" }}>

          {/* Header tabla */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.8fr 1fr 1fr 1fr 1.4fr",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            <span>Orden</span>
            <span>Email</span>
            <span>Proveedor</span>
            <span>Monto</span>
            <span>Estado</span>
            <span>Cambiar estado</span>
          </div>

          {payments.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px" }}>
              No hay pagos con este filtro.
            </div>
          ) : payments.map((p, i) => (
            <div key={p.id} style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.8fr 1fr 1fr 1fr 1.4fr",
              padding: "13px 20px", alignItems: "center",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              transition: "background var(--dur) var(--ease)",
              gap: "8px",
            }}
              className="hover:bg-[var(--surface-2)]"
            >
              <span style={{ fontSize: "12px", fontFamily: "monospace",
                color: "var(--text-2)" }}>
                #{p.order_id.slice(0, 8).toUpperCase()}
              </span>

              <span style={{ fontSize: "13px", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.order_email}
              </span>

              <span style={{ fontSize: "12px", color: "var(--text-2)" }}>
                {providerLabels[p.provider] || p.provider}
              </span>

              <span style={{ fontSize: "13px", fontWeight: 500 }}>
                ${Number(p.amount).toLocaleString("es-CL")}
              </span>

              <Badge status={p.status} />

              {/* ← Selector de estado con sync a orden y finanzas */}
              <StatusSelect paymentId={p.id} current={p.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}