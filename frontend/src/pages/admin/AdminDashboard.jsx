// pages/admin/AdminDashboard.jsx — Rediseño estilo "DealDeck" con datos reales
import { useQuery }  from "@tanstack/react-query"
import { Link }      from "react-router-dom"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts"
import { getAdminDashboard } from "../../api/admin.api"
import {
  DollarSign, ShoppingBag, Users, Package,
  GraduationCap, ArrowRight, Clock, Boxes, MessageSquare, AlertTriangle,
} from "lucide-react"

const clp = n => `$${Math.round(n||0).toLocaleString("es-CL")}`

// ── KPI card ──
function MetricCard({ Icon, label, value, note, badge, to, testId }) {
  const body = (
    <div className="a-card a-kpi-hover" data-testid={testId}
      style={{ padding:"22px", display:"flex", flexDirection:"column", gap:"14px", height:"100%" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <span className="a-kpi-tile"><Icon size={20} strokeWidth={2} /></span>
        {badge && <span className={`a-badge ${badge.positive ? "pos" : "neg"}`}>{badge.text}</span>}
      </div>
      <div>
        <p style={{ fontSize:"13.5px", color:"var(--text-2)", fontWeight:500, marginBottom:"4px" }}>{label}</p>
        <div style={{ display:"flex", alignItems:"baseline", gap:"10px", flexWrap:"wrap" }}>
          <p style={{ fontSize:"30px", fontWeight:800, color:"var(--text)", letterSpacing:"-0.02em",
            lineHeight:1, fontVariantNumeric:"tabular-nums" }}>{value}</p>
          {note && <p style={{ fontSize:"12px", color:"var(--text-3)" }}>{note}</p>}
        </div>
      </div>
    </div>
  )
  return to ? <Link to={to} style={{ textDecoration:"none" }}>{body}</Link> : body
}

// ── Card destacada (ingresos) ──
function FeaturedCard({ value, note, badge }) {
  return (
    <div data-testid="kpi-revenue" style={{ background:"#1AFF6E", borderRadius:"20px", padding:"22px",
      display:"flex", flexDirection:"column", gap:"14px", height:"100%",
      boxShadow:"0 14px 34px rgba(26,255,110,0.35)" }} className="a-kpi-hover">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <span style={{ width:"46px", height:"46px", borderRadius:"14px", background:"rgba(0,0,0,0.12)",
          color:"#00120a", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <DollarSign size={20} strokeWidth={2.2} /></span>
        {badge && <span style={{ padding:"4px 10px", borderRadius:"100px", fontSize:"12px",
          fontWeight:700, background:"rgba(0,0,0,0.15)", color:"#00160b" }}>{badge}</span>}
      </div>
      <div>
        <p style={{ fontSize:"13.5px", color:"rgba(0,20,8,0.7)", fontWeight:600, marginBottom:"4px" }}>Ingresos totales</p>
        <p style={{ fontSize:"32px", fontWeight:800, color:"#00160b", letterSpacing:"-0.02em",
          lineHeight:1, fontVariantNumeric:"tabular-nums" }}>{value}</p>
        {note && <p style={{ fontSize:"12px", color:"rgba(0,20,8,0.65)", marginTop:"6px" }}>{note}</p>}
      </div>
    </div>
  )
}

// ── Tooltip oscuro redondeado (estilo mockup) ──
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:"#0D0D0F", color:"#fff", padding:"10px 14px", borderRadius:"12px",
      boxShadow:"0 8px 24px rgba(0,0,0,0.25)", border:"1px solid rgba(255,255,255,0.08)" }}>
      <p style={{ fontSize:"11px", color:"#9CA3AF", marginBottom:"3px" }}>{label}</p>
      <p style={{ fontSize:"15px", fontWeight:700, color:"#1AFF6E",
        fontVariantNumeric:"tabular-nums" }}>{clp(payload[0].value)}</p>
    </div>
  )
}

