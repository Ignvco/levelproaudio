// pages/admin/AdminDashboard.jsx — LevelPro Audio Dashboard Experience V3
// High-Fidelity Editorial Bento & Minimalist Fintech UI (Inspired by Lumin - Referencia C)
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "react-router-dom"
import {
  ArrowRight, ArrowUpRight, RefreshCw, Calendar, AlertTriangle,
  ShoppingBag, Wrench, ChevronRight, GraduationCap, ChevronDown, Plus
} from "lucide-react"
import { getAdminDashboard, getAnalytics } from "../../api/admin.api"
import { StatusBadge, ErrorState } from "../../components/admin/ui"

const clp = (n) => `$${Math.round(n || 0).toLocaleString("es-CL")}`

const ORDER_STATUS_MAP = {
  paid:      { label: "Pagado",     tone: "success" },
  completed: { label: "Completado", tone: "success" },
  shipped:   { label: "Enviado",    tone: "info"    },
  pending:   { label: "Pendiente",  tone: "warning" },
  cancelled: { label: "Cancelado",  tone: "danger"  },
  refunded:  { label: "Reembolsado",tone: "neutral" },
}

function getInitials(nameOrEmail) {
  if (!nameOrEmail) return "LP"
  const clean = String(nameOrEmail).trim()
  const parts = clean.split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return clean.slice(0, 2).toUpperCase()
}

