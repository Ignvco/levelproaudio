// layouts/AdminLayout.jsx
import { useState }                                          from "react"
import { NavLink, Link, useNavigate, useLocation, Outlet }  from "react-router-dom"
import { useAuthStore }                                      from "../store/authStore"
import logoImg                                               from "../assets/logo.png"
import {
  LayoutDashboard, LineChart, BarChart3, ChevronRight,
  ShoppingBag, CreditCard, Users, Package, Boxes, GraduationCap,
  Wrench, Gift, Wallet, Receipt, Star, Palette, ExternalLink, LogOut,
} from "lucide-react"

// ── NavGroup colapsable ───────────────────────────────────────
function NavGroup({ item }) {
  const location = useLocation()
  const isOpen   = item.children.some(c => location.pathname.startsWith(c.to))
  const [open, setOpen] = useState(isOpen)
  const Icon = item.icon

  return (
    <div style={{ marginBottom:"2px" }}>
      <button onClick={() => setOpen(!open)}
        className={`admin-nav-link${isOpen ? " group-open" : ""}`}
        style={{ width:"100%", background:"none", border:"none", cursor:"pointer" }}>
        {Icon && <Icon size={16} strokeWidth={1.8} style={{ flexShrink:0 }} />}
        <span style={{ flex:1, textAlign:"left" }}>{item.label}</span>
        <ChevronRight size={13} strokeWidth={2}
          style={{ opacity:0.5,
            transform: open ? "rotate(90deg)" : "none",
            transition:"transform 200ms var(--ease)" }} />
      </button>
      {open && (
        <div style={{ paddingLeft:"30px", marginTop:"2px", marginBottom:"4px" }}>
          {item.children.map(child => (
            <NavLink key={child.to} to={child.to}
              className={({ isActive }) => `admin-nav-sublink${isActive ? " active" : ""}`}>
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
    <p style={{ fontSize:"10px", fontWeight:700, color:"var(--text-3)",
      textTransform:"uppercase", letterSpacing:"0.12em",
      padding:"18px 12px 6px", opacity:0.55 }}>
      {label}
    </p>
  )
}

// ── NavItems ──────────────────────────────────────────────────
const navItems = [
  { sep: "Panel" },
  { to:"/admin",           label:"Dashboard",       icon:LayoutDashboard, end:true },
  { to:"/admin/executive", label:"Vista Ejecutiva", icon:LineChart },
  { to:"/admin/analytics", label:"Analytics",       icon:BarChart3 },

  { sep: "Ventas" },
  { to:"/admin/orders",   label:"Órdenes",   icon:ShoppingBag },
  { to:"/admin/payments", label:"Pagos",     icon:CreditCard },
  { to:"/admin/services", label:"Servicios", icon:Wrench },
  { to:"/admin/users",    label:"Usuarios",  icon:Users },

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

  { sep: "Finanzas" },
  { to:"/admin/finance", label:"Finanzas",    icon:Wallet },
  { to:"/admin/billing", label:"Facturación", icon:Receipt },

  { sep: "Sitio web" },
  { to:"/admin/settings", label:"Personalización", icon:Palette },
]

// ── AdminLayout ───────────────────────────────────────────────
export default function AdminLayout() {
  const { user, logout } = useAuthStore()
  const navigate         = useNavigate()
  const initial = (user?.first_name?.[0] || user?.email?.[0] || "A").toUpperCase()

  return (
    <div style={{ minHeight:"100vh", display:"flex",
      background:"var(--bg)", fontFamily:"var(--font-sans)" }}>

      {/* Sidebar */}
      <aside style={{
        width:"236px", flexShrink:0,
        borderRight:"1px solid var(--border)",
        background:"var(--bg-2)",
        display:"flex", flexDirection:"column",
        position:"sticky", top:0, height:"100vh",
      }}>

        {/* Logo */}
        <div style={{ padding:"22px 18px 20px", borderBottom:"1px solid var(--border)",
          display:"flex", alignItems:"center", gap:"10px" }}>
          <Link to="/" style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <img src={logoImg} alt="LevelPro"
              style={{ height:"26px", filter:"brightness(0) invert(1)", maxWidth:"110px" }} />
          </Link>
          <span style={{ marginLeft:"auto", fontSize:"9px", fontWeight:700,
            padding:"3px 8px", borderRadius:"100px",
            background:"var(--accent-glow)", color:"var(--accent)",
            border:"1px solid rgba(26,255,110,0.25)", letterSpacing:"0.1em" }}>
            ADMIN
          </span>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:"6px 10px 14px", overflowY:"auto" }}>
          {navItems.map((item, i) => {
            if (item.sep) return <NavSep key={item.sep + i} label={item.sep} />
            if (item.children) return <NavGroup key={item.label} item={item} />
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to} end={item.end}
                className={({ isActive }) => `admin-nav-link${isActive ? " active" : ""}`}>
                {Icon && <Icon size={16} strokeWidth={1.8} style={{ flexShrink:0 }} />}
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer del sidebar */}
        <div style={{ padding:"12px 10px", borderTop:"1px solid var(--border)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px",
            padding:"8px 10px", marginBottom:"6px" }}>
            <span style={{ width:"32px", height:"32px", borderRadius:"50%",
              background:"var(--accent)", color:"#000", flexShrink:0,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:"13px", fontWeight:800 }}>
              {initial}
            </span>
            <div style={{ minWidth:0 }}>
              <p style={{ fontSize:"12px", fontWeight:600, overflow:"hidden",
                textOverflow:"ellipsis", whiteSpace:"nowrap", color:"var(--text)" }}>
                {user?.email}
              </p>
              <p style={{ fontSize:"11px", color:"var(--text-3)" }}>
                {user?.is_superuser ? "Superusuario" : "Staff"}
              </p>
            </div>
          </div>
          <Link to="/" className="admin-nav-link" style={{ fontSize:"12px" }}>
            <ExternalLink size={14} strokeWidth={1.8} /> Ver sitio
          </Link>
          <button onClick={() => { logout(); navigate("/admin/login") }}
            className="admin-nav-link"
            style={{ width:"100%", background:"none", border:"none", cursor:"pointer",
              fontSize:"12px" }}>
            <LogOut size={14} strokeWidth={1.8} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main style={{ flex:1, overflow:"auto", minWidth:0,
        background:"radial-gradient(ellipse 80% 40% at 50% 0%, rgba(26,255,110,0.03) 0%, transparent 60%), var(--bg)" }}>
        <Outlet />
      </main>

      <style>{`
        .admin-nav-link {
          display: flex; align-items: center; gap: 11px;
          padding: 9px 12px; border-radius: 11px;
          font-size: 13px; font-weight: 500; margin-bottom: 2px;
          color: var(--text-2); text-decoration: none;
          position: relative;
          transition: color 180ms var(--ease), background 180ms var(--ease), box-shadow 180ms var(--ease);
        }
        .admin-nav-link svg { opacity: 0.6; transition: opacity 180ms var(--ease); }
        .admin-nav-link:hover { color: var(--text); background: rgba(255,255,255,0.035); }
        .admin-nav-link:hover svg { opacity: 0.9; }
        .admin-nav-link.active,
        .admin-nav-link.group-open.active {
          color: var(--accent); font-weight: 600;
          background: var(--accent-glow);
          box-shadow: inset 2px 0 0 var(--accent);
        }
        .admin-nav-link.active svg { opacity: 1; }
        .admin-nav-link.group-open { color: var(--text); }

        .admin-nav-sublink {
          display: block; padding: 7px 12px; border-radius: 9px;
          font-size: 12.5px; margin-bottom: 1px; color: var(--text-3);
          text-decoration: none; position: relative;
          transition: color 160ms var(--ease), background 160ms var(--ease);
        }
        .admin-nav-sublink:hover { color: var(--text-2); background: rgba(255,255,255,0.03); }
        .admin-nav-sublink.active {
          color: var(--accent); font-weight: 600;
          background: var(--accent-glow);
          box-shadow: inset 2px 0 0 var(--accent);
        }
      `}</style>
    </div>
  )
}
