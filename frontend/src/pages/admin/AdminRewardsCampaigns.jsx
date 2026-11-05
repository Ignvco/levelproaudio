// pages/admin/AdminRewardsCampaigns.jsx — Listado + CRUD de campañas
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  adminListCampaigns,
  adminCreateCampaign,
  adminDeleteCampaign,
  adminDuplicateCampaign,
} from "../../api/rewards.api"
import { showToast } from "../../components/ui/ToastNotification"
import { getProducts } from "../../api/products.api"
import { mediaUrl } from "../../utils/mediaUrl"
import { AdminPageHeader, PrimaryButton, SecondaryButton, StatCard, FormModal, formInputStyle, ConfirmationModal } from "../../components/admin/ui"
import { Gift, Sparkles, Ticket } from "lucide-react"

const STATUS_STYLES = {
  draft:    { bg:"var(--admin-surface-muted)", color:"var(--admin-text-secondary)", label:"Borrador"    },
  active:   { bg:"var(--admin-primary-soft)",  color:"var(--admin-primary-text)",   label:"Activa"      },
  finished: { bg:"rgba(245,158,11,0.12)",      color:"#B45309",                     label:"Finalizada"  },
}

function CampaignRow({ c, onDuplicate, onDelete }) {
  return (
    <div data-testid={`campaign-row-${c.id}`} className="au-card" style={{
      padding:"18px 22px",
      display:"flex", alignItems:"center", gap:"18px", flexWrap: "wrap",
    }}>
      <div style={{ minWidth:0, flex:"1 1 240px" }}>
        <div style={{ display:"flex", gap:"10px", alignItems:"center",
          marginBottom:"4px", flexWrap: "wrap" }}>
          <p style={{ fontSize:"15px", fontWeight:700, color:"var(--admin-text)",
            overflow:"hidden", textOverflow:"ellipsis",
            whiteSpace:"nowrap", maxWidth:"340px" }}>
            {c.name}
          </p>
          <span style={{
            fontSize:"10.5px", padding:"3px 10px",
            borderRadius:"9999px", fontWeight:700,
            letterSpacing:"0.06em", textTransform:"uppercase",
            background: STATUS_STYLES[c.status]?.bg,
            color:      STATUS_STYLES[c.status]?.color,
          }}>
            {STATUS_STYLES[c.status]?.label}
          </span>
        </div>
        <p style={{ fontSize:"12.5px", color:"var(--admin-text-secondary)" }}>
          🏆 {c.main_prize} · Sorteo {new Date(c.draw_date).toLocaleDateString("es-CL")}
        </p>
      </div>
      <div style={{ display:"flex", gap:"14px", alignItems:"center",
        fontSize:"13px", fontWeight: 700, color:"var(--admin-text-secondary)", fontFamily: "var(--font-mono)" }}>
        <span title="Participaciones">🎫 {c.total_entries}</span>
        <span title="Participantes">👥 {c.total_participants}</span>
      </div>
      <div style={{ display:"flex", gap:"8px", flexWrap: "wrap" }}>
        <Link to={`/admin/rewards/campaigns/${c.id}`}
          data-testid={`btn-edit-${c.id}`}
          className="au-pill-btn au-pill-btn--edit"
          style={{ padding:"7px 14px", fontSize:"12px", textDecoration:"none" }}>
          Gestionar
        </Link>
        <button type="button" onClick={() => onDuplicate(c.id)}
          data-testid={`btn-duplicate-${c.id}`}
          className="au-pill-btn au-pill-btn--edit"
          style={{ padding:"7px 14px", fontSize:"12px" }}>
          Duplicar
        </button>
        <button type="button" onClick={() => onDelete(c.id)}
          data-testid={`btn-delete-${c.id}`}
          className="au-pill-btn au-pill-btn--del"
          style={{ padding:"7px 14px", fontSize:"12px" }}>
          Eliminar
        </button>
      </div>
    </div>
  )
}

