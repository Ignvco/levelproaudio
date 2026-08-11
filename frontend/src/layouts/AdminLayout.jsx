// layouts/AdminLayout.jsx — Rediseño estilo "DealDeck": sidebar oscuro flotante + topbar claro
import { useState, useEffect, useRef }                      from "react"
import { NavLink, Link, useNavigate, useLocation, Outlet }  from "react-router-dom"
import { useQuery }                                          from "@tanstack/react-query"
import { useAuthStore }                                      from "../store/authStore"
import { getAdminDashboard }                                 from "../api/admin.api"
import AdminSearch                                           from "../components/admin/AdminSearch"
import logoImg                                               from "../assets/logo.png"
import { useSiteSettings }                                   from "../hooks/useSiteSettings"
import {
  LayoutDashboard, LineChart, BarChart3, ChevronRight, ChevronsLeft,
  ShoppingBag, CreditCard, Users, Package, Boxes, GraduationCap,
  Wrench, Gift, Wallet, Receipt, Star, Palette, ExternalLink, LogOut,
  Search, Bell, Menu, X, Clock, AlertTriangle, MessageSquare, CheckCircle2,
} from "lucide-react"

// ── Mapa de navegación (conserva TODAS las rutas actuales) ──
const navItems = [
  { sep:"Panel" },
  { to:"/admin",           label:"Dashboard",       icon:LayoutDashboard, end:true },
  { to:"/admin/executive", label:"Vista Ejecutiva", icon:LineChart },
  { to:"/admin/analytics", label:"Analytics",       icon:BarChart3 },

  { sep:"Ventas" },
  { to:"/admin/orders",   label:"Órdenes",   icon:ShoppingBag },
  { to:"/admin/payments", label:"Pagos",     icon:CreditCard },
  { to:"/admin/services", label:"Servicios", icon:Wrench },
  { to:"/admin/users",    label:"Usuarios",  icon:Users },

  { sep:"Catálogo" },
  { label:"Productos", icon:Package, children:[
    { to:"/admin/products",        label:"Catálogo"   },
    { to:"/admin/brands",          label:"Marcas"     },
    { to:"/admin/categories",      label:"Categorías" },
    { to:"/admin/products/import", label:"Importar"   },
  ]},
  { to:"/admin/inventory", label:"Inventario", icon:Boxes },

  { sep:"Academia" },
  { label:"Academia", icon:GraduationCap, children:[
    { to:"/admin/academy",             label:"Cursos"        },
    { to:"/admin/academy/modules",     label:"Módulos"       },
    { to:"/admin/academy/lessons",     label:"Lecciones"     },
    { to:"/admin/academy/enrollments", label:"Inscripciones" },
  ]},

  { sep:"Rewards" },
  { label:"Rewards", icon:Gift, children:[
    { to:"/admin/rewards",           label:"Dashboard"       },
    { to:"/admin/rewards/campaigns", label:"Campañas"        },
    { to:"/admin/rewards/entries",   label:"Participaciones" },
    { to:"/admin/rewards/winners",   label:"Ganadores"       },
  ]},
  { to:"/admin/loyalty", label:"Puntos y niveles", icon:Star },

  { sep:"Finanzas" },
  { to:"/admin/finance", label:"Finanzas",    icon:Wallet },
  { to:"/admin/billing", label:"Doc. Tributaria", icon:Receipt },

  { sep:"Sitio web" },
  { to:"/admin/settings", label:"Personalización", icon:Palette },
]

// Título/subtítulo del topbar según la ruta
const ROUTE_TITLES = {
  "/admin":           ["Dashboard",       "Resumen general de tu tienda"],
  "/admin/executive": ["Vista Ejecutiva", "Métricas clave del negocio"],
  "/admin/analytics": ["Analytics",       "Análisis detallado"],
  "/admin/orders":    ["Órdenes",         "Gestión de pedidos"],
  "/admin/payments":  ["Pagos",           "Transacciones y cobros"],
  "/admin/services":  ["Servicios",       "Solicitudes y cotizaciones"],
  "/admin/users":     ["Usuarios",        "Clientes registrados"],
  "/admin/products":  ["Productos",       "Catálogo de la tienda"],
  "/admin/inventory": ["Inventario",      "Stock y disponibilidad"],
  "/admin/settings":  ["Personalización", "Configuración del sitio"],
}

