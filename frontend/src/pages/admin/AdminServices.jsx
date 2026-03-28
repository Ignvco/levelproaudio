// pages/admin/AdminServices.jsx

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getAdminServices, updateBookingStatus, updateRequestStatus } from "../../api/admin.api"

const bookingStatusLabels  = {
  pending:   "Pendiente",
  confirmed: "Confirmado",
  completed: "Completado",
  cancelled: "Cancelado",
}
const requestStatusLabels  = {
  pending:   "Pendiente",
  contacted: "Contactado",
  accepted:  "Aceptado",
  rejected:  "Rechazado",
}
const statusColors = {
  pending:   "#facc15",
  confirmed: "#4ade80",
  completed: "#60a5fa",
  cancelled: "#f87171",
  contacted: "#60a5fa",
  accepted:  "#4ade80",
  rejected:  "#f87171",
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
  const mutation    = useMutation({
    mutationFn: (s) => onUpdate(id, s),
    onSuccess:  () => queryClient.invalidateQueries(["admin-services"]),
  })

  return (
    <select
      value={current}
      onChange={e => mutation.mutate(e.target.value)}
      disabled={mutation.isPending}
      onClick={e => e.stopPropagation()}
      style={{
        padding: "5px 10px", borderRadius: "var(--r-sm)", fontSize: "12px",
        background: "var(--surface-2)", border: "1px solid var(--border)",
        color: "var(--text)", cursor: "pointer", outline: "none",
        opacity: mutation.isPending ? 0.5 : 1,
      }}
    >
      {options.map(s => (
        <option key={s} value={s}>{labels[s]}</option>
      ))}
    </select>
  )
}

