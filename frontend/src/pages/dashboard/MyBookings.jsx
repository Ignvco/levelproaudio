// pages/dashboard/MyBookings.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  HelpCircle,
} from "lucide-react"
import { getBookings, cancelBooking } from "../../api/services.api"
import { queryDisplayState, listFromResponse } from "../../utils/queryDisplayState"
import {
  AdminPageHeader,
  StatCard,
  StatusBadge,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  ConfirmationModal,
  ErrorState,
} from "../../components/admin/ui"
import { showToast } from "../../components/ui/ToastNotification"

const STATUS_MAP = {
  pending:   { label: "Pendiente",  status: "warning" },
  confirmed: { label: "Confirmada", status: "info" },
  completed: { label: "Completada", status: "active" },
  cancelled: { label: "Cancelada",  status: "danger" },
}

export default function MyBookings() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-bookings"],
    queryFn:  getBookings,
  })

  const ready = queryDisplayState({ data, isPending: isLoading, isError }) === "ready"
  const bookings = listFromResponse(data)
  const [toCancel, setToCancel] = useState(null)

  const cancelMutation = useMutation({
    mutationFn: cancelBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] })
      setToCancel(null)
      showToast("Reserva cancelada correctamente")
    },
    onError: (e) => {
      showToast(e?.response?.data?.detail || "No se pudo cancelar la reserva. Intenta nuevamente.", "error")
      setToCancel(null)
    },
  })

  const confirmedCount = bookings.filter((b) => b.status === "confirmed").length
  const pendingCount = bookings.filter((b) => b.status === "pending").length

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "—"
    try {
      const d = new Date(dateStr)
      return isNaN(d.getTime())
        ? dateStr
        : d.toLocaleString("es-CL", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="au-page" data-testid="dashboard-bookings-page">
      <AdminPageHeader
        title="Mis reservas"
        description="Fechas y horas agendadas para tus visitas técnicas, instalaciones y servicios de calibración."
        breadcrumb={[
          { label: "Mi cuenta", to: "/dashboard" },
          { label: "Reservas" },
        ]}
        actions={
          <PrimaryButton to="/services" icon={<Calendar size={16} />}>
            Nueva reserva
          </PrimaryButton>
        }
      />

      {/* KPIs únicamente con datos confirmados. */}
      {ready && <div className="au-kpi-strip" style={{ marginBottom: "24px" }}>
        <StatCard
          title="Total reservas"
          value={bookings.length}
          icon={<Calendar size={20} />}
          description="Historial acumulado"
        />
        <StatCard
          title="Confirmadas"
          value={confirmedCount}
          icon={<CheckCircle2 size={20} />}
          description="Agendadas formalmente"
          variant={confirmedCount > 0 ? "emerald" : "default"}
        />
        <StatCard
          title="Pendientes"
          value={pendingCount}
          icon={<Clock size={20} />}
          description="Por confirmar horario"
          variant={pendingCount > 0 ? "amber" : "default"}
        />
      </div>}

      {/* Bookings list */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="au-skeleton" style={{ height: "88px", borderRadius: "var(--admin-radius-lg)" }} />
          ))}
        </div>
      ) : isError ? (
        <ErrorState title="No pudimos cargar tus reservas"
          description="Tus reservas no se han modificado. Intenta actualizar la información."
          action={<SecondaryButton onClick={() => refetch()}>Reintentar</SecondaryButton>} />
      ) : bookings.length === 0 ? (
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
            <Calendar size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 6px", color: "var(--admin-primary-text)" }}>
              No tienes reservas activas
            </h3>
            <p style={{ fontSize: "14px", color: "var(--admin-muted-text)", margin: 0, maxWidth: "420px" }}>
              Agenda una fecha y hora desde cualquiera de nuestros servicios disponibles para coordinar tu atención.
            </p>
          </div>
          <PrimaryButton to="/services" icon={<Calendar size={16} />}>
            Agendar un servicio
          </PrimaryButton>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {bookings.map((b) => {
            const statusMeta = STATUS_MAP[b.status] || { label: b.status_display || b.status || "Desconocido", status: "gray" }
            const canCancel = b.status === "pending" || b.status === "confirmed"

            return (
              <div
                key={b.id}
                className="au-card"
                data-testid={`booking-card-${b.id}`}
                style={{
                  padding: "18px 22px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "var(--admin-radius-md)",
                      background: "var(--admin-surface-muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--admin-primary-text)",
                      flexShrink: 0,
                    }}
                  >
                    <Calendar size={20} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--admin-primary-text)", margin: 0 }}>
                        {b.service_name || "Servicio técnico"}
                      </p>
                    </div>
                    <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--admin-muted-text)", margin: "3px 0 0" }}>
                      🗓️ {formatDateTime(b.scheduled_date)}
                    </p>
                    {b.notes && (
                      <p style={{ fontSize: "12px", color: "var(--admin-muted-text)", margin: "4px 0 0", fontStyle: "italic" }}>
                        &ldquo;{b.notes}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                  <StatusBadge status={statusMeta.status} label={statusMeta.label} />
                  {canCancel && (
                    <DangerButton
                      size="sm"
                      onClick={() => setToCancel(b)}
                      data-testid={`cancel-booking-${b.id}`}
                      icon={<X size={14} />}
                    >
                      Cancelar
                    </DangerButton>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        open={Boolean(toCancel)}
        title="¿Cancelar la reserva?"
        description={toCancel ? `Se cancelará la reserva para "${toCancel.service_name}" agendada para el ${formatDateTime(toCancel.scheduled_date)}.` : ""}
        danger
        loading={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate(toCancel.id)}
        onCancel={() => setToCancel(null)}
        testId="cancel-booking-modal"
      />

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
              ¿Necesitas reprogramar o consultar dudas?
            </p>
            <p style={{ fontSize: "12px", color: "var(--admin-muted-text)", margin: "2px 0 0" }}>
              Puedes comunicarte con soporte técnico para ajustar la fecha de tu visita o coordinar detalles adicionales.
            </p>
          </div>
        </div>
        <SecondaryButton to="/services" icon={<ArrowRight size={14} />}>
          Ver servicios
        </SecondaryButton>
      </div>
    </div>
  )
}