// ── Gráfico de barras interactivo (Recharts, ventas reales) ──
function SalesBarChart({ data }) {
  const fmtDay = d => {
    try { return new Date(d).toLocaleDateString("es-CL", { day:"2-digit", month:"short" }) }
    catch { return d }
  }
  const points = (data || []).slice(-14).map(d => ({ day: fmtDay(d.date), total: d.total || 0 }))
  if (!points.length) return (
    <p style={{ fontSize:"13px", color:"var(--text-3)", textAlign:"center", padding:"60px 0" }}>
      Sin ventas registradas todavía.</p>
  )
  const max = Math.max(...points.map(p => p.total), 1)
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={points} margin={{ top: 10, right: 6, left: -18, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ECEEF2" />
        <XAxis dataKey="day" tickLine={false} axisLine={false}
          tick={{ fontSize: 11, fill: "#98A2B3" }} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} width={54}
          tick={{ fontSize: 11, fill: "#98A2B3" }}
          tickFormatter={v => v >= 1000 ? `$${Math.round(v/1000)}k` : `$${v}`} />
        <Tooltip cursor={{ fill: "rgba(26,255,110,0.06)" }} content={<ChartTooltip />} />
        <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={34}>
          {points.map((p, i) => (
            <Cell key={i} fill={p.total >= max * 0.6 ? "#1AFF6E" : "#E5E7EB"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Fila de resumen ──
function SummaryRow({ label, value, badge }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"12px 0", borderBottom:"1px solid var(--border)" }}>
      <span style={{ fontSize:"13.5px", color:"var(--text-2)" }}>{label}</span>
      <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
        <span style={{ fontSize:"15px", fontWeight:700, color:"var(--text)",
          fontVariantNumeric:"tabular-nums" }}>{value}</span>
        {badge && <span className={`a-badge ${badge.positive ? "pos" : "neg"}`}>{badge.text}</span>}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey:["admin-dashboard"], queryFn:getAdminDashboard, refetchInterval:60000,
  })

  const rev=data?.revenue||{}, orders=data?.orders||{}, users=data?.users||{}
  const products=data?.products||{}, academy=data?.academy||{}, chart=data?.sales_chart||[]
  const actions=data?.actions||{}
  const pending=actions.pending_orders||[], lowStock=actions.low_stock||[]
  const unread=actions.unread_service_requests||0

  if (isLoading) return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(230px,1fr))", gap:"18px" }}>
      {[...Array(4)].map((_,i)=><div key={i} className="a-card" style={{ height:"150px" }} />)}
    </div>
  )

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"18px", paddingBottom:"20px" }}>

      {/* Alertas reales */}
      {(pending.length>0 || products.out_of_stock>0 || unread>0) && (
        <div data-testid="admin-alerts" className="a-card" style={{ padding:"16px 20px",
          display:"flex", gap:"14px", alignItems:"center", flexWrap:"wrap",
          background:"#FFFBEB", border:"1px solid #FDE68A" }}>
          <AlertTriangle size={18} style={{ color:"#D97706", flexShrink:0 }} />
          <p style={{ fontSize:"13px", color:"#92400E", flex:1 }}>
            {pending.length>0 && `${pending.length} pedidos pendientes · `}
            {products.out_of_stock>0 && `${products.out_of_stock} productos sin stock · `}
            {unread>0 && `${unread} solicitudes de servicio`}
          </p>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(230px,1fr))", gap:"18px" }}>
        <FeaturedCard value={clp(rev.total)} note={`Este mes: ${clp(rev.this_month)}`}
          badge={rev.this_month>0 ? "Este mes" : null} />
        <MetricCard Icon={ShoppingBag} label="Pedidos" value={orders.total||0}
          note="totales" to="/admin/orders" testId="kpi-orders"
          badge={orders.today>0 ? { text:`+${orders.today} hoy`, positive:true } : null} />
        <MetricCard Icon={Users} label="Usuarios" value={users.total||0}
          note="registrados" to="/admin/users" testId="kpi-users"
          badge={users.new_week>0 ? { text:`+${users.new_week} sem`, positive:true } : null} />
        <MetricCard Icon={Package} label="Productos activos" value={products.total||0}
          note="en catálogo" to="/admin/products" testId="kpi-products"
          badge={products.out_of_stock>0 ? { text:`${products.out_of_stock} agotados`, positive:false } : null} />
      </div>

      {/* Gráfico + resumen */}
      <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1.6fr) minmax(0,1fr)", gap:"18px" }}
        className="admin-grid-2">
        <div className="a-card" style={{ padding:"24px" }} data-testid="admin-sales-chart">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"6px" }}>
            <div>
              <h2 style={{ fontSize:"18px", fontWeight:800, color:"var(--text)", letterSpacing:"-0.01em" }}>
                Ventas recientes</h2>
              <p style={{ fontSize:"13px", color:"var(--text-3)", marginTop:"2px" }}>Últimos días con actividad</p>
            </div>
            <span style={{ fontSize:"22px", fontWeight:800, color:"#0F9940",
              fontVariantNumeric:"tabular-nums" }}>{clp(rev.last_30_days)}</span>
          </div>
          <SalesBarChart data={chart} />
        </div>

        <div className="a-card" style={{ padding:"24px" }} data-testid="admin-summary">
          <h2 style={{ fontSize:"18px", fontWeight:800, color:"var(--text)", letterSpacing:"-0.01em", marginBottom:"6px" }}>
            Resumen</h2>
          <p style={{ fontSize:"13px", color:"var(--text-3)", marginBottom:"8px" }}>Estado de tu operación</p>
          <SummaryRow label="Pedidos pendientes" value={orders.pending||0}
            badge={pending.length>0 ? { text:"revisar", positive:false } : null} />
          <SummaryRow label="Ventas del mes" value={clp(rev.this_month)} />
          <SummaryRow label="Productos sin stock" value={products.out_of_stock||0}
            badge={products.out_of_stock>0 ? { text:"agotado", positive:false } : { text:"ok", positive:true }} />
          <SummaryRow label="Stock bajo" value={products.low_stock||0} />
          <SummaryRow label="Inscripciones academia" value={academy.total_enrollments||0}
            badge={academy.enrollments_month>0 ? { text:`+${academy.enrollments_month}`, positive:true } : null} />
        </div>
      </div>

      {/* Acciones */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(320px,1fr))", gap:"18px" }}>
        {/* Órdenes pendientes */}
        <div className="a-card" style={{ padding:"22px" }} data-testid="action-pending-orders">
          <ActionHeader Icon={Clock} title="Órdenes por confirmar" count={pending.length} to="/admin/orders" />
          {pending.length ? (
            <div style={{ display:"flex", flexDirection:"column", gap:"8px", marginTop:"12px" }}>
              {pending.slice(0,5).map(o => (
                <Link key={o.id} to={`/admin/orders?id=${o.id}`} style={rowStyle}>
                  <div style={{ minWidth:0, flex:1 }}>
                    <p style={{ fontSize:"12.5px", fontWeight:600, color:"var(--text)", fontFamily:"monospace" }}>#{o.short_id}</p>
                    <p style={{ fontSize:"11px", color:"var(--text-3)", marginTop:"2px", overflow:"hidden",
                      textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{o.user_name} · {o.items_count} items</p>
                  </div>
                  <span style={{ fontSize:"13px", fontWeight:700, color:"#0F9940" }}>{clp(o.total)}</span>
                </Link>
              ))}
            </div>
          ) : <Empty msg="No hay órdenes pendientes ✓" />}
        </div>

        {/* Stock bajo */}
        <div className="a-card" style={{ padding:"22px" }} data-testid="action-low-stock">
          <ActionHeader Icon={Boxes} title="Stock bajo o agotado" count={lowStock.length} to="/admin/inventory" />
          {lowStock.length ? (
            <div style={{ display:"flex", flexDirection:"column", gap:"8px", marginTop:"12px" }}>
              {lowStock.slice(0,5).map(p => (
                <Link key={p.id} to={`/admin/products?highlight=${p.id}`} style={rowStyle}>
                  <p style={{ fontSize:"12.5px", fontWeight:600, color:"var(--text)", overflow:"hidden",
                    textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{p.name}</p>
                  <span style={{ fontSize:"12.5px", fontWeight:700,
                    color: p.stock===0 ? "#EF4444" : "#D97706" }}>
                    {p.stock===0 ? "Agotado" : `${p.stock} u.`}</span>
                </Link>
              ))}
            </div>
          ) : <Empty msg="Todo en stock ✓" />}
        </div>

        {/* Solicitudes */}
        {unread>0 && (
          <div className="a-card" style={{ padding:"22px" }} data-testid="action-service-requests">
            <ActionHeader Icon={MessageSquare} title="Solicitudes de servicios" count={unread} to="/admin/services" />
            <p style={{ fontSize:"13px", color:"var(--text-2)", marginTop:"12px", padding:"12px 14px",
              background:"var(--surface-2)", borderRadius:"12px" }}>
              Tenés <strong style={{ color:"#0F9940" }}>{unread}</strong> cotizaciones esperando respuesta.</p>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 900px) { .admin-grid-2 { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}

const rowStyle = { display:"flex", justifyContent:"space-between", alignItems:"center", gap:"10px",
  padding:"11px 13px", background:"var(--surface-2)", borderRadius:"12px", textDecoration:"none" }

function ActionHeader({ Icon, title, count, to }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
        <span className="a-kpi-tile" style={{ width:"38px", height:"38px", borderRadius:"11px" }}>
          <Icon size={17} strokeWidth={2} /></span>
        <div>
          <p style={{ fontSize:"13.5px", fontWeight:700, color:"var(--text)" }}>{title}</p>
          <p style={{ fontSize:"11.5px", color:"var(--text-3)" }}>{count} pendientes</p>
        </div>
      </div>
      <Link to={to} style={{ fontSize:"12px", color:"#0F9940", textDecoration:"none",
        display:"inline-flex", alignItems:"center", gap:"3px", fontWeight:600 }}>
        Ver todo <ArrowRight size={12} strokeWidth={2.2} />
      </Link>
    </div>
  )
}
const Empty = ({ msg }) => (
  <p style={{ fontSize:"12.5px", color:"var(--text-3)", padding:"24px 0", textAlign:"center" }}>{msg}</p>
)
