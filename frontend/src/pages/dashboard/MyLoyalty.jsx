// pages/dashboard/MyLoyalty.jsx — Puntos y Programa de Fidelización
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  Award,
  Sparkles,
  ShoppingBag,
  TrendingUp,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  Gift,
} from "lucide-react"
import { getMyLoyalty, getLoyaltyTransactions } from "../../api/loyalty.api"
import { showToast } from "../../utils/toast"
import {
  AdminPageHeader,
  StatCard,
  PrimaryButton,
  SecondaryButton,
  ErrorState,
} from "../../components/admin/ui"

const NIVELES = {
  bronze:   { color: "#cd7f32", label: "Bronce",   emoji: "🥉", next: 1000 },
  silver:   { color: "#94a3b8", label: "Plata",    emoji: "🥈", next: 5000 },
  gold:     { color: "#facc15", label: "Oro",      emoji: "🥇", next: 15000 },
  platinum: { color: "#38bdf8", label: "Platino",  emoji: "💎", next: null },
}

const TIPO_STYLE = {
  earn:   { color: "#16a34a", sign: "+", label: "Ganado" },
  redeem: { color: "#3b82f6", sign: "-", label: "Canjeado" },
  expire: { color: "var(--admin-muted-text)", sign: "", label: "Expirado" },
  adjust: { color: "#d97706", sign: "", label: "Ajuste" },
}

