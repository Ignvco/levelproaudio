// pages/admin/AdminDashboard.jsx — Rediseño estética "Quixotic": limpio, premium,
// tarjetas blancas muy redondeadas, fondo gris claro, verde de marca. Toda la
// data es real (getAdminDashboard, getAnalytics); no se inventan cifras.
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "react-router-dom"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  AreaChart, Area,
} from "recharts"
import {
  DollarSign, ShoppingBag, Users, Package, Clock, ArrowRight, ArrowUpRight,
  RefreshCw, Eye, Wifi, CreditCard, Boxes,
} from "lucide-react"
import { getAdminDashboard, getAnalytics } from "../../api/admin.api"
import {
  AdminPageHeader, StatCard, ChartCard, SectionCard,
  DataTable, StatusBadge, SecondaryButton, EmptyState,
} from "../../components/admin/ui"

const clp = (n) => `$${Math.round(n || 0).toLocaleString("es-CL")}`

/* ── Tooltip del gráfico de barras ───────────────────────────────── */
function SalesTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "#0D0D0F", color: "#fff", padding: "10px 14px", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.25)" }}>
      <p style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 15, fontWeight: 700, color: "#1AFF6E" }}>{clp(payload[0].value)}</p>
    </div>
  )
}

/* ── Gráfico central de barras (Engagement Rate → Ventas) ────────── */
function SalesBars({ data, period }) {
  const fmtDay = (d) => { try { return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short" }) } catch { return d } }
  const raw = (data || [])
  const points = (period === "annual" ? raw.slice(-12) : raw.slice(-14))
    .map((d) => ({ day: fmtDay(d.date), total: d.total || 0 }))
  const max = Math.max(...points.map((p) => p.total), 1)
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={points} margin={{ top: 24, right: 6, left: -14, bottom: 0 }} barCategoryGap="26%">
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#EEF0F3" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#98A2B3" }} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} width={52} tick={{ fontSize: 11, fill: "#98A2B3" }}
          tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
        <Tooltip cursor={{ fill: "rgba(26,255,110,0.05)" }} content={<SalesTooltip />} />
        <Bar dataKey="total" radius={[20, 20, 20, 20]} maxBarSize={44}>
          {points.map((p, i) => <Cell key={i} fill={p.total >= max * 0.85 ? "#0F9940" : p.total >= max * 0.45 ? "#7BC99B" : "#D9E5DD"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ── Mini area-chart (Total balance) ─────────────────────────────── */
function BalanceArea({ data }) {
  const points = (data || []).slice(-20).map((d, i) => ({ i, v: d.total || 0 }))
  if (!points.length) return null
  return (
    <ResponsiveContainer width="100%" height={90}>
      <AreaChart data={points} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1AFF6E" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#1AFF6E" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke="#0F9940" strokeWidth={2.5} fill="url(#balGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState("monthly")

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-dashboard"], queryFn: getAdminDashboard, refetchInterval: 60000,
  })
  const { data: analytics } = useQuery({
    queryKey: ["admin-analytics"], queryFn: getAnalytics, refetchInterval: 120000,
  })

  const rev = data?.revenue || {}, orders = data?.orders || {}, users = data?.users || {}
  const products = data?.products || {}, academy = data?.academy || {}, chart = data?.sales_chart || []
  const actions = data?.actions || {}
  const pending = actions.pending_orders || [], lowStock = actions.low_stock || []
  const unread = actions.unread_service_requests || 0

  const activeProducts = Math.max((products.total || 0) - (products.out_of_stock || 0) - (products.low_stock || 0), 0)
  const today = new Date().toLocaleDateString("es-CL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })

  const orderColumns = [
    { key: "user_name", header: "Cliente", sortable: true, render: (r) => (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: "var(--admin-primary-soft)", color: "var(--admin-primary-text)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
          {(r.user_name || "?").charAt(0).toUpperCase()}
        </span>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--admin-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.user_name || "—"}</p>
          <p style={{ fontSize: 11.5, color: "var(--admin-text-muted)", fontFamily: "monospace" }}>#{r.short_id}</p>
        </div>
      </div>
    ) },
    { key: "items_count", header: "Items", align: "center", render: (r) => <span style={{ color: "var(--admin-text-muted)", fontSize: 13 }}>{r.items_count}</span> },
    { key: "estado", header: "Estado", render: () => (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--admin-warning)" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--admin-warning)" }} /> Pendiente
      </span>
    ) },
    { key: "total", header: "Total", sortable: true, align: "right", render: (r) => <span style={{ fontWeight: 700, color: "var(--admin-text)", fontVariantNumeric: "tabular-nums" }}>{clp(r.total)}</span> },
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

      {/* ═══ FILA HERO ═══════════════════════════════════════════════
          Izq: card destacada (ingresos, estilo tarjeta) + ingresos semana.
          Centro: gráfico grande de ventas. Der: balance con area-chart. */}
      <div className="dash-hero">
        {/* Columna izquierda */}
        <div className="dash-hero__left">
          {/* Card destacada verde (VISA → Ingresos totales) */}
          <div className="dash-feature" data-testid="dash-feature-revenue">
            <div className="dash-feature__head">
              <div>
                <p className="dash-feature__label">Ingresos totales</p>
                <p className="dash-feature__sublabel">Acumulado histórico</p>
              </div>
              <Wifi size={22} style={{ opacity: 0.85, transform: "rotate(90deg)" }} />
            </div>
            <div className="dash-feature__amount">{clp(rev.total)}</div>
            <div className="dash-feature__foot">
              <span className="dash-feature__chip"><CreditCard size={14} /> LevelPro Audio</span>
              <span style={{ fontSize: 12.5, opacity: 0.85 }}>Este mes {clp(rev.this_month)}</span>
            </div>
          </div>

          {/* Ingresos del mes (dato real) */}
          <div className="au-card dash-week" data-testid="dash-month-revenue">
            <div>
              <p style={{ fontSize: 12.5, color: "var(--admin-text-muted)", marginBottom: 6 }}>Ingresos del mes</p>
              <p style={{ fontSize: 26, fontWeight: 800, color: "var(--admin-text)", letterSpacing: "-0.02em" }}>{clp(rev.this_month)}</p>
            </div>
            <span className="au-stat__icon" style={{ width: 44, height: 44, borderRadius: 13 }}><DollarSign size={20} /></span>
          </div>
        </div>

        {/* Columna centro — gráfico grande */}
        <ChartCard
          title="Ventas recientes"
          description="Actividad de la tienda"
          period={
            <div className="au-seg" role="tablist" style={{ marginLeft: "auto" }}>
              <button className={`au-seg__btn ${period === "monthly" ? "is-active" : ""}`} onClick={() => setPeriod("monthly")}>Mensual</button>
              <button className={`au-seg__btn ${period === "annual" ? "is-active" : ""}`} onClick={() => setPeriod("annual")}>Anual</button>
            </div>
          }
          loading={isLoading} isEmpty={chart.length === 0}
          emptyDesc="Cuando registres ventas las verás acá."
          testId="admin-sales-chart">
          <SalesBars data={chart} period={period} />
        </ChartCard>

        {/* Columna derecha — balance del mes con area-chart */}
        <div className="au-card dash-balance" data-testid="dash-balance">
          <div className="dash-balance__head">
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>Ventas del mes</p>
              <p style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>Últimos 30 días</p>
            </div>
            <Link to="/admin/orders" className="au-iconbtn au-iconbtn--ghost" aria-label="Ver órdenes">
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <p style={{ fontSize: 13, color: "var(--admin-text-muted)", textAlign: "center", marginTop: 6 }}>Total del período</p>
          <p style={{ fontSize: 32, fontWeight: 800, color: "var(--admin-text)", textAlign: "center", letterSpacing: "-0.02em", marginBottom: 4 }}>
            {clp(rev.last_30_days)}
          </p>
          <BalanceArea data={chart} />
          <div className="dash-balance__actions">
            <Link to="/admin/orders" className="au-btn au-btn--primary" style={{ flex: 1, justifyContent: "center" }}>
              Ver órdenes <ArrowRight size={15} />
            </Link>
            <Link to="/admin/products" className="au-btn au-btn--secondary" style={{ flex: 1, justifyContent: "center" }}>
              Productos
            </Link>
          </div>
        </div>
      </div>

      {/* ═══ FILA KPIs ═══════════════════════════════════════════════ */}
      <div className="au-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))" }}>
        <StatCard Icon={ShoppingBag} label="PEDIDOS" value={orders.total || 0}
          sub={`${orders.today || 0} hoy`} to="/admin/orders" loading={isLoading} testId="kpi-orders" />
        <StatCard Icon={Users} label="USUARIOS" value={users.total || 0}
          sub={`+${users.new_week || 0} esta semana`} to="/admin/users" loading={isLoading} testId="kpi-users" />
        <StatCard Icon={Package} label="PRODUCTOS" value={products.total || 0}
          sub={`${activeProducts} activos`}
          badge={products.out_of_stock > 0 ? <span className="au-lp__delta au-lp__delta--neg">{products.out_of_stock} agotados</span> : null}
          to="/admin/products" loading={isLoading} testId="kpi-products" />
        <StatCard Icon={Boxes} label="ACADEMIA" value={academy.total_enrollments || 0}
          sub={academy.enrollments_month > 0 ? `+${academy.enrollments_month} este mes` : "inscripciones"}
          to="/admin/enrollments" loading={isLoading} testId="kpi-academy" />
      </div>

      {/* ═══ FILA ACTIVIDAD ══════════════════════════════════════════
          Izq: tabla de órdenes (Payment History). Der: card de refund/
          crédito → stock, + usuarios recientes (Mandatory Payments). */}
      <div className="dash-activity">
        {/* Tabla de actividad reciente */}
        <div className="au-card" style={{ padding: 20 }} data-testid="dash-orders">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <div>
              <h2 className="au-panel__title">Órdenes por confirmar</h2>
              <p className="au-panel__desc">Actividad reciente de la tienda</p>
            </div>
            <Link to="/admin/orders" className="au-iconbtn au-iconbtn--ghost" aria-label="Ver todas">
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <DataTable
            columns={orderColumns} data={pending} loading={isLoading}
            getRowId={(r) => r.id}
            onRowClick={(r) => navigate(`/admin/orders?id=${r.id}`)}
            rowActions={(r) => [{ label: "Ver orden", icon: Eye, onClick: () => navigate(`/admin/orders?id=${r.id}`) }]}
            initialPageSize={6} emptyTitle="No hay órdenes pendientes" emptyDesc="Todas las órdenes están al día."
            emptyIcon={Clock} testId="dashboard-orders-table" searchable={false} />
        </div>

        {/* Columna derecha */}
        <div className="dash-activity__side">
          {/* Card destacada — stock / inventario (Amount of credit) */}
          <div className="au-card dash-credit" data-testid="dash-stock">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span className="au-stat__icon" style={{ width: 42, height: 42, borderRadius: 12 }}><Boxes size={19} /></span>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>Stock del catálogo</p>
                <p style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>Productos activos disponibles</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 34, fontWeight: 800, color: "var(--admin-text)", letterSpacing: "-0.02em" }}>{activeProducts}</span>
              {products.low_stock > 0 && (
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--admin-warning)", background: "rgba(217,119,6,0.1)", padding: "3px 9px", borderRadius: 100 }}>
                  {products.low_stock} stock bajo
                </span>
              )}
            </div>

            {/* Usuarios nuevos (dato real: users.new_week) */}
            <div className="dash-credit__users">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)" }}>Usuarios nuevos</p>
                  <p style={{ fontSize: 11.5, color: "var(--admin-text-muted)" }}>Registrados esta semana</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: "var(--admin-primary-text)" }}>+{users.new_week || 0}</span>
                  <Link to="/admin/users" className="au-iconbtn au-iconbtn--ghost" aria-label="Ver usuarios">
                    <ArrowUpRight size={15} />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Solicitudes de servicio */}
          <SectionCard title="Solicitudes de servicio"
            action={<Link to="/admin/services" style={{ fontSize: 12, color: "var(--admin-primary-text)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3, fontWeight: 600 }}>Ver todo <ArrowRight size={12} /></Link>}
            testId="dash-service-requests">
            {unread > 0
              ? <p style={{ fontSize: 13, color: "var(--admin-text-muted)", padding: "13px 15px", background: "var(--admin-surface-secondary)", borderRadius: 12 }}>Tenés <strong style={{ color: "var(--admin-primary-text)" }}>{unread}</strong> cotizaciones esperando respuesta.</p>
              : <EmptyState title="Sin solicitudes nuevas ✓" />}
          </SectionCard>
        </div>
      </div>

      <style>{`
        /* ── Layout general del dashboard ── */
        .admin-root .dash-hero {
          display: grid;
          grid-template-columns: minmax(300px, 340px) minmax(0, 1fr) minmax(280px, 320px);
          gap: 16px;
          align-items: stretch;
        }
        .admin-root .dash-hero__left { display: flex; flex-direction: column; gap: 16px; }

        /* Card destacada verde (VISA → ingresos) */
        .admin-root .dash-feature {
          background: linear-gradient(150deg, #1AA85A 0%, #0F9940 60%, #0C7A33 100%);
          border-radius: var(--admin-radius-lg);
          padding: 22px;
          color: #fff;
          box-shadow: 0 16px 40px rgba(15,153,64,0.28);
          display: flex; flex-direction: column; gap: 18px;
          flex: 1;
          position: relative; overflow: hidden;
        }
        .admin-root .dash-feature::after {
          content: ""; position: absolute; top: -40%; right: -20%;
          width: 260px; height: 260px; border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%);
          pointer-events: none;
        }
        .admin-root .dash-feature__head { display: flex; justify-content: space-between; align-items: flex-start; }
        .admin-root .dash-feature__label { font-size: 15px; font-weight: 700; }
        .admin-root .dash-feature__sublabel { font-size: 12px; opacity: 0.8; margin-top: 2px; }
        .admin-root .dash-feature__amount { font-size: 38px; font-weight: 800; letterSpacing: -0.03em; line-height: 1; }
        .admin-root .dash-feature__foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .admin-root .dash-feature__chip {
          display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600;
          background: rgba(255,255,255,0.18); padding: 5px 11px; border-radius: 100px; backdrop-filter: blur(4px);
        }

        /* Ingresos de la semana */
        .admin-root .dash-week {
          padding: 20px; display: flex; justify-content: space-between; align-items: center; gap: 12px;
        }

        /* Balance derecha */
        .admin-root .dash-balance { padding: 20px; display: flex; flex-direction: column; }
        .admin-root .dash-balance__head { display: flex; justify-content: space-between; align-items: flex-start; }
        .admin-root .dash-balance__actions { display: flex; gap: 10px; margin-top: 16px; }

        /* Fila de actividad */
        .admin-root .dash-activity {
          display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(300px, 1fr); gap: 16px; align-items: start;
        }
        .admin-root .dash-activity__side { display: flex; flex-direction: column; gap: 16px; }
        .admin-root .dash-credit { padding: 20px; }
        .admin-root .dash-credit__users { margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--admin-border); }

        /* ── Responsive ── */
        @media (max-width: 1180px) {
          .admin-root .dash-hero { grid-template-columns: minmax(280px, 320px) minmax(0, 1fr); }
          .admin-root .dash-balance { grid-column: 1 / -1; }
        }
        @media (max-width: 900px) {
          .admin-root .dash-hero { grid-template-columns: 1fr; }
          .admin-root .dash-activity { grid-template-columns: 1fr; }
        }

        .admin-root .spin { animation: au-spin 1s linear infinite; }
        @keyframes au-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
