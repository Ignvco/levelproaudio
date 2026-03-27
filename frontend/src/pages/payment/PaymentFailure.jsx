// pages/payment/PaymentFailure.jsx

import { Link } from "react-router-dom"

export default function PaymentFailure() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "40px", background: "var(--bg)",
    }}>
      <div style={{
        width: "100%", maxWidth: "400px", textAlign: "center",
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)", padding: "48px 40px",
      }}>
        <div style={{
          width: "64px", height: "64px", borderRadius: "50%",
          background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "22px", margin: "0 auto 24px", color: "var(--danger)",
        }}>
          ✕
        </div>

        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem",
          marginBottom: "12px" }}>
          Pago no completado.
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-2)", lineHeight: 1.7, marginBottom: "32px" }}>
          El pago fue cancelado o rechazado. No se realizó ningún cobro.
          Puedes intentar con otro método de pago.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <Link to="/checkout" className="btn btn-accent" style={{ justifyContent: "center" }}>
            Intentar de nuevo
          </Link>
          <Link to="/cart" className="btn btn-ghost" style={{ justifyContent: "center" }}>
            Volver al carrito
          </Link>
          <a href="https://wa.me/5492622635045" target="_blank" rel="noreferrer"
            className="btn btn-ghost" style={{ justifyContent: "center", color: "#4ade80", borderColor: "rgba(74,222,128,0.2)" }}>
            💬 Necesito ayuda
          </a>
        </div>
      </div>
    </div>
  )
}