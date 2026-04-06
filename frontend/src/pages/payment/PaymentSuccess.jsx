// pages/payment/PaymentSuccess.jsx  (o pages/PaymentSuccess.jsx según tu estructura)
import { useEffect, useState } from "react"
import { useSearchParams, Link, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getOrder } from "../../api/orders.api"
import { useCartStore } from "../../store/cartStore"

function Confetti() {
  const colors = ["#1aff6e","#facc15","#60a5fa","#f87171","#c084fc","#fb923c"]
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id:    i,
    color: colors[i % colors.length],
    left:  `${Math.random() * 100}%`,
    delay: `${Math.random() * 2}s`,
    dur:   `${2.5 + Math.random() * 2}s`,
    size:  `${5 + Math.random() * 9}px`,
    rotate:`${Math.random() * 360}deg`,
  }))

  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none",
      zIndex:0, overflow:"hidden" }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position:   "absolute", top: "-20px", left: p.left,
          width: p.size, height: p.size,
          background: p.color, borderRadius: "2px",
          opacity: 0.75,
          animation: `confettiFall ${p.dur} ${p.delay} ease-in forwards`,
          transform: `rotate(${p.rotate})`,
        }} />
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

export default function PaymentSuccess() {
  const [searchParams]    = useSearchParams()
  const navigate          = useNavigate()
  const orderId           = searchParams.get("order")
  const [confetti, setConfetti] = useState(true)
  const { clearCart }     = useCartStore()

  useEffect(() => {
    clearCart()
    const t = setTimeout(() => setConfetti(false), 4500)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!orderId) {
      setTimeout(() => navigate("/"), 3000)
    }
  }, [orderId])

  const { data: order, isLoading } = useQuery({
    queryKey:        ["order", orderId],
    queryFn:         () => getOrder(orderId),
    enabled:         !!orderId,
    refetchInterval: (data) => data?.status === "pending" ? 3000 : false,
  })

  if (!orderId) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center" }}>
      <p style={{ color: "var(--text-3)" }}>Redirigiendo...</p>
    </div>
  )

  return (
    <div style={{
      minHeight:      "100vh",
      background:     "var(--bg)",
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      padding:        "clamp(24px, 5vw, 60px)",
      position:       "relative",
      background:     `radial-gradient(ellipse 60% 60% at 50% 30%,
        rgba(26,255,110,0.08) 0%, transparent 70%), var(--bg)`,
    }}>
      {confetti && <Confetti />}

      <div style={{
        position:       "relative",
        zIndex:         1,
        width:          "100%",
        maxWidth:       "560px",
        display:        "flex",
        flexDirection:  "column",
        gap:            "16px",
      }}
        className="animate-fade-up"
      >
        {/* Hero de éxito */}
        <div style={{
          background:   "var(--surface)",
          border:       "1px solid rgba(26,255,110,0.2)",
          borderRadius: "var(--r-2xl)",
          padding:      "clamp(32px, 5vw, 48px)",
          textAlign:    "center",
          boxShadow:    "0 0 80px rgba(26,255,110,0.06)",
        }}>
          {/* Ícono */}
          <div style={{
            width:           "80px",
            height:          "80px",
            borderRadius:    "50%",
            background:      "rgba(26,255,110,0.1)",
            border:          "2px solid rgba(26,255,110,0.3)",
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            margin:          "0 auto 24px",
            fontSize:        "36px",
            color:           "var(--accent)",
            animation:       "scaleIn 400ms var(--ease)",
          }}>
            ✓
          </div>

          <h1 style={{
            fontFamily:    "var(--font-serif)",
            fontSize:      "clamp(2rem, 4vw, 3rem)",
            fontWeight:    300,
            letterSpacing: "-0.02em",
            marginBottom:  "12px",
          }}>
            ¡Compra exitosa!
          </h1>

          <p style={{ fontSize: "15px", color: "var(--text-2)",
            lineHeight: 1.7, marginBottom: "20px" }}>
            {order?.status === "pending"
              ? "Estamos procesando tu pago. Recibirás una confirmación pronto."
              : "Tu pago fue confirmado. ¡Gracias por tu compra en LevelPro Audio!"}
          </p>

          {order && (
            <div style={{
              display:        "inline-flex",
              alignItems:     "center",
              gap:            "8px",
              padding:        "6px 16px",
              borderRadius:   "var(--r-full)",
              background:     order.status === "paid" || order.status === "completed"
                ? "rgba(26,255,110,0.1)" : "rgba(250,204,21,0.1)",
              border:         order.status === "paid" || order.status === "completed"
                ? "1px solid rgba(26,255,110,0.2)" : "1px solid rgba(250,204,21,0.2)",
              fontSize:       "13px",
              fontWeight:     500,
              color:          order.status === "paid" || order.status === "completed"
                ? "var(--accent)" : "#facc15",
            }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%",
                background: "currentColor", display: "inline-block" }} />
              {order.status === "paid" || order.status === "completed"
                ? "Pago confirmado" : "Procesando pago..."}
            </div>
          )}
        </div>

        {/* Comprobante */}
        {isLoading && (
          <div className="skeleton" style={{ height: "300px", borderRadius: "var(--r-2xl)" }} />
        )}

        {order && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-2xl)", overflow: "hidden" }}>

            {/* Header comprobante */}
            <div style={{ padding: "16px 24px", background: "var(--surface-2)",
              borderBottom: "1px solid var(--border)",
              display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-2)",
                textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Comprobante
              </p>
              <p style={{ fontSize: "12px", fontFamily: "monospace",
                color: "var(--text-3)" }}>
                #{order.id.slice(0, 8).toUpperCase()}
              </p>
            </div>

            {/* Datos */}
            <div style={{ padding: "20px 24px" }}>
              {[
                { label: "Email",  value: order.email },
                { label: "Fecha",  value: new Date(order.created_at).toLocaleDateString("es-CL", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric" }) },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "10px 0",
                  borderBottom: "1px solid var(--border)", fontSize: "13px" }}>
                  <span style={{ color: "var(--text-3)" }}>{label}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>

            {/* Productos */}
            <div style={{ borderTop: "1px solid var(--border)" }}>
              <div style={{ padding: "10px 24px", background: "var(--surface-2)",
                borderBottom: "1px solid var(--border)" }}>
                <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-3)",
                  textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Productos
                </p>
              </div>
              {order.items?.map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "14px 24px",
                  borderBottom: i < order.items.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div>
                    <p style={{ fontSize: "14px", marginBottom: "2px" }}>{item.product_name}</p>
                    <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                      ${Number(item.price).toLocaleString("es-CL")} × {item.quantity}
                    </p>
                  </div>
                  <p style={{ fontSize: "14px", fontWeight: 500 }}>
                    ${Number(item.subtotal).toLocaleString("es-CL")}
                  </p>
                </div>
              ))}

              {/* Total */}
              <div style={{ display: "flex", justifyContent: "space-between",
                alignItems: "baseline", padding: "18px 24px",
                background: "var(--surface-2)",
                borderTop: "1px solid var(--border)" }}>
                <span style={{ fontSize: "15px", fontWeight: 500 }}>Total</span>
                <span style={{ fontFamily: "var(--font-serif)", fontSize: "2rem",
                  color: "var(--accent)" }}>
                  ${Number(order.total).toLocaleString("es-CL")}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Aviso pendiente */}
        {order?.status === "pending" && (
          <div style={{ padding: "16px 20px", borderRadius: "var(--r-xl)",
            background: "rgba(250,204,21,0.06)",
            border: "1px solid rgba(250,204,21,0.2)",
            display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <span style={{ fontSize: "20px", flexShrink: 0 }}>⏳</span>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 500, marginBottom: "4px",
                color: "#facc15" }}>
                Pago en proceso
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
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)", padding: "20px 24px" }}>
          <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "14px" }}>
            ¿Qué sigue?
          </p>
          {[
            { icon: "📧", text: "Recibirás un email con el detalle de tu compra." },
            { icon: "📦", text: "Coordinaremos el envío por email o WhatsApp." },
            { icon: "🎓", text: "Para cursos digitales, ya tenés acceso en tu cuenta." },
          ].map(({ icon, text }) => (
            <div key={text} style={{ display: "flex", gap: "12px",
              alignItems: "flex-start", marginBottom: "10px" }}>
              <span style={{ fontSize: "18px", flexShrink: 0 }}>{icon}</span>
              <p style={{ fontSize: "13px", color: "var(--text-2)", lineHeight: 1.6 }}>
                {text}
              </p>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div style={{ display: "flex", gap: "10px" }}>
          <Link to="/dashboard/orders" className="btn btn-accent"
            style={{ flex: 1, justifyContent: "center" }}>
            Ver mis pedidos
          </Link>
          <Link to="/shop" className="btn btn-ghost"
            style={{ flex: 1, justifyContent: "center" }}>
            Seguir comprando
          </Link>
        </div>

        {/* WhatsApp */}
        <a href="https://wa.me/5492622635045" target="_blank" rel="noreferrer"
          style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            gap:            "8px",
            padding:        "14px",
            borderRadius:   "var(--r-xl)",
            background:     "rgba(37,211,102,0.06)",
            border:         "1px solid rgba(37,211,102,0.15)",
            color:          "#25d166",
            fontSize:       "13px",
            fontWeight:     500,
            textDecoration: "none",
            transition:     "all var(--dur) var(--ease)",
          }}>
          💬 ¿Consultas? Escribinos por WhatsApp
        </a>
      </div>
    </div>
  )
}