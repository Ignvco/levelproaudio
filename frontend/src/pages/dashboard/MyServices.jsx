// pages/dashboard/MyServices.jsx
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  Wrench,
  X,
  MessageSquare,
  Clock,
  CheckCircle2,
  Calendar,
  DollarSign,
  ArrowRight,
  HelpCircle,
} from "lucide-react"
import { getServiceRequests } from "../../api/services.api"
import {
  AdminPageHeader,
  StatCard,
  StatusBadge,
  PrimaryButton,
  SecondaryButton,
} from "../../components/admin/ui"

const STATUS_MAP = {
  pending:   { label: "Pendiente",  status: "warning" },
  contacted: { label: "Contactado", status: "info" },
  accepted:  { label: "Aceptado",   status: "active" },
  rejected:  { label: "Rechazado",  status: "danger" },
  completed: { label: "Completado", status: "active" },
}

function RequestDetailModal({ req, onClose }) {
  if (!req) return null
  const statusMeta = STATUS_MAP[req.status] || { label: req.status_display || req.status || "Desconocido", status: "gray" }

  const formatCLP = (val) => {
    const num = Number(val)
    return isNaN(num) ? "$0" : `$${num.toLocaleString("es-CL")}`
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return "No especificada"
    try {
      const d = new Date(dateStr)
      return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })
    } catch {
      return dateStr
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        className="au-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "520px",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--admin-card-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: "16px", fontWeight: 700, color: "var(--admin-primary-text)", margin: 0 }}>
              {req.service_name || "Solicitud de servicio"}
            </p>
            <p style={{ fontSize: "12px", color: "var(--admin-muted-text)", margin: "2px 0 0" }}>
              Enviada el {formatDate(req.created_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="au-iconbtn"
            title="Cerrar"
            style={{ width: "32px", height: "32px" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "12px", color: "var(--admin-muted-text)" }}>Estado:</span>
            <StatusBadge status={statusMeta.status} label={statusMeta.label} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
              padding: "14px 16px",
              background: "var(--admin-surface-muted)",
              borderRadius: "var(--admin-radius-md)",
            }}
          >
            <div>
              <p style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--admin-muted-text)", margin: "0 0 4px" }}>
                Presupuesto estimado
              </p>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--admin-primary-text)", margin: 0 }}>
                {req.budget ? formatCLP(req.budget) : "A convenir"}
              </p>
            </div>
            <div>
              <p style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--admin-muted-text)", margin: "0 0 4px" }}>
                Fecha preferida
              </p>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--admin-primary-text)", margin: 0 }}>
                {formatDate(req.preferred_date)}
              </p>
            </div>
          </div>

          <div>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--admin-muted-text)", marginBottom: "6px" }}>
              Tu consulta o detalle
            </p>
            <div
              style={{
                fontSize: "13px",
                lineHeight: 1.6,
                color: "var(--admin-primary-text)",
                background: "var(--admin-surface-muted)",
                padding: "14px",
                borderRadius: "var(--admin-radius-md)",
                border: "1px solid var(--admin-card-border)",
                whiteSpace: "pre-wrap",
              }}
            >
              {req.message || "Sin descripción proporcionada."}
            </div>
          </div>

          {req.admin_notes && (
            <div>
              <p
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  color: "#16a34a",
                  fontWeight: 700,
                  marginBottom: "6px",
                }}
              >
                <MessageSquare size={14} /> Respuesta técnica LevelPro
              </p>
              <div
                style={{
                  fontSize: "13px",
                  lineHeight: 1.6,
                  color: "var(--admin-primary-text)",
                  background: "rgba(26, 255, 110, 0.08)",
                  border: "1px solid rgba(26, 255, 110, 0.3)",
                  borderRadius: "var(--admin-radius-md)",
                  padding: "14px",
                }}
              >
                {req.admin_notes}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--admin-card-border)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <SecondaryButton onClick={onClose}>Cerrar</SecondaryButton>
        </div>
      </div>
    </div>
  )
}

