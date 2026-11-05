// pages/dashboard/MyEntries.jsx — Participaciones en LevelPro Rewards
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  Ticket,
  Trophy,
  Award,
  Sparkles,
  Calendar,
  CheckCircle2,
  ArrowRight,
  Gift,
} from "lucide-react"
import { getMyEntries } from "../../api/rewards.api"
import { mediaUrl } from "../../utils/mediaUrl"
import {
  AdminPageHeader,
  StatCard,
  StatusBadge,
  PrimaryButton,
  SecondaryButton,
} from "../../components/admin/ui"

function TicketCard({ code, image }) {
  return (
    <div
      data-testid={`ticket-${code}`}
      style={{
        position: "relative",
        borderRadius: "var(--admin-radius-md)",
        overflow: "hidden",
        border: "1px solid var(--admin-card-border)",
        background: "#0f172a",
        aspectRatio: "1.7",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      {image ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.35,
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.85) 100%)",
        }}
      />
      <div style={{ position: "relative", padding: "10px 12px", zIndex: 1 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "10px",
            fontWeight: 700,
            color: "#1AFF6E",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "2px",
          }}
        >
          <Ticket size={11} /> Ticket
        </span>
        <p
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "14px",
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "0.04em",
            margin: 0,
          }}
        >
          {code}
        </p>
      </div>
    </div>
  )
}

function CampaignCard({ campaign }) {
  const drawn    = campaign.is_drawn
  const won      = campaign.won
  const isBackup = won?.is_backup
  const codes    = Array.isArray(campaign.codes) ? campaign.codes : []

  const formatDate = (dateStr) => {
    if (!dateStr) return "Por definir"
    try {
      const d = new Date(dateStr)
      return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })
    } catch {
      return dateStr
    }
  }

  return (
    <div
      className="au-card"
      style={{
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--admin-muted-text)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Sorteo · {formatDate(campaign.draw_date)}
            </span>
            <StatusBadge
              status={drawn ? "gray" : "active"}
              label={drawn ? "Finalizado" : "En curso"}
            />
          </div>
          <h3 style={{ fontSize: "17px", fontWeight: 700, color: "var(--admin-primary-text)", margin: "0 0 6px" }}>
            {campaign.name}
          </h3>
          <p
            style={{
              fontSize: "13px",
              color: "var(--admin-primary-text)",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              margin: 0,
              background: "var(--admin-surface-muted)",
              padding: "4px 10px",
              borderRadius: "var(--admin-radius-sm)",
            }}
          >
            <Trophy size={14} style={{ color: "#d97706" }} />
            <strong>Premio principal:</strong> {campaign.main_prize || "Premio sorpresa"}
          </p>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p
            style={{
              fontSize: "11px",
              color: "var(--admin-muted-text)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              margin: "0 0 4px",
            }}
          >
            Tus tickets
          </p>
          <p
            style={{
              fontSize: "26px",
              fontWeight: 800,
              color: "#16a34a",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
              margin: 0,
            }}
          >
            {campaign.entries_count || codes.length || 0}
          </p>
        </div>
      </div>

      {/* Result announcement if drawn */}
      {drawn && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "var(--admin-radius-md)",
            background: won
              ? isBackup
                ? "rgba(250, 204, 21, 0.1)"
                : "rgba(26, 255, 110, 0.12)"
              : "var(--admin-surface-muted)",
            border: won
              ? isBackup
                ? "1px solid rgba(250, 204, 21, 0.35)"
                : "1px solid rgba(26, 255, 110, 0.35)"
              : "1px solid var(--admin-card-border)",
            fontSize: "13px",
            color: won
              ? isBackup
                ? "#b45309"
                : "#15803d"
              : "var(--admin-muted-text)",
            fontWeight: won ? 600 : 400,
          }}
        >
          {won
            ? isBackup
              ? `🥈 Suplente #${won.backup_position} — Tienes opción de adjudicar el premio si el ganador principal no responde.`
              : "🏆 ¡FELICITACIONES! Fuiste seleccionado como ganador. Te contactaremos formalmente por correo."
            : "Sorteo concluido — Tus tickets participaron en el sorteo auditado."}
        </div>
      )}

      {/* Tickets code grid */}
      {codes.length > 0 && (
        <div>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--admin-muted-text)",
              marginBottom: "8px",
            }}
          >
            Códigos asignados
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
              gap: "8px",
            }}
          >
            {codes.map((code) => (
              <TicketCard
                key={code}
                code={code}
                image={campaign.image ? mediaUrl(campaign.image) : null}
              />
            ))}
          </div>
        </div>
      )}

      {/* Card footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: "10px",
          borderTop: "1px solid var(--admin-card-border)",
        }}
      >
        <span style={{ fontSize: "12px", color: "var(--admin-muted-text)" }}>
          {codes.length} {codes.length === 1 ? "número asignado" : "números asignados"}
        </span>
        <SecondaryButton to="/rewards" size="sm" icon={<ArrowRight size={14} />}>
          Ver campaña
        </SecondaryButton>
      </div>
    </div>
  )
}

export default function MyEntries() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["my-reward-entries"],
    queryFn:  getMyEntries,
  })

  const raw = data?.results || data || []
  const campaigns = Array.isArray(raw) ? raw : []

  const totalTickets = campaigns.reduce((acc, c) => acc + (Number(c.entries_count) || (Array.isArray(c.codes) ? c.codes.length : 0)), 0)
  const activeCampaigns = campaigns.filter((c) => !c.is_drawn).length

  return (
    <div className="au-page" data-testid="dashboard-rewards-page">
      <AdminPageHeader
        title="Mis participaciones"
        description="Tus tickets acumulados, campañas activas y resultados auditados de LevelPro Rewards."
        breadcrumb={[
          { label: "Mi cuenta", to: "/dashboard" },
          { label: "Rewards" },
        ]}
        actions={
          <PrimaryButton to="/rewards" icon={<Ticket size={16} />}>
            Explorar sorteos activos
          </PrimaryButton>
        }
      />

      {/* KPI Strip */}
      <div className="au-kpi-strip" style={{ marginBottom: "24px" }}>
        <StatCard
          title="Campañas participadas"
          value={campaigns.length}
          icon={<Award size={20} />}
          description="Sorteos en que has participado"
        />
        <StatCard
          title="Total tickets sumados"
          value={totalTickets}
          icon={<Ticket size={20} />}
          description="Oportunidades generadas"
          variant={totalTickets > 0 ? "emerald" : "default"}
        />
        <StatCard
          title="Sorteos en juego"
          value={activeCampaigns}
          icon={<Sparkles size={20} />}
          description="Por realizarse próximamente"
          variant={activeCampaigns > 0 ? "amber" : "default"}
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[1, 2].map((i) => (
            <div key={i} className="au-skeleton" style={{ height: "140px", borderRadius: "var(--admin-radius-lg)" }} />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
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
            <Ticket size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 6px", color: "var(--admin-primary-text)" }}>
              Aún no tienes tickets registrados
            </h3>
            <p style={{ fontSize: "14px", color: "var(--admin-muted-text)", margin: 0, maxWidth: "420px" }}>
              Adquiere stickers o packs promocionales en LevelPro Rewards para obtener números de la suerte y participar en sorteos de equipamiento audio pro.
            </p>
          </div>
          <PrimaryButton to="/rewards" icon={<Ticket size={16} />}>
            Ver campañas y sorteos
          </PrimaryButton>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}
    </div>
  )
}
