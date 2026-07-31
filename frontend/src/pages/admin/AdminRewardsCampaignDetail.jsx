// pages/admin/AdminRewardsCampaignDetail.jsx — Gestión detallada
import { useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
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

const chip = (color, bg) => ({
  fontSize:"10px", padding:"3px 9px", borderRadius:"var(--r-full)",
  background:bg, color, fontWeight:700,
  letterSpacing:"0.06em", textTransform:"uppercase",
})

export default function AdminRewardsCampaignDetail() {
  const { id } = useParams()
  const nav    = useNavigate()
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
  })

  const addProduct = useMutation({
    mutationFn: (payload) => adminAddRewardProduct({ campaign:id, ...payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:["admin-campaign", id] })
      showToast("Producto agregado")
    },
    onError: () => showToast("Ya está agregado a la campaña"),
  })
  const delProduct = useMutation({
    mutationFn: adminDeleteRewardProduct,
    onSuccess:  () => qc.invalidateQueries({ queryKey:["admin-campaign", id] }),
  })
  const patchProduct = useMutation({
    mutationFn: ({rpid, payload}) => adminUpdateRewardProduct(rpid, payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey:["admin-campaign", id] }),
  })
  const draw = useMutation({
    mutationFn: () => adminDrawCampaign(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:["admin-campaign", id] })
      qc.invalidateQueries({ queryKey:["admin-campaign-winners", id] })
      showToast("🎉 Sorteo ejecutado")
    },
    onError: (err) => showToast(err?.response?.data?.error || "Error"),
  })
  const finish = useMutation({
    mutationFn: () => adminFinishCampaign(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey:["admin-campaign", id] }),
  })

  if (isLoading || !c) return (
    <div style={{ padding:"40px" }}>
      <p style={{ color:"var(--text-3)" }}>Cargando…</p>
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
    <div style={{ padding:"clamp(28px, 4vw, 40px)", maxWidth:"1080px" }}>
      {/* Header */}
      <Link to="/admin/rewards/campaigns" style={{
        fontSize:"12px", color:"var(--text-3)",
        textDecoration:"none", marginBottom:"12px", display:"inline-block",
      }}>← Todas las campañas</Link>

      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"start", marginBottom:"28px", flexWrap:"wrap", gap:"12px" }}>
        <div>
          <div style={{ display:"flex", gap:"10px", alignItems:"center",
            marginBottom:"6px" }}>
            <h1 style={{ fontFamily:"var(--font-serif)",
              fontSize:"26px", fontWeight:400,
              letterSpacing:"-0.01em" }}>
              {c.name}
            </h1>
            <span style={chip(
              c.status === "active" ? "var(--accent)" :
              c.status === "finished" ? "#facc15" : "var(--text-3)",
              c.status === "active" ? "rgba(26,255,110,0.1)" :
              c.status === "finished" ? "rgba(250,204,21,0.08)" :
              "rgba(255,255,255,0.05)"
            )}>
              {c.status}
            </span>
          </div>
          <p style={{ fontSize:"14px", color:"var(--text-2)" }}>🏆 {c.main_prize}</p>
        </div>

        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
          {c.status !== "finished" && c.status !== "active" && (
            <button data-testid="btn-publish"
              onClick={() => update.mutate({ status:"active" })}
              className="btn btn-accent"
              style={{ padding:"9px 18px", fontSize:"13px" }}>
              Publicar
            </button>
          )}
          {c.status === "active" && !c.is_drawn && (
            <button data-testid="btn-finish"
              onClick={() => finish.mutate()}
              style={{
                padding:"9px 18px", fontSize:"13px",
                background:"transparent", border:"1px solid var(--border)",
                color:"var(--text-2)", borderRadius:"var(--r-full)",
                cursor:"pointer",
              }}>
              Cerrar campaña
            </button>
          )}
          {!c.is_drawn && (
            <button data-testid="btn-draw"
              onClick={() => {
                if (confirm(`¿Ejecutar sorteo? Esta acción NO se puede repetir.\n\n${c.total_entries} participaciones · Se seleccionará 1 ganador + ${c.backup_winners_count} suplente(s).`)) {
                  draw.mutate()
                }
              }}
              disabled={draw.isPending || c.total_entries === 0}
              style={{
                padding:"9px 18px", fontSize:"13px",
                background:"var(--accent)", color:"#000",
                border:"none", borderRadius:"var(--r-full)",
                cursor:"pointer", fontWeight:600,
                opacity: c.total_entries === 0 ? 0.4 : 1,
              }}>
              {draw.isPending ? "Sorteando…" : "🎲 Ejecutar sorteo"}
            </button>
          )}
        </div>
      </div>

      {/* Aviso de visibilidad pública */}
      {(notStarted || expired) && (
        <div data-testid="visibility-warning" style={{
          padding:"14px 20px", marginBottom:"20px",
          background:"rgba(250,204,21,0.06)",
          border:"1px solid rgba(250,204,21,0.3)",
          borderRadius:"var(--r-lg)",
          fontSize:"13px", color:"#facc15", display:"flex",
          alignItems:"center", gap:"10px",
        }}>
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
        <div style={{
          padding:"10px 16px", marginBottom:"20px",
          background:"rgba(26,255,110,0.06)",
          border:"1px solid rgba(26,255,110,0.25)",
          borderRadius:"var(--r-lg)",
          fontSize:"12px", color:"var(--accent)",
          display:"inline-flex", alignItems:"center", gap:"8px",
        }}>
          <span style={{ width:"7px", height:"7px", borderRadius:"50%",
            background:"var(--accent)",
            animation:"lp-pulse 2s ease-in-out infinite" }} />
          Visible en <strong style={{ marginLeft:"3px" }}>/rewards</strong>
        </div>
      )}

      {/* Panel de fechas editable */}
      <div style={{
        padding:"18px 22px", marginBottom:"28px",
        background:"var(--surface)", border:"1px solid var(--border)",
        borderRadius:"var(--r-xl)",
      }}>
        <h3 style={{ fontSize:"13px", fontWeight:600, color:"var(--text-2)",
          letterSpacing:"0.08em", textTransform:"uppercase",
          marginBottom:"14px" }}>
          Fechas
        </h3>
        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",
          gap:"12px",
        }}>
          {[
            ["Inicio",         "start_date"],
            ["Cierre compra",  "end_date"],
            ["Fecha del sorteo","draw_date"],
          ].map(([label, field]) => (
            <div key={field}>
              <label style={{ fontSize:"11px", fontWeight:600,
                color:"var(--text-3)", letterSpacing:"0.06em",
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
                  background:"var(--surface-2)",
                  border:"1px solid var(--border)",
                  borderRadius:"var(--r-md)", color:"var(--text)",
                  fontSize:"13px", outline:"none",
                  fontFamily:"var(--font-sans)",
                  colorScheme:"dark",
                }} />
            </div>
          ))}
        </div>
        <p style={{ fontSize:"11px", color:"var(--text-3)", marginTop:"10px" }}>
          Los cambios se guardan al hacer clic fuera del campo (blur).
        </p>
      </div>

      {/* Precio por sticker */}
      <div style={{ marginBottom:"32px", padding:"20px",
        background:"var(--surface)", border:"1px solid var(--border)",
        borderRadius:"var(--r-lg)" }}>
        <h3 style={{ fontSize:"14px", fontWeight:600, color:"var(--text-2)",
          letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"12px" }}>
          Precio por sticker
        </h3>
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
              background:"var(--surface-2)", border:"1px solid var(--border)",
              borderRadius:"var(--r-md)", color:"var(--text)", fontSize:"14px",
              outline:"none", fontFamily:"var(--font-sans)" }} />
          <span style={{ fontSize:"12px", color:"var(--text-3)" }}>
            CLP · cada sticker = 1 ticket de participación
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))",
        gap:"10px", marginBottom:"32px",
      }}>
        {[
          ["Participaciones", c.total_entries,      "var(--accent)"],
          ["Participantes",   c.total_participants, "#fff"],
          ["Productos",       c.reward_products.length, "#fff"],
          ["Suplentes",       c.backup_winners_count,   "#fff"],
        ].map(([label, value, color]) => (
          <div key={label} style={{
            padding:"18px", background:"var(--surface)",
            border:"1px solid var(--border)", borderRadius:"var(--r-lg)",
          }}>
            <p style={{ fontSize:"11px", color:"var(--text-3)",
              letterSpacing:"0.1em", textTransform:"uppercase",
              marginBottom:"8px" }}>{label}</p>
            <p style={{ fontSize:"22px", fontWeight:600, color,
              fontVariantNumeric:"tabular-nums" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Productos participantes */}
      <div style={{ marginBottom:"32px" }}>
        <div style={{ display:"flex", justifyContent:"space-between",
          alignItems:"center", marginBottom:"14px" }}>
          <h3 style={{ fontSize:"14px", fontWeight:600, color:"var(--text-2)",
            letterSpacing:"0.08em", textTransform:"uppercase" }}>
            Productos participantes
          </h3>
          <button data-testid="btn-add-product"
            onClick={() => setShowProductPicker(!showProductPicker)}
            style={{
              padding:"7px 14px", fontSize:"12px",
              background:"transparent", border:"1px solid var(--border)",
              color:"var(--text-2)", borderRadius:"var(--r-full)",
              cursor:"pointer",
            }}>
            {showProductPicker ? "Ocultar" : "+ Agregar producto"}
          </button>
        </div>

        {showProductPicker && (
          <div style={{
            padding:"18px", marginBottom:"14px",
            background:"var(--surface)", border:"1px solid var(--border)",
            borderRadius:"var(--r-lg)", maxHeight:"320px", overflowY:"auto",
          }}>
            <p style={{ fontSize:"11px", color:"var(--text-3)",
              marginBottom:"12px" }}>
              Seleccioná un producto del catálogo para agregar. Podés configurar
              cuántas participaciones da cada unidad.
            </p>
            {productList.filter(p => !alreadyAdded.has(p.id)).map(p => (
              <div key={p.id} style={{
                display:"flex", justifyContent:"space-between",
                alignItems:"center", padding:"8px 0",
                borderBottom:"1px solid var(--border)",
              }}>
                <span style={{ fontSize:"13px", color:"var(--text)" }}>
                  {p.name} — ${Number(p.price).toLocaleString("es-CL")}
                </span>
                <button data-testid={`btn-add-${p.id}`}
                  onClick={() => addProduct.mutate({
                    product: p.id,
                    entries_per_purchase: 5,
                    is_active: true,
                  })}
                  style={{
                    padding:"5px 12px", fontSize:"11px",
                    background:"var(--accent)", color:"#000",
                    border:"none", borderRadius:"var(--r-full)",
                    cursor:"pointer", fontWeight:600,
                  }}>
                  Agregar (5 tickets)
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          {c.reward_products.map(rp => (
            <div key={rp.id} style={{
              padding:"14px 18px", background:"var(--surface)",
              border:"1px solid var(--border)", borderRadius:"var(--r-lg)",
              display:"flex", alignItems:"center", gap:"14px",
            }}>
              {rp.product_image && (
                <img src={mediaUrl(rp.product_image)} alt=""
                  style={{ width:"40px", height:"40px", borderRadius:"var(--r-md)",
                    objectFit:"cover" }} />
              )}
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:"14px", color:"var(--text)" }}>
                  {rp.product_name}
                </p>
                <p style={{ fontSize:"12px", color:"var(--text-3)" }}>
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
                    background:"var(--surface-2)",
                    border:"1px solid var(--border)",
                    borderRadius:"var(--r-md)", color:"var(--text)",
                    fontSize:"13px", textAlign:"center",
                  }} />
                <span style={{ fontSize:"11px", color:"var(--text-3)" }}>tickets/u</span>
              </div>
              <button onClick={() => delProduct.mutate(rp.id)}
                style={{
                  padding:"6px 12px", fontSize:"11px",
                  background:"transparent",
                  border:"1px solid rgba(239,68,68,0.3)",
                  color:"#ef4444", borderRadius:"var(--r-full)",
                  cursor:"pointer",
                }}>
                Quitar
              </button>
            </div>
          ))}
          {c.reward_products.length === 0 && (
            <p style={{ fontSize:"13px", color:"var(--text-3)",
              padding:"18px", textAlign:"center" }}>
              Todavía no agregaste productos. Sin productos participantes,
              nadie puede ganar tickets.
            </p>
          )}
        </div>
      </div>

      {/* Ganadores */}
      {winners.length > 0 && (
        <div>
          <h3 style={{ fontSize:"14px", fontWeight:600, color:"var(--text-2)",
            letterSpacing:"0.08em", textTransform:"uppercase",
            marginBottom:"14px" }}>
            🏆 Ganadores
          </h3>
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            {winners.map(w => (
              <div key={w.id} style={{
                padding:"14px 18px",
                background: w.is_backup
                  ? "var(--surface)"
                  : "linear-gradient(135deg, rgba(26,255,110,0.08) 0%, transparent 100%)",
                border: w.is_backup
                  ? "1px solid var(--border)"
                  : "1px solid rgba(26,255,110,0.3)",
                borderRadius:"var(--r-lg)",
                display:"flex", justifyContent:"space-between",
                alignItems:"center",
              }}>
                <div>
                  <p style={{ fontSize:"14px", fontWeight:500 }}>
                    {w.is_backup
                      ? `Suplente #${w.backup_position}`
                      : "🏆 GANADOR PRINCIPAL"}
                  </p>
                  <p style={{ fontSize:"12px", color:"var(--text-2)",
                    marginTop:"2px" }}>
                    {w.user_name} · {w.user_email}
                  </p>
                  <p style={{ fontSize:"11px", color:"var(--text-3)",
                    marginTop:"2px", fontFamily:"monospace" }}>
                    Ticket: {w.unique_code}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display:"flex", gap:"12px", marginTop:"32px" }}>
        <Link to={`/admin/rewards/entries?campaign=${id}`}
          style={{
            padding:"9px 18px", fontSize:"13px",
            background:"var(--surface)", border:"1px solid var(--border)",
            color:"var(--text)", borderRadius:"var(--r-full)",
            textDecoration:"none",
          }}>
          Ver todas las participaciones →
        </Link>
      </div>
    </div>
  )
}
