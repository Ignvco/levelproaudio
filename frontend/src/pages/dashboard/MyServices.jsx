// pages/dashboard/DashboardServices.jsx
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Wrench, X, MessageSquare } from "lucide-react"
import { getServiceRequests } from "../../api/services.api"

const statusColors = {
  pending:   { color: "#facc15", label: "Pendiente"   },
  contacted: { color: "#60a5fa", label: "Contactado"  },
  accepted:  { color: "#4ade80", label: "Aceptado"    },
  rejected:  { color: "#f87171", label: "Rechazado"   },
  completed: { color: "#4ade80", label: "Completado"  },
}

function RequestDetailModal({ req, onClose }) {
  const s = statusColors[req.status] || { color: "#888", label: req.status_display || req.status }
  const row = { display: "flex", gap: "12px", fontSize: "13px", marginBottom: "12px" }
  const label = { color: "var(--text-3)", flexShrink: 0, minWidth: "110px" }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-2xl)", width: "100%", maxWidth: "480px",
        maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: "15px", fontWeight: 500 }}>{req.service_name || "Solicitud de servicio"}</p>
          <button onClick={onClose} style={{ background: "none", border: "none",
            cursor: "pointer", color: "var(--text-3)" }}><X size={20} /></button>
        </div>
        <div style={{ padding: "24px" }}>
          <span style={{ display: "inline-block", marginBottom: "18px", padding: "4px 12px",
            borderRadius: "var(--r-full)", fontSize: "12px", fontWeight: 500,
            color: s.color, background: `${s.color}14`, border: `1px solid ${s.color}30` }}>
            {s.label}
          </span>

          <div style={row}><span style={label}>Enviado</span>
            <span style={{ color: "var(--text-2)" }}>
              {new Date(req.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
          {req.budget && (
            <div style={row}><span style={label}>Presupuesto</span>
              <span style={{ color: "var(--text-2)" }}>${Number(req.budget).toLocaleString("es-CL")}</span>
            </div>
          )}
          {req.preferred_date && (
            <div style={row}><span style={label}>Fecha preferida</span>
              <span style={{ color: "var(--text-2)" }}>
                {new Date(req.preferred_date).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>
          )}

          <div style={{ marginTop: "16px", marginBottom: "16px" }}>
            <p style={{ ...label, marginBottom: "8px" }}>Tu mensaje</p>
            <p style={{ fontSize: "13px", color: "var(--text)", lineHeight: 1.6,
              background: "var(--surface-2)", border: "1px solid var(--border)",
              borderRadius: "var(--r-md)", padding: "14px" }}>
              {req.message}
            </p>
          </div>

          {req.admin_notes && (
            <div>
              <p style={{ display: "flex", alignItems: "center", gap: "6px",
                fontSize: "12px", color: "var(--accent)", fontWeight: 600, marginBottom: "8px" }}>
                <MessageSquare size={13} /> Respuesta de LevelPro
              </p>
              <p style={{ fontSize: "13px", color: "var(--text)", lineHeight: 1.6,
                background: "rgba(26,255,110,0.06)", border: "1px solid rgba(26,255,110,0.2)",
                borderRadius: "var(--r-md)", padding: "14px" }}>
                {req.admin_notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DashboardServices() {
  const { data, isLoading } = useQuery({
    queryKey: ["service-requests"],
    queryFn:  getServiceRequests,
  })
  const requests = data?.results || data || []
  const [selected, setSelected] = useState(null)

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
          <div style={{ width: "64px", height: "64px", borderRadius: "50%",
            background: "rgba(26,255,110,0.08)", border: "1px solid rgba(26,255,110,0.2)",
            color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 18px" }}><Wrench size={26} /></div>
          <h3 className="display-bold" style={{ fontFamily: "var(--font-display)", fontWeight: 800,
            fontSize: "1.4rem", letterSpacing: "-0.02em", marginBottom: "8px" }}>
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
            const s = statusColors[req.status] || { color: "#888", label: req.status_display || req.status }
            return (
              <button key={req.id} onClick={() => setSelected(req)}
                data-testid={`service-request-${req.id}`}
                style={{ background: "var(--surface)",
                  border: "1px solid var(--border)", textAlign: "left", cursor: "pointer",
                  borderRadius: "var(--r-xl)", padding: "20px 24px",
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between", gap: "16px",
                  flexWrap: "wrap", width: "100%",
                  transition: "border-color var(--dur) var(--ease)" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border-hover)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
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
                      {req.admin_notes && " · Tiene respuesta"}
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
              </button>
            )
          })}
        </div>
      )}

      {selected && <RequestDetailModal req={selected} onClose={() => setSelected(null)} />}

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
