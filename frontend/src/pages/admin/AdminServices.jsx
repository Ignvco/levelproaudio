// pages/admin/AdminServices.jsx

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getAdminServices, updateBookingStatus, updateRequestStatus } from "../../api/admin.api"
import api from "../../api/client"

const bookingStatusLabels = {
  pending: "Pendiente", confirmed: "Confirmado",
  completed: "Completado", cancelled: "Cancelado",
}
const requestStatusLabels = {
  pending: "Pendiente", contacted: "Contactado",
  accepted: "Aceptado", rejected: "Rechazado",
}
const statusColors = {
  pending: "#facc15", confirmed: "#4ade80", completed: "#60a5fa",
  cancelled: "#f87171", contacted: "#60a5fa", accepted: "#4ade80", rejected: "#f87171",
}

function Badge({ status, labels }) {
  const color = statusColors[status] || "var(--text-3)"
  return (
    <span style={{
      padding: "2px 8px", borderRadius: "100px", fontSize: "11px",
      fontWeight: 500, color, background: `${color}14`,
      border: `1px solid ${color}30`, whiteSpace: "nowrap",
    }}>
      {labels[status] || status}
    </span>
  )
}

function InlineSelect({ id, current, options, labels, onUpdate }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (s) => onUpdate(id, s),
    onSuccess:  () => queryClient.invalidateQueries(["admin-services"]),
  })
  return (
    <select value={current} onChange={e => mutation.mutate(e.target.value)}
      disabled={mutation.isPending}
      onClick={e => e.stopPropagation()}
      style={{
        padding: "5px 10px", borderRadius: "var(--r-sm)", fontSize: "12px",
        background: "var(--surface-2)", border: "1px solid var(--border)",
        color: "var(--text)", cursor: "pointer", outline: "none",
        opacity: mutation.isPending ? 0.5 : 1,
      }}>
      {options.map(s => <option key={s} value={s}>{labels[s]}</option>)}
    </select>
  )
}

