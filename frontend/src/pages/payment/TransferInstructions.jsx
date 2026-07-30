// pages/payment/TransferInstructions.jsx
import { useParams, useLocation, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Landmark, MessageCircle, ArrowRight } from "lucide-react"
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
    <div data-testid="transfer-page" style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "clamp(104px, 12vw, 130px) clamp(20px, 5vw, 60px) clamp(60px, 8vw, 90px)",
      background: `radial-gradient(ellipse 60% 50% at 50% 20%, rgba(96,165,250,0.06) 0%, transparent 70%), var(--bg)`,
    }}>
      <div style={{ width: "100%", maxWidth: "560px",
        display: "flex", flexDirection: "column", gap: "16px" }} className="animate-fade-up">

        {/* Header */}
        <div style={{ background: "#121212", border: "1px solid rgba(96,165,250,0.2)",
          borderRadius: "var(--r-2xl)", padding: "clamp(32px, 5vw, 48px)", textAlign: "center" }}>
          <div style={{ width: "72px", height: "72px", borderRadius: "50%",
            background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.3)",
            color: "#60a5fa", display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px" }}>
            <Landmark size={30} />
          </div>
          <h1 className="display-bold" style={{ fontFamily: "var(--font-display)",
            fontSize: "clamp(1.7rem, 3.6vw, 2.4rem)", fontWeight: 800,
            letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: "12px", color: "var(--text)" }}>
            Instrucciones de transferencia
          </h1>
          <p style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.7 }}>
            Completá el pago siguiendo estos pasos. Tu pedido se activará
            una vez confirmada la transferencia.
          </p>
        </div>

        {/* Datos bancarios */}
        <div style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "var(--r-2xl)", overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)",
              textTransform: "uppercase", letterSpacing: "0.15em" }}>
              · Datos para transferir
            </p>
          </div>
          <div style={{ padding: "8px 24px 16px" }}>
            {[
              { label: "Alias / Cuenta",  value: transferData?.alias        || "levelproaudio" },
              { label: "Nombre",          value: transferData?.account_name  || "LevelPro Audio" },
              { label: "Banco",           value: transferData?.bank          || "Global66"       },
              { label: "Monto exacto",    value: `$${Number(transferData?.amount || order?.total || 0).toLocaleString("es-CL")}`, accent: true },
              { label: "Referencia",      value: transferData?.reference     || `LEVELPRO-${id?.slice(0,8).toUpperCase()}`, mono: true },
            ].map(({ label, value, accent, mono }, i, arr) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "14px 0", gap: "16px",
                borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
                <span style={{ fontSize: "13px", color: "var(--text-3)", flexShrink: 0 }}>{label}</span>
                <span style={{
                  fontFamily: mono ? "monospace" : accent ? "var(--font-display)" : "inherit",
                  fontSize: accent ? "1.4rem" : "14px",
                  fontWeight: accent ? 800 : 600,
                  letterSpacing: accent ? "-0.02em" : 0,
                  color: accent ? "var(--accent)" : "var(--text)", textAlign: "right" }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pasos */}
        <div style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "var(--r-2xl)", padding: "24px",
          display: "flex", flexDirection: "column", gap: "18px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)",
            textTransform: "uppercase", letterSpacing: "0.15em" }}>· Cómo completar el pago</p>
          {steps.map(({ n, title, desc }) => (
            <div key={n} style={{ display: "flex", gap: "16px" }}>
              <div style={{ width: "30px", height: "30px", borderRadius: "50%",
                background: "rgba(26,255,110,0.1)", border: "1px solid rgba(26,255,110,0.25)",
                color: "var(--accent)", fontSize: "13px", fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {n}
              </div>
              <div>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)", marginBottom: "4px" }}>
                  {title}
                </p>
                <p style={{ fontSize: "13px", color: "var(--text-3)", lineHeight: 1.6 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Acciones */}
        <a href={transferData?.whatsapp || "https://wa.me/5492622635045"}
          target="_blank" rel="noreferrer" data-testid="transfer-whatsapp"
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "10px",
            padding: "14px 14px 14px 24px", borderRadius: "var(--r-full)",
            background: "var(--accent)", color: "#000", fontSize: "14px", fontWeight: 700,
            textDecoration: "none", boxShadow: "0 8px 30px rgba(26,255,110,0.3)" }}>
          <MessageCircle size={17} /> Enviar comprobante por WhatsApp
          <span style={{ width: "26px", height: "26px", borderRadius: "50%", background: "#000",
            color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowRight size={14} />
          </span>
        </a>

        <Link to="/dashboard/orders" style={{ display: "flex", alignItems: "center",
          justifyContent: "center", gap: "6px", fontSize: "13px", color: "var(--text-3)",
          padding: "8px", textDecoration: "none", transition: "color var(--dur)" }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--text-3)"}>
          Ver mis pedidos <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  )
}