function NewCampaignModal({ open, onClose }) {
  const qc = useQueryClient()
  const nav = useNavigate()

  // Helper: formatea Date como valor local válido para <input type="datetime-local">
  const toLocalInput = (date) => {
    const pad = n => String(n).padStart(2, "0")
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}` +
           `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  const now = new Date()
  const in30 = new Date(Date.now() + 30 * 86400_000)
  const in31 = new Date(Date.now() + 31 * 86400_000)

  const [form, setForm] = useState({
    name:"", main_prize:"",
    start_date: toLocalInput(now),
    end_date:   toLocalInput(in30),
    draw_date:  toLocalInput(in31),
    description:"", legal_terms:"",
    backup_winners_count: 2,
    sticker_price: 1000,
    prize_product: "",
    status:"draft",
  })

  const [prodSearch, setProdSearch] = useState("")
  const { data: prodData } = useQuery({
    queryKey: ["admin-picker-products", prodSearch],
    queryFn:  () => getProducts({ search: prodSearch, page_size: 20 }),
    enabled:  open,
  })
  const products = prodData?.results || prodData || []
  const selectedProduct = products.find(p => String(p.id) === String(form.prize_product))

  const create = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      Object.entries(form).forEach(([k,v]) => {
        if (k === "prize_product" && !v) return
        fd.append(k, v)
      })
      return adminCreateCampaign(fd)
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey:["admin-campaigns"] })
      showToast("Campaña creada")
      onClose()
      nav(`/admin/rewards/campaigns/${data.id}`)
    },
    onError: (err) => {
      showToast(err?.response?.data?.detail || "Error al crear")
    },
  })

  if (!open) return null

  const label = (t) => (
    <label style={{ display:"block", fontSize:"11px", fontWeight:600,
      color:"var(--text-3)", letterSpacing:"0.08em",
      textTransform:"uppercase", marginBottom:"6px" }}>{t}</label>
  )
  const input = formInputStyle

  return (
    <FormModal
      open
      title="Nueva campaña"
      onClose={onClose}
      onSave={() => create.mutate()}
      saving={create.isPending}
      saveLabel="Crear campaña"
      maxWidth="560px"
      scrollableBody
      testId="new-campaign-modal"
    >        <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
          <div>
            {label("Nombre")}
            <input data-testid="input-campaign-name"
              value={form.name}
              onChange={e => setForm(p => ({...p, name:e.target.value}))}
              placeholder="Sorteo Neumann TLM 103" style={input} />
          </div>
          <div>
            {label("Premio principal")}
            <input data-testid="input-campaign-prize"
              value={form.main_prize}
              onChange={e => setForm(p => ({...p, main_prize:e.target.value}))}
              placeholder="Neumann TLM 103 + Focusrite Scarlett 2i2" style={input} />
          </div>

          {/* Producto a sortear (del catálogo) */}
          <div>
            {label("Producto a sortear (del catálogo)")}
            {selectedProduct ? (
              <div data-testid="selected-prize-product" style={{ display:"flex", alignItems:"center", gap:"12px",
                padding:"10px 12px", borderRadius:"var(--r-md)",
                background:"rgba(26,255,110,0.06)", border:"1px solid rgba(26,255,110,0.3)" }}>
                <img src={mediaUrl(selectedProduct.primary_image)} alt=""
                  style={{ width:"44px", height:"44px", borderRadius:"10px",
                    objectFit:"cover", background:"var(--surface-3)" }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:"14px", fontWeight:600, color:"var(--text)",
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {selectedProduct.name}
                  </p>
                  <p style={{ fontSize:"12px", color:"var(--accent-text)" }}>
                    ${Number(selectedProduct.price).toLocaleString("es-CL")}
                  </p>
                </div>
                <button type="button" onClick={() => setForm(p => ({...p, prize_product:""}))}
                  style={{ padding:"6px 12px", fontSize:"12px", cursor:"pointer",
                    borderRadius:"var(--r-full)", border:"1px solid var(--border)",
                    background:"transparent", color:"var(--text-3)" }}>
                  Quitar
                </button>
              </div>
            ) : (
              <>
                <input data-testid="prize-product-search"
                  value={prodSearch}
                  onChange={e => setProdSearch(e.target.value)}
                  placeholder="Buscar producto del catálogo..." style={input} />
                <div style={{ marginTop:"8px", maxHeight:"180px", overflowY:"auto",
                  display:"flex", flexDirection:"column", gap:"6px",
                  border:"1px solid var(--border)", borderRadius:"var(--r-md)", padding:"6px" }}>
                  {products.length === 0 && (
                    <p style={{ fontSize:"12px", color:"var(--text-3)", padding:"10px", textAlign:"center" }}>
                      No hay productos. Escribí para buscar.
                    </p>
                  )}
                  {products.map(p => (
                    <button key={p.id} type="button"
                      data-testid={`pick-product-${p.slug}`}
                      onClick={() => setForm(f => ({...f, prize_product:p.id}))}
                      style={{ display:"flex", alignItems:"center", gap:"10px",
                        padding:"8px", borderRadius:"10px", cursor:"pointer",
                        background:"transparent", border:"1px solid transparent",
                        textAlign:"left", width:"100%" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <img src={mediaUrl(p.primary_image)} alt=""
                        style={{ width:"36px", height:"36px", borderRadius:"8px",
                          objectFit:"cover", background:"var(--surface-3)", flexShrink:0 }} />
                      <span style={{ flex:1, minWidth:0 }}>
                        <span style={{ display:"block", fontSize:"13px", color:"var(--text)",
                          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.name}</span>
                        <span style={{ display:"block", fontSize:"12px", color:"var(--text-3)" }}>
                          ${Number(p.price).toLocaleString("es-CL")}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
            <div>
              {label("Inicio")}
              <input type="datetime-local" value={form.start_date}
                onChange={e => setForm(p => ({...p, start_date:e.target.value}))}
                style={input} />
            </div>
            <div>
              {label("Cierre compra")}
              <input type="datetime-local" value={form.end_date}
                onChange={e => setForm(p => ({...p, end_date:e.target.value}))}
                style={input} />
            </div>
          </div>
          <div>
            {label("Fecha del sorteo")}
            <input type="datetime-local" value={form.draw_date}
              onChange={e => setForm(p => ({...p, draw_date:e.target.value}))}
              style={input} />
          </div>
          <div>
            {label("Precio por sticker (CLP)")}
            <input type="number" min="0" step="100" data-testid="input-campaign-sticker-price"
              value={form.sticker_price}
              onChange={e => setForm(p => ({...p, sticker_price:e.target.value}))}
              placeholder="1000" style={input} />
            <p style={{ fontSize:"11px", color:"var(--text-3)", marginTop:"6px" }}>
              Cada sticker equivale a 1 ticket de participación.
            </p>
          </div>
          <div>
            {label("Descripción")}
            <textarea value={form.description}
              onChange={e => setForm(p => ({...p, description:e.target.value}))}
              rows={3} style={{ ...input, resize:"vertical" }} />
          </div>
          <div>
            {label("Bases legales")}
            <textarea value={form.legal_terms}
              onChange={e => setForm(p => ({...p, legal_terms:e.target.value}))}
              rows={4} style={{ ...input, resize:"vertical" }} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
            <div>
              {label("Suplentes")}
              <input type="number" min="0" max="10"
                value={form.backup_winners_count}
                onChange={e => setForm(p => ({...p, backup_winners_count:Number(e.target.value)}))}
                style={input} />
            </div>
            <div>
              {label("Estado inicial")}
              <select value={form.status}
                onChange={e => setForm(p => ({...p, status:e.target.value}))}
                style={input}>
                <option value="draft">Borrador</option>
                <option value="active">Activa</option>
              </select>
            </div>
          </div>
        </div>
    </FormModal>
  )
}

export default function AdminRewardsCampaigns() {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [toDelete, setToDelete]   = useState(null)

  const { data: rawCampaigns, isLoading } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn:  adminListCampaigns,
  })
  const campaigns = Array.isArray(rawCampaigns) ? rawCampaigns : []

  const dup = useMutation({
    mutationFn: adminDuplicateCampaign,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey:["admin-campaigns"] })
      showToast("Campaña duplicada")
    },
    onError:    (e) => showToast(e?.response?.data?.detail || "No se pudo duplicar la campaña.", "error"),
  })
  const del = useMutation({
    mutationFn: adminDeleteCampaign,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey:["admin-campaigns"] })
      showToast("Campaña eliminada")
      setToDelete(null)
    },
    onError:    (e) => {
      showToast(e?.response?.data?.detail || "No se pudo eliminar la campaña.", "error")
      setToDelete(null)
    },
  })

  const activeCount = campaigns.filter(c => c.status === "active").length
  const totalEntries = campaigns.reduce((acc, c) => acc + (Number(c.total_entries) || 0), 0)

  return (
    <div className="au-page">
      <AdminPageHeader
        eyebrow="LEVELPRO / REWARDS"
        title="Campañas"
        description={`${campaigns.length} campañas configuradas · ${activeCount} activas`}
        breadcrumbs={[
          { label: "Rewards", to: "/admin/rewards" },
          { label: "Campañas" },
        ]}
        actions={
          <>
            <SecondaryButton to="/admin/rewards" size="sm">← Dashboard</SecondaryButton>
            <PrimaryButton
              testId="btn-new-campaign"
              onClick={() => setModalOpen(true)}
            >
              + Nueva campaña
            </PrimaryButton>
          </>
        }
      />

      <div className="lp-kpi-strip">
        <StatCard variant="ink" Icon={Gift} label="Campañas totales" value={campaigns.length} sub="Registradas en sistema" />
        <StatCard variant="primary" Icon={Sparkles} label="Campañas activas" value={activeCount} sub="En curso actualmente" />
        <StatCard variant="light" Icon={Ticket} label="Participaciones" value={totalEntries} sub="Tickets acumulados" />
      </div>

      {isLoading && <p style={{ color:"var(--admin-text-muted)" }}>Cargando…</p>}

      {!isLoading && campaigns.length === 0 && (
        <div className="au-card au-panel" style={{ padding:"48px 32px", textAlign:"center" }}>
          <p style={{ fontSize:"42px", marginBottom:"10px" }}>🎁</p>
          <p style={{ fontSize:"15px", fontWeight: 700, color:"var(--admin-text)", marginBottom:"6px" }}>
            No hay campañas creadas.
          </p>
          <p style={{ fontSize:"13px", color:"var(--admin-text-secondary)", marginBottom:"18px" }}>
            Creá tu primera campaña para empezar a generar participaciones automáticamente.
          </p>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
        {campaigns.map(c => (
          <CampaignRow key={c.id} c={c}
            onDuplicate={id => dup.mutate(id)}
            onDelete={id => setToDelete(id)} />
        ))}
      </div>

      <ConfirmationModal
        open={!!toDelete}
        title="¿Eliminar campaña?"
        description="Se borran también sus participaciones."
        danger
        loading={del.isPending}
        onConfirm={() => del.mutate(toDelete)}
        onCancel={() => setToDelete(null)}
        testId="delete-campaign-modal"
      />

      <NewCampaignModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
