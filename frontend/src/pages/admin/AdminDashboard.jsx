// pages/admin/AdminDashboard.jsx — LevelPro Precision Dashboard (Tiendanube / Nimbus × Lumin)
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "react-router-dom"
import {
  ArrowRight, RefreshCw, AlertTriangle, ShoppingBag, Wrench,
  ChevronRight, GraduationCap, Plus, DollarSign, ShoppingCart,
  TrendingUp, CheckCircle2
} from "lucide-react"
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip
} from "recharts"
import { getAdminDashboard, getAnalytics } from "../../api/admin.api"
import {
  AdminPageHeader, StatCard, SectionCard, ChartCard, StatusBadge,
  ErrorState, SkeletonCard, PrimaryButton, SecondaryButton, AdminLayoutGrid
} from "../../components/admin/ui"
import AccountingCurrencySelect from "../../components/admin/ui/AccountingCurrencySelect"
import { formatCurrency } from "../../utils/accountingCurrency"
import {
  adminRecentOrders, adminFulfillment, adminCategoryMix, adminSalesSeries,
  monthlyShare, count,
} from "../dashboard/dashboardV3Data"

const ORDER_STATUS_MAP = {
  paid: { label: "Pagado", tone: "success" },
  completed: { label: "Completado", tone: "success" },
  shipped: { label: "Enviado", tone: "info" },
  pending: { label: "Pendiente", tone: "warning" },
  cancelled: { label: "Cancelado", tone: "danger" },
  refunded: { label: "Reembolsado", tone: "neutral" },
  unknown: { label: "Sin estado", tone: "neutral" },
}

