// pages/Dashboard.jsx — LevelPro Audio Dashboard Experience V3
// High-Fidelity Editorial Bento & Minimalist Fintech UI (Inspired by Lumin - Referencia D)
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  Package, GraduationCap, Star, Gift, Wrench,
  ArrowRight, ArrowUpRight, ChevronRight,
  Calendar, ChevronDown, Headphones, User, Play
} from "lucide-react"
import { useAuthStore } from "../store/authStore"
import { StatusBadge, ErrorState } from "../components/admin/ui"
import { getOrders } from "../api/orders.api"
import { getEnrollments } from "../api/academy.api"
import { getMyLoyalty } from "../api/loyalty.api"
import { getBrands } from "../api/products.api"
import { mediaUrl } from "../utils/mediaUrl"
import {
  asRows, count, formatMoney, loyaltyHistory, firstOrderItem,
} from "./dashboard/dashboardV3Data"

const ORDER_STATUS_MAP = {
  paid:      { label: "En proceso",  tone: "success", step: 1 },
  shipped:   { label: "En despacho", tone: "info",    step: 2 },
  completed: { label: "Entregado",   tone: "success", step: 3 },
  pending:   { label: "Pendiente",   tone: "warning", step: 0 },
  cancelled: { label: "Cancelado",   tone: "danger",  step: -1 },
}

