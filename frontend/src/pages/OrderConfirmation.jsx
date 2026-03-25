// pages/OrderConfirmation.jsx
// Pantalla de confirmación después de crear la orden exitosamente

import { Link, useParams } from "react-router-dom"

export default function OrderConfirmation() {
  const { id } = useParams()

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div
        className="max-w-md w-full text-center rounded-2xl p-10"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: "rgba(0,230,118,0.1)" }}
        >
          <span className="text-3xl">✓</span>
        </div>

        <h1 className="text-2xl font-black mb-2">
          ¡Pedido confirmado!
        </h1>

        <p className="text-sm mb-2" style={{ color: "var(--color-text-muted)" }}>
          Número de orden:
        </p>
        <p
          className="font-mono text-xs mb-6 px-3 py-2 rounded-lg"
          style={{
            color: "var(--color-accent)",
            backgroundColor: "var(--color-surface-2)",
          }}
        >
          {id}
        </p>

        <p className="text-sm mb-8" style={{ color: "var(--color-text-muted)" }}>
          Nos pondremos en contacto contigo a la brevedad para coordinar el pago y envío.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            to="/dashboard"
            className="py-2.5 rounded-lg font-semibold text-sm"
            style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
          >
            Ver mis pedidos
          </Link>
          <Link
            to="/shop"
            className="py-2.5 rounded-lg font-semibold text-sm"
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