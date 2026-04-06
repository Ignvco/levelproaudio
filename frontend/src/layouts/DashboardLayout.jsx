// layouts/DashboardLayout.jsx
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { useAuthStore } from "../store/authStore"

const NAV = [
  { to: "/dashboard",          label: "Inicio",    icon: "◈", end: true  },
  { to: "/dashboard/orders",   label: "Pedidos",   icon: "◫"              },
  { to: "/dashboard/courses",  label: "Mis cursos",icon: "▷"              },
  { to: "/dashboard/services", label: "Servicios", icon: "◇"              },
  { to: "/dashboard/profile",  label: "Perfil",    icon: "○"              },
]

export default function DashboardLayout({ children }) {
  const { user, logout } = useAuthStore()
  const navigate         = useNavigate()

  return (
    <div style={{
      minHeight:   "calc(100vh - 68px)",
      display:     "flex",
      background:  "var(--bg)",
    }}>

      {/* Sidebar */}
      <aside style={{
        width:         "240px",
        flexShrink:    0,
        borderRight:   "1px solid var(--border)",
        padding:       "32px 16px",
        display:       "flex",
        flexDirection: "column",
        gap:           "4px",
        position:      "sticky",
        top:           "68px",
        height:        "calc(100vh - 68px)",
        overflowY:     "auto",
      }}
        className="dashboard-sidebar"
      >
        {/* User info */}
        <div style={{
          padding:       "12px",
          marginBottom:  "16px",
          borderBottom:  "1px solid var(--border)",
          paddingBottom: "20px",
        }}>
          <div style={{
            width:          "40px",
            height:         "40px",
            borderRadius:   "50%",
            background:     "var(--accent-dim)",
            border:         "1px solid var(--accent-glow)",
            color:          "var(--accent)",
            fontSize:       "16px",
            fontWeight:     600,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            marginBottom:   "10px",
          }}>
            {user?.first_name?.[0]?.toUpperCase() || "U"}
          </div>
          <p style={{ fontSize: "14px", fontWeight: 500,
            color: "var(--text)", marginBottom: "2px" }}>
            {user?.first_name} {user?.last_name}
          </p>
          <p style={{ fontSize: "12px", color: "var(--text-3)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user?.email}
          </p>
        </div>

        {/* Nav links */}
        {NAV.map(({ to, label, icon, end }) => (
          <NavLink key={to} to={to} end={end}
            style={({ isActive }) => ({
              display:        "flex",
              alignItems:     "center",
              gap:            "10px",
              padding:        "10px 14px",
              borderRadius:   "var(--r-md)",
              fontSize:       "14px",
              color:          isActive ? "var(--text)" : "var(--text-3)",
              background:     isActive ? "var(--surface-2)" : "transparent",
              border:         isActive ? "1px solid var(--border)" : "1px solid transparent",
              fontWeight:     isActive ? 500 : 400,
              transition:     "all var(--dur) var(--ease)",
              textDecoration: "none",
            })}>
            <span style={{ fontSize: "12px" }}>{icon}</span>
            {label}
          </NavLink>
        ))}

        <div style={{ flex: 1 }} />

        <button
          onClick={() => { logout(); navigate("/") }}
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          "10px",
            padding:      "10px 14px",
            borderRadius: "var(--r-md)",
            fontSize:     "13px",
            color:        "var(--text-3)",
            background:   "none",
            border:       "none",
            cursor:       "pointer",
            textAlign:    "left",
            width:        "100%",
            transition:   "color var(--dur) var(--ease)",
          }}
          className="hover-accent"
        >
          <span>↗</span> Cerrar sesión
        </button>
      </aside>

      {/* ← children en lugar de <Outlet /> */}
      <main style={{ flex: 1, overflowX: "hidden" }}>
        {children}
      </main>

      <style>{`
        @media (max-width: 768px) {
          .dashboard-sidebar { display: none !important; }
        }
      `}</style>
    </div>
  )
}