export default function MyServices() {
  const { data, isLoading } = useQuery({
    queryKey: ["service-requests"],
    queryFn:  getServiceRequests,
  })

  const raw = data?.results || data || []
  const requests = Array.isArray(raw) ? raw : []
  const [selected, setSelected] = useState(null)

  const pendingCount = requests.filter((r) => r.status === "pending" || r.status === "contacted").length
  const completedCount = requests.filter((r) => r.status === "completed" || r.status === "accepted").length

  const formatDate = (dateStr) => {
    if (!dateStr) return "—"
    try {
      const d = new Date(dateStr)
      return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="au-page" data-testid="dashboard-services-page">
      <AdminPageHeader
        title="Mis servicios"
        description="Seguimiento y estado de tus consultas técnicas, asesorías y solicitudes de servicio."
        breadcrumb={[
          { label: "Mi cuenta", to: "/dashboard" },
          { label: "Servicios" },
        ]}
        actions={
          <PrimaryButton to="/services" icon={<Wrench size={16} />}>
            Explorar servicios
          </PrimaryButton>
        }
      />

      {/* KPI Strip */}
      <div className="au-kpi-strip" style={{ marginBottom: "24px" }}>
        <StatCard
          title="Total solicitudes"
          value={requests.length}
          icon={<Wrench size={20} />}
          description="Consultas enviadas"
        />
        <StatCard
          title="En seguimiento"
          value={pendingCount}
          icon={<Clock size={20} />}
          description="Pendientes o contactadas"
          variant={pendingCount > 0 ? "amber" : "default"}
        />
        <StatCard
          title="Completadas / Aceptadas"
          value={completedCount}
          icon={<CheckCircle2 size={20} />}
          description="Procesadas con éxito"
          variant={completedCount > 0 ? "emerald" : "default"}
        />
      </div>

      {/* Content list */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="au-skeleton" style={{ height: "88px", borderRadius: "var(--admin-radius-lg)" }} />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div
          className="au-card"
          style={{
            padding: "56px 24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "rgba(26,255,110,0.1)",
              border: "1px solid rgba(26,255,110,0.3)",
              color: "#16a34a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Wrench size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 6px", color: "var(--admin-primary-text)" }}>
              Sin solicitudes de servicio aún
            </h3>
            <p style={{ fontSize: "14px", color: "var(--admin-muted-text)", margin: 0, maxWidth: "420px" }}>
              ¿Necesitas calibración acústica, instalación profesional o asesoría técnica especializada?
            </p>
          </div>
          <PrimaryButton to="/services" icon={<Wrench size={16} />}>
            Ver catálogo de servicios
          </PrimaryButton>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {requests.map((req) => {
            const statusMeta = STATUS_MAP[req.status] || { label: req.status_display || req.status || "Desconocido", status: "gray" }
            const hasReply = Boolean(req.admin_notes)

            return (
              <div
                key={req.id}
                className="au-card"
                data-testid={`service-request-${req.id}`}
                style={{
                  padding: "18px 22px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  flexWrap: "wrap",
                  cursor: "pointer",
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                }}
                onClick={() => setSelected(req)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "var(--admin-radius-md)",
                      background: "var(--admin-surface-muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--admin-primary-text)",
                      flexShrink: 0,
                    }}
                  >
                    <Wrench size={18} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <p
                        style={{
                          fontSize: "15px",
                          fontWeight: 600,
                          color: "var(--admin-primary-text)",
                          margin: 0,
                        }}
                      >
                        {req.service_name || "Solicitud de servicio"}
                      </p>
                      {hasReply && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "#16a34a",
                            background: "rgba(26,255,110,0.12)",
                            padding: "2px 8px",
                            borderRadius: "var(--admin-radius-full)",
                          }}
                        >
                          <MessageSquare size={11} /> Respuesta de LevelPro
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--admin-muted-text)", margin: "3px 0 0" }}>
                      Enviada el {formatDate(req.created_at)}
                      {req.preferred_date ? ` · Fecha preferida: ${formatDate(req.preferred_date)}` : ""}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "14px", flexShrink: 0 }}>
                  <StatusBadge status={statusMeta.status} label={statusMeta.label} />
                  <SecondaryButton
                    size="sm"
                    icon={<ArrowRight size={14} />}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelected(req)
                    }}
                  >
                    Detalles
                  </SecondaryButton>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selected && <RequestDetailModal req={selected} onClose={() => setSelected(null)} />}

      {/* Helpful banner */}
      <div
        className="au-card"
        style={{
          marginTop: "24px",
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <HelpCircle size={20} style={{ color: "var(--admin-muted-text)" }} />
          <div>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--admin-primary-text)", margin: 0 }}>
              ¿Tienes un requerimiento acústico a medida?
            </p>
            <p style={{ fontSize: "12px", color: "var(--admin-muted-text)", margin: "2px 0 0" }}>
              Nuestros ingenieros de sonido evalúan proyectos residenciales, estudios y salas comerciales.
            </p>
          </div>
        </div>
        <SecondaryButton to="/services" icon={<ArrowRight size={14} />}>
          Ver todos los servicios
        </SecondaryButton>
      </div>
    </div>
  )
}
