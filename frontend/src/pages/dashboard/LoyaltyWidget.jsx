// pages/dashboard/LoyaltyWidget.jsx

import { useQuery, useMutation } from "@tanstack/react-query"
import { getMyLoyalty } from "../../api/loyalty.api"

const NIVEL_COLORS = {
  bronze:   { color: "#cd7f32", label: "Bronze",   emoji: "🥉" },
  silver:   { color: "#9ca3af", label: "Silver",   emoji: "🥈" },
  gold:     { color: "#facc15", label: "Gold",     emoji: "🥇" },
  platinum: { color: "#60a5fa", label: "Platinum", emoji: "💎" },
}

export default function LoyaltyWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-loyalty"],
    queryFn:  getMyLoyalty,
  })

  if (isLoading) return (
    <div className="skeleton" style={{ height: "180px", borderRadius: "var(--r-xl)" }} />
  )

  if (!data) return null

  const nivel  = NIVEL_COLORS[data.nivel] || NIVEL_COLORS.bronze
  const sigNivel = data.siguiente_nivel
    ? NIVEL_COLORS[data.siguiente_nivel]
    : null

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-xl)", overflow: "hidden",
    }}>
      {/* Header con nivel */}
      <div style={{
        padding: "16px 20px",
        background: `linear-gradient(135deg, ${nivel.color}10, transparent)`,
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: "12px",
      }}>
        <span style={{ fontSize: "28px" }}>{nivel.emoji}</span>
        <div>
          <p style={{ fontSize: "11px", color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.06em",
            marginBottom: "2px" }}>
            Nivel actual
          </p>
          <p style={{ fontSize: "18px", fontWeight: 600, color: nivel.color }}>
            {nivel.label}
          </p>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: "2rem",
            color: "var(--accent)", lineHeight: 1 }}>
            {data.puntos_disponibles.toLocaleString("es-CL")}
          </p>
          <p style={{ fontSize: "11px", color: "var(--text-3)" }}>puntos</p>
        </div>
      </div>

      <div style={{ padding: "16px 20px",
        display: "flex", flexDirection: "column", gap: "12px" }}>

        {/* Valor disponible */}
        <div style={{
          padding: "10px 14px", borderRadius: "var(--r-md)",
          background: "rgba(26,255,110,0.05)",
          border: "1px solid rgba(26,255,110,0.15)",
          display: "flex", justifyContent: "space-between",
          alignItems: "center",
        }}>
          <p style={{ fontSize: "13px", color: "var(--text-2)" }}>
            Valor para canjear
          </p>
          <p style={{ fontSize: "15px", fontWeight: 600,
            color: "var(--accent)" }}>
            ${data.valor_disponible.toLocaleString("es-CL")}
          </p>
        </div>

        {/* Progreso al siguiente nivel */}
        {sigNivel && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between",
              fontSize: "12px", marginBottom: "6px" }}>
              <span style={{ color: "var(--text-3)" }}>
                Progreso a {sigNivel.label}
              </span>
              <span style={{ color: sigNivel.color, fontWeight: 500 }}>
                {data.progreso_nivel}%
              </span>
            </div>
            <div style={{ height: "6px", borderRadius: "3px",
              background: "var(--surface-3)", overflow: "hidden" }}>
              <div style={{
                width: `${data.progreso_nivel}%`, height: "100%",
                background: sigNivel.color, borderRadius: "3px",
                transition: "width 0.5s ease",
              }} />
            </div>
          </div>
        )}

        {/* Últimas transacciones */}
        {data.transactions?.slice(0, 3).map((t, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between",
            fontSize: "12px", color: "var(--text-3)" }}>
            <span>{t.descripcion}</span>
            <span style={{
              fontWeight: 600,
              color: t.puntos > 0 ? "var(--accent)" : "#f87171",
            }}>
              {t.puntos > 0 ? "+" : ""}{t.puntos} pts
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}