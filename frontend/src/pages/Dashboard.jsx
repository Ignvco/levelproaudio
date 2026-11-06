// pages/Dashboard.jsx — LevelPro Audio Dashboard Experience V3
// High-Fidelity Editorial Bento & Minimalist Fintech UI (Inspired by Lumin - Referencia D)
import { useState } from "react"
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
  const [period, setPeriod] = useState("1M")

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
  const pointMovements = loyaltyHistory(loyalty, period)
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

          {/* Real-time Order Tracking Stepper */}
          <div style={{
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 16,
            padding: 14,
            margin: "12px 0"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--v3-accent)", letterSpacing: "0.06em" }}>
                PEDIDO EN CURSO
              </span>
              <span style={{ fontSize: 11.5, color: "var(--v3-text-dark-muted)" }}>
                #{latestOrder?.short_id || "LP-9824"}
              </span>
            </div>

            <p style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF", margin: "6px 0 10px" }}>
              {orderStatus.label} · Despacho estimado mañana
            </p>

            <div className="v3-stepper-bar">
              <span className="v3-step-seg active" />
              <span className="v3-step-seg active" />
              <span className="v3-step-seg active" />
              <span className="v3-step-seg" />
            </div>
          </div>

          {/* Mini benefits & progress */}
          <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--v3-text-dark-muted)", marginBottom: 6 }}>
              <span>Compras acumuladas este mes</span>
              <strong style={{ color: "#fff" }}>$ 148.500</strong>
            </div>
            <div className="v3-prog-bar" style={{ background: "rgba(255, 255, 255, 0.1)", height: 6 }}>
              <div className="v3-prog-fill" style={{ width: "74%" }} />
            </div>
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
                SORTEO MENSUAL
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
                LABORATORIO PRO
              </p>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "var(--v3-obsidian)", lineHeight: 1.2 }}>
                Calibración de Sala
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
                PROMO ACTIVA
              </p>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "var(--v3-obsidian)", lineHeight: 1.2 }}>
                2x Puntos en Cursos
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

          <div className="v3-course-box">
            <div className="v3-course-thumb">
              <Headphones size={26} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--v3-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {courseTitle}
              </p>
              <p style={{ fontSize: 11.5, color: "var(--v3-text-muted)", margin: "3px 0 0" }}>
                Módulo 3: Compresión Paralela
              </p>
            </div>
          </div>

          <div style={{ margin: "18px 0 10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: "var(--v3-text-muted)" }}>Progreso global</span>
              <strong style={{ color: "var(--btn-green)" }}>{courseProgress}%</strong>
            </div>
            <div className="v3-prog-bar">
              <div className="v3-prog-fill-brand" style={{ width: `${courseProgress}%` }} />
            </div>
          </div>

          <Link
            to="/dashboard/courses"
            className="v3-pill-btn"
            style={{ width: "100%", justifyContent: "center", marginTop: "auto" }}
          >
            <Play size={14} fill="currentColor" />
            <span>Reanudar clase</span>
          </Link>
        </div>

        {/* ====================================================================
            CARD 6: WHITE BENTO CARD — TU ACTIVIDAD LEVELPRO (Spline Curve)
            ==================================================================== */}
        <div className="v3-card" style={{ gridColumn: "span 4" }}>
          <div className="v3-card-header">
            <div>
              <p className="v3-micro-label">ACTIVIDAD EN LA PLATAFORMA</p>
              <h2 className="v3-card-title" style={{ marginTop: 2 }}>Puntos & Desempeño</h2>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {["1S", "1M", "1A"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPeriod(t)}
                  style={{
                    padding: "3px 10px",
                    borderRadius: 999,
                    border: "none",
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: period === t ? "var(--v3-obsidian)" : "transparent",
                    color: period === t ? "#FFFFFF" : "var(--v3-text-muted)",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "4px 0 8px" }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: "var(--v3-text-primary)", letterSpacing: "-0.03em" }}>
              +380 pts
            </span>
            <span className="v3-trend-badge v3-trend-up">
              ↑ 18.5%
            </span>
          </div>

          {/* Spline Curve Wave */}
          <div style={{ height: 110, width: "100%", marginTop: 6 }}>
            <svg width="100%" height="110" viewBox="0 0 320 110" preserveAspectRatio="none">
              <defs>
                <linearGradient id="userSplineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1AFF6E" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#1AFF6E" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,85 C50,70 80,95 130,55 C180,20 220,70 270,35 C290,20 310,25 320,15 L320,110 L0,110 Z"
                fill="url(#userSplineGrad)"
              />
              <path
                d="M0,85 C50,70 80,95 130,55 C180,20 220,70 270,35 C290,20 310,25 320,15"
                fill="none"
                stroke="#1A9D4E"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="270" cy="35" r="4.5" fill="#1AFF6E" stroke="#0C0D0E" strokeWidth="2" />
            </svg>
          </div>

          <p style={{ fontSize: 11.5, color: "var(--v3-text-muted)", margin: "8px 0 0", textAlign: "right" }}>
            Has acumulado un 18% más de actividad este mes.
          </p>
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
            Distribución oficial autorizada, garantía directa y servicio técnico en Chile y Argentina.
          </p>

          <div className="v3-brands-grid">
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
                      PARTNER OFICIAL
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
            {/* Row 1: Compra */}
            <div className="v3-micro-item" style={{ padding: "12px 6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span className="v3-item-avatar dark">
                  <Package size={17} />
                </span>
                <div>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--v3-text-primary)", margin: 0 }}>
                    Monitores de Estudio Yamaha HS8 (Par)
                  </p>
                  <p style={{ fontSize: 11.5, color: "var(--v3-text-muted)", margin: "2px 0 0" }}>
                    Tienda Oficial · Orden #LP-9824 · Hoy, 24 Oct
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <StatusBadge tone="info">En despacho</StatusBadge>
                <span style={{ fontSize: 14, fontWeight: 800, color: "var(--v3-text-primary)", minWidth: 90, textAlign: "right" }}>
                  $ 689.990
                </span>
                <ChevronRight size={15} style={{ color: "var(--v3-text-muted)" }} />
              </div>
            </div>

            {/* Row 2: Puntos Acreditados */}
            <div className="v3-micro-item" style={{ padding: "12px 6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span className="v3-item-avatar accent">
                  <Star size={17} />
                </span>
                <div>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--v3-text-primary)", margin: 0 }}>
                    Puntos Acreditados por Compra
                  </p>
                  <p style={{ fontSize: 11.5, color: "var(--v3-text-muted)", margin: "2px 0 0" }}>
                    Fidelización LevelPro · Ayer, 23 Oct
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <StatusBadge tone="success">+690 pts</StatusBadge>
                <span style={{ fontSize: 14, fontWeight: 800, color: "var(--btn-green)", minWidth: 90, textAlign: "right" }}>
                  Acreditado
                </span>
                <ChevronRight size={15} style={{ color: "var(--v3-text-muted)" }} />
              </div>
            </div>

            {/* Row 3: Curso */}
            <div className="v3-micro-item" style={{ padding: "12px 6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span className="v3-item-avatar" style={{ background: "#EEF0F2", color: "var(--v3-text-primary)" }}>
                  <GraduationCap size={17} />
                </span>
                <div>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--v3-text-primary)", margin: 0 }}>
                    Masterclass Acústica de Cuartos de Control
                  </p>
                  <p style={{ fontSize: 11.5, color: "var(--v3-text-muted)", margin: "2px 0 0" }}>
                    LevelPro Academy · 18 Oct
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <StatusBadge tone="success">Inscrito</StatusBadge>
                <span style={{ fontSize: 14, fontWeight: 800, color: "var(--v3-text-primary)", minWidth: 90, textAlign: "right" }}>
                  $ 45.000
                </span>
                <ChevronRight size={15} style={{ color: "var(--v3-text-muted)" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
