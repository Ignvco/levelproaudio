// layouts/DashboardLayout.jsx

import { NavLink, Link, useNavigate } from "react-router-dom"
import { useAuthStore } from "../store/authStore"
import logoImg from "../assets/logo.png"
import iconImg from "../assets/icon.png"

const navItems = [
  { to: "/dashboard",          label: "Resumen",        icon: "⊞" },
  { to: "/dashboard/orders",   label: "Mis pedidos",     icon: "⊡" },
  { to: "/dashboard/profile",  label: "Mi perfil",       icon: "○" },
  { to: "/dashboard/courses",  label: "Mis cursos",      icon: "▷" },
  { to: "/dashboard/services", label: "Mis servicios",   icon: "◈" },
]

export default function DashboardLayout({ children }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "var(--bg)" }}>

      {/* Sidebar */}
      <aside style={{
        width: "240px",
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflow: "hidden",
      }}>

        {/* Logo */}
        <div style={{ padding: "24px 20px", borderBottom: "1px solid var(--border)" }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <img src={logoImg} alt="LevelPro" style={{ height: "28px", filter: "brightness(0) invert(1)", maxWidth: "100px" }} />
          </Link>
        </div>

        {/* Usuario */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "13px",
              fontWeight: 600,
              flexShrink: 0,
            }}>
              {user?.first_name?.[0]?.toUpperCase() || "U"}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "13px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "Mi cuenta"}
              </p>
              <p style={{ fontSize: "11px", color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/dashboard"}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "9px 10px",
                borderRadius: "var(--r-md)",
                fontSize: "13px",
                fontWeight: isActive ? 500 : 400,
                color: isActive ? "var(--text)" : "var(--text-2)",
                background: isActive ? "var(--surface-2)" : "transparent",
                transition: "all var(--dur) var(--ease)",
                marginBottom: "2px",
              })}
            >
              <span style={{ fontSize: "14px", opacity: 0.6, width: "16px", textAlign: "center" }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer sidebar */}
        <div style={{ padding: "10px", borderTop: "1px solid var(--border)" }}>
          <Link to="/" style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "9px 10px",
            borderRadius: "var(--r-md)",
            fontSize: "13px",
            color: "var(--text-3)",
            transition: "color var(--dur)",
            marginBottom: "2px",
          }}
            className="hover:text-[var(--text-2)]"
          >
            ← Volver al sitio
          </Link>
          <button
            onClick={() => { logout(); navigate("/") }}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 10px",
              borderRadius: "var(--r-md)",
              fontSize: "13px",
              color: "var(--text-3)",
              background: "none",
              border: "none",
              cursor: "pointer",
              transition: "color var(--dur)",
            }}
            className="hover:text-[var(--text-2)]"
          >
            ↗ Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main style={{ flex: 1, overflow: "auto" }}>
        {children}
      </main>
    </div>
  )
}