const clpN = (n) => `$${Math.round(n || 0).toLocaleString("es-CL")}`

function NotificationsBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const { data } = useQuery({
    queryKey: ["admin-dashboard"], queryFn: getAdminDashboard, refetchInterval: 60000,
  })

  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const actions = data?.actions || {}
  const products = data?.products || {}
  const pending  = actions.pending_orders || []
  const lowStock = actions.low_stock || []
  const unread   = actions.unread_service_requests || 0
  const count    = pending.length + lowStock.length + unread

  const go = (to) => { setOpen(false); navigate(to) }

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button className="a-icon-btn" aria-label="Notificaciones" data-testid="admin-notifications-btn"
        onClick={() => setOpen((o) => !o)} style={{ position: "relative" }}>
        <Bell size={18} />
        {count > 0 && (
          <span data-testid="admin-notifications-badge" style={{
            position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, padding: "0 5px",
            borderRadius: 9, background: "#EF4444", color: "#fff", fontSize: 10, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #fff", lineHeight: 1,
          }}>{count > 9 ? "9+" : count}</span>
        )}
      </button>

      {open && (
        <div data-testid="admin-notifications-panel" className="a-notif-panel" style={{
          position: "absolute", top: "calc(100% + 10px)", right: 0, zIndex: 80,
          width: 340, maxWidth: "calc(100vw - 32px)", background: "var(--admin-surface)",
          border: "1px solid var(--admin-border)", borderRadius: 18,
          boxShadow: "0 24px 60px rgba(0,0,0,.5)", overflow: "hidden",
          animation: "scaleIn 160ms var(--ease)",
        }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Notificaciones</p>
            {count > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#EF4444",
              background: "rgba(239,68,68,.1)", padding: "2px 8px", borderRadius: 100 }}>{count} nuevas</span>}
          </div>

          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {count === 0 ? (
              <div style={{ padding: "36px 18px", textAlign: "center", color: "var(--text-3)" }}>
                <CheckCircle2 size={30} style={{ color: "#0F9940", marginBottom: 8 }} />
                <p style={{ fontSize: 13 }}>Todo al día ✓</p>
                <p style={{ fontSize: 12, marginTop: 2 }}>No tenés alertas pendientes.</p>
              </div>
            ) : (
              <>
                {pending.length > 0 && (
                  <NotifSection title="Pedidos por confirmar" Icon={Clock} tone="#D97706"
                    count={pending.length} onSeeAll={() => go("/admin/orders")}>
                    {pending.slice(0, 4).map((o) => (
                      <NotifRow key={o.id} onClick={() => go(`/admin/orders?id=${o.id}`)}
                        title={`#${o.short_id}`} sub={`${o.user_name || "Cliente"} · ${o.items_count} items`}
                        right={clpN(o.total)} />
                    ))}
                  </NotifSection>
                )}

                {lowStock.length > 0 && (
                  <NotifSection title="Stock bajo o agotado" Icon={AlertTriangle} tone="#EF4444"
                    count={lowStock.length} onSeeAll={() => go("/admin/inventory")}>
                    {lowStock.slice(0, 4).map((p) => (
                      <NotifRow key={p.id} onClick={() => go(`/admin/products?highlight=${p.id}`)}
                        title={p.name} sub={p.stock === 0 ? "Agotado" : `Quedan ${p.stock} u.`}
                        right={p.stock === 0 ? "0" : `${p.stock} u.`}
                        rightColor={p.stock === 0 ? "#EF4444" : "#D97706"} />
                    ))}
                  </NotifSection>
                )}

                {unread > 0 && (
                  <NotifSection title="Solicitudes de servicio" Icon={MessageSquare} tone="#0F9940"
                    count={unread} onSeeAll={() => go("/admin/services")}>
                    <div onClick={() => go("/admin/services")} className="a-notif-row"
                      style={{ padding: "11px 18px", cursor: "pointer" }}>
                      <p style={{ fontSize: 13, color: "var(--text-2)" }}>
                        Tenés <strong style={{ color: "#0F9940" }}>{unread}</strong> cotizaciones esperando respuesta.
                      </p>
                    </div>
                  </NotifSection>
                )}
              </>
            )}
          </div>
        </div>
      )}
      <style>{`
        .admin-root .a-notif-row { transition: background .15s var(--ease); }
        .admin-root .a-notif-row:hover { background: var(--admin-surface-secondary); }
        @media (max-width: 640px) {
          .admin-root .a-notif-panel { position: fixed !important; top: 66px !important;
            left: 12px !important; right: 12px !important; width: auto !important; max-width: none !important; }
        }
      `}</style>
    </div>
  )
}

