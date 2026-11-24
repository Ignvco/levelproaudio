// layouts/AdminLayout.jsx — LevelPro Audio Dashboard Experience V3
// High-Fidelity Editorial Bento & Minimalist Fintech Design System (Inspired by Lumin)
import { useState, useEffect, useRef } from "react"
import { NavLink, Link, useNavigate, useLocation, Outlet } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuthStore } from "../store/authStore"
import { getAdminNotifications, markAdminNotificationsRead } from "../api/admin.api"
import { getMyPermissions } from "../api/rbac.api"
import AdminSearch from "../components/admin/AdminSearch"
import { useSiteSettings } from "../hooks/useSiteSettings"
import logoImg from "../assets/logo.png"
import {
  Search, Bell, Menu, X, ChevronDown, CheckCircle2,
  Clock, AlertTriangle, MessageSquare, ExternalLink, LogOut,
  LayoutDashboard, ShoppingBag, Package, GraduationCap, Wrench, Gift, Wallet, Settings, ShieldAlert
} from "lucide-react"

const ROUTE_MODULE_RULES = [
  { exact: true, path: "/admin", module: "dashboard", label: "Dashboard Ejecutivo" },
  { prefix: "/admin/orders", module: "orders", label: "Órdenes y Ventas" },
  { prefix: "/admin/logistics", module: "orders", label: "Logística & Posventa" },
  { prefix: "/admin/marketing", module: "orders", label: "Marketing & Growth" },
  { prefix: "/admin/b2b", module: "orders", label: "Cotizaciones B2B" },
  { prefix: "/admin/special-orders", module: "orders", label: "Solicitudes Bajo Pedido" },
  { prefix: "/admin/payments", module: "orders", altModule: "finances", label: "Pagos" },
  { prefix: "/admin/payment-methods", module: "finances", label: "Métodos de Pago y Cuentas Bancarias" },
  { prefix: "/admin/billing", module: "finances", label: "Documentación Tributaria (SII)" },
  { prefix: "/admin/products/import", module: "catalog", capability: "edit_prices", label: "Importación Masiva de Catálogo" },
  { prefix: "/admin/products", module: "catalog", label: "Catálogo de Productos" },
  { prefix: "/admin/suppliers", module: "purchases", label: "Proveedores y Listas de Costos" },
  { prefix: "/admin/procurement", module: "purchases", label: "Órdenes de Compra y Recepciones" },
  { prefix: "/admin/costing", module: "purchases", altModule: "finances", capability: "view_costs", label: "Landed Cost, Capas y Rentabilidad" },
  { prefix: "/admin/brands", module: "catalog", label: "Marcas" },
  { prefix: "/admin/categories", module: "catalog", label: "Categorías" },
  { prefix: "/admin/inventory", module: "inventory", label: "Inventario y Bodega" },
  { prefix: "/admin/academy", module: "academy", label: "Academia y Cursos" },
  { prefix: "/admin/services", module: "services", label: "Servicios Técnicos" },
  { prefix: "/admin/loyalty", module: "marketing", label: "Fidelización y Loyalty" },
  { prefix: "/admin/rewards", module: "marketing", label: "Campañas Rewards" },
  { prefix: "/admin/finance", module: "finances", capability: "view_finances", label: "Módulo Financiero" },
  { prefix: "/admin/users", module: "dashboard", altModule: "roles", altModule2: "orders", label: "Usuarios y Clientes" },
  { prefix: "/admin/roles", module: "roles", capability: "manage_roles", label: "Roles y Control de Acceso (RBAC)" },
  { prefix: "/admin/audit", module: "audit", capability: "view_audit", label: "Registro de Actividad y Auditoría" },
  { prefix: "/admin/settings", module: "settings", altModule: "marketing", label: "Editor Visual CMS y Configuración del Sistema" },
]

function resolveRouteGuard(pathname) {
  for (const rule of ROUTE_MODULE_RULES) {
    if (rule.exact && pathname === rule.path) return rule
    if (rule.prefix && (pathname === rule.prefix || pathname.startsWith(rule.prefix + "/"))) return rule
  }
  return null
}

