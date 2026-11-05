// pages/admin/AdminDashboard.jsx — Dashboard Experience V2 (Admin Home)
// Composición aprobada LevelPro Audio: header ejecutivo, barra de contexto,
// 4 KPIs (ink, primary, light, light), gráfico de rendimiento comercial +
// efectividad operativa del mes, tabla de últimas órdenes y alertas operativas.
// 100% conectado a datos reales (getAdminDashboard, getAnalytics).
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "react-router-dom"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts"
import {
  Wallet, ShoppingBag, Users, Package, Clock, ArrowRight, ArrowUpRight,
  RefreshCw, Calendar, AlertTriangle, Wrench, ChevronRight, GraduationCap,
} from "lucide-react"
import { getAdminDashboard, getAnalytics } from "../../api/admin.api"
import {
  AdminPageHeader, StatCard, ChartCard,
  StatusBadge, SecondaryButton, EmptyState, ErrorState,
} from "../../components/admin/ui"
import Button from "../../components/ui/Button"

const clp = (n) => `$ ${Math.round(n || 0).toLocaleString("es-CL")}`

const ORDER_STATUS_MAP = {
  paid:      { label: "Pagado",     tone: "success" },
  completed: { label: "Completado", tone: "success" },
  shipped:   { label: "Enviado",    tone: "info"    },
  pending:   { label: "Pendiente",  tone: "warning" },
  cancelled: { label: "Cancelado",  tone: "danger"  },
  refunded:  { label: "Reembolsado",tone: "neutral" },
}

/* ── Tooltip del gráfico de barras ───────────────────────────────── */
function SalesTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: "#101112", color: "#fff", padding: "10px 14px",
      borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.25)",
    }}>
      <p style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 800, color: "#1AFF6E" }}>{clp(payload[0].value)}</p>
    </div>
  )
}

