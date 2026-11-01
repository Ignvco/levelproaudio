// pages/payment/PaymentSuccess.jsx
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Check, Clock, Mail, Package, GraduationCap, MessageCircle, TriangleAlert, X, Info, RefreshCw } from "lucide-react"
import { useSiteSettings } from "../../hooks/useSiteSettings"
import { usePaymentReturn } from "./usePaymentReturn"

const STATE_COPY = {
  missing: { title: "No encontramos la referencia del pedido", text: "Abrí el pedido desde tu cuenta para consultar su estado.", label: "Referencia inválida", Icon: Info },
  loading: { title: "Consultando tu pedido", text: "Estamos verificando el estado de tu compra.", label: "Consultando estado", Icon: Clock },
  capturing: { title: "Confirmando tu pago", text: "Estamos consultando la confirmación de PayPal. No vuelvas a pagar mientras verificamos el resultado.", label: "Confirmación en curso", Icon: Clock },
  pending: { title: "Tu pago está pendiente", text: "Todavía no recibimos la confirmación del pago. Si ya pagaste, esperá la actualización antes de intentar otro cobro.", label: "Pago pendiente", Icon: Clock },
  review: { title: "Tu pago está en revisión", text: "Estamos revisando el pago antes de confirmar el pedido. Si necesitás ayuda, escribinos con la referencia de tu orden.", label: "En revisión", Icon: Clock },
  confirmed: { title: "¡Compra confirmada!", text: "El pago de tu pedido fue confirmado. ¡Gracias por tu compra!", label: "Pago confirmado", Icon: Check },
  cancelled: { title: "Este pedido fue cancelado", text: "El pedido está cancelado. Si ya realizaste un pago, contactanos para revisar el cobro antes de volver a pagar.", label: "Pedido cancelado", Icon: X },
  rejected: { title: "El pago no fue aprobado", text: "El último intento de pago figura rechazado o cancelado. Revisá tu pedido y, si ves un cargo, contactanos antes de volver a pagar.", label: "Pago no aprobado", Icon: X },
  refunded: { title: "El pago figura reembolsado", text: "Consultá el movimiento con tu medio de pago o escribinos si necesitás ayuda.", label: "Reembolso registrado", Icon: Info },
  error: { title: "No pudimos consultar tu pedido", text: "No podemos confirmar el estado del pago en este momento. Actualizá el estado o revisá tus pedidos antes de volver a pagar.", label: "Estado no disponible", Icon: TriangleAlert },
  capture_error: { title: "No pudimos confirmar el pago de PayPal", text: "Esto no permite saber si hubo un cobro. Revisá el estado de tu pedido o contactanos antes de volver a pagar.", label: "Confirmación pendiente", Icon: TriangleAlert },
  unknown: { title: "El estado requiere verificación", text: "No tenemos una confirmación válida para mostrar. Revisá tus pedidos o contactanos antes de volver a pagar.", label: "Sin confirmación", Icon: Info },
}

function Confetti() {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4500)
    return () => clearTimeout(timer)
  }, [])
  if (!visible) return null
  const colors = ["#1aff6e","#facc15","#60a5fa","#f87171","#c084fc","#fb923c"]
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id:    i,
    color: colors[i % colors.length],
    left:  `${(i * 37) % 100}%`,
    delay: `${(i % 10) / 5}s`,
    dur:   `${2.5 + (i % 7) / 4}s`,
    size:  `${5 + (i % 9)}px`,
    rotate:`${(i * 47) % 360}deg`,
  }))

  return (
    <div data-testid="payment-confetti" aria-hidden="true" style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: "absolute", top: "-20px", left: p.left,
          width: p.size, height: p.size, background: p.color, borderRadius: "2px",
          opacity: 0.75, animation: `confettiFall ${p.dur} ${p.delay} ease-in forwards`,
          transform: `rotate(${p.rotate})` }} />
      ))}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg);    opacity: 0.8; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

