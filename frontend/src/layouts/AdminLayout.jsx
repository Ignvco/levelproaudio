// layouts/AdminLayout.jsx
import { useState }                                          from "react"
import { NavLink, Link, useNavigate, useLocation, Outlet }  from "react-router-dom"
import { useAuthStore }                                      from "../store/authStore"
import logoImg                                               from "../assets/logo.png"
import {
  LayoutDashboard, LineChart, BarChart3, ChevronRight,
  ShoppingBag, CreditCard, Users, Package, Boxes, GraduationCap,
  Wrench, Gift, Wallet, Receipt, Star, Palette,
} from "lucide-react"

// ── NavGroup colapsable ───────────────────────────────────────
function NavGroup({ item }) {
  const location = useLocation()
  const isOpen   = item.children.some(c => location.pathname.startsWith(c.to))
  const [open, setOpen] = useState(isOpen)
  const Icon = item.icon

  return (
    <div style={{ marginBottom:"2px" }}>
      <button onClick={() => setOpen(!open)} style={{
        width:"100%", display:"flex", alignItems:"center", gap:"10px",
        padding:"9px 10px", borderRadius:"var(--r-md)", fontSize:"13px",
        background:"none", border:"none", cursor:"pointer",
        color: isOpen ? "var(--text)" : "var(--text-2)",
        transition:"all var(--dur) var(--ease)",
        fontWeight: isOpen ? 500 : 400,
      }}>
        {Icon && <Icon size={15} strokeWidth={1.7}
          style={{ opacity: isOpen ? 0.9 : 0.55, flexShrink:0 }} />}
        <span style={{ flex:1, textAlign:"left" }}>{item.label}</span>
        <ChevronRight size={13} strokeWidth={1.7}
          style={{ opacity:0.4,
            transform: open ? "rotate(90deg)" : "none",
            transition:"transform var(--dur)" }} />
      </button>
      {open && (
        <div style={{ paddingLeft:"28px", marginTop:"2px" }}>
          {item.children.map(child => (
            <NavLink key={child.to} to={child.to}
              style={({ isActive }) => ({
                display:"block", padding:"7px 10px", borderRadius:"var(--r-md)",
                fontSize:"12px", marginBottom:"1px",
                color:      isActive ? "var(--accent)"    : "var(--text-3)",
                background: isActive ? "var(--surface-2)" : "transparent",
                transition:"all var(--dur) var(--ease)",
              })}>
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Separador visual ──────────────────────────────────────────
function NavSep({ label }) {
  return (
    <p style={{ fontSize:"10px", fontWeight:600, color:"var(--text-3)",
      textTransform:"uppercase", letterSpacing:"0.08em",
      padding:"14px 10px 4px", opacity:0.5 }}>
      {label}
    </p>
  )
}

// ── NavItems (reorganizados y con iconos lucide) ──────────────
const navItems = [
  // ── Panel ──
  { sep: "Panel" },
  { to:"/admin",           label:"Dashboard",       icon:LayoutDashboard, end:true },
  { to:"/admin/executive", label:"Vista Ejecutiva", icon:LineChart },
  { to:"/admin/analytics", label:"Analytics",       icon:BarChart3 },

  // ── Ventas ──
  { sep: "Ventas" },
  { to:"/admin/orders",   label:"Órdenes",   icon:ShoppingBag },
  { to:"/admin/payments", label:"Pagos",     icon:CreditCard },
  { to:"/admin/services", label:"Servicios", icon:Wrench },
  { to:"/admin/users",    label:"Usuarios",  icon:Users },

  // ── Catálogo ──
  { sep: "Catálogo" },
  {
    label:"Productos", icon:Package,
    children:[
      { to:"/admin/products",        label:"Catálogo"   },
      { to:"/admin/brands",          label:"Marcas"     },
      { to:"/admin/categories",      label:"Categorías" },
      { to:"/admin/products/import", label:"Importar"   },
    ],
  },
  { to:"/admin/inventory", label:"Inventario", icon:Boxes },

  // ── Academia ──
  { sep: "Academia" },
  {
    label:"Academia", icon:GraduationCap,
    children:[
      { to:"/admin/academy",              label:"Cursos"         },
      { to:"/admin/academy/modules",      label:"Módulos"        },
      { to:"/admin/academy/lessons",      label:"Lecciones"      },
      { to:"/admin/academy/enrollments",  label:"Inscripciones"  },
    ],
  },

  // ── Programas (Rewards + Fidelización unificados) ──
  { sep: "Programas de fidelización" },
  {
    label:"Rewards", icon:Gift,
    children:[
      { to:"/admin/rewards",           label:"Dashboard"       },
      { to:"/admin/rewards/campaigns", label:"Campañas"        },
      { to:"/admin/rewards/entries",   label:"Participaciones" },
      { to:"/admin/rewards/winners",   label:"Ganadores"       },
    ],
  },
  { to:"/admin/loyalty", label:"Puntos y niveles", icon:Star },

  // ── Finanzas ──
  { sep: "Finanzas" },
  { to:"/admin/finance", label:"Finanzas",    icon:Wallet },
  { to:"/admin/billing", label:"Facturación", icon:Receipt },

  // ── Sitio web ──
  { sep: "Sitio web" },
  { to:"/admin/settings", label:"Personalización", icon:Palette },
]

// ── AdminLayout ───────────────────────────────────────────────
export default function AdminLayout() {
  const { user, logout } = useAuthStore()
  const navigate         = useNavigate()

  return (
    <div style={{ minHeight:"100vh", display:"flex",
      background:"var(--bg)", fontFamily:"var(--font-sans)" }}>

      {/* Sidebar */}
      <aside style={{
        width:"220px", flexShrink:0,
        borderRight:"1px solid var(--border)",
        background:"var(--surface)",
        display:"flex", flexDirection:"column",
        position:"sticky", top:0, height:"100vh",
      }}>

        {/* Logo */}
        <div style={{ padding:"20px 16px", borderBottom:"1px solid var(--border)",
          display:"flex", alignItems:"center", gap:"10px" }}>
          <Link to="/" style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <img src={logoImg} alt="LevelPro"
              style={{ height:"28px", filter:"brightness(0) invert(1)", maxWidth:"100px" }} />
          </Link>
          <span style={{ marginLeft:"auto", fontSize:"10px", fontWeight:600,
            padding:"2px 7px", borderRadius:"100px",
            background:"var(--accent-glow)", color:"var(--accent)",
            border:"1px solid rgba(26,255,110,0.2)", letterSpacing:"0.06em" }}>
            ADMIN
          </span>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:"6px 8px", overflowY:"auto" }}>
          {navItems.map((item, i) => {

            // Separador
            if (item.sep) return <NavSep key={item.sep + i} label={item.sep} />

            // Grupo colapsable
            if (item.children) return <NavGroup key={item.label} item={item} />

            // Link simple
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to} end={item.end}
                style={({ isActive }) => ({
                  display:"flex", alignItems:"center", gap:"10px",
                  padding:"9px 10px", borderRadius:"var(--r-md)",
                  fontSize:"13px", marginBottom:"2px",
                  fontWeight:   isActive ? 500 : 400,
                  color:        isActive ? "var(--text)"      : "var(--text-2)",
                  background:   isActive ? "var(--surface-2)" : "transparent",
                  transition:"all var(--dur) var(--ease)",
                })}>
                {Icon && <Icon size={15} strokeWidth={1.7}
                  style={{ opacity:0.6, flexShrink:0 }} />}
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer del sidebar */}
        <div style={{ padding:"10px 8px", borderTop:"1px solid var(--border)" }}>
          <div style={{ padding:"8px 10px", marginBottom:"4px" }}>
            <p style={{ fontSize:"12px", fontWeight:500, overflow:"hidden",
              textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {user?.email}
            </p>
            <p style={{ fontSize:"11px", color:"var(--text-3)" }}>
              {user?.is_superuser ? "Superusuario" : "Staff"}
            </p>
          </div>
          <Link to="/" style={{ display:"flex", alignItems:"center", gap:"8px",
            padding:"8px 10px", borderRadius:"var(--r-md)", fontSize:"12px",
            color:"var(--text-3)", transition:"color var(--dur)", marginBottom:"2px" }}>
            ← Ver sitio
          </Link>
          <button onClick={() => { logout(); navigate("/admin/login") }}
            style={{ width:"100%", display:"flex", alignItems:"center", gap:"8px",
              padding:"8px 10px", borderRadius:"var(--r-md)", fontSize:"12px",
              color:"var(--text-3)", background:"none", border:"none",
              cursor:"pointer", transition:"color var(--dur)" }}>
            ↗ Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main style={{ flex:1, overflow:"auto", minWidth:0 }}>
        <Outlet />
      </main>
    </div>
  )
}
