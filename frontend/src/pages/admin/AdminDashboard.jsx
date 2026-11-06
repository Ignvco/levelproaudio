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
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts"
import AccountingCurrencySelect from "../../components/admin/ui/AccountingCurrencySelect"
import { formatCurrency } from "../../utils/accountingCurrency"
import {
  adminRecentOrders, adminFulfillment, adminCategoryMix, adminSalesSeries,
  monthlyShare, count,
} from "../dashboard/dashboardV3Data"


const ORDER_STATUS_MAP = {
  paid:      { label: "Pagado",     tone: "success" },
  completed: { label: "Completado", tone: "success" },
  shipped:   { label: "Enviado",    tone: "info"    },
  pending:   { label: "Pendiente",  tone: "warning" },
  cancelled: { label: "Cancelado",  tone: "danger"  },
  refunded:  { label: "Reembolsado",tone: "neutral" },
  unknown:   { label: "Sin estado", tone: "neutral" },
}

function getInitials(nameOrEmail) {
  if (!nameOrEmail) return "LP"
  const clean = String(nameOrEmail).trim()
  const parts = clean.split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return clean.slice(0, 2).toUpperCase()
}

function formatShortDate(iso) {
  if (!iso) return "—"
  try {
    const parsed = new Date(iso)
    return Number.isNaN(parsed.getTime()) ? String(iso).slice(0, 16) : parsed.toLocaleDateString("es-CL", { day: "2-digit", month: "short" })
  } catch {
    return "—"
  }
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState("30D")
  const [currency, setCurrency] = useState("CLP")
  const clp = (n) => formatCurrency(n, currency)

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin-dashboard", currency],
    queryFn: () => getAdminDashboard(currency),
    refetchInterval: 60000,
  })
  const { data: analytics } = useQuery({
    queryKey: ["admin-analytics", currency],
    queryFn: () => getAnalytics(currency),
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

  if (isPending || !data) {
    return <div className="v3-main-content" data-testid="admin-dashboard"><div className="v3-card" role="status">Cargando información real del negocio…</div></div>
  }

  const rev      = data.revenue || {}
  const orders   = data.orders || {}
  const users    = data.users || {}
  const products = data.products || {}
  const academy  = data.academy || {}
  const actions  = data.actions || {}
  const unread   = count(actions.unread_service_requests)
  const avgOrderValue = analytics?.kpis?.avg_order_value
  const fulfillment = adminFulfillment(analytics, orders.total)
  const fulfillmentPct = fulfillment?.percentage ?? 0
  const share = monthlyShare(rev)
  const ordersList = adminRecentOrders(data)
  const salesSeries = adminSalesSeries(data, analytics, period)
  const categoryMix = adminCategoryMix(analytics)
  const monthLabel = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(new Date())

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
          <div className="v3-pill-btn" aria-label="Mes informado">
            <Calendar size={14} />
            <span>{monthLabel}</span>
          </div>
          <AccountingCurrencySelect id="admin-dashboard-currency" value={currency} onChange={setCurrency} />

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
            <span>Ventas pagadas del mes</span>
            <span style={{ color: "var(--v3-accent)", fontWeight: 800 }}>{clp(rev.this_month)}</span>
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
                strokeDashoffset={452.39 * (1 - share / 100)}
                strokeLinecap="round"
                transform="rotate(-90 95 95)"
                style={{ filter: "drop-shadow(0 0 10px rgba(26, 255, 110, 0.45))" }}
              />
            </svg>
            <div className="v3-donut-value">
              <span className="v3-donut-amount">{clp(rev.this_month)}</span>
              <span className="v3-donut-sub">{share}% del total registrado</span>
            </div>
          </div>

          {/* Segmented Ticks Bar (Lumin Ref C) */}
          <div className="v3-segmented-ticks">
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} className={`v3-tick${i < Math.round(share / 100 * 12) ? " active" : ""}`} />
            ))}
          </div>

          <p style={{ fontSize: 12, color: "var(--v3-text-dark-muted)", textAlign: "center", margin: "14px 0 0", lineHeight: 1.4 }}>
            Participación del mes en los ingresos históricos registrados. Sin meta de ventas configurada.
          </p>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto", paddingTop: 14,
            borderTop: "1px solid rgba(255, 255, 255, 0.08)", fontSize: 12 }}>
            <span style={{ color: "var(--v3-text-dark-muted)" }}>Total órdenes: <strong style={{ color: "#fff" }}>{count(orders.this_month)}</strong></span>
            <span style={{ color: "var(--v3-text-dark-muted)" }}>Ticket prom: <strong style={{ color: "var(--v3-accent)" }}>{(avgOrderValue == null ? "Sin datos" : clp(avgOrderValue))}</strong></span>
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
              {fulfillment ? `${fulfillmentPct}%` : "—"}
            </span>
            <span className="v3-trend-badge v3-trend-up">
              {fulfillment ? "Órdenes enviadas/completadas" : "Consultando estados"}
            </span>
          </div>

          <div style={{ height: 90, margin: "10px 0", display: "flex", alignItems: "center" }} aria-label="Porcentaje de órdenes enviadas o completadas">
            <div className="v3-prog-bar" style={{ width: "100%", height: 12 }}>
              <div className="v3-prog-fill-brand" style={{ width: `${fulfillmentPct}%` }} />
            </div>
          </div>

          <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
            <span style={{ color: "var(--v3-text-muted)" }}>
              {fulfillment ? `${fulfillment.managed} de ${fulfillment.total} órdenes enviadas o completadas` : "Sin desglose de estados disponible"}
            </span>
            <span style={{ fontWeight: 700, color: "var(--btn-green)" }}>
              {fulfillment && fulfillment.total > 0 ? `${fulfillmentPct}%` : "Sin datos"}
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
              {count(products.low_stock) + count(orders.pending) + unread} requeridas
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
                    {count(products.low_stock)} productos por agotar
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
                    {count(orders.pending)} pagos por confirmar
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
                    {unread} solicitud por asignar
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
                    {count(academy.total_enrollments)} alumnos · {count(users.total)} clientes
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
              {clp(rev.total)}
            </span>
            <span className="v3-trend-badge">Serie de operaciones pagadas · {period}</span>
          </div>

          {/* Series reales recibidas de dashboard/analytics; sin curvas ilustrativas. */}
          <div style={{ height: 180, width: "100%", marginTop: 8 }} role="img" aria-label={salesSeries.length ? `Ventas registradas: ${period}` : "Sin ventas registradas para este período"}>
            {salesSeries.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesSeries} margin={{ top: 10, left: 0, right: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="v3RealSalesArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1AFF6E" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#1AFF6E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#7D858E" }} axisLine={false} tickLine={false} minTickGap={18} />
                  <Tooltip formatter={value => [clp(value), "Ventas"]} contentStyle={{ background: "#101214", border: "none", color: "#fff", borderRadius: 14 }} />
                  <Area type="monotone" dataKey="total" stroke="#101214" strokeWidth={2.5} fill="url(#v3RealSalesArea)" activeDot={{ r: 5, fill: "#1AFF6E" }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--v3-text-muted)", fontSize: 13 }}>
                Sin operaciones pagadas en el período seleccionado
              </div>
            )}
          </div>

          <p style={{ color: "var(--v3-text-muted)", fontSize: 11, marginTop: 8 }}>
            {period === "1A" ? "Datos agregados por mes" : "Datos agregados por día"} · Fuente: órdenes pagadas
          </p>
        </div>

        {/* ====================================================================
            CARD 5: WHITE BENTO CARD — CATEGORÍAS (Lumin Ref C)
            ==================================================================== */}
        <div className="v3-card" style={{ gridColumn: "span 4" }}>
          <div className="v3-card-header">
            <div>
              <p className="v3-micro-label">MIX DE VENTAS</p>
              <h2 className="v3-card-title" style={{ marginTop: 2 }}>Unidades por Categoría</h2>
            </div>
            <Link to="/admin/products" className="v3-circle-btn">
              <ArrowUpRight size={16} />
            </Link>
          </div>

          {categoryMix.length ? (
            <>
              <div style={{ display: "flex", gap: 3, height: 12, borderRadius: 6, overflow: "hidden", margin: "14px 0 20px", background: "var(--v3-surface-soft)" }}>
                {categoryMix.map((cat, i) => (
                  <span key={cat.name} style={{ width: `${cat.percentage}%`, flexShrink: 0 }} title={`${cat.name} ${cat.percentage.toFixed(1)}%`}
                    aria-label={`${cat.name}: ${cat.percentage.toFixed(1)}%`}
                    data-testid={`v3-category-segment-${i}`}
                  >
                    <span style={{ display: "block", width: "100%", height: "100%", background: ["var(--v3-accent)", "var(--btn-green)", "var(--v3-obsidian)"][i] }} />
                  </span>
                ))}
              </div>
              <div className="v3-micro-list">
                {categoryMix.map((cat, i) => (
                  <div key={cat.name} className="v3-micro-item">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: ["var(--v3-accent)", "var(--btn-green)", "var(--v3-obsidian)"][i] }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{cat.name}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{cat.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p style={{ color: "var(--v3-text-muted)", fontSize: 13, marginTop: 20 }}>Sin ventas categorizadas disponibles</p>}

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
            {ordersList.length === 0 && <p role="status" style={{ color: "var(--v3-text-muted)", fontSize: 13 }}>Todavía no hay órdenes registradas.</p>}
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
                      {o.total == null ? "—" : o.currency ? formatCurrency(o.total, o.currency) : `${new Intl.NumberFormat("es-CL").format(o.total)} (moneda no indicada)`}
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
