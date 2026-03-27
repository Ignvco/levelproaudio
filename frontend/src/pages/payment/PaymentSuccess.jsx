// pages/payment/PaymentSuccess.jsx
// Pantalla de éxito después del pago con MP o PayPal

import { useEffect, useState } from "react"
import { useSearchParams, Link, useNavigate } from "react-router-dom"
import { getPaymentStatus } from "../../api/payments.api"
import { capturePayPal } from "../../api/payments.api"

export default function PaymentSuccess() {
  const [searchParams]  = useSearchParams()
  const [status, setStatus] = useState("loading")
  const navigate        = useNavigate()

  const orderId          = searchParams.get("order")
  const paypalPaymentId  = searchParams.get("paymentId")
  const payerId          = searchParams.get("PayerID")

  useEffect(() => {
    const process = async () => {
      try {
        // Si viene de PayPal necesita capturar el pago
        if (paypalPaymentId && payerId) {
          await capturePayPal(paypalPaymentId, payerId)
        }

        // Verifica el estado final
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
    loading: {
      icon:  "⏳",
      title: "Procesando pago...",
      desc:  "Esto puede tomar unos segundos.",
      color: "#f59e0b",
    },
    approved: {
      icon:  "✅",
      title: "¡Pago confirmado!",
      desc:  "Tu pedido fue procesado exitosamente. Recibirás un email de confirmación.",
      color: "#00e676",
    },
    pending: {
      icon:  "⏳",
      title: "Pago pendiente",
      desc:  "Tu pago está siendo procesado. Te notificaremos cuando sea confirmado.",
      color: "#f59e0b",
    },
  }

  const c = config[status] || config.pending

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-10 text-center"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: `${c.color}18` }}
        >
          <span className="text-4xl">{c.icon}</span>
        </div>

        <h1 className="text-2xl font-black mb-3" style={{ color: c.color }}>
          {c.title}
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--color-text-muted)" }}>
          {c.desc}
        </p>

        <div className="space-y-3">
          <Link
            to="/dashboard/orders"
            className="block w-full py-3 rounded-xl font-semibold text-sm"
            style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
          >
            Ver mis pedidos
          </Link>
          <Link
            to="/shop"
            className="block w-full py-3 rounded-xl font-semibold text-sm"
            style={{
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            Seguir comprando
          </Link>
        </div>
      </div>
    </div>
  )
}