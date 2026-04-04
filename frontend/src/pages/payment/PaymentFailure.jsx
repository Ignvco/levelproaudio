// pages/PaymentFailure.jsx

import { useSearchParams, Link } from "react-router-dom"

export default function PaymentFailure() {
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get("order")

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "clamp(24px, 5vw, 60px)",
    }}>
      <div style={{
        width: "100%", maxWidth: "480px",
        display: "flex", flexDirection: "column", gap: "16px",
      }}>
        <div style={{
          background: "var(--surface)",
          border: "1px solid rgba(248,113,113,0.2)",
          borderRadius: "var(--r-xl)", padding: "40px 32px",
          textAlign: "center",
        }}>
          <div style={{
            width: "72px", height: "72px", borderRadius: "50%",
            background: "rgba(248,113,113,0.1)",
            border: "2px solid rgba(248,113,113,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px", fontSize: "32px",
          }}>
            ✕
          </div>

          <h1 style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
            marginBottom: "10px",
          }}>
            El pago no se completó
          </h1>

          <p style={{ fontSize: "14px", color: "var(--text-2)", lineHeight: 1.6 }}>
            No se realizó ningún cobro. Podés intentarlo nuevamente con
            otro método de pago.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          {orderId && (
            <Link
              to={`/dashboard/orders/${orderId}`}
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
      </div>
    </div>
  )
}