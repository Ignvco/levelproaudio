// pages/payment/TransferInstructions.jsx
import { useParams, useLocation, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getOrder } from "../../api/orders.api"

export default function TransferInstructions() {
  const { id }         = useParams()
  const { state }      = useLocation()
  const transferData   = state?.transferData

  const { data: order } = useQuery({
    queryKey: ["order", id],
    queryFn:  () => getOrder(id),
    enabled:  !!id,
  })

  const steps = [
    { n: "1", title: "Realizá la transferencia",
      desc: `Transferí exactamente $${Number(transferData?.amount || order?.total || 0).toLocaleString("es-CL")} al alias indicado.` },
    { n: "2", title: "Incluí la referencia",
      desc: `En el comentario de la transferencia escribí: ${transferData?.reference || "LEVELPRO-" + id?.slice(0,8).toUpperCase()}` },
    { n: "3", title: "Envianos el comprobante",
      desc: "Mandanos una captura del comprobante por WhatsApp o email y procesamos tu pedido en menos de 24hs hábiles." },
  ]

  return (
    <div style={{
      minHeight:      "100vh",
      background:     "var(--bg)",
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      padding:        "clamp(24px, 5vw, 60px)",
      background: `radial-gradient(ellipse 60% 50% at 50% 30%,
        rgba(96,165,250,0.05) 0%, transparent 70%), var(--bg)`,
    }}>
      <div style={{ width: "100%", maxWidth: "560px",
        display: "flex", flexDirection: "column", gap: "16px" }}
        className="animate-fade-up"
      >
        {/* Header */}
        <div style={{
          background:   "var(--surface)",
          border:       "1px solid rgba(96,165,250,0.2)",
          borderRadius: "var(--r-2xl)",
          padding:      "clamp(32px, 5vw, 48px)",
          textAlign:    "center",
        }}>
          <div style={{
            width: "72px", height: "72px", borderRadius: "50%",
            background: "rgba(96,165,250,0.1)",
            border: "2px solid rgba(96,165,250,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px", fontSize: "32px",
          }}>
            🏦
          </div>
          <h1 style={{ fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.8rem, 4vw, 2.6rem)", fontWeight: 300,
            letterSpacing: "-0.02em", marginBottom: "10px" }}>
            Instrucciones de transferencia
          </h1>
          <p style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.7 }}>
            Completá el pago siguiendo estos pasos. Tu pedido se activará
            una vez confirmada la transferencia.
          </p>
        </div>

        {/* Datos bancarios */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-2xl)", overflow: "hidden",
        }}>
          <div style={{ padding: "16px 24px", background: "var(--surface-2)",
            borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-3)",
              textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Datos para transferir
            </p>
          </div>
          <div style={{ padding: "20px 24px",
            display: "flex", flexDirection: "column", gap: "0" }}>
            {[
              { label: "Alias / Cuenta",  value: transferData?.alias        || "levelproaudio" },
              { label: "Nombre",          value: transferData?.account_name  || "LevelPro Audio" },
              { label: "Banco",           value: transferData?.bank          || "Global66"       },
              { label: "Monto exacto",    value: `$${Number(transferData?.amount || order?.total || 0).toLocaleString("es-CL")}`, accent: true },
              { label: "Referencia",      value: transferData?.reference     || `LEVELPRO-${id?.slice(0,8).toUpperCase()}`, mono: true },
            ].map(({ label, value, accent, mono }, i, arr) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "14px 0",
                borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                gap: "16px",
              }}>
                <span style={{ fontSize: "13px", color: "var(--text-3)",
                  flexShrink: 0 }}>
                  {label}
                </span>
                <span style={{
                  fontSize:    accent ? "1.3rem" : "14px",
                  fontWeight:  accent ? 600 : 500,
                  color:       accent ? "var(--accent)" : "var(--text)",
                  fontFamily:  mono ? "monospace" : "inherit",
                  textAlign:   "right",
                }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pasos */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-2xl)", padding: "24px",
          display: "flex", flexDirection: "column", gap: "20px",
        }}>
          <p style={{ fontSize: "13px", fontWeight: 600 }}>Cómo completar el pago</p>
          {steps.map(({ n, title, desc }) => (
            <div key={n} style={{ display: "flex", gap: "16px" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "50%",
                background: "var(--accent-dim)", border: "1px solid var(--accent-glow)",
                color: "var(--accent)", fontSize: "12px", fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {n}
              </div>
              <div>
                <p style={{ fontSize: "14px", fontWeight: 500, marginBottom: "4px" }}>
                  {title}
                </p>
                <p style={{ fontSize: "13px", color: "var(--text-3)", lineHeight: 1.6 }}>
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Acciones */}
        <div style={{ display: "flex", gap: "10px" }}>
          <a href={transferData?.whatsapp || "https://wa.me/5492622635045"}
            target="_blank" rel="noreferrer"
            className="btn btn-accent"
            style={{ flex: 1, justifyContent: "center" }}>
            💬 Enviar comprobante por WhatsApp
          </a>
        </div>

        <Link to="/dashboard/orders" style={{
          textAlign: "center", fontSize: "13px", color: "var(--text-3)",
          padding: "8px", transition: "color var(--dur)",
        }}
          className="hover-accent"
        >
          Ver mis pedidos →
        </Link>
      </div>
    </div>
  )
}