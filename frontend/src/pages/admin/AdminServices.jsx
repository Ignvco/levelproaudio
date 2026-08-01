// pages/admin/AdminServices.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getAdminServiceRequests,
  updateRequestStatus, updateBookingStatus,
  listAdminServicesCrud, createAdminService,
  updateAdminService, deleteAdminService,
} from "../../api/admin.api"
import { getServiceCategories } from "../../api/services.api"
import { mediaUrl } from "../../utils/mediaUrl"
import { showToast } from "../../components/ui/ToastNotification"

const inputSt = {
  width: "100%", padding: "10px 14px",
  background: "var(--surface-2)", border: "1px solid var(--border)",
  borderRadius: "var(--r-md)", color: "var(--text)",
  fontSize: "13px", outline: "none",
}

const REQ_STATUS = {
  pending:   { label: "Pendiente",   color: "#D97706" },
  reviewing: { label: "En revisión", color: "#60a5fa" },
  accepted:  { label: "Aceptado",    color: "#0F9940" },
  rejected:  { label: "Rechazado",   color: "#EF4444" },
  completed: { label: "Completado",  color: "#0F9940" },
}

function StatusBadge({ status, map }) {
  const c = map[status] || { label: status, color: "#888" }
  return (
    <span style={{
      padding: "2px 8px", borderRadius: "var(--r-full)", fontSize: "11px",
      fontWeight: 500, color: c.color,
      background: `${c.color}14`, border: `1px solid ${c.color}30`,
    }}>
      {c.label}
    </span>
  )
}

