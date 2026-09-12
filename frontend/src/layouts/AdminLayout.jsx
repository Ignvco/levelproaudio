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
  LayoutDashboard, ChevronRight,
  ShoppingBag, Package, GraduationCap,
  Wrench, Gift, Wallet, ExternalLink, LogOut,
  Search, Bell, Menu, Clock, AlertTriangle, MessageSquare, CheckCircle2,
} from "lucide-react"

// ── Mapa de navegación agrupado ──────────────────────────────────
// Cada grupo es un ícono en el riel del sidebar (desktop). Si el grupo
// tiene "items", el hover abre un flyout con esas rutas; si tiene "to"
// directo, el ícono navega solo. En mobile se usa la misma data en un
// drawer con labels (sin necesidad de hover).
const navGroups = [
  { key:"inicio",   label:"Dashboard",     icon:LayoutDashboard, to:"/admin", end:true },

  { key:"ventas", label:"Ventas", icon:ShoppingBag, items:[
    { to:"/admin/orders",          label:"Órdenes"         },
    { to:"/admin/special-orders",  label:"Bajo pedido"     },
    { to:"/admin/payments",        label:"Pagos"           },
    { to:"/admin/payment-methods", label:"Métodos de pago" },
    { to:"/admin/billing",         label:"Doc. tributaria" },
  ]},

  { key:"catalogo", label:"Catálogo", icon:Package, items:[
    { to:"/admin/products",        label:"Catálogo"   },
    { to:"/admin/brands",          label:"Marcas"     },
    { to:"/admin/categories",      label:"Categorías" },
    { to:"/admin/products/import", label:"Importar"   },
    { to:"/admin/inventory",       label:"Inventario" },
  ]},

  { key:"academia", label:"Academia", icon:GraduationCap, items:[
    { to:"/admin/academy",                label:"Cursos"         },
    { to:"/admin/academy/modules",        label:"Módulos"        },
    { to:"/admin/academy/lessons",        label:"Lecciones"      },
    { to:"/admin/academy/enrollments",    label:"Inscripciones"  },
    { to:"/admin/academy/certifications", label:"Certificaciones"},
  ]},

  { key:"servicios", label:"Servicios", icon:Wrench, to:"/admin/services" },

  { key:"fidelizacion", label:"Fidelización", icon:Gift, items:[
    { to:"/admin/loyalty",           label:"Puntos y niveles" },
    { to:"/admin/rewards",           label:"Rewards"          },
    { to:"/admin/rewards/campaigns", label:"Campañas"         },
    { to:"/admin/rewards/entries",   label:"Participaciones"  },
    { to:"/admin/rewards/winners",   label:"Ganadores"        },
  ]},

  { key:"negocio", label:"Negocio", icon:Wallet, items:[
    { to:"/admin/finance",  label:"Finanzas"        },
    { to:"/admin/users",    label:"Clientes"        },
    { to:"/admin/settings", label:"Personalización" },
  ]},
]

// isGroupActive: determina si un grupo del riel/pill está activo según la ruta actual
function isGroupActive(group, pathname) {
  if (group.to) return group.end ? pathname === group.to : pathname.startsWith(group.to)
  if (group.items) return group.items.some((it) => pathname.startsWith(it.to))
  return false
}

// Primer destino navegable de un grupo (usado por el pill superior)
function firstDestination(group) {
  return group.to || group.items?.[0]?.to || "/admin"
}

