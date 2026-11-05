// pages/Dashboard.jsx — Dashboard Experience V2 (Usuario Home)
// Composición aprobada LevelPro Audio: header Mi Cuenta, hero oscuro de marca,
// 3 KPIs (MIS PEDIDOS, PUNTOS LEVELPRO, MI ACADEMIA) y 3 paneles operativos
// (Seguimiento de pedido, Sigue aprendiendo, LevelPro Rewards).
// 100% conectado a APIs reales (getOrders, getEnrollments, getServiceRequests, getMyLoyalty, getMyEntries).
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  Package, GraduationCap, Star,
  ArrowRight, AlertTriangle, Calendar, Headphones,
  SlidersHorizontal, Gift, Sparkles,
} from "lucide-react"
import { useAuthStore } from "../store/authStore"
import {
  AdminPageHeader, StatCard, StatusBadge, SecondaryButton, ErrorState,
} from "../components/admin/ui"
import Button from "../components/ui/Button"
import { getOrders } from "../api/orders.api"
import { getEnrollments } from "../api/academy.api"
import { getServiceRequests } from "../api/services.api"
import { getMyLoyalty } from "../api/loyalty.api"
import { getMyEntries } from "../api/rewards.api"
import { mediaUrl } from "../utils/mediaUrl"

const ORDER_STATUS = {
  pending:   { label: "Pendiente",   tone: "warning", step: 0, note: "Completa o confirma tu pago para iniciar la preparación." },
  paid:      { label: "En proceso",  tone: "success", step: 1, note: "Te notificaremos cuando tu pedido esté en camino." },
  shipped:   { label: "En despacho", tone: "info",    step: 2, note: "Tu pedido ya fue despachado y está en ruta." },
  completed: { label: "Entregado",   tone: "success", step: 3, note: "Pedido entregado satisfactoriamente." },
  cancelled: { label: "Cancelado",   tone: "danger",  step: -1, note: "Este pedido fue cancelado." },
}

const TRACKING_STEPS = ["Confirmado", "Preparación", "Despacho", "Entregado"]