function NotifSection({ title, Icon, tone, count, onSeeAll, children }) {
  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 18px 6px" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-3)" }}>
          <Icon size={13} style={{ color: tone }} /> {title}
        </span>
        <button onClick={onSeeAll} style={{ background: "none", border: "none", cursor: "pointer",
          fontSize: 11, fontWeight: 700, color: "#0F9940" }}>Ver todo</button>
      </div>
      {children}
    </div>
  )
}

function NotifRow({ title, sub, right, rightColor, onClick }) {
  return (
    <div onClick={onClick} className="a-notif-row"
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        padding: "10px 18px", cursor: "pointer" }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</p>
        <p style={{ fontSize: 11.5, color: "var(--text-3)", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</p>
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 700, flexShrink: 0,
        color: rightColor || "var(--text-2)" }}>{right}</span>
    </div>
  )
}

function NavGroup({ item, collapsed }) {
  const location = useLocation()
  const isOpen   = item.children.some(c => location.pathname.startsWith(c.to))
  const [open, setOpen] = useState(isOpen)
  const Icon = item.icon
  return (
    <div style={{ marginBottom:"2px" }}>
      <button onClick={() => setOpen(!open)} className={`a-nav${isOpen ? " active" : ""}`}
        data-testid={`admin-navgroup-${item.label.toLowerCase()}`}>
        {Icon && <Icon size={18} strokeWidth={1.9} />}
        <span style={{ flex:1 }}>{item.label}</span>
        <ChevronRight className="a-chevron" size={14} strokeWidth={2}
          style={{ opacity:0.6, transform: open ? "rotate(90deg)" : "none",
            transition:"transform 200ms var(--ease)" }} />
      </button>
      {open && !collapsed && (
        <div style={{ marginTop:"2px", marginBottom:"4px" }}>
          {item.children.map(c => (
            <NavLink key={c.to} to={c.to}
              className={({ isActive }) => `a-subnav${isActive ? " active" : ""}`}>
              {c.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminLayout() {
  const { user, logout } = useAuthStore()
  const { siteName, logoUrl } = useSiteSettings()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const initial = (user?.first_name?.[0] || user?.email?.[0] || "A").toUpperCase()
  const [title, subtitle] = ROUTE_TITLES[location.pathname] ||
    [ (location.pathname.split("/")[2] || "Panel").replace(/^\w/, c => c.toUpperCase()), "Administración" ]
  const today = new Date().toLocaleDateString("es-CL",
    { weekday:"long", year:"numeric", month:"long", day:"numeric" })

  const width = collapsed ? 84 : 256

  const SidebarInner = (
    <aside className={`a-sidebar${collapsed ? " collapsed" : ""}`}
      style={{ width, height:"100%" }} data-testid="admin-sidebar">
      {/* Logo */}
      <div style={{ padding:"22px 18px 6px", display:"flex", alignItems:"center", gap:"10px",
        justifyContent: collapsed ? "center" : "flex-start" }}>
        <Link to="/" style={{ display:"flex", alignItems:"center", gap:"9px" }}>
          {collapsed
            ? <span style={{ width:"34px", height:"34px", borderRadius:"10px", background:"var(--accent)",
                display:"flex", alignItems:"center", justifyContent:"center", color:"#000",
                fontWeight:800, fontSize:"16px" }}>{siteName.charAt(0).toUpperCase()}</span>
            : logoUrl
              ? <img src={logoUrl} alt={siteName}
                  style={{ height:"24px", maxWidth:"120px", objectFit:"contain" }} />
              : <img src={logoImg} alt={siteName}
                  style={{ height:"24px", filter:"brightness(0) invert(1)", maxWidth:"120px" }} />}
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:"6px 12px 14px", overflowY:"auto", overflowX:"hidden" }}
        className="admin-scroll">
        {navItems.map((item, i) => {
          if (item.sep) return <p key={item.sep+i} className="a-group-label">{item.sep}</p>
          if (item.children) return <NavGroup key={item.label} item={item} collapsed={collapsed} />
          const Icon = item.icon
          return (
            <NavLink key={item.to} to={item.to} end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `a-nav${isActive ? " active" : ""}`}
              data-testid={`admin-nav-${item.label.toLowerCase().replace(/\s/g,'-')}`}>
              {Icon && <Icon size={18} strokeWidth={1.9} />}
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding:"10px 12px 14px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
        {!collapsed && (
          <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"8px 6px 10px" }}>
            <span style={{ width:"34px", height:"34px", borderRadius:"50%", background:"var(--accent)",
              color:"#000", flexShrink:0, display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:"14px", fontWeight:800 }}>{initial}</span>
            <div style={{ minWidth:0 }}>
              <p style={{ fontSize:"12px", fontWeight:600, color:"#fff", overflow:"hidden",
                textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user?.email}</p>
              <p style={{ fontSize:"11px", color:"#6B7280" }}>
                {user?.is_superuser ? "Superusuario" : "Staff"}</p>
            </div>
          </div>
        )}
        <Link to="/" className="a-nav" data-testid="admin-view-site">
          <ExternalLink size={17} strokeWidth={1.9} /><span>Ver sitio</span>
        </Link>
        <button onClick={() => { logout(); navigate("/admin/login") }}
          className="a-nav" data-testid="admin-logout">
          <LogOut size={17} strokeWidth={1.9} /><span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )

  return (
    <div className="admin-root" style={{ minHeight:"100vh", display:"flex",
      padding:"14px", gap:"18px", fontFamily:"var(--font-sans)" }}>

      {/* Sidebar desktop */}
      <div style={{ position:"sticky", top:"14px", height:"calc(100vh - 28px)", flexShrink:0 }}
        className="a-sidebar-desktop">
        {SidebarInner}
      </div>

      {/* Drawer móvil */}
      {mobileOpen && <div className="a-drawer-backdrop" onClick={() => setMobileOpen(false)} />}
      <div className={`a-sidebar-wrap${mobileOpen ? " open" : ""}`}
        style={{ width:256, display:"none" }} data-mobile>
        {SidebarInner}
      </div>

      {/* Main */}
      <main style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column" }}>
        {/* Topbar (solo acciones — el título lo pone cada página) */}
        <header style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          gap:"16px", marginBottom:"14px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <button className="a-icon-btn a-mobile-toggle" onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú" style={{ display:"none" }} data-testid="admin-mobile-menu">
              <Menu size={18} />
            </button>
            <button className="a-icon-btn a-collapse-toggle" onClick={() => setCollapsed(c => !c)}
              aria-label="Contraer menú" data-testid="admin-collapse-toggle">
              <ChevronsLeft size={18} style={{ transform: collapsed ? "rotate(180deg)" : "none",
                transition:"transform 250ms var(--ease)" }} />
            </button>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <button className="a-icon-btn" aria-label="Buscar" onClick={() => setSearchOpen(true)}
              data-testid="admin-search-btn"><Search size={18} /></button>
            <NotificationsBell />
            <div style={{ display:"flex", alignItems:"center", gap:"10px", background:"#fff",
              padding:"6px 14px 6px 6px", borderRadius:"100px", border:"1px solid #ECEEF2",
              boxShadow:"0 4px 12px rgba(20,30,24,0.05)" }} data-testid="admin-user-chip">
              <span style={{ width:"34px", height:"34px", borderRadius:"50%", background:"var(--accent)",
                color:"#000", display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:"14px", fontWeight:800, flexShrink:0 }}>{initial}</span>
              <div style={{ lineHeight:1.2 }} className="a-user-meta">
                <p style={{ fontSize:"13px", fontWeight:700, color:"#14161A", maxWidth:"140px",
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {user?.first_name || user?.email?.split("@")[0] || "Admin"}</p>
                <p style={{ fontSize:"11px", color:"#98A2B3" }}>
                  {user?.is_superuser ? "Superusuario" : "Admin"}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Contenido */}
        <div style={{ flex:1, minWidth:0 }}>
          <Outlet />
        </div>
      </main>

      <style>{`
        @media (max-width: 1024px) {
          .a-sidebar-desktop { display:none !important; }
          .a-sidebar-wrap[data-mobile] { display:block !important; }
          .a-mobile-toggle { display:flex !important; }
          .a-collapse-toggle { display:none !important; }
        }
        @media (max-width: 560px) {
          .a-user-meta { display:none; }
        }
      `}</style>

      <AdminSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
