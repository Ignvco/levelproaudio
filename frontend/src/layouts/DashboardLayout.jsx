// layouts/DashboardLayout.jsx
import { NavLink, useNavigate, Link } from "react-router-dom"
import {
  LayoutDashboard, Package, FileText, PlayCircle,
  Wrench, Star, Gift, User, LogOut, Store, Heart,
} from "lucide-react"
import { useAuthStore } from "../store/authStore"
import logoImg from "../assets/logo.png"

const NAV = [
  { sep: "Panel" },
  { to: "/dashboard",           label: "Inicio",              Icon: LayoutDashboard, end: true },
  { sep: "Mi actividad" },
  { to: "/dashboard/orders",    label: "Pedidos",             Icon: Package },
  { to: "/dashboard/favorites", label: "Mis favoritos",       Icon: Heart },
  { to: "/dashboard/courses",   label: "Mis cursos",          Icon: PlayCircle },
  { to: "/dashboard/services",  label: "Servicios",           Icon: Wrench },
  { to: "/dashboard/documents", label: "Documentos",          Icon: FileText },
  { sep: "Fidelización" },
  { to: "/dashboard/loyalty",   label: "Mis puntos",          Icon: Star },
  { to: "/dashboard/rewards",   label: "Mis participaciones",  Icon: Gift },
  { sep: "Cuenta" },
  { to: "/dashboard/profile",   label: "Perfil",              Icon: User },
]

export default function DashboardLayout({ children }) {
  const { user, logout } = useAuthStore()
  const navigate         = useNavigate()

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "var(--bg)" }} className="dash-root">

      {/* Sidebar */}
      <aside className="dashboard-sidebar" style={{
        width: "260px", flexShrink: 0,
        position: "sticky", top: 0,
        alignSelf: "flex-start",
        height: "100vh",
        padding: "24px 16px 20px",
        display: "flex", flexDirection: "column", gap: "4px",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}>
        {/* Marca */}
        <Link to="/" data-testid="dash-logo-home" style={{ display: "flex", alignItems: "center",
          padding: "8px 12px 20px", textDecoration: "none" }}>
          <img src={logoImg} alt="LevelPro Audio" style={{ height: "24px", objectFit: "contain",
            filter: "brightness(0) invert(1)", maxWidth: "150px" }} />
        </Link>

        {/* Nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }} className="dash-nav">
          {NAV.map((item, idx) => {
            if (item.sep) return (
              <p key={`sep-${idx}`} className="dash-sep" style={{ fontSize: "10px", fontWeight: 600,
                color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em",
                padding: "16px 12px 6px", opacity: 0.55 }}>{item.sep}</p>
            )
            const { to, label, Icon, end } = item
            return (
            <NavLink key={to} to={to} end={end} data-testid={`dash-nav-${to.split("/").pop() || "home"}`}
              style={({ isActive }) => ({
                display: "flex", alignItems: "center", gap: "11px",
                padding: "9px 12px", borderRadius: "var(--r-md)", fontSize: "13px",
                whiteSpace: "nowrap",
                color: isActive ? "var(--accent)" : "var(--text-2)",
                background: isActive ? "var(--surface-2)" : "transparent",
                fontWeight: isActive ? 600 : 400,
                transition: "all var(--dur) var(--ease)", textDecoration: "none",
              })}
              className="dash-nav-link">
              {({ isActive }) => (
                <>
                  <Icon size={16} strokeWidth={1.8} style={{ opacity: isActive ? 1 : 0.6, flexShrink: 0 }} />
                  {label}
                </>
              )}
            </NavLink>
          )})}
        </nav>

        <div style={{ flex: 1 }} className="dash-spacer" />

        {/* Volver al sitio */}
        <Link to="/" data-testid="dash-back-to-site" className="dash-backsite" style={{ display: "flex", alignItems: "center",
          gap: "10px", padding: "11px 14px", borderRadius: "14px", marginBottom: "8px",
          fontSize: "14px", fontWeight: 600, color: "var(--text-2)", textDecoration: "none",
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          transition: "all var(--dur) var(--ease)" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(26,255,110,0.3)"; e.currentTarget.style.color = "var(--text)" }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "var(--text-2)" }}>
          <Store size={18} strokeWidth={2} />
          Volver al sitio
        </Link>

        {/* User card */}
        <div style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "18px", padding: "12px", display: "flex", alignItems: "center",
          gap: "12px" }} className="dash-usercard">
          <div style={{ width: "40px", height: "40px", borderRadius: "50%",
            background: "var(--accent)", color: "#000", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "15px", fontWeight: 800, fontFamily: "var(--font-display)" }}>
            {user?.first_name?.[0]?.toUpperCase() || "U"}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.first_name} {user?.last_name}
            </p>
            <p style={{ fontSize: "11px", color: "var(--text-3)", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.email}
            </p>
          </div>
          <button onClick={() => { logout(); navigate("/") }} title="Cerrar sesión"
            data-testid="dash-logout"
            style={{ width: "32px", height: "32px", borderRadius: "10px", flexShrink: 0,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--text-3)", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", transition: "all var(--dur)" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#ff6b6b"; e.currentTarget.style.borderColor = "rgba(255,107,107,0.3)" }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)" }}>
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, overflowX: "hidden", minWidth: 0 }}>
        {children}
      </main>

      <style>{`
        @media (max-width: 900px) {
          .dash-root { flex-direction: column; }
          .dashboard-sidebar {
            width: 100% !important; height: auto !important; position: sticky !important;
            top: 0; z-index: 20; padding: 12px 16px !important;
            border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.06);
            background: var(--bg);
          }
          .dashboard-sidebar .dash-spacer { display: none !important; }
          .dash-nav {
            flex-direction: row !important; overflow-x: auto; gap: 8px !important;
            padding-bottom: 6px; -webkit-overflow-scrolling: touch;
          }
          .dash-nav-link { flex-shrink: 0; }
          .dash-sep { display: none !important; }
          .dash-usercard { display: none !important; }
          .dash-backsite { display: none !important; }
        }
      `}</style>
    </div>
  )
}
