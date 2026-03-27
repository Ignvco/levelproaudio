// pages/dashboard/OrderDetail.jsx

import { useParams, Link, useNavigate } from "react-router-dom"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { getOrder } from "../../api/orders.api"
import { createPayment } from "../../api/payments.api"

const statusConfig = {
  pending:   { label: "Pendiente",  color: "#facc15", step: 1 },
  paid:      { label: "Pagado",     color: "#4ade80", step: 2 },
  shipped:   { label: "Enviado",    color: "#60a5fa", step: 3 },
  completed: { label: "Completado", color: "#4ade80", step: 4 },
  cancelled: { label: "Cancelado",  color: "#f87171", step: 0 },
}

const PAYMENT_METHODS = [
  { id: "mercadopago_cl", label: "MercadoPago",           icon: "💳" },
  { id: "paypal",         label: "PayPal",                icon: "🌎" },
  { id: "global66",       label: "Transferencia Global66", icon: "🏦" },
]

// ── Timeline ─────────────────────────────────────────────────
function Timeline({ status }) {
  if (status === "cancelled") return (
    <div style={{
      padding: "14px 18px", borderRadius: "var(--r-md)", fontSize: "13px",
      background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)",
      color: "#f87171",
    }}>
      Este pedido fue cancelado.
    </div>
  )

  const steps   = ["Pendiente", "Pagado", "Enviado", "Completado"]
  const current = statusConfig[status]?.step || 1

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {steps.map((step, i) => (
        <div key={step} style={{ display: "flex", alignItems: "center",
          flex: i < steps.length - 1 ? 1 : "none" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            <div style={{
              width: "28px", height: "28px", borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "11px", fontWeight: 600,
              background: i + 1 <= current ? "var(--accent)" : "var(--surface-3)",
              color: i + 1 <= current ? "#000" : "var(--text-3)",
              transition: "all var(--dur) var(--ease)",
            }}>
              {i + 1 <= current ? "✓" : i + 1}
            </div>
            <span style={{
              fontSize: "11px", whiteSpace: "nowrap",
              color: i + 1 <= current ? "var(--text)" : "var(--text-3)",
            }}>
              {step}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{
              flex: 1, height: "1px", margin: "0 6px", marginBottom: "18px",
              background: i + 1 < current ? "var(--accent)" : "var(--border)",
              transition: "background var(--dur) var(--ease)",
            }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Panel de pago para órdenes pendientes ────────────────────
function PaymentPanel({ order }) {
  const navigate        = useNavigate()
  const [method, setMethod] = useState("mercadopago_cl")
  const [error, setError]   = useState("")

  const mutation = useMutation({
    mutationFn: () => createPayment(order.id, method),
    onSuccess: (data) => {
      if (method === "mercadopago_cl" || method === "mercadopago_ar") {
        window.location.href = data.sandbox_url || data.init_point
      } else if (method === "paypal") {
        window.location.href = data.approve_url
      } else {
        navigate(`/payment/transfer/${order.id}`, { state: { transferData: data } })
      }
    },
    onError: () => setError("Error al procesar. Intenta de nuevo."),
  })

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid rgba(250,204,21,0.25)",
      borderRadius: "var(--r-lg)", padding: "20px 24px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
        <div style={{ width: "8px", height: "8px", borderRadius: "50%",
          background: "#facc15" }} />
        <p style={{ fontSize: "14px", fontWeight: 500 }}>Pago pendiente</p>
      </div>

      <p style={{ fontSize: "13px", color: "var(--text-2)", marginBottom: "16px", lineHeight: 1.6 }}>
        Elige un método para completar tu compra.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
        {PAYMENT_METHODS.map(m => (
          <button key={m.id} onClick={() => setMethod(m.id)} style={{
            display: "flex", alignItems: "center", gap: "12px",
            padding: "11px 14px", borderRadius: "var(--r-md)", textAlign: "left",
            cursor: "pointer", transition: "all var(--dur) var(--ease)",
            background: method === m.id ? "var(--surface-2)" : "transparent",
            border: `1px solid ${method === m.id ? "var(--border-hover)" : "var(--border)"}`,
          }}>
            <div style={{
              width: "16px", height: "16px", borderRadius: "50%", flexShrink: 0,
              border: `2px solid ${method === m.id ? "var(--accent)" : "var(--border)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {method === m.id && (
                <div style={{ width: "7px", height: "7px", borderRadius: "50%",
                  background: "var(--accent)" }} />
              )}
            </div>
            <span style={{ fontSize: "14px" }}>{m.icon}</span>
            <span style={{ fontSize: "13px" }}>{m.label}</span>
          </button>
        ))}
      </div>

      {error && (
        <p style={{ fontSize: "12px", color: "var(--danger)", marginBottom: "12px" }}>{error}</p>
      )}

      <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
        className="btn btn-accent"
        style={{ width: "100%", justifyContent: "center",
          opacity: mutation.isPending ? 0.6 : 1 }}>
        {mutation.isPending ? "Procesando..." :
          method === "global66" ? "Ver instrucciones de transferencia" : "Continuar con el pago →"}
      </button>
    </div>
  )
}

// ── OrderDetail ──────────────────────────────────────────────
export default function OrderDetail() {
  const { id } = useParams()

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ["order", id],
    queryFn:  () => getOrder(id),
  })

  if (isLoading) return (
    <div style={{ padding: "clamp(32px, 5vw, 56px)", maxWidth: "640px",
      display: "flex", flexDirection: "column", gap: "12px" }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton" style={{ height: "80px" }} />
      ))}
    </div>
  )

  if (isError || !order) return (
    <div style={{ padding: "clamp(32px, 5vw, 56px)", textAlign: "center" }}>
      <p style={{ color: "var(--text-3)", marginBottom: "16px" }}>Pedido no encontrado.</p>
      <Link to="/dashboard/orders" style={{ color: "var(--text-2)", fontSize: "14px" }}>
        ← Volver a mis pedidos
      </Link>
    </div>
  )

  return (
    <div style={{ padding: "clamp(32px, 5vw, 56px)", maxWidth: "640px" }}>

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px",
        fontSize: "13px", color: "var(--text-3)", marginBottom: "32px" }}>
        <Link to="/dashboard/orders"
          style={{ transition: "color var(--dur)" }} className="hover:text-white">
          Mis pedidos
        </Link>
        <span>/</span>
        <span style={{ fontFamily: "monospace" }}>
          #{order.id.slice(0, 8).toUpperCase()}
        </span>
      </div>

      <h1 style={{ fontFamily: "var(--font-serif)",
        fontSize: "clamp(2rem, 4vw, 2.8rem)", marginBottom: "32px" }}>
        Detalle del pedido
      </h1>

      {/* Timeline */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)", padding: "24px", marginBottom: "16px" }}>
        <p style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "20px" }}>
          Estado del pedido
        </p>
        <Timeline status={order.status} />
      </div>

      {/* Panel de pago */}
      {order.status === "pending" && (
        <div style={{ marginBottom: "16px" }}>
          <PaymentPanel order={order} />
        </div>
      )}

      {/* Productos */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)", overflow: "hidden", marginBottom: "16px" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <p style={{ fontSize: "13px", fontWeight: 500 }}>Productos</p>
        </div>
        {order.items?.map((item, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 20px",
            borderBottom: i < order.items.length - 1 ? "1px solid var(--border)" : "none",
          }}>
            <div>
              <p style={{ fontSize: "14px", marginBottom: "3px" }}>{item.product_name}</p>
              <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                ${Number(item.price).toLocaleString("es-CL")} × {item.quantity}
              </p>
            </div>
            <p style={{ fontSize: "14px", fontWeight: 500 }}>
              ${Number(item.subtotal).toLocaleString("es-CL")}
            </p>
          </div>
        ))}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderTop: "1px solid var(--border)",
          background: "var(--surface-2)",
        }}>
          <span style={{ fontSize: "14px", fontWeight: 500 }}>Total</span>
          <span style={{ fontSize: "20px", fontWeight: 500 }}>
            ${Number(order.total).toLocaleString("es-CL")}
          </span>
        </div>
      </div>

      {/* Datos de envío */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)", padding: "20px 24px" }}>
        <p style={{ fontSize: "13px", fontWeight: 500, marginBottom: "16px" }}>
          Datos de envío
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[
            { label: "Email",     value: order.email },
            { label: "Dirección", value: order.shipping_address },
            ...(order.notes ? [{ label: "Notas", value: order.notes }] : []),
            { label: "Fecha", value: new Date(order.created_at).toLocaleDateString("es-CL", {
              weekday: "long", day: "numeric", month: "long", year: "numeric" }) },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", gap: "12px", fontSize: "13px" }}>
              <span style={{ color: "var(--text-3)", flexShrink: 0, minWidth: "80px" }}>
                {label}
              </span>
              <span style={{ color: "var(--text-2)" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
