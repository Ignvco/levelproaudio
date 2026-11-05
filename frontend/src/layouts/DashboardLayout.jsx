// layouts/DashboardLayout.jsx — Dashboard Experience V2: mismo shell que AdminLayout (riel vertical oscuro + workspace claro)
import { useState } from "react"
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom"
import {
  LayoutDashboard, Package, GraduationCap, Wrench, Star, Gift,
  User, LogOut, Store, Heart, Menu, Calendar, Settings, ExternalLink, Search, Bell,
} from "lucide-react"
import { useAuthStore } from "../store/authStore"
import { useSiteSettings } from "../hooks/useSiteSettings"

const navItems = [
  { sep: "Panel" },
  { to: "/dashboard",           label: "Inicio",              shortLabel: "Inicio",      icon: LayoutDashboard, end: true },
  { sep: "Mi actividad" },
  { to: "/dashboard/orders",    label: "Pedidos",             shortLabel: "Mis pedidos", icon: Package },
  { to: "/dashboard/favorites", label: "Mis favoritos",       shortLabel: "Favoritos",   icon: Heart },
  { to: "/dashboard/courses",   label: "Mis cursos",          shortLabel: "Mis cursos",  icon: GraduationCap },
  { to: "/dashboard/services",  label: "Servicios",           shortLabel: "Servicios",   icon: Wrench },
  { to: "/dashboard/bookings",  label: "Mis reservas",        shortLabel: "Reservas",    icon: Calendar },
  { sep: "Fidelización" },
  { to: "/dashboard/loyalty",   label: "Mis puntos",          shortLabel: "Mis puntos",  icon: Star },
  { to: "/dashboard/rewards",   label: "Mis participaciones", shortLabel: "Rewards",     icon: Gift },
  { sep: "Cuenta" },
  { to: "/dashboard/profile",   label: "Perfil",              shortLabel: "Perfil",      icon: User },
]

const railLinks = navItems.filter((item) => !item.sep)

