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
  { id: "mercadopago_cl", label: "MercadoPago",  icon: "💳", desc: "Tarjetas, Khipu" },
  { id: "paypal",         label: "PayPal",        icon: "🌐", desc: "Tarjetas internacionales" },
  { id: "global66",       label: "Transferencia", icon: "🏦", desc: "Global66" },
]

function Timeline({ status }) {
  if (status === "cancelled") return (
    <div style={{ padding: "16px 20px", borderRadius: "var(--r-xl)",
      background: "rgba(248,113,113,0.06)",
      border: "1px solid rgba(248,113,113,0.2)",
      color: "#f87171", fontSize: "14px",
      display: "flex", alignItems: "center", gap: "10px" }}>
      <span>✕</span> Este pedido fue cancelado.
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
            alignItems: "center", gap: "8px" }}>
            <div style={{
              width:           "32px",
              height:          "32px",
              borderRadius:    "50%",
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              fontSize:        "12px",
              fontWeight:      600,
              background:      i + 1 <= current ? "var(--accent)" : "var(--surface-2)",
              color:           i + 1 <= current ? "#000" : "var(--text-3)",
              border:          i + 1 <= current ? "none" : "1px solid var(--border)",
              transition:      "all var(--dur-slow) var(--ease)",
            }}>
              {i + 1 <= current ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: "11px", whiteSpace: "nowrap",
              color: i + 1 <= current ? "var(--text)" : "var(--text-3)" }}>
              {step}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: "1px", margin: "0 8px",
              marginBottom: "22px",
              background: i + 1 < current ? "var(--accent)" : "var(--border)",
              transition: "background var(--dur-slow) var(--ease)" }} />
          )}
        </div>
      ))}
    </div>
  )
}

