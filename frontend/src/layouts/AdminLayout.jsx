// layouts/AdminLayout.jsx
import { useState } from "react"
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom"
import { useAuthStore } from "../store/authStore"

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", icon: "◈", end: true },
  { to: "/admin/executive", label: "Vista Ejecutiva", icon: "◉" },
  { to: "/admin/analytics", label: "Analytics", icon: "○" },
  { to: "/admin/finance", label: "Finanzas", icon: "⬡" },
  { to: "/admin/orders", label: "Órdenes", icon: "◫" },
  {
    label: "Productos", icon: "⊞", children: [
      { to: "/admin/products", label: "Catálogo" },
      { to: "/admin/inventory", label: "Inventario" },
      { to: "/admin/brands", label: "Marcas" },
      { to: "/admin/categories", label: "Categorías" },
    ]
  },
  { to: "/admin/users", label: "Usuarios", icon: "○" },
  { to: "/admin/payments", label: "Pagos", icon: "◎" },
  { to: "/admin/billing", label: "Facturación", icon: "◧" },
  { to: "/admin/loyalty", label: "Fidelización", icon: "⭐" },
  {
    label: "Academia", icon: "▷", children: [
      { to: "/admin/academy/courses", label: "Cursos" },
      { to: "/admin/academy/modules", label: "Módulos" },
      { to: "/admin/academy/lessons", label: "Lecciones" },
      { to: "/admin/enrollments", label: "Inscripciones" },
    ]
  },
  {
    label: "Servicios", icon: "◇", children: [
      { to: "/admin/services", label: "Servicios" },
      { to: "/admin/bookings", label: "Reservas" },
      { to: "/admin/requests", label: "Solicitudes" },
    ]
  },
]

function NavItem({ item }) {
  const [open, setOpen] = useState(false)

  if (item.children) {
    return (
      <div>
        <button onClick={() => setOpen(!open)} style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "9px 12px",
          borderRadius: "var(--r-md)",
          background: "none",
          border: "none",
          color: "var(--text-3)",
          fontSize: "13px",
          cursor: "pointer",
          transition: "all var(--dur) var(--ease)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-3)" }}>
              {item.icon}
            </span>
            {item.label}
          </div>
          <span style={{
            fontSize: "10px", color: "var(--text-3)",
            transform: open ? "rotate(180deg)" : "rotate(0)",
            transition: "transform var(--dur) var(--ease)",
          }}>
            ▼
          </span>
        </button>

        {open && (
          <div style={{
            marginLeft: "22px", marginTop: "2px",
            display: "flex", flexDirection: "column", gap: "2px",
            borderLeft: "1px solid var(--border)", paddingLeft: "12px"
          }}>
            {item.children.map(child => (
              <NavLink key={child.to} to={child.to}
                style={({ isActive }) => ({
                  display: "block",
                  padding: "7px 12px",
                  borderRadius: "var(--r-md)",
                  fontSize: "13px",
                  color: isActive ? "var(--accent)" : "var(--text-3)",
                  background: isActive ? "var(--accent-dim)" : "transparent",
                  textDecoration: "none",
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

  return (
    <NavLink to={item.to} end={item.end}
      style={({ isActive }) => ({
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "9px 12px",
        borderRadius: "var(--r-md)",
        fontSize: "13px",
        color: isActive ? "var(--text)" : "var(--text-3)",
        background: isActive ? "var(--surface-2)" : "transparent",
        border: isActive ? "1px solid var(--border)" : "1px solid transparent",
        fontWeight: isActive ? 500 : 400,
        textDecoration: "none",
        transition: "all var(--dur) var(--ease)",
      })}>
      <span style={{ fontSize: "11px" }}>{item.icon}</span>
      {item.label}
    </NavLink>
  )
}

export default function AdminLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: "220px",
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        background: "var(--bg-2)",
        zIndex: 50,
        overflowY: "auto",
      }}>
        {/* Logo */}
        <div style={{
          padding: "20px 16px",
          borderBottom: "1px solid var(--border)"
        }}>
          <Link to="/admin" style={{
            display: "flex", alignItems: "center",
            gap: "10px", textDecoration: "none"
          }}>
            <img src="/src/assets/logo.png" alt="LevelPro"
              style={{ height: "22px", width: "auto" }} />
            <span style={{
              fontSize: "10px", fontWeight: 700,
              padding: "2px 7px", borderRadius: "var(--r-full)",
              background: "var(--accent)", color: "#000",
              letterSpacing: "0.06em",
            }}>
              ADMIN
            </span>
          </Link>
        </div>

        {/* Nav */}
        <nav style={{
          padding: "12px 8px", flex: 1,
          display: "flex", flexDirection: "column", gap: "2px"
        }}>
          {NAV_ITEMS.map((item, i) => (
            <NavItem key={i} item={item} />
          ))}
        </nav>

        {/* Footer sidebar */}
        <div style={{
          padding: "12px 8px",
          borderTop: "1px solid var(--border)"
        }}>
          <div style={{ padding: "10px 12px", marginBottom: "8px" }}>
            <p style={{
              fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "2px",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
            }}>
              {user?.first_name || user?.email?.split("@")[0]}
            </p>
            <p style={{
              fontSize: "11px", color: "var(--text-3)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
            }}>
              {user?.email}
            </p>
          </div>
          <Link to="/" style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "8px 12px", borderRadius: "var(--r-md)",
            fontSize: "12px", color: "var(--text-3)",
            textDecoration: "none", transition: "color var(--dur)",
            marginBottom: "4px"
          }}
            className="hover-accent">
            ← Ver sitio
          </Link>
          <button onClick={() => { logout(); navigate("/") }} style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 12px",
            borderRadius: "var(--r-md)",
            fontSize: "12px",
            color: "var(--text-3)",
            background: "none",
            border: "none",
            cursor: "pointer",
            width: "100%",
            textAlign: "left",
            transition: "color var(--dur)",
          }}
            className="hover-accent">
            ↗ Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{
        flex: 1, marginLeft: "220px",
        minWidth: 0, overflowX: "hidden"
      }}>
        <Outlet />
      </main>
    </div>
  )
}