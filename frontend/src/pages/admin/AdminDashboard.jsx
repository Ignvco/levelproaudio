// pages/admin/AdminDashboard.jsx — Piloto del rediseño con la biblioteca au-*
import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "react-router-dom"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts"
import {
  DollarSign, ShoppingBag, Users, Package, Boxes, Clock,
  MessageSquare, AlertTriangle, ArrowRight, RefreshCw, Eye,
} from "lucide-react"
import { getAdminDashboard, getAnalytics } from "../../api/admin.api"
import {
  AdminPageHeader, StatCard, ChartCard, RadialStatCard, SectionCard,
  DataTable, StatusBadge, SecondaryButton, EmptyState,
} from "../../components/admin/ui"

const clp = (n) => `$${Math.round(n || 0).toLocaleString("es-CL")}`

function SalesTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "#0D0D0F", color: "#fff", padding: "10px 14px", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.25)" }}>
      <p style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 15, fontWeight: 700, color: "#1AFF6E" }}>{clp(payload[0].value)}</p>
    </div>
  )
}

function SalesChart({ data }) {
  const fmtDay = (d) => { try { return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short" }) } catch { return d } }
  const points = (data || []).slice(-14).map((d) => ({ day: fmtDay(d.date), total: d.total || 0 }))
  const max = Math.max(...points.map((p) => p.total), 1)
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={points} margin={{ top: 10, right: 6, left: -18, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.07)" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8b938e" }} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} width={54} tick={{ fontSize: 11, fill: "#8b938e" }}
          tickFormatter={(v) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)} />
        <Tooltip cursor={{ fill: "rgba(26,255,110,0.06)" }} content={<SalesTooltip />} />
        <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={34}>
          {points.map((p, i) => <Cell key={i} fill={p.total >= max * 0.6 ? "#1AFF6E" : "rgba(255,255,255,0.14)"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function SummaryRow({ label, value, tone, badge }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--admin-border)" }}>
      <span style={{ fontSize: 13.5, color: "var(--admin-text-muted)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
        {badge && <StatusBadge tone={tone}>{badge}</StatusBadge>}
      </div>
    </div>
  )
}

function ActionList({ Icon, title, to, items, renderItem, emptyMsg }) {
  return (
    <SectionCard
      title={title}
      action={to && <Link to={to} style={{ fontSize: 12, color: "var(--admin-primary-text)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3, fontWeight: 600 }}>Ver todo <ArrowRight size={12} /></Link>}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span className="au-stat__icon" style={{ width: 38, height: 38, borderRadius: 11 }}><Icon size={17} /></span>
        <span style={{ fontSize: 12.5, color: "var(--admin-text-muted)" }}>{items.length} elementos</span>
      </div>
      {items.length
        ? <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{items.slice(0, 5).map(renderItem)}</div>
        : <EmptyState title={emptyMsg} />}
    </SectionCard>
  )
}

const rowLink = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "11px 13px", background: "var(--admin-surface-secondary)", borderRadius: 12, textDecoration: "none" }

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-dashboard"], queryFn: getAdminDashboard, refetchInterval: 60000,
  })
  const { data: analytics, isLoading: loadingAnalytics } = useQuery({
    queryKey: ["admin-analytics"], queryFn: getAnalytics, refetchInterval: 120000,
  })
  const salesByCategory = (analytics?.revenue_by_category || [])
    .map((c) => ({ name: c.category, value: c.total || 0 }))

  const rev = data?.revenue || {}, orders = data?.orders || {}, users = data?.users || {}
  const products = data?.products || {}, academy = data?.academy || {}, chart = data?.sales_chart || []
  const actions = data?.actions || {}
  const pending = actions.pending_orders || [], lowStock = actions.low_stock || []
  const unread = actions.unread_service_requests || 0

  const activeProducts = Math.max((products.total || 0) - (products.out_of_stock || 0) - (products.low_stock || 0), 0)

  const today = new Date().toLocaleDateString("es-CL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })

  const orderColumns = [
    { key: "short_id", header: "Orden", sortable: true, render: (r) => <span style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 12.5 }}>#{r.short_id}</span> },
    { key: "user_name", header: "Cliente", sortable: true, render: (r) => <span style={{ color: "var(--admin-text-muted)" }}>{r.user_name || "—"}</span> },
    { key: "items_count", header: "Items", align: "center", render: (r) => r.items_count },
    { key: "total", header: "Total", sortable: true, align: "right", render: (r) => <span style={{ fontWeight: 700, color: "var(--admin-primary-text)" }}>{clp(r.total)}</span> },
    { key: "estado", header: "Estado", render: () => <StatusBadge tone="warning">Pendiente</StatusBadge> },
  ]

  return (
    <div className="au-page" data-testid="admin-dashboard">
      <AdminPageHeader
        eyebrow="Panel"
        title="Dashboard"
        description={today.charAt(0).toUpperCase() + today.slice(1)}
        actions={<SecondaryButton onClick={() => refetch()} testId="dashboard-refresh">
          <RefreshCw size={14} className={isFetching ? "spin" : ""} /> Actualizar
        </SecondaryButton>}
      />

      {(pending.length > 0 || products.out_of_stock > 0 || unread > 0) && (
        <div className="au-card" data-testid="admin-alerts" style={{ padding: "14px 20px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", background: "rgba(240,169,59,0.10)", border: "1px solid rgba(240,169,59,0.28)", boxShadow: "none" }}>
          <AlertTriangle size={18} style={{ color: "#F0A93B", flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: "#F0C486", flex: 1 }}>
            {pending.length > 0 && `${pending.length} pedidos pendientes · `}
            {products.out_of_stock > 0 && `${products.out_of_stock} productos sin stock · `}
            {unread > 0 && `${unread} solicitudes de servicio`}
          </p>
        </div>
      )}

      {/* Fila 1 — KPIs (lenguaje de cards del front LevelPro) */}
      <div className="au-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px,1fr))" }}>
        <StatCard variant="primary" Icon={DollarSign} label="INGRESOS TOTALES" value={clp(rev.total)}
          sub={`Este mes ${clp(rev.this_month)}`} loading={isLoading} testId="kpi-revenue" />
        <StatCard Icon={ShoppingBag} label="PEDIDOS" value={orders.total || 0}
          sub={`${orders.today || 0} hoy`} to="/admin/orders" loading={isLoading} testId="kpi-orders" />
        <StatCard Icon={Users} label="USUARIOS" value={users.total || 0}
          sub={`+${users.new_week || 0} esta semana`} to="/admin/users" loading={isLoading} testId="kpi-users" />
        <StatCard Icon={Package} label="PRODUCTOS" value={products.total || 0}
          sub={`${activeProducts} activos`}
          badge={products.out_of_stock > 0 ? <span className="au-lp__delta au-lp__delta--neg">{products.out_of_stock} agotados</span> : null}
          to="/admin/products" loading={isLoading} testId="kpi-products" />
      </div>

      {/* Fila 2 — gráfico de ventas (ancho completo) */}
      <ChartCard title="Ventas recientes" description="Últimos días con actividad"
        loading={isLoading} isEmpty={chart.length === 0} emptyDesc="Cuando registres ventas las verás acá."
        action={<span style={{ fontSize: 22, fontWeight: 800, color: "var(--admin-primary-text)" }}>{clp(rev.last_30_days)}</span>}
        testId="admin-sales-chart">
        <SalesChart data={chart} />
      </ChartCard>

      {/* Fila 2b — dos donuts: ventas por categoría + distribución de productos */}
      <div className="au-grid admin-grid-2" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
        <RadialStatCard title="Ventas por categoría" description="Ingresos por categoría de producto"
          total={salesByCategory.reduce((a, b) => a + b.value, 0)} totalLabel="Total"
          loading={loadingAnalytics} data={salesByCategory} valueFormatter={clp}
          testId="admin-sales-category-radial" />

        <RadialStatCard title="Estadística de productos" description="Distribución del catálogo"
          total={products.total || 0} totalLabel="Productos" loading={isLoading}
          data={[
            { name: "Activos", value: activeProducts },
            { name: "Stock bajo", value: products.low_stock || 0, color: "#CA8A04" },
            { name: "Agotados", value: products.out_of_stock || 0, color: "#EF4444" },
          ]}
          testId="admin-products-radial" />
      </div>

      {/* Fila 3 — tabla + resumen */}
      <div className="au-grid admin-grid-2" style={{ gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)" }}>
        <div>
          <h2 className="au-panel__title" style={{ marginBottom: 12 }}>Órdenes por confirmar</h2>
          <DataTable
            columns={orderColumns} data={pending} loading={isLoading}
            getRowId={(r) => r.id} searchPlaceholder="Buscar orden o cliente..."
            onRowClick={(r) => navigate(`/admin/orders?id=${r.id}`)}
            rowActions={(r) => [{ label: "Ver orden", icon: Eye, onClick: () => navigate(`/admin/orders?id=${r.id}`) }]}
            initialPageSize={10} emptyTitle="No hay órdenes pendientes" emptyDesc="Todas las órdenes están al día."
            emptyIcon={Clock} testId="dashboard-orders-table" />
        </div>

        <SectionCard title="Resumen" description="Estado de tu operación" testId="admin-summary">
          <SummaryRow label="Pedidos pendientes" value={orders.pending || 0} tone={pending.length > 0 ? "warning" : "success"} badge={pending.length > 0 ? "revisar" : "ok"} />
          <SummaryRow label="Ventas del mes" value={clp(rev.this_month)} />
          <SummaryRow label="Productos sin stock" value={products.out_of_stock || 0} tone={products.out_of_stock > 0 ? "danger" : "success"} badge={products.out_of_stock > 0 ? "agotado" : "ok"} />
          <SummaryRow label="Stock bajo" value={products.low_stock || 0} />
          <SummaryRow label="Inscripciones academia" value={academy.total_enrollments || 0} tone="success" badge={academy.enrollments_month > 0 ? `+${academy.enrollments_month}` : null} />
        </SectionCard>
      </div>

      {/* Fila 4 — acciones */}
      <div className="au-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))" }}>
        <ActionList Icon={Boxes} title="Stock bajo o agotado" to="/admin/inventory" items={lowStock}
          emptyMsg="Todo en stock ✓"
          renderItem={(p) => (
            <Link key={p.id} to={`/admin/products?highlight=${p.id}`} style={rowLink}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--admin-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{p.name}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: p.stock === 0 ? "#EF4444" : "#D97706" }}>{p.stock === 0 ? "Agotado" : `${p.stock} u.`}</span>
            </Link>
          )} />

        <ActionList Icon={Clock} title="Órdenes por confirmar" to="/admin/orders" items={pending}
          emptyMsg="No hay órdenes pendientes ✓"
          renderItem={(o) => (
            <Link key={o.id} to={`/admin/orders?id=${o.id}`} style={rowLink}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--admin-text)", fontFamily: "monospace" }}>#{o.short_id}</p>
                <p style={{ fontSize: 11, color: "var(--admin-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.user_name} · {o.items_count} items</p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-primary-text)" }}>{clp(o.total)}</span>
            </Link>
          )} />

        <SectionCard title="Solicitudes de servicios"
          action={<Link to="/admin/services" style={{ fontSize: 12, color: "var(--admin-primary-text)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3, fontWeight: 600 }}>Ver todo <ArrowRight size={12} /></Link>}
          testId="action-service-requests">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span className="au-stat__icon" style={{ width: 38, height: 38, borderRadius: 11 }}><MessageSquare size={17} /></span>
            <span style={{ fontSize: 12.5, color: "var(--admin-text-muted)" }}>{unread} sin leer</span>
          </div>
          {unread > 0
            ? <p style={{ fontSize: 13, color: "var(--admin-text-muted)", padding: "12px 14px", background: "var(--admin-surface-secondary)", borderRadius: 12 }}>Tenés <strong style={{ color: "var(--admin-primary-text)" }}>{unread}</strong> cotizaciones esperando respuesta.</p>
            : <EmptyState title="Sin solicitudes nuevas ✓" />}
        </SectionCard>
      </div>

      <style>{`
        @media (max-width:900px){ .admin-root .admin-grid-2 { grid-template-columns:1fr !important; } }
        .admin-root .spin { animation: au-spin 1s linear infinite; }
        @keyframes au-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