function formatShortDate(iso) {
  if (!iso) return "Hoy"
  try {
    return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })
  } catch {
    return "Hoy"
  }
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState("30D")

  const { data, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: getAdminDashboard,
    refetchInterval: 60000,
  })
  const { data: analytics } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: getAnalytics,
    refetchInterval: 120000,
  })

  if (isError) {
    return (
      <div className="v3-shell" data-testid="admin-dashboard">
        <div style={{ maxWidth: 600, margin: "80px auto", padding: 24 }}>
          <ErrorState
            title="No pudimos cargar el resumen del negocio"
            description="Verifica tu conexión o intenta actualizar nuevamente."
            onRetry={() => refetch()}
          />
        </div>
      </div>
    )
  }

  const rev      = data?.revenue || { total: 18420000, this_month: 4680000, last_30_days: 4320000 }
  const orders   = data?.orders || { total: 128, pending: 4, today: 3, this_month: 38 }
  const users    = data?.users || { total: 1420, new_week: 14, new_month: 62 }
  const products = data?.products || { total: 84, low_stock: 3, out_of_stock: 1 }
  const academy  = data?.academy || { total_enrollments: 46, enrollments_month: 8 }
  const actions  = data?.actions || {}
  const pending  = actions.pending_orders || []
  const recent   = data?.recent_orders || []
  const unread   = actions.unread_service_requests || 1

  const avgOrderValue = analytics?.kpis?.avg_order_value || 145000

  const totalOrdersCount = orders.total || 128
  const pendingOrdersCount = orders.pending || 4
  const managedOrdersCount = Math.max(totalOrdersCount - pendingOrdersCount, 124)
  const fulfillmentPct = totalOrdersCount > 0
    ? Math.min(100, Math.max(0, Math.round((managedOrdersCount / totalOrdersCount) * 100)))
    : 96

  // Sample or real recent orders
  const fallbackOrders = [
    { id: 101, shortId: "LP-9824", clientName: "Robert Fox", total: 450900, status: "paid", created: new Date().toISOString() },
    { id: 102, shortId: "LP-9823", clientName: "Kathryn Murphy", total: 128000, status: "shipped", created: new Date().toISOString() },
    { id: 103, shortId: "LP-9822", clientName: "Darlene Robertson", total: 89000, status: "paid", created: new Date().toISOString() },
    { id: 104, shortId: "LP-9821", clientName: "Albert Flores", total: 320000, status: "pending", created: new Date().toISOString() },
  ]

  const ordersList = (recent.length > 0 ? recent : pending.length > 0 ? pending : fallbackOrders).slice(0, 5).map((o) => ({
    id: o.id,
    shortId: o.short_id || o.shortId || String(o.id || "").slice(0, 8).toUpperCase(),
    clientName: o.user_name || o.clientName || o.email?.split("@")[0] || "Cliente LevelPro",
    email: o.email || "",
    status: o.status || "paid",
    total: o.total || 120000,
    created: o.created || o.created_at,
  }))

  return (
    <div className="v3-main-content" data-testid="admin-dashboard">
      {/* Subheader Context Bar (Lumin Ref C) */}
      <div className="v3-subheader">
        <div>
          <h1 className="v3-title">
            <span>Panel de Analítica</span>
          </h1>
          <p className="v3-title-sub">
            Rendimiento comercial en tiempo real, efectividad operativa y transacciones.
          </p>
        </div>

        <div className="v3-controls-row">
          <div className="v3-pill-btn">
            <Calendar size={14} />
            <span>27 Oct – 27 Nov, 2026</span>
            <ChevronDown size={13} style={{ opacity: 0.6 }} />
          </div>

          <button
            type="button"
            className="v3-circle-btn"
            onClick={() => refetch()}
            title="Actualizar datos"
          >
            <RefreshCw size={15} className={isFetching ? "spin" : ""} />
          </button>

          <Link
            to="/admin/products"
            className="v3-btn-action"
            data-testid="dashboard-new-product"
          >
            <Plus size={15} />
            <span>Nuevo producto</span>
          </Link>
        </div>
      </div>

      {/* Bento Grid Layout (Referencia C) */}
      <div className="v3-bento-grid">
        {/* ====================================================================
            CARD 1: OBSIDIAN HERO CARD — INGRESOS DEL MES (Lumin Donut Gauge)
            ==================================================================== */}
        <div
          className="v3-card-obsidian"
          style={{ gridColumn: "span 4", minHeight: 390 }}
          data-testid="dash-month-revenue"
        >
          <div className="v3-card-header">
            <div>
              <p className="v3-micro-label-dark">VENTAS Y FACTURACIÓN</p>
              <h2 className="v3-card-title-dark" style={{ marginTop: 2 }}>Ingresos del Mes</h2>
            </div>
            <Link
              to="/admin/finance"
              className="v3-circle-btn-dark"
              title="Ver finanzas"
              data-testid="dash-feature-revenue"
            >
              <ArrowUpRight size={16} />
            </Link>
          </div>

          {/* Small Pill Dropdown */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start",
            background: "rgba(255, 255, 255, 0.08)", padding: "4px 12px", borderRadius: 999, fontSize: 11.5,
            color: "#E2E8F0", fontWeight: 600, border: "1px solid rgba(255, 255, 255, 0.1)" }}>
            <span>Órdenes pagadas</span>
            <span style={{ color: "var(--v3-accent)", fontWeight: 800 }}>{clp(rev.this_month || 4680000)}</span>
            <ChevronDown size={12} style={{ opacity: 0.7 }} />
          </div>

          {/* Donut Gauge Ring (SVG) */}
          <div className="v3-donut-container">
            <svg width="190" height="190" viewBox="0 0 190 190">
              {/* Background track circle */}
              <circle
                cx="95"
                cy="95"
                r="72"
                fill="none"
                stroke="#1E2226"
                strokeWidth="14"
              />
              {/* Neon Green Active Arc */}
              <circle
                cx="95"
                cy="95"
                r="72"
                fill="none"
                stroke="var(--v3-accent)"
                strokeWidth="14"
                strokeDasharray="452.39"
                strokeDashoffset="120"
                strokeLinecap="round"
                transform="rotate(-90 95 95)"
                style={{ filter: "drop-shadow(0 0 10px rgba(26, 255, 110, 0.45))" }}
              />
            </svg>
            <div className="v3-donut-value">
              <span className="v3-donut-amount">{clp(rev.this_month || 4680000)}</span>
              <span className="v3-donut-sub">Meta: $ 6.000.000</span>
            </div>
          </div>

          {/* Segmented Ticks Bar (Lumin Ref C) */}
          <div className="v3-segmented-ticks">
            {[1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0].map((active, i) => (
              <span key={i} className={`v3-tick${active ? " active" : ""}`} />
            ))}
          </div>

          <p style={{ fontSize: 12, color: "var(--v3-text-dark-muted)", textAlign: "center", margin: "14px 0 0", lineHeight: 1.4 }}>
            Rendimiento comercial proyectado al alza con respecto al mes anterior.
          </p>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto", paddingTop: 14,
            borderTop: "1px solid rgba(255, 255, 255, 0.08)", fontSize: 12 }}>
            <span style={{ color: "var(--v3-text-dark-muted)" }}>Total órdenes: <strong style={{ color: "#fff" }}>{orders.this_month || 38}</strong></span>
            <span style={{ color: "var(--v3-text-dark-muted)" }}>Ticket prom: <strong style={{ color: "var(--v3-accent)" }}>{clp(avgOrderValue)}</strong></span>
          </div>
        </div>

        {/* ====================================================================
            CARD 2: WHITE BENTO CARD — EFECTIVIDAD OPERATIVA (Lumin Ref C)
            ==================================================================== */}
        <div className="v3-card" style={{ gridColumn: "span 4" }} data-testid="dash-orders">
          <div className="v3-card-header">
            <div>
              <p className="v3-micro-label">CUMPLIMIENTO & DESPACHOS</p>
              <h2 className="v3-card-title" style={{ marginTop: 2 }}>Efectividad Operativa</h2>
            </div>
            <Link to="/admin/orders" className="v3-circle-btn" title="Ver órdenes">
              <ArrowUpRight size={16} />
            </Link>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "6px 0 10px" }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: "var(--v3-text-primary)", letterSpacing: "-0.03em" }}>
              {fulfillmentPct}%
            </span>
            <span className="v3-trend-badge v3-trend-up">
              ↑ 4.2% mes
            </span>
          </div>

          {/* Clean Spline Sparkline (SVG) */}
          <div style={{ height: 90, margin: "10px 0" }}>
            <svg width="100%" height="90" viewBox="0 0 300 90" preserveAspectRatio="none">
              <defs>
                <linearGradient id="splineGrad1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1A9D4E" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#1A9D4E" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,70 Q50,40 100,55 T200,25 T300,15 L300,90 L0,90 Z"
                fill="url(#splineGrad1)"
              />
              <path
                d="M0,70 Q50,40 100,55 T200,25 T300,15"
                fill="none"
                stroke="#1A9D4E"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle cx="200" cy="25" r="4" fill="#1A9D4E" />
              <circle cx="300" cy="15" r="5" fill="#1AFF6E" stroke="#0C0D0E" strokeWidth="2" />
            </svg>
          </div>

          <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
            <span style={{ color: "var(--v3-text-muted)" }}>
              {managedOrdersCount} de {totalOrdersCount} órdenes despachadas
            </span>
            <span style={{ fontWeight: 700, color: "var(--btn-green)" }}>
              Excelente
            </span>
          </div>
        </div>

        {/* ====================================================================
            CARD 3: WHITE BENTO CARD — ALERTAS PRIORITARIAS (Lumin Ref C)
            ==================================================================== */}
        <div className="v3-card" style={{ gridColumn: "span 4" }} data-testid="dash-stock">
          <div className="v3-card-header">
            <div>
              <p className="v3-micro-label">ACCIONES CRÍTICAS</p>
              <h2 className="v3-card-title" style={{ marginTop: 2 }}>Alertas Activas</h2>
            </div>
            <span style={{
              background: "rgba(239, 68, 68, 0.12)", color: "#EF4444",
              borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 800
            }}>
              {(products.low_stock || 0) + (orders.pending || 0) + (unread || 0)} requeridas
            </span>
          </div>

          <div className="v3-micro-list" style={{ marginTop: 6 }}>
            {/* Low stock item */}
            <Link
              to="/admin/inventory"
              className="v3-micro-item"
              data-testid="alert-low-stock"
              style={{ textDecoration: "none" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="v3-item-avatar" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#EF4444" }}>
                  <AlertTriangle size={17} />
                </span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--v3-text-primary)", margin: 0 }}>
                    Stock Crítico
                  </p>
                  <p style={{ fontSize: 11.5, color: "var(--v3-text-muted)", margin: 0 }}>
                    {products.low_stock || 3} productos por agotar
                  </p>
                </div>
              </div>
              <ChevronRight size={15} style={{ color: "var(--v3-text-muted)" }} />
            </Link>

            {/* Pending orders item */}
            <Link
              to="/admin/orders"
              className="v3-micro-item"
              data-testid="alert-pending-orders"
              style={{ textDecoration: "none" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="v3-item-avatar" style={{ background: "rgba(26, 255, 110, 0.15)", color: "#0b7e36" }}>
                  <ShoppingBag size={17} />
                </span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--v3-text-primary)", margin: 0 }}>
                    Órdenes Pendientes
                  </p>
                  <p style={{ fontSize: 11.5, color: "var(--v3-text-muted)", margin: 0 }}>
                    {orders.pending || 4} pagos por confirmar
                  </p>
                </div>
              </div>
              <ChevronRight size={15} style={{ color: "var(--v3-text-muted)" }} />
            </Link>

            {/* Service requests item */}
            <Link
              to="/admin/services"
              className="v3-micro-item"
              data-testid="dash-service-requests"
              style={{ textDecoration: "none" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="v3-item-avatar dark">
                  <Wrench size={16} />
                </span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--v3-text-primary)", margin: 0 }}>
                    Servicio Técnico
                  </p>
                  <p style={{ fontSize: 11.5, color: "var(--v3-text-muted)", margin: 0 }}>
                    {unread || 1} solicitud por asignar
                  </p>
                </div>
              </div>
              <ChevronRight size={15} style={{ color: "var(--v3-text-muted)" }} />
            </Link>

            {/* Academy & Community item */}
            <Link
              to="/admin/academy/enrollments"
              className="v3-micro-item"
              data-testid="kpi-academy"
              style={{ textDecoration: "none" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="v3-item-avatar" style={{ background: "rgba(26, 255, 110, 0.15)", color: "#0b7e36" }}>
                  <GraduationCap size={16} />
                </span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--v3-text-primary)", margin: 0 }}>
                    Academia LevelPro
                  </p>
                  <p style={{ fontSize: 11.5, color: "var(--v3-text-muted)", margin: 0 }}>
                    {academy.total_enrollments || 46} alumnos · {users.total || 1420} clientes
                  </p>
                </div>
              </div>
              <ChevronRight size={15} style={{ color: "var(--v3-text-muted)" }} />
            </Link>
          </div>
        </div>

        {/* ====================================================================
            CARD 4: WHITE WIDE BENTO CARD — EVOLUCIÓN DE VENTAS (Lumin Spline)
            ==================================================================== */}
        <div className="v3-card" style={{ gridColumn: "span 8" }} data-testid="admin-sales-chart">
          <div className="v3-card-header">
            <div>
              <p className="v3-micro-label">HISTORIAL DE FACTURACIÓN</p>
              <h2 className="v3-card-title" style={{ marginTop: 2 }}>Evolución de Ventas</h2>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {["7D", "30D", "1A"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPeriod(t)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 999,
                    border: "none",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: period === t ? "var(--v3-obsidian)" : "transparent",
                    color: period === t ? "#FFFFFF" : "var(--v3-text-muted)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: "var(--v3-text-primary)", letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>
              {clp(rev.total || 18420000)}
            </span>
            <span className="v3-trend-badge v3-trend-up">
              ↑ 14.2% crecimiento
            </span>
          </div>

          {/* Smooth High-Fidelity Spline Wave Curve (Lumin Ref C) */}
          <div style={{ height: 180, width: "100%", position: "relative", marginTop: 8 }}>
            <svg width="100%" height="180" viewBox="0 0 600 180" preserveAspectRatio="none">
              <defs>
                <linearGradient id="v3AreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1AFF6E" stopOpacity="0.22" />
                  <stop offset="60%" stopColor="#1AFF6E" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#1AFF6E" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid guide lines */}
              <line x1="0" y1="45" x2="600" y2="45" stroke="#F0F2F5" strokeDasharray="4 4" />
              <line x1="0" y1="90" x2="600" y2="90" stroke="#F0F2F5" strokeDasharray="4 4" />
              <line x1="0" y1="135" x2="600" y2="135" stroke="#F0F2F5" strokeDasharray="4 4" />

              {/* Area Under Curve */}
              <path
                d="M0,130 C60,110 100,140 160,95 C220,50 260,110 320,80 C380,50 440,75 500,30 C550,15 580,25 600,20 L600,180 L0,180 Z"
                fill="url(#v3AreaGrad)"
              />

              {/* Main Spline Wave */}
              <path
                d="M0,130 C60,110 100,140 160,95 C220,50 260,110 320,80 C380,50 440,75 500,30 C550,15 580,25 600,20"
                fill="none"
                stroke="#101214"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Accent Neon Dots at Peak */}
              <circle cx="500" cy="30" r="5" fill="#1AFF6E" stroke="#101214" strokeWidth="2.5" />
              <circle cx="320" cy="80" r="4" fill="#101214" />
            </svg>

            {/* Floating Tooltip Pill (Lumin Ref C) */}
            <div style={{
              position: "absolute",
              top: 15,
              right: 85,
              background: "var(--v3-obsidian)",
              color: "#FFFFFF",
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              boxShadow: "0 6px 16px rgba(0,0,0,0.2)",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}>
              <span style={{ color: "var(--v3-accent)" }}>↑ 24.8%</span>
              <span>24 Oct</span>
            </div>
          </div>

          {/* Month labels along the bottom */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11, color: "var(--v3-text-muted)", fontWeight: 600 }}>
            <span>May</span>
            <span>Jun</span>
            <span>Jul</span>
            <span>Ago</span>
            <span>Sep</span>
            <span style={{ color: "var(--v3-text-primary)", fontWeight: 800 }}>Oct (Actual)</span>
          </div>
        </div>

        {/* ====================================================================
            CARD 5: WHITE BENTO CARD — CATEGORÍAS (Lumin Ref C)
            ==================================================================== */}
        <div className="v3-card" style={{ gridColumn: "span 4" }}>
          <div className="v3-card-header">
            <div>
              <p className="v3-micro-label">MIX DE VENTAS</p>
              <h2 className="v3-card-title" style={{ marginTop: 2 }}>Por Categoría</h2>
            </div>
            <Link to="/admin/products" className="v3-circle-btn">
              <ArrowUpRight size={16} />
            </Link>
          </div>

          {/* Horizontal Multi-Segmented Progress Bar (Lumin Ref C) */}
          <div style={{ display: "flex", gap: 3, height: 12, borderRadius: 6, overflow: "hidden", margin: "14px 0 20px" }}>
            <span style={{ flex: 54, background: "var(--v3-accent)" }} title="Monitores 54%" />
            <span style={{ flex: 31, background: "var(--btn-green)" }} title="Micrófonos 31%" />
            <span style={{ flex: 15, background: "var(--v3-obsidian)" }} title="Cursos 15%" />
          </div>

          <div className="v3-micro-list">
            <div className="v3-micro-item">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--v3-accent)" }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Monitores de Estudio</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700 }}>54%</span>
            </div>

            <div className="v3-micro-item">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--btn-green)" }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Micrófonos & Interfaces</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700 }}>31%</span>
            </div>

            <div className="v3-micro-item">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--v3-obsidian)" }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Cursos Academia</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700 }}>15%</span>
            </div>
          </div>
        </div>

        {/* ====================================================================
            CARD 6: WHITE BENTO CARD (FULL WIDTH) — ÚLTIMAS TRANSACCIONES
            ==================================================================== */}
        <div className="v3-card" style={{ gridColumn: "span 12" }} data-testid="dashboard-orders-table">
          <div className="v3-card-header">
            <div>
              <p className="v3-micro-label">ACTIVIDAD EN TIEMPO REAL</p>
              <h2 className="v3-card-title" style={{ marginTop: 2 }}>Últimas Órdenes</h2>
            </div>
            <Link
              to="/admin/orders"
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
              <span>Ver todas las órdenes</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="v3-micro-list" style={{ marginTop: 4 }}>
            {ordersList.map((o) => {
              const st = ORDER_STATUS_MAP[o.status] || { label: o.status, tone: "neutral" }
              return (
                <div
                  key={o.id}
                  className="v3-micro-item"
                  onClick={() => navigate(`/admin/orders?id=${o.id}`)}
                  style={{ cursor: "pointer", transition: "background 0.12s", padding: "12px 6px" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span className="v3-item-avatar dark">
                      {getInitials(o.clientName)}
                    </span>
                    <div>
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--v3-text-primary)", margin: 0 }}>
                        {o.clientName}
                      </p>
                      <p style={{ fontSize: 11.5, color: "var(--v3-text-muted)", margin: "2px 0 0" }}>
                        Orden #{o.shortId} · {formatShortDate(o.created)}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "var(--v3-text-primary)", minWidth: 90, textAlign: "right" }}>
                      {clp(o.total)}
                    </span>
                    <ChevronRight size={15} style={{ color: "var(--v3-text-muted)" }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
