// pages/payment/PaymentFailure.jsx

import { Link, useSearchParams } from "react-router-dom"

export default function PaymentFailure() {
  const [searchParams] = useSearchParams()
  const orderId        = searchParams.get("order")

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
          style={{ backgroundColor: "rgba(255,68,68,0.1)" }}
        >
          <span className="text-4xl">❌</span>
        </div>

        <h1 className="text-2xl font-black mb-3" style={{ color: "var(--color-danger)" }}>
          Pago no completado
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--color-text-muted)" }}>
          El pago fue cancelado o rechazado. No se realizó ningún cobro.
          Puedes intentar con otro método de pago.
        </p>

        <div className="space-y-3">
          {orderId && (
            <Link
              to="/checkout"
              className="block w-full py-3 rounded-xl font-semibold text-sm"
              style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
            >
              Intentar de nuevo
            </Link>
          )}
          <Link
            to="/cart"
            className="block w-full py-3 rounded-xl font-semibold text-sm"
            style={{
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            Volver al carrito
          </Link><a
          
            href="https://wa.me/5492622635045"
            target="_blank"
            rel="noreferrer"
            className="block w-full py-3 rounded-xl font-semibold text-sm"
            style={{ backgroundColor: "#25d366", color: "#fff" }}
          >
            💬 Necesito ayuda
          </a>
        </div>
      </div>
    </div>
  )
}