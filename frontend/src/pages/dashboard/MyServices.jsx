// pages/dashboard/DashboardServices.jsx
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { getServiceRequests } from "../../api/services.api"

const statusColors = {
  pending:   { color: "#facc15", label: "Pendiente"  },
  reviewing: { color: "#60a5fa", label: "En revisión" },
  accepted:  { color: "#4ade80", label: "Aceptado"   },
  rejected:  { color: "#f87171", label: "Rechazado"  },
  completed: { color: "#4ade80", label: "Completado" },
}

export default function DashboardServices() {
  const { data, isLoading } = useQuery({
    queryKey: ["service-requests"],
    queryFn:  getServiceRequests,
  })
  const requests = data?.results || data || []

  return (
    <div style={{ padding: "clamp(32px, 5vw, 56px)", maxWidth: "800px" }}>
      <div style={{ marginBottom: "32px" }}>
        <p style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 600,
          letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>
          Mi cuenta
        </p>
        <h1 style={{ fontFamily: "var(--font-serif)",
          fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 300,
          letterSpacing: "-0.02em" }}>
          Mis servicios
        </h1>
      </div>

      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "80px" }} />
          ))}
        </div>
      )}

      {!isLoading && requests.length === 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-2xl)", padding: "64px 32px", textAlign: "center" }}>
          <p style={{ fontSize: "48px", marginBottom: "16px" }}>🔧</p>
          <h3 style={{ fontFamily: "var(--font-serif)", fontWeight: 300,
            fontSize: "1.6rem", marginBottom: "8px" }}>
            Sin solicitudes todavía
          </h3>
          <p style={{ fontSize: "14px", color: "var(--text-3)", marginBottom: "28px" }}>
            Explorá nuestros servicios y enviá una consulta.
          </p>
          <Link to="/services" className="btn btn-accent">Ver servicios →</Link>
        </div>
      )}

      {!isLoading && requests.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {requests.map(req => {
            const s = statusColors[req.status] || { color: "#888", label: req.status }
            return (
              <div key={req.id} style={{ background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-xl)", padding: "20px 24px",
                display: "flex", alignItems: "center",
                justifyContent: "space-between", gap: "16px",
                flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%",
                    background: s.color, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 500,
                      marginBottom: "4px" }}>
                      {req.service_name}
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                      {new Date(req.created_at).toLocaleDateString("es-CL", {
                        day: "numeric", month: "long", year: "numeric"
                      })}
                    </p>
                  </div>
                </div>
                <span style={{
                  padding: "4px 12px", borderRadius: "var(--r-full)",
                  fontSize: "12px", fontWeight: 500,
                  color: s.color, background: `${s.color}14`,
                  border: `1px solid ${s.color}30`,
                }}>
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* CTA para más servicios */}
      <div style={{ marginTop: "32px", padding: "24px",
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-2xl)", textAlign: "center" }}>
        <p style={{ fontSize: "14px", color: "var(--text-2)", marginBottom: "16px" }}>
          ¿Necesitás otro servicio?
        </p>
        <Link to="/services" className="btn btn-ghost">
          Ver todos los servicios →
        </Link>
      </div>
    </div>
  )
}