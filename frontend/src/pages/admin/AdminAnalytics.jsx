// pages/admin/AdminAnalytics.jsx
import { useQuery } from "@tanstack/react-query"
import { getAnalytics } from "../../api/admin.api"
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"

const ACCENT = "#1aff6e"
const COLORS = ["#1aff6e","#60a5fa","#facc15","#f87171","#c084fc","#fb923c","#34d399","#a78bfa"]

const statusLabels   = { pending:"Pendiente", paid:"Pagado", shipped:"Enviado", completed:"Completado", cancelled:"Cancelado" }
const providerLabels = { mercadopago_cl:"MP Chile", mercadopago_ar:"MP Argentina", paypal:"PayPal", global66:"Global66", transfer:"Transferencia", cash:"Manual" }

const CustomTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:"var(--surface-2)", border:"1px solid var(--border)",
      borderRadius:"var(--r-md)", padding:"10px 14px", fontSize:"12px" }}>
      <p style={{ color:"var(--text-2)", marginBottom:"4px" }}>{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{ color: p.color || ACCENT, fontWeight:500 }}>
          {currency ? `$${Number(p.value).toLocaleString("es-CL")}` : p.value}
        </p>
      ))}
    </div>
  )
}

function KpiCard({ label, value, sub, accent }) {
  return (
    <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:"var(--r-xl)", padding:"20px 22px" }}>
      <p style={{ fontSize:"11px", color:"var(--text-3)", textTransform:"uppercase",
        letterSpacing:"0.08em", fontWeight:500, marginBottom:"10px" }}>{label}</p>
      <p style={{ fontFamily:"var(--font-serif)", fontSize:"1.9rem", lineHeight:1,
        marginBottom:"6px", color: accent ? "var(--accent)" : "var(--text)" }}>{value}</p>
      {sub && <p style={{ fontSize:"12px", color:"var(--text-3)" }}>{sub}</p>}
    </div>
  )
}

function ChartCard({ title, subtitle, children, span }) {
  return (
    <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:"var(--r-xl)", padding:"22px 24px",
      gridColumn: span ? `span ${span}` : undefined }}>
      <p style={{ fontSize:"14px", fontWeight:500, marginBottom:"4px" }}>{title}</p>
      {subtitle && <p style={{ fontSize:"12px", color:"var(--text-3)", marginBottom:"20px" }}>{subtitle}</p>}
      {!subtitle && <div style={{ marginBottom:"20px" }} />}
      {children}
    </div>
  )
}

