// pages/payment/PaymentFailure.jsx
import { useSearchParams, Link } from "react-router-dom"

export default function PaymentFailure() {
  const [searchParams] = useSearchParams()
  const orderId        = searchParams.get("order")

  return (
    <div style={{
      minHeight:      "100vh",
      background:     "var(--bg)",
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      padding:        "clamp(24px, 5vw, 60px)",
      background:     `radial-gradient(ellipse 50% 50% at 50% 30%,
        rgba(248,113,113,0.06) 0%, transparent 70%), var(--bg)`,
    }}>
      <div style={{ width: "100%", maxWidth: "440px",
        display: "flex", flexDirection: "column", gap: "16px" }}
        className="animate-fade-up"
      >
        <div style={{
          background:   "var(--surface)",
          border:       "1px solid rgba(248,113,113,0.2)",
          borderRadius: "var(--r-2xl)",
          padding:      "clamp(40px, 6vw, 56px)",
          textAlign:    "center",
        }}>
          <div style={{
            width:           "80px",
            height:          "80px",
            borderRadius:    "50%",
            background:      "rgba(248,113,113,0.1)",
            border:          "2px solid rgba(248,113,113,0.3)",
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            margin:          "0 auto 24px",
            fontSize:        "36px",
            color:           "#f87171",
          }}>
            ✕
          </div>

          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
            fontWeight: 300, marginBottom: "12px", letterSpacing: "-0.02em" }}>
            El pago no se completó
          </h1>
          <p style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.7 }}>
            No se realizó ningún cobro. Podés intentarlo
            nuevamente con otro método de pago.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          {orderId && (
            <Link to={`/dashboard/orders/${orderId}`}
              className="btn btn-accent"
              style={{ flex: 1, justifyContent: "center" }}>
              Reintentar pago
            </Link>
          )}
          <Link to="/shop" className="btn btn-ghost"
            style={{ flex: 1, justifyContent: "center" }}>
            Volver a la tienda
          </Link>
        </div>

        <a href="https://wa.me/5492622635045" target="_blank" rel="noreferrer"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: "8px", padding: "14px", borderRadius: "var(--r-xl)",
            background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.15)",
            color: "#25d166", fontSize: "13px", fontWeight: 500,
            textDecoration: "none",
          }}>
          💬 ¿Necesitás ayuda? Escribinos
        </a>
      </div>
    </div>
  )
}