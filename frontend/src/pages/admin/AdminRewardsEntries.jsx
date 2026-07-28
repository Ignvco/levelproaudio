// pages/admin/AdminRewardsEntries.jsx — Tabla de participaciones con filtros
import { useMemo, useState } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  adminListEntries,
  adminListCampaigns,
  adminExportEntriesCsvUrl,
} from "../../api/rewards.api"

export default function AdminRewardsEntries() {
  const [searchParams] = useSearchParams()
  const initialCampaign = searchParams.get("campaign") || ""

  const [filters, setFilters] = useState({
    campaign:  initialCampaign,
    search:    "",
    date_from: "",
    date_to:   "",
  })

  const activeFilters = useMemo(() => {
    const f = {}
    if (filters.campaign)  f.campaign  = filters.campaign
    if (filters.search)    f.search    = filters.search
    if (filters.date_from) f.date_from = filters.date_from
    if (filters.date_to)   f.date_to   = filters.date_to
    return f
  }, [filters])

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["admin-entries", activeFilters],
    queryFn:  () => adminListEntries(activeFilters),
  })
  const { data: campaigns = [] } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn:  adminListCampaigns,
  })

  const inputSt = {
    padding:"9px 14px",
    background:"var(--surface)", border:"1px solid var(--border)",
    borderRadius:"var(--r-md)", color:"var(--text)",
    fontSize:"13px", outline:"none",
  }

  return (
    <div style={{ padding:"clamp(28px, 4vw, 40px)" }}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"start", marginBottom:"28px", flexWrap:"wrap", gap:"12px" }}>
        <div>
          <p style={{ fontSize:"12px", color:"var(--accent)",
            letterSpacing:"0.1em", textTransform:"uppercase",
            fontWeight:600, marginBottom:"6px" }}>
            Rewards
          </p>
          <h1 style={{ fontSize:"28px", fontWeight:500 }}>Participaciones</h1>
        </div>
        <a href={adminExportEntriesCsvUrl(filters.campaign)}
          data-testid="btn-export-csv"
          style={{
            padding:"9px 18px", fontSize:"13px",
            background:"var(--surface)", border:"1px solid var(--border)",
            color:"var(--text-2)", borderRadius:"var(--r-full)",
            textDecoration:"none",
          }}>
          Exportar CSV ↓
        </a>
      </div>

      {/* Filtros */}
      <div style={{ display:"flex", gap:"10px", marginBottom:"20px",
        flexWrap:"wrap" }}>
        <select value={filters.campaign}
          data-testid="filter-campaign"
          onChange={e => setFilters(f => ({...f, campaign:e.target.value}))}
          style={inputSt}>
          <option value="">Todas las campañas</option>
          {campaigns.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input placeholder="Buscar por email o código"
          value={filters.search}
          onChange={e => setFilters(f => ({...f, search:e.target.value}))}
          style={{ ...inputSt, minWidth:"260px" }} />
        <input type="date" value={filters.date_from}
          onChange={e => setFilters(f => ({...f, date_from:e.target.value}))}
          style={inputSt} />
        <input type="date" value={filters.date_to}
          onChange={e => setFilters(f => ({...f, date_to:e.target.value}))}
          style={inputSt} />
      </div>

      {/* Tabla */}
      {isLoading && <p style={{ color:"var(--text-3)" }}>Cargando…</p>}
      {!isLoading && entries.length === 0 && (
        <p style={{ padding:"40px", textAlign:"center",
          background:"var(--surface)", borderRadius:"var(--r-lg)",
          border:"1px solid var(--border)", color:"var(--text-3)" }}>
          No hay participaciones con los filtros aplicados.
        </p>
      )}

      {entries.length > 0 && (
        <div style={{
          background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:"var(--r-lg)", overflow:"hidden",
        }}>
          <div style={{
            display:"grid",
            gridTemplateColumns:"140px 1fr 1fr 130px 100px 130px",
            padding:"12px 18px",
            fontSize:"11px", color:"var(--text-3)",
            letterSpacing:"0.06em", textTransform:"uppercase",
            fontWeight:600, borderBottom:"1px solid var(--border)",
          }}>
            <span>Código</span>
            <span>Usuario</span>
            <span>Campaña</span>
            <span>Producto</span>
            <span>Orden</span>
            <span>Fecha</span>
          </div>
          {entries.map(e => (
            <div key={e.id} style={{
              display:"grid",
              gridTemplateColumns:"140px 1fr 1fr 130px 100px 130px",
              padding:"12px 18px",
              fontSize:"13px",
              borderBottom:"1px solid var(--border)",
              alignItems:"center",
            }}>
              <span style={{ fontFamily:"monospace", color:"var(--accent)" }}>
                {e.unique_code}
              </span>
              <span style={{ minWidth:0, overflow:"hidden",
                textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {e.user_email}
              </span>
              <span style={{ color:"var(--text-2)", minWidth:0,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {e.campaign_name}
              </span>
              <span style={{ color:"var(--text-3)", minWidth:0,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {e.product_name || "—"}
              </span>
              <span style={{ fontFamily:"monospace", color:"var(--text-3)",
                fontSize:"12px" }}>
                #{e.order_short}
              </span>
              <span style={{ color:"var(--text-3)", fontSize:"12px" }}>
                {new Date(e.created_at).toLocaleDateString("es-CL")}
              </span>
            </div>
          ))}
          <div style={{ padding:"14px 18px", fontSize:"12px",
            color:"var(--text-3)" }}>
            {entries.length} participaciones mostradas
          </div>
        </div>
      )}
    </div>
  )
}
