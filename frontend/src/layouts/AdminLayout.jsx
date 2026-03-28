// layouts/AdminLayout.jsx

import { NavLink, Link, useNavigate, Outlet } from "react-router-dom"
import { useAuthStore } from "../store/authStore"
import iconImg from "../assets/icon.png"

const navItems = [
  { to: "/admin", label: "Dashboard", icon: "◈", end: true },
  { to: "/admin/orders", label: "Órdenes", icon: "⊡" },
  { to: "/admin/products", label: "Productos", icon: "⊞" },
  { to: "/admin/users", label: "Usuarios", icon: "○" },
  { to: "/admin/payments", label: "Pagos", icon: "◎" },
  { to: "/admin/academy", label: "Academia", icon: "▷" },
  { to: "/admin/services", label: "Servicios", icon: "◇" },
]

export default function AdminLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "var(--bg)", fontFamily: "var(--font-sans)" }}>

      {/* Sidebar */}
      <aside style={{
        width: "220px", flexShrink: 0,
        borderRight: "1px solid var(--border)",
        background: "var(--surface)",
        display: "flex", flexDirection: "column",
        position: "sticky", top: 0, height: "100vh",
      }}>

        {/* Logo + badge */}
        <div style={{
          padding: "20px 16px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: "10px"
        }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <img src={iconImg} alt="" style={{ width: "22px", filter: "brightness(0) invert(1)" }} />
            <span style={{ fontSize: "13px", fontWeight: 500 }}>LevelPro</span>
          </Link>
          <span style={{
            marginLeft: "auto", fontSize: "10px", fontWeight: 600,
            padding: "2px 7px", borderRadius: "100px",
            background: "var(--accent-glow)",
            color: "var(--accent)",
            border: "1px solid rgba(26,255,110,0.2)",
            letterSpacing: "0.06em",
          }}>
            ADMIN
          </span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
          {navItems.map(({ to, label, icon, end }) => (
            // Agrega a navItems
            { to: "/admin/analytics", label: "Analytics", icon: "◉" },
            <NavLink key={to} to={to} end={end}
              style={({ isActive }) => ({
                display: "flex", alignItems: "center", gap: "10px",
                padding: "9px 10px", borderRadius: "var(--r-md)",
                fontSize: "13px", marginBottom: "2px",
                fontWeight: isActive ? 500 : 400,
                color: isActive ? "var(--text)" : "var(--text-2)",
                background: isActive ? "var(--surface-2)" : "transparent",
                transition: "all var(--dur) var(--ease)",
              })}
            >
              <span style={{
                fontSize: "13px", opacity: 0.5, width: "14px",
                textAlign: "center"
              }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: "10px 8px", borderTop: "1px solid var(--border)" }}>
          <div style={{ padding: "8px 10px", marginBottom: "4px" }}>
            <p style={{
              fontSize: "12px", fontWeight: 500, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap"
            }}>
              {user?.email}
            </p>
            <p style={{ fontSize: "11px", color: "var(--text-3)" }}>
              {user?.is_superuser ? "Superusuario" : "Staff"}
            </p>
          </div>
          <Link to="/" style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "8px 10px", borderRadius: "var(--r-md)", fontSize: "12px",
            color: "var(--text-3)", transition: "color var(--dur)", marginBottom: "2px"
          }}
            className="hover:text-[var(--text-2)]">
            ← Ver sitio
          </Link>
          <button onClick={() => { logout(); navigate("/") }}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: "8px",
              padding: "8px 10px", borderRadius: "var(--r-md)", fontSize: "12px",
              color: "var(--text-3)", background: "none", border: "none", cursor: "pointer",
              transition: "color var(--dur)"
            }}
            className="hover:text-[var(--danger)]">
            ↗ Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  )
}