/* ── Gráfico central de barras (Rendimiento comercial) ───────────── */
function SalesBars({ dailyData, monthlyData, period }) {
  const fmtDay = (d) => {
    try {
      return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })
    } catch {
      return d
    }
  }
  const fmtMonth = (m) => {
    try {
      return new Date(m).toLocaleDateString("es-CL", { month: "short" })
    } catch {
      return m
    }
  }

  const points = period === "annual" && Array.isArray(monthlyData) && monthlyData.length > 0
    ? monthlyData.slice(-12).map((d) => ({ label: fmtMonth(d.month), total: d.total || 0 }))
    : (dailyData || []).slice(-12).map((d) => ({ label: fmtDay(d.date), total: d.total || 0 }))

  const max = Math.max(...points.map((p) => p.total), 1)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={points} margin={{ top: 12, right: 6, left: -16, bottom: 0 }} barCategoryGap="24%">
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#EBEFF2" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10.5, fill: "#98A2B3", fontWeight: 600 }}
          interval="preserveStartEnd"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={50}
          tick={{ fontSize: 10.5, fill: "#98A2B3" }}
          tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
        />
        <Tooltip cursor={{ fill: "rgba(26,255,110,0.06)" }} content={<SalesTooltip />} />
        <Bar dataKey="total" isAnimationActive={false} radius={[8, 8, 4, 4]} maxBarSize={36}>
          {points.map((p, i) => (
            <Cell
              key={i}
              fill={p.total >= max * 0.75 ? "#1A9D4E" : p.total >= max * 0.35 ? "#95CDA9" : "#D7E2DB"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
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
    return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })
  } catch {
    return "—"
  }
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState("monthly")

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin-dashboard"], queryFn: getAdminDashboard, refetchInterval: 60000,
  })
  const { data: analytics } = useQuery({
    queryKey: ["admin-analytics"], queryFn: getAnalytics, refetchInterval: 120000,
  })

  if (isError) {
    return (
      <div className="au-page" data-testid="admin-dashboard">
        <ErrorState
          title="No pudimos cargar el resumen del negocio"
          description="Verifica tu conexión o intenta actualizar nuevamente."
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  const rev      = data?.revenue || {}
  const orders   = data?.orders || {}
  const users    = data?.users || {}
  const products = data?.products || {}
  const academy  = data?.academy || {}
  const chart    = data?.sales_chart || []
  const actions  = data?.actions || {}
  const pending  = actions.pending_orders || []
  const recent   = data?.recent_orders || []
  const unread   = actions.unread_service_requests || 0

  const monthlySeries = analytics?.sales_by_month || []
  const avgOrderValue = analytics?.kpis?.avg_order_value || 0

  const activeProducts = Math.max(
    (products.total || 0) - (products.out_of_stock || 0) - (products.low_stock || 0),
    0
  )

  // Porcentaje real de órdenes gestionadas (confirmadas/completadas sobre total)
  const totalOrdersCount = orders.total || 0
  const pendingOrdersCount = orders.pending || 0
  const managedOrdersCount = Math.max(totalOrdersCount - pendingOrdersCount, 0)
  const fulfillmentPct = totalOrdersCount > 0
    ? Math.min(100, Math.max(0, Math.round((managedOrdersCount / totalOrdersCount) * 100)))
    : 0

  // Lista de órdenes para la tabla inferior: prioriza recent_orders reales o pending_orders
  const ordersList = (recent.length > 0 ? recent : pending).slice(0, 5).map((o) => ({
    id: o.id,
    shortId: o.short_id || String(o.id || "").slice(0, 8).toUpperCase(),
    clientName: o.user_name || o.email?.split("@")[0] || "Cliente",
    email: o.email || "",
    status: o.status || "pending",
    total: o.total || 0,
    created: o.created || o.created_at,
  }))

  const currentMonthLabel = new Date().toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
  })
  const formattedMonthLabel = currentMonthLabel.charAt(0).toUpperCase() + currentMonthLabel.slice(1)

  return (
    <div className="au-page" data-testid="admin-dashboard">
      {/* Header ejecutivo */}
      <AdminPageHeader
        eyebrow="LEVELPRO / BUSINESS OVERVIEW"
        title="Control total. Visión clara."
        description="Todo lo importante de tu negocio, organizado en un solo espacio."
        actions={
          <>
            <SecondaryButton onClick={() => refetch()} testId="dashboard-refresh">
              <RefreshCw size={14} className={isFetching ? "spin" : ""} /> Actualizar
            </SecondaryButton>
            <Button
              variant="green"
              size="sm"
              arrow
              to="/admin/products"
              testId="dashboard-new-product"
            >
              Nuevo producto
            </Button>
          </>
        }
      />

      {/* Barra de contexto: navegación rápida a módulos reales + mes actual */}
      <div className="lp-context-bar">
        <div className="lp-view-tabs" role="navigation" aria-label="Vistas rápidas de negocio">
          <Link to="/admin" className="lp-view-tab active">Resumen</Link>
          <Link to="/admin/orders" className="lp-view-tab">Ventas</Link>
          <Link to="/admin/inventory" className="lp-view-tab">Inventario</Link>
          <Link to="/admin/finance" className="lp-view-tab">Finanzas</Link>
        </div>
        <div className="lp-datepill" aria-label="Período actual">
          <Calendar size={14} />
          <span>{formattedMonthLabel}</span>
        </div>
      </div>

      {/* ═══ FILA 1: 4 KPIs (StatCard) ═══════════════════════════════ */}
      <div className="lp-grid-kpi">
        <StatCard
          variant="ink"
          Icon={Wallet}
          label="INGRESOS TOTALES"
          value={clp(rev.total)}
          sub="Acumulado"
          badge={<span className="au-lp__delta">Mes {clp(rev.this_month)}</span>}
          to="/admin/finance"
          loading={isLoading}
          testId="dash-feature-revenue"
        />

        <StatCard
          variant="primary"
          Icon={ShoppingBag}
          label="PEDIDOS"
          value={(orders.total || 0).toLocaleString("es-CL")}
          sub={`${orders.pending || 0} por gestionar`}
          badge={<span className="au-lp__delta">{orders.today || 0} hoy</span>}
          to="/admin/orders"
          loading={isLoading}
          testId="kpi-orders"
        />

        <StatCard
          variant="light"
          Icon={Users}
          label="CLIENTES"
          value={(users.total || 0).toLocaleString("es-CL")}
          sub={`+${users.new_week || 0} esta semana`}
          badge={<span className="au-lp__delta">+{users.new_month || 0} mes</span>}
          to="/admin/users"
          loading={isLoading}
          testId="kpi-users"
        />

        <StatCard
          variant="light"
          Icon={Package}
          label="CATÁLOGO"
          value={(products.total || 0).toLocaleString("es-CL")}
          sub="Productos activos"
          badge={
            products.low_stock > 0 ? (
              <span className="au-lp__delta au-lp__delta--warn">• {products.low_stock} stock bajo</span>
            ) : (
              <span className="au-lp__delta">{activeProducts} disponibles</span>
            )
          }
          to="/admin/inventory"
          loading={isLoading}
          testId="kpi-products"
        />
      </div>

      {/* ═══ FILA 2: RENDIMIENTO COMERCIAL + RESUMEN DEL MES ═════════ */}
      <div className="lp-dashboard-grid">
        <ChartCard
          title="Rendimiento comercial"
          description="Evolución de las ventas y actividad de tu tienda"
          period={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="au-seg" role="tablist" aria-label="Período del gráfico">
                <button
                  type="button"
                  role="tab"
                  aria-selected={period === "monthly"}
                  className={`au-seg__btn ${period === "monthly" ? "is-active" : ""}`}
                  onClick={() => setPeriod("monthly")}
                >
                  Mensual
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={period === "annual"}
                  className={`au-seg__btn ${period === "annual" ? "is-active" : ""}`}
                  onClick={() => setPeriod("annual")}
                >
                  Anual
                </button>
              </div>
              <Link
                to="/admin/finance"
                className="lp-topicon"
                style={{ width: 32, height: 32 }}
                aria-label="Ir a Finanzas"
              >
                <ArrowUpRight size={15} />
              </Link>
            </div>
          }
          loading={isLoading}
          isEmpty={chart.length === 0 && monthlySeries.length === 0}
          emptyDesc="Cuando registres ventas las verás reflejadas en este gráfico."
          testId="admin-sales-chart"
        >
          <SalesBars dailyData={chart} monthlyData={monthlySeries} period={period} />
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            flexWrap: "wrap", gap: 10, marginTop: 10, fontSize: 11.5, color: "#7B838E",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1A9D4E" }} />
                Ventas confirmadas
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#D7E2DB" }} />
                Actividad diaria
              </span>
            </div>
            <span style={{ color: "#0F9940", fontWeight: 750 }} data-testid="dash-month-revenue">
              Últimos 30 días: {clp(rev.last_30_days)}
            </span>
          </div>
        </ChartCard>

        {/* Panel derecho: Efectividad y balance real del mes */}
        <article className="au-card au-panel" data-testid="dash-balance">
          <div className="au-panel__head">
            <div>
              <h2 className="au-panel__title">Actividad del mes</h2>
              <p className="au-panel__desc">Efectividad de órdenes e ingresos del período</p>
            </div>
            <span className="au-lp__tag">EN CURSO</span>
          </div>

          {isLoading ? (
            <div className="au-skel" style={{ height: 165 }} />
          ) : (
            <div className="lp-performance">
              <div
                className="lp-ring"
                style={{
                  background: `conic-gradient(#1A9D4E 0 ${fulfillmentPct}%, #E9F2EB ${fulfillmentPct}% 100%)`,
                }}
                aria-label={`${fulfillmentPct}% de órdenes gestionadas`}
              >
                <div className="lp-ring__num">
                  {fulfillmentPct}<small>%</small>
                </div>
              </div>

              <div className="lp-ring-desc">
                <span className="lp-ring-desc__eyebrow">INGRESOS DEL MES</span>
                <strong className="lp-ring-desc__val">{clp(rev.this_month)}</strong>
                <p className="lp-ring-desc__text">
                  {orders.this_month || 0} órdenes este mes
                  {avgOrderValue > 0 ? ` · Ticket prom. ${clp(avgOrderValue)}` : ""}.
                </p>
                <div className="lp-tinyprogress">
                  <span style={{ width: `${fulfillmentPct}%` }} />
                </div>
                <span style={{ fontSize: 11, color: "#8D959E", fontWeight: 700 }}>
                  {managedOrdersCount} gestionadas de {totalOrdersCount} órdenes totales
                </span>
              </div>
            </div>
          )}
        </article>
      </div>

      {/* ═══ FILA 3: ÚLTIMAS ÓRDENES + REQUIERE TU ATENCIÓN ══════════ */}
      <div className="lp-lower-grid">
        {/* Tabla compacta de Últimas órdenes */}
        <article className="au-card au-panel" data-testid="dash-orders">
          <div className="au-panel__head" style={{ marginBottom: 12 }}>
            <div>
              <h2 className="au-panel__title">Últimas órdenes</h2>
              <p className="au-panel__desc">Actividad reciente de tus clientes</p>
            </div>
            <Link
              to="/admin/orders"
              style={{
                fontSize: 12, color: "#0F9940", fontWeight: 800,
                textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
              }}
            >
              Ver todas <ArrowRight size={14} />
            </Link>
          </div>

          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[0, 1, 2].map((k) => (
                <div key={k} className="au-skel" style={{ height: 52 }} />
              ))}
            </div>
          ) : ordersList.length === 0 ? (
            <EmptyState
              Icon={Clock}
              title="Sin órdenes recientes"
              description="Cuando tus clientes realicen compras aparecerán aquí."
            />
          ) : (
            <div data-testid="dashboard-orders-table">
              <div className="lp-orders-mini__head">
                <span>Cliente</span>
                <span>Estado</span>
                <span>Total</span>
                <span>Fecha</span>
              </div>
              {ordersList.map((o) => {
                const st = ORDER_STATUS_MAP[o.status] || { label: o.status, tone: "neutral" }
                return (
                  <div
                    key={o.id}
                    className="lp-orders-mini__row"
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/admin/orders?id=${o.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        navigate(`/admin/orders?id=${o.id}`)
                      }
                    }}
                  >
                    <div className="lp-buyer">
                      <span className="lp-buyer__ico">{getInitials(o.clientName)}</span>
                      <div style={{ minWidth: 0 }}>
                        <div className="lp-buyer__name">{o.clientName}</div>
                        <div className="lp-buyer__id">#{o.shortId}</div>
                      </div>
                    </div>
                    <div>
                      <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                    </div>
                    <span style={{ fontWeight: 800, color: "#14161A", fontVariantNumeric: "tabular-nums" }}>
                      {clp(o.total)}
                    </span>
                    <span style={{ color: "#9199A1", fontSize: 11.5 }}>
                      {formatShortDate(o.created)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </article>

        {/* Alertas operativas: Requiere tu atención */}
        <article className="au-card au-panel" data-testid="dash-stock">
          <div className="au-panel__head" style={{ marginBottom: 8 }}>
            <div>
              <h2 className="au-panel__title">Requiere tu atención</h2>
              <p className="au-panel__desc">Prioridades operativas de hoy</p>
            </div>
            <Link
              to="/admin/orders"
              className="lp-topicon"
              style={{ width: 32, height: 32 }}
              aria-label="Ver órdenes pendientes"
            >
              <ArrowUpRight size={15} />
            </Link>
          </div>

          <div className="lp-alert-list">
            <Link to="/admin/inventory" className="lp-alert-row" data-testid="alert-low-stock">
              <span className="lp-alert-icon">
                <AlertTriangle size={18} />
              </span>
              <span className="lp-alert-text">
                <strong>{products.low_stock || 0} productos con stock bajo</strong>
                <span>
                  {products.out_of_stock > 0
                    ? `${products.out_of_stock} agotados · Revisa disponibilidad e inventario`
                    : "Revisa disponibilidad e inventario"}
                </span>
              </span>
              <ChevronRight size={16} style={{ color: "#BBC0C6", flexShrink: 0 }} />
            </Link>

            <Link to="/admin/orders" className="lp-alert-row" data-testid="alert-pending-orders">
              <span className="lp-alert-icon lp-alert-icon--green">
                <ShoppingBag size={18} />
              </span>
              <span className="lp-alert-text">
                <strong>{orders.pending || 0} órdenes por gestionar</strong>
                <span>Compras y confirmaciones pendientes</span>
              </span>
              <ChevronRight size={16} style={{ color: "#BBC0C6", flexShrink: 0 }} />
            </Link>

            <Link to="/admin/services" className="lp-alert-row" data-testid="dash-service-requests">
              <span className="lp-alert-icon lp-alert-icon--dark">
                <Wrench size={18} />
              </span>
              <span className="lp-alert-text">
                <strong>{unread} solicitudes de servicios</strong>
                <span>Clientes a la espera de respuesta</span>
              </span>
              <ChevronRight size={16} style={{ color: "#BBC0C6", flexShrink: 0 }} />
            </Link>

            <Link to="/admin/academy/enrollments" className="lp-alert-row" data-testid="kpi-academy">
              <span className="lp-alert-icon lp-alert-icon--green">
                <GraduationCap size={18} />
              </span>
              <span className="lp-alert-text">
                <strong>{academy.total_enrollments || 0} inscripciones en Academia</strong>
                <span>
                  {academy.enrollments_month > 0
                    ? `+${academy.enrollments_month} nuevas este mes`
                    : "Gestión de alumnos y cursos"}
                </span>
              </span>
              <ChevronRight size={16} style={{ color: "#BBC0C6", flexShrink: 0 }} />
            </Link>
          </div>
        </article>
      </div>

      <style>{`
        .admin-root .spin { animation: au-spin 1s linear infinite; }
        @keyframes au-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
