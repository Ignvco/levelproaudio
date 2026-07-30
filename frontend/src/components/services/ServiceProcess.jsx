// components/services/ServiceProcess.jsx — "Cómo trabajamos" (pasos genéricos)
import { MessagesSquare, Calculator, SlidersHorizontal, PackageCheck } from "lucide-react"

export const PROCESS_STEPS = [
  { Icon: MessagesSquare,     title: "Consultás",  desc: "Nos contás tu proyecto, objetivos y referencias." },
  { Icon: Calculator,         title: "Cotizamos",  desc: "Te enviamos una propuesta clara con precio y plazos." },
  { Icon: SlidersHorizontal,  title: "Ejecutamos", desc: "Nuestro equipo se pone manos a la obra con vos." },
  { Icon: PackageCheck,       title: "Entregamos", desc: "Recibís el resultado final, con revisiones incluidas." },
]

export default function ServiceProcess({ variant = "card" }) {
  const isCard = variant === "card"
  return (
    <div style={isCard ? {} : { }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: isCard ? "1fr" : "repeat(auto-fit, minmax(220px, 1fr))",
        gap: isCard ? "20px" : "20px",
      }} className={isCard ? "svc-process-card" : "svc-process-grid"}>
        {PROCESS_STEPS.map(({ Icon, title, desc }, i) => (
          <div key={title} data-testid={`process-step-${i}`}
            style={{ display: "flex", gap: "16px", alignItems: "flex-start",
              position: "relative" }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <span style={{ width: "44px", height: "44px", borderRadius: "14px",
                background: "rgba(26,255,110,0.08)", border: "1px solid rgba(26,255,110,0.22)",
                color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={20} strokeWidth={2} />
              </span>
              <span style={{ position: "absolute", top: "-6px", right: "-6px",
                width: "20px", height: "20px", borderRadius: "50%", background: "var(--accent)",
                color: "#000", fontSize: "11px", fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                {i + 1}
              </span>
            </div>
            <div style={{ paddingTop: "2px" }}>
              <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)",
                fontFamily: "var(--font-display)", letterSpacing: "-0.01em", marginBottom: "4px" }}>
                {title}
              </p>
              <p style={{ fontSize: "13.5px", color: "var(--text-3)", lineHeight: 1.55 }}>
                {desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
