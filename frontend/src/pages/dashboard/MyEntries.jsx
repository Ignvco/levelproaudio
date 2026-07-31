// pages/dashboard/MyEntries.jsx — Pestaña "Mis Participaciones"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Ticket } from "lucide-react"
import { getMyEntries } from "../../api/rewards.api"

// Imágenes de audio para los tickets (se elige una por código, determinista)
const AUDIO_IMAGES = [
  "https://images.unsplash.com/photo-1518972559570-7cc1309f3229?w=400&q=70&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1574517947730-55cb23e608c2?w=400&q=70&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1535406208535-1429839cfd13?w=400&q=70&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1618609377864-68609b857e90?w=400&q=70&auto=format&fit=crop",
]

function imageForCode(code) {
  let h = 0
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0
  return AUDIO_IMAGES[h % AUDIO_IMAGES.length]
}

function TicketCard({ code }) {
  return (
    <div data-testid={`ticket-${code}`} style={{
      position: "relative", borderRadius: "14px", overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.08)", background: "#0d0d0d",
      aspectRatio: "1.6", display: "flex", flexDirection: "column", justifyContent: "flex-end",
    }}>
      <img src={imageForCode(code)} alt="" loading="lazy" style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        objectFit: "cover", opacity: 0.5,
      }} />
      <div style={{ position: "absolute", inset: 0,
        background: "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.85) 100%)" }} />
      <div style={{ position: "relative", padding: "12px 14px" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px",
          fontSize: "10px", fontWeight: 700, color: "var(--accent)",
          textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
          <Ticket size={12} /> Ticket
        </span>
        <p style={{ fontFamily: "'IBM Plex Mono', var(--font-display), monospace",
          fontSize: "15px", fontWeight: 700, color: "#fff", letterSpacing: "0.03em" }}>
          {code}
        </p>
      </div>
    </div>
  )
}

function CampaignCard({ campaign }) {
  const drawn    = campaign.is_drawn
  const won      = campaign.won
  const isBackup = won?.is_backup
  const codes    = campaign.codes || []

  return (
    <div style={{
      padding:"22px 24px", background:"var(--surface)",
      border:"1px solid var(--border)", borderRadius:"var(--r-xl)",
      display:"flex", flexDirection:"column", gap:"16px",
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
          <p style={{ fontSize:"13px", color:"var(--text-2)", marginTop:"4px",
            display:"inline-flex", alignItems:"center", gap:"6px" }}>
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

      {/* Tickets */}
      {codes.length > 0 && (
        <div style={{ display:"grid",
          gridTemplateColumns:"repeat(auto-fill, minmax(150px, 1fr))",
          gap:"10px" }}>
          {codes.map(code => <TicketCard key={code} code={code} />)}
        </div>
      )}

      <div style={{
        display:"flex", justifyContent:"space-between",
        alignItems:"center", paddingTop:"2px",
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
        <h1 className="display-bold" style={{ fontFamily:"var(--font-display)",
          fontSize:"clamp(1.7rem, 3vw, 2.4rem)", fontWeight:800,
          letterSpacing:"-0.03em" }}>
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
            Comprá stickers en las campañas activas y sumá tickets al sorteo.
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