export default function MyLoyalty() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-loyalty-full"],
    queryFn:  getMyLoyalty,
  })

  const [extraTx, setExtraTx] = useState(null)
  const [nextPage, setNextPage] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [faqOpen, setFaqOpen] = useState(false)

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const page = await getLoyaltyTransactions(nextPage)
      setExtraTx((prev) => (prev ? [...prev, ...page.results] : page.results))
      setNextPage(page.next)
    } catch {
      showToast("No pudimos cargar más movimientos. Vuelve a intentarlo.", "error")
    } finally {
      setLoadingMore(false)
    }
  }

  if (isError || (!isLoading && !data)) {
    return (
      <div className="au-page" data-testid="dashboard-loyalty-error">
        <AdminPageHeader title="Mis puntos y fidelización"
          description="Consulta los beneficios y movimientos de tu cuenta"
          breadcrumbs={[{ label: "Mi cuenta", to: "/dashboard" }, { label: "Puntos" }]} />
        <ErrorState title="No pudimos consultar tus puntos"
          description="No mostraremos saldos estimados. Tus datos se mantienen guardados."
          action={<SecondaryButton onClick={() => refetch()}>Reintentar</SecondaryButton>} />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="au-page" data-testid="dashboard-loyalty-loading">
        <AdminPageHeader
          title="Mis puntos y fidelización"
          description="Acumula puntos en cada compra y canjéalos por descuentos exclusivos en LevelPro."
          breadcrumb={[
            { label: "Mi cuenta", to: "/dashboard" },
            { label: "Puntos" },
          ]}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="au-skeleton" style={{ height: "180px", borderRadius: "var(--admin-radius-lg)" }} />
          <div className="au-skeleton" style={{ height: "90px", borderRadius: "var(--admin-radius-lg)" }} />
        </div>
      </div>
    )
  }

  const nivelKey = String(data.nivel || "bronze").toLowerCase()
  const nivel = NIVELES[nivelKey] || NIVELES.bronze
  const sigNivel = data.siguiente_nivel ? NIVELES[String(data.siguiente_nivel).toLowerCase()] : null

  const transactions = extraTx ?? (Array.isArray(data.transactions) ? data.transactions : [])

  const formatCLP = (val) => {
    const num = Number(val)
    return isNaN(num) ? "$0" : `$${num.toLocaleString("es-CL")}`
  }

  return (
    <div className="au-page" data-testid="dashboard-loyalty-page">
      <AdminPageHeader
        title="Mis puntos y fidelización"
        description="Acumula puntos en cada compra y canjéalos directamente por saldo y descuentos en tu carrito."
        breadcrumb={[
          { label: "Mi cuenta", to: "/dashboard" },
          { label: "Puntos" },
        ]}
        actions={
          <PrimaryButton to="/shop" icon={<ShoppingBag size={16} />}>
            Ir a la tienda
          </PrimaryButton>
        }
      />

      {/* Main Hero Card — Dark theme accent */}
      <div
        className="au-card"
        style={{
          background: "linear-gradient(145deg, #0f1411 0%, #171d18 100%)",
          borderColor: "rgba(26, 255, 110, 0.25)",
          color: "#f8fafc",
          padding: "clamp(20px, 3vw, 28px)",
          marginBottom: "20px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Glow corner */}
        <div
          style={{
            position: "absolute",
            top: "-50px",
            right: "-50px",
            width: "180px",
            height: "180px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(26,255,110,0.18) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "20px",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Left info: Level */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.08)",
                border: `2px solid ${nivel.color}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                flexShrink: 0,
              }}
            >
              {nivel.emoji}
            </div>
            <div>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#94a3b8",
                  margin: "0 0 4px",
                }}
              >
                Nivel del programa
              </p>
              <p
                style={{
                  fontSize: "22px",
                  fontWeight: 800,
                  color: nivel.color,
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                Nivel {nivel.label}
              </p>
            </div>
          </div>

          {/* Right info: Points available */}
          <div style={{ textAlign: "right" }}>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#94a3b8",
                margin: "0 0 4px",
              }}
            >
              Puntos disponibles
            </p>
            <p
              style={{
                fontSize: "clamp(2rem, 4vw, 3rem)",
                fontWeight: 800,
                color: "#1AFF6E",
                lineHeight: 1,
                letterSpacing: "-0.03em",
                fontVariantNumeric: "tabular-nums",
                margin: 0,
              }}
            >
              {(data.puntos_disponibles || 0).toLocaleString("es-CL")}
            </p>
            <p style={{ fontSize: "13px", color: "#cbd5e1", margin: "6px 0 0", fontWeight: 500 }}>
              = {formatCLP(data.valor_disponible || 0)} de saldo para canje
            </p>
          </div>
        </div>

        {/* Progress bar to next level */}
        {sigNivel && (
          <div
            style={{
              marginTop: "24px",
              paddingTop: "20px",
              borderTop: "1px solid rgba(255, 255, 255, 0.1)",
              position: "relative",
              zIndex: 1,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "12px",
                marginBottom: "8px",
              }}
            >
              <span style={{ color: "#94a3b8" }}>
                Progreso hacia nivel <strong style={{ color: sigNivel.color }}>{sigNivel.label}</strong>
              </span>
              <span style={{ color: sigNivel.color, fontWeight: 700 }}>
                {data.progreso_nivel || 0}%
              </span>
            </div>

            <div
              style={{
                height: "8px",
                borderRadius: "4px",
                background: "rgba(255, 255, 255, 0.12)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, data.progreso_nivel || 0))}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${nivel.color}, ${sigNivel.color})`,
                  transition: "width 0.4s ease",
                }}
              />
            </div>

            <p style={{ fontSize: "12px", color: "#94a3b8", margin: "8px 0 0" }}>
              Te faltan{" "}
              <strong style={{ color: sigNivel.color }}>
                {Math.max(0, (data.puntos_para_siguiente || 0) - (data.puntos_totales || 0)).toLocaleString("es-CL")} pts
              </strong>{" "}
              para subir de rango y desbloquear mayores beneficios.
            </p>
          </div>
        )}
      </div>

      {/* Expiration warning banner */}
      {data.proxima_expiracion && (
        <div
          className="au-card"
          style={{
            marginBottom: "20px",
            padding: "14px 18px",
            background: "rgba(250, 204, 21, 0.08)",
            borderColor: "rgba(250, 204, 21, 0.35)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <Clock size={18} style={{ color: "#d97706", flexShrink: 0 }} />
          <p style={{ fontSize: "13px", color: "var(--admin-primary-text)", margin: 0 }}>
            <strong style={{ color: "#b45309" }}>
              {(data.proxima_expiracion.puntos || 0).toLocaleString("es-CL")} puntos
            </strong>{" "}
            vencen el <strong>{data.proxima_expiracion.fecha}</strong> si no realizas compras o canjes previos.
          </p>
        </div>
      )}

      {/* KPI Stats Strip */}
      <div className="au-kpi-strip" style={{ marginBottom: "24px" }}>
        <StatCard
          title="Puntos acumulados"
          value={(data.puntos_totales || 0).toLocaleString("es-CL")}
          icon={<Award size={20} />}
          description="Histórico total sumado"
        />
        <StatCard
          title="Puntos canjeados"
          value={(data.puntos_canjeados || 0).toLocaleString("es-CL")}
          icon={<CheckCircle2 size={20} />}
          description="Utilizados en compras"
          variant="default"
        />
        <StatCard
          title="Mínimo para canjear"
          value={`${(data.minimo_canje || 0).toLocaleString("es-CL")} pts`}
          icon={<Sparkles size={20} />}
          description="En el carrito de compras"
        />
      </div>

      {/* Transactions History Card */}
      <div className="au-card" style={{ padding: "20px 24px", marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            paddingBottom: "12px",
            borderBottom: "1px solid var(--admin-card-border)",
          }}
        >
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--admin-primary-text)" }}>
              {extraTx === null ? "Movimientos recientes" : "Historial completo de puntos"}
            </h3>
            <p style={{ fontSize: "12px", color: "var(--admin-muted-text)", margin: "2px 0 0" }}>
              Registro cronológico de puntos sumados, canjes y acreditaciones.
            </p>
          </div>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--admin-muted-text)",
              background: "var(--admin-surface-muted)",
              padding: "4px 10px",
              borderRadius: "var(--admin-radius-full)",
            }}
          >
            {transactions.length} registros
          </span>
        </div>

        {transactions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 16px" }}>
            <p style={{ fontSize: "14px", color: "var(--admin-muted-text)", marginBottom: "14px" }}>
              Aún no registras movimientos de puntos.
            </p>
            <PrimaryButton to="/shop" size="sm" icon={<ShoppingBag size={14} />}>
              Comenzar a sumar puntos en la tienda
            </PrimaryButton>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {transactions.map((t, idx) => {
              const style = TIPO_STYLE[t.tipo] || TIPO_STYLE.adjust
              const isLast = idx === transactions.length - 1

              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 0",
                    borderBottom: isLast ? "none" : "1px solid var(--admin-card-border)",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--admin-primary-text)", margin: 0 }}>
                      {t.descripcion || "Movimiento de puntos"}
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--admin-muted-text)", margin: "2px 0 0" }}>
                      {style.label} · {t.fecha}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p
                      style={{
                        fontSize: "15px",
                        fontWeight: 700,
                        color: style.color,
                        margin: 0,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {style.sign}{(Number(t.puntos) || 0).toLocaleString("es-CL")} pts
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Load More Button */}
        {transactions.length > 0 && (extraTx === null || nextPage) && (
          <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--admin-card-border)", textAlign: "center" }}>
            <SecondaryButton onClick={loadMore} disabled={loadingMore} style={{ width: "100%", justifyContent: "center" }}>
              {loadingMore ? "Cargando movimientos…" : extraTx === null ? "Ver historial completo" : "Cargar más transacciones"}
            </SecondaryButton>
          </div>
        )}
      </div>

      {/* Accordion: How it works */}
      <section className="au-card" style={{ padding: "20px 24px" }}>
        <button type="button"
          className="au-accordion-trigger"
          aria-expanded={faqOpen}
          aria-controls="loyalty-program-details"
          onClick={() => setFaqOpen(open => !open)}>
          <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <ShieldCheck size={18} style={{ color: "#16a34a" }} />
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--admin-primary-text)" }}>
              ¿Cómo funciona el programa de fidelización LevelPro?
            </span>
            </span>
          <ChevronDown
            size={18}
            style={{
              color: "var(--admin-muted-text)",
              transform: faqOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          />
          </span>
        </button>

        {faqOpen && (
          <div id="loyalty-program-details"
            style={{
              marginTop: "16px",
              paddingTop: "14px",
              borderTop: "1px solid var(--admin-card-border)",
              fontSize: "13px",
              lineHeight: 1.7,
              color: "var(--admin-muted-text)",
            }}
          >
            <ul style={{ margin: 0, paddingLeft: "20px" }}>
              <li><strong>Acumulación automática:</strong> Cada compra suma puntos cuando tu pago es validado y facturado.</li>
              <li><strong>Canje directo:</strong> Aplica tus puntos acumulados como descuento en el checkout antes de pagar.</li>
              <li><strong>Mínimo de canje:</strong> {data.minimo_canje == null ? "Consulta el mínimo vigente antes de canjear." : `Se requieren ${data.minimo_canje} puntos.`}</li>
              <li><strong>Niveles de fidelidad:</strong> El nivel refleja las reglas de fidelización vigentes en tu cuenta.</li>
              <li><strong>Vigencia:</strong> La disponibilidad y la vigencia de los puntos se rigen por las condiciones vigentes del programa.</li>
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