// ── Modal servicio ───────────────────────────────────────────
function ServiceModal({ service, onClose, onSave }) {
  const [form, setForm] = useState({
    name:              service?.name              || "",
    short_description: service?.short_description || "",
    description:       service?.description       || "",
    price_type:        service?.price_type        || "quote",
    price:             service?.price             || "",
    is_active:         service?.is_active         ?? true,
    is_featured:       service?.is_featured       ?? false,
    order:             service?.order             || 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")

  const handleSave = async () => {
    if (!form.name.trim()) { setError("El nombre es requerido."); return }
    setSaving(true)
    setError("")
    try {
      if (service?.id) {
        await api.patch(`/admin/services/${service.id}/`, form)
      } else {
        await api.post("/admin/services/list/", form)
      }
      onSave()
      onClose()
    } catch (e) {
      setError(e.response?.data?.detail || "Error al guardar.")
    } finally {
      setSaving(false)
    }
  }

  const inputSt = {
    width: "100%", padding: "10px 14px",
    background: "var(--surface-2)", border: "1px solid var(--border)",
    borderRadius: "var(--r-md)", color: "var(--text)", fontSize: "13px", outline: "none",
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(8px)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)", width: "100%", maxWidth: "540px",
        maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>
          <p style={{ fontSize: "15px", fontWeight: 500 }}>
            {service?.id ? "Editar servicio" : "Nuevo servicio"}
          </p>
          <button onClick={onClose} style={{ background: "none", border: "none",
            cursor: "pointer", color: "var(--text-3)", fontSize: "20px" }}>×</button>
        </div>
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {error && (
            <p style={{ fontSize: "12px", color: "var(--danger)", padding: "8px 12px",
              background: "rgba(255,59,59,0.08)", borderRadius: "var(--r-sm)",
              border: "1px solid rgba(255,59,59,0.2)" }}>
              {error}
            </p>
          )}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "6px" }}>
              Nombre *
            </label>
            <input value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              style={inputSt} placeholder="Ej: Mezcla profesional" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "6px" }}>
              Descripción corta
            </label>
            <input value={form.short_description}
              onChange={e => setForm(p => ({ ...p, short_description: e.target.value }))}
              style={inputSt} placeholder="Breve descripción para listados" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "6px" }}>
              Descripción completa
            </label>
            <textarea value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={4} style={{ ...inputSt, resize: "vertical" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                color: "var(--text-2)", marginBottom: "6px" }}>
                Tipo de precio
              </label>
              <select value={form.price_type}
                onChange={e => setForm(p => ({ ...p, price_type: e.target.value }))}
                style={inputSt}>
                <option value="quote">A cotizar</option>
                <option value="fixed">Precio fijo</option>
                <option value="hourly">Por hora</option>
                <option value="project">Por proyecto</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                color: "var(--text-2)", marginBottom: "6px" }}>
                Precio (CLP)
              </label>
              <input type="number" value={form.price}
                onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                style={inputSt} placeholder="Opcional" min="0"
                disabled={form.price_type === "quote"} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                color: "var(--text-2)", marginBottom: "6px" }}>Estado</label>
              <select value={form.is_active ? "1" : "0"}
                onChange={e => setForm(p => ({ ...p, is_active: e.target.value === "1" }))}
                style={inputSt}>
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                color: "var(--text-2)", marginBottom: "6px" }}>Destacado</label>
              <select value={form.is_featured ? "1" : "0"}
                onChange={e => setForm(p => ({ ...p, is_featured: e.target.value === "1" }))}
                style={inputSt}>
                <option value="0">No</option>
                <option value="1">Sí</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                color: "var(--text-2)", marginBottom: "6px" }}>Orden</label>
              <input type="number" value={form.order}
                onChange={e => setForm(p => ({ ...p, order: parseInt(e.target.value) || 0 }))}
                style={inputSt} min="0" />
            </div>
          </div>
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)",
          display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onClose} className="btn btn-ghost"
            style={{ padding: "9px 18px", fontSize: "13px" }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="btn btn-accent"
            style={{ padding: "9px 18px", fontSize: "13px", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminServices() {
  const [tab, setTab]               = useState("services") // ← empieza en servicios
  const [expandedReq, setExpandedReq]   = useState(null)
  const [expandedBook, setExpandedBook] = useState(null)
  const [adminNote, setAdminNote]   = useState("")
  const [modal, setModal]           = useState(null)
  const queryClient                 = useQueryClient()

  // ── Solicitudes y reservas ───────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["admin-services"],
    queryFn:  getAdminServices,
  })

  // ── Lista de servicios ───────────────────────────────────
  const { data: servicesData, isLoading: loadingServices } = useQuery({
    queryKey: ["admin-services-list"],
    queryFn:  () => api.get("/admin/services/list/").then(r => r.data),
  })

  const saveNoteMutation = useMutation({
    mutationFn: ({ id, status, note }) =>
      updateRequestStatus(id, { status, admin_notes: note }),
    onSuccess: () => queryClient.invalidateQueries(["admin-services"]),
  })

  const deleteServiceMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/services/${id}/`),
    onSuccess:  () => queryClient.invalidateQueries(["admin-services-list"]),
  })

  const bookings = data?.bookings || []
  const requests = data?.requests || []
  const services = servicesData?.results || []

  const tabs = [
    { key: "services",  label: `Servicios (${services.length})` },
    { key: "requests",  label: `Solicitudes (${requests.length})` },
    { key: "bookings",  label: `Reservas (${bookings.length})` },
  ]

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>

      {modal && (
        <ServiceModal
          service={modal}
          onClose={() => setModal(null)}
          onSave={() => queryClient.invalidateQueries(["admin-services-list"])}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px" }}>
            Servicios
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            {services.length} servicios · {requests.length} solicitudes · {bookings.length} reservas
          </p>
        </div>
        {tab === "services" && (
          <button onClick={() => setModal({})} className="btn btn-accent"
            style={{ padding: "10px 20px", fontSize: "13px" }}>
            + Nuevo servicio
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: "7px 16px", borderRadius: "100px", fontSize: "13px",
            cursor: "pointer", transition: "all var(--dur) var(--ease)",
            background: tab === key ? "var(--text)" : "transparent",
            color: tab === key ? "var(--bg)" : "var(--text-2)",
            border: `1px solid ${tab === key ? "var(--text)" : "var(--border)"}`,
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB SERVICIOS ── */}
      {tab === "services" && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto 2fr 1fr 1fr 1fr 80px",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span style={{ width: "40px" }}></span>
            <span>Nombre</span>
            <span>Categoría</span>
            <span>Precio</span>
            <span>Estado</span>
            <span>Acciones</span>
          </div>

          {loadingServices ? (
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: "52px" }} />
              ))}
            </div>
          ) : services.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px" }}>
              <p style={{ fontSize: "32px", marginBottom: "12px" }}>🎚️</p>
              No hay servicios todavía. Crea el primero.
            </div>
          ) : services.map((s, i) => (
            <div key={s.id} style={{
              display: "grid", gridTemplateColumns: "auto 2fr 1fr 1fr 1fr 80px",
              padding: "13px 20px", alignItems: "center",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              transition: "background var(--dur) var(--ease)",
              gap: "12px",
            }} className="hover:bg-[var(--surface-2)]">
              <div style={{ width: "40px", height: "40px", borderRadius: "var(--r-sm)",
                background: "var(--surface-2)", overflow: "hidden",
                border: "1px solid var(--border)", flexShrink: 0 }}>
                {s.thumbnail ? (
                  <img src={s.thumbnail} alt={s.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex",
                    alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                    🎚️
                  </div>
                )}
              </div>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 400 }}>{s.name}</p>
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {s.category_name}
              </span>
              <span style={{ fontSize: "13px" }}>{s.price_display}</span>
              <span style={{
                fontSize: "11px", padding: "2px 8px", borderRadius: "100px",
                fontWeight: 500, display: "inline-block",
                color:      s.is_active ? "#4ade80" : "var(--text-3)",
                background: s.is_active ? "rgba(74,222,128,0.1)" : "var(--surface-3)",
                border:     `1px solid ${s.is_active ? "rgba(74,222,128,0.25)" : "var(--border)"}`,
              }}>
                {s.is_active ? "Activo" : "Inactivo"}
              </span>
              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={() => setModal(s)}
                  style={{ padding: "5px 10px", borderRadius: "100px", fontSize: "11px",
                    cursor: "pointer", color: "#60a5fa",
                    background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)" }}>
                  ✎
                </button>
                <button onClick={() => {
                  if (window.confirm(`¿Eliminar "${s.name}"?`)) {
                    deleteServiceMutation.mutate(s.id)
                  }
                }} style={{ padding: "5px 10px", borderRadius: "100px", fontSize: "11px",
                  cursor: "pointer", color: "#f87171",
                  background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)" }}>
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB SOLICITUDES ── */}
      {tab === "requests" && (
        isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "64px" }} />
            ))}
          </div>
        ) : (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)", overflow: "hidden" }}>
            <div style={{ display: "grid",
              gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr 1fr auto",
              padding: "10px 20px", borderBottom: "1px solid var(--border)",
              fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
              textTransform: "uppercase", letterSpacing: "0.08em", gap: "12px" }}>
              <span>Cliente</span>
              <span>Servicio</span>
              <span>Presupuesto</span>
              <span>Fecha pref.</span>
              <span>Estado</span>
              <span>Cambiar</span>
            </div>

            {requests.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center",
                color: "var(--text-3)", fontSize: "14px" }}>
                No hay solicitudes todavía.
              </div>
            ) : requests.map((r, i) => (
              <div key={r.id}>
                <div
                  onClick={() => { setExpandedReq(expandedReq === r.id ? null : r.id); setAdminNote("") }}
                  style={{
                    display: "grid", gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr 1fr auto",
                    padding: "14px 20px", alignItems: "center",
                    borderTop: i > 0 ? "1px solid var(--border)" : "none",
                    cursor: "pointer", gap: "12px",
                    transition: "background var(--dur) var(--ease)",
                    background: expandedReq === r.id ? "var(--surface-2)" : "transparent",
                  }} className="hover:bg-[var(--surface-2)]">
                  <div>
                    <p style={{ fontSize: "13px" }}>{r.name}</p>
                    <p style={{ fontSize: "11px", color: "var(--text-3)" }}>{r.email}</p>
                  </div>
                  <span style={{ fontSize: "13px", color: "var(--text-2)" }}>{r.service_name}</span>
                  <span style={{ fontSize: "13px" }}>
                    {r.budget ? `$${Number(r.budget).toLocaleString("es-CL")}` : "—"}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                    {r.preferred_date || "—"}
                  </span>
                  <Badge status={r.status} labels={requestStatusLabels} />
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}
                    onClick={e => e.stopPropagation()}>
                    <InlineSelect id={r.id} current={r.status}
                      options={Object.keys(requestStatusLabels)}
                      labels={requestStatusLabels}
                      onUpdate={(id, s) => updateRequestStatus(id, { status: s })} />
                    <span style={{ color: "var(--text-3)", fontSize: "14px",
                      transition: "transform var(--dur)",
                      transform: expandedReq === r.id ? "rotate(90deg)" : "none" }}>›</span>
                  </div>
                </div>

                {expandedReq === r.id && (
                  <div style={{ padding: "20px 24px", background: "var(--surface-2)",
                    borderTop: "1px solid var(--border)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
                      gap: "20px", marginBottom: "16px" }}>
                      <div>
                        <p style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "8px",
                          textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>
                          Mensaje del cliente
                        </p>
                        <div style={{ padding: "14px 16px", borderRadius: "var(--r-md)",
                          background: "var(--surface)", border: "1px solid var(--border)",
                          fontSize: "13px", color: "var(--text-2)", lineHeight: 1.7 }}>
                          {r.message}
                        </div>
                      </div>
                      <div>
                        <p style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "8px",
                          textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>
                          Nota interna
                        </p>
                        <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)}
                          placeholder="Notas internas — no visibles para el cliente..."
                          rows={4} className="input"
                          style={{ resize: "vertical", fontSize: "13px", width: "100%" }} />
                        <button
                          onClick={() => saveNoteMutation.mutate({ id: r.id, status: r.status, note: adminNote })}
                          disabled={!adminNote || saveNoteMutation.isPending}
                          className="btn btn-ghost"
                          style={{ marginTop: "8px", padding: "7px 16px", fontSize: "12px",
                            opacity: !adminNote ? 0.5 : 1 }}>
                          {saveNoteMutation.isPending ? "Guardando..." : "Guardar nota"}
                        </button>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap",
                      paddingTop: "14px", borderTop: "1px solid var(--border)" }}>
                      <a href={`mailto:${r.email}?subject=Tu solicitud en LevelPro Audio`}
                        className="btn btn-ghost" style={{ padding: "7px 14px", fontSize: "12px" }}>
                        ✉ Email
                      </a>
                      <a href={`https://wa.me/5492622635045`}
                        target="_blank" rel="noreferrer"
                        className="btn btn-ghost" style={{ padding: "7px 14px", fontSize: "12px" }}>
                        💬 WhatsApp
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* ── TAB RESERVAS ── */}
      {tab === "bookings" && (
        isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "64px" }} />
            ))}
          </div>
        ) : (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 1fr auto",
              padding: "10px 20px", borderBottom: "1px solid var(--border)",
              fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
              textTransform: "uppercase", letterSpacing: "0.08em", gap: "12px" }}>
              <span>Cliente</span>
              <span>Servicio</span>
              <span>Fecha</span>
              <span>Estado</span>
              <span>Cambiar</span>
            </div>

            {bookings.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center",
                color: "var(--text-3)", fontSize: "14px" }}>
                No hay reservas todavía.
              </div>
            ) : bookings.map((b, i) => (
              <div key={b.id}>
                <div
                  onClick={() => setExpandedBook(expandedBook === b.id ? null : b.id)}
                  style={{
                    display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 1fr auto",
                    padding: "14px 20px", alignItems: "center",
                    borderTop: i > 0 ? "1px solid var(--border)" : "none",
                    cursor: "pointer", gap: "12px",
                    transition: "background var(--dur) var(--ease)",
                    background: expandedBook === b.id ? "var(--surface-2)" : "transparent",
                  }} className="hover:bg-[var(--surface-2)]">
                  <span style={{ fontSize: "13px", overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {b.user_email}
                  </span>
                  <span style={{ fontSize: "13px", color: "var(--text-2)" }}>{b.service_name}</span>
                  <span style={{ fontSize: "12px", color: "var(--text-3)" }}>{b.scheduled_date}</span>
                  <Badge status={b.status} labels={bookingStatusLabels} />
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}
                    onClick={e => e.stopPropagation()}>
                    <InlineSelect id={b.id} current={b.status}
                      options={Object.keys(bookingStatusLabels)}
                      labels={bookingStatusLabels}
                      onUpdate={(id, s) => updateBookingStatus(id, s)} />
                    <span style={{ color: "var(--text-3)", fontSize: "14px",
                      transition: "transform var(--dur)",
                      transform: expandedBook === b.id ? "rotate(90deg)" : "none" }}>›</span>
                  </div>
                </div>

                {expandedBook === b.id && (
                  <div style={{ padding: "20px 24px", background: "var(--surface-2)",
                    borderTop: "1px solid var(--border)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
                      gap: "16px", marginBottom: "16px" }}>
                      {[
                        { label: "Cliente",  value: b.user_email },
                        { label: "Servicio", value: b.service_name },
                        { label: "Fecha",    value: b.scheduled_date },
                        { label: "Estado",   value: bookingStatusLabels[b.status] || b.status },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "4px",
                            textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>
                            {label}
                          </p>
                          <p style={{ fontSize: "13px", color: "var(--text-2)" }}>{value}</p>
                        </div>
                      ))}
                    </div>
                    {b.notes && (
                      <div style={{ padding: "12px 14px", borderRadius: "var(--r-md)",
                        background: "var(--surface)", border: "1px solid var(--border)",
                        fontSize: "13px", color: "var(--text-2)", lineHeight: 1.6,
                        marginBottom: "14px" }}>
                        {b.notes}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "6px", paddingTop: "14px",
                      borderTop: "1px solid var(--border)" }}>
                      <a href={`mailto:${b.user_email}`} className="btn btn-ghost"
                        style={{ padding: "7px 14px", fontSize: "12px" }}>
                        ✉ Contactar
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}