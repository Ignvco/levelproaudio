// pages/admin/AdminRewardsWinners.jsx — Historial global de ganadores
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { adminListWinners, adminUpdateWinner, adminListCampaigns } from "../../api/rewards.api"
import { mediaUrl } from "../../utils/mediaUrl"
import { showToast } from "../../components/ui/ToastNotification"

function WinnerCard({ w }) {
  const qc = useQueryClient()
  const [notes, setNotes] = useState(w.notes || "")
  const [file, setFile]   = useState(null)

  const save = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append("notes", notes)
      if (file) fd.append("delivery_proof", file)
      return adminUpdateWinner(w.id, fd)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:["admin-winners"] })
      showToast("Ganador actualizado")
      setFile(null)
    },
  })

  return (
    <div style={{
      padding:"20px 22px",
      background: w.is_backup
        ? "var(--surface)"
        : "linear-gradient(135deg, rgba(26,255,110,0.06) 0%, transparent 100%)",
      border: w.is_backup
        ? "1px solid var(--border)"
        : "1px solid rgba(26,255,110,0.25)",
      borderRadius:"var(--r-xl)",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"start", gap:"14px", marginBottom:"14px" }}>
        <div>
          <p style={{ fontSize:"11px", color:"var(--accent-text)",
            letterSpacing:"0.1em", textTransform:"uppercase",
            fontWeight:700, marginBottom:"4px" }}>
            {w.is_backup ? `Suplente #${w.backup_position}` : "🏆 Ganador principal"}
          </p>
          <p style={{ fontSize:"16px", fontWeight:500, color:"var(--text)" }}>
            {w.user_name || w.user_email}
          </p>
          <p style={{ fontSize:"12px", color:"var(--text-3)" }}>
            {w.user_email}
          </p>
          <p style={{ fontSize:"12px", color:"var(--text-3)", marginTop:"6px" }}>
            Campaña: <span style={{ color:"var(--text-2)" }}>{w.campaign_name}</span>
          </p>
          <p style={{ fontSize:"11px", color:"var(--text-3)", fontFamily:"monospace",
            marginTop:"2px" }}>
            Ticket: {w.unique_code}
          </p>
        </div>
        {w.proof_url && (
          <img src={mediaUrl(w.proof_url)} alt="Evidencia"
            style={{ width:"80px", height:"80px", borderRadius:"var(--r-md)",
              objectFit:"cover" }} />
        )}
      </div>

      <textarea placeholder="Observaciones (contacto realizado, dirección de envío…)"
        value={notes} onChange={e => setNotes(e.target.value)} rows={2}
        style={{
          width:"100%", padding:"10px 12px",
          background:"var(--surface-2)", border:"1px solid var(--border)",
          borderRadius:"var(--r-md)", color:"var(--text)",
          fontSize:"13px", outline:"none", resize:"vertical",
          fontFamily:"var(--font-sans)",
        }} />

      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"center", marginTop:"10px", gap:"10px" }}>
        <label style={{ fontSize:"12px", color:"var(--text-3)", cursor:"pointer" }}>
          📷 {file ? file.name : "Adjuntar evidencia"}
          <input type="file" accept="image/*"
            onChange={e => setFile(e.target.files?.[0] || null)}
            style={{ display:"none" }} />
        </label>
        <button onClick={() => save.mutate()} disabled={save.isPending}
          style={{
            padding:"8px 16px", fontSize:"12px",
            background:"var(--accent)", color:"#000",
            border:"none", borderRadius:"var(--r-full)",
            cursor:"pointer", fontWeight:600,
          }}>
          {save.isPending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  )
}

export default function AdminRewardsWinners() {
  const [campaignFilter, setCampaignFilter] = useState("")

  const { data: winners = [], isLoading } = useQuery({
    queryKey: ["admin-winners", campaignFilter],
    queryFn:  () => adminListWinners(campaignFilter),
  })
  const { data: campaigns = [] } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn:  adminListCampaigns,
  })

  return (
    <div style={{ padding:"clamp(28px, 4vw, 40px)" }}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"start", marginBottom:"28px", flexWrap:"wrap", gap:"12px" }}>
        <div>
          <p style={{ fontSize:"12px", color:"var(--accent-text)",
            letterSpacing:"0.1em", textTransform:"uppercase",
            fontWeight:600, marginBottom:"6px" }}>
            Rewards
          </p>
          <h1 style={{ fontSize:"28px", fontWeight:500 }}>Ganadores</h1>
        </div>
        <select value={campaignFilter}
          onChange={e => setCampaignFilter(e.target.value)}
          style={{
            padding:"9px 14px", background:"var(--surface)",
            border:"1px solid var(--border)", borderRadius:"var(--r-md)",
            color:"var(--text)", fontSize:"13px", outline:"none",
          }}>
          <option value="">Todas las campañas</option>
          {campaigns.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {isLoading && <p style={{ color:"var(--text-3)" }}>Cargando…</p>}

      {!isLoading && winners.length === 0 && (
        <p style={{ padding:"40px", textAlign:"center",
          background:"var(--surface)", borderRadius:"var(--r-lg)",
          border:"1px solid var(--border)", color:"var(--text-3)" }}>
          Todavía no hay ganadores. Ejecutá el sorteo de una campaña
          para que aparezcan acá.
        </p>
      )}

      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fill, minmax(340px, 1fr))",
        gap:"14px",
      }}>
        {winners.map(w => <WinnerCard key={w.id} w={w} />)}
      </div>
    </div>
  )
}