export default function DashboardLayout({ children }) {
  const { user, logout } = useAuthStore()
  const { siteName, logoUrl } = useSiteSettings()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [shopQuery, setShopQuery] = useState("")

  const initial = (user?.first_name?.[0] || user?.email?.[0] || "L").toUpperCase()
  const secondInitial = (user?.last_name?.[0] || "P").toUpperCase()
  const avatarText = user?.first_name ? `${initial}${user?.last_name ? secondInitial : ""}` : "LP"
  const profileActive = location.pathname.startsWith("/dashboard/profile")

  const handleShopSearch = (e) => {
    e.preventDefault()
    const q = shopQuery.trim()
    navigate(q ? `/shop?search=${encodeURIComponent(q)}` : "/shop")
  }

  // ── Drawer móvil: lista completa con etiquetas y secciones ──
  const MobileDrawer = (
    <aside className="a-sidebar" style={{ width: 264, height: "100%" }} data-testid="dash-sidebar-mobile">
      <div style={{ padding: "22px 18px 10px", display: "flex", alignItems: "center", gap: "10px" }}>
        <Link to="/" data-testid="dash-logo-home-mobile" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
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
        className="admin-scroll" aria-label="Navegación móvil de cuenta">
        {navItems.map((item, i) => {
          if (item.sep) return <p key={item.sep + i} className="a-group-label">{item.sep}</p>
          const Icon = item.icon
          const key = item.to.split("/").pop() || "home"
          return (
            <NavLink key={item.to} to={item.to} end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `a-nav${isActive ? " active" : ""}`}
              data-testid={`dash-nav-mobile-${key}`}>
              {Icon && <Icon size={18} strokeWidth={1.9} />}
              <span>{item.label}</span>
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
            <p style={{ fontSize: "11px", color: "#6B7280" }}>Cliente</p>
          </div>
        </div>
        <Link to="/" className="a-nav" data-testid="dash-back-to-site-mobile">
          <Store size={17} strokeWidth={1.9} /><span>Volver al sitio</span>
        </Link>
        <button type="button" onClick={() => { logout(); navigate("/") }}
          className="a-nav" data-testid="dash-logout-mobile">
          <LogOut size={17} strokeWidth={1.9} /><span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )

  return (
    <div className="admin-root lp-shell-wrap">
      <div className="lp-shell">
        {/* Riel vertical oscuro — Desktop */}
        <aside className="lp-rail" data-testid="dash-sidebar" aria-label="Navegación de mi cuenta">
          <div className="lp-rail__sticky">
            <Link to="/" className="lp-rail__logo" data-testid="dash-logo-home" aria-label={siteName}>
              {logoUrl
                ? <img src={logoUrl} alt="" style={{ width: 26, height: 26, objectFit: "contain" }} />
                : <div className="lp-rail__brand">LP<span>AUDIO</span></div>}
            </Link>
            <div className="lp-rail__line" />

            <nav className="lp-rail__nav" aria-label="Menú principal de usuario">
              {railLinks.map((item) => {
                const Icon = item.icon
                const key = item.to.split("/").pop() || "home"
                return (
                  <div key={item.to} className="lp-rail__item">
                    <NavLink to={item.to} end={item.end}
                      className={({ isActive }) => `lp-rail__btn${isActive ? " active" : ""}`}
                      data-testid={`dash-nav-${key}`} aria-label={item.label}>
                      {Icon && <Icon size={20} strokeWidth={1.9} />}
                    </NavLink>
                    <span className="lp-rail__tip">{item.shortLabel || item.label}</span>
                  </div>
                )
              })}
            </nav>

            <div className="lp-rail__bottom">
              <div className="lp-rail__item">
                <NavLink to="/dashboard/profile"
                  className={`lp-rail__btn${profileActive ? " active" : ""}`}
                  aria-label="Configuración de perfil" data-testid="dash-settings">
                  <Settings size={19} strokeWidth={1.9} />
                </NavLink>
                <span className="lp-rail__tip">Configuración</span>
              </div>
              <div className="lp-rail__item">
                <Link to="/" className="lp-rail__btn" aria-label="Volver al sitio" data-testid="dash-back-to-site">
                  <ExternalLink size={19} strokeWidth={1.9} />
                </Link>
                <span className="lp-rail__tip">Volver al sitio</span>
              </div>
              <div className="lp-rail__item">
                <button type="button" className="lp-rail__btn" aria-label="Cerrar sesión"
                  onClick={() => { logout(); navigate("/") }} data-testid="dash-logout">
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
                aria-label="Abrir menú" style={{ display: "none" }} data-testid="dash-mobile-menu">
                <Menu size={18} />
              </button>
              <Link to="/dashboard" className="lp-brand__link" aria-label="LevelPro Audio Mi Cuenta">
                <div className="lp-brand__level">LEVELPRO<span className="lp-brand__dot">.</span></div>
                <div className="lp-brand__audio">AUDIO</div>
              </Link>
              <div className="lp-brand__split" />
              <span className="lp-brand__area">Workspace</span>
            </div>

            <div className="lp-topbar__right">
              <form onSubmit={handleShopSearch} className="lp-search-trigger" role="search">
                <Search size={16} style={{ flexShrink: 0 }} />
                <input
                  type="search"
                  value={shopQuery}
                  onChange={(e) => setShopQuery(e.target.value)}
                  placeholder="Buscar en LevelPro..."
                  aria-label="Buscar en LevelPro"
                  className="lp-search-trigger__text"
                  style={{
                    border: 0, outline: 0, background: "transparent",
                    color: "#14161A", fontSize: 12.5, width: "100%",
                  }}
                />
              </form>

              <Link to="/dashboard/orders" className="lp-topicon" aria-label="Ver estado de mis pedidos"
                title="Mis pedidos">
                <Bell size={18} />
              </Link>

              <Link to="/dashboard/profile" className="lp-account-chip" data-testid="dash-user-chip"
                title={user?.email || "Mi perfil"}>
                <span className="lp-account-avatar">{avatarText}</span>
                <span className="lp-account-meta">
                  <span className="lp-account-name">
                    {user?.first_name
                      ? `${user.first_name}${user.last_name ? ` ${user.last_name}` : ""}`
                      : (user?.email?.split("@")[0] || "LevelPro Audio")}
                  </span>
                  <span className="lp-account-role">Cliente</span>
                </span>
              </Link>
            </div>
          </header>

          {/* Contenido */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
