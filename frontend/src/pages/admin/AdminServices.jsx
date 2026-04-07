// pages/admin/AdminServices.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getAdminServices, updateRequestStatus, updateBookingStatus,
} from "../../api/admin.api"
import api from "../../api/client"

const inputSt = {
  width: "100%", padding: "10px 14px",
  background: "var(--surface-2)", border: "1px solid var(--border)",
  borderRadius: "var(--r-md)", color: "var(--text)",
  fontSize: "13px", outline: "none",
}

const REQ_STATUS = {
  pending:   { label: "Pendiente",   color: "#facc15" },
  reviewing: { label: "En revisión", color: "#60a5fa" },
  accepted:  { label: "Aceptado",    color: "#4ade80" },
  rejected:  { label: "Rechazado",   color: "#f87171" },
  completed: { label: "Completado",  color: "#4ade80" },
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
  const queryClient           = useQueryClient()
  const TABS                  = ["Solicitudes", "Servicios"]

  const { data: servicesData, isLoading: loadingServices } = useQuery({
    queryKey: ["admin-services"], queryFn: getAdminServices,
  })
  const { data: requestsData, isLoading: loadingReqs } = useQuery({
    queryKey: ["admin-requests"],
    queryFn:  () => api.get("/admin/requests/").then(r => r.data),
  })

  const reqMutation = useMutation({
    mutationFn: ({ id, data }) => updateRequestStatus(id, data),
    onSuccess:  () => queryClient.invalidateQueries(["admin-requests"]),
  })

  const services = servicesData?.results || servicesData || []
  const requests = requestsData?.results || requestsData || []

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)",
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 300,
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
                background: "#facc15", color: "#000", fontWeight: 700,
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
                    "{req.message}"
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
        loadingServices ? (
          <div style={{ display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "120px" }} />
            ))}
          </div>
        ) : (
          <div style={{ display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
            {services.map(s => (
              <div key={s.id} style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--r-xl)", padding: "20px",
                display: "flex", flexDirection: "column", gap: "10px",
                transition: "all var(--dur-slow) var(--ease)",
              }}
                className="card card-glow"
              >
                <div style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start" }}>
                  <p style={{ fontSize: "14px", fontWeight: 500 }}>{s.name}</p>
                  <span style={{
                    padding: "2px 8px", borderRadius: "var(--r-full)", fontSize: "11px",
                    fontWeight: 500,
                    color:      s.is_active ? "var(--accent)" : "var(--text-3)",
                    background: s.is_active ? "var(--accent-dim)" : "var(--surface-2)",
                    border:     `1px solid ${s.is_active ? "var(--accent-glow)" : "var(--border)"}`,
                  }}>
                    {s.is_active ? "Activo" : "Inactivo"}
                  </span>
                </div>
                {s.short_description && (
                  <p style={{ fontSize: "12px", color: "var(--text-3)", lineHeight: 1.6 }}>
                    {s.short_description}
                  </p>
                )}
                <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.2rem",
                  color: "var(--accent)", marginTop: "auto" }}>
                  {s.price_display}
                </p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}