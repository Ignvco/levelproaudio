// pages/dashboard/MyEntries.jsx — Pestaña "Mis Participaciones"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getMyEntries } from "../../api/rewards.api"

function CampaignCard({ campaign }) {
  const drawn    = campaign.is_drawn
  const won      = campaign.won
  const isBackup = won?.is_backup

  return (
    <div style={{
      padding:"22px 24px", background:"var(--surface)",
      border:"1px solid var(--border)", borderRadius:"var(--r-xl)",
      display:"flex", flexDirection:"column", gap:"14px",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"start", gap:"14px" }}>
        <div style={{ minWidth:0, flex:1 }}>
          <p style={{ fontSize:"11px", fontWeight:600,
            color:"var(--text-3)", letterSpacing:"0.1em",
            textTransform:"uppercase", marginBottom:"6px" }}>
            Sorteo · {new Date(campaign.draw_date).toLocaleDateString("es-CL",
              { day:"numeric", month:"long", year:"numeric" })}
          </p>
          <p style={{ fontSize:"16px", fontWeight:500, color:"var(--text)" }}>
            {campaign.name}
          </p>
          <p style={{ fontSize:"13px", color:"var(--text-2)", marginTop:"4px" }}>
            🏆 {campaign.main_prize}
          </p>
        </div>
        <div style={{ textAlign:"right", flexShrink:0 }}>
          <p style={{ fontSize:"11px", color:"var(--text-3)",
            textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"4px" }}>
            Tus tickets
          </p>
          <p style={{ fontSize:"28px", fontWeight:700, color:"var(--accent)",
            fontVariantNumeric:"tabular-nums", lineHeight:1 }}>
            {campaign.entries_count}
          </p>
        </div>
      </div>

      {drawn && (
        <div style={{
          padding:"12px 14px", borderRadius:"var(--r-md)",
          background: won
            ? (isBackup
                ? "rgba(250,204,21,0.08)"
                : "rgba(26,255,110,0.1)")
            : "rgba(255,255,255,0.03)",
          border: won
            ? (isBackup
                ? "1px solid rgba(250,204,21,0.3)"
                : "1px solid rgba(26,255,110,0.3)")
            : "1px solid var(--border)",
          fontSize:"13px",
          color: won
            ? (isBackup ? "#facc15" : "var(--accent)")
            : "var(--text-3)",
          fontWeight: won ? 600 : 400,
        }}>
          {won
            ? (isBackup
                ? `🥈 Suplente #${won.backup_position} — Podés recibir el premio si el principal no responde.`
                : "🏆 ¡GANASTE! Nos vamos a contactar por email.")
            : "Sorteo finalizado — no fuiste seleccionado esta vez."}
        </div>
      )}

      <div style={{
        display:"flex", justifyContent:"space-between",
        alignItems:"center", paddingTop:"6px",
      }}>
        <span style={{ fontSize:"11px",
          padding:"4px 10px", borderRadius:"var(--r-full)",
          background: drawn ? "rgba(255,255,255,0.04)" : "rgba(26,255,110,0.08)",
          color: drawn ? "var(--text-3)" : "var(--accent)",
          fontWeight:600, letterSpacing:"0.06em",
          textTransform:"uppercase",
        }}>
          {drawn ? "Finalizada" : "Activa"}
        </span>
        <Link to={`/rewards`} style={{ fontSize:"13px",
          color:"var(--text-2)", textDecoration:"none" }}>
          Ver campaña →
        </Link>
      </div>
    </div>
  )
}

export default function MyEntries() {
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["my-reward-entries"],
    queryFn:  getMyEntries,
  })

  return (
    <div style={{ padding:"clamp(32px, 5vw, 56px)", maxWidth:"820px" }}>
      <div style={{ marginBottom:"32px" }}>
        <p style={{ fontSize:"12px", color:"var(--accent)",
          fontWeight:600, letterSpacing:"0.08em",
          textTransform:"uppercase", marginBottom:"8px" }}>
          LevelPro Rewards
        </p>
        <h1 style={{ fontFamily:"var(--font-serif)",
          fontSize:"clamp(2rem, 4vw, 3rem)", fontWeight:300,
          letterSpacing:"-0.02em" }}>
          Mis participaciones
        </h1>
      </div>

      {isLoading && (
        <p style={{ color:"var(--text-3)" }}>Cargando…</p>
      )}

      {!isLoading && campaigns.length === 0 && (
        <div style={{
          padding:"40px 32px", background:"var(--surface)",
          border:"1px solid var(--border)", borderRadius:"var(--r-2xl)",
          textAlign:"center",
        }}>
          <p style={{ fontSize:"46px", marginBottom:"12px" }}>🎟️</p>
          <p style={{ fontSize:"15px", color:"var(--text-2)",
            marginBottom:"6px" }}>
            Aún no tenés participaciones.
          </p>
          <p style={{ fontSize:"13px", color:"var(--text-3)",
            marginBottom:"20px" }}>
            Comprá productos que participen en las campañas activas y ganás tickets.
          </p>
          <Link to="/rewards" className="btn btn-accent"
            style={{ padding:"12px 22px", fontSize:"14px" }}>
            Ver campañas activas →
          </Link>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
        {campaigns.map(c => <CampaignCard key={c.id} campaign={c} />)}
      </div>
    </div>
  )
}
