// layouts/DashboardLayout.jsx
import { NavLink, useNavigate } from "react-router-dom"
import {
  LayoutDashboard, Package, FileText, PlayCircle,
  Wrench, Star, Gift, User, LogOut,
} from "lucide-react"
import { useAuthStore } from "../store/authStore"

const NAV = [
  { to: "/dashboard",           label: "Inicio",              Icon: LayoutDashboard, end: true },
  { to: "/dashboard/orders",    label: "Pedidos",             Icon: Package },
  { to: "/dashboard/documents", label: "Documentos",          Icon: FileText },
  { to: "/dashboard/courses",   label: "Mis cursos",          Icon: PlayCircle },
  { to: "/dashboard/services",  label: "Servicios",           Icon: Wrench },
  { to: "/dashboard/loyalty",   label: "Mis puntos",          Icon: Star },
  { to: "/dashboard/rewards",   label: "Mis participaciones",  Icon: Gift },
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
        <div style={{ display: "flex", alignItems: "center", gap: "10px",
          padding: "8px 12px 20px" }}>
          <span style={{ width: "30px", height: "30px", borderRadius: "9px",
            background: "var(--accent)", color: "#000", display: "flex",
            alignItems: "center", justifyContent: "center", fontWeight: 800,
            fontFamily: "var(--font-display)", fontSize: "15px" }}>L</span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800,
            fontSize: "17px", letterSpacing: "-0.02em", color: "var(--text)" }}>
            levelpro
          </span>
        </div>

        {/* Nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }} className="dash-nav">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} data-testid={`dash-nav-${to.split("/").pop() || "home"}`}
              style={({ isActive }) => ({
                display: "flex", alignItems: "center", gap: "12px",
                padding: "11px 14px", borderRadius: "14px", fontSize: "14px",
                whiteSpace: "nowrap",
                color: isActive ? "#000" : "var(--text-3)",
                background: isActive ? "var(--accent)" : "transparent",
                fontWeight: isActive ? 700 : 500,
                boxShadow: isActive ? "0 6px 20px rgba(26,255,110,0.25)" : "none",
                transition: "all var(--dur) var(--ease)", textDecoration: "none",
              })}
              className="dash-nav-link">
              {({ isActive }) => (
                <>
                  <Icon size={18} strokeWidth={isActive ? 2.4 : 2} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div style={{ flex: 1 }} className="dash-spacer" />

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
          .dash-usercard { display: none !important; }
        }
      `}</style>
    </div>
  )
}
