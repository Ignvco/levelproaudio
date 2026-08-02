// pages/dashboard/MyBookings.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Calendar, X } from "lucide-react"
import { getBookings, cancelBooking } from "../../api/services.api"
import { ConfirmationModal } from "../../components/admin/ui"

const statusColors = {
  pending:   { color: "#facc15", label: "Pendiente"  },
  confirmed: { color: "#60a5fa", label: "Confirmada" },
  completed: { color: "#4ade80", label: "Completada" },
  cancelled: { color: "#f87171", label: "Cancelada"  },
}

export default function MyBookings() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["my-bookings"],
    queryFn:  getBookings,
  })
  const bookings = data?.results || data || []
  const [toCancel, setToCancel] = useState(null)

  const cancelMutation = useMutation({
    mutationFn: cancelBooking,
    onSuccess: () => {
      queryClient.invalidateQueries(["my-bookings"])
      setToCancel(null)
    },
  })

  return (
    <div style={{ padding: "clamp(32px, 5vw, 56px)", maxWidth: "800px" }}>
      <div style={{ marginBottom: "32px" }}>
        <p style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 600,
          letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>
          Mi cuenta
        </p>
        <h1 className="display-bold" style={{ fontFamily: "var(--font-display)",
          fontSize: "clamp(1.7rem, 3vw, 2.4rem)", fontWeight: 800,
          letterSpacing: "-0.03em" }}>
          Mis reservas
        </h1>
      </div>

      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "80px" }} />
          ))}
        </div>
      )}

      {!isLoading && bookings.length === 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-2xl)", padding: "64px 32px", textAlign: "center" }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "50%",
            background: "rgba(26,255,110,0.08)", border: "1px solid rgba(26,255,110,0.2)",
            color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 18px" }}><Calendar size={26} /></div>
          <h3 className="display-bold" style={{ fontFamily: "var(--font-display)", fontWeight: 800,
            fontSize: "1.4rem", letterSpacing: "-0.02em", marginBottom: "8px" }}>
            Sin reservas todavía
          </h3>
          <p style={{ fontSize: "14px", color: "var(--text-3)", marginBottom: "28px" }}>
            Reservá una fecha desde cualquier servicio.
          </p>
          <Link to="/services" className="btn btn-accent">Ver servicios →</Link>
        </div>
      )}

      {!isLoading && bookings.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {bookings.map(b => {
            const s = statusColors[b.status] || { color: "#888", label: b.status_display || b.status }
            const canCancel = b.status === "pending" || b.status === "confirmed"
            return (
              <div key={b.id} style={{ background: "var(--surface)",
                border: "1px solid var(--border)", borderRadius: "var(--r-xl)",
                padding: "20px 24px", display: "flex", alignItems: "center",
                justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%",
                    background: s.color, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 500, marginBottom: "4px" }}>
                      {b.service_name}
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                      {new Date(b.scheduled_date).toLocaleString("es-CL", {
                        day: "numeric", month: "long", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                    {b.notes && (
                      <p style={{ fontSize: "12px", color: "var(--text-2)", marginTop: "4px" }}>
                        &quot;{b.notes}&quot;
                      </p>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{
                    padding: "4px 12px", borderRadius: "var(--r-full)",
                    fontSize: "12px", fontWeight: 500,
                    color: s.color, background: `${s.color}14`,
                    border: `1px solid ${s.color}30`,
                  }}>
                    {s.label}
                  </span>
                  {canCancel && (
                    <button onClick={() => setToCancel(b)}
                      data-testid={`cancel-booking-${b.id}`}
                      style={{ background: "none", border: "1px solid var(--border)",
                        borderRadius: "var(--r-full)", padding: "6px",
                        color: "var(--text-3)", cursor: "pointer",
                        display: "flex", alignItems: "center" }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmationModal
        open={!!toCancel}
        title="¿Cancelar la reserva?"
        description={toCancel ? `Se cancelará tu reserva de "${toCancel.service_name}".` : ""}
        danger
        loading={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate(toCancel.id)}
        onCancel={() => setToCancel(null)}
        testId="cancel-booking-modal"
      />
    </div>
  )
}
