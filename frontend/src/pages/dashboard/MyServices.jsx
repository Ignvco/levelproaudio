// pages/dashboard/MyServices.jsx
// Solicitudes y reservas del usuario

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  getServiceRequests,
  getBookings,
  cancelBooking,
} from "../../api/services.api"

// ── Status configs ───────────────────────────────────────────
const requestStatusConfig = {
  pending:   { label: "Pendiente",  color: "#f59e0b" },
  contacted: { label: "Contactado", color: "#3b82f6" },
  accepted:  { label: "Aceptado",   color: "#00e676" },
  rejected:  { label: "Rechazado",  color: "#ff4444" },
}

const bookingStatusConfig = {
  pending:   { label: "Pendiente",  color: "#f59e0b" },
  confirmed: { label: "Confirmado", color: "#00e676" },
  completed: { label: "Completado", color: "#3b82f6" },
  cancelled: { label: "Cancelado",  color: "#ff4444" },
}

function StatusBadge({ status, config }) {
  const c = config[status] || { label: status, color: "#888" }
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{
        color: c.color,
        backgroundColor: `${c.color}18`,
      }}
    >
      {c.label}
    </span>
  )
}

// ── Tab ──────────────────────────────────────────────────────
function Tab({ active, onClick, children, count }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
      style={{
        backgroundColor: active ? "var(--color-surface-2)" : "transparent",
        color: active ? "var(--color-accent)" : "var(--color-text-muted)",
        border: active ? "1px solid var(--color-accent)" : "1px solid transparent",
      }}
    >
      {children}
      {count > 0 && (
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: active ? "var(--color-accent)" : "var(--color-surface)",
            color: active ? "#000" : "var(--color-text-muted)",
          }}
        >
          {count}
        </span>
      )}
    </button>
  )
}

// ── MyServices page ──────────────────────────────────────────
export default function MyServices() {
  const [activeTab, setActiveTab] = useState("requests")
  const queryClient = useQueryClient()

  const { data: requestsData, isLoading: loadingRequests } = useQuery({
    queryKey: ["service-requests"],
    queryFn:  getServiceRequests,
  })

  const { data: bookingsData, isLoading: loadingBookings } = useQuery({
    queryKey: ["bookings"],
    queryFn:  getBookings,
  })

  const cancelMutation = useMutation({
    mutationFn: cancelBooking,
    onSuccess:  () => queryClient.invalidateQueries(["bookings"]),
  })

  const requests = requestsData?.results || requestsData || []
  const bookings = bookingsData?.results || bookingsData || []

  return (
    <div className="p-8 max-w-4xl mx-auto">

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black">Mis servicios</h1>
        <Link
          to="/services"
          className="text-sm font-medium px-4 py-2 rounded-lg"
          style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
        >
          Ver servicios
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8">
        <Tab
          active={activeTab === "requests"}
          onClick={() => setActiveTab("requests")}
          count={requests.length}
        >
          Solicitudes
        </Tab>
        <Tab
          active={activeTab === "bookings"}
          onClick={() => setActiveTab("bookings")}
          count={bookings.length}
        >
          Reservas
        </Tab>
      </div>

      {/* ── Solicitudes ──────────────────────────────────── */}
      {activeTab === "requests" && (
        <div>
          {loadingRequests && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 rounded-2xl animate-pulse"
                  style={{ backgroundColor: "var(--color-surface)" }}
                />
              ))}
            </div>
          )}

          {!loadingRequests && requests.length === 0 && (
            <div
              className="rounded-2xl p-12 text-center"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <p className="text-5xl mb-4">🎚️</p>
              <p className="font-bold text-lg mb-2">Sin solicitudes todavía</p>
              <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
                Explora nuestros servicios y envía tu primera solicitud.
              </p>
              <Link
                to="/services"
                className="inline-block px-6 py-2.5 rounded-lg font-semibold text-sm"
                style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
              >
                Ver servicios
              </Link>
            </div>
          )}

          {!loadingRequests && requests.length > 0 && (
            <div className="space-y-3">
              {requests.map(req => (
                <div
                  key={req.id}
                  className="rounded-2xl p-5"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="font-bold">{req.service_name || "Servicio general"}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                        {new Date(req.created_at).toLocaleDateString("es-CL", {
                          day: "numeric", month: "long", year: "numeric"
                        })}
                      </p>
                    </div>
                    <StatusBadge status={req.status} config={requestStatusConfig} />
                  </div>

                  <p
                    className="text-sm line-clamp-2 mb-3"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {req.message}
                  </p>

                  <div className="flex flex-wrap gap-4 text-xs"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {req.budget && (
                      <span>💰 Presupuesto: ${Number(req.budget).toLocaleString("es-CL")}</span>
                    )}
                    {req.preferred_date && (
                      <span>📅 Fecha preferida: {new Date(req.preferred_date).toLocaleDateString("es-CL")}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Reservas ─────────────────────────────────────── */}
      {activeTab === "bookings" && (
        <div>
          {loadingBookings && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 rounded-2xl animate-pulse"
                  style={{ backgroundColor: "var(--color-surface)" }}
                />
              ))}
            </div>
          )}

          {!loadingBookings && bookings.length === 0 && (
            <div
              className="rounded-2xl p-12 text-center"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <p className="text-5xl mb-4">📅</p>
              <p className="font-bold text-lg mb-2">Sin reservas todavía</p>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Las reservas que hagas aparecerán aquí.
              </p>
            </div>
          )}

          {!loadingBookings && bookings.length > 0 && (
            <div className="space-y-3">
              {bookings.map(booking => (
                <div
                  key={booking.id}
                  className="rounded-2xl p-5"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="font-bold">{booking.service_name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                        📅 {new Date(booking.scheduled_date).toLocaleString("es-CL", {
                          day: "numeric", month: "long",
                          year: "numeric", hour: "2-digit", minute: "2-digit"
                        })}
                      </p>
                    </div>
                    <StatusBadge status={booking.status} config={bookingStatusConfig} />
                  </div>

                  {booking.notes && (
                    <p className="text-sm mb-3" style={{ color: "var(--color-text-muted)" }}>
                      {booking.notes}
                    </p>
                  )}

                  {/* Cancelar */}
                  {["pending", "confirmed"].includes(booking.status) && (
                    <button
                      onClick={() => cancelMutation.mutate(booking.id)}
                      disabled={cancelMutation.isPending}
                      className="text-xs transition-colors disabled:opacity-50"
                      style={{ color: "var(--color-danger)" }}
                    >
                      Cancelar reserva
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}