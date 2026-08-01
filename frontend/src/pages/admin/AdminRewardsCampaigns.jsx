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

const STATUS_STYLES = {
  draft:    { bg:"rgba(255,255,255,0.05)", color:"var(--text-3)", label:"Borrador"    },
  active:   { bg:"rgba(26,255,110,0.1)",   color:"var(--accent-text)", label:"Activa"      },
  finished: { bg:"rgba(250,204,21,0.08)",  color:"#D97706",       label:"Finalizada"  },
}

function CampaignRow({ c, onDuplicate, onDelete }) {
  return (
    <div data-testid={`campaign-row-${c.id}`} style={{
      padding:"18px 22px", background:"var(--surface)",
      border:"1px solid var(--border)", borderRadius:"var(--r-lg)",
      display:"flex", alignItems:"center", gap:"18px",
    }}>
      <div style={{ minWidth:0, flex:1 }}>
        <div style={{ display:"flex", gap:"10px", alignItems:"center",
          marginBottom:"4px" }}>
          <p style={{ fontSize:"15px", fontWeight:500, color:"var(--text)",
            overflow:"hidden", textOverflow:"ellipsis",
            whiteSpace:"nowrap", maxWidth:"340px" }}>
            {c.name}
          </p>
          <span style={{
            fontSize:"10px", padding:"3px 9px",
            borderRadius:"var(--r-full)", fontWeight:700,
            letterSpacing:"0.06em", textTransform:"uppercase",
            background: STATUS_STYLES[c.status]?.bg,
            color:      STATUS_STYLES[c.status]?.color,
          }}>
            {STATUS_STYLES[c.status]?.label}
          </span>
        </div>
        <p style={{ fontSize:"12px", color:"var(--text-3)" }}>
          🏆 {c.main_prize} · Sorteo {new Date(c.draw_date).toLocaleDateString("es-CL")}
        </p>
      </div>
      <div style={{ display:"flex", gap:"14px", alignItems:"center",
        fontSize:"13px", color:"var(--text-2)" }}>
        <span title="Participaciones">🎫 {c.total_entries}</span>
        <span title="Participantes">👥 {c.total_participants}</span>
      </div>
      <div style={{ display:"flex", gap:"8px" }}>
        <Link to={`/admin/rewards/campaigns/${c.id}`}
          data-testid={`btn-edit-${c.id}`}
          style={{
            padding:"7px 14px", fontSize:"12px",
            borderRadius:"var(--r-full)",
            border:"1px solid var(--border)", color:"var(--text-2)",
            textDecoration:"none",
          }}>
          Gestionar
        </Link>
        <button onClick={() => onDuplicate(c.id)}
          data-testid={`btn-duplicate-${c.id}`}
          style={{
            padding:"7px 14px", fontSize:"12px", cursor:"pointer",
            borderRadius:"var(--r-full)",
            border:"1px solid var(--border)", background:"transparent",
            color:"var(--text-3)",
          }}>
          Duplicar
        </button>
        <button onClick={() => onDelete(c.id)}
          data-testid={`btn-delete-${c.id}`}
          style={{
            padding:"7px 14px", fontSize:"12px", cursor:"pointer",
            borderRadius:"var(--r-full)",
            border:"1px solid rgba(239,68,68,0.3)",
            background:"transparent", color:"#ef4444",
          }}>
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
  const input = {
    width:"100%", padding:"11px 14px",
    background:"var(--surface-2)", border:"1px solid var(--border)",
    borderRadius:"var(--r-md)", color:"var(--text)",
    fontSize:"14px", outline:"none",
    fontFamily:"var(--font-sans)",
  }

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:200,
      background:"rgba(0,0,0,0.7)", backdropFilter:"blur(8px)",
      display:"flex", alignItems:"center", justifyContent:"center",
      padding:"20px",
    }} onClick={onClose}>
      <div data-testid="new-campaign-modal" onClick={e=>e.stopPropagation()} style={{
        background:"var(--surface)", border:"1px solid var(--border)",
        borderRadius:"var(--r-2xl)", padding:"32px",
        width:"100%", maxWidth:"560px", maxHeight:"85vh", overflowY:"auto",
      }}>
        <h2 style={{ fontSize:"20px", fontWeight:500, marginBottom:"24px" }}>
          Nueva campaña
        </h2>
        <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
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
        <div style={{ display:"flex", gap:"10px", marginTop:"28px",
          justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{
            padding:"11px 22px", fontSize:"13px",
            background:"transparent", border:"1px solid var(--border)",
            color:"var(--text-2)", borderRadius:"var(--r-full)",
            cursor:"pointer",
          }}>Cancelar</button>
          <button data-testid="btn-save-campaign"
            onClick={() => create.mutate()}
            disabled={!form.name || !form.main_prize || create.isPending}
            className="btn btn-accent"
            style={{ padding:"11px 22px", fontSize:"13px" }}>
            {create.isPending ? "Creando…" : "Crear campaña"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminRewardsCampaigns() {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn:  adminListCampaigns,
  })

  const dup = useMutation({
    mutationFn: adminDuplicateCampaign,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey:["admin-campaigns"] })
      showToast("Campaña duplicada")
    },
  })
  const del = useMutation({
    mutationFn: adminDeleteCampaign,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey:["admin-campaigns"] })
      showToast("Campaña eliminada")
    },
  })

  return (
    <div style={{ padding:"clamp(28px, 4vw, 40px)" }}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"start", marginBottom:"32px", flexWrap:"wrap", gap:"12px" }}>
        <div>
          <p style={{ fontSize:"12px", color:"var(--accent-text)",
            letterSpacing:"0.1em", textTransform:"uppercase",
            fontWeight:600, marginBottom:"6px" }}>
            Rewards
          </p>
          <h1 style={{ fontSize:"28px", fontWeight:500 }}>Campañas</h1>
        </div>
        <button data-testid="btn-new-campaign"
          onClick={() => setModalOpen(true)}
          className="btn btn-accent"
          style={{ padding:"10px 20px", fontSize:"13px" }}>
          + Nueva campaña
        </button>
      </div>

      {isLoading && <p style={{ color:"var(--text-3)" }}>Cargando…</p>}

      {!isLoading && campaigns.length === 0 && (
        <div style={{
          padding:"48px 32px", background:"var(--surface)",
          border:"1px solid var(--border)", borderRadius:"var(--r-2xl)",
          textAlign:"center",
        }}>
          <p style={{ fontSize:"46px", marginBottom:"12px" }}>🎁</p>
          <p style={{ fontSize:"15px", color:"var(--text-2)", marginBottom:"6px" }}>
            No hay campañas creadas.
          </p>
          <p style={{ fontSize:"13px", color:"var(--text-3)", marginBottom:"20px" }}>
            Creá tu primera campaña para empezar a generar participaciones automáticamente.
          </p>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
        {campaigns.map(c => (
          <CampaignRow key={c.id} c={c}
            onDuplicate={id => dup.mutate(id)}
            onDelete={id => {
              if (confirm("¿Eliminar esta campaña? Se borran también sus participaciones.")) {
                del.mutate(id)
              }
            }} />
        ))}
      </div>

      <NewCampaignModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
