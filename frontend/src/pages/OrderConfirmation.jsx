// pages/OrderConfirmation.jsx

import { Link, useParams } from "react-router-dom"

export default function OrderConfirmation() {
  const { id } = useParams()

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "40px", background: "var(--bg)",
    }}>
      <div style={{
        width: "100%", maxWidth: "420px", textAlign: "center",
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)", padding: "48px 40px",
      }}>
        <div style={{
          width: "64px", height: "64px", borderRadius: "50%",
          background: "var(--accent-glow)", border: "1px solid rgba(26,255,110,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "22px", margin: "0 auto 24px", color: "var(--accent)",
          fontWeight: 600,
        }}>
          ✓
        </div>

        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "2rem",
          marginBottom: "10px" }}>
          ¡Pedido confirmado!
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-3)", marginBottom: "6px" }}>
          Número de orden
        </p>
        <p style={{
          fontFamily: "monospace", fontSize: "12px",
          padding: "8px 16px", borderRadius: "var(--r-md)",
          background: "var(--surface-2)", border: "1px solid var(--border)",
          color: "var(--accent)", display: "inline-block", marginBottom: "20px",
          letterSpacing: "0.05em",
        }}>
          {id}
        </p>
        <p style={{ fontSize: "14px", color: "var(--text-2)", lineHeight: 1.7, marginBottom: "32px" }}>
          Nos pondremos en contacto para coordinar el pago y envío.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <Link to="/dashboard/orders" className="btn btn-accent"
            style={{ justifyContent: "center" }}>
            Ver mis pedidos
          </Link>
          <Link to="/shop" className="btn btn-ghost"
            style={{ justifyContent: "center" }}>
            Seguir comprando
          </Link>
        </div>
      </div>
    </div>
  )
}