// layouts/AdminLayout.jsx — Dashboard Experience V2: riel vertical oscuro (#101112) + workspace claro + topbar LevelPro
import { useState, useEffect, useRef }                     from "react"
import { NavLink, Link, useNavigate, useLocation, Outlet } from "react-router-dom"
import { useQuery }                                         from "@tanstack/react-query"
import { useAuthStore }                                     from "../store/authStore"
import { getAdminDashboard }                                from "../api/admin.api"
import AdminSearch                                          from "../components/admin/AdminSearch"
import { useSiteSettings }                                  from "../hooks/useSiteSettings"
import {
  LayoutDashboard, ChevronRight,
  ShoppingBag, Package, GraduationCap,
  Wrench, Gift, Wallet, Settings, ExternalLink, LogOut,
  Search, Bell, Menu, Clock, AlertTriangle, MessageSquare, CheckCircle2,
} from "lucide-react"

// ── Mapa de navegación agrupado ──────────────────────────────────
// Cada grupo es un ícono en el riel del sidebar (desktop). Si el grupo
// tiene "items", el hover o click/teclado abre un flyout con esas rutas;
// si tiene "to" directo, el ícono navega solo. En mobile se usa la misma
// data en un drawer con labels (sin necesidad de hover).
const navGroups = [
  { key: "inicio", label: "Dashboard", icon: LayoutDashboard, to: "/admin", end: true },

  { key: "ventas", label: "Ventas", icon: ShoppingBag, items: [
    { to: "/admin/orders",          label: "Órdenes"         },
    { to: "/admin/special-orders",  label: "Bajo pedido"     },
    { to: "/admin/payments",        label: "Pagos"           },
    { to: "/admin/payment-methods", label: "Métodos de pago" },
    { to: "/admin/billing",         label: "Doc. tributaria" },
  ]},

  { key: "catalogo", label: "Catálogo", icon: Package, items: [
    { to: "/admin/products",        label: "Catálogo"   },
    { to: "/admin/brands",          label: "Marcas"     },
    { to: "/admin/categories",      label: "Categorías" },
    { to: "/admin/products/import", label: "Importar"   },
    { to: "/admin/inventory",       label: "Inventario" },
  ]},

  { key: "academia", label: "Academia", icon: GraduationCap, items: [
    { to: "/admin/academy",                label: "Cursos"          },
    { to: "/admin/academy/modules",        label: "Módulos"         },
    { to: "/admin/academy/lessons",        label: "Lecciones"       },
    { to: "/admin/academy/enrollments",    label: "Inscripciones"   },
    { to: "/admin/academy/certifications", label: "Certificaciones" },
  ]},

  { key: "servicios", label: "Servicios", icon: Wrench, to: "/admin/services" },

  { key: "fidelizacion", label: "Fidelización", icon: Gift, items: [
    { to: "/admin/loyalty",           label: "Puntos y niveles" },
    { to: "/admin/rewards",           label: "Rewards"          },
    { to: "/admin/rewards/campaigns", label: "Campañas"         },
    { to: "/admin/rewards/entries",   label: "Participaciones"  },
    { to: "/admin/rewards/winners",   label: "Ganadores"        },
  ]},

  { key: "negocio", label: "Negocio", icon: Wallet, items: [
    { to: "/admin/finance",  label: "Finanzas"        },
    { to: "/admin/users",    label: "Clientes"        },
    { to: "/admin/settings", label: "Personalización" },
  ]},
]

