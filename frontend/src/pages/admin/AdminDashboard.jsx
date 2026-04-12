// pages/admin/AdminDashboard.jsx
import { useQuery }  from "@tanstack/react-query"
import { Link }      from "react-router-dom"
import { getAdminDashboard } from "../../api/admin.api"

// Mini sparkbar con datos reales de sales_chart
function SparkBar({ data }) {
  if (!data?.length) return null
  const max = Math.max(...data.map(d => d.total || 0), 1)
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:"2px", height:"36px" }}>
      {data.slice(-20).map((d, i) => (
        <div key={i} style={{
          flex:1, borderRadius:"2px",
          background:`rgba(26,255,110,${0.15 + ((d.total||0)/max)*0.85})`,
          height:`${Math.max(3, ((d.total||0)/max)*36)}px`,
        }} />
      ))}
    </div>
  )
}

function KPI({ label, value, sub, color="var(--accent)", icon, to }) {
  const content = (
    <div style={{
      background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:"var(--r-xl)", padding:"20px 24px",
      transition:"all var(--dur-slow) var(--ease)",
    }} className={to ? "card card-glow" : ""}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"flex-start", marginBottom:"12px" }}>
        <p style={{ fontSize:"11px", color:"var(--text-3)", fontWeight:500,
          textTransform:"uppercase", letterSpacing:"0.08em" }}>{label}</p>
        {icon && <span style={{ fontSize:"18px" }}>{icon}</span>}
      </div>
      <p style={{ fontFamily:"var(--font-serif)", fontSize:"2.2rem",
        color, lineHeight:1, marginBottom:"4px" }}>
        {value}
      </p>
      {sub && <p style={{ fontSize:"12px", color:"var(--text-3)" }}>{sub}</p>}
    </div>
  )
  return to
    ? <Link to={to} style={{ textDecoration:"none" }}>{content}</Link>
    : content
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey:        ["admin-dashboard"],
    queryFn:         getAdminDashboard,
    refetchInterval: 60000,
  })

  // ── campos reales del backend ──
  // data.revenue.total / data.revenue.this_month / data.revenue.last_30_days
  // data.orders.total / data.orders.pending / data.orders.today / data.orders.this_month
  // data.users.total / data.users.new_week / data.users.new_month
  // data.products.total / data.products.low_stock / data.products.out_of_stock
  // data.academy.total_enrollments / data.academy.enrollments_month
  // data.sales_chart[] { date, total }

  const rev      = data?.revenue   || {}
  const orders   = data?.orders    || {}
  const users    = data?.users     || {}
  const products = data?.products  || {}
  const academy  = data?.academy   || {}
  const chart    = data?.sales_chart || []

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
          Dashboard
        </h1>
        <p style={{ fontSize:"13px", color:"var(--text-3)" }}>
          Visión general del negocio en tiempo real.
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
          {/* KPIs principales */}
          <div style={{ display:"grid",
            gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))",
            gap:"14px", marginBottom:"28px" }}>
            <KPI label="Ingresos totales"
              value={`$${Math.round(rev.total||0).toLocaleString("es-CL")}`}
              sub={`Este mes: $${Math.round(rev.this_month||0).toLocaleString("es-CL")}`}
              color="var(--accent)" icon="💰" />
            <KPI label="Pedidos totales"
              value={orders.total||0}
              sub={`${orders.pending||0} pendientes · ${orders.today||0} hoy`}
              color="var(--text)" icon="◫" to="/admin/orders" />
            <KPI label="Usuarios"
              value={users.total||0}
              sub={`${users.new_week||0} nuevos esta semana`}
              color="#60a5fa" icon="○" to="/admin/users" />
            <KPI label="Productos activos"
              value={products.total||0}
              sub={`${products.out_of_stock||0} sin stock · ${products.low_stock||0} bajo stock`}
              color="var(--text)" icon="⊞" to="/admin/products" />
            <KPI label="Inscripciones academia"
              value={academy.total_enrollments||0}
              sub={`${academy.enrollments_month||0} este mes`}
              color="#c084fc" icon="▷" to="/admin/enrollments" />
            <KPI label="Ingresos últimos 30 días"
              value={`$${Math.round(rev.last_30_days||0).toLocaleString("es-CL")}`}
              sub={`${orders.this_month||0} pedidos este mes`}
              color="var(--accent)" icon="📈" />
          </div>

          {/* Sparkbar ventas */}
          {chart.length > 0 && (
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
              borderRadius:"var(--r-xl)", padding:"20px 24px", marginBottom:"28px" }}>
              <div style={{ display:"flex", justifyContent:"space-between",
                alignItems:"flex-start", marginBottom:"14px" }}>
                <div>
                  <p style={{ fontSize:"13px", fontWeight:500, marginBottom:"3px" }}>
                    Ventas últimos 30 días
                  </p>
                  <p style={{ fontSize:"12px", color:"var(--text-3)" }}>
                    {chart.length} días con actividad registrada
                  </p>
                </div>
                <p style={{ fontFamily:"var(--font-serif)", fontSize:"1.4rem",
                  color:"var(--accent)" }}>
                  ${Math.round(rev.last_30_days||0).toLocaleString("es-CL")}
                </p>
              </div>
              <SparkBar data={chart} />
            </div>
          )}

          {/* Banner producto hero */}
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
            borderRadius:"var(--r-xl)", padding:"20px 24px",
            display:"flex", alignItems:"center", gap:"16px", marginBottom:"28px" }}>
            <span style={{ fontSize:"24px" }}>🎯</span>
            <div>
              <p style={{ fontSize:"13px", fontWeight:500, marginBottom:"3px" }}>
                Producto del Hero (Home)
              </p>
              <p style={{ fontSize:"12px", color:"var(--text-3)" }}>
                El primer producto con "Destacado = Sí" e imagen aparece en el hero del sitio.
              </p>
            </div>
            <Link to="/admin/products" className="btn btn-ghost"
              style={{ marginLeft:"auto", flexShrink:0, padding:"8px 16px", fontSize:"13px" }}>
              Gestionar productos →
            </Link>
          </div>

          {/* Accesos rápidos */}
          <div style={{ display:"grid",
            gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))", gap:"10px" }}>
            {[
              { to:"/admin/orders",    icon:"◫", label:"Órdenes"      },
              { to:"/admin/products",  icon:"⊞", label:"Productos"    },
              { to:"/admin/payments",  icon:"◎", label:"Pagos"        },
              { to:"/admin/finance",   icon:"⬡", label:"Finanzas"     },
              { to:"/admin/inventory", icon:"◧", label:"Inventario"   },
              { to:"/admin/loyalty",   icon:"⭐", label:"Fidelización" },
              { to:"/admin/billing",   icon:"◧", label:"Facturación"  },
              { to:"/admin/users",     icon:"○", label:"Usuarios"     },
            ].map(({ to, icon, label }) => (
              <Link key={to} to={to} style={{
                display:"flex", alignItems:"center", gap:"10px",
                padding:"14px 16px", borderRadius:"var(--r-xl)",
                background:"var(--surface)", border:"1px solid var(--border)",
                fontSize:"13px", color:"var(--text-2)", textDecoration:"none",
                transition:"all var(--dur-slow) var(--ease)",
              }} className="card card-glow">
                <span style={{ fontSize:"14px" }}>{icon}</span>
                {label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}