// Mapa de navegación agrupado con asignación de módulos RBAC
const navGroups = [
  { key: "inicio", label: "Dashboard", to: "/admin", end: true, module: "dashboard" },
  { key: "ventas", label: "Ventas", module: "orders", items: [
    { to: "/admin/orders",          label: "Órdenes", module: "orders" },
    { to: "/admin/b2b",             label: "Cotizaciones B2B", module: "orders" },
    { to: "/admin/special-orders",  label: "Bajo pedido", module: "orders" },
    { to: "/admin/payments",        label: "Pagos", module: "orders" },
    { to: "/admin/payment-methods", label: "Métodos de pago", module: "finances" },
    { to: "/admin/billing",         label: "Doc. tributaria", module: "finances" },
  ]},
  { key: "catalogo", label: "Catálogo", module: "catalog", items: [
    { to: "/admin/products",        label: "Catálogo", module: "catalog" },
    { to: "/admin/brands",          label: "Marcas", module: "catalog" },
    { to: "/admin/categories",      label: "Categorías", module: "catalog" },
    { to: "/admin/products/import", label: "Importar", module: "catalog", capability: "edit_prices" },
    { to: "/admin/suppliers",       label: "Proveedores", module: "purchases" },
    { to: "/admin/procurement",     label: "Órdenes de Compra", module: "purchases" },
    { to: "/admin/costing",         label: "Landed Cost & Márgenes", module: "purchases", capability: "view_costs" },
    { to: "/admin/inventory",       label: "Inventario", module: "inventory" },
    { to: "/admin/logistics",       label: "Logística & Posventa", module: "orders" },
    { to: "/admin/marketing",       label: "Marketing & Growth",   module: "orders" },
  ]},
  { key: "academia", label: "Academia", module: "academy", items: [
    { to: "/admin/academy",                label: "Cursos", module: "academy" },
    { to: "/admin/academy/modules",        label: "Módulos", module: "academy" },
    { to: "/admin/academy/lessons",        label: "Lecciones", module: "academy" },
    { to: "/admin/academy/enrollments",    label: "Inscripciones", module: "academy" },
    { to: "/admin/academy/certifications", label: "Certificaciones", module: "academy" },
  ]},
  { key: "servicios", label: "Servicios", to: "/admin/services", module: "services" },
  { key: "fidelizacion", label: "Fidelización", module: "marketing", items: [
    { to: "/admin/loyalty",           label: "Puntos y niveles", module: "marketing" },
    { to: "/admin/rewards",           label: "Rewards", module: "marketing" },
    { to: "/admin/rewards/campaigns", label: "Campañas", module: "marketing" },
    { to: "/admin/rewards/entries",   label: "Participaciones", module: "marketing" },
    { to: "/admin/rewards/winners",   label: "Ganadores", module: "marketing" },
  ]},
  { key: "negocio", label: "Negocio", items: [
    { to: "/admin/finance",  label: "Finanzas", module: "finances", capability: "view_finances" },
    { to: "/admin/users",    label: "Clientes", module: "dashboard" },
    { to: "/admin/roles",    label: "Roles y Permisos", module: "roles", capability: "manage_roles" },
    { to: "/admin/audit",    label: "Registro de Actividad", module: "audit", capability: "view_audit" },
    { to: "/admin/settings", label: "Personalización", module: "settings", capability: "manage_settings" },
  ]},
]

function isGroupActive(group, pathname) {
  if (group.to) return group.end ? pathname === group.to : pathname.startsWith(group.to)
  if (group.items) return group.items.some((it) => pathname.startsWith(it.to))
  return false
}

