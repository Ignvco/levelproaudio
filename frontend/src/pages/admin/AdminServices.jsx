// pages/admin/AdminServices.jsx
import { useId, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getAdminServiceRequests,
  updateRequestStatus, updateBookingStatus, getAdminBookings,
  listAdminServicesCrud, createAdminService,
  updateAdminService, deleteAdminService,
} from "../../api/admin.api"
import { getServiceCategories } from "../../api/services.api"
import { mediaUrl } from "../../utils/mediaUrl"
import { showToast } from "../../utils/toast"
import { AdminPageHeader, PrimaryButton, SecondaryButton, StatCard, FormModal, FormField, formInputStyle, ConfirmationModal, ErrorState } from "../../components/admin/ui"
import { Wrench, Inbox, CalendarCheck } from "lucide-react"

const inputSt = formInputStyle

const REQ_STATUS = {
  pending:   { label: "Pendiente",   color: "#D97706" },
  contacted: { label: "Contactado",  color: "#60a5fa" },
  accepted:  { label: "Aceptado",    color: "#0F9940" },
  rejected:  { label: "Rechazado",   color: "#EF4444" },
}

const BOOKING_STATUS = {
  pending:   { label: "Pendiente",   color: "#D97706" },
  confirmed: { label: "Confirmada",  color: "#60a5fa" },
  completed: { label: "Completada",  color: "#0F9940" },
  cancelled: { label: "Cancelada",   color: "#EF4444" },
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

function RequestCard({ req, reqMutation }) {
  const responseId = useId()
  const [note, setNote] = useState(req.admin_notes || "")
  const dirty = note !== (req.admin_notes || "")

  return (
    <div className="au-card au-panel">
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", flexWrap: "wrap", gap: "12px",
        marginBottom: "14px" }}>
        <div>
          <p style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--admin-text)", marginBottom: "4px" }}>
            {req.service_name}
          </p>
          <p style={{ fontSize: "12.5px", color: "var(--admin-text-secondary)" }}>
            {req.name} · {req.email}
            {req.phone && ` · ${req.phone}`}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <StatusBadge status={req.status} map={REQ_STATUS} />
          <span style={{ fontSize: "12px", color: "var(--admin-text-muted)", fontFamily: "var(--font-mono)" }}>
            {new Date(req.created_at).toLocaleDateString("es-CL", {
              day: "numeric", month: "short", year: "numeric"
            })}
          </span>
        </div>
      </div>

      {req.message && (
        <p style={{ fontSize: "13px", color: "var(--admin-text-secondary)", lineHeight: 1.6,
          padding: "12px 14px", background: "var(--admin-surface-soft)",
          borderRadius: "12px", marginBottom: "14px",
          border: "1px solid var(--admin-border)" }}>
          &quot;{req.message}&quot;
        </p>
      )}

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
        {Object.entries(REQ_STATUS).map(([s, { label, color }]) => (
          s !== req.status && (
            <button key={s}
              type="button"
              onClick={() => reqMutation.mutate({ id: req.id, data: { status: s } })}
              disabled={reqMutation.isPending}
              style={{
                padding: "5px 12px", borderRadius: "9999px",
                fontSize: "12px", cursor: "pointer", fontWeight: 600,
                color, background: `${color}12`, border: `1px solid ${color}30`,
                transition: "all 180ms ease",
                opacity: reqMutation.isPending ? 0.5 : 1,
              }}>
              → {label}
            </button>
          )
        ))}
      </div>

      {/* Respuesta visible para el cliente */}
      <div>
        <label htmlFor={responseId} style={{ display: "block", fontSize: "11px", fontWeight: 700,
          color: "var(--admin-text-muted)", letterSpacing: "0.06em", textTransform: "uppercase",
          marginBottom: "6px" }}>
          Respuesta (el cliente la ve en &quot;Mis servicios&quot;)
        </label>
        <textarea id={responseId} value={note} onChange={e => setNote(e.target.value)} rows={2}
          placeholder="Ej: Te contactamos por email con la cotización..."
          style={{ ...inputSt, resize: "vertical", fontSize: "13px" }} />
        {dirty && (
          <div style={{ marginTop: "10px" }}>
            <PrimaryButton
              size="sm"
              onClick={() => reqMutation.mutate({ id: req.id, data: { status: req.status, admin_notes: note } })}
              disabled={reqMutation.isPending}
              loading={reqMutation.isPending}
            >
              {reqMutation.isPending ? "Guardando..." : "Guardar respuesta"}
            </PrimaryButton>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminServices() {
  const [tab, setTab]         = useState(0)
  const [modal, setModal]     = useState(null)  // null | "new" | {service}
  const [toDelete, setToDelete] = useState(null)
  const queryClient           = useQueryClient()
  const TABS                  = ["Solicitudes", "Servicios", "Reservas"]

  const { data: servicesData, isLoading: loadingServices, isError: servicesError, refetch: retryServices } = useQuery({
    queryKey: ["admin-services-crud"], queryFn: listAdminServicesCrud,
  })
  const { data: requestsData, isLoading: loadingReqs, isError: requestsError, refetch: retryRequests } = useQuery({
    queryKey: ["admin-requests"], queryFn: getAdminServiceRequests,
  })
  const { data: bookingsData, isLoading: loadingBookings, isError: bookingsError, refetch: retryBookings } = useQuery({
    queryKey: ["admin-bookings"], queryFn: getAdminBookings, enabled: tab === 2,
  })

  const reqMutation = useMutation({
    mutationFn: ({ id, data }) => updateRequestStatus(id, data),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["admin-requests"] }),
    onError:    (err) => showToast(err?.response?.data?.error || "No se pudo actualizar la solicitud.", "error"),
  })

  const bookingMutation = useMutation({
    mutationFn: ({ id, status }) => updateBookingStatus(id, status),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["admin-bookings"] }),
    onError:    (err) => showToast(err?.response?.data?.error || "No se pudo actualizar la reserva.", "error"),
  })

  const delMutation = useMutation({
    mutationFn: deleteAdminService,
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey:["admin-services-crud"] })
      showToast("Servicio eliminado")
      setToDelete(null)
    },
    onError:    (err) => {
      showToast(err?.response?.data?.detail || "No se pudo eliminar el servicio.", "error")
      setToDelete(null)
    },
  })

  const servicesRaw = servicesData?.results ?? servicesData
  const requestsRaw = requestsData?.results ?? requestsData
  const bookingsRaw = bookingsData?.results ?? bookingsData
  const services = Array.isArray(servicesRaw) ? servicesRaw : []
  const requests = Array.isArray(requestsRaw) ? requestsRaw : []
  const bookings = Array.isArray(bookingsRaw) ? bookingsRaw : []
  const servicesReliable = !servicesError && Array.isArray(servicesRaw)
  const requestsReliable = !requestsError && Array.isArray(requestsRaw)
  const bookingsReliable = !bookingsError && Array.isArray(bookingsRaw)
  const pendingReqs = requestsReliable ? requests.filter(r => r.status === "pending").length : 0
  const activeServices = servicesReliable ? services.filter(s => s.is_active !== false).length : 0

  return (
    <div className="au-page">
      {/* Header */}
      <AdminPageHeader
        eyebrow="LEVELPRO / SERVICIOS"
        title="Servicios"
        description="Gestión de solicitudes, catálogo y reservas de servicios"
        actions={
          <PrimaryButton onClick={() => setModal("new")} disabled={!servicesReliable} data-testid="btn-new-service">
            + Nuevo servicio
          </PrimaryButton>
        }
      />

      {/* KPI Strip */}
      <div className="lp-kpi-strip">
        <StatCard
          variant="ink"
          Icon={Inbox}
          label="Solicitudes recibidas"
          value={requestsReliable ? requests.length : "—"}
          sub={!requestsReliable ? "Por cargar" : pendingReqs > 0 ? `${pendingReqs} pendientes de respuesta` : "Sin solicitudes pendientes"}
        />
        <StatCard
          variant="primary"
          Icon={Wrench}
          label="Servicios activos"
          value={servicesReliable ? activeServices : "—"}
          sub={servicesReliable ? `${services.length} visibles en esta vista` : "Por cargar"}
        />
        <StatCard
          variant="light"
          Icon={CalendarCheck}
          label="Reservas agendadas"
          value={bookingsReliable ? bookings.length : "—"}
          sub={bookingsReliable ? "Reservas visibles" : "Abrir la pestaña Reservas"}
        />
      </div>

      {/* Tabs */}
      <div className="lp-seg-tabs">
        {TABS.map((t, i) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(i)}
            className={`lp-seg-tab${tab === i ? " is-active" : ""}`}
          >
            {t}
            {i === 0 && pendingReqs > 0 && (
              <span style={{
                marginLeft: "6px", padding: "1px 6px",
                borderRadius: "9999px", fontSize: "10px",
                background: "#D97706", color: "#fff", fontWeight: 700,
              }}>
                {pendingReqs}
              </span>
            )}
            {i === 2 && bookings.filter(b => b.status === "pending").length > 0 && (
              <span style={{
                marginLeft: "6px", padding: "1px 6px",
                borderRadius: "9999px", fontSize: "10px",
                background: "#D97706", color: "#fff", fontWeight: 700,
              }}>
                {bookings.filter(b => b.status === "pending").length}
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
              <div key={i} className="skeleton" style={{ height: "72px", borderRadius: "16px" }} />
            ))}
          </div>
        ) : requestsError || !requestsReliable ? (
          <ErrorState title="No se pudieron cargar las solicitudes"
            action={<SecondaryButton onClick={() => retryRequests()}>Reintentar</SecondaryButton>} />
        ) : requests.length === 0 ? (
          <div className="au-card au-panel" style={{ textAlign: "center", padding: "56px", color: "var(--admin-text-secondary)" }}>
            <p style={{ fontSize: "36px", marginBottom: "10px" }}>🔧</p>
            <p style={{ fontSize: "14px", fontWeight: 600 }}>Sin solicitudes pendientes</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {requests.map(req => (
              <RequestCard key={req.id} req={req} reqMutation={reqMutation} />
            ))}
          </div>
        )
      )}

      {/* TAB SERVICIOS */}
      {tab === 1 && (
        <>
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"center", gap: "12px", flexWrap: "wrap" }}>
            <p style={{ fontSize:"13px", color:"var(--admin-text-secondary)", fontWeight: 600 }}>
              {servicesReliable ? `${services.length} servicios visibles` : "Servicios no disponibles"}
            </p>
            <PrimaryButton onClick={() => setModal("new")} disabled={!servicesReliable} size="sm">
              + Nuevo servicio
            </PrimaryButton>
          </div>

          {loadingServices ? (
            <div style={{ display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "14px" }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: "160px", borderRadius: "20px" }} />
              ))}
            </div>
          ) : servicesError || !servicesReliable ? (
            <ErrorState title="No se pudo cargar el catálogo de servicios"
              action={<SecondaryButton onClick={() => retryServices()}>Reintentar</SecondaryButton>} />
          ) : (
            <div style={{ display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
              {services.map(s => (
                <div key={s.id} className="au-acard">
                  <div className="au-acard__strip" />
                  <div className="au-acard__head">
                    <span className="au-acard__tag">{s.category_name || "Servicio"}</span>
                    <span style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, fontWeight: 700, color: s.is_active ? "#0B8A3E" : "#8c8c8c" }}>
                      <span className="au-acard__dot" style={{ background: s.is_active ? "#1AFF6E" : "#6b6b6b" }} />
                      {s.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <p className="au-acard__title">{s.name}</p>
                  {s.short_description && <p className="au-acard__sub">{s.short_description}</p>}
                  <div className="au-acard__foot">
                    <span className="au-acard__price">{s.price_display}</span>
                    <div className="au-acard__actions">
                      <button onClick={() => setModal(s)} data-testid={`btn-edit-service-${s.id}`}
                        className="au-pill-btn au-pill-btn--edit" style={{ padding:"8px 14px" }}>Editar</button>
                      <button data-testid={`btn-delete-service-${s.id}`}
                        onClick={() => setToDelete(s)}
                        className="au-pill-btn au-pill-btn--del" style={{ padding:"8px 14px" }}>Eliminar</button>
                    </div>
                  </div>
                </div>
              ))}
              {services.length === 0 && (
                <div className="au-card au-panel" style={{ gridColumn:"1/-1", padding:"48px 24px",
                  textAlign:"center", color:"var(--admin-text-secondary)" }}>
                  <p style={{ fontSize:"14px", marginBottom:"12px" }}>
                    No hay servicios creados aún.
                  </p>
                  <PrimaryButton onClick={() => setModal("new")}>
                    Crear el primer servicio
                  </PrimaryButton>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* TAB RESERVAS */}
      {tab === 2 && (
        loadingBookings ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "72px", borderRadius: "16px" }} />
            ))}
          </div>
        ) : bookingsError || !bookingsReliable ? (
          <ErrorState title="No se pudieron cargar las reservas"
            action={<SecondaryButton onClick={() => retryBookings()}>Reintentar</SecondaryButton>} />
        ) : bookings.length === 0 ? (
          <div className="au-card au-panel" style={{ textAlign: "center", padding: "56px", color: "var(--admin-text-secondary)" }}>
            <p style={{ fontSize: "36px", marginBottom: "10px" }}>📅</p>
            <p style={{ fontSize: "14px", fontWeight: 600 }}>Sin reservas todavía</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {bookings.map(b => (
              <div key={b.id} className="au-card au-panel" style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", flexWrap: "wrap", gap: "14px",
              }}>
                <div>
                  <p style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--admin-text)", marginBottom: "4px" }}>
                    {b.service_name}
                  </p>
                  <p style={{ fontSize: "12.5px", color: "var(--admin-text-secondary)" }}>
                    {b.user_email} · {new Date(b.scheduled_date).toLocaleString("es-CL", {
                      day: "numeric", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                  {b.notes && (
                    <p style={{ fontSize: "12.5px", color: "var(--admin-text-muted)", marginTop: "6px" }}>
                      &quot;{b.notes}&quot;
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{
                    padding: "4px 12px", borderRadius: "9999px",
                    fontSize: "12px", fontWeight: 600,
                    color: BOOKING_STATUS[b.status]?.color || "#888",
                    background: `${BOOKING_STATUS[b.status]?.color || "#888"}14`,
                    border: `1px solid ${BOOKING_STATUS[b.status]?.color || "#888"}30`,
                  }}>
                    {BOOKING_STATUS[b.status]?.label || b.status}
                  </span>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {Object.entries(BOOKING_STATUS).map(([s, { label, color }]) => (
                      s !== b.status && (
                        <button key={s}
                          type="button"
                          onClick={() => bookingMutation.mutate({ id: b.id, status: s })}
                          disabled={bookingMutation.isPending}
                          style={{
                            padding: "5px 12px", borderRadius: "9999px",
                            fontSize: "12px", cursor: "pointer", fontWeight: 600,
                            color, background: `${color}12`, border: `1px solid ${color}30`,
                            opacity: bookingMutation.isPending ? 0.5 : 1,
                          }}>
                          → {label}
                        </button>
                      )
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Modal Nuevo/Editar */}
      {modal && (
        <ServiceModal
          service={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey:["admin-services-crud"] })} />
      )}

      <ConfirmationModal
        open={!!toDelete}
        title="¿Eliminar servicio?"
        description={toDelete ? `Se eliminará "${toDelete.name}" permanentemente.` : ""}
        danger
        loading={delMutation.isPending}
        onConfirm={() => delMutation.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
        testId="delete-service-modal"
      />
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

  const { data: catData, isLoading: loadingCategories, isError: categoriesError, refetch: retryCategories } = useQuery({
    queryKey: ["service-categories"],
    queryFn:  getServiceCategories,
  })
  const categoriesRaw = catData?.results ?? catData
  const categories = Array.isArray(categoriesRaw) ? categoriesRaw : []

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      showToast("La imagen supera 8MB. Usa una más liviana.", "error")
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
    <FormModal
      open
      title={isEdit ? "Editar servicio" : "Nuevo servicio"}
      onClose={onClose}
      onSave={() => save.mutate()}
      saving={save.isPending}
      saveDisabled={loadingCategories || categoriesError || !Array.isArray(categoriesRaw)}
      saveLabel={isEdit ? "Guardar cambios" : "Crear servicio"}
      maxWidth="520px"
      scrollableBody
      testId="service-modal"
    >
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
          {categoriesError && <ErrorState title="No se pudieron cargar las categorías"
            action={<SecondaryButton onClick={() => retryCategories()}>Reintentar</SecondaryButton>} />}
          <div>
            <label style={{ fontSize:"11px", fontWeight:600, color:"var(--text-3)",
              letterSpacing:"0.08em", textTransform:"uppercase" }}>Categoría</label>
            <select value={form.category}
              disabled={loadingCategories || categoriesError}
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
                <option value="project">Por proyecto</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:"11px", fontWeight:600, color:"var(--text-3)",
                letterSpacing:"0.08em", textTransform:"uppercase" }}>Precio</label>
              <input type="number" min="0" value={form.price || ""}
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
    </FormModal>
  )
}