export default function AdminAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey:        ["admin-analytics"],
    queryFn:         getAnalytics,
    refetchInterval: 120000,
  })

  if (isLoading) return (
    <div style={{ padding:"clamp(24px, 4vw, 40px)" }}>
      <div style={{ marginBottom:"32px" }}>
        <div className="skeleton" style={{ height:"36px", width:"200px", marginBottom:"8px" }} />
        <div className="skeleton" style={{ height:"16px", width:"300px" }} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"12px", marginBottom:"24px" }}>
        {[...Array(4)].map((_,i) => <div key={i} className="skeleton" style={{ height:"100px" }} />)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
        {[...Array(4)].map((_,i) => <div key={i} className="skeleton" style={{ height:"280px" }} />)}
      </div>
    </div>
  )

  if (!data) return (
    <div style={{ padding:"clamp(24px, 4vw, 40px)", color:"var(--text-3)", fontSize:"14px" }}>
      Error al cargar analytics. Revisá la consola del backend.
    </div>
  )

  const { kpis, sales_by_month, orders_by_status, users_by_month,
    revenue_by_provider, low_stock_products, revenue_by_category, enrollments_by_month } = data

  const ordersChart   = orders_by_status.map(o => ({ ...o, label: statusLabels[o.status] || o.status }))
  const providerChart = revenue_by_provider.map(p => ({ ...p, label: providerLabels[p.provider] || p.provider }))

  return (
    <div style={{ padding:"clamp(24px, 4vw, 40px)", maxWidth:"1200px" }}>

      {/* Header */}
      <div style={{ marginBottom:"32px" }}>
        <h1 style={{ fontFamily:"var(--font-serif)", fontSize:"clamp(1.8rem, 3vw, 2.4rem)",
          fontWeight:300, letterSpacing:"-0.02em", marginBottom:"6px" }}>Analytics</h1>
        <p style={{ fontSize:"13px", color:"var(--text-3)" }}>
          Últimos 12 meses · actualizado cada 2 minutos.
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))",
        gap:"12px", marginBottom:"28px" }}>
        <KpiCard label="Ingresos totales"
          value={`$${Number(kpis.total_revenue).toLocaleString("es-CL")}`} accent />
        <KpiCard label="Ticket promedio"
          value={`$${Number(kpis.avg_order_value).toLocaleString("es-CL")}`}
          sub="Por orden pagada" />
        <KpiCard label="Clientes únicos" value={kpis.total_customers}
          sub={`${kpis.repeat_customers} compraron más de una vez`} />
        <KpiCard label="Tasa de repetición" value={`${kpis.repeat_rate}%`}
          sub="Clientes que repiten" accent={kpis.repeat_rate > 20} />
      </div>

      {/* Fila 1 */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:"16px", marginBottom:"16px" }}>
        <ChartCard title="Ventas por mes"
          subtitle={`${sales_by_month.length} meses · últimos 12 meses`}>
          {sales_by_month.length === 0
            ? <p style={{ color:"var(--text-3)", fontSize:"13px", textAlign:"center", padding:"40px 0" }}>Sin datos todavía.</p>
            : <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sales_by_month} margin={{ top:0, right:0, left:-20, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize:11, fill:"var(--text-3)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:11, fill:"var(--text-3)" }} axisLine={false} tickLine={false}
                    tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip currency />} />
                  <Bar dataKey="total" fill={ACCENT} radius={[4,4,0,0]} opacity={0.9} />
                </BarChart>
              </ResponsiveContainer>
          }
        </ChartCard>

        <ChartCard title="Órdenes por estado" subtitle="Distribución total">
          {ordersChart.length === 0
            ? <p style={{ color:"var(--text-3)", fontSize:"13px", textAlign:"center", padding:"40px 0" }}>Sin datos.</p>
            : <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={ordersChart} dataKey="count" nameKey="label"
                      cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {ordersChart.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background:"var(--surface-2)", border:"1px solid var(--border)",
                      borderRadius:"var(--r-md)", fontSize:"12px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display:"flex", flexDirection:"column", gap:"6px", marginTop:"8px" }}>
                  {ordersChart.map((item,i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                        <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:COLORS[i%COLORS.length] }} />
                        <span style={{ fontSize:"12px", color:"var(--text-2)" }}>{item.label}</span>
                      </div>
                      <span style={{ fontSize:"12px", fontWeight:500 }}>{item.count}</span>
                    </div>
                  ))}
                </div>
              </>
          }
        </ChartCard>
      </div>

      {/* Fila 2 */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px", marginBottom:"16px" }}>
        <ChartCard title="Nuevos usuarios por mes" subtitle="Últimos 12 meses">
          {users_by_month.length === 0
            ? <p style={{ color:"var(--text-3)", fontSize:"13px", textAlign:"center", padding:"40px 0" }}>Sin datos todavía.</p>
            : <ResponsiveContainer width="100%" height={200}>
                <LineChart data={users_by_month} margin={{ top:0, right:0, left:-20, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize:11, fill:"var(--text-3)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:11, fill:"var(--text-3)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="count" stroke={COLORS[1]} strokeWidth={2}
                    dot={{ fill:COLORS[1], r:3 }} activeDot={{ r:5 }} />
                </LineChart>
              </ResponsiveContainer>
          }
        </ChartCard>

        <ChartCard title="Ingresos por método de pago" subtitle="Pagos aprobados">
          {providerChart.length === 0
            ? <p style={{ color:"var(--text-3)", fontSize:"13px", textAlign:"center", padding:"40px 0" }}>Sin pagos aprobados todavía.</p>
            : <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                {providerChart.map((p,i) => {
                  const max = providerChart[0]?.total || 1
                  const pct = (p.total / max) * 100
                  return (
                    <div key={i}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
                        <span style={{ fontSize:"13px", color:"var(--text-2)" }}>{p.label}</span>
                        <span style={{ fontSize:"13px", fontWeight:500 }}>
                          ${Number(p.total).toLocaleString("es-CL")}
                          <span style={{ fontSize:"11px", color:"var(--text-3)", fontWeight:400, marginLeft:"6px" }}>
                            ({p.count} pagos)
                          </span>
                        </span>
                      </div>
                      <div style={{ height:"6px", borderRadius:"3px", background:"var(--surface-3)", overflow:"hidden" }}>
                        <div style={{ height:"100%", borderRadius:"3px", background:COLORS[i%COLORS.length],
                          width:`${pct}%`, transition:"width 600ms var(--ease)" }} />
                      </div>
                    </div>
                  )
                })}
              </div>
          }
        </ChartCard>
      </div>

      {/* Fila 3 */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px", marginBottom:"16px" }}>
        <ChartCard title="Ingresos por categoría" subtitle="Basado en ítems vendidos">
          {revenue_by_category.length === 0
            ? <p style={{ color:"var(--text-3)", fontSize:"13px", textAlign:"center", padding:"40px 0" }}>Sin ventas todavía.</p>
            : <ResponsiveContainer width="100%" height={220}>
                <BarChart data={revenue_by_category} layout="vertical"
                  margin={{ top:0, right:0, left:60, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize:11, fill:"var(--text-3)" }} axisLine={false} tickLine={false}
                    tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize:11, fill:"var(--text-2)" }}
                    axisLine={false} tickLine={false} width={60} />
                  <Tooltip content={<CustomTooltip currency />} />
                  <Bar dataKey="total" radius={[0,4,4,0]}>
                    {revenue_by_category.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
          }
        </ChartCard>

        <ChartCard title="Inscripciones academia" subtitle="Últimos 12 meses">
          {enrollments_by_month.length === 0
            ? <p style={{ color:"var(--text-3)", fontSize:"13px", textAlign:"center", padding:"40px 0" }}>Sin inscripciones todavía.</p>
            : <ResponsiveContainer width="100%" height={220}>
                <BarChart data={enrollments_by_month} margin={{ top:0, right:0, left:-20, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize:11, fill:"var(--text-3)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:11, fill:"var(--text-3)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill={COLORS[4]} radius={[4,4,0,0]} opacity={0.9} />
                </BarChart>
              </ResponsiveContainer>
          }
        </ChartCard>
      </div>

      {/* Bajo stock */}
      <ChartCard title="Productos con bajo stock" subtitle="Stock ≤ 10 unidades">
        {low_stock_products.length === 0
          ? <p style={{ color:"var(--text-3)", fontSize:"13px", textAlign:"center", padding:"20px 0" }}>✓ Todos los productos tienen stock suficiente.</p>
          : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:"10px" }}>
              {low_stock_products.map((p,i) => (
                <div key={i} style={{ padding:"14px 16px", borderRadius:"var(--r-lg)",
                  background:"var(--surface-2)", border:"1px solid var(--border)",
                  display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ minWidth:0 }}>
                    <p style={{ fontSize:"13px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</p>
                    {p.sku && <p style={{ fontSize:"11px", color:"var(--text-3)", fontFamily:"monospace" }}>{p.sku}</p>}
                  </div>
                  <span style={{ fontSize:"15px", fontWeight:700, marginLeft:"12px", flexShrink:0,
                    color: p.stock === 0 ? "var(--danger)" : p.stock <= 3 ? "#f87171" : "#facc15" }}>
                    {p.stock}
                  </span>
                </div>
              ))}
            </div>
        }
      </ChartCard>
    </div>
  )
}