function formatShortDate(iso) {
  if (!iso) return "—"
  try {
    const parsed = new Date(iso)
    return Number.isNaN(parsed.getTime())
      ? String(iso).slice(0, 16)
      : parsed.toLocaleDateString("es-CL", { day: "2-digit", month: "short" })
  } catch {
    return "—"
  }
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState("30D")
  const [currency, setCurrency] = useState("CLP")
  const fmt = (n) => formatCurrency(n, currency)

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
      <div className="au-page" data-testid="admin-dashboard">
        <div style={{ maxWidth: 600, margin: "40px auto", width: "100%" }}>
          <ErrorState
            title="No pudimos cargar el resumen del negocio"
            description="Verifica tu conexión o intenta actualizar nuevamente."
            action={<SecondaryButton onClick={() => refetch()}>Reintentar</SecondaryButton>}
          />
        </div>
      </div>
    )
  }

  if (isPending || !data) {
    return (
      <div className="au-page" data-testid="admin-dashboard" role="status" aria-live="polite">
        <AdminPageHeader title="Inicio" description="Cargando información real del negocio…" />
        <div className="lp-summary-strip">
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} height={116} />)}
        </div>
        <SkeletonCard height={280} />
      </div>
    )
  }

  const rev = data.revenue || {}
  const orders = data.orders || {}
  const users = data.users || {}
  const products = data.products || {}
  const academy = data.academy || {}
  const actions = data.actions || {}
  const unread = count(actions.unread_service_requests)
  const avgOrderValue = analytics?.kpis?.avg_order_value
  const fulfillment = adminFulfillment(analytics, orders.total)
  const fulfillmentPct = fulfillment?.percentage ?? 0
  const share = monthlyShare(rev)
  const ordersList = adminRecentOrders(data)
  const salesSeries = adminSalesSeries(data, analytics, period)
  const categoryMix = adminCategoryMix(analytics)
  const totalAlerts = count(products.low_stock) + count(orders.pending) + unread
  const monthLabel = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(new Date())

  const categoryColors = ["#09090B", "#242A34", "#16A34A", "#71717A"]

  return (
    <div className="au-page" data-testid="admin-dashboard">
      <AdminPageHeader
        title="Inicio"
        description={`Resumen operativo de LevelPro Audio en ${currency} · ${monthLabel}`}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <AccountingCurrencySelect id="admin-dashboard-currency" value={currency} onChange={setCurrency} />
            <SecondaryButton
              icon={RefreshCw}
              onClick={() => refetch()}
              loading={isFetching}
              aria-label="Actualizar datos"
              size="sm"
            >
              Actualizar
            </SecondaryButton>
            <PrimaryButton
              to="/admin/products"
              icon={Plus}
              testId="dashboard-new-product"
              size="sm"
            >
              Nuevo producto
            </PrimaryButton>
          </div>
        }
      />

      {/* 4 KPI SummaryStats Strip */}
      <div className="lp-summary-strip">
        <StatCard
          label="Ventas del mes"
          value={fmt(rev.this_month)}
          sub={rev.growth_pct != null ? "vs. período anterior" : `${share}% del total registrado`}
          delta={rev.growth_pct}
          Icon={DollarSign}
          to="/admin/finance"
          testId="dash-month-revenue"
        />
        <StatCard
          label="Órdenes totales"
          value={count(orders.total)}
          sub={`${count(orders.paid)} pagadas · ${count(orders.pending)} pendientes`}
          Icon={ShoppingCart}
          to="/admin/orders"
          testId="dash-feature-revenue"
        />
        <StatCard
          label="Ticket promedio"
          value={avgOrderValue == null ? "Sin datos" : fmt(avgOrderValue)}
          sub={`${count(products.active)} productos activos`}
          Icon={TrendingUp}
        />
        <StatCard
          label="Efectividad de despacho"
          value={fulfillment ? `${fulfillmentPct}%` : "—"}
          sub={fulfillment ? `${fulfillment.managed} de ${fulfillment.total} enviadas` : "Consultando estados"}
          Icon={CheckCircle2}
          to="/admin/orders"
          testId="dash-orders"
        />
      </div>

      {/* Por resolver hoy */}
      <SectionCard
        title="Por resolver hoy"
        description="Alertas operativas que requieren seguimiento"
        action={
          <StatusBadge tone={totalAlerts > 0 ? "warning" : "success"}>
            {totalAlerts} {totalAlerts === 1 ? "pendiente" : "pendientes"}
          </StatusBadge>
        }
        testId="dash-stock"
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
          <Link to="/admin/orders" className="lp-action-row" data-testid="alert-pending-orders">
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, background: "#FEF3C7", color: "#B45309", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <ShoppingBag size={16} />
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "#09090B" }}>Órdenes pendientes</p>
                <p style={{ fontSize: 12, margin: 0, color: "#71717A" }}>{count(orders.pending)} pagos por confirmar</p>
              </div>
            </div>
            <ChevronRight size={15} style={{ color: "#71717A", flexShrink: 0 }} />
          </Link>

          <Link to="/admin/inventory" className="lp-action-row" data-testid="alert-low-stock">
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, background: "#FEF2F2", color: "#DC2626", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertTriangle size={16} />
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "#09090B" }}>Stock crítico</p>
                <p style={{ fontSize: 12, margin: 0, color: "#71717A" }}>{count(products.low_stock)} SKUs bajo umbral</p>
              </div>
            </div>
            <ChevronRight size={15} style={{ color: "#71717A", flexShrink: 0 }} />
          </Link>

          <Link to="/admin/services" className="lp-action-row" data-testid="dash-service-requests">
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, background: "#F4F4F5", color: "#09090B", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Wrench size={16} />
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "#09090B" }}>Servicio técnico</p>
                <p style={{ fontSize: 12, margin: 0, color: "#71717A" }}>{unread} solicitudes sin asignar</p>
              </div>
            </div>
            <ChevronRight size={15} style={{ color: "#71717A", flexShrink: 0 }} />
          </Link>

          <Link to="/admin/academy/enrollments" className="lp-action-row" data-testid="kpi-academy">
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, background: "#ECFDF3", color: "#0F7A38", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <GraduationCap size={16} />
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "#09090B" }}>Academia LevelPro</p>
                <p style={{ fontSize: 12, margin: 0, color: "#71717A" }}>{count(academy.total_enrollments ?? academy.enrollments)} alumnos · {count(users.total)} clientes</p>
              </div>
            </div>
            <ChevronRight size={15} style={{ color: "#71717A", flexShrink: 0 }} />
          </Link>
        </div>
      </SectionCard>

      {/* Asymmetrical 2/3 + 1/3 Sales Chart & Category Mix */}
      <AdminLayoutGrid layout="asym">
        <ChartCard
          title="Evolución de ventas"
          description={`Serie real de operaciones pagadas (${period === "1A" ? "mensual" : "diaria"})`}
          testId="admin-sales-chart"
          isEmpty={salesSeries.length === 0}
          emptyTitle="Sin operaciones pagadas en el período"
          emptyDesc="Cambia el rango o moneda para consultar registros históricos."
          period={
            <div className="au-seg" role="group" aria-label="Período de gráfico">
              {["7D", "30D", "1A"].map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`au-seg__btn ${period === t ? "is-active" : ""}`}
                  onClick={() => setPeriod(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          }
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 22, fontWeight: 600, color: "#09090B", letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums" }}>
              {fmt(rev.total)}
            </span>
            <span style={{ fontSize: 12, color: "#71717A" }}>Acumulado histórico en {currency}</span>
          </div>
          <div style={{ height: 220, width: "100%" }} role="img" aria-label={`Ventas registradas: ${period}`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesSeries} margin={{ top: 8, left: 4, right: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="lpPrecisionSalesArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1AFF6E" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="#1AFF6E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#F0F0F2" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#71717A" }} axisLine={false} tickLine={false} minTickGap={20} />
                <YAxis tick={{ fontSize: 11, fill: "#71717A" }} axisLine={false} tickLine={false} width={58} tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                <Tooltip
                  formatter={(value) => [fmt(value), "Ventas"]}
                  contentStyle={{
                    background: "#09090B",
                    border: "none",
                    color: "#FFFFFF",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#09090B"
                  strokeWidth={2}
                  fill="url(#lpPrecisionSalesArea)"
                  activeDot={{ r: 5, fill: "#1AFF6E", stroke: "#09090B", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <SectionCard
          title="Ventas por categoría"
          description="Participación real por volumen"
          action={
            <Link to="/admin/products" style={{ fontSize: 12, fontWeight: 500, color: "#0F7A38", textDecoration: "none" }}>
              Ver catálogo →
            </Link>
          }
        >
          {categoryMix.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", gap: 3, height: 8, borderRadius: 4, overflow: "hidden", background: "#F4F4F5" }}>
                {categoryMix.map((cat, i) => (
                  <span
                    key={cat.name}
                    style={{ width: `${cat.percentage}%`, flexShrink: 0 }}
                    title={`${cat.name} ${cat.percentage.toFixed(1)}%`}
                    aria-label={`${cat.name}: ${cat.percentage.toFixed(1)}%`}
                    data-testid={`v3-category-segment-${i}`}
                  >
                    <span style={{ display: "block", width: "100%", height: "100%", background: categoryColors[i % categoryColors.length] }} />
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {categoryMix.map((cat, i) => (
                  <div key={cat.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: categoryColors[i % categoryColors.length], flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#09090B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {cat.name}
                      </span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#09090B", fontVariantNumeric: "tabular-nums" }}>
                      {cat.percentage.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ color: "#71717A", fontSize: 13, margin: "12px 0" }}>
              Sin ventas categorizadas disponibles
            </p>
          )}
        </SectionCard>
      </AdminLayoutGrid>

      {/* Recent Orders Table */}
      <SectionCard
        title="Últimas ventas"
        description="Actividad comercial reciente"
        padding={false}
        testId="dashboard-orders-table"
        action={
          <Link
            to="/admin/orders"
            style={{ fontSize: 12.5, fontWeight: 600, color: "#0F7A38", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <span>Ver todas las ventas</span>
            <ArrowRight size={14} />
          </Link>
        }
      >
        {ordersList.length === 0 ? (
          <p role="status" style={{ color: "#71717A", fontSize: 13, padding: "20px" }}>
            Todavía no hay órdenes registradas.
          </p>
        ) : (
          <div className="au-tscroll">
            <table className="au-table">
              <thead>
                <tr>
                  <th scope="col">Orden</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Estado</th>
                  <th scope="col" style={{ textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {ordersList.map((o) => {
                  const st = ORDER_STATUS_MAP[o.status] || { label: o.status, tone: "neutral" }
                  return (
                    <tr
                      key={o.id}
                      onClick={() => navigate(`/admin/orders?id=${o.id}`)}
                      style={{ cursor: "pointer" }}
                    >
                      <td className="lp-mono" style={{ fontWeight: 600, color: "#09090B" }}>
                        #{o.shortId}
                      </td>
                      <td style={{ color: "#09090B", fontWeight: 500 }}>{o.clientName}</td>
                      <td style={{ color: "#71717A" }}>{formatShortDate(o.created)}</td>
                      <td>
                        <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: "#09090B", fontVariantNumeric: "tabular-nums" }}>
                        {o.total == null
                          ? "—"
                          : o.currency
                            ? formatCurrency(o.total, o.currency)
                            : `${new Intl.NumberFormat("es-CL").format(o.total)} (sin divisa)`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