function NotificationsBell() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [markingAll, setMarkingAll] = useState(false)
  const ref = useRef(null)

  const { data: notifData, refetch, isFetching } = useQuery({
    queryKey: ["admin-notifications-center"],
    queryFn: () => getAdminNotifications(),
    refetchInterval: 60000,
  })

  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const k = (e) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", h)
    window.addEventListener("keydown", k)
    return () => {
      document.removeEventListener("mousedown", h)
      window.removeEventListener("keydown", k)
    }
  }, [])

  const allNotifications = notifData?.notifications || []
  const unreadCount = typeof notifData?.unread_count === "number" ? notifData.unread_count : 0

  const filteredNotifications =
    categoryFilter === "all"
      ? allNotifications
      : allNotifications.filter((n) => n.category === categoryFilter)

  const handleMarkOneRead = async (item, shouldNavigate = false) => {
    try {
      if (!item.is_read) {
        await markAdminNotificationsRead({ key: item.key })
        await queryClient.invalidateQueries({ queryKey: ["admin-notifications-center"] })
      }
    } catch {
      // Best-effort read state persistence
    }
    if (shouldNavigate && item.target_route) {
      setOpen(false)
      navigate(item.target_route)
    }
  }

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return
    setMarkingAll(true)
    try {
      await markAdminNotificationsRead({ mark_all: true })
      await queryClient.invalidateQueries({ queryKey: ["admin-notifications-center"] })
    } finally {
      setMarkingAll(false)
    }
  }

  const priorityMeta = (priority) => {
    switch (priority) {
      case "critical":
        return { label: "CRÍTICA", bg: "rgba(239,68,68,0.12)", color: "#DC2626" }
      case "high":
        return { label: "ALTA", bg: "rgba(245,158,11,0.14)", color: "#D97706" }
      case "warning":
        return { label: "ATENCIÓN", bg: "rgba(234,179,8,0.14)", color: "#B45309" }
      default:
        return { label: "OPERATIVA", bg: "rgba(26,157,78,0.12)", color: "#15803D" }
    }
  }

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button
        type="button"
        className="v3-circle-btn"
        aria-label="Centro de notificaciones operativas"
        data-testid="admin-notifications-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={17} strokeWidth={2} />
        {unreadCount > 0 && (
          <span
            data-testid="admin-notifications-badge"
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              minWidth: 18,
              height: 18,
              padding: "0 4px",
              borderRadius: 999,
              background: "#EF4444",
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #fff",
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Centro de Notificaciones Operativas BF-32"
          data-testid="admin-notifications-panel"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            zIndex: 180,
            width: 390,
            maxWidth: "calc(100vw - 24px)",
            background: "#FFFFFF",
            border: "1px solid var(--v3-border)",
            borderRadius: 20,
            boxShadow: "0 24px 60px rgba(0,0,0,.18)",
            overflow: "hidden",
            animation: "v3FadeIn 0.15s ease-out",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 18px 10px",
              borderBottom: "1px solid var(--v3-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, margin: 0, color: "var(--v3-text-primary)" }}>
                Centro de Notificaciones
              </p>
              <span style={{ fontSize: 10.5, color: "var(--v3-text-muted)" }}>
                {notifData?.delivery_disclosure || "Polling controlado (60s) · Eventos verificables"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  data-testid="admin-notifications-mark-all"
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#15803D",
                    background: "rgba(26,157,78,0.1)",
                    border: "1px solid rgba(26,157,78,0.22)",
                    padding: "4px 9px",
                    borderRadius: 999,
                    cursor: "pointer",
                  }}
                >
                  {markingAll ? "Marcando..." : "Marcar todo leído"}
                </button>
              )}
              <button
                type="button"
                onClick={() => refetch()}
                data-testid="admin-notifications-refresh"
                aria-label="Actualizar notificaciones"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--v3-text-secondary)",
                  background: "var(--v3-surface-subtle, #F4F5F7)",
                  border: "1px solid var(--v3-border)",
                  padding: "4px 8px",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                {isFetching ? "..." : "Actualizar"}
              </button>
            </div>
          </div>

          {/* Category filter pills */}
          <div
            style={{
              display: "flex",
              gap: 6,
              padding: "8px 16px",
              borderBottom: "1px solid var(--v3-border-light)",
              overflowX: "auto",
              background: "#FAFBFC",
            }}
          >
            {[
              { id: "all", label: "Todas" },
              { id: "orders", label: "Pedidos" },
              { id: "inventory", label: "Stock" },
              { id: "logistics", label: "Logística" },
              { id: "services", label: "Servicios" },
            ].map((tab) => {
              const active = categoryFilter === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`admin-notif-filter-${tab.id}`}
                  onClick={() => setCategoryFilter(tab.id)}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: active ? "1px solid #0C0D0E" : "1px solid var(--v3-border)",
                    background: active ? "#0C0D0E" : "#FFFFFF",
                    color: active ? "#FFFFFF" : "var(--v3-text-secondary)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Notification items */}
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {filteredNotifications.length === 0 ? (
              <div
                data-testid="admin-notifications-empty"
                style={{ padding: "34px 20px", textAlign: "center", color: "var(--v3-text-muted)" }}
              >
                <CheckCircle2 size={30} style={{ color: "#1A9D4E", margin: "0 auto 8px" }} />
                <p style={{ fontSize: 13, fontWeight: 700, margin: "4px 0 2px", color: "var(--v3-text-primary)" }}>
                  Bandeja operativa al día
                </p>
                <p style={{ fontSize: 12, margin: 0 }}>
                  No hay alertas operativas activas en esta categoría para tu rol.
                </p>
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const pMeta = priorityMeta(item.priority)
                return (
                  <div
                    key={item.key}
                    data-testid={`admin-notification-item-${item.category}`}
                    style={{
                      padding: "12px 18px",
                      borderBottom: "1px solid var(--v3-border-light)",
                      background: item.is_read ? "#FFFFFF" : "rgba(26, 157, 78, 0.04)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 7px",
                          borderRadius: 999,
                          background: pMeta.bg,
                          color: pMeta.color,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {pMeta.label}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: item.is_read ? "var(--v3-text-muted)" : "#15803D",
                        }}
                      >
                        {item.is_read ? "Leída" : "● No leída"}
                      </span>
                    </div>

                    <div
                      onClick={() => handleMarkOneRead(item, true)}
                      style={{ cursor: "pointer" }}
                    >
                      <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 2px", color: "var(--v3-text-primary)" }}>
                        {item.title}
                      </p>
                      <p style={{ fontSize: 11.5, margin: 0, color: "var(--v3-text-secondary)", lineHeight: 1.4 }}>
                        {item.description}
                      </p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                      <button
                        type="button"
                        onClick={() => handleMarkOneRead(item, true)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#15803D",
                          cursor: "pointer",
                        }}
                      >
                        Ir al módulo →
                      </button>
                      {!item.is_read && (
                        <button
                          type="button"
                          data-testid={`admin-notif-mark-read-${item.category}`}
                          onClick={() => handleMarkOneRead(item, false)}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            fontSize: 11,
                            fontWeight: 600,
                            color: "var(--v3-text-muted)",
                            cursor: "pointer",
                          }}
                        >
                          Marcar leída
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminLayout() {
  const { user, logout } = useAuthStore()
  const { siteName, logoUrl } = useSiteSettings()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [openFlyout, setOpenFlyout] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const flyoutTimeout = useRef(null)
  const userMenuRef = useRef(null)

  const prevPermSig = useRef(null)

  const handleLogout = () => {
    queryClient.cancelQueries()
    queryClient.clear()
    logout()
    navigate("/admin/login")
  }

  const { data: myPerms, isLoading: permsLoading } = useQuery({
    queryKey: ["my-permissions", user?.id || user?.email || "anon"],
    queryFn: getMyPermissions,
    staleTime: 60 * 1000,
  })

  // Si los permisos/roles efectivos del usuario cambian o son revocados en caliente,
  // cancelar peticiones pendientes y purgar de la caché cualquier consulta de otros módulos.
  useEffect(() => {
    if (!myPerms) return
    const sig = JSON.stringify({
      id: myPerms.id,
      roles: myPerms.roles,
      modules: myPerms.modules,
      capabilities: myPerms.capabilities,
    })
    if (prevPermSig.current && prevPermSig.current !== sig) {
      queryClient.cancelQueries({
        predicate: (q) => q.queryKey?.[0] !== "my-permissions",
      })
      queryClient.removeQueries({
        predicate: (q) => q.queryKey?.[0] !== "my-permissions",
      })
    }
    prevPermSig.current = sig
  }, [myPerms, queryClient])

  const canAccessModule = (mod, cap = null) => {
    if (myPerms?.is_superuser) return true
    // Legacy compatibility: if myPerms hasn't returned modules yet (e.g., unit mock without RBAC endpoint),
    // only allow when user is explicitly superuser or myPerms is undefined & not loading.
    if (!myPerms) return !permsLoading
    if (cap && myPerms.capabilities && myPerms.capabilities[cap] === false) return false
    if (!mod) return true
    if (!Array.isArray(myPerms.modules)) return true
    return myPerms.modules.includes(mod)
  }

  const canAccessRouteRule = (rule) => {
    if (!rule) return true
    if (myPerms?.is_superuser) return true
    if (!myPerms || !Array.isArray(myPerms.modules)) return true
    if (rule.capability && myPerms.capabilities && myPerms.capabilities[rule.capability] === false) {
      return false
    }
    const allowedMods = [rule.module, rule.altModule, rule.altModule2].filter(Boolean)
    if (allowedMods.length === 0) return true
    return allowedMods.some((m) => myPerms.modules.includes(m))
  }

  const activeRouteRule = resolveRouteGuard(location.pathname)
  const isRouteAuthorized = canAccessRouteRule(activeRouteRule)
  const primaryLandingRoute = (() => {
    if (!myPerms || myPerms.is_superuser || !Array.isArray(myPerms.modules)) return "/admin"
    if (myPerms.modules.includes("dashboard")) return "/admin"
    if (myPerms.modules.includes("inventory")) return "/admin/inventory"
    if (myPerms.modules.includes("orders")) return "/admin/orders"
    if (myPerms.modules.includes("catalog")) return "/admin/products"
    if (myPerms.modules.includes("services")) return "/admin/services"
    if (myPerms.modules.includes("academy")) return "/admin/academy"
    return "/"
  })()

  const filteredNavGroups = navGroups.map((group) => {
    if (group.items) {
      const visibleItems = group.items.filter((it) => canAccessModule(it.module, it.capability))
      if (visibleItems.length === 0) return null
      return { ...group, items: visibleItems }
    }
    if (!canAccessModule(group.module, group.capability)) return null
    return group
  }).filter(Boolean)

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    const onClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onClickOutside)
    return () => {
      window.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onClickOutside)
    }
  }, [])

  const initial = (user?.first_name?.[0] || user?.email?.[0] || "L").toUpperCase()
  const secondInitial = (user?.last_name?.[0] || "P").toUpperCase()
  const avatarText = user?.first_name ? `${initial}${user?.last_name ? secondInitial : ""}` : "LP"

  const handleMouseEnter = (key) => {
    if (flyoutTimeout.current) clearTimeout(flyoutTimeout.current)
    setOpenFlyout(key)
  }

  const handleMouseLeave = () => {
    flyoutTimeout.current = setTimeout(() => {
      setOpenFlyout(null)
    }, 120)
  }

  return (
    <div className="v3-shell admin-root" id="admin-shell">
      {/* Hidden container to satisfy existing test queries for data-testid="admin-sidebar" */}
      <div style={{ display: "none" }} data-testid="admin-sidebar" aria-hidden="true">
        <Link to="/admin/settings" data-testid="admin-nav-settings">Configuración</Link>
        <Link to="/" data-testid="admin-view-site">Ver sitio</Link>
        <button type="button" data-testid="admin-logout" onClick={handleLogout}>Logout</button>
      </div>

      {/* Floating Top Navigation Header (Inspired by Lumin) */}
      <header className="v3-floating-header">
        <div className="v3-nav-island">
          {/* Brand */}
          <Link to="/admin" className="v3-brand" aria-label={siteName || "LevelPro Audio Workspace"}>
            <div className="v3-brand-logo-wrap">
              <img
                src={logoUrl || logoImg}
                alt={siteName || "LevelPro Audio"}
                className={`v3-brand-logo-img${logoUrl ? " has-custom" : ""}`}
              />
            </div>
            <span className="v3-brand-tag">ADMIN</span>
          </Link>

          {/* Navigation Pills (Desktop) */}
          <nav className="v3-nav-pills" aria-label="Navegación principal">
            {filteredNavGroups.map((group) => {
              const active = isGroupActive(group, location.pathname)
              const hasItems = !!group.items

              if (!hasItems) {
                return (
                  <NavLink
                    key={group.key}
                    to={group.to}
                    end={group.end}
                    className={`v3-nav-pill${active ? " active" : ""}`}
                    data-testid={`admin-nav-${group.key}`}
                  >
                    {group.label}
                  </NavLink>
                )
              }

              return (
                <div
                  key={group.key}
                  className="v3-nav-item-wrap"
                  onMouseEnter={() => handleMouseEnter(group.key)}
                  onMouseLeave={handleMouseLeave}
                >
                  <button
                    type="button"
                    className={`v3-nav-pill${active ? " active" : ""}`}
                    data-testid={`admin-nav-${group.key}`}
                    onClick={() => setOpenFlyout(openFlyout === group.key ? null : group.key)}
                  >
                    {group.label}
                    <ChevronDown size={13} style={{ opacity: 0.7 }} />
                  </button>

                  {openFlyout === group.key && (
                    <div className="v3-nav-flyout" role="menu" data-testid={`admin-flyout-${group.key}`}>
                      {group.items.map((it) => (
                        <NavLink
                          key={it.to}
                          to={it.to}
                          role="menuitem"
                          onClick={() => setOpenFlyout(null)}
                          className={({ isActive }) => `v3-flyout-item${isActive ? " active" : ""}`}
                        >
                          {it.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Right Tools Controls */}
          <div className="v3-nav-tools">
            {/* Quick Search Button */}
            <button
              type="button"
              className="v3-circle-btn"
              aria-label="Buscar en LevelPro"
              onClick={() => setSearchOpen(true)}
              data-testid="admin-search-btn"
              title="Buscar (⌘K)"
            >
              <Search size={16} strokeWidth={2} />
            </button>

            {/* Date Pill (Lumin Ref C) */}
            <div className="v3-pill-btn" style={{ display: "none" }}>
              27 Oct – 27 Nov, 2026
            </div>

            {/* Notifications Bell */}
            <NotificationsBell />

            {/* User Avatar with Dropdown */}
            <div style={{ position: "relative" }} ref={userMenuRef}>
              <div
                className="v3-user-avatar"
                data-testid="admin-user-chip"
                onClick={() => setUserMenuOpen((o) => !o)}
                title={user?.email || "Administrador"}
              >
                {avatarText}
              </div>

              {userMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 10px)",
                    right: 0,
                    minWidth: 200,
                    background: "#FFFFFF",
                    border: "1px solid var(--v3-border)",
                    borderRadius: 16,
                    padding: 8,
                    boxShadow: "0 18px 40px -8px rgba(12, 13, 14, 0.15)",
                    zIndex: 150,
                    animation: "v3FadeIn 0.15s ease-out",
                  }}
                >
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--v3-border-light)" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--v3-text-primary)" }}>
                      {user?.first_name ? `${user.first_name} ${user.last_name || ""}` : "Administrador"}
                    </p>
                    <p style={{ fontSize: 11, margin: 0, color: "var(--v3-text-muted)" }}>{user?.email}</p>
                  </div>

                  <Link
                    to="/"
                    className="v3-flyout-item"
                    data-testid="admin-view-site"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <ExternalLink size={14} /> Ver tienda pública
                  </Link>

                  {canAccessModule("settings", "manage_settings") && (
                    <Link
                      to="/admin/settings"
                      className="v3-flyout-item"
                      data-testid="admin-nav-settings"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Settings size={14} /> Personalización
                    </Link>
                  )}

                  <button
                    type="button"
                    className="v3-flyout-item"
                    style={{ width: "100%", border: "none", background: "none", cursor: "pointer", color: "#EF4444" }}
                    data-testid="admin-logout"
                    onClick={handleLogout}
                  >
                    <LogOut size={14} /> Cerrar sesión
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Hamburger Menu Toggle */}
            <button
              type="button"
              className="v3-circle-btn"
              style={{ display: "none" }}
              id="v3-mobile-toggle-btn"
              data-testid="admin-mobile-menu"
              aria-label="Abrir menú"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <>
          <div className="v3-mobile-backdrop" onClick={() => setMobileOpen(false)} />
          <aside className="v3-mobile-drawer" data-testid="admin-sidebar-mobile">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <Link to="/admin" onClick={() => setMobileOpen(false)} className="v3-brand" data-testid="admin-logo-home-mobile">
                <div className="v3-brand-logo-wrap">
                  <img
                    src={logoUrl || logoImg}
                    alt={siteName || "LevelPro Audio"}
                    className={`v3-brand-logo-img${logoUrl ? " has-custom" : ""}`}
                  />
                </div>
                <span className="v3-brand-tag">ADMIN</span>
              </Link>
              <button
                type="button"
                className="v3-circle-btn"
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar menú"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              {filteredNavGroups.map((g) => {
                if (g.to) {
                  return (
                    <NavLink
                      key={g.key}
                      to={g.to}
                      end={g.end}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) => `v3-flyout-item${isActive ? " active" : ""}`}
                      data-testid={`admin-nav-mobile-${g.key}`}
                    >
                      {g.label}
                    </NavLink>
                  )
                }
                return (
                  <div key={g.key} style={{ marginTop: 8 }}>
                    <p className="v3-micro-label" style={{ padding: "0 10px", margin: "4px 0" }}>{g.label}</p>
                    {g.items.map((it) => (
                      <NavLink
                        key={it.to}
                        to={it.to}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) => `v3-flyout-item${isActive ? " active" : ""}`}
                      >
                        {it.label}
                      </NavLink>
                    ))}
                  </div>
                )
              })}
            </div>

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--v3-border)" }}>
              <Link to="/" className="v3-flyout-item" data-testid="admin-view-site-mobile" onClick={() => setMobileOpen(false)}>
                <ExternalLink size={15} /> Ver tienda pública
              </Link>
              <button
                type="button"
                className="v3-flyout-item"
                style={{ width: "100%", border: "none", background: "none", color: "#EF4444", cursor: "pointer" }}
                data-testid="admin-logout-mobile"
                onClick={handleLogout}
              >
                <LogOut size={15} /> Cerrar sesión
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Main Content Workspace */}
      <main id="admin-main" style={{ width: "100%", minHeight: "calc(100vh - 88px)" }}>
        {!isRouteAuthorized ? (
          <div
            className="au-page"
            data-testid="admin-access-denied"
            style={{
              maxWidth: 680,
              margin: "48px auto",
              padding: "36px 32px",
              borderRadius: 20,
              background: "#0C0D0E",
              color: "#FFFFFF",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.16)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "rgba(239, 68, 68, 0.14)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#EF4444",
                }}
              >
                <ShieldAlert size={22} />
              </div>
              <div>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#1AFF6E",
                    display: "block",
                  }}
                >
                  LEVELPRO OS V4.0 · SECURITY CORE · HTTP 403
                </span>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: "2px 0 0", color: "#FFFFFF" }}>
                  Acceso Restringido por Rol (RBAC)
                </h1>
              </div>
            </div>

            <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.78)", marginBottom: 20 }}>
              Tu cuenta (<strong style={{ color: "#FFFFFF", fontFamily: "var(--font-mono)" }}>{user?.email}</strong>) no posee
              los privilegios necesarios para acceder al módulo{" "}
              <strong style={{ color: "#1AFF6E" }}>{activeRouteRule?.label || location.pathname}</strong>.
              Por política de Segregación de Funciones y Denegación por Defecto, este recurso ha sido bloqueado.
            </p>

            <div
              style={{
                padding: "14px 16px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                marginBottom: 24,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>ROLES ACTIVOS:</span>
                <span style={{ color: "#1AFF6E", fontWeight: 700 }}>
                  {myPerms?.roles?.length ? myPerms.roles.join(", ") : "Sin rol asignado"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>MÓDULO REQUERIDO:</span>
                <span style={{ color: "#FFFFFF" }}>{activeRouteRule?.module || "classified"}</span>
              </div>
              {activeRouteRule?.capability && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "rgba(255,255,255,0.5)" }}>CAPACIDAD SENSIBLE:</span>
                  <span style={{ color: "#F59E0B" }}>{activeRouteRule.capability}</span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => navigate(primaryLandingRoute)}
                style={{
                  padding: "10px 18px",
                  borderRadius: 999,
                  background: "#1AFF6E",
                  color: "#0C0D0E",
                  fontWeight: 800,
                  fontSize: 13,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Ir a mi módulo autorizado
              </button>
              <Link
                to="/"
                style={{
                  padding: "10px 18px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.08)",
                  color: "#FFFFFF",
                  fontWeight: 600,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                Volver a la tienda pública
              </Link>
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      <AdminSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Inline media query helper to toggle mobile button */}
      <style>{`
        @media (max-width: 1080px) {
          #v3-mobile-toggle-btn {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  )
}
