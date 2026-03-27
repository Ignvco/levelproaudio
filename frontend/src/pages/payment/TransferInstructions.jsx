// pages/payment/TransferInstructions.jsx

import { useLocation, Link } from "react-router-dom"

export default function TransferInstructions() {
  const { state } = useLocation()
  const data      = state?.transferData

  const copy = (text) => navigator.clipboard.writeText(text)

  if (!data) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "40px", background: "var(--bg)" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "var(--text-2)", marginBottom: "16px" }}>
          No se encontraron datos de transferencia.
        </p>
        <Link to="/" className="btn btn-ghost">Volver al inicio</Link>
      </div>
    </div>
  )

  const rows = [
    { label: "Banco / Plataforma",     value: data.bank,         highlight: false },
    { label: "Nombre de cuenta",       value: data.account_name, highlight: false },
    { label: "Alias / Usuario",        value: data.alias,        highlight: false },
    { label: "Email",                  value: data.email,        highlight: false },
    { label: "Monto exacto",           value: `$${Number(data.amount).toLocaleString("es-CL")} CLP`, highlight: true },
    { label: "Referencia (obligatorio)",value: data.reference,   highlight: true },
  ]

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "24px", background: "var(--bg)" }}>
      <div style={{
        width: "100%", maxWidth: "440px",
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)", padding: "36px",
      }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{
            width: "52px", height: "52px", borderRadius: "50%",
            background: "var(--surface-2)", border: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "22px", margin: "0 auto 16px",
          }}>
            🏦
          </div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.6rem", marginBottom: "6px" }}>
            Instrucciones de transferencia
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            Realiza la transferencia con los datos exactos
          </p>
        </div>

        {/* Datos */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
          {rows.map(({ label, value, highlight }) => (
            <div key={label} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 14px", borderRadius: "var(--r-md)", gap: "12px",
              background: highlight ? "var(--accent-glow)" : "var(--surface-2)",
              border: `1px solid ${highlight ? "rgba(26,255,110,0.2)" : "var(--border)"}`,
            }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "2px",
                  textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>
                  {label}
                </p>
                <p style={{ fontSize: "14px", fontWeight: highlight ? 600 : 400,
                  color: highlight ? "var(--accent)" : "var(--text)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {value}
                </p>
              </div>
              <button onClick={() => copy(value)}
                style={{
                  flexShrink: 0, padding: "4px 10px", borderRadius: "var(--r-sm)",
                  fontSize: "11px", fontWeight: 500, cursor: "pointer",
                  background: "none", border: "1px solid var(--border)",
                  color: "var(--text-3)", transition: "all var(--dur) var(--ease)",
                }}
                className="hover:border-[var(--border-hover)] hover:text-[var(--text-2)]">
                Copiar
              </button>
            </div>
          ))}
        </div>

        {/* Instrucciones */}
        <div style={{
          padding: "14px", borderRadius: "var(--r-md)",
          background: "var(--surface-2)", border: "1px solid var(--border)",
          marginBottom: "20px",
        }}>
          <p style={{ fontSize: "12px", fontWeight: 500, marginBottom: "6px" }}>⚠️ Importante</p>
          <p style={{ fontSize: "12px", color: "var(--text-2)", lineHeight: 1.65 }}>
            {data.instructions}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <a href={data.whatsapp} target="_blank" rel="noreferrer"
            className="btn" style={{
              justifyContent: "center",
              background: "#22c55e", color: "#fff",
            }}>
            💬 Enviar comprobante por WhatsApp
          </a>
          <Link to="/dashboard/orders" className="btn btn-ghost"
            style={{ justifyContent: "center" }}>
            Ver mis pedidos
          </Link>
        </div>
      </div>
    </div>
  )
}