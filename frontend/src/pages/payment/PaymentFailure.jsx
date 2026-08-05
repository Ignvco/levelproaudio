// pages/payment/PaymentFailure.jsx
import { useSearchParams, Link } from "react-router-dom"
import { X, MessageCircle, ArrowRight } from "lucide-react"
import { useSiteSettings } from "../../hooks/useSiteSettings"

export default function PaymentFailure() {
  const { whatsappUrl } = useSiteSettings()
  const [searchParams] = useSearchParams()
  const orderId        = searchParams.get("order")

  return (
    <div data-testid="payment-failure-page" style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "clamp(104px, 12vw, 130px) clamp(20px, 5vw, 60px) clamp(60px, 8vw, 90px)",
      background: `radial-gradient(ellipse 50% 50% at 50% 20%, rgba(248,113,113,0.07) 0%, transparent 70%), var(--bg)`,
    }}>
      <div style={{ width: "100%", maxWidth: "460px",
        display: "flex", flexDirection: "column", gap: "16px" }} className="animate-fade-up">

        <div style={{ background: "#121212", border: "1px solid rgba(248,113,113,0.2)",
          borderRadius: "var(--r-2xl)", padding: "clamp(40px, 6vw, 56px)", textAlign: "center" }}>
          <div style={{ width: "80px", height: "80px", borderRadius: "50%",
            background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)",
            color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px" }}>
            <X size={38} strokeWidth={3} />
          </div>

          <h1 className="display-bold" style={{ fontFamily: "var(--font-display)",
            fontSize: "clamp(1.8rem, 4vw, 2.5rem)", fontWeight: 800,
            letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: "12px", color: "var(--text)" }}>
            El pago no se completó
          </h1>
          <p style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.7 }}>
            No se realizó ningún cobro. Podés intentarlo
            nuevamente con otro método de pago.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          {orderId && (
            <Link to={`/dashboard/orders/${orderId}`} data-testid="failure-retry" style={{
              flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
              padding: "14px", borderRadius: "var(--r-full)", background: "var(--accent)",
              color: "#000", fontSize: "14px", fontWeight: 700, textDecoration: "none",
              boxShadow: "0 8px 30px rgba(26,255,110,0.25)" }}>
              Reintentar pago <ArrowRight size={14} />
            </Link>
          )}
          <Link to="/shop" style={{
            flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "14px", borderRadius: "var(--r-full)", background: "rgba(255,255,255,0.04)",
            color: "var(--text)", border: "1px solid rgba(255,255,255,0.12)",
            fontSize: "14px", fontWeight: 600, textDecoration: "none" }}>
            Volver a la tienda
          </Link>
        </div>

        <a href={whatsappUrl} target="_blank" rel="noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            padding: "14px", borderRadius: "var(--r-xl)", background: "rgba(37,211,102,0.06)",
            border: "1px solid rgba(37,211,102,0.15)", color: "#25d166", fontSize: "13px",
            fontWeight: 600, textDecoration: "none" }}>
          <MessageCircle size={16} /> ¿Necesitás ayuda? Escribinos
        </a>
      </div>
    </div>
  )
}