export default function PaymentSuccess({ cancelledReturn = false }) {
  const { whatsappUrl } = useSiteSettings()
  const { state, order, isFetching, refresh, errorId, unauthorized } = usePaymentReturn(cancelledReturn)
  const isPaid = state === "confirmed"
  const { title, text, label, Icon } = STATE_COPY[state]
  const rgb = isPaid ? "26,255,110" : ["cancelled", "rejected", "error"].includes(state) ? "248,113,113" : "250,204,21"
  const color = `rgb(${rgb})`
  const canRefresh = !["missing", "loading", "capturing", "confirmed"].includes(state)
  const currency = order?.currency || "CLP"
  const formatAmount = value => new Intl.NumberFormat("es-CL", {
    style: "currency", currency,
  }).format(Number(value || 0))

  const cardBase = { background: "#121212", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "var(--r-2xl)", overflow: "hidden" }
  const sectionHead = { padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }
  const eyebrow = { fontSize: "11px", fontWeight: 700, color: "var(--accent)",
    textTransform: "uppercase", letterSpacing: "0.15em" }

  return (
    <div data-testid={cancelledReturn ? "payment-failure-page" : "payment-success-page"} data-payment-state={state} style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "clamp(104px, 12vw, 130px) clamp(20px, 5vw, 60px) clamp(60px, 8vw, 90px)",
      position: "relative",
      background: `radial-gradient(ellipse 60% 60% at 50% 20%, rgba(${rgb},0.08) 0%, transparent 70%), var(--bg)`,
    }}>
      {isPaid && <Confetti key={order?.id} />}

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "560px",
        display: "flex", flexDirection: "column", gap: "16px" }} className="animate-fade-up">

        {/* El estado consultado al backend determina toda la confirmación. */}
        <div role="status" aria-live="polite" style={{ ...cardBase, border: `1px solid rgba(${rgb},0.2)`,
          padding: "clamp(32px, 5vw, 48px)", textAlign: "center",
          boxShadow: `0 0 80px rgba(${rgb},0.06)` }}>
          <div style={{ width: "80px", height: "80px", borderRadius: "50%",
            background: `rgba(${rgb},0.1)`, border: `1px solid rgba(${rgb},0.3)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px", color, animation: "scaleIn 400ms var(--ease)" }}>
            <Icon size={38} strokeWidth={3} />
          </div>

          <h1 className="display-bold" style={{ fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800,
            letterSpacing: "-0.03em", lineHeight: 1, marginBottom: "14px", color: "var(--text)" }}>
            {title}
          </h1>

          <p style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.7, marginBottom: "20px" }}>
            {text}
          </p>

          {state !== "missing" && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "7px 16px", borderRadius: "var(--r-full)",
              background: `rgba(${rgb},0.1)`,
              border: `1px solid rgba(${rgb},0.2)`,
              fontSize: "13px", fontWeight: 600, color }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%",
                background: "currentColor", display: "inline-block" }} />
              {label}
            </div>
          )}
          {errorId && <p data-testid="payment-error-reference" style={{ color: "var(--text-3)", fontSize: "12px", marginTop: "16px", overflowWrap: "anywhere" }}>
            Referencia para soporte: {errorId}
          </p>}
          {canRefresh && <button type="button" onClick={refresh} disabled={isFetching} data-testid="payment-refresh" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", margin: "20px auto 0",
            padding: "12px 20px", borderRadius: "var(--r-full)", background: "rgba(255,255,255,0.06)",
            border: "1px solid var(--border)", color: "var(--text)", cursor: isFetching ? "wait" : "pointer",
          }}><RefreshCw size={16} />{isFetching ? "Consultando..." : "Actualizar estado"}</button>}
          {unauthorized && <Link to="/login" style={{ display: "block", marginTop: "16px", color: "var(--accent)" }}>
            Iniciar sesión para consultar el pedido
          </Link>}
        </div>

        {/* Detalle del pedido */}
        {state === "loading" && (
          <div className="skeleton" style={{ height: "300px", borderRadius: "var(--r-2xl)" }} />
        )}

        {order && (
          <div style={cardBase}>
            <div style={{ ...sectionHead, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={eyebrow}>· Detalle del pedido</p>
              <p style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--text-3)" }}>
                #{order.id.slice(0, 8).toUpperCase()}
              </p>
            </div>

            <div style={{ padding: "8px 24px 12px" }}>
              {[
                { label: "Email",  value: order.email },
                { label: "Fecha",  value: new Date(order.created_at).toLocaleDateString("es-CL", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric" }) },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "12px 0",
                  borderBottom: "1px solid var(--border)", fontSize: "13px" }}>
                  <span style={{ color: "var(--text-3)" }}>{label}</span>
                  <span style={{ color: "var(--text)" }}>{value}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid var(--border)" }}>
              <div style={{ padding: "12px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={eyebrow}>· Productos</p>
              </div>
              {order.items?.map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "14px 24px",
                  borderBottom: i < order.items.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)", marginBottom: "2px" }}>
                      {item.product_name}
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                      {formatAmount(item.price)} × {item.quantity}
                    </p>
                  </div>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>
                    {formatAmount(item.subtotal)}
                  </p>
                </div>
              ))}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
                gap: "12px", flexWrap: "wrap", padding: "18px 24px", borderTop: "1px solid var(--border)" }}>
                <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--text)" }}>Total</span>
                <span data-testid="success-total" style={{ fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.4rem, 5.5vw, 2rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--accent)", whiteSpace: "nowrap" }}>
                  {formatAmount(order.total)} <small style={{ fontSize: "12px", marginLeft: "4px", color: "var(--text-3)", letterSpacing: 0 }}>{currency}</small>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Aviso pendiente */}
        {["pending", "review", "capture_error"].includes(state) && order && (
          <div style={{ padding: "16px 20px", borderRadius: "var(--r-xl)",
            background: "rgba(250,204,21,0.06)", border: "1px solid rgba(250,204,21,0.2)",
            display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <span style={{ color: "#facc15", flexShrink: 0, display: "flex" }}><Clock size={20} /></span>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#facc15" }}>
                Consultá el estado de tu pedido
              </p>
              <p style={{ fontSize: "12px", color: "var(--text-3)", lineHeight: 1.6 }}>
                Si ya pagaste, esta página se actualizará automáticamente.{" "}
                <Link to={`/dashboard/orders/${order.id}`}
                  style={{ color: "var(--accent)", textDecoration: "underline" }}>
                  Ver orden →
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* Qué sigue */}
        {isPaid && <div data-testid="payment-next-steps" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "var(--r-xl)", padding: "22px 24px" }}>
          <p style={{ ...eyebrow, marginBottom: "16px" }}>· ¿Qué sigue?</p>
          {[
            { Icon: Mail, text: "Recibirás un email con el detalle de tu compra." },
            { Icon: Package, text: "Si tu compra incluye productos físicos, revisá el envío en tu pedido." },
            { Icon: GraduationCap, text: "Si compraste un curso, revisá el acceso desde tu cuenta." },
          ].map(({ Icon, text }) => (
            <div key={text} style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ color: "var(--accent)", flexShrink: 0, display: "flex" }}><Icon size={17} /></span>
              <p style={{ fontSize: "13px", color: "var(--text-2)", lineHeight: 1.5 }}>{text}</p>
            </div>
          ))}
        </div>}

        {/* CTAs */}
        <div style={{ display: "flex", gap: "10px" }}>
          <Link to="/dashboard/orders" data-testid="success-orders" style={{
            flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "14px", borderRadius: "var(--r-full)", background: "var(--accent)",
            color: "#000", fontSize: "14px", fontWeight: 700, textDecoration: "none",
            boxShadow: "0 8px 30px rgba(26,255,110,0.25)" }}>
            Ver mis pedidos
          </Link>
          <Link to="/shop" style={{
            flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "14px", borderRadius: "var(--r-full)", background: "rgba(255,255,255,0.04)",
            color: "var(--text)", border: "1px solid rgba(255,255,255,0.12)",
            fontSize: "14px", fontWeight: 600, textDecoration: "none" }}>
            Seguir comprando
          </Link>
        </div>

        {/* WhatsApp */}
        <a href={whatsappUrl} target="_blank" rel="noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            padding: "14px", borderRadius: "var(--r-xl)", background: "rgba(37,211,102,0.06)",
            border: "1px solid rgba(37,211,102,0.15)", color: "#25d166", fontSize: "13px",
            fontWeight: 600, textDecoration: "none" }}>
          <MessageCircle size={16} /> ¿Consultas? Escribinos por WhatsApp
        </a>
      </div>
    </div>
  )
}