function OrderTrackingSteps({ status }) {
  const info = ORDER_STATUS[status] || ORDER_STATUS.pending
  const activeStep = info.step

  return (
    <div className="lp-tracking" aria-label="Progreso del pedido">
      {TRACKING_STEPS.map((label, idx) => {
        let lineClass = "lp-track-line"
        let labelClass = "lp-track-label"
        if (activeStep >= 0) {
          if (idx < activeStep || activeStep === 3) {
            lineClass += " complete"
            labelClass += " current"
          } else if (idx === activeStep) {
            lineClass += " current"
            labelClass += " current"
          }
        }
        return (
          <div key={label} className="lp-track-step">
            <div className={lineClass} />
            <div className={labelClass}>{label}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuthStore()

  const {
    data: ordersData,
    isLoading: ordersLoading,
    isError: ordersError,
    refetch: refetchOrders,
  } = useQuery({ queryKey: ["orders"], queryFn: getOrders })
  const { data: enrollData, isLoading: enrollLoading } = useQuery({ queryKey: ["enrollments"], queryFn: getEnrollments })
  const { data: reqData }     = useQuery({ queryKey: ["service-requests"], queryFn: getServiceRequests })
  const { data: loyalty }     = useQuery({ queryKey: ["my-loyalty"], queryFn: getMyLoyalty })
  const { data: entriesData } = useQuery({ queryKey: ["my-entries"], queryFn: getMyEntries })

  if (ordersError) {
    return (
      <div className="au-page" data-testid="dashboard-home">
        <ErrorState
          title="No pudimos cargar tu resumen de cuenta"
          description="Verifica tu conexión o intenta nuevamente."
          onRetry={() => refetchOrders()}
        />
      </div>
    )
  }

  const orders      = ordersData?.results || ordersData || []
  const enrollments = enrollData?.results || enrollData || []
  const enrollCount = enrollments.length
  const reqCount    = reqData?.results?.length ?? reqData?.length ?? 0
  const points      = loyalty?.puntos_disponibles ?? 0
  const entries     = Array.isArray(entriesData) ? entriesData : (entriesData?.results || [])
  const totalTickets = entries.reduce((acc, c) => acc + (c.entries_count || 0), 0)

  const pending = orders.filter((o) => o.status === "pending")
  const inTransitCount = orders.filter((o) => o.status === "paid" || o.status === "shipped").length
  const latestOrder = orders[0] || null
  const latestOrderStatus = latestOrder ? (ORDER_STATUS[latestOrder.status] || ORDER_STATUS.pending) : null

  const latestEnrollment = enrollments[0] || null
  const latestCourse = latestEnrollment?.course || null
  const courseProgress = Math.min(100, Math.max(0, Math.round(latestEnrollment?.progress_percentage || 0)))
  const courseThumb = latestCourse?.thumbnail ? mediaUrl(latestCourse.thumbnail) : null

  return (
    <div className="au-page" data-testid="dashboard-home">
      {/* Header Mi Cuenta */}
      <AdminPageHeader
        eyebrow="LEVELPRO / MI CUENTA"
        title="Tu mundo LevelPro."
        description="Tus compras, tus cursos y tus beneficios, en un mismo lugar."
        actions={
          <SecondaryButton to="/dashboard/orders" testId="dash-view-orders">
            <Package size={15} /> Ver mis pedidos
          </SecondaryButton>
        }
      />

      {/* Hero oscuro de marca */}
      <section className="lp-user-hero" aria-label="Bienvenida LevelPro Audio">
        <div>
          <div className="lp-user-hero__eyebrow">● LEVELPRO AUDIO · EXPERIENCIA PERSONAL</div>
          <h2 className="lp-user-hero__title">
            Más que equipos.<br />Todo tu sonido en un lugar.
          </h2>
          <p className="lp-user-hero__desc">
            Explora tus pedidos, continúa aprendiendo y aprovecha los beneficios exclusivos de tu cuenta.
          </p>
        </div>

        <div className="lp-user-hero__foot">
          <Button variant="green" size="sm" arrow to="/shop" testId="dash-explore-shop">
            Explorar tienda
          </Button>
          <Link to="/dashboard/profile" className="lp-user-hero__badge">
            <span>
              Bienvenido a LevelPro{user?.first_name ? `, ${user.first_name}` : ""}
            </span>
            <Sparkles size={13} style={{ color: "#1AFF6E" }} />
          </Link>
        </div>
      </section>

      {/* Alerta: pagos pendientes (preservada cuando hay órdenes pendientes) */}
      {pending.length > 0 && (
        <div
          data-testid="dash-alert"
          style={{
            padding: "13px 18px",
            background: "#FFFBEB",
            border: "1px solid rgba(217, 119, 6, 0.28)",
            borderRadius: "18px",
            display: "flex",
            gap: "12px",
            alignItems: "center",
          }}
        >
          <AlertTriangle size={17} strokeWidth={2} style={{ color: "#D97706", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#14161A" }}>Tenés pagos pendientes</p>
            <p style={{ fontSize: "12px", color: "#6B7280", marginTop: "1px" }}>
              {pending.length} pedido{pending.length !== 1 ? "s" : ""} esperan completar el pago.
            </p>
          </div>
          <Link
            to="/dashboard/orders"
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#D97706",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              whiteSpace: "nowrap",
            }}
          >
            Resolver <ArrowRight size={13} />
          </Link>
        </div>
      )}

      {/* Encabezado de sección Tu actividad */}
      <div className="lp-section-head">
        <span className="lp-section-head__title">Tu actividad</span>
        <span className="lp-datepill">
          <Calendar size={14} /> Mi resumen
        </span>
      </div>

      {/* ═══ FILA 1: 3 KPIs DE USUARIO (StatCard) ═════════════════════ */}
      <div className="lp-customer-kpi">
        <StatCard
          variant="light"
          label="MIS PEDIDOS"
          value={String(orders.length).padStart(2, "0")}
          sub={
            inTransitCount > 0
              ? `${inTransitCount} en camino`
              : pending.length > 0
                ? `${pending.length} por confirmar`
                : "Historial de compras"
          }
          badge={<span className="au-lp__delta">Ver historial ↗</span>}
          Icon={Package}
          to="/dashboard/orders"
          loading={ordersLoading}
          testId="dash-kpi-pedidos"
        />

        <StatCard
          variant="primary"
          label="PUNTOS LEVELPRO"
          value={
            <>
              {points.toLocaleString("es-CL")}
              <span style={{ fontSize: 15, marginLeft: 5 }}>pts</span>
            </>
          }
          sub={loyalty?.nivel ? `Nivel ${loyalty.nivel}` : "Programa de fidelidad"}
          badge={<span className="au-lp__delta">Ver beneficios ↗</span>}
          Icon={Star}
          to="/dashboard/loyalty"
          testId="dash-kpi-puntos"
        />

        <StatCard
          variant="light"
          label="MI ACADEMIA"
          value={String(enrollCount).padStart(2, "0")}
          sub={reqCount > 0 ? `Cursos · ${reqCount} servicio${reqCount !== 1 ? "s" : ""}` : "Cursos inscritos"}
          badge={<span className="au-lp__delta">Continuar ↗</span>}
          Icon={GraduationCap}
          to="/dashboard/courses"
          loading={enrollLoading}
          testId="dash-kpi-cursos"
        />
      </div>

      {/* ═══ FILA 2: 3 TARJETAS OPERATIVAS ════════════════════════════ */}
      <div className="lp-user-lower-grid">
        {/* 1. Seguimiento de pedido */}
        <article className="au-card au-panel" data-testid="dash-recent">
          <div className="au-panel__head">
            <div>
              <h2 className="au-panel__title">Seguimiento de pedido</h2>
              <p className="au-panel__desc">Tu compra más reciente</p>
            </div>
            <Link
              to={latestOrder ? `/dashboard/orders/${latestOrder.id}` : "/dashboard/orders"}
              style={{
                fontSize: 11.5,
                color: "#0F9940",
                fontWeight: 800,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Ver detalle <ArrowRight size={13} />
            </Link>
          </div>

          {ordersLoading ? (
            <div className="au-skel" style={{ height: 150 }} />
          ) : latestOrder ? (
            <>
              <Link to={`/dashboard/orders/${latestOrder.id}`} className="lp-order-summary">
                <span className="lp-order-thumb">
                  <Headphones size={20} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 12.5, color: "#14161A" }}>
                    Pedido #{String(latestOrder.id || "").slice(0, 8).toUpperCase()}
                  </strong>
                  <p style={{ fontSize: 11, color: "#8D959E", margin: "2px 0 0" }}>
                    {latestOrder.items_count || 1} producto{(latestOrder.items_count || 1) !== 1 ? "s" : ""} · $
                    {Number(latestOrder.total || 0).toLocaleString("es-CL")}
                  </p>
                </div>
                <StatusBadge tone={latestOrderStatus.tone}>{latestOrderStatus.label}</StatusBadge>
              </Link>

              <OrderTrackingSteps status={latestOrder.status} />

              <p style={{ fontSize: 11.5, color: "#8D959E", margin: 0 }}>
                {latestOrderStatus.note}
              </p>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="lp-order-summary">
                <span className="lp-order-thumb">
                  <Headphones size={20} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 12.5, color: "#14161A" }}>
                    Sin pedidos registrados
                  </strong>
                  <p style={{ fontSize: 11, color: "#8D959E", margin: "2px 0 0" }}>
                    Tus próximas compras mostrarán su seguimiento en tiempo real aquí.
                  </p>
                </div>
              </div>
              <div>
                <SecondaryButton size="sm" to="/shop">
                  Ir a la tienda <ArrowRight size={13} />
                </SecondaryButton>
              </div>
            </div>
          )}
        </article>

        {/* 2. Sigue aprendiendo (LevelPro Academy) */}
        <article className="au-card au-panel" data-testid="dash-courses-panel">
          <div className="au-panel__head">
            <div>
              <h2 className="au-panel__title">Sigue aprendiendo</h2>
              <p className="au-panel__desc">Tu progreso en LevelPro Academy</p>
            </div>
            <span className="au-lp__tag">ACADEMY</span>
          </div>

          {enrollLoading ? (
            <div className="au-skel" style={{ height: 150 }} />
          ) : latestEnrollment ? (
            <>
              <div className="lp-course-card">
                <span className="lp-course-pic">
                  {courseThumb
                    ? <img src={courseThumb} alt="" />
                    : <SlidersHorizontal size={22} />}
                </span>
                <div style={{ minWidth: 0 }}>
                  <b style={{
                    fontSize: 12.5, color: "#14161A", display: "block",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {latestCourse?.title || "Curso LevelPro Academy"}
                  </b>
                  <p style={{ fontSize: 11, color: "#8D959E", margin: "4px 0 0" }}>
                    Curso · {courseProgress === 100 ? "Completado" : "En progreso"}
                  </p>
                </div>
              </div>

              <div className="lp-course-progress">
                <span style={{ width: `${courseProgress}%` }} />
              </div>
              <div className="lp-course-progtext">
                <span>Progreso de aprendizaje</span>
                <b style={{ color: "#14161A" }}>{courseProgress}%</b>
              </div>

              <div style={{ marginTop: 18 }}>
                <SecondaryButton
                  size="sm"
                  to={latestCourse?.slug ? `/academy/${latestCourse.slug}` : "/dashboard/courses"}
                >
                  Continuar curso <ArrowRight size={13} />
                </SecondaryButton>
              </div>
            </>
          ) : (
            <>
              <div className="lp-course-card">
                <span className="lp-course-pic">
                  <SlidersHorizontal size={22} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <b style={{ fontSize: 12.5, color: "#14161A", display: "block" }}>
                    LevelPro Academy
                  </b>
                  <p style={{ fontSize: 11, color: "#8D959E", margin: "4px 0 0" }}>
                    Aún no tienes cursos inscritos activos
                  </p>
                </div>
              </div>

              <div className="lp-course-progress">
                <span style={{ width: "0%" }} />
              </div>
              <div className="lp-course-progtext">
                <span>Progreso de aprendizaje</span>
                <b style={{ color: "#14161A" }}>0%</b>
              </div>

              <div style={{ marginTop: 18 }}>
                <SecondaryButton size="sm" to="/academy">
                  Explorar cursos <ArrowRight size={13} />
                </SecondaryButton>
              </div>
            </>
          )}
        </article>

        {/* 3. LevelPro Rewards */}
        <article className="au-card au-panel" data-testid="dash-rewards-panel">
          <div className="au-panel__head">
            <div>
              <h2 className="au-panel__title">LevelPro Rewards</h2>
              <p className="au-panel__desc">Participa y gana</p>
            </div>
          </div>

          <div className="lp-rewards-box">
            <span className="lp-rewards-box__icon">
              <Gift size={20} />
            </span>
            <strong className="lp-rewards-box__title">
              Tu próxima<br />oportunidad.
            </strong>
            <p className="lp-rewards-box__desc">
              {totalTickets > 0
                ? `Tienes ${totalTickets} ticket${totalTickets !== 1 ? "s" : ""} activos en ${entries.length} campaña${entries.length !== 1 ? "s" : ""}.`
                : "Descubre las campañas disponibles y revisa tus participaciones."}
            </p>
            <Link to="/dashboard/rewards" className="lp-rewards-box__btn">
              Explorar Rewards ↗
            </Link>
          </div>
        </article>
      </div>
    </div>
  )
}