export default function Dashboard() {
  const { user } = useAuthStore()

  const {
    data: ordersData,
    isError: ordersError,
    isPending: ordersLoading,
    refetch: refetchOrders,
  } = useQuery({ queryKey: ["orders"], queryFn: getOrders })

  const { data: enrollData, isPending: enrollLoading } = useQuery({ queryKey: ["enrollments"], queryFn: getEnrollments })
  const { data: loyalty, isPending: loyaltyLoading }    = useQuery({ queryKey: ["my-loyalty"], queryFn: getMyLoyalty })
  const { data: brandsData } = useQuery({ queryKey: ["brands"], queryFn: getBrands, staleTime: 1000 * 60 * 5 })

  if (ordersError) {
    return (
      <div className="v3-shell" data-testid="dashboard-home">
        <div style={{ maxWidth: 600, margin: "80px auto", padding: 24 }}>
          <ErrorState
            title="No pudimos cargar tu resumen de cuenta"
            description="Verifica tu conexión o intenta nuevamente."
            onRetry={() => refetchOrders()}
          />
        </div>
      </div>
    )
  }

  if (ordersLoading) {
    return <div className="v3-main-content" data-testid="dashboard-home"><div className="v3-card" role="status">Cargando los datos reales de tu cuenta…</div></div>
  }

  const orders      = asRows(ordersData)
  const enrollments = asRows(enrollData)
  const points      = loyalty?.puntos_disponibles
  const loyaltyTier = loyalty?.nivel || "Sin nivel asignado"
  const levelProgress = count(loyalty?.progreso_nivel)

  const latestOrder = orders[0] || null
  const orderStatus = latestOrder
    ? (ORDER_STATUS_MAP[latestOrder.status] || { label: "Estado por confirmar", tone: "neutral", step: 0 })
    : null

  const latestEnrollment = enrollments[0] || null
  const courseTitle = latestEnrollment?.course?.title || latestEnrollment?.course_title || null
  const courseProgress = Math.max(0, Math.min(100, count(latestEnrollment?.progress_percentage)))

  const userName = user?.first_name || user?.email?.split("@")[0] || "Cliente LevelPro"
  const displayBrands = asRows(brandsData).filter(b => b?.name && b.is_active !== false)
  const pointMovements = loyaltyHistory(loyalty)
  const monthLabel = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(new Date())

  return (
    <div className="v3-main-content" data-testid="dashboard-home">
      {/* Subheader Context Bar (Lumin Ref D) */}
      <div className="v3-subheader">
        <div>
          <h1 className="v3-title">
            <span style={{ color: "var(--v3-accent)" }}>+</span>
            <span>Hola, {userName}!</span>
          </h1>
          <p className="v3-title-sub">
            Tu centro de control LevelPro: compras, puntos acumulados, cursos y servicios.
          </p>
        </div>

        <div className="v3-controls-row">
          <div className="v3-pill-btn">
            <Calendar size={14} />
            <span>{monthLabel} · resumen actual</span>
            <ChevronDown size={13} style={{ opacity: 0.6 }} />
          </div>

          <Link
            to="/dashboard/orders"
            className="v3-btn-action"
            data-testid="dash-view-orders"
          >
            <Package size={14} />
            <span>Mis pedidos</span>
          </Link>
        </div>
      </div>

      {/* Bento Grid Layout (Referencia D) */}
      <div className="v3-bento-grid">
        {/* ====================================================================
            CARD 1: TALL OBSIDIAN HERO CARD — BALANCE LEVELPRO (Lumin Ref D)
            ==================================================================== */}
        <div
          className="v3-card-obsidian"
          style={{ gridColumn: "span 4", minHeight: 460 }}
          data-testid="dash-alert"
        >
          <div className="v3-card-header">
            <div>
              <p className="v3-micro-label-dark">PUNTOS & FIDELIZACIÓN</p>
              <h2 className="v3-card-title-dark" style={{ marginTop: 2 }}>Balance LevelPro</h2>
            </div>
            <Link to="/dashboard/loyalty" className="v3-circle-btn-dark" title="Mis puntos">
              <ArrowUpRight size={16} />
            </Link>
          </div>

          <div style={{ margin: "4px 0 16px" }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.03em" }}>
              {loyaltyLoading || points == null ? "—" : count(points).toLocaleString("es-CL")} <span style={{ fontSize: 18, color: "var(--v3-accent)" }}>pts</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--v3-text-dark-muted)", margin: "4px 0 0" }}>
              Nivel <strong style={{ color: "#fff" }}>{loyaltyLoading ? "Consultando" : loyaltyTier}</strong> · Puntos disponibles
            </p>
          </div>

          {/* 4 Circular Action Buttons (Lumin Ref D) */}
          <div className="v3-action-circles">
            <Link to="/dashboard/orders" className="v3-action-circle" title="Mis pedidos">
              <Package size={17} />
            </Link>
            <Link to="/dashboard/rewards" className="v3-action-circle" title="Canjear Rewards">
              <Gift size={17} />
            </Link>
            <Link to="/dashboard/courses" className="v3-action-circle" title="Mis cursos">
              <GraduationCap size={17} />
            </Link>
            <Link to="/dashboard/profile" className="v3-action-circle" title="Mi perfil">
              <User size={17} />
            </Link>
          </div>

          {/* Seguimiento: exclusivamente el último pedido real del cliente. */}
          {latestOrder ? (
            <div style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: 14, margin: "12px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--v3-accent)", letterSpacing: ".06em" }}>ÚLTIMO PEDIDO</span>
                <span style={{ fontSize: 11.5, color: "var(--v3-text-dark-muted)" }}>#{String(latestOrder.id).slice(0, 8).toUpperCase()}</span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: "6px 0 10px" }}>{orderStatus.label} · {formatMoney(latestOrder.total, latestOrder.currency)}</p>
              <div className="v3-stepper-bar" aria-label={`Estado de pedido: ${orderStatus.label}`}>
                {Array.from({ length: 4 }, (_, i) => (
                  <span key={i} className={`v3-step-seg${orderStatus.step >= i ? " active" : ""}`} />
                ))}
              </div>
              <Link to={`/dashboard/orders/${latestOrder.id}`} style={{ display: "block", color: "var(--v3-accent)", fontSize: 12, marginTop: 12 }}>Ver detalle del pedido</Link>
            </div>
          ) : (
            <div style={{ background: "rgba(255,255,255,.05)", borderRadius: 16, padding: 16, margin: "12px 0", color: "var(--v3-text-dark-muted)", fontSize: 13 }}>
              Todavía no tienes pedidos. <Link to="/shop" style={{ color: "var(--v3-accent)" }}>Explorar tienda</Link>
            </div>
          )}

          <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--v3-text-dark-muted)", marginBottom: 6 }}>
              <span>Progreso de fidelización</span>
              <strong style={{ color: "#fff" }}>{loyaltyLoading ? "—" : `${levelProgress}%`}</strong>
            </div>
            <div className="v3-prog-bar" style={{ background: "rgba(255,255,255,.1)", height: 6 }}>
              <div className="v3-prog-fill" style={{ width: `${levelProgress}%` }} />
            </div>
            {!loyaltyLoading && loyalty?.siguiente_nivel && (
              <p style={{ fontSize: 11, marginTop: 7, color: "var(--v3-text-dark-muted)" }}>Próximo nivel: {loyalty.siguiente_nivel}</p>
            )}
          </div>
        </div>

        {/* ====================================================================
            TRIO OF NEON GREEN BRAND ACCENT TILES (Lumin Ref B & D)
            ==================================================================== */}
        <div className="v3-neon-trio" data-testid="dash-rewards-panel">
          {/* Tile 1: Rewards */}
          <Link to="/dashboard/rewards" className="v3-card-accent">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="v3-accent-icon-wrap">
                <Gift size={22} />
              </div>
              <span className="v3-accent-arrow">→</span>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", margin: "0 0 2px", opacity: 0.8 }}>
                LEVELPRO CLUB
              </p>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "var(--v3-obsidian)", lineHeight: 1.2 }}>
                LevelPro Rewards
              </h3>
            </div>
          </Link>

          {/* Tile 2: Servicios Técnicos */}
          <Link to="/dashboard/services" className="v3-card-accent">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="v3-accent-icon-wrap">
                <Wrench size={22} />
              </div>
              <span className="v3-accent-arrow">→</span>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", margin: "0 0 2px", opacity: 0.8 }}>
                SERVICIOS
              </p>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "var(--v3-obsidian)", lineHeight: 1.2 }}>
                Servicios técnicos
              </h3>
            </div>
          </Link>

          {/* Tile 3: Doble Puntos */}
          <Link to="/dashboard/courses" className="v3-card-accent">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="v3-accent-icon-wrap">
                <Star size={22} />
              </div>
              <span className="v3-accent-arrow">→</span>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", margin: "0 0 2px", opacity: 0.8 }}>
                LEVELPRO ACADEMY
              </p>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "var(--v3-obsidian)", lineHeight: 1.2 }}>
                Mis cursos
              </h3>
            </div>
          </Link>
        </div>

        {/* ====================================================================
            CARD 5: WHITE BENTO CARD — ACADEMIA (Continuar Aprendiendo)
            ==================================================================== */}
        <div className="v3-card" style={{ gridColumn: "span 4" }} data-testid="dash-courses-panel">
          <div className="v3-card-header">
            <div>
              <p className="v3-micro-label">CONTINUAR APRENDIENDO</p>
              <h2 className="v3-card-title" style={{ marginTop: 2 }}>Mi Academia</h2>
            </div>
            <Link to="/dashboard/courses" className="v3-circle-btn" title="Mis cursos">
              <ArrowUpRight size={16} />
            </Link>
          </div>

          {enrollLoading ? (
            <p role="status" style={{ color: "var(--v3-text-muted)", fontSize: 13 }}>Consultando inscripciones…</p>
          ) : latestEnrollment ? (
            <>
              <div className="v3-course-box">
                <div className="v3-course-thumb"><Headphones size={26} /></div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--v3-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{courseTitle || "Curso inscrito"}</p>
                  <p style={{ fontSize: 11.5, color: "var(--v3-text-muted)", margin: "3px 0 0" }}>Inscripción registrada en LevelPro Academy</p>
                </div>
              </div>
              <div style={{ margin: "18px 0 10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: "var(--v3-text-muted)" }}>Progreso del curso</span>
                  <strong style={{ color: "var(--btn-green)" }}>{courseProgress}%</strong>
                </div>
                <div className="v3-prog-bar"><div className="v3-prog-fill-brand" style={{ width: `${courseProgress}%` }} /></div>
              </div>
            </>
          ) : <p role="status" style={{ color: "var(--v3-text-muted)", fontSize: 13 }}>No tienes cursos inscritos todavía.</p>}

          <Link to="/dashboard/courses" className="v3-pill-btn" style={{ width: "100%", justifyContent: "center", marginTop: "auto" }}>
            <Play size={14} fill="currentColor" />
            <span>{latestEnrollment ? "Ver mis clases" : "Explorar Academia"}</span>
          </Link>
        </div>

        {/* CARD 6: Datos reales de puntos y movimientos, conservando la tarjeta Bento. */}
        <div className="v3-card" style={{ gridColumn: "span 4" }}>
          <div className="v3-card-header">
            <div>
              <p className="v3-micro-label">ACTIVIDAD EN LEVELPRO CLUB</p>
              <h2 className="v3-card-title" style={{ marginTop: 2 }}>Puntos & Movimientos</h2>
            </div>
            <Link to="/dashboard/loyalty" className="v3-circle-btn" title="Ver puntos"><ArrowUpRight size={16} /></Link>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "4px 0 14px" }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: "var(--v3-text-primary)" }}>
              {loyaltyLoading || points == null ? "—" : count(points).toLocaleString("es-CL")} pts
            </span>
            <span style={{ fontSize: 12, color: "var(--v3-text-muted)" }}>Saldo disponible</span>
          </div>
          <div className="v3-micro-list">
            {pointMovements.length ? pointMovements.map(t => (
              <div className="v3-micro-item" key={t.key}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 700, margin: 0, color: "var(--v3-text-primary)" }}>{t.label}</p>
                  <p style={{ fontSize: 11, color: "var(--v3-text-muted)", margin: "3px 0 0" }}>{t.date}</p>
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 750, color: t.type === "earn" ? "var(--btn-green)" : "var(--v3-text-primary)" }}>
                  {t.points == null ? "—" : `${t.type === "earn" ? "+" : t.type === "redeem" ? "−" : ""}${Math.abs(t.points).toLocaleString("es-CL")} pts`}
                </span>
              </div>
            )) : <p role="status" style={{ color: "var(--v3-text-muted)", fontSize: 13 }}>{loyaltyLoading ? "Consultando movimientos…" : "Aún no registras movimientos de puntos."}</p>}
          </div>
        </div>

        {/* ====================================================================
            CARD 6B: WHITE BENTO CARD — MARCAS ASOCIADAS (Lumin Ref B & D)
            ==================================================================== */}
        <div className="v3-card" style={{ gridColumn: "span 8" }} data-testid="dash-brands-card">
          <div className="v3-card-header">
            <div>
              <p className="v3-micro-label">EQUIPAMIENTO & MARCAS OFICIALES</p>
              <h2 className="v3-card-title" style={{ marginTop: 2 }}>Marcas en tu Ecosistema</h2>
            </div>
            <Link to="/shop" className="v3-circle-btn" title="Explorar catálogo">
              <ArrowUpRight size={16} />
            </Link>
          </div>

          <p style={{ fontSize: 12, color: "var(--v3-text-muted)", margin: "0 0 14px" }}>
            Marcas disponibles para explorar en el catálogo LevelPro Audio.
          </p>

          <div className="v3-brands-grid">
            {displayBrands.length === 0 && <p role="status" style={{ color: "var(--v3-text-muted)", fontSize: 13 }}>No hay marcas disponibles en el catálogo.</p>}
            {displayBrands.slice(0, 6).map((b) => {
              const brandLogo = b.logo_url || b.logo ? mediaUrl(b.logo_url || b.logo) : null
              return (
                <Link
                  key={b.id || b.name}
                  to={`/shop?brand=${b.slug || encodeURIComponent(b.name)}`}
                  className="v3-brand-pill-card"
                  title={`Ver productos de ${b.name}`}
                >
                  <div className="v3-brand-avatar">
                    {brandLogo ? (
                      <img
                        src={brandLogo}
                        alt={b.name}
                        style={{ maxWidth: "80%", maxHeight: "70%", objectFit: "contain" }}
                      />
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 800, color: "var(--v3-obsidian)" }}>
                        {b.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--v3-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {b.name}
                    </div>
                    <div style={{ fontSize: 10, color: "#1A9D4E", fontWeight: 700, letterSpacing: "0.04em" }}>
                      VER EQUIPOS
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: "var(--v3-text-muted)", opacity: 0.6 }} />
                </Link>
              )
            })}
          </div>
        </div>

        {/* ====================================================================
            CARD 7: WHITE BENTO CARD (FULL WIDTH) — HISTORIAL RECIENTE
            ==================================================================== */}
        <div className="v3-card" style={{ gridColumn: "span 12" }} data-testid="dash-recent">
          <div className="v3-card-header">
            <div>
              <p className="v3-micro-label">TRANSACCIONES Y BENEFICIOS</p>
              <h2 className="v3-card-title" style={{ marginTop: 2 }}>Historial Reciente</h2>
            </div>
            <Link
              to="/dashboard/orders"
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: "var(--btn-green)",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4
              }}
            >
              <span>Ver todas las transacciones</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="v3-micro-list" style={{ marginTop: 4 }}>
            {orders.slice(0, 3).map(o => {
              const status = ORDER_STATUS_MAP[o.status] || { label: "Estado por confirmar", tone: "neutral" }
              const dateValue = o.created_at ? new Date(o.created_at) : null
              const date = dateValue && !Number.isNaN(dateValue.getTime())
                ? new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric" }).format(dateValue)
                : "Fecha no disponible"
              return (
                <Link key={o.id} to={`/dashboard/orders/${o.id}`} className="v3-micro-item" style={{ padding: "12px 6px", textDecoration: "none", color: "inherit" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span className="v3-item-avatar dark"><Package size={17} /></span>
                    <div>
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--v3-text-primary)", margin: 0 }}>{firstOrderItem(o)}</p>
                      <p style={{ fontSize: 11.5, color: "var(--v3-text-muted)", margin: "2px 0 0" }}>
                        Orden #{String(o.id).slice(0, 8).toUpperCase()} · {date}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "var(--v3-text-primary)", minWidth: 90, textAlign: "right" }}>{formatMoney(o.total, o.currency)}</span>
                    <ChevronRight size={15} style={{ color: "var(--v3-text-muted)" }} />
                  </div>
                </Link>
              )
            })}
            {pointMovements.slice(0, 2).map(t => (
              <Link key={t.key} to="/dashboard/loyalty" className="v3-micro-item" style={{ padding: "12px 6px", textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span className="v3-item-avatar accent"><Star size={17} /></span>
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--v3-text-primary)", margin: 0 }}>{t.label}</p>
                    <p style={{ fontSize: 11.5, color: "var(--v3-text-muted)", margin: "2px 0 0" }}>LevelPro Club · {t.date}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "var(--btn-green)" }}>
                    {t.points == null ? "—" : `${t.type === "earn" ? "+" : t.type === "redeem" ? "−" : ""}${Math.abs(t.points).toLocaleString("es-CL")} pts`}
                  </span>
                  <ChevronRight size={15} style={{ color: "var(--v3-text-muted)" }} />
                </div>
              </Link>
            ))}
            {orders.length === 0 && pointMovements.length === 0 && (
              <p role="status" style={{ color: "var(--v3-text-muted)", fontSize: 13 }}>Todavía no hay pedidos ni movimientos de puntos para mostrar.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
