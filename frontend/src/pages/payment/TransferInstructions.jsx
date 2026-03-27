// pages/payment/TransferInstructions.jsx
// Instrucciones de transferencia via Global66

import { useLocation, Link } from "react-router-dom"

export default function TransferInstructions() {
  const { state } = useLocation()
  const data      = state?.transferData

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p style={{ color: "var(--color-text-muted)" }}>
            No se encontraron datos de transferencia.
          </p>
          <Link to="/" style={{ color: "var(--color-accent)" }}
            className="mt-4 inline-block text-sm"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div
      className="min-h-screen py-10 px-4 flex items-center justify-center"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-8"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: "rgba(0,230,118,0.1)" }}
          >
            <span className="text-3xl">🏦</span>
          </div>
          <h1 className="text-2xl font-black mb-2">Instrucciones de transferencia</h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Realiza la transferencia con los siguientes datos
          </p>
        </div>

        {/* Datos */}
        <div className="space-y-3 mb-6">
          {[
            { label: "Banco / Plataforma",  value: data.bank },
            { label: "Nombre de cuenta",    value: data.account_name },
            { label: "Alias / Usuario",     value: data.alias },
            { label: "Email",               value: data.email },
            { label: "Monto exacto",
              value: `$${Number(data.amount).toLocaleString("es-CL")} CLP`,
              highlight: true
            },
            { label: "Referencia (obligatorio)",
              value: data.reference,
              highlight: true
            },
          ].map(({ label, value, highlight }) => (
            <div
              key={label}
              className="flex items-center justify-between p-3 rounded-xl"
              style={{
                backgroundColor: highlight
                  ? "rgba(0,230,118,0.05)"
                  : "var(--color-surface-2)",
                border: highlight
                  ? "1px solid var(--color-accent)"
                  : "1px solid var(--color-border)",
              }}
            >
              <div>
                <p className="text-xs mb-0.5" style={{ color: "var(--color-text-muted)" }}>
                  {label}
                </p>
                <p
                  className="font-bold text-sm"
                  style={{ color: highlight ? "var(--color-accent)" : "var(--color-text)" }}
                >
                  {value}
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(value)}
                className="text-xs px-2 py-1 rounded-lg transition-colors"
                style={{
                  color: "var(--color-text-muted)",
                  border: "1px solid var(--color-border)",
                }}
              >
                Copiar
              </button>
            </div>
          ))}
        </div>

        {/* Instrucciones */}
        <div
          className="rounded-xl p-4 mb-6 text-sm"
          style={{
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
          }}
        >
          <p className="font-semibold mb-2">⚠️ Importante</p>
          <p style={{ color: "var(--color-text-muted)" }} className="leading-relaxed">
            {data.instructions}
          </p>
        </div>

        {/* CTAs */}
        <div className="space-y-3"><a
          
            href={data.whatsapp}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm"
            style={{ backgroundColor: "#25d366", color: "#fff" }}
          >
            <span>💬</span>
            Enviar comprobante por WhatsApp
          </a>
          <Link
            to="/dashboard/orders"
            className="flex items-center justify-center w-full py-3 rounded-xl font-semibold text-sm"
            style={{
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            Ver mis pedidos
          </Link>
        </div>
      </div>
    </div>
  )
}