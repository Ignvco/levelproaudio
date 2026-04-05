// layouts/AdminLayout.jsx

import { useState } from "react"
import { NavLink, Link, useNavigate, useLocation, Outlet } from "react-router-dom"
import { useAuthStore } from "../store/authStore"
import logoImg from "../assets/logo.png"

// ── NavGroup — fuera del array, antes de AdminLayout ────────
function NavGroup({ item }) {
  const location = useLocation()
  const isOpen   = item.children.some(c => location.pathname.startsWith(c.to))
  const [open, setOpen] = useState(isOpen)

  return (
    <div style={{ marginBottom: "2px" }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: "10px",
        padding: "9px 10px", borderRadius: "var(--r-md)", fontSize: "13px",
        background: "none", border: "none", cursor: "pointer",
        color: isOpen ? "var(--text)" : "var(--text-2)",
        transition: "all var(--dur) var(--ease)",
        fontWeight: isOpen ? 500 : 400,
      }}>
        <span style={{ fontSize: "13px", opacity: 0.5, width: "14px",
          textAlign: "center" }}>{item.icon}</span>
        <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
        <span style={{ fontSize: "10px", opacity: 0.4,
          display: "inline-block",
          transform: open ? "rotate(90deg)" : "none",
          transition: "transform var(--dur)" }}>▶</span>
      </button>
      {open && (
        <div style={{ paddingLeft: "24px", marginTop: "2px" }}>
          {item.children.map(child => (
            <NavLink key={child.to} to={child.to}
              style={({ isActive }) => ({
                display: "block",
                padding: "7px 10px", borderRadius: "var(--r-md)",
                fontSize: "12px", marginBottom: "1px",
                color: isActive ? "var(--accent)" : "var(--text-3)",
                background: isActive ? "var(--surface-2)" : "transparent",
                transition: "all var(--dur) var(--ease)",
              })}>
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

// ── navItems — solo datos, sin componentes adentro ───────────
const navItems = [
  { to: "/admin",           label: "Dashboard",  icon: "◈", end: true },
  { to: "/admin/executive", label: "Vista Ejecutiva", icon: "◈" },
  { to: "/admin/analytics", label: "Analytics",  icon: "◉" },
  { to: "/admin/finance", label: "Finanzas", icon: "⧫" },
  { to: "/admin/orders",    label: "Órdenes",    icon: "⊡" },
  {
    label: "Productos", icon: "⊞",
    children: [
      { to: "/admin/products",        label: "Catálogo" },
      { to: "/admin/products/import", label: "Importar" },  // ← dentro del grupo
      { to: "/admin/inventory", label: "Inventario", icon: "◫" }
    ]
  },
  { to: "/admin/users",     label: "Usuarios",   icon: "○" },
  { to: "/admin/payments",  label: "Pagos",      icon: "◎" },
  { to: "/admin/loyalty", label: "Fidelización", icon: "⭐" },
  {
    label: "Academia", icon: "▷",
    children: [
      { to: "/admin/academy",              label: "Cursos" },
      { to: "/admin/academy/modules",      label: "Módulos" },   // ← agregado
      { to: "/admin/academy/lessons",      label: "Lecciones" }, // ← agregado
      { to: "/admin/academy/enrollments",  label: "Inscripciones" },
    ]
  },
  { to: "/admin/services",  label: "Servicios",  icon: "◇" },
]

// ── AdminLayout ──────────────────────────────────────────────
export default function AdminLayout() {
  const { user, logout } = useAuthStore()
  const navigate         = useNavigate()

  return (
    <div style={{ minHeight: "100vh", display: "flex",
      background: "var(--bg)", fontFamily: "var(--font-sans)" }}>

      {/* Sidebar */}
      <aside style={{
        width: "220px", flexShrink: 0,
        borderRight: "1px solid var(--border)",
        background: "var(--surface)",
        display: "flex", flexDirection: "column",
        position: "sticky", top: 0, height: "100vh",
      }}>

        {/* Logo + badge */}
        <div style={{ padding: "20px 16px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: "10px" }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <img src={logoImg} alt="LevelPro" style={{ height: "28px", filter: "brightness(0) invert(1)", maxWidth: "100px" }} />
          </Link>
          <span style={{
            marginLeft: "auto", fontSize: "10px", fontWeight: 600,
            padding: "2px 7px", borderRadius: "100px",
            background: "var(--accent-glow)", color: "var(--accent)",
            border: "1px solid rgba(26,255,110,0.2)", letterSpacing: "0.06em",
          }}>
            ADMIN
          </span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
          {navItems.map((item) => {
            if (item.children) {
              return <NavGroup key={item.label} item={item} />
            }
            return (
              <NavLink key={item.to} to={item.to} end={item.end}
                style={({ isActive }) => ({
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "9px 10px", borderRadius: "var(--r-md)",
                  fontSize: "13px", marginBottom: "2px",
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? "var(--text)" : "var(--text-2)",
                  background: isActive ? "var(--surface-2)" : "transparent",
                  transition: "all var(--dur) var(--ease)",
                })}>
                <span style={{ fontSize: "13px", opacity: 0.5,
                  width: "14px", textAlign: "center" }}>
                  {item.icon}
                </span>
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: "10px 8px", borderTop: "1px solid var(--border)" }}>
          <div style={{ padding: "8px 10px", marginBottom: "4px" }}>
            <p style={{ fontSize: "12px", fontWeight: 500, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.email}
            </p>
            <p style={{ fontSize: "11px", color: "var(--text-3)" }}>
              {user?.is_superuser ? "Superusuario" : "Staff"}
            </p>
          </div>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: "8px",
            padding: "8px 10px", borderRadius: "var(--r-md)", fontSize: "12px",
            color: "var(--text-3)", transition: "color var(--dur)", marginBottom: "2px" }}
            className="hover:text-[var(--text-2)]">
            ← Ver sitio
          </Link>
          <button onClick={() => { logout(); navigate("/login") }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px",
              padding: "8px 10px", borderRadius: "var(--r-md)", fontSize: "12px",
              color: "var(--text-3)", background: "none", border: "none",
              cursor: "pointer", transition: "color var(--dur)" }}
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