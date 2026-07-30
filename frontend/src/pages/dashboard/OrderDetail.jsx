// pages/dashboard/OrderDetail.jsx
import { useParams, Link, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Check, X, CreditCard, Globe, Landmark, ReceiptText, ArrowRight, ChevronLeft } from "lucide-react"
import { getOrder, cancelOrder } from "../../api/orders.api"
import { createPayment } from "../../api/payments.api"

const statusConfig = {
  pending:   { label: "Pendiente",  color: "#facc15", step: 1 },
  paid:      { label: "Pagado",     color: "#1aff6e", step: 2 },
  shipped:   { label: "Enviado",    color: "#60a5fa", step: 3 },
  completed: { label: "Completado", color: "#1aff6e", step: 4 },
  cancelled: { label: "Cancelado",  color: "#f87171", step: 0 },
}

const PAYMENT_METHODS = [
  { id: "mercadopago_cl", label: "MercadoPago",  Icon: CreditCard, desc: "Tarjetas, Khipu" },
  { id: "paypal",         label: "PayPal",        Icon: Globe,      desc: "Tarjetas internacionales" },
  { id: "global66",       label: "Transferencia", Icon: Landmark,   desc: "Global66" },
]

const card = { background: "#121212", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "20px" }
const eyebrow = { fontSize: "11px", fontWeight: 700, color: "var(--accent)",
  textTransform: "uppercase", letterSpacing: "0.15em" }