// Título/subtítulo del topbar según la ruta
const ROUTE_TITLES = {
  "/admin":           ["Dashboard",       "Resumen general de tu tienda"],
  "/admin/orders":    ["Órdenes",         "Gestión de pedidos"],
  "/admin/special-orders": ["Solicitudes bajo pedido", "Equipos pedidos fuera del catálogo"],
  "/admin/payments":  ["Pagos",           "Transacciones y cobros"],
  "/admin/payment-methods": ["Métodos de pago", "Configuración de cobros y cuentas"],
  "/admin/services":  ["Servicios",       "Solicitudes y cotizaciones"],
  "/admin/users":     ["Clientes",        "Clientes registrados"],
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

function NavGroup({ group }) {
  const location = useLocation()
  const isOpen = group.items.some((c) => location.pathname.startsWith(c.to))
  const [open, setOpen] = useState(isOpen)
  const Icon = group.icon
  return (
    <div style={{ marginBottom:"2px" }}>
      <button onClick={() => setOpen(!open)} className={`a-nav${isOpen ? " active" : ""}`}
        data-testid={`admin-navgroup-${group.key}`}>
        {Icon && <Icon size={18} strokeWidth={1.9} />}
        <span style={{ flex:1 }}>{group.label}</span>
        <ChevronRight className="a-chevron" size={14} strokeWidth={2}
          style={{ opacity:0.6, transform: open ? "rotate(90deg)" : "none",
            transition:"transform 200ms var(--ease)" }} />
      </button>
      {open && (
        <div style={{ marginTop:"2px", marginBottom:"4px" }}>
          {group.items.map((c) => (
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

// ── NavRail — riel de íconos (desktop). Los grupos con "items" abren un
// flyout al hover; los directos navegan solos. Tooltip para leaf items. ──
function NavRail({ openKey, setOpenKey }) {
  const location = useLocation()
  return (
    <nav className="a-rail__nav" aria-label="Navegación principal">
      {navGroups.map((group) => {
        const Icon = group.icon
        const active = isGroupActive(group, location.pathname)
        const hasFlyout = !!group.items
        return (
          <div key={group.key} className="a-rail__item"
            onMouseEnter={() => hasFlyout && setOpenKey(group.key)}
            onMouseLeave={() => hasFlyout && setOpenKey(null)}>
            {group.to ? (
              <NavLink to={group.to} end={group.end}
                className={`a-rail__btn${active ? " active" : ""}`}
                data-testid={`admin-nav-${group.key}`} aria-label={group.label}>
                <Icon size={19} strokeWidth={1.9} />
              </NavLink>
            ) : (
              <button type="button" className={`a-rail__btn${active ? " active" : ""}`}
                data-testid={`admin-nav-${group.key}`} aria-label={group.label}
                aria-expanded={openKey === group.key}>
                <Icon size={19} strokeWidth={1.9} />
              </button>
            )}
            {!hasFlyout && <span className="a-rail__tip">{group.label}</span>}
            {hasFlyout && openKey === group.key && (
              <div className="a-rail__flyout" data-testid={`admin-flyout-${group.key}`}>
                <p className="a-rail__flyout-title">{group.label}</p>
                {group.items.map((it) => (
                  <NavLink key={it.to} to={it.to} onClick={() => setOpenKey(null)}
                    className={({ isActive }) => `a-rail__flyout-item${isActive ? " active" : ""}`}>
                    {it.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

// ── PillNav — navegación rápida superior tipo Quixotic (desktop) ──
function PillNav() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <nav className="a-pillnav" aria-label="Navegación rápida">
      {navGroups.map((group) => (
        <button key={group.key} type="button"
          className={`a-pillnav__btn${isGroupActive(group, location.pathname) ? " active" : ""}`}
          data-testid={`admin-pill-${group.key}`}
          onClick={() => navigate(firstDestination(group))}>
          {group.label}
        </button>
      ))}
    </nav>
  )
}

export default function AdminLayout() {
  const { user, logout } = useAuthStore()
  const { siteName, logoUrl } = useSiteSettings()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [openKey, setOpenKey] = useState(null)
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

  // ── Drawer mobile: lista completa con labels (sin hover, apto para touch) ──
  const MobileDrawer = (
    <aside className="a-sidebar" style={{ width:256, height:"100%" }} data-testid="admin-sidebar-mobile">
      <div style={{ padding:"22px 18px 6px", display:"flex", alignItems:"center", gap:"10px" }}>
        <Link to="/" style={{ display:"flex", alignItems:"center", gap:"9px" }}>
          {logoUrl
            ? <img src={logoUrl} alt={siteName} style={{ height:"24px", maxWidth:"120px", objectFit:"contain" }} />
            : <img src={logoImg} alt={siteName} style={{ height:"24px", filter:"brightness(0) invert(1)", maxWidth:"120px" }} />}
        </Link>
      </div>

      <nav style={{ flex:1, padding:"6px 12px 14px", overflowY:"auto", overflowX:"hidden" }}
        className="admin-scroll">
        {navGroups.map((group) => {
          if (group.items) return <NavGroup key={group.key} group={group} />
          const Icon = group.icon
          return (
            <NavLink key={group.key} to={group.to} end={group.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `a-nav${isActive ? " active" : ""}`}
              data-testid={`admin-nav-mobile-${group.key}`}>
              {Icon && <Icon size={18} strokeWidth={1.9} />}
              <span>{group.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div style={{ padding:"10px 12px 14px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
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
        <Link to="/" className="a-nav" data-testid="admin-view-site-mobile">
          <ExternalLink size={17} strokeWidth={1.9} /><span>Ver sitio</span>
        </Link>
        <button onClick={() => { logout(); navigate("/admin/login") }}
          className="a-nav" data-testid="admin-logout-mobile">
          <LogOut size={17} strokeWidth={1.9} /><span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )

  return (
    <div className="admin-root" style={{ minHeight:"100vh", display:"flex",
      padding:"14px", gap:"18px", fontFamily:"var(--font-sans)" }}>

      {/* Riel de íconos — desktop */}
      <div style={{ position:"sticky", top:"14px", height:"calc(100vh - 28px)", flexShrink:0 }}
        className="a-rail-desktop">
        <aside className="a-rail" data-testid="admin-sidebar">
          <Link to="/" className="a-rail__logo" aria-label={siteName}>
            {logoUrl
              ? <img src={logoUrl} alt="" style={{ width:22, height:22, objectFit:"contain" }} />
              : <span>{siteName.charAt(0).toUpperCase()}</span>}
          </Link>
          <NavRail openKey={openKey} setOpenKey={setOpenKey} />
          <div className="a-rail__footer">
            <Link to="/" className="a-rail__item">
              <span className="a-rail__btn" aria-label="Ver sitio"><ExternalLink size={18} strokeWidth={1.9} /></span>
              <span className="a-rail__tip">Ver sitio</span>
            </Link>
            <div className="a-rail__item">
              <button type="button" className="a-rail__btn" aria-label="Cerrar sesión"
                onClick={() => { logout(); navigate("/admin/login") }} data-testid="admin-logout">
                <LogOut size={18} strokeWidth={1.9} />
              </button>
              <span className="a-rail__tip">Cerrar sesión</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Drawer móvil */}
      {mobileOpen && <div className="a-drawer-backdrop" onClick={() => setMobileOpen(false)} />}
      <div className={`a-sidebar-wrap${mobileOpen ? " open" : ""}`}
        style={{ width:256, display:"none" }} data-mobile>
        {MobileDrawer}
      </div>

      {/* Main */}
      <main style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column" }}>
        {/* Topbar — pill de navegación rápida (desktop) + acciones */}
        <header style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          gap:"16px", marginBottom:"14px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px", minWidth:0, flex:1 }}>
            <button className="a-icon-btn a-mobile-toggle" onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú" style={{ display:"none" }} data-testid="admin-mobile-menu">
              <Menu size={18} />
            </button>
            <PillNav />
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"12px", flexShrink:0 }}>
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
        /* ── Riel de íconos (desktop) — blanco, flotante, redondeado ── */
        .admin-root .a-rail {
          width: 72px; height: 100%; background: #fff; border: 1px solid var(--admin-border, #ECEEF2);
          border-radius: 22px; display: flex; flex-direction: column; align-items: center;
          padding: 16px 0; box-shadow: 0 4px 20px rgba(20,30,24,0.05);
        }
        .admin-root .a-rail__logo {
          width: 38px; height: 38px; border-radius: 12px; background: var(--admin-primary, #1AFF6E);
          display: flex; align-items: center; justify-content: center; color: #00160b;
          font-weight: 800; font-size: 15px; margin-bottom: 18px; flex-shrink: 0;
        }
        .admin-root .a-rail__nav { flex: 1; display: flex; flex-direction: column; gap: 4px; width: 100%;
          align-items: center; overflow-y: auto; overflow-x: visible; }
        .admin-root .a-rail__footer { display: flex; flex-direction: column; gap: 4px; width: 100%;
          align-items: center; padding-top: 10px; border-top: 1px solid var(--admin-border, #ECEEF2); margin-top: 8px; }
        .admin-root .a-rail__item { position: relative; display: flex; justify-content: center; width: 100%; }
        .admin-root .a-rail__btn {
          width: 44px; height: 44px; border-radius: 13px; border: none; background: transparent;
          color: #6B7280; display: flex; align-items: center; justify-content: center; cursor: pointer;
          text-decoration: none; transition: background 150ms var(--ease), color 150ms var(--ease);
        }
        .admin-root .a-rail__btn:hover { background: #F4F5F7; color: #14161A; }
        .admin-root .a-rail__btn.active { background: var(--admin-primary-soft, rgba(26,255,110,0.14));
          color: var(--admin-primary-text, #0F9940); }
        .admin-root .a-rail__tip {
          position: absolute; left: calc(100% + 10px); top: 50%; transform: translateY(-50%);
          background: #14161A; color: #fff; font-size: 11.5px; font-weight: 600; padding: 5px 10px;
          border-radius: 8px; white-space: nowrap; opacity: 0; pointer-events: none; z-index: 60;
          transition: opacity 120ms var(--ease); box-shadow: 0 8px 20px rgba(0,0,0,0.18);
        }
        .admin-root .a-rail__item:hover .a-rail__tip { opacity: 1; }
        .admin-root .a-rail__flyout {
          position: absolute; left: calc(100% + 10px); top: 0; min-width: 208px;
          background: #fff; border: 1px solid var(--admin-border, #ECEEF2); border-radius: 16px;
          box-shadow: 0 20px 45px rgba(20,30,24,0.14); padding: 10px; z-index: 70;
        }
        .admin-root .a-rail__flyout-title { font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .05em; color: #98A2B3; padding: 4px 10px 8px; }
        .admin-root .a-rail__flyout-item {
          display: block; padding: 9px 10px; border-radius: 10px; font-size: 13.5px; font-weight: 600;
          color: #14161A; text-decoration: none; transition: background 120ms var(--ease);
        }
        .admin-root .a-rail__flyout-item:hover { background: #F4F5F7; }
        .admin-root .a-rail__flyout-item.active { background: var(--admin-primary-soft, rgba(26,255,110,0.14));
          color: var(--admin-primary-text, #0F9940); }

        /* ── Pill de navegación rápida (topbar, desktop) ── */
        .admin-root .a-pillnav {
          display: inline-flex; align-items: center; gap: 2px; background: #fff;
          border: 1px solid var(--admin-border, #ECEEF2); border-radius: 100px; padding: 4px;
          overflow-x: auto; max-width: 100%; box-shadow: 0 4px 12px rgba(20,30,24,0.04);
        }
        .admin-root .a-pillnav::-webkit-scrollbar { display: none; }
        .admin-root .a-pillnav__btn {
          border: none; background: transparent; color: #6B7280; font-size: 13px; font-weight: 600;
          padding: 8px 16px; border-radius: 100px; cursor: pointer; white-space: nowrap;
          transition: background 150ms var(--ease), color 150ms var(--ease); flex-shrink: 0;
        }
        .admin-root .a-pillnav__btn:hover { background: #F4F5F7; color: #14161A; }
        .admin-root .a-pillnav__btn.active { background: var(--admin-primary, #1AFF6E); color: #00160b; }

        @media (max-width: 1024px) {
          .a-rail-desktop { display:none !important; }
          .a-sidebar-wrap[data-mobile] { display:block !important; }
          .a-mobile-toggle { display:flex !important; }
          .a-pillnav { display:none !important; }
        }
        @media (max-width: 560px) {
          .a-user-meta { display:none; }
        }
      `}</style>

      <AdminSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
