// pages/admin/AdminRewardsWinners.jsx — Historial global de ganadores
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { adminListWinners, adminUpdateWinner, adminListCampaigns } from "../../api/rewards.api"
import { mediaUrl } from "../../utils/mediaUrl"
import { showToast } from "../../utils/toast"
import { AdminPageHeader, SecondaryButton, PrimaryButton } from "../../components/admin/ui"

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
    onError: (e) => showToast(e?.response?.data?.detail || "No se pudo guardar. Intentá de nuevo.", "error"),
  })

  return (
    <div className="au-card au-panel" style={{
      borderLeft: w.is_backup ? "4px solid var(--admin-border-strong)" : "4px solid var(--admin-primary)",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"flex-start", gap:"14px", marginBottom:"14px" }}>
        <div>
          <p style={{ fontSize:"11px", color:"var(--admin-primary-text)",
            letterSpacing:"0.08em", textTransform:"uppercase",
            fontWeight:800, marginBottom:"4px" }}>
            {w.is_backup ? `Suplente #${w.backup_position}` : "🏆 Ganador principal"}
          </p>
          <p style={{ fontSize:"16px", fontWeight:800, color:"var(--admin-text)" }}>
            {w.user_name || w.user_email}
          </p>
          <p style={{ fontSize:"12px", color:"var(--admin-text-secondary)" }}>
            {w.user_email}
          </p>
          <p style={{ fontSize:"12px", color:"var(--admin-text-muted)", marginTop:"6px" }}>
            Campaña: <span style={{ color:"var(--admin-text)", fontWeight: 700 }}>{w.campaign_name}</span>
          </p>
          <p style={{ fontSize:"11px", color:"var(--admin-text-muted)", fontFamily:"var(--font-mono)",
            marginTop:"2px" }}>
            Ticket: {w.unique_code}
          </p>
        </div>
        {w.proof_url && (
          <img src={mediaUrl(w.proof_url)} alt="Evidencia"
            style={{ width:"80px", height:"80px", borderRadius:"12px",
              objectFit:"cover" }} />
        )}
      </div>

      <textarea placeholder="Observaciones (contacto realizado, dirección de envío…)"
        value={notes} onChange={e => setNotes(e.target.value)} rows={2}
        style={{
          width:"100%", padding:"10px 12px",
          background:"var(--admin-surface-soft)", border:"1px solid var(--admin-border-strong)",
          borderRadius:"10px", color:"var(--admin-text)",
          fontSize:"13px", outline:"none", resize:"vertical",
          fontFamily:"var(--font-sans)",
        }} />

      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"center", marginTop:"12px", gap:"10px", flexWrap: "wrap" }}>
        <label style={{ fontSize:"12px", fontWeight: 600, color:"var(--admin-text-secondary)", cursor:"pointer" }}>
          📷 {file ? file.name : "Adjuntar evidencia"}
          <input type="file" accept="image/*"
            onChange={e => setFile(e.target.files?.[0] || null)}
            style={{ display:"none" }} />
        </label>
        <PrimaryButton size="sm" onClick={() => save.mutate()} disabled={save.isPending} loading={save.isPending}>
          {save.isPending ? "Guardando…" : "Guardar"}
        </PrimaryButton>
      </div>
    </div>
  )
}

export default function AdminRewardsWinners() {
  const [campaignFilter, setCampaignFilter] = useState("")

  const { data: rawWinners, isLoading } = useQuery({
    queryKey: ["admin-winners", campaignFilter],
    queryFn:  () => adminListWinners(campaignFilter),
  })
  const { data: rawCampaigns } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn:  adminListCampaigns,
  })
  const winners = Array.isArray(rawWinners) ? rawWinners : []
  const campaigns = Array.isArray(rawCampaigns) ? rawCampaigns : []

  return (
    <div className="au-page">
      <AdminPageHeader
        eyebrow="LEVELPRO / REWARDS"
        title="Ganadores"
        description={`${winners.length} ganadores y suplentes sorteados`}
        breadcrumbs={[
          { label: "Rewards", to: "/admin/rewards" },
          { label: "Ganadores" },
        ]}
        actions={
          <>
            <SecondaryButton to="/admin/rewards" size="sm">← Dashboard</SecondaryButton>
            <select value={campaignFilter}
              onChange={e => setCampaignFilter(e.target.value)}
              className="au-select">
              <option value="">Todas las campañas</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </>
        }
      />

      {isLoading && <p style={{ color:"var(--admin-text-muted)" }}>Cargando…</p>}

      {!isLoading && winners.length === 0 && (
        <div className="au-card au-panel" style={{ padding:"44px", textAlign:"center", color:"var(--admin-text-secondary)" }}>
          Todavía no hay ganadores. Ejecutá el sorteo de una campaña
          para que aparezcan acá.
        </div>
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
