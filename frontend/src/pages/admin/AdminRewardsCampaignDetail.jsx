// pages/admin/AdminRewardsCampaignDetail.jsx — Gestión detallada
import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  adminGetCampaign, adminUpdateCampaign,
  adminAddRewardProduct, adminDeleteRewardProduct,
  adminUpdateRewardProduct,
  adminDrawCampaign, adminFinishCampaign,
  adminListWinners,
} from "../../api/rewards.api"
import { getProducts } from "../../api/products.api"
import { mediaUrl } from "../../utils/mediaUrl"
import { showToast } from "../../components/ui/ToastNotification"
import { AdminPageHeader, StatCard, SectionCard, SecondaryButton, StatusBadge } from "../../components/admin/ui"
import { Ticket, Users, Package, Award } from "lucide-react"

export default function AdminRewardsCampaignDetail() {
  const { id } = useParams()
  const qc     = useQueryClient()
  const [showProductPicker, setShowProductPicker] = useState(false)

  const { data: c, isLoading } = useQuery({
    queryKey: ["admin-campaign", id],
    queryFn:  () => adminGetCampaign(id),
  })
  const { data: winners = [] } = useQuery({
    queryKey: ["admin-campaign-winners", id],
    queryFn:  () => adminListWinners(id),
  })
  const { data: productsData } = useQuery({
    queryKey: ["shop-products"],
    queryFn:  () => getProducts({ page_size: 200 }),
    enabled:  showProductPicker,
  })
  const productList = productsData?.results || productsData || []

  const update = useMutation({
    mutationFn: (patch) => {
      const fd = new FormData()
      Object.entries(patch).forEach(([k,v]) => fd.append(k, v))
      return adminUpdateCampaign(id, fd)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:["admin-campaign", id] })
      showToast("Actualizado")
    },
    onError: (e) => showToast(e?.response?.data?.detail || "No se pudo actualizar la campaña.", "error"),
  })

  const addProduct = useMutation({
    mutationFn: (payload) => adminAddRewardProduct({ campaign:id, ...payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:["admin-campaign", id] })
      showToast("Producto agregado")
    },
    onError: () => showToast("Ya está agregado a la campaña", "error"),
  })
  const delProduct = useMutation({
    mutationFn: adminDeleteRewardProduct,
    onSuccess:  () => qc.invalidateQueries({ queryKey:["admin-campaign", id] }),
    onError:    (e) => showToast(e?.response?.data?.detail || "No se pudo quitar el producto.", "error"),
  })
  const patchProduct = useMutation({
    mutationFn: ({rpid, payload}) => adminUpdateRewardProduct(rpid, payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey:["admin-campaign", id] }),
    onError:    (e) => showToast(e?.response?.data?.detail || "No se pudo actualizar el producto.", "error"),
  })
  const draw = useMutation({
    mutationFn: () => adminDrawCampaign(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:["admin-campaign", id] })
      qc.invalidateQueries({ queryKey:["admin-campaign-winners", id] })
      showToast("🎉 Sorteo ejecutado")
    },
    onError: (err) => showToast(err?.response?.data?.error || "Error", "error"),
  })
  const finish = useMutation({
    mutationFn: () => adminFinishCampaign(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey:["admin-campaign", id] }),
    onError:    (e) => showToast(e?.response?.data?.detail || "No se pudo finalizar la campaña. Verificá antes de asumir que se cerró.", "error"),
  })

  if (isLoading || !c || !Array.isArray(c.reward_products)) return (
    <div className="au-page">
      <p style={{ color:"var(--admin-text-muted)" }}>Cargando…</p>
    </div>
  )

  const alreadyAdded = new Set(c.reward_products.map(rp => rp.product))

  // ── Estado de visibilidad pública (fecha vigente + status active)
  const now       = new Date()
  const start     = new Date(c.start_date)
  const end       = new Date(c.end_date)
  const notStarted = c.status === "active" && start > now
  const expired    = c.status === "active" && end < now
  const livePublic = c.status === "active" && start <= now && end >= now

  // Helper: formato compatible con datetime-local (hora local, sin timezone)
  const toLocalInput = (iso) => {
    const d = new Date(iso)
    const pad = n => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` +
           `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  return (
    <div className="au-page">
      <AdminPageHeader
        eyebrow="LEVELPRO / REWARDS"
        title={c.name}
        description={`🏆 ${c.main_prize}`}
        breadcrumbs={[
          { label: "Rewards", to: "/admin/rewards" },
          { label: "Campañas", to: "/admin/rewards/campaigns" },
          { label: c.name },
        ]}
        actions={
          <>
            <StatusBadge tone={c.status === "active" ? "success" : c.status === "finished" ? "warning" : "neutral"}>
              {c.status}
            </StatusBadge>
            {c.status !== "finished" && c.status !== "active" && (
              <button data-testid="btn-publish"
                type="button"
                onClick={() => update.mutate({ status:"active" })}
                className="au-btn au-btn--primary">
                Publicar
              </button>
            )}
            {c.status === "active" && !c.is_drawn && (
              <button data-testid="btn-finish"
                type="button"
                onClick={() => finish.mutate()}
                className="au-btn au-btn--secondary">
                Cerrar campaña
              </button>
            )}
            {!c.is_drawn && (
              <button data-testid="btn-draw"
                type="button"
                onClick={() => {
                  if (confirm(`¿Ejecutar sorteo? Esta acción NO se puede repetir.\n\n${c.total_entries} participaciones · Se seleccionará 1 ganador + ${c.backup_winners_count} suplente(s).`)) {
                    draw.mutate()
                  }
                }}
                disabled={draw.isPending || c.total_entries === 0}
                className="au-btn au-btn--primary"
                style={{ opacity: c.total_entries === 0 ? 0.45 : 1 }}>
                {draw.isPending ? "Sorteando…" : "🎲 Ejecutar sorteo"}
              </button>
            )}
          </>
        }
      />

      {/* Aviso de visibilidad pública */}
      {(notStarted || expired) && (
        <div data-testid="visibility-warning" className="lp-callout lp-callout--warning">
          <span style={{ fontSize:"18px" }}>⚠️</span>
          <div>
            {notStarted && (
              <>
                <strong>La campaña todavía no arrancó.</strong>{" "}
                No aparece en /rewards hasta el{" "}
                <strong>{start.toLocaleString("es-CL", {
                  day:"numeric", month:"long", year:"numeric",
                  hour:"2-digit", minute:"2-digit",
                })}</strong>. Editá la fecha de inicio abajo si querés que se vea ya.
              </>
            )}
            {expired && (
              <>
                <strong>La ventana de compra terminó.</strong>{" "}
                No aparece en /rewards porque expiró el{" "}
                <strong>{end.toLocaleString("es-CL")}</strong>.
                Extendé la fecha de cierre o cerrala manualmente.
              </>
            )}
          </div>
        </div>
      )}

      {livePublic && (
        <div className="lp-callout lp-callout--success" style={{ width: "fit-content", padding: "8px 14px" }}>
          <span style={{ width:"7px", height:"7px", borderRadius:"50%",
            background:"var(--admin-primary)",
            animation:"lp-pulse 2s ease-in-out infinite" }} />
          Visible en <strong style={{ marginLeft:"3px" }}>/rewards</strong>
        </div>
      )}

      {/* KPIs */}
      <div className="lp-grid-kpi">
        <StatCard variant="ink" Icon={Ticket} label="Participaciones" value={c.total_entries} sub="Tickets acumulados" />
        <StatCard variant="primary" Icon={Users} label="Participantes" value={c.total_participants} sub="Usuarios únicos" />
        <StatCard variant="light" Icon={Package} label="Productos" value={c.reward_products.length} sub="Asociados a campaña" />
        <StatCard variant="light" Icon={Award} label="Suplentes" value={c.backup_winners_count} sub="Configurados en sorteo" />
      </div>

      {/* Panel de fechas + Precio por sticker */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", alignItems: "start" }}>
        <SectionCard eyebrow="CRONOGRAMA" title="Fechas" description="Los cambios se guardan al hacer clic fuera del campo (blur).">
          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))",
            gap:"12px",
          }}>
            {[
              ["Inicio",         "start_date"],
              ["Cierre compra",  "end_date"],
              ["Fecha del sorteo","draw_date"],
            ].map(([label, field]) => (
              <div key={field}>
                <label style={{ fontSize:"11px", fontWeight:700,
                  color:"var(--admin-text-muted)", letterSpacing:"0.06em",
                  textTransform:"uppercase", marginBottom:"6px",
                  display:"block" }}>
                  {label}
                </label>
                <input type="datetime-local"
                  data-testid={`edit-${field}`}
                  defaultValue={toLocalInput(c[field])}
                  onBlur={e => {
                    if (e.target.value && e.target.value !== toLocalInput(c[field])) {
                      update.mutate({ [field]: e.target.value })
                    }
                  }}
                  style={{
                    width:"100%", padding:"9px 12px",
                    background:"var(--admin-surface-soft)",
                    border:"1px solid var(--admin-border-strong)",
                    borderRadius:"10px", color:"var(--admin-text)",
                    fontSize:"13px", outline:"none",
                    fontFamily:"var(--font-sans)",
                    colorScheme:"light",
                  }} />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="TICKET UNITARIO" title="Precio por sticker" description="CLP · cada sticker = 1 ticket de participación">
          <div style={{ display:"flex", alignItems:"center", gap:"12px", flexWrap:"wrap" }}>
            <input type="number" min="0" step="100"
              data-testid="edit-sticker-price"
              defaultValue={c.sticker_price}
              onBlur={e => {
                if (e.target.value && String(e.target.value) !== String(c.sticker_price)) {
                  update.mutate({ sticker_price: e.target.value })
                }
              }}
              style={{ width:"180px", padding:"9px 12px",
                background:"var(--admin-surface-soft)", border:"1px solid var(--admin-border-strong)",
                borderRadius:"10px", color:"var(--admin-text)", fontSize:"14px", fontWeight: 700,
                outline:"none", fontFamily:"var(--font-mono)" }} />
            <span style={{ fontSize:"12px", color:"var(--admin-text-secondary)" }}>
              CLP por ticket directo
            </span>
          </div>
        </SectionCard>
      </div>

      {/* Productos participantes */}
      <SectionCard
        eyebrow="CATÁLOGO VINCULADO"
        title="Productos participantes"
        actions={
          <button data-testid="btn-add-product"
            type="button"
            onClick={() => setShowProductPicker(!showProductPicker)}
            className="au-btn au-btn--secondary au-btn--sm">
            {showProductPicker ? "Ocultar" : "+ Agregar producto"}
          </button>
        }
      >
        {showProductPicker && (
          <div style={{
            padding:"16px", marginBottom:"14px",
            background:"var(--admin-surface-soft)", border:"1px solid var(--admin-border)",
            borderRadius:"14px", maxHeight:"320px", overflowY:"auto",
          }}>
            <p style={{ fontSize:"12px", color:"var(--admin-text-secondary)",
              marginBottom:"12px" }}>
              Seleccioná un producto del catálogo para agregar. Podés configurar
              cuántas participaciones da cada unidad.
            </p>
            {productList.filter(p => !alreadyAdded.has(p.id)).map(p => (
              <div key={p.id} style={{
                display:"flex", justifyContent:"space-between",
                alignItems:"center", padding:"8px 0",
                borderBottom:"1px solid var(--admin-border)", gap: "10px",
              }}>
                <span style={{ fontSize:"13px", fontWeight: 600, color:"var(--admin-text)" }}>
                  {p.name} — ${Number(p.price).toLocaleString("es-CL")}
                </span>
                <button data-testid={`btn-add-${p.id}`}
                  type="button"
                  onClick={() => addProduct.mutate({
                    product: p.id,
                    entries_per_purchase: 5,
                    is_active: true,
                  })}
                  className="au-btn au-btn--primary au-btn--sm">
                  Agregar (5 tickets)
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          {c.reward_products.map(rp => (
            <div key={rp.id} style={{
              padding:"12px 16px", background:"var(--admin-surface-soft)",
              border:"1px solid var(--admin-border)", borderRadius:"14px",
              display:"flex", alignItems:"center", gap:"14px", flexWrap: "wrap",
            }}>
              {rp.product_image && (
                <img src={mediaUrl(rp.product_image)} alt=""
                  style={{ width:"40px", height:"40px", borderRadius:"10px",
                    objectFit:"cover" }} />
              )}
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:"13.5px", fontWeight: 700, color:"var(--admin-text)" }}>
                  {rp.product_name}
                </p>
                <p style={{ fontSize:"12px", color:"var(--admin-text-muted)", fontFamily: "var(--font-mono)" }}>
                  ${Number(rp.product_price).toLocaleString("es-CL")}
                </p>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                <input type="number" min="1" defaultValue={rp.entries_per_purchase}
                  onBlur={e => patchProduct.mutate({
                    rpid: rp.id,
                    payload: { entries_per_purchase: Number(e.target.value) },
                  })}
                  style={{
                    width:"70px", padding:"6px 10px",
                    background:"var(--admin-surface)",
                    border:"1px solid var(--admin-border-strong)",
                    borderRadius:"10px", color:"var(--admin-text)",
                    fontSize:"13px", fontWeight: 700, textAlign:"center",
                  }} />
                <span style={{ fontSize:"11px", color:"var(--admin-text-muted)" }}>tickets/u</span>
              </div>
              <button type="button" onClick={() => delProduct.mutate(rp.id)}
                className="au-pill-btn au-pill-btn--del"
                style={{ flex: "none", padding:"6px 12px", fontSize:"11px" }}>
                Quitar
              </button>
            </div>
          ))}
          {c.reward_products.length === 0 && (
            <p style={{ fontSize:"13px", color:"var(--admin-text-secondary)",
              padding:"18px", textAlign:"center" }}>
              Todavía no agregaste productos. Sin productos participantes,
              nadie puede ganar tickets.
            </p>
          )}
        </div>
      </SectionCard>

      {/* Ganadores */}
      {winners.length > 0 && (
        <SectionCard eyebrow="RESULTADO DEL SORTEO" title="🏆 Ganadores">
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            {winners.map(w => (
              <div key={w.id} style={{
                padding:"14px 18px",
                background: w.is_backup
                  ? "var(--admin-surface-soft)"
                  : "var(--admin-primary-soft)",
                border: w.is_backup
                  ? "1px solid var(--admin-border)"
                  : "1px solid rgba(26,255,110,0.35)",
                borderRadius:"14px",
                display:"flex", justifyContent:"space-between",
                alignItems:"center",
              }}>
                <div>
                  <p style={{ fontSize:"14px", fontWeight:800, color: "var(--admin-text)" }}>
                    {w.is_backup
                      ? `Suplente #${w.backup_position}`
                      : "🏆 GANADOR PRINCIPAL"}
                  </p>
                  <p style={{ fontSize:"12.5px", color:"var(--admin-text-secondary)",
                    marginTop:"2px" }}>
                    {w.user_name} · {w.user_email}
                  </p>
                  <p style={{ fontSize:"11px", color:"var(--admin-text-muted)",
                    marginTop:"2px", fontFamily:"var(--font-mono)" }}>
                    Ticket: {w.unique_code}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <div style={{ display:"flex", gap:"12px" }}>
        <SecondaryButton to={`/admin/rewards/entries?campaign=${id}`}>
          Ver todas las participaciones →
        </SecondaryButton>
      </div>
    </div>
  )
}
