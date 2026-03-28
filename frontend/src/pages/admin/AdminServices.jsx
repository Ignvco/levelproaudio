// pages/admin/AdminServices.jsx

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getAdminServices, updateBookingStatus, updateRequestStatus } from "../../api/admin.api"

const bookingStatusLabels  = { pending: "Pendiente", confirmed: "Confirmado",
  completed: "Completado", cancelled: "Cancelado" }
const requestStatusLabels  = { pending: "Pendiente", contacted: "Contactado",
  accepted: "Aceptado", rejected: "Rechazado" }
const statusColors = {
  pending: "#facc15", confirmed: "#4ade80", completed: "#60a5fa",
  cancelled: "#f87171", contacted: "#60a5fa", accepted: "#4ade80", rejected: "#f87171",
}

function Badge({ status, labels }) {
  const color = statusColors[status] || "var(--text-3)"
  return (
    <span style={{ padding: "2px 8px", borderRadius: "100px", fontSize: "11px",
      fontWeight: 500, color, background: `${color}14`, border: `1px solid ${color}30` }}>
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
    <select value={current} onChange={e => mutation.mutate(e.target.value)}
      disabled={mutation.isPending}
      style={{ padding: "5px 10px", borderRadius: "var(--r-sm)", fontSize: "12px",
        background: "var(--surface-2)", border: "1px solid var(--border)",
        color: "var(--text)", cursor: "pointer", outline: "none",
        opacity: mutation.isPending ? 0.5 : 1 }}>
      {options.map(s => <option key={s} value={s}>{labels[s]}</option>)}
    </select>
  )
}

export default function AdminServices() {
  const [tab, setTab] = useState("requests")

  const { data, isLoading } = useQuery({
    queryKey: ["admin-services"],
    queryFn:  getAdminServices,
  })

  const bookings = data?.bookings || []
  const requests = data?.requests || []

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)",
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px" }}>
          Servicios
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
          {requests.length} solicitudes · {bookings.length} reservas
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
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

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: "72px" }} />)}
        </div>
      ) : tab === "requests" ? (
        /* ── Solicitudes ── */
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", overflow: "hidden" }}>
          <div style={{ display: "grid",
            gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr 1fr 1.2fr",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>Cliente</span>
            <span>Servicio</span>
            <span>Presupuesto</span>
            <span>Fecha pref.</span>
            <span>Estado</span>
            <span>Cambiar estado</span>
          </div>

          {requests.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px" }}>
              No hay solicitudes.
            </div>
          ) : requests.map((r, i) => (
            <div key={r.id} style={{
              display: "grid",
              gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr 1fr 1.2fr",
              padding: "13px 20px", alignItems: "center",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              transition: "background var(--dur) var(--ease)",
            }}
              className="hover:bg-[var(--surface-2)]"
            >
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
              <InlineSelect
                id={r.id}
                current={r.status}
                options={Object.keys(requestStatusLabels)}
                labels={requestStatusLabels}
                onUpdate={(id, s) => updateRequestStatus(id, { status: s })}
              />
            </div>
          ))}
        </div>
      ) : (
        /* ── Reservas ── */
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", overflow: "hidden" }}>
          <div style={{ display: "grid",
            gridTemplateColumns: "2fr 2fr 1.5fr 1fr 1.2fr",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>Cliente</span>
            <span>Servicio</span>
            <span>Fecha</span>
            <span>Estado</span>
            <span>Cambiar estado</span>
          </div>

          {bookings.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px" }}>
              No hay reservas.
            </div>
          ) : bookings.map((b, i) => (
            <div key={b.id} style={{
              display: "grid",
              gridTemplateColumns: "2fr 2fr 1.5fr 1fr 1.2fr",
              padding: "13px 20px", alignItems: "center",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              transition: "background var(--dur) var(--ease)",
            }}
              className="hover:bg-[var(--surface-2)]"
            >
              <span style={{ fontSize: "13px", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {b.user_email}
              </span>
              <span style={{ fontSize: "13px", color: "var(--text-2)" }}>{b.service_name}</span>
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>{b.scheduled_date}</span>
              <Badge status={b.status} labels={bookingStatusLabels} />
              <InlineSelect
                id={b.id}
                current={b.status}
                options={Object.keys(bookingStatusLabels)}
                labels={bookingStatusLabels}
                onUpdate={(id, s) => updateBookingStatus(id, s)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}