export default function AdminServices() {
  const [tab, setTab]           = useState("requests")
  const [expandedReq, setExpandedReq] = useState(null)
  const [expandedBook, setExpandedBook] = useState(null)
  const [adminNote, setAdminNote]     = useState("")
  const queryClient             = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin-services"],
    queryFn:  getAdminServices,
  })

  const saveNoteMutation = useMutation({
    mutationFn: ({ id, status, note }) =>
      updateRequestStatus(id, { status, admin_notes: note }),
    onSuccess: () => queryClient.invalidateQueries(["admin-services"]),
  })

  const bookings = data?.bookings || []
  const requests = data?.requests || []

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>

      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{
          fontFamily: "var(--font-serif)",
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
          marginBottom: "6px",
        }}>
          Servicios
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
          {requests.length} solicitudes · {bookings.length} reservas
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        {[
          { key: "requests", label: `Solicitudes (${requests.length})` },
          { key: "bookings", label: `Reservas (${bookings.length})` },
        ].map(({ key, label }) => (
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

      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "64px" }} />
          ))}
        </div>
      )}

      {/* ── Solicitudes ─────────────────────────────────── */}
      {!isLoading && tab === "requests" && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", overflow: "hidden",
        }}>
          {/* Header tabla */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr 1fr auto",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em",
            gap: "12px",
          }}>
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

              {/* Fila principal — clickeable */}
              <div
                onClick={() => {
                  setExpandedReq(expandedReq === r.id ? null : r.id)
                  setAdminNote("")
                }}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr 1fr auto",
                  padding: "14px 20px", alignItems: "center",
                  borderTop: i > 0 ? "1px solid var(--border)" : "none",
                  cursor: "pointer", gap: "12px",
                  transition: "background var(--dur) var(--ease)",
                  background: expandedReq === r.id
                    ? "var(--surface-2)" : "transparent",
                }}
                className="hover:bg-[var(--surface-2)]"
              >
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 400 }}>{r.name}</p>
                  <p style={{ fontSize: "11px", color: "var(--text-3)" }}>{r.email}</p>
                </div>

                <span style={{ fontSize: "13px", color: "var(--text-2)" }}>
                  {r.service_name}
                </span>

                <span style={{ fontSize: "13px" }}>
                  {r.budget
                    ? `$${Number(r.budget).toLocaleString("es-CL")}`
                    : "—"}
                </span>

                <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                  {r.preferred_date || "—"}
                </span>

                <Badge status={r.status} labels={requestStatusLabels} />

                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                  onClick={e => e.stopPropagation()}
                >
                  <InlineSelect
                    id={r.id}
                    current={r.status}
                    options={Object.keys(requestStatusLabels)}
                    labels={requestStatusLabels}
                    onUpdate={(id, s) => updateRequestStatus(id, { status: s })}
                  />
                  <span style={{
                    color: "var(--text-3)", fontSize: "14px",
                    display: "inline-block",
                    transition: "transform var(--dur) var(--ease)",
                    transform: expandedReq === r.id ? "rotate(90deg)" : "none",
                  }}>
                    ›
                  </span>
                </div>
              </div>

              {/* Panel expandido */}
              {expandedReq === r.id && (
                <div style={{
                  padding: "20px 24px",
                  background: "var(--surface-2)",
                  borderTop: "1px solid var(--border)",
                  borderBottom: i < requests.length - 1
                    ? "1px solid var(--border)" : "none",
                }}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "20px", marginBottom: "16px",
                  }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-5"
                  >
                    {/* Mensaje del cliente */}
                    <div>
                      <p style={{
                        fontSize: "11px", color: "var(--text-3)",
                        marginBottom: "8px", textTransform: "uppercase",
                        letterSpacing: "0.06em", fontWeight: 500,
                      }}>
                        Mensaje del cliente
                      </p>
                      <div style={{
                        padding: "14px 16px", borderRadius: "var(--r-md)",
                        background: "var(--surface)", border: "1px solid var(--border)",
                        fontSize: "13px", color: "var(--text-2)", lineHeight: 1.7,
                      }}>
                        {r.message}
                      </div>

                      {/* Datos adicionales */}
                      <div style={{
                        display: "flex", flexWrap: "wrap", gap: "10px",
                        marginTop: "10px",
                      }}>
                        {r.budget && (
                          <span style={{
                            fontSize: "12px", color: "var(--text-3)",
                            padding: "4px 10px", borderRadius: "100px",
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                          }}>
                            💰 ${Number(r.budget).toLocaleString("es-CL")}
                          </span>
                        )}
                        {r.preferred_date && (
                          <span style={{
                            fontSize: "12px", color: "var(--text-3)",
                            padding: "4px 10px", borderRadius: "100px",
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                          }}>
                            📅 {r.preferred_date}
                          </span>
                        )}
                        <span style={{
                          fontSize: "12px", color: "var(--text-3)",
                          padding: "4px 10px", borderRadius: "100px",
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                        }}>
                          🕒 {r.created_at}
                        </span>
                      </div>
                    </div>

                    {/* Nota interna */}
                    <div>
                      <p style={{
                        fontSize: "11px", color: "var(--text-3)",
                        marginBottom: "8px", textTransform: "uppercase",
                        letterSpacing: "0.06em", fontWeight: 500,
                      }}>
                        Nota interna (solo admin)
                      </p>
                      <textarea
                        value={adminNote}
                        onChange={e => setAdminNote(e.target.value)}
                        placeholder="Agrega notas sobre esta solicitud — no visibles para el cliente..."
                        rows={5}
                        className="input"
                        style={{ resize: "vertical", fontSize: "13px", width: "100%" }}
                      />
                      <button
                        onClick={() => saveNoteMutation.mutate({
                          id: r.id,
                          status: r.status,
                          note: adminNote,
                        })}
                        disabled={!adminNote || saveNoteMutation.isPending}
                        className="btn btn-ghost"
                        style={{
                          marginTop: "8px", padding: "7px 16px",
                          fontSize: "12px",
                          opacity: !adminNote ? 0.5 : 1,
                        }}
                      >
                        {saveNoteMutation.isPending ? "Guardando..." : "Guardar nota"}
                      </button>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div style={{
                    display: "flex", gap: "8px", flexWrap: "wrap",
                    paddingTop: "14px", borderTop: "1px solid var(--border)",
                  }}><a
                    
                      href={`mailto:${r.email}?subject=Tu solicitud en LevelPro Audio`}
                      className="btn btn-ghost"
                      style={{ padding: "7px 14px", fontSize: "12px" }}
                    >
                      ✉ Enviar email
                    </a><a
                    
                      href={`https://wa.me/${r.email.replace(/\D/g, "")}`}
                      target="_blank" rel="noreferrer"
                      className="btn btn-ghost"
                      style={{ padding: "7px 14px", fontSize: "12px" }}
                    >
                      💬 WhatsApp
                    </a>

                    {/* Cambiar estado rápido */}
                    <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
                      {Object.entries(requestStatusLabels).map(([s, label]) => (
                        s !== r.status && (
                          <button
                            key={s}
                            onClick={() => {
                              updateRequestStatus(r.id, { status: s })
                                .then(() => queryClient.invalidateQueries(["admin-services"]))
                            }}
                            style={{
                              padding: "6px 12px", borderRadius: "100px",
                              fontSize: "11px", fontWeight: 500, cursor: "pointer",
                              transition: "all var(--dur) var(--ease)",
                              color: statusColors[s] || "var(--text-2)",
                              background: `${statusColors[s] || "var(--text-3)"}14`,
                              border: `1px solid ${statusColors[s] || "var(--border)"}30`,
                            }}
                          >
                            → {label}
                          </button>
                        )
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Reservas ─────────────────────────────────────── */}
      {!isLoading && tab === "bookings" && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", overflow: "hidden",
        }}>
          {/* Header tabla */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "2fr 2fr 1.5fr 1fr auto",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em", gap: "12px",
          }}>
            <span>Cliente</span>
            <span>Servicio</span>
            <span>Fecha programada</span>
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

              {/* Fila principal */}
              <div
                onClick={() => setExpandedBook(expandedBook === b.id ? null : b.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 2fr 1.5fr 1fr auto",
                  padding: "14px 20px", alignItems: "center",
                  borderTop: i > 0 ? "1px solid var(--border)" : "none",
                  cursor: "pointer", gap: "12px",
                  transition: "background var(--dur) var(--ease)",
                  background: expandedBook === b.id
                    ? "var(--surface-2)" : "transparent",
                }}
                className="hover:bg-[var(--surface-2)]"
              >
                <span style={{ fontSize: "13px", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {b.user_email}
                </span>

                <span style={{ fontSize: "13px", color: "var(--text-2)" }}>
                  {b.service_name}
                </span>

                <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                  {b.scheduled_date}
                </span>

                <Badge status={b.status} labels={bookingStatusLabels} />

                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                  onClick={e => e.stopPropagation()}
                >
                  <InlineSelect
                    id={b.id}
                    current={b.status}
                    options={Object.keys(bookingStatusLabels)}
                    labels={bookingStatusLabels}
                    onUpdate={(id, s) => updateBookingStatus(id, s)}
                  />
                  <span style={{
                    color: "var(--text-3)", fontSize: "14px",
                    display: "inline-block",
                    transition: "transform var(--dur) var(--ease)",
                    transform: expandedBook === b.id ? "rotate(90deg)" : "none",
                  }}>
                    ›
                  </span>
                </div>
              </div>

              {/* Panel expandido */}
              {expandedBook === b.id && (
                <div style={{
                  padding: "20px 24px",
                  background: "var(--surface-2)",
                  borderTop: "1px solid var(--border)",
                }}>
                  <div style={{ display: "grid",
                    gridTemplateColumns: "1fr 1fr", gap: "16px",
                    marginBottom: "16px" }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    {[
                      { label: "Cliente",  value: b.user_email },
                      { label: "Servicio", value: b.service_name },
                      { label: "Fecha",    value: b.scheduled_date },
                      { label: "Estado",   value: bookingStatusLabels[b.status] || b.status },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p style={{ fontSize: "11px", color: "var(--text-3)",
                          marginBottom: "4px", textTransform: "uppercase",
                          letterSpacing: "0.06em", fontWeight: 500 }}>
                          {label}
                        </p>
                        <p style={{ fontSize: "13px", color: "var(--text-2)" }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {b.notes && (
                    <div style={{ marginBottom: "14px" }}>
                      <p style={{ fontSize: "11px", color: "var(--text-3)",
                        marginBottom: "6px", textTransform: "uppercase",
                        letterSpacing: "0.06em", fontWeight: 500 }}>
                        Notas del cliente
                      </p>
                      <div style={{ padding: "12px 14px", borderRadius: "var(--r-md)",
                        background: "var(--surface)", border: "1px solid var(--border)",
                        fontSize: "13px", color: "var(--text-2)", lineHeight: 1.6 }}>
                        {b.notes}
                      </div>
                    </div>
                  )}

                  {/* Acciones rápidas de estado */}
                  <div style={{
                    display: "flex", gap: "6px", flexWrap: "wrap",
                    paddingTop: "14px", borderTop: "1px solid var(--border)",
                  }}>
                    <a href={`mailto:${b.user_email}`}
                      className="btn btn-ghost"
                      style={{ padding: "7px 14px", fontSize: "12px" }}>
                      ✉ Contactar
                    </a>
                    <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
                      {Object.entries(bookingStatusLabels).map(([s, label]) => (
                        s !== b.status && (
                          <button key={s}
                            onClick={() => {
                              updateBookingStatus(b.id, s)
                                .then(() => queryClient.invalidateQueries(["admin-services"]))
                            }}
                            style={{
                              padding: "6px 12px", borderRadius: "100px",
                              fontSize: "11px", fontWeight: 500, cursor: "pointer",
                              transition: "all var(--dur) var(--ease)",
                              color: statusColors[s] || "var(--text-2)",
                              background: `${statusColors[s] || "var(--text-3)"}14`,
                              border: `1px solid ${statusColors[s] || "var(--border)"}30`,
                            }}
                          >
                            → {label}
                          </button>
                        )
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}