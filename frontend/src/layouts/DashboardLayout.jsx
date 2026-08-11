// layouts/DashboardLayout.jsx — mismo lenguaje que AdminLayout (sidebar oscuro + contenido claro)
import { useState } from "react"
import { NavLink, Link, useNavigate } from "react-router-dom"
import {
  LayoutDashboard, Package, PlayCircle, Wrench, Star, Gift,
  User, LogOut, Store, Heart, ChevronsLeft, Menu, Calendar,
} from "lucide-react"
import { useAuthStore } from "../store/authStore"
import logoImg from "../assets/logo.png"
import { useSiteSettings } from "../hooks/useSiteSettings"

const navItems = [
  { sep: "Panel" },
  { to: "/dashboard",           label: "Inicio",             icon: LayoutDashboard, end: true },
  { sep: "Mi actividad" },
  { to: "/dashboard/orders",    label: "Pedidos",            icon: Package },
  { to: "/dashboard/favorites", label: "Mis favoritos",      icon: Heart },
  { to: "/dashboard/courses",   label: "Mis cursos",         icon: PlayCircle },
  { to: "/dashboard/services",  label: "Servicios",          icon: Wrench },
  { to: "/dashboard/bookings",  label: "Mis reservas",       icon: Calendar },
  { sep: "Fidelización" },
  { to: "/dashboard/loyalty",   label: "Mis puntos",         icon: Star },
  { to: "/dashboard/rewards",   label: "Mis participaciones", icon: Gift },
  { sep: "Cuenta" },
  { to: "/dashboard/profile",   label: "Perfil",             icon: User },
]

export default function DashboardLayout({ children }) {
  const { user, logout } = useAuthStore()
  const { siteName, logoUrl } = useSiteSettings()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const initial = (user?.first_name?.[0] || user?.email?.[0] || "U").toUpperCase()
  const width = collapsed ? 84 : 256

  const SidebarInner = (
    <aside className={`a-sidebar${collapsed ? " collapsed" : ""}`}
      style={{ width, height: "100%" }} data-testid="dash-sidebar">
      {/* Logo */}
      <div style={{ padding: "22px 18px 6px", display: "flex", alignItems: "center", gap: "10px",
        justifyContent: collapsed ? "center" : "flex-start" }}>
        <Link to="/" data-testid="dash-logo-home" style={{ display: "flex", alignItems: "center", gap: "9px" }}>
          {collapsed
            ? <span style={{ width: "34px", height: "34px", borderRadius: "10px", background: "var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#000",
                fontWeight: 800, fontSize: "16px" }}>{siteName.charAt(0).toUpperCase()}</span>
            : <img src={logoUrl || logoImg} alt={siteName}
                style={{ height: "24px", filter: logoUrl ? "none" : "brightness(0) invert(1)", maxWidth: "120px" }} />}
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "6px 12px 14px", overflowY: "auto", overflowX: "hidden" }}
        className="admin-scroll">
        {navItems.map((item, i) => {
          if (item.sep) return <p key={item.sep + i} className="a-group-label">{item.sep}</p>
          const Icon = item.icon
          return (
            <NavLink key={item.to} to={item.to} end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `a-nav${isActive ? " active" : ""}`}
              data-testid={`dash-nav-${item.to.split("/").pop() || "home"}`}>
              {Icon && <Icon size={18} strokeWidth={1.9} />}
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: "10px 12px 14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 6px 10px" }}>
            <span style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#1AFF6E",
              color: "#000", flexShrink: 0, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "14px", fontWeight: 800 }}>{initial}</span>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "#fff", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</p>
              <p style={{ fontSize: "11px", color: "#6B7280" }}>Cliente</p>
            </div>
          </div>
        )}
        <Link to="/" className="a-nav" data-testid="dash-back-to-site">
          <Store size={17} strokeWidth={1.9} /><span>Volver al sitio</span>
        </Link>
        <button onClick={() => { logout(); navigate("/") }}
          className="a-nav" data-testid="dash-logout">
          <LogOut size={17} strokeWidth={1.9} /><span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )

  return (
    <div className="admin-root" style={{ minHeight: "100vh", display: "flex",
      padding: "14px", gap: "18px", fontFamily: "var(--font-sans)" }}>

      {/* Sidebar desktop */}
      <div style={{ position: "sticky", top: "14px", height: "calc(100vh - 28px)", flexShrink: 0 }}
        className="a-sidebar-desktop">
        {SidebarInner}
      </div>

      {/* Drawer móvil */}
      {mobileOpen && <div className="a-drawer-backdrop" onClick={() => setMobileOpen(false)} />}
      <div className={`a-sidebar-wrap${mobileOpen ? " open" : ""}`}
        style={{ width: 256, display: "none" }} data-mobile>
        {SidebarInner}
      </div>

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Topbar */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: "16px", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button className="a-icon-btn a-mobile-toggle" onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú" style={{ display: "none" }} data-testid="dash-mobile-menu">
              <Menu size={18} />
            </button>
            <button className="a-icon-btn a-collapse-toggle" onClick={() => setCollapsed(c => !c)}
              aria-label="Contraer menú" data-testid="dash-collapse-toggle">
              <ChevronsLeft size={18} style={{ transform: collapsed ? "rotate(180deg)" : "none",
                transition: "transform 250ms var(--ease)" }} />
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#fff",
            padding: "6px 14px 6px 6px", borderRadius: "100px", border: "1px solid #ECEEF2",
            boxShadow: "0 4px 12px rgba(20,30,24,0.05)" }} data-testid="dash-user-chip">
            <span style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#1AFF6E",
              color: "#000", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "14px", fontWeight: 800, flexShrink: 0 }}>{initial}</span>
            <div style={{ lineHeight: 1.2 }} className="a-user-meta">
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#14161A", maxWidth: "160px",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.first_name || user?.email?.split("@")[0] || "Cliente"}</p>
              <p style={{ fontSize: "11px", color: "#98A2B3" }}>Cliente</p>
            </div>
          </div>
        </header>

        {/* Contenido */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {children}
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
    </div>
  )
}
