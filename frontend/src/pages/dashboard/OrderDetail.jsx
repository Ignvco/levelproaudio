// pages/dashboard/OrderDetail.jsx
// Detalle completo de un pedido específico

import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getOrder } from "../../api/orders.api"

const statusConfig = {
  pending:   { label: "Pendiente",  color: "#f59e0b", step: 1 },
  paid:      { label: "Pagado",     color: "#00e676", step: 2 },
  shipped:   { label: "Enviado",    color: "#3b82f6", step: 3 },
  completed: { label: "Completado", color: "#00e676", step: 4 },
  cancelled: { label: "Cancelado",  color: "#ff4444", step: 0 },
}

// ── Timeline del estado del pedido ───────────────────────────
function OrderTimeline({ status }) {
  if (status === "cancelled") {
    return (
      <div
        className="p-4 rounded-xl text-sm"
        style={{
          backgroundColor: "rgba(255,68,68,0.1)",
          border: "1px solid var(--color-danger)",
          color: "var(--color-danger)",
        }}
      >
        Este pedido fue cancelado.
      </div>
    )
  }

  const steps = ["Pendiente", "Pagado", "Enviado", "Completado"]
  const currentStep = statusConfig[status]?.step || 1

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
              style={{
                backgroundColor: i + 1 <= currentStep
                  ? "var(--color-accent)"
                  : "var(--color-surface-2)",
                color: i + 1 <= currentStep ? "#000" : "var(--color-text-muted)",
              }}
            >
              {i + 1 <= currentStep ? "✓" : i + 1}
            </div>
            <span
              className="text-xs mt-1 whitespace-nowrap"
              style={{
                color: i + 1 <= currentStep
                  ? "var(--color-text)"
                  : "var(--color-text-muted)",
              }}
            >
              {step}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className="flex-1 h-0.5 mx-1 mb-5 transition-colors"
              style={{
                backgroundColor: i + 1 < currentStep
                  ? "var(--color-accent)"
                  : "var(--color-border)",
              }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export default function OrderDetail() {
  const { id } = useParams()

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(id),
  })

  if (isLoading) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-2xl animate-pulse"
            style={{ backgroundColor: "var(--color-surface)" }}
          />
        ))}
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="p-8 text-center">
        <p style={{ color: "var(--color-text-muted)" }}>Pedido no encontrado.</p>
        <Link
          to="/dashboard/orders"
          className="mt-4 inline-block text-sm"
          style={{ color: "var(--color-accent)" }}
        >
          ← Volver a mis pedidos
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          to="/dashboard/orders"
          className="text-sm transition-colors"
          style={{ color: "var(--color-text-muted)" }}
        >
          ← Mis pedidos
        </Link>
        <span style={{ color: "var(--color-border)" }}>/</span>
        <span className="text-sm font-mono font-semibold">
          #{order.id.slice(0, 8).toUpperCase()}
        </span>
      </div>

      <h1 className="text-2xl font-black mb-6">Detalle del pedido</h1>

      {/* Timeline */}
      <div
        className="rounded-2xl p-6 mb-6"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <h2 className="text-sm font-semibold mb-5" style={{ color: "var(--color-text-muted)" }}>
          ESTADO DEL PEDIDO
        </h2>
        <OrderTimeline status={order.status} />
      </div>

      {/* Productos */}
      <div
        className="rounded-2xl overflow-hidden mb-6"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div
          className="px-6 py-4 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <h2 className="font-bold">Productos</h2>
        </div>
        {order.items?.map((item, i) => (
          <div
            key={i}
            className="flex justify-between items-center px-6 py-4 border-b last:border-b-0"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div>
              <p className="text-sm font-semibold">{item.product_name}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                ${Number(item.price).toLocaleString("es-CL")} × {item.quantity}
              </p>
            </div>
            <p className="font-bold text-sm" style={{ color: "var(--color-accent)" }}>
              ${Number(item.subtotal).toLocaleString("es-CL")}
            </p>
          </div>
        ))}
        <div
          className="flex justify-between items-center px-6 py-4"
          style={{ borderTop: "2px solid var(--color-border)" }}
        >
          <span className="font-bold">Total</span>
          <span
            className="font-black text-xl"
            style={{ color: "var(--color-accent)" }}
          >
            ${Number(order.total).toLocaleString("es-CL")}
          </span>
        </div>
      </div>

      {/* Datos de envío */}
      <div
        className="rounded-2xl p-6"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <h2 className="font-bold mb-4">Datos de envío</h2>
        <div className="space-y-2 text-sm">
          <div className="flex gap-2">
            <span style={{ color: "var(--color-text-muted)" }}>Email:</span>
            <span>{order.email}</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: "var(--color-text-muted)" }}>Dirección:</span>
            <span>{order.shipping_address}</span>
          </div>
          {order.notes && (
            <div className="flex gap-2">
              <span style={{ color: "var(--color-text-muted)" }}>Notas:</span>
              <span>{order.notes}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span style={{ color: "var(--color-text-muted)" }}>Fecha:</span>
            <span>
              {new Date(order.created_at).toLocaleDateString("es-CL", {
                weekday: "long", day: "numeric",
                month: "long", year: "numeric",
              })}
            </span>
          </div>
        </div>
      </div>

    </div>
  )
}