export default function AdminServices() {
  const [tab, setTab]         = useState(0)
  const [modal, setModal]     = useState(null)  // null | "new" | {service}
  const queryClient           = useQueryClient()
  const TABS                  = ["Solicitudes", "Servicios"]

  const { data: servicesData, isLoading: loadingServices } = useQuery({
    queryKey: ["admin-services-crud"], queryFn: listAdminServicesCrud,
  })
  const { data: requestsData, isLoading: loadingReqs } = useQuery({
    queryKey: ["admin-requests"], queryFn: getAdminServiceRequests,
  })

  const reqMutation = useMutation({
    mutationFn: ({ id, data }) => updateRequestStatus(id, data),
    onSuccess:  () => queryClient.invalidateQueries(["admin-requests"]),
  })

  const delMutation = useMutation({
    mutationFn: deleteAdminService,
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey:["admin-services-crud"] })
      showToast("Servicio eliminado")
    },
  })

  const services = servicesData?.results || servicesData || []
  const requests = requestsData?.results || requestsData || []

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontFamily: "var(--font-display)",
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 800,
          letterSpacing: "-0.02em", marginBottom: "6px" }}>
          Servicios
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
          {requests.length} solicitudes · {services.length} servicios activos
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0", marginBottom: "24px",
        borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t, i) => (
          <button key={t} type="button" onClick={() => setTab(i)} style={{
            padding: "9px 20px", fontSize: "13px", cursor: "pointer",
            background: "none", border: "none",
            borderBottom: tab === i ? "2px solid var(--accent)" : "2px solid transparent",
            color: tab === i ? "var(--accent)" : "var(--text-3)",
            fontWeight: tab === i ? 500 : 400, marginBottom: "-1px",
          }}>
            {t}
            {i === 0 && requests.filter(r => r.status === "pending").length > 0 && (
              <span style={{
                marginLeft: "6px", padding: "1px 6px",
                borderRadius: "var(--r-full)", fontSize: "10px",
                background: "#D97706", color: "#000", fontWeight: 700,
              }}>
                {requests.filter(r => r.status === "pending").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB SOLICITUDES */}
      {tab === 0 && (
        loadingReqs ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "72px" }} />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px",
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-2xl)", color: "var(--text-3)" }}>
            <p style={{ fontSize: "40px", marginBottom: "12px" }}>🔧</p>
            <p style={{ fontSize: "15px" }}>Sin solicitudes pendientes</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {requests.map(req => (
              <div key={req.id} style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--r-xl)", padding: "20px 24px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start", flexWrap: "wrap", gap: "12px",
                  marginBottom: "14px" }}>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 500, marginBottom: "4px" }}>
                      {req.service_name}
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                      {req.name} · {req.email}
                      {req.phone && ` · ${req.phone}`}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <StatusBadge status={req.status} map={REQ_STATUS} />
                    <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                      {new Date(req.created_at).toLocaleDateString("es-CL", {
                        day: "numeric", month: "short", year: "numeric"
                      })}
                    </span>
                  </div>
                </div>

                {req.message && (
                  <p style={{ fontSize: "13px", color: "var(--text-2)", lineHeight: 1.6,
                    padding: "12px 14px", background: "var(--surface-2)",
                    borderRadius: "var(--r-md)", marginBottom: "14px",
                    border: "1px solid var(--border)" }}>
                    &quot;{req.message}&quot;
                  </p>
                )}

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {Object.entries(REQ_STATUS).map(([s, { label, color }]) => (
                    s !== req.status && (
                      <button key={s}
                        onClick={() => reqMutation.mutate({ id: req.id, data: { status: s } })}
                        disabled={reqMutation.isPending}
                        style={{
                          padding: "5px 12px", borderRadius: "var(--r-full)",
                          fontSize: "12px", cursor: "pointer", fontWeight: 500,
                          color, background: `${color}10`, border: `1px solid ${color}25`,
                          transition: "all var(--dur) var(--ease)",
                          opacity: reqMutation.isPending ? 0.5 : 1,
                        }}>
                        → {label}
                      </button>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* TAB SERVICIOS */}
      {tab === 1 && (
        <>
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"center", marginBottom:"18px" }}>
            <p style={{ fontSize:"13px", color:"var(--text-3)" }}>
              {services.length} servicios registrados
            </p>
            <button onClick={() => setModal("new")}
              data-testid="btn-new-service"
              className="btn btn-accent"
              style={{ padding:"9px 18px", fontSize:"13px" }}>
              + Nuevo servicio
            </button>
          </div>

          {loadingServices ? (
            <div style={{ display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: "120px" }} />
              ))}
            </div>
          ) : (
            <div style={{ display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
              {services.map(s => (
                <div key={s.id} style={{
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "var(--r-xl)", padding: "20px",
                  display: "flex", flexDirection: "column", gap: "10px",
                }} className="card card-glow">
                  <div style={{ display: "flex", justifyContent: "space-between",
                    alignItems: "flex-start" }}>
                    <p style={{ fontSize: "14px", fontWeight: 500 }}>{s.name}</p>
                    <span style={{
                      padding: "2px 8px", borderRadius: "var(--r-full)", fontSize: "11px",
                      fontWeight: 500,
                      color:      s.is_active ? "var(--accent)" : "var(--text-3)",
                      background: s.is_active ? "rgba(26,255,110,0.1)" : "var(--surface-2)",
                      border:     `1px solid ${s.is_active ? "rgba(26,255,110,0.2)" : "var(--border)"}`,
                    }}>
                      {s.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  {s.short_description && (
                    <p style={{ fontSize: "12px", color: "var(--text-3)", lineHeight: 1.6 }}>
                      {s.short_description}
                    </p>
                  )}
                  <p style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem",
                    color: "var(--accent-text)" }}>
                    {s.price_display}
                  </p>
                  <div style={{ display:"flex", gap:"8px", marginTop:"auto",
                    paddingTop:"10px", borderTop:"1px solid var(--border)" }}>
                    <button onClick={() => setModal(s)}
                      data-testid={`btn-edit-service-${s.id}`}
                      style={{
                        flex:1, padding:"7px 12px", fontSize:"12px",
                        background:"var(--surface-2)", border:"1px solid var(--border)",
                        color:"var(--text)", borderRadius:"var(--r-full)",
                        cursor:"pointer",
                      }}>
                      Editar
                    </button>
                    <button onClick={() => {
                        if (confirm(`¿Eliminar "${s.name}"?`)) delMutation.mutate(s.id)
                      }}
                      data-testid={`btn-delete-service-${s.id}`}
                      style={{
                        padding:"7px 12px", fontSize:"12px",
                        background:"transparent",
                        border:"1px solid rgba(239,68,68,0.3)",
                        color:"#ef4444", borderRadius:"var(--r-full)",
                        cursor:"pointer",
                      }}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
              {services.length === 0 && (
                <div style={{ gridColumn:"1/-1", padding:"48px 24px",
                  textAlign:"center", color:"var(--text-3)",
                  background:"var(--surface)", border:"1px solid var(--border)",
                  borderRadius:"var(--r-xl)" }}>
                  <p style={{ fontSize:"14px", marginBottom:"12px" }}>
                    No hay servicios creados aún.
                  </p>
                  <button onClick={() => setModal("new")} className="btn btn-accent"
                    style={{ padding:"10px 22px", fontSize:"13px" }}>
                    Crear el primer servicio
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal Nuevo/Editar */}
      {modal && (
        <ServiceModal
          service={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey:["admin-services-crud"] })} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Modal CRUD
// ═══════════════════════════════════════════════════════════════
function ServiceModal({ service, onClose, onSaved }) {
  const isEdit = !!service
  const modalQueryClient = useQueryClient()
  const [form, setForm] = useState({
    name:              service?.name || "",
    short_description: service?.short_description || "",
    description:       service?.description || "",
    price_type:        service?.price_type || "quote",
    price:             service?.price || "",
    duration_hours:    service?.duration_hours || "",
    category:          service?.category || "",
    is_active:         service?.is_active ?? true,
    is_featured:       service?.is_featured ?? false,
    order:             service?.order || 0,
  })
  const [newCategory, setNewCategory] = useState("")
  const [thumbFile, setThumbFile]     = useState(null)
  const [thumbPreview, setThumbPreview] = useState(
    service?.thumbnail ? mediaUrl(service.thumbnail) : null
  )

  const { data: catData } = useQuery({
    queryKey: ["service-categories"],
    queryFn:  getServiceCategories,
  })
  const categories = catData?.results || catData || []

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      showToast("La imagen supera 8MB. Usa una más liviana.")
      return
    }
    setThumbFile(file)
    setThumbPreview(URL.createObjectURL(file))
  }

  const buildPayload = () => {
    const fd = new FormData()
    fd.append("name", form.name)
    fd.append("short_description", form.short_description || "")
    fd.append("description", form.description || "")
    fd.append("price_type", form.price_type)
    fd.append("price", form.price_type === "quote" ? "" : (form.price || ""))
    fd.append("duration_hours", form.duration_hours || "")
    fd.append("is_active", form.is_active ? "true" : "false")
    fd.append("is_featured", form.is_featured ? "true" : "false")
    fd.append("order", form.order || 0)
    if (form.category === "__new__" && newCategory.trim()) {
      fd.append("category_name", newCategory.trim())
    } else {
      fd.append("category", form.category || "")
    }
    if (thumbFile) fd.append("thumbnail", thumbFile)
    return fd
  }

  const save = useMutation({
    mutationFn: () => isEdit
      ? updateAdminService(service.id, buildPayload())
      : createAdminService(buildPayload()),
    onSuccess: () => {
      showToast(isEdit ? "Servicio actualizado" : "Servicio creado")
      modalQueryClient.invalidateQueries({ queryKey: ["service-categories"] })
      onSaved(); onClose()
    },
    onError: (err) => showToast(err?.response?.data?.error || "Error al guardar"),
  })

  return (
    <div style={{ position:"fixed", inset:0, zIndex:200,
      background:"rgba(0,0,0,0.75)", backdropFilter:"blur(8px)",
      display:"flex", alignItems:"center", justifyContent:"center",
      padding:"20px" }} onClick={onClose}>
      <div data-testid="service-modal"
        onClick={e => e.stopPropagation()} style={{
        background:"var(--surface)", border:"1px solid var(--border)",
        borderRadius:"var(--r-2xl)", padding:"28px",
        width:"100%", maxWidth:"520px", maxHeight:"85vh", overflowY:"auto",
      }}>
        <h2 style={{ fontSize:"20px", fontWeight:500, marginBottom:"22px" }}>
          {isEdit ? "Editar servicio" : "Nuevo servicio"}
        </h2>

        <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
          {/* Imagen / portada */}
          <div>
            <label style={{ fontSize:"11px", fontWeight:600, color:"var(--text-3)",
              letterSpacing:"0.08em", textTransform:"uppercase" }}>Imagen / portada</label>
            <div style={{ marginTop:"8px", display:"flex", gap:"14px", alignItems:"center" }}>
              <div style={{
                width:"88px", height:"88px", borderRadius:"var(--r-lg)",
                overflow:"hidden", flexShrink:0,
                background:"var(--surface-2)", border:"1px solid var(--border)",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                {thumbPreview ? (
                  <img src={thumbPreview} alt="preview"
                    data-testid="service-thumb-preview"
                    style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                ) : (
                  <span style={{ fontSize:"22px", opacity:0.4 }}>🎧</span>
                )}
              </div>
              <label className="btn" data-testid="service-thumb-label" style={{
                padding:"9px 16px", fontSize:"13px", cursor:"pointer",
                background:"var(--surface-2)", border:"1px solid var(--border)",
                color:"var(--text)", borderRadius:"var(--r-full)",
              }}>
                {thumbPreview ? "Cambiar imagen" : "Subir imagen"}
                <input type="file" accept="image/*" onChange={onFile}
                  data-testid="input-service-thumbnail"
                  style={{ display:"none" }} />
              </label>
            </div>
          </div>

          <div>
            <label style={{ fontSize:"11px", fontWeight:600, color:"var(--text-3)",
              letterSpacing:"0.08em", textTransform:"uppercase" }}>Nombre *</label>
            <input data-testid="input-service-name"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name:e.target.value }))}
              placeholder="Mezcla y masterización"
              style={{ ...inputSt, marginTop:"6px" }} />
          </div>

          {/* Categoría */}
          <div>
            <label style={{ fontSize:"11px", fontWeight:600, color:"var(--text-3)",
              letterSpacing:"0.08em", textTransform:"uppercase" }}>Categoría</label>
            <select value={form.category}
              data-testid="select-service-category"
              onChange={e => setForm(p => ({ ...p, category:e.target.value }))}
              style={{ ...inputSt, marginTop:"6px" }}>
              <option value="">Sin categoría</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="__new__">➕ Nueva categoría…</option>
            </select>
            {form.category === "__new__" && (
              <input value={newCategory}
                data-testid="input-new-category"
                onChange={e => setNewCategory(e.target.value)}
                placeholder="Nombre de la nueva categoría (ej. Producción)"
                style={{ ...inputSt, marginTop:"8px" }} />
            )}
          </div>

          <div>
            <label style={{ fontSize:"11px", fontWeight:600, color:"var(--text-3)",
              letterSpacing:"0.08em", textTransform:"uppercase" }}>
              Descripción corta
            </label>
            <input value={form.short_description}
              onChange={e => setForm(p => ({ ...p, short_description:e.target.value }))}
              placeholder="Servicio profesional de mezcla y master"
              style={{ ...inputSt, marginTop:"6px" }} />
          </div>

          <div>
            <label style={{ fontSize:"11px", fontWeight:600, color:"var(--text-3)",
              letterSpacing:"0.08em", textTransform:"uppercase" }}>
              Descripción completa
            </label>
            <textarea value={form.description}
              onChange={e => setForm(p => ({ ...p, description:e.target.value }))}
              rows={4} placeholder="Detalles del servicio..."
              style={{ ...inputSt, marginTop:"6px", resize:"vertical" }} />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
            <div>
              <label style={{ fontSize:"11px", fontWeight:600, color:"var(--text-3)",
                letterSpacing:"0.08em", textTransform:"uppercase" }}>Tipo de precio</label>
              <select value={form.price_type}
                onChange={e => setForm(p => ({ ...p, price_type:e.target.value }))}
                style={{ ...inputSt, marginTop:"6px" }}>
                <option value="quote">A cotizar</option>
                <option value="fixed">Precio fijo</option>
                <option value="hourly">Por hora</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:"11px", fontWeight:600, color:"var(--text-3)",
                letterSpacing:"0.08em", textTransform:"uppercase" }}>Precio</label>
              <input type="number" value={form.price || ""}
                disabled={form.price_type === "quote"}
                onChange={e => setForm(p => ({ ...p, price:e.target.value }))}
                style={{ ...inputSt, marginTop:"6px",
                  opacity: form.price_type === "quote" ? 0.4 : 1 }} />
            </div>
          </div>

          <div style={{ width:"50%", paddingRight:"6px" }}>
            <label style={{ fontSize:"11px", fontWeight:600, color:"var(--text-3)",
              letterSpacing:"0.08em", textTransform:"uppercase" }}>Duración (horas)</label>
            <input type="number" min="0" value={form.duration_hours}
              data-testid="input-service-duration"
              onChange={e => setForm(p => ({ ...p, duration_hours:e.target.value }))}
              placeholder="Ej. 4"
              style={{ ...inputSt, marginTop:"6px" }} />
          </div>

          <div style={{ display:"flex", gap:"18px", marginTop:"4px" }}>
            <label style={{ display:"flex", gap:"8px", alignItems:"center",
              fontSize:"13px", color:"var(--text-2)", cursor:"pointer" }}>
              <input type="checkbox" checked={form.is_active}
                onChange={e => setForm(p => ({ ...p, is_active:e.target.checked }))} />
              Activo
            </label>
            <label style={{ display:"flex", gap:"8px", alignItems:"center",
              fontSize:"13px", color:"var(--text-2)", cursor:"pointer" }}>
              <input type="checkbox" checked={form.is_featured}
                onChange={e => setForm(p => ({ ...p, is_featured:e.target.checked }))} />
              Destacado
            </label>
          </div>
        </div>

        <div style={{ display:"flex", gap:"10px", justifyContent:"flex-end",
          marginTop:"24px" }}>
          <button onClick={onClose} style={{
            padding:"10px 22px", fontSize:"13px",
            background:"transparent", border:"1px solid var(--border)",
            color:"var(--text-2)", borderRadius:"var(--r-full)", cursor:"pointer",
          }}>Cancelar</button>
          <button onClick={() => save.mutate()}
            disabled={!form.name || save.isPending}
            data-testid="btn-save-service"
            className="btn btn-accent"
            style={{ padding:"10px 22px", fontSize:"13px",
              opacity: (!form.name || save.isPending) ? 0.5 : 1 }}>
            {save.isPending ? "Guardando…" : (isEdit ? "Guardar cambios" : "Crear servicio")}
          </button>
        </div>
      </div>
    </div>
  )
}