// isGroupActive: determina si un grupo del riel está activo según la ruta actual
function isGroupActive(group, pathname) {
  if (group.to) return group.end ? pathname === group.to : pathname.startsWith(group.to)
  if (group.items) return group.items.some((it) => pathname.startsWith(it.to))
  return false
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

  const actions  = data?.actions || {}
  const pending  = actions.pending_orders || []
  const lowStock = actions.low_stock || []
  const unread   = actions.unread_service_requests || 0
  const count    = pending.length + lowStock.length + unread

  const go = (to) => { setOpen(false); navigate(to) }

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button type="button" className="lp-topicon" aria-label="Notificaciones" data-testid="admin-notifications-btn"
        aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Bell size={18} />
        {count > 0 && (
          <span data-testid="admin-notifications-badge" style={{
            position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, padding: "0 5px",
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
          boxShadow: "0 24px 60px rgba(0,0,0,.22)", overflow: "hidden",
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
                    onSeeAll={() => go("/admin/orders")}>
                    {pending.slice(0, 4).map((o) => (
                      <NotifRow key={o.id} onClick={() => go(`/admin/orders?id=${o.id}`)}
                        title={`#${o.short_id}`} sub={`${o.user_name || "Cliente"} · ${o.items_count} items`}
                        right={clpN(o.total)} />
                    ))}
                  </NotifSection>
                )}

                {lowStock.length > 0 && (
                  <NotifSection title="Stock bajo o agotado" Icon={AlertTriangle} tone="#EF4444"
                    onSeeAll={() => go("/admin/inventory")}>
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
                    onSeeAll={() => go("/admin/services")}>
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

function NotifSection({ title, Icon, tone, onSeeAll, children }) {
  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 18px 6px" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-3)" }}>
          {Icon && <Icon size={13} style={{ color: tone }} />} {title}
        </span>
        <button type="button" onClick={onSeeAll} style={{ background: "none", border: "none", cursor: "pointer",
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

function NavGroup({ group, onSelect }) {
  const location = useLocation()
  const isOpen = group.items.some((c) => location.pathname.startsWith(c.to))
  const [open, setOpen] = useState(isOpen)
  const Icon = group.icon
  return (
    <div style={{ marginBottom: "2px" }}>
      <button type="button" onClick={() => setOpen(!open)} className={`a-nav${isOpen ? " active" : ""}`}
        data-testid={`admin-navgroup-${group.key}`}>
        {Icon && <Icon size={18} strokeWidth={1.9} />}
        <span style={{ flex: 1 }}>{group.label}</span>
        <ChevronRight className="a-chevron" size={14} strokeWidth={2}
          style={{ opacity: 0.6, transform: open ? "rotate(90deg)" : "none",
            transition: "transform 200ms var(--ease)" }} />
      </button>
      {open && (
        <div style={{ marginTop: "2px", marginBottom: "4px" }}>
          {group.items.map((c) => (
            <NavLink key={c.to} to={c.to} onClick={onSelect}
              className={({ isActive }) => `a-subnav${isActive ? " active" : ""}`}>
              {c.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

// ── NavRail — riel de íconos oscuro (desktop). Los grupos con "items" abren
// un flyout tanto por hover como por click/teclado; los directos navegan solos.
function NavRail({ openKey, setOpenKey }) {
  const location = useLocation()
  const navRef = useRef(null)

  useEffect(() => {
    const onDown = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setOpenKey(null)
    }
    const onKey = (e) => {
      if (e.key === "Escape") setOpenKey(null)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [setOpenKey])

  return (
    <nav ref={navRef} className="lp-rail__nav" aria-label="Navegación principal">
      {navGroups.map((group) => {
        const Icon = group.icon
        const active = isGroupActive(group, location.pathname)
        const hasFlyout = !!group.items
        const isOpen = openKey === group.key
        return (
          <div key={group.key} className="lp-rail__item"
            onMouseEnter={() => hasFlyout && setOpenKey(group.key)}
            onMouseLeave={() => hasFlyout && setOpenKey(null)}>
            {group.to ? (
              <NavLink to={group.to} end={group.end}
                className={`lp-rail__btn${active ? " active" : ""}`}
                data-testid={`admin-nav-${group.key}`} aria-label={group.label}>
                <Icon size={20} strokeWidth={1.9} />
              </NavLink>
            ) : (
              <button type="button" className={`lp-rail__btn${active ? " active" : ""}`}
                data-testid={`admin-nav-${group.key}`} aria-label={group.label}
                aria-expanded={isOpen} aria-haspopup="menu"
                onClick={() => setOpenKey(isOpen ? null : group.key)}>
                <Icon size={20} strokeWidth={1.9} />
              </button>
            )}
            {!hasFlyout && <span className="lp-rail__tip">{group.label}</span>}
            {hasFlyout && isOpen && (
              <div className="lp-rail__flyout" role="menu" data-testid={`admin-flyout-${group.key}`}>
                <p className="lp-rail__flyout-title">{group.label}</p>
                {group.items.map((it) => (
                  <NavLink key={it.to} to={it.to} role="menuitem" onClick={() => setOpenKey(null)}
                    className={({ isActive }) => `lp-rail__flyout-item${isActive ? " active" : ""}`}>
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

export default function AdminLayout() {
  const { user, logout } = useAuthStore()
  const { siteName, logoUrl } = useSiteSettings()
  const navigate = useNavigate()
  const location = useLocation()
  const [openKey, setOpenKey] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const initial = (user?.first_name?.[0] || user?.email?.[0] || "L").toUpperCase()
  const secondInitial = (user?.last_name?.[0] || "P").toUpperCase()
  const avatarText = user?.first_name ? `${initial}${user?.last_name ? secondInitial : ""}` : "LP"
  const settingsActive = location.pathname.startsWith("/admin/settings")

  // ── Drawer mobile: lista completa con labels (sin hover, apto para touch) ──
  const MobileDrawer = (
    <aside className="a-sidebar" style={{ width: 264, height: "100%" }} data-testid="admin-sidebar-mobile">
      <div style={{ padding: "22px 18px 10px", display: "flex", alignItems: "center", gap: "10px" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
          <span className="lp-rail__logo" style={{ width: 38, height: 38, borderRadius: 12 }}>
            {logoUrl
              ? <img src={logoUrl} alt={siteName} style={{ width: 22, height: 22, objectFit: "contain" }} />
              : <span className="lp-rail__brand" style={{ fontSize: 12 }}>LP<span style={{ fontSize: 6.5 }}>AUDIO</span></span>}
          </span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-.06em", color: "#fff", lineHeight: 1 }}>
              LEVELPRO<span style={{ color: "#1AFF6E" }}>.</span>
            </div>
            <div style={{ fontSize: 7.5, fontWeight: 900, letterSpacing: ".22em", color: "#1AFF6E", marginTop: 2 }}>
              AUDIO
            </div>
          </div>
        </Link>
      </div>

      <nav style={{ flex: 1, padding: "6px 12px 14px", overflowY: "auto", overflowX: "hidden" }}
        className="admin-scroll" aria-label="Navegación móvil">
        {navGroups.map((group) => {
          if (group.items) return <NavGroup key={group.key} group={group} onSelect={() => setMobileOpen(false)} />
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

      <div style={{ padding: "10px 12px 14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 6px 10px" }}>
          <span style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#1AFF6E",
            color: "#00160b", flexShrink: 0, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "12px", fontWeight: 800 }}>{avatarText}</span>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "#fff", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</p>
            <p style={{ fontSize: "11px", color: "#6B7280" }}>
              {user?.is_superuser ? "Superusuario" : "Administrador"}</p>
          </div>
        </div>
        <Link to="/" className="a-nav" data-testid="admin-view-site-mobile">
          <ExternalLink size={17} strokeWidth={1.9} /><span>Ver sitio</span>
        </Link>
        <button type="button" onClick={() => { logout(); navigate("/admin/login") }}
          className="a-nav" data-testid="admin-logout-mobile">
          <LogOut size={17} strokeWidth={1.9} /><span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )

  return (
    <div className="admin-root lp-shell-wrap">
      <div className="lp-shell">
        {/* Riel vertical oscuro — Desktop */}
        <aside className="lp-rail" data-testid="admin-sidebar" aria-label="Barra lateral de administración">
          <div className="lp-rail__sticky">
            <Link to="/" className="lp-rail__logo" aria-label={siteName}>
              {logoUrl
                ? <img src={logoUrl} alt="" style={{ width: 26, height: 26, objectFit: "contain" }} />
                : <div className="lp-rail__brand">LP<span>AUDIO</span></div>}
            </Link>
            <div className="lp-rail__line" />
            <NavRail openKey={openKey} setOpenKey={setOpenKey} />
            <div className="lp-rail__bottom">
              <div className="lp-rail__item">
                <NavLink to="/admin/settings"
                  className={`lp-rail__btn${settingsActive ? " active" : ""}`}
                  aria-label="Configuración" data-testid="admin-nav-settings">
                  <Settings size={19} strokeWidth={1.9} />
                </NavLink>
                <span className="lp-rail__tip">Configuración</span>
              </div>
              <div className="lp-rail__item">
                <Link to="/" className="lp-rail__btn" aria-label="Volver al sitio" data-testid="admin-view-site">
                  <ExternalLink size={19} strokeWidth={1.9} />
                </Link>
                <span className="lp-rail__tip">Volver al sitio</span>
              </div>
              <div className="lp-rail__item">
                <button type="button" className="lp-rail__btn" aria-label="Cerrar sesión"
                  onClick={() => { logout(); navigate("/admin/login") }} data-testid="admin-logout">
                  <LogOut size={19} strokeWidth={1.9} />
                </button>
                <span className="lp-rail__tip">Cerrar sesión</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Drawer móvil */}
        {mobileOpen && <div className="a-drawer-backdrop" onClick={() => setMobileOpen(false)} />}
        <div className={`a-sidebar-wrap lp-sidebar-mobile-wrap${mobileOpen ? " open" : ""}`}
          style={{ width: 264, display: "none" }} data-mobile>
          {MobileDrawer}
        </div>

        {/* Workspace claro */}
        <main className="lp-workspace">
          {/* Topbar */}
          <header className="lp-topbar">
            <div className="lp-brand">
              <button type="button" className="lp-topicon lp-mobile-toggle" onClick={() => setMobileOpen(true)}
                aria-label="Abrir menú" style={{ display: "none" }} data-testid="admin-mobile-menu">
                <Menu size={18} />
              </button>
              <Link to="/admin" className="lp-brand__link" aria-label="LevelPro Audio Workspace">
                <div className="lp-brand__level">LEVELPRO<span className="lp-brand__dot">.</span></div>
                <div className="lp-brand__audio">AUDIO</div>
              </Link>
              <div className="lp-brand__split" />
              <span className="lp-brand__area">Workspace</span>
            </div>

            <div className="lp-topbar__right">
              <button type="button" className="lp-search-trigger" aria-label="Buscar en LevelPro"
                onClick={() => setSearchOpen(true)} data-testid="admin-search-btn">
                <Search size={16} />
                <span className="lp-search-trigger__text">Buscar en LevelPro...</span>
                <span className="lp-search-trigger__kbd">⌘K</span>
              </button>

              <NotificationsBell />

              <Link to="/admin/settings" className="lp-account-chip" data-testid="admin-user-chip"
                title={user?.email || "Cuenta de administrador"}>
                <span className="lp-account-avatar">{avatarText}</span>
                <span className="lp-account-meta">
                  <span className="lp-account-name">
                    {user?.first_name
                      ? `${user.first_name}${user.last_name ? ` ${user.last_name}` : ""}`
                      : (user?.email?.split("@")[0] || "LevelPro Audio")}
                  </span>
                  <span className="lp-account-role">
                    {user?.is_superuser ? "Administrador" : "Staff"}
                  </span>
                </span>
              </Link>
            </div>
          </header>

          {/* Contenido de la vista */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <Outlet />
          </div>
        </main>
      </div>

      <AdminSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
