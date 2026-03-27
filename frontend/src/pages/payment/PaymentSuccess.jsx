// pages/payment/PaymentSuccess.jsx

import { useEffect, useState } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { getPaymentStatus, capturePayPal } from "../../api/payments.api"
import iconImg from "../../assets/icon.png"

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState("loading")

  const orderId         = searchParams.get("order")
  const paypalPaymentId = searchParams.get("paymentId")
  const payerId         = searchParams.get("PayerID")

  useEffect(() => {
    const process = async () => {
      try {
        if (paypalPaymentId && payerId) {
          await capturePayPal(paypalPaymentId, payerId)
        }
        if (orderId) {
          const data = await getPaymentStatus(orderId)
          setStatus(data.status === "approved" ? "approved" : "pending")
        } else {
          setStatus("pending")
        }
      } catch {
        setStatus("pending")
      }
    }
    process()
  }, [orderId, paypalPaymentId, payerId])

  const config = {
    loading:  { icon: "⏳", title: "Procesando pago...",    desc: "Esto puede tomar unos segundos.", color: "var(--text-2)" },
    approved: { icon: "✓",  title: "Pago confirmado.",      desc: "Tu pedido fue procesado. Recibirás un email de confirmación.", color: "var(--accent)" },
    pending:  { icon: "⏳", title: "Pago en proceso.",      desc: "Te notificaremos cuando sea confirmado.", color: "#facc15" },
  }

  const c = config[status] || config.pending

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
          background: `${c.color}14`, border: `1px solid ${c.color}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "24px", margin: "0 auto 24px", color: c.color,
          fontWeight: 600,
        }}>
          {c.icon}
        </div>

        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem",
          marginBottom: "12px", color: c.color }}>
          {c.title}
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-2)", lineHeight: 1.7, marginBottom: "32px" }}>
          {c.desc}
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