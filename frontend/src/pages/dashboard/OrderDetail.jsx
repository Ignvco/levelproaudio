// pages/dashboard/OrderDetail.jsx

import { useParams, Link, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { getOrder, cancelOrder } from "../../api/orders.api"
import { createPayment } from "../../api/payments.api"

const statusConfig = {
  pending:   { label: "Pendiente",  color: "#facc15", step: 1 },
  paid:      { label: "Pagado",     color: "#4ade80", step: 2 },
  shipped:   { label: "Enviado",    color: "#60a5fa", step: 3 },
  completed: { label: "Completado", color: "#4ade80", step: 4 },
  cancelled: { label: "Cancelado",  color: "#f87171", step: 0 },
}

const PAYMENT_METHODS = [
  { id: "mercadopago_cl", label: "MercadoPago",           icon: "💳", desc: "Tarjetas, Khipu, efectivo" },
  { id: "paypal",         label: "PayPal",                icon: "🌐", desc: "Tarjetas internacionales" },
  { id: "global66",       label: "Transferencia Global66", icon: "🏦", desc: "Pago manual por transferencia" },
]

// ── Timeline ─────────────────────────────────────────────────
function Timeline({ status }) {
  if (status === "cancelled") return (
    <div style={{
      padding: "14px 18px", borderRadius: "var(--r-md)", fontSize: "13px",
      background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)",
      color: "#f87171",
    }}>
      Este pedido fue cancelado. El stock fue restablecido.
    </div>
  )

  const steps   = ["Pendiente", "Pagado", "Enviado", "Completado"]
  const current = statusConfig[status]?.step || 1

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {steps.map((step, i) => (
        <div key={step} style={{ display: "flex", alignItems: "center",
          flex: i < steps.length - 1 ? 1 : "none" }}>
          <div style={{ display: "flex", flexDirection: "column",
            alignItems: "center", gap: "6px" }}>
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
            <span style={{ fontSize: "11px", whiteSpace: "nowrap",
              color: i + 1 <= current ? "var(--text)" : "var(--text-3)" }}>
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

// ── Panel de pago ─────────────────────────────────────────────
function PaymentPanel({ order, onCancelled }) {
  const navigate        = useNavigate()
  const queryClient     = useQueryClient()
  const [method, setMethod] = useState("mercadopago_cl")
  const [error, setError]   = useState("")
  const [showCancel, setShowCancel] = useState(false)

  // Pagar
  const payMutation = useMutation({
    mutationFn: () => createPayment(order.id, method),
    onSuccess: (data) => {
      if (method === "mercadopago_cl" || method === "mercadopago_ar") {
        // ← En desarrollo usa sandbox_url, en producción init_point
        const url = data.sandbox_url || data.init_point
        window.location.href = url
      } else if (method === "paypal") {
        window.location.href = data.approve_url
      } else {
        navigate(`/payment/transfer/${order.id}`, { state: { transferData: data } })
      }
    },
    onError: () => setError("Error al procesar. Intenta de nuevo."),
  })

  // Cancelar orden
  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(order.id),
    onSuccess: () => {
      queryClient.invalidateQueries(["order", order.id])
      queryClient.invalidateQueries(["orders"])
      onCancelled?.()
    },
    onError: () => setError("No se pudo cancelar la orden."),
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

      {/* Panel de pago */}
      <div style={{
        background: "var(--surface)", border: "1px solid rgba(250,204,21,0.25)",
        borderRadius: "var(--r-lg)", padding: "20px 24px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px",
          marginBottom: "16px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%",
            background: "#facc15" }} />
          <p style={{ fontSize: "14px", fontWeight: 500 }}>
            Pago pendiente — elige un método
          </p>
        </div>

        {/* Métodos de pago */}
        <div style={{ display: "flex", flexDirection: "column",
          gap: "8px", marginBottom: "16px" }}>
          {PAYMENT_METHODS.map(m => (
            <button key={m.id} onClick={() => setMethod(m.id)} style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "12px 14px", borderRadius: "var(--r-md)", textAlign: "left",
              cursor: "pointer", transition: "all var(--dur) var(--ease)",
              background: method === m.id ? "var(--surface-2)" : "transparent",
              border: `1px solid ${method === m.id ? "var(--border-hover)" : "var(--border)"}`,
              width: "100%",
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
              <span style={{ fontSize: "18px" }}>{m.icon}</span>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 500 }}>{m.label}</p>
                <p style={{ fontSize: "11px", color: "var(--text-3)" }}>{m.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {error && (
          <p style={{ fontSize: "12px", color: "var(--danger)",
            marginBottom: "12px" }}>{error}</p>
        )}

        <button onClick={() => payMutation.mutate()}
          disabled={payMutation.isPending}
          className="btn btn-accent"
          style={{ width: "100%", justifyContent: "center",
            opacity: payMutation.isPending ? 0.6 : 1 }}>
          {payMutation.isPending ? "Procesando..." :
            method === "global66"
              ? "Ver instrucciones de transferencia"
              : "Continuar con el pago →"}
        </button>
      </div>

      {/* Cancelar orden */}
      {!showCancel ? (
        <button
          onClick={() => setShowCancel(true)}
          style={{
            background: "none", border: "1px solid var(--border)",
            borderRadius: "var(--r-md)", padding: "10px",
            color: "var(--text-3)", fontSize: "13px", cursor: "pointer",
            width: "100%", transition: "all var(--dur) var(--ease)",
          }}
        >
          Cancelar esta orden
        </button>
      ) : (
        <div style={{
          background: "rgba(248,113,113,0.06)",
          border: "1px solid rgba(248,113,113,0.2)",
          borderRadius: "var(--r-lg)", padding: "16px",
        }}>
          <p style={{ fontSize: "13px", marginBottom: "12px", lineHeight: 1.5 }}>
            ¿Seguro que querés cancelar esta orden? El stock será restablecido.
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              style={{
                flex: 1, padding: "9px", borderRadius: "var(--r-md)",
                background: "rgba(248,113,113,0.15)",
                border: "1px solid rgba(248,113,113,0.3)",
                color: "#f87171", fontSize: "13px", cursor: "pointer",
                fontWeight: 500,
              }}>
              {cancelMutation.isPending ? "Cancelando..." : "Sí, cancelar"}
            </button>
            <button
              onClick={() => setShowCancel(false)}
              style={{
                flex: 1, padding: "9px", borderRadius: "var(--r-md)",
                background: "none", border: "1px solid var(--border)",
                color: "var(--text-2)", fontSize: "13px", cursor: "pointer",
              }}>
              Volver
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── OrderDetail ───────────────────────────────────────────────
export default function OrderDetail() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ["order", id],
    queryFn:  () => getOrder(id),
    // Refresca si el pago está pendiente (para captar webhook de MP)
    refetchInterval: (data) =>
      data?.status === "pending" ? 5000 : false,
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
      <p style={{ color: "var(--text-3)", marginBottom: "16px" }}>
        Pedido no encontrado.
      </p>
      <Link to="/dashboard/orders"
        style={{ color: "var(--text-2)", fontSize: "14px" }}>
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
          style={{ transition: "color var(--dur)" }}
          className="hover:text-white">
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

      {/* Panel de pago — solo si está pendiente */}
      {order.status === "pending" && (
        <div style={{ marginBottom: "16px" }}>
          <PaymentPanel
            order={order}
            onCancelled={() => navigate("/dashboard/orders")}
          />
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
            borderBottom: i < order.items.length - 1
              ? "1px solid var(--border)" : "none",
          }}>
            <div>
              <p style={{ fontSize: "14px", marginBottom: "3px" }}>
                {item.product_name}
              </p>
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
          <span style={{ fontFamily: "var(--font-serif)", fontSize: "1.6rem",
            color: "var(--accent)" }}>
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

      {/* Botón ir a pago exitoso — para testing manual */}
      {order.status === "paid" && (
        <div style={{ marginTop: "16px" }}>
          <Link
            to={`/payment/success?order=${order.id}`}
            className="btn btn-accent"
            style={{ width: "100%", justifyContent: "center" }}>
            Ver comprobante de pago
          </Link>
        </div>
      )}

    </div>
  )
}