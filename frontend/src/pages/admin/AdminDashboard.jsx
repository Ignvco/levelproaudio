// pages/admin/AdminDashboard.jsx — Dashboard rediseñado con acciones reales
import { useQuery }  from "@tanstack/react-query"
import { Link }      from "react-router-dom"
import { getAdminDashboard } from "../../api/admin.api"
import {
  DollarSign, ShoppingBag, Users, Package,
  GraduationCap, TrendingUp, AlertTriangle, ArrowRight,
  Clock, Boxes, MessageSquare,
} from "lucide-react"

// ═══════════════════════════════════════════════════════════════
// Sparkbar
// ═══════════════════════════════════════════════════════════════
function SparkBar({ data }) {
  if (!data?.length) return null
  const max = Math.max(...data.map(d => d.total || 0), 1)
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:"3px", height:"56px" }}>
      {data.slice(-30).map((d, i) => (
        <div key={i} style={{
          flex:1, borderRadius:"2px",
          background:`rgba(26,255,110,${0.15 + ((d.total||0)/max)*0.85})`,
          height:`${Math.max(4, ((d.total||0)/max)*56)}px`,
          transition:"all 300ms",
        }} />
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// KPI Card
// ═══════════════════════════════════════════════════════════════
function KPI({ label, value, sub, color="#fff", Icon, to, testId }) {
  const content = (
    <div data-testid={testId} style={{
      background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:"var(--r-xl)", padding:"18px 22px",
      transition:"all var(--dur-slow) var(--ease)", height:"100%",
    }} className={to ? "card card-glow" : ""}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"flex-start", marginBottom:"14px" }}>
        <p style={{ fontSize:"11px", color:"var(--text-3)", fontWeight:600,
          textTransform:"uppercase", letterSpacing:"0.08em" }}>{label}</p>
        {Icon && <Icon size={16} strokeWidth={1.6}
          style={{ color:"var(--text-3)", opacity:0.8 }} />}
      </div>
      <p style={{ fontSize:"28px", fontWeight:600, color, lineHeight:1,
        marginBottom:"6px", fontVariantNumeric:"tabular-nums" }}>
        {value}
      </p>
      {sub && <p style={{ fontSize:"12px", color:"var(--text-3)" }}>{sub}</p>}
    </div>
  )
  return to
    ? <Link to={to} style={{ textDecoration:"none" }}>{content}</Link>
    : content
}

// ═══════════════════════════════════════════════════════════════
// Action Card (órdenes pendientes, stock bajo)
// ═══════════════════════════════════════════════════════════════
function ActionCard({ title, icon:Icon, count, viewAllTo, viewAllLabel,
                       children, emptyMessage, accent="var(--accent)", testId }) {
  return (
    <div data-testid={testId} style={{
      background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:"var(--r-xl)", padding:"20px 22px",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"center", marginBottom:"16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{
            padding:"7px", borderRadius:"var(--r-md)",
            background:`${accent}15`, color:accent,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <Icon size={15} strokeWidth={1.8} />
          </div>
          <div>
            <p style={{ fontSize:"13px", fontWeight:500, color:"var(--text)" }}>
              {title}
            </p>
            {count !== undefined && (
              <p style={{ fontSize:"11px", color:"var(--text-3)" }}>
                {count} pendientes
              </p>
            )}
          </div>
        </div>
        {viewAllTo && (
          <Link to={viewAllTo} style={{
            fontSize:"11px", color:"var(--text-3)",
            textDecoration:"none", display:"inline-flex",
            alignItems:"center", gap:"3px",
          }}>
            {viewAllLabel || "Ver todo"}
            <ArrowRight size={11} strokeWidth={2} />
          </Link>
        )}
      </div>
      {children || (
        <p style={{ fontSize:"12px", color:"var(--text-3)",
          padding:"20px 0", textAlign:"center" }}>
          {emptyMessage}
        </p>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════
export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey:        ["admin-dashboard"],
    queryFn:         getAdminDashboard,
    refetchInterval: 60000,
  })

  const rev      = data?.revenue   || {}
  const orders   = data?.orders    || {}
  const users    = data?.users     || {}
  const products = data?.products  || {}
  const academy  = data?.academy   || {}
  const chart    = data?.sales_chart || []
  const actions  = data?.actions   || {}
  const pending  = actions.pending_orders || []
  const lowStock = actions.low_stock      || []
  const unreadRequests = actions.unread_service_requests || 0

  return (
    <div style={{ padding:"clamp(24px, 4vw, 40px)" }}>

      {/* Header */}
      <div style={{ marginBottom:"32px" }}>
        <p style={{ fontSize:"12px", color:"var(--accent)", fontWeight:600,
          letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"8px" }}>
          Panel de control
        </p>
        <h1 style={{ fontFamily:"var(--font-serif)", fontSize:"clamp(1.8rem, 3vw, 2.6rem)",
          fontWeight:300, letterSpacing:"-0.02em", marginBottom:"6px" }}>
          Bienvenido de vuelta
        </h1>
        <p style={{ fontSize:"13px", color:"var(--text-3)" }}>
          Todo lo que necesitás resolver, en un solo lugar.
        </p>
      </div>

      {isLoading ? (
        <div style={{ display:"grid",
          gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:"14px" }}>
          {[...Array(6)].map((_,i) => (
            <div key={i} className="skeleton" style={{ height:"120px" }} />
          ))}
        </div>
      ) : (
        <>
          {/* Alertas críticas si las hay */}
          {(pending.length > 0 || products.out_of_stock > 0 || unreadRequests > 0) && (
            <div data-testid="admin-alerts" style={{
              padding:"14px 18px", marginBottom:"24px",
              background:"linear-gradient(135deg, rgba(250,204,21,0.06) 0%, transparent 100%)",
              border:"1px solid rgba(250,204,21,0.25)",
              borderRadius:"var(--r-xl)",
              display:"flex", gap:"14px", alignItems:"center", flexWrap:"wrap",
            }}>
              <AlertTriangle size={16} strokeWidth={1.8}
                style={{ color:"#facc15", flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:"13px", fontWeight:500, color:"var(--text)" }}>
                  Necesitan tu atención
                </p>
                <p style={{ fontSize:"12px", color:"var(--text-3)", marginTop:"2px" }}>
                  {pending.length > 0 && `${pending.length} pedidos pendientes de confirmar · `}
                  {products.out_of_stock > 0 && `${products.out_of_stock} productos sin stock · `}
                  {unreadRequests > 0 && `${unreadRequests} solicitudes de servicio`}
                </p>
              </div>
            </div>
          )}

          {/* KPIs principales */}
          <div style={{ display:"grid",
            gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))",
            gap:"12px", marginBottom:"24px" }}>
            <KPI label="Ingresos totales"
              value={`$${Math.round(rev.total||0).toLocaleString("es-CL")}`}
              sub={`Este mes: $${Math.round(rev.this_month||0).toLocaleString("es-CL")}`}
              color="var(--accent)" Icon={DollarSign} testId="kpi-revenue" />
            <KPI label="Pedidos"
              value={orders.total||0}
              sub={`${orders.pending||0} pendientes · ${orders.today||0} hoy`}
              Icon={ShoppingBag} to="/admin/orders" testId="kpi-orders" />
            <KPI label="Usuarios"
              value={users.total||0}
              sub={`${users.new_week||0} nuevos esta semana`}
              color="#60a5fa" Icon={Users} to="/admin/users" testId="kpi-users" />
            <KPI label="Productos activos"
              value={products.total||0}
              sub={`${products.out_of_stock||0} sin stock · ${products.low_stock||0} bajo stock`}
              Icon={Package} to="/admin/products" testId="kpi-products" />
            <KPI label="Inscripciones"
              value={academy.total_enrollments||0}
              sub={`${academy.enrollments_month||0} este mes`}
              color="#c084fc" Icon={GraduationCap} to="/admin/enrollments"
              testId="kpi-enrollments" />
            <KPI label="Últimos 30 días"
              value={`$${Math.round(rev.last_30_days||0).toLocaleString("es-CL")}`}
              sub={`${orders.this_month||0} pedidos este mes`}
              color="var(--accent)" Icon={TrendingUp} testId="kpi-30days" />
          </div>

          {/* Sparkbar ventas */}
          {chart.length > 0 && (
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
              borderRadius:"var(--r-xl)", padding:"22px 26px", marginBottom:"24px" }}>
              <div style={{ display:"flex", justifyContent:"space-between",
                alignItems:"flex-start", marginBottom:"18px" }}>
                <div>
                  <p style={{ fontSize:"13px", fontWeight:500, marginBottom:"3px" }}>
                    Ventas últimos 30 días
                  </p>
                  <p style={{ fontSize:"12px", color:"var(--text-3)" }}>
                    {chart.length} días con actividad
                  </p>
                </div>
                <p style={{ fontSize:"24px", fontWeight:600, color:"var(--accent)",
                  fontVariantNumeric:"tabular-nums" }}>
                  ${Math.round(rev.last_30_days||0).toLocaleString("es-CL")}
                </p>
              </div>
              <SparkBar data={chart} />
            </div>
          )}

          {/* Grid de acciones */}
          <div style={{ display:"grid",
            gridTemplateColumns:"repeat(auto-fill, minmax(340px, 1fr))",
            gap:"14px", marginBottom:"24px" }}>

            {/* Órdenes pendientes */}
            <ActionCard
              title="Órdenes por confirmar"
              icon={Clock}
              count={pending.length}
              viewAllTo="/admin/orders"
              accent="#facc15"
              testId="action-pending-orders"
              emptyMessage="No hay órdenes pendientes ✓">
              {pending.length > 0 && (
                <div style={{ display:"flex", flexDirection:"column", gap:"7px" }}>
                  {pending.map(o => (
                    <Link key={o.id} to={`/admin/orders?id=${o.id}`}
                      style={{
                        display:"flex", justifyContent:"space-between",
                        alignItems:"center", padding:"10px 12px",
                        background:"var(--surface-2)", border:"1px solid var(--border)",
                        borderRadius:"var(--r-md)", textDecoration:"none",
                        gap:"10px",
                      }}>
                      <div style={{ minWidth:0, flex:1 }}>
                        <p style={{ fontSize:"12px", fontWeight:500,
                          color:"var(--text)", fontFamily:"monospace" }}>
                          #{o.short_id}
                        </p>
                        <p style={{ fontSize:"11px", color:"var(--text-3)",
                          marginTop:"2px", overflow:"hidden",
                          textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {o.user_name} · {o.items_count} items · {o.created}
                        </p>
                      </div>
                      <p style={{ fontSize:"13px", fontWeight:600, color:"#facc15",
                        fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" }}>
                        ${Number(o.total).toLocaleString("es-CL")}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </ActionCard>

            {/* Stock bajo */}
            <ActionCard
              title="Stock bajo o agotado"
              icon={Boxes}
              count={lowStock.length}
              viewAllTo="/admin/inventory"
              accent="#f87171"
              testId="action-low-stock"
              emptyMessage="Todo en stock ✓">
              {lowStock.length > 0 && (
                <div style={{ display:"flex", flexDirection:"column", gap:"7px" }}>
                  {lowStock.map(p => (
                    <Link key={p.id} to={`/admin/products?highlight=${p.id}`}
                      style={{
                        display:"flex", justifyContent:"space-between",
                        alignItems:"center", padding:"10px 12px",
                        background:"var(--surface-2)", border:"1px solid var(--border)",
                        borderRadius:"var(--r-md)", textDecoration:"none",
                      }}>
                      <div style={{ minWidth:0, flex:1 }}>
                        <p style={{ fontSize:"12px", fontWeight:500,
                          color:"var(--text)", overflow:"hidden",
                          textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {p.name}
                        </p>
                        <p style={{ fontSize:"11px", color:"var(--text-3)",
                          marginTop:"2px" }}>
                          ${Number(p.price).toLocaleString("es-CL")}
                        </p>
                      </div>
                      <p style={{
                        fontSize:"12px", fontWeight:600, whiteSpace:"nowrap",
                        color: p.stock === 0 ? "#ef4444" : "#facc15",
                        fontVariantNumeric:"tabular-nums",
                      }}>
                        {p.stock === 0 ? "Agotado" : `${p.stock} u.`}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </ActionCard>

            {/* Solicitudes de servicios */}
            {unreadRequests > 0 && (
              <ActionCard
                title="Solicitudes de servicios"
                icon={MessageSquare}
                count={unreadRequests}
                viewAllTo="/admin/services"
                accent="#60a5fa"
                testId="action-service-requests"
                emptyMessage="Sin solicitudes nuevas">
                <p style={{ fontSize:"13px", color:"var(--text-2)",
                  padding:"10px 12px", background:"var(--surface-2)",
                  border:"1px solid var(--border)", borderRadius:"var(--r-md)" }}>
                  Tenés <strong style={{ color:"#60a5fa" }}>{unreadRequests}</strong>{" "}
                  cotizaciones esperando respuesta.
                </p>
              </ActionCard>
            )}
          </div>
        </>
      )}
    </div>
  )
}