function PaymentPanel({ order, onCancelled }) {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [method, setMethod]       = useState("mercadopago_cl")
  const [error, setError]         = useState("")
  const [showCancel, setShowCancel] = useState(false)

  const payMutation = useMutation({
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
      <div style={{ background: "var(--surface)",
        border: "1px solid rgba(250,204,21,0.2)",
        borderRadius: "var(--r-xl)", padding: "24px" }}>

        <div style={{ display: "flex", alignItems: "center", gap: "8px",
          marginBottom: "20px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%",
            background: "#facc15" }} />
          <p style={{ fontSize: "14px", fontWeight: 500 }}>
            Pago pendiente — elegí un método
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column",
          gap: "8px", marginBottom: "20px" }}>
          {PAYMENT_METHODS.map(m => (
            <button key={m.id} type="button" onClick={() => setMethod(m.id)} style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "14px 16px", borderRadius: "var(--r-lg)",
              cursor: "pointer", textAlign: "left",
              background: method === m.id ? "rgba(26,255,110,0.04)" : "var(--surface-2)",
              border: `1px solid ${method === m.id ? "rgba(26,255,110,0.3)" : "var(--border)"}`,
              transition: "all var(--dur) var(--ease)", width: "100%",
            }}>
              <div style={{ width: "16px", height: "16px", borderRadius: "50%",
                flexShrink: 0,
                border: `2px solid ${method === m.id ? "var(--accent)" : "var(--border)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "border-color var(--dur)" }}>
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
          {payMutation.isPending ? "Procesando..."
            : method === "global66" ? "Ver instrucciones"
            : "Continuar con el pago →"}
        </button>
      </div>

      {/* Cancelar */}
      {!showCancel ? (
        <button onClick={() => setShowCancel(true)} style={{
          background: "none", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", padding: "12px",
          color: "var(--text-3)", fontSize: "13px",
          cursor: "pointer", width: "100%",
          transition: "all var(--dur) var(--ease)",
        }}>
          Cancelar esta orden
        </button>
      ) : (
        <div style={{ background: "rgba(248,113,113,0.05)",
          border: "1px solid rgba(248,113,113,0.2)",
          borderRadius: "var(--r-xl)", padding: "20px" }}>
          <p style={{ fontSize: "14px", marginBottom: "16px", lineHeight: 1.6 }}>
            ¿Cancelar la orden? El stock será restablecido.
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              style={{ flex: 1, padding: "11px", borderRadius: "var(--r-lg)",
                background: "rgba(248,113,113,0.15)",
                border: "1px solid rgba(248,113,113,0.3)",
                color: "#f87171", fontSize: "13px",
                fontWeight: 500, cursor: "pointer" }}>
              {cancelMutation.isPending ? "Cancelando..." : "Sí, cancelar"}
            </button>
            <button onClick={() => setShowCancel(false)} style={{
              flex: 1, padding: "11px", borderRadius: "var(--r-lg)",
              background: "none", border: "1px solid var(--border)",
              color: "var(--text-2)", fontSize: "13px", cursor: "pointer" }}>
              Volver
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: order, isLoading, isError } = useQuery({
    queryKey:        ["order", id],
    queryFn:         () => getOrder(id),
    refetchInterval: (data) => data?.status === "pending" ? 5000 : false,
  })

  if (isLoading) return (
    <div style={{ padding: "clamp(32px, 5vw, 56px)", maxWidth: "640px",
      display: "flex", flexDirection: "column", gap: "14px" }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton"
          style={{ height: i === 0 ? "120px" : "80px" }} />
      ))}
    </div>
  )

  if (isError || !order) return (
    <div style={{ padding: "clamp(32px, 5vw, 56px)", textAlign: "center" }}>
      <p style={{ color: "var(--text-3)", marginBottom: "16px" }}>
        Pedido no encontrado.
      </p>
      <Link to="/dashboard/orders" className="btn btn-ghost">
        ← Volver
      </Link>
    </div>
  )

  return (
    <div style={{ padding: "clamp(32px, 5vw, 56px)", maxWidth: "640px" }}>

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px",
        fontSize: "13px", color: "var(--text-3)", marginBottom: "32px" }}>
        <Link to="/dashboard/orders" style={{ transition: "color var(--dur)" }}
          className="hover-accent">
          Mis pedidos
        </Link>
        <span>/</span>
        <span style={{ fontFamily: "monospace", color: "var(--text-2)" }}>
          #{order.id.slice(0, 8).toUpperCase()}
        </span>
      </div>

      <h1 style={{ fontFamily: "var(--font-serif)",
        fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 300,
        letterSpacing: "-0.02em", marginBottom: "32px" }}>
        Detalle del pedido
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Timeline */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)", padding: "28px" }}>
          <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "24px" }}>
            Estado
          </p>
          <Timeline status={order.status} />
        </div>

        {/* Panel de pago */}
        {order.status === "pending" && (
          <PaymentPanel
            order={order}
            onCancelled={() => navigate("/dashboard/orders")}
          />
        )}

        {/* Productos */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)", overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)",
            background: "var(--surface-2)" }}>
            <p style={{ fontSize: "13px", fontWeight: 500 }}>Productos</p>
          </div>
          {order.items?.map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", padding: "16px 24px",
              borderBottom: i < order.items.length - 1
                ? "1px solid var(--border)" : "none" }}>
              <div>
                <p style={{ fontSize: "14px", marginBottom: "4px" }}>
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
          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "baseline", padding: "18px 24px",
            borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>
            <span style={{ fontSize: "15px", fontWeight: 500 }}>Total</span>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: "2rem",
              color: "var(--accent)" }}>
              ${Number(order.total).toLocaleString("es-CL")}
            </span>
          </div>
        </div>

        {/* Datos de envío */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)", padding: "24px" }}>
          <p style={{ fontSize: "13px", fontWeight: 500, marginBottom: "16px" }}>
            Datos de envío
          </p>
          {[
            { label: "Email",     value: order.email },
            { label: "Dirección", value: order.shipping_address },
            ...(order.notes ? [{ label: "Notas", value: order.notes }] : []),
            { label: "Fecha", value: new Date(order.created_at).toLocaleDateString("es-CL", {
              weekday: "long", day: "numeric", month: "long", year: "numeric" }) },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", gap: "12px",
              fontSize: "13px", marginBottom: "10px" }}>
              <span style={{ color: "var(--text-3)", flexShrink: 0, minWidth: "80px" }}>
                {label}
              </span>
              <span style={{ color: "var(--text-2)" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Ver comprobante si está pagado */}
        {(order.status === "paid" || order.status === "completed") && (
          <Link to={`/payment/success?order=${order.id}`}
            className="btn btn-ghost"
            style={{ justifyContent: "center" }}>
            🧾 Ver comprobante de compra
          </Link>
        )}
      </div>
    </div>
  )
}