function Timeline({ status }) {
  if (status === "cancelled") return (
    <div style={{ padding: "16px 20px", borderRadius: "var(--r-xl)", background: "rgba(248,113,113,0.06)",
      border: "1px solid rgba(248,113,113,0.2)", color: "#f87171", fontSize: "14px",
      display: "flex", alignItems: "center", gap: "10px" }}>
      <X size={18} /> Este pedido fue cancelado.
    </div>
  )
  const steps   = ["Pendiente", "Pagado", "Enviado", "Completado"]
  const current = statusConfig[status]?.step || 1
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {steps.map((step, i) => {
        const done = i + 1 <= current
        return (
          <div key={step} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "50%", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700,
                background: done ? "var(--accent)" : "rgba(255,255,255,0.04)",
                color: done ? "#000" : "var(--text-3)",
                border: done ? "none" : "1px solid var(--border)",
                boxShadow: done ? "0 4px 14px rgba(26,255,110,0.25)" : "none",
                transition: "all var(--dur-slow) var(--ease)" }}>
                {done ? <Check size={15} strokeWidth={3} /> : i + 1}
              </div>
              <span style={{ fontSize: "11px", whiteSpace: "nowrap",
                color: done ? "var(--text)" : "var(--text-3)" }}>{step}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: "2px", margin: "0 8px 22px",
                background: i + 1 < current ? "var(--accent)" : "var(--border)",
                transition: "background var(--dur-slow) var(--ease)" }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function PaymentPanel({ order, onCancelled }) {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [method, setMethod]         = useState("mercadopago_cl")
  const [error, setError]           = useState("")
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
      <div style={{ ...card, border: "1px solid rgba(250,204,21,0.2)", padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#facc15" }} />
          <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>
            Pago pendiente — elegí un método
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
          {PAYMENT_METHODS.map(m => {
            const active = method === m.id
            return (
              <button key={m.id} type="button" onClick={() => setMethod(m.id)}
                data-testid={`od-method-${m.id}`}
                style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px",
                  borderRadius: "var(--r-lg)", cursor: "pointer", textAlign: "left", width: "100%",
                  background: active ? "rgba(26,255,110,0.05)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? "rgba(26,255,110,0.35)" : "rgba(255,255,255,0.08)"}`,
                  transition: "all var(--dur) var(--ease)" }}>
                <div style={{ width: "16px", height: "16px", borderRadius: "50%", flexShrink: 0,
                  border: `2px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {active && <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--accent)" }} />}
                </div>
                <span style={{ color: active ? "var(--accent)" : "var(--text-2)", display: "flex" }}><m.Icon size={20} /></span>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>{m.label}</p>
                  <p style={{ fontSize: "11px", color: "var(--text-3)" }}>{m.desc}</p>
                </div>
              </button>
            )
          })}
        </div>

        {error && <p style={{ fontSize: "12px", color: "var(--danger)", marginBottom: "12px" }}>{error}</p>}

        <button onClick={() => payMutation.mutate()} disabled={payMutation.isPending}
          data-testid="od-pay"
          style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "10px",
            padding: "14px", borderRadius: "var(--r-full)", background: "var(--accent)", color: "#000",
            border: "none", fontSize: "14px", fontWeight: 700, cursor: "pointer",
            opacity: payMutation.isPending ? 0.6 : 1, boxShadow: "0 8px 30px rgba(26,255,110,0.25)" }}>
          {payMutation.isPending ? "Procesando..." : method === "global66" ? "Ver instrucciones" : "Continuar con el pago"}
          {!payMutation.isPending && <ArrowRight size={15} />}
        </button>
      </div>

      {!showCancel ? (
        <button onClick={() => setShowCancel(true)} data-testid="od-cancel-open"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)", padding: "12px", color: "var(--text-3)", fontSize: "13px",
            cursor: "pointer", width: "100%", transition: "all var(--dur) var(--ease)" }}>
          Cancelar esta orden
        </button>
      ) : (
        <div style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.2)",
          borderRadius: "var(--r-xl)", padding: "20px" }}>
          <p style={{ fontSize: "14px", marginBottom: "16px", lineHeight: 1.6, color: "var(--text)" }}>
            ¿Cancelar la orden? El stock será restablecido.
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}
              data-testid="od-cancel-confirm"
              style={{ flex: 1, padding: "11px", borderRadius: "var(--r-lg)", background: "rgba(248,113,113,0.15)",
                border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", fontSize: "13px",
                fontWeight: 600, cursor: "pointer" }}>
              {cancelMutation.isPending ? "Cancelando..." : "Sí, cancelar"}
            </button>
            <button onClick={() => setShowCancel(false)}
              style={{ flex: 1, padding: "11px", borderRadius: "var(--r-lg)", background: "none",
                border: "1px solid var(--border)", color: "var(--text-2)", fontSize: "13px", cursor: "pointer" }}>
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

  const { data: order, isLoading, isError } = useQuery({
    queryKey:        ["order", id],
    queryFn:         () => getOrder(id),
    refetchInterval: (data) => data?.status === "pending" ? 5000 : false,
  })

  const wrap = { padding: "clamp(20px, 3vw, 40px) clamp(20px, 4vw, 48px)", maxWidth: "720px" }

  if (isLoading) return (
    <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "14px" }}>
      {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: i === 0 ? "120px" : "80px" }} />)}
    </div>
  )

  if (isError || !order) return (
    <div style={{ ...wrap, textAlign: "center" }}>
      <p style={{ color: "var(--text-3)", marginBottom: "16px" }}>Pedido no encontrado.</p>
      <Link to="/dashboard/orders" style={{ display: "inline-flex", alignItems: "center", gap: "6px",
        padding: "10px 20px", borderRadius: "var(--r-full)", background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--border)", color: "var(--text)", textDecoration: "none", fontSize: "14px" }}>
        <ChevronLeft size={15} /> Volver
      </Link>
    </div>
  )

  return (
    <div style={wrap} data-testid="order-detail-page">
      <Link to="/dashboard/orders" data-testid="od-back" style={{ display: "inline-flex", alignItems: "center",
        gap: "7px", fontSize: "13px", color: "var(--text-3)", marginBottom: "18px", textDecoration: "none",
        transition: "color var(--dur)" }}
        onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
        onMouseLeave={e => e.currentTarget.style.color = "var(--text-3)"}>
        <ChevronLeft size={14} /> Mis pedidos
      </Link>

      <div style={{ marginBottom: "28px" }}>
        <p style={eyebrow}>· Pedido #{order.id.slice(0, 8).toUpperCase()}</p>
        <h1 className="display-bold" style={{ fontFamily: "var(--font-display)",
          fontSize: "clamp(1.8rem, 3.4vw, 2.6rem)", fontWeight: 800, letterSpacing: "-0.03em",
          marginTop: "10px", color: "var(--text)" }}>
          Detalle del pedido
        </h1>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Timeline */}
        <div style={{ ...card, padding: "28px" }}>
          <p style={{ ...eyebrow, marginBottom: "24px" }}>· Estado</p>
          <Timeline status={order.status} />
        </div>

        {order.status === "pending" && (
          <PaymentPanel order={order} onCancelled={() => navigate("/dashboard/orders")} />
        )}

        {/* Productos */}
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={eyebrow}>· Productos</p>
          </div>
          {order.items?.map((item, i) => (
            <div key={item.id || `${item.product_name}-${i}`} style={{ display: "flex",
              justifyContent: "space-between", alignItems: "center", padding: "16px 24px",
              borderBottom: i < order.items.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <div>
                <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>{item.product_name}</p>
                <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                  ${Number(item.price).toLocaleString("es-CL")} × {item.quantity}
                </p>
              </div>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>
                ${Number(item.subtotal).toLocaleString("es-CL")}
              </p>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
            padding: "18px 24px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--text)" }}>Total</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 800,
              letterSpacing: "-0.03em", color: "var(--accent)" }}>
              ${Number(order.total).toLocaleString("es-CL")}
            </span>
          </div>
        </div>

        {/* Datos de envío */}
        <div style={{ ...card, padding: "24px" }}>
          <p style={{ ...eyebrow, marginBottom: "16px" }}>· Datos de envío</p>
          {[
            { label: "Email",     value: order.email },
            { label: "Dirección", value: order.shipping_address },
            ...(order.notes ? [{ label: "Notas", value: order.notes }] : []),
            { label: "Fecha", value: new Date(order.created_at).toLocaleDateString("es-CL", {
              weekday: "long", day: "numeric", month: "long", year: "numeric" }) },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", gap: "12px", fontSize: "13px", marginBottom: "10px" }}>
              <span style={{ color: "var(--text-3)", flexShrink: 0, minWidth: "80px" }}>{label}</span>
              <span style={{ color: "var(--text-2)" }}>{value}</span>
            </div>
          ))}
        </div>

        {(order.status === "paid" || order.status === "completed") && (
          <Link to={`/payment/success?order=${order.id}`} data-testid="od-receipt"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
              padding: "14px", borderRadius: "var(--r-full)", background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)", color: "var(--text)", textDecoration: "none",
              fontSize: "14px", fontWeight: 600 }}>
            <ReceiptText size={16} /> Ver comprobante de compra
          </Link>
        )}
      </div>
    </div>
  )
}
