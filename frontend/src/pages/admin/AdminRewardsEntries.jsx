// pages/admin/AdminRewardsEntries.jsx — Tabla de participaciones con filtros
import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  adminListEntries,
  adminListCampaigns,
  adminExportEntriesCsvUrl,
} from "../../api/rewards.api"
import { AdminPageHeader, SecondaryButton, ErrorState } from "../../components/admin/ui"

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

  const { data: rawEntries, isLoading, isError: entriesError, refetch: refetchEntries } = useQuery({
    queryKey: ["admin-entries", activeFilters],
    queryFn:  () => adminListEntries(activeFilters),
  })
  const { data: rawCampaigns, isError: campaignsError, refetch: refetchCampaigns } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn:  adminListCampaigns,
  })
  const entries = Array.isArray(rawEntries) ? rawEntries : []
  const campaigns = Array.isArray(rawCampaigns) ? rawCampaigns : []

  return (
    <div className="au-page">
      <AdminPageHeader
        eyebrow="LEVELPRO / REWARDS"
        title="Participaciones"
        description={entriesError ? "No fue posible cargar las participaciones" : `${entries.length} participaciones visibles con los filtros activos`}
        breadcrumbs={[
          { label: "Rewards", to: "/admin/rewards" },
          { label: "Participaciones" },
        ]}
        actions={
          <>
            <SecondaryButton to="/admin/rewards" size="sm">← Dashboard</SecondaryButton>
            <a href={adminExportEntriesCsvUrl(filters)}
              data-testid="btn-export-csv"
              className="au-btn au-btn--secondary au-btn--sm"
              style={{ textDecoration:"none" }}>
              Exportar CSV filtrado ↓
            </a>
          </>
        }
      />

      {/* Filtros */}
      <div className="au-card" style={{ padding: "14px 18px", display:"flex", gap:"10px",
        flexWrap:"wrap", alignItems: "center" }}>
        <select value={filters.campaign}
          data-testid="filter-campaign"
          onChange={e => setFilters(f => ({...f, campaign:e.target.value}))}
          className="au-select">
          <option value="">Todas las campañas</option>
          {campaigns.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input placeholder="Buscar por email o código"
          value={filters.search}
          onChange={e => setFilters(f => ({...f, search:e.target.value}))}
          className="au-input"
          style={{ maxWidth:"280px" }} />
        <input type="date" value={filters.date_from}
          onChange={e => setFilters(f => ({...f, date_from:e.target.value}))}
          className="au-select" />
        <input type="date" value={filters.date_to}
          onChange={e => setFilters(f => ({...f, date_to:e.target.value}))}
          className="au-select" />
      </div>

      {campaignsError && <ErrorState title="No se pudo cargar el filtro de campañas"
        action={<SecondaryButton onClick={() => refetchCampaigns()}>Reintentar campañas</SecondaryButton>} />}

      {/* Tabla */}
      {isLoading && <p style={{ color:"var(--admin-text-muted)" }}>Cargando…</p>}
      {entriesError && <ErrorState title="No se pudieron cargar las participaciones"
        action={<SecondaryButton onClick={() => refetchEntries()}>Reintentar</SecondaryButton>} />}
      {!isLoading && !entriesError && entries.length === 0 && (
        <div className="au-card au-panel" style={{ padding:"44px", textAlign:"center", color:"var(--admin-text-secondary)" }}>
          No hay participaciones con los filtros aplicados.
        </div>
      )}

      {!entriesError && entries.length > 0 && (
        <div className="au-card au-table-wrap">
          <div className="au-tscroll">
            <table className="au-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Usuario</th>
                  <th>Campaña</th>
                  <th>Producto</th>
                  <th>Orden</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontFamily:"var(--font-mono)", fontWeight: 700, color:"var(--admin-primary-text)" }}>
                      {e.unique_code}
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--admin-text)" }}>
                      {e.user_email}
                    </td>
                    <td style={{ color:"var(--admin-text-secondary)" }}>
                      {e.campaign_name}
                    </td>
                    <td style={{ color:"var(--admin-text-muted)" }}>
                      {e.product_name || "—"}
                    </td>
                    <td style={{ fontFamily:"var(--font-mono)", color:"var(--admin-text-muted)", fontSize:"12px" }}>
                      #{e.order_short}
                    </td>
                    <td style={{ color:"var(--admin-text-muted)", fontSize:"12px", fontFamily: "var(--font-mono)" }}>
                      {new Date(e.created_at).toLocaleDateString("es-CL")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="au-tfoot">
            <span>{entries.length} participaciones mostradas</span>
          </div>
        </div>
      )}
    </div>
  )
}
