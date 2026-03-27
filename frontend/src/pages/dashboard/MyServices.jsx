// pages/dashboard/MyServices.jsx

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { getServiceRequests, getBookings, cancelBooking } from "../../api/services.api"

const requestStatus = {
  pending:   { label: "Pendiente",  color: "#facc15" },
  contacted: { label: "Contactado", color: "#60a5fa" },
  accepted:  { label: "Aceptado",   color: "#4ade80" },
  rejected:  { label: "Rechazado",  color: "#f87171" },
}

const bookingStatus = {
  pending:   { label: "Pendiente",  color: "#facc15" },
  confirmed: { label: "Confirmado", color: "#4ade80" },
  completed: { label: "Completado", color: "#60a5fa" },
  cancelled: { label: "Cancelado",  color: "#f87171" },
}

function StatusBadge({ status, config }) {
  const c = config[status] || { label: status, color: "var(--text-3)" }
  return (
    <span style={{
      padding: "2px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: 500,
      color: c.color, background: `${c.color}14`, border: `1px solid ${c.color}30`,
    }}>
      {c.label}
    </span>
  )
}

function TabButton({ active, onClick, children, count }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 18px", borderRadius: "100px", fontSize: "13px",
      fontWeight: 400, cursor: "pointer", transition: "all var(--dur) var(--ease)",
      display: "flex", alignItems: "center", gap: "8px",
      background: active ? "var(--text)" : "transparent",
      color: active ? "var(--bg)" : "var(--text-2)",
      border: `1px solid ${active ? "var(--text)" : "var(--border)"}`,
    }}>
      {children}
      {count > 0 && (
        <span style={{
          fontSize: "11px", fontWeight: 600,
          padding: "0px 6px", borderRadius: "100px",
          background: active ? "rgba(0,0,0,0.15)" : "var(--surface-2)",
          color: active ? "var(--bg)" : "var(--text-3)",
        }}>
          {count}
        </span>
      )}
    </button>
  )
}

export default function MyServices() {
  const [tab, setTab]  = useState("requests")
  const queryClient    = useQueryClient()

  const { data: reqData,  isLoading: loadingReqs  } = useQuery({
    queryKey: ["service-requests"], queryFn: getServiceRequests,
  })
  const { data: bookData, isLoading: loadingBooks } = useQuery({
    queryKey: ["bookings"], queryFn: getBookings,
  })

  const cancelMutation = useMutation({
    mutationFn: cancelBooking,
    onSuccess:  () => queryClient.invalidateQueries(["bookings"]),
  })

  const requests = reqData?.results  || reqData  || []
  const bookings = bookData?.results || bookData || []

  return (
    <div style={{ padding: "clamp(32px, 5vw, 56px)", maxWidth: "720px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "40px", flexWrap: "wrap", gap: "16px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)",
          fontSize: "clamp(2rem, 4vw, 2.8rem)" }}>
          Mis servicios
        </h1>
        <Link to="/services" className="btn btn-ghost" style={{ padding: "9px 18px", fontSize: "13px" }}>
          Ver servicios →
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "28px" }}>
        <TabButton active={tab === "requests"} onClick={() => setTab("requests")} count={requests.length}>
          Solicitudes
        </TabButton>
        <TabButton active={tab === "bookings"} onClick={() => setTab("bookings")} count={bookings.length}>
          Reservas
        </TabButton>
      </div>

      {/* ── Solicitudes ─────────────────────────────────── */}
      {tab === "requests" && (
        <>
          {loadingReqs && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: "96px" }} />)}
            </div>
          )}

          {!loadingReqs && requests.length === 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--r-xl)", padding: "64px", textAlign: "center" }}>
              <p style={{ fontSize: "40px", marginBottom: "16px" }}>🎚️</p>
              <p style={{ fontSize: "16px", fontWeight: 500, marginBottom: "8px" }}>
                Sin solicitudes todavía
              </p>
              <p style={{ fontSize: "14px", color: "var(--text-3)", marginBottom: "28px" }}>
                Explora nuestros servicios y envía tu primera solicitud.
              </p>
              <Link to="/services" className="btn btn-accent">Ver servicios</Link>
            </div>
          )}

          {!loadingReqs && requests.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {requests.map(req => (
                <div key={req.id} style={{
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "var(--r-lg)", padding: "18px 20px",
                  transition: "border-color var(--dur) var(--ease)",
                }}
                  className="hover:border-[var(--border-hover)]"
                >
                  <div style={{ display: "flex", justifyContent: "space-between",
                    alignItems: "flex-start", gap: "12px", marginBottom: "10px",
                    flexWrap: "wrap" }}>
                    <div>
                      <p style={{ fontSize: "14px", fontWeight: 500, marginBottom: "3px" }}>
                        {req.service_name || "Servicio general"}
                      </p>
                      <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                        {new Date(req.created_at).toLocaleDateString("es-CL", {
                          day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                    <StatusBadge status={req.status} config={requestStatus} />
                  </div>

                  <p style={{ fontSize: "13px", color: "var(--text-2)", lineHeight: 1.6,
                    display: "-webkit-box", WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: "10px" }}>
                    {req.message}
                  </p>

                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                    {req.budget && (
                      <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                        💰 ${Number(req.budget).toLocaleString("es-CL")}
                      </span>
                    )}
                    {req.preferred_date && (
                      <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                        📅 {new Date(req.preferred_date).toLocaleDateString("es-CL")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Reservas ─────────────────────────────────────── */}
      {tab === "bookings" && (
        <>
          {loadingBooks && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: "96px" }} />)}
            </div>
          )}

          {!loadingBooks && bookings.length === 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--r-xl)", padding: "64px", textAlign: "center" }}>
              <p style={{ fontSize: "40px", marginBottom: "16px" }}>📅</p>
              <p style={{ fontSize: "16px", fontWeight: 500, marginBottom: "8px" }}>
                Sin reservas todavía
              </p>
              <p style={{ fontSize: "14px", color: "var(--text-3)" }}>
                Las reservas que hagas aparecerán aquí.
              </p>
            </div>
          )}

          {!loadingBooks && bookings.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {bookings.map(booking => (
                <div key={booking.id} style={{
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "var(--r-lg)", padding: "18px 20px",
                  transition: "border-color var(--dur) var(--ease)",
                }}
                  className="hover:border-[var(--border-hover)]"
                >
                  <div style={{ display: "flex", justifyContent: "space-between",
                    alignItems: "flex-start", gap: "12px", marginBottom: "10px",
                    flexWrap: "wrap" }}>
                    <div>
                      <p style={{ fontSize: "14px", fontWeight: 500, marginBottom: "3px" }}>
                        {booking.service_name}
                      </p>
                      <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                        📅 {new Date(booking.scheduled_date).toLocaleString("es-CL", {
                          day: "numeric", month: "long", year: "numeric",
                          hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <StatusBadge status={booking.status} config={bookingStatus} />
                  </div>

                  {booking.notes && (
                    <p style={{ fontSize: "13px", color: "var(--text-2)", lineHeight: 1.6,
                      marginBottom: "10px" }}>
                      {booking.notes}
                    </p>
                  )}

                  {["pending", "confirmed"].includes(booking.status) && (
                    <button
                      onClick={() => cancelMutation.mutate(booking.id)}
                      disabled={cancelMutation.isPending}
                      style={{ fontSize: "12px", color: "var(--text-3)", background: "none",
                        border: "none", cursor: "pointer", transition: "color var(--dur)",
                        padding: 0, opacity: cancelMutation.isPending ? 0.5 : 1 }}
                      className="hover:text-[var(--danger)]"
                    >
                      Cancelar reserva
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}