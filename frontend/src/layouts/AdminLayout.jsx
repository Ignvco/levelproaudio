// layouts/AdminLayout.jsx — LevelPro Precision (Tiendanube / Nimbus Architecture)
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
  House, ShoppingBag, Package, Users, Layers, Truck, SlidersHorizontal,
  Landmark, Percent, LayoutGrid, GraduationCap, Settings, ExternalLink,
  PanelLeftClose, PanelLeftOpen, Search, Bell, Menu, X, ChevronDown,
  ChevronRight, CheckCircle2, LogOut, ShieldAlert
} from "lucide-react"

const ROUTE_MODULE_RULES = [
  { exact: true, path: "/admin", module: "dashboard", label: "Inicio" },
  { prefix: "/admin/orders", module: "orders", label: "Lista de ventas" },
  { prefix: "/admin/logistics", module: "orders", label: "Logística y taller" },
  { prefix: "/admin/marketing", module: "orders", label: "Cupones y promos" },
  { prefix: "/admin/b2b", module: "orders", label: "Cotizaciones B2B" },
  { prefix: "/admin/special-orders", module: "orders", label: "Bajo pedido" },
  { prefix: "/admin/payments", module: "orders", altModule: "finances", label: "Transacciones de pago" },
  { prefix: "/admin/payment-methods", module: "finances", label: "Medios de pago" },
  { prefix: "/admin/billing", module: "finances", label: "Doc. tributarios (DTE)" },
  { prefix: "/admin/products/import", module: "catalog", capability: "edit_prices", label: "Importar catálogo" },
  { prefix: "/admin/products", module: "catalog", label: "Productos" },
  { prefix: "/admin/suppliers", module: "purchases", label: "Proveedores" },
  { prefix: "/admin/procurement", module: "purchases", label: "Compras e importaciones" },
  { prefix: "/admin/costing", module: "purchases", altModule: "finances", capability: "view_costs", label: "Costos y precios" },
  { prefix: "/admin/brands", module: "catalog", label: "Marcas" },
  { prefix: "/admin/categories", module: "catalog", label: "Categorías" },
  { prefix: "/admin/inventory", module: "inventory", label: "Inventario y WMS" },
  { prefix: "/admin/academy", module: "academy", label: "Academia" },
  { prefix: "/admin/services", module: "services", label: "Servicios técnicos" },
  { prefix: "/admin/loyalty", module: "marketing", label: "Fidelización (Loyalty)" },
  { prefix: "/admin/rewards", module: "marketing", label: "Rewards y sorteos" },
  { prefix: "/admin/finance", module: "finances", capability: "view_finances", label: "Finanzas y tesorería" },
  { prefix: "/admin/users", module: "dashboard", altModule: "roles", altModule2: "orders", label: "Clientes CRM" },
  { prefix: "/admin/roles", module: "roles", capability: "manage_roles", label: "Roles y permisos RBAC" },
  { prefix: "/admin/audit", module: "audit", capability: "view_audit", label: "Auditoría forense" },
  { prefix: "/admin/settings", module: "settings", altModule: "marketing", label: "Tienda online (CMS)" },
]

function resolveRouteGuard(pathname) {
  for (const rule of ROUTE_MODULE_RULES) {
    if (rule.exact && pathname === rule.path) return rule
    if (rule.prefix && (pathname === rule.prefix || pathname.startsWith(rule.prefix + "/"))) return rule
  }
  return null
}

// Estructura jerárquica Tiendanube / Nimbus agrupada por secciones
const SIDEBAR_SECTIONS = [
  {
    key: "root",
    title: null,
    entries: [
      { key: "inicio", label: "Inicio", to: "/admin", end: true, icon: House, module: "dashboard", testId: "admin-nav-inicio" },
    ],
  },
  {
    key: "comercial",
    title: "Gestión comercial",
    entries: [
      {
        key: "ventas",
        label: "Ventas",
        icon: ShoppingBag,
        module: "orders",
        testId: "admin-nav-ventas",
        items: [
          { to: "/admin/orders", label: "Lista de ventas", module: "orders" },
          { to: "/admin/b2b", label: "Cotizaciones B2B", module: "orders" },
          { to: "/admin/special-orders", label: "Bajo pedido", module: "orders" },
          { to: "/admin/payments", label: "Transacciones", module: "orders" },
        ],
      },
      {
        key: "productos",
        label: "Productos",
        icon: Package,
        module: "catalog",
        testId: "admin-nav-catalogo",
        items: [
          { to: "/admin/products", label: "Lista de productos", module: "catalog" },
          { to: "/admin/inventory", label: "Inventario y WMS", module: "inventory" },
          { to: "/admin/categories", label: "Categorías", module: "catalog" },
          { to: "/admin/brands", label: "Marcas", module: "catalog" },
          { to: "/admin/products/import", label: "Importar catálogo", module: "catalog", capability: "edit_prices" },
        ],
      },
      {
        key: "clientes",
        label: "Clientes CRM",
        to: "/admin/users",
        icon: Users,
        module: "dashboard",
        testId: "admin-nav-clientes",
      },
    ],
  },
  {
    key: "operaciones",
    title: "Operaciones & Finanzas",
    entries: [
      {
        key: "compras",
        label: "Compras e import.",
        icon: Layers,
        module: "purchases",
        testId: "admin-nav-compras",
        items: [
          { to: "/admin/procurement", label: "Órdenes de compra", module: "purchases" },
          { to: "/admin/procurement?tab=receipts", label: "Recepciones (GR)", module: "purchases" },
          { to: "/admin/suppliers", label: "Proveedores", module: "purchases" },
        ],
      },
      { key: "logistica", label: "Logística y taller", to: "/admin/logistics", icon: Truck, module: "orders", testId: "admin-nav-logistica" },
      { key: "costos", label: "Costos y precios", to: "/admin/costing", icon: SlidersHorizontal, module: "purchases", capability: "view_costs", testId: "admin-nav-costos" },
      {
        key: "finanzas",
        label: "Finanzas y DTE",
        icon: Landmark,
        module: "finances",
        testId: "admin-nav-negocio",
        items: [
          { to: "/admin/finance", label: "Finanzas y tesorería", module: "finances", capability: "view_finances" },
          { to: "/admin/billing", label: "Doc. tributarios", module: "finances" },
        ],
      },
    ],
  },
  {
    key: "canales",
    title: "Marketing & Canales",
    entries: [
      {
        key: "marketing",
        label: "Cupones y growth",
        icon: Percent,
        module: "orders",
        testId: "admin-nav-fidelizacion",
        items: [
          { to: "/admin/marketing", label: "Cupones y promos", module: "orders" },
          { to: "/admin/loyalty", label: "Fidelización", module: "marketing" },
          { to: "/admin/rewards", label: "Resumen Rewards", module: "marketing" },
          { to: "/admin/rewards/campaigns", label: "Campañas Rewards", module: "marketing" },
          { to: "/admin/rewards/entries", label: "Participaciones", module: "marketing" },
          { to: "/admin/rewards/winners", label: "Ganadores", module: "marketing" },
        ],
      },
      { key: "tienda", label: "Tienda online", to: "/admin/settings", icon: LayoutGrid, module: "settings", capability: "manage_settings", testId: "admin-nav-settings" },
      {
        key: "academia",
        label: "Academia y serv.",
        icon: GraduationCap,
        module: "academy",
        testId: "admin-nav-academia",
        items: [
          { to: "/admin/academy", label: "Cursos", module: "academy" },
          { to: "/admin/academy/modules", label: "Módulos", module: "academy" },
          { to: "/admin/academy/lessons", label: "Lecciones", module: "academy" },
          { to: "/admin/academy/enrollments", label: "Inscripciones", module: "academy" },
          { to: "/admin/academy/certifications", label: "Certificaciones", module: "academy" },
          { to: "/admin/services", label: "Servicios técnicos", module: "services" },
        ],
      },
    ],
  },
]

const FOOTER_SECURITY_GROUP = {
  key: "configuracion",
  label: "Configuración",
  icon: Settings,
  testId: "admin-nav-configuracion",
  items: [
    { to: "/admin/payment-methods", label: "Medios de pago", module: "finances" },
    { to: "/admin/roles", label: "Roles y permisos", module: "roles", capability: "manage_roles" },
    { to: "/admin/audit", label: "Auditoría forense", module: "audit", capability: "view_audit" },
  ],
}

function entryMatchesPath(entry, fullPath) {
  const [pathname] = fullPath.split("?")
  if (entry.to) return entry.end ? pathname === entry.to : pathname === entry.to || pathname.startsWith(entry.to + "/")
  if (entry.items) {
    return entry.items.some((it) => {
      const [itemPath, itemQuery] = it.to.split("?")
      if (itemQuery) return fullPath === it.to
      return pathname === itemPath || pathname.startsWith(itemPath + "/")
    })
  }
  return false
}

function BrandLogo({ siteName, logoUrl }) {
  const isDefaultWhiteAsset = !logoUrl
  if (isDefaultWhiteAsset) {
    return (
      <span
        className="lp-brand-logo-positive"
        role="img"
        aria-label={siteName || "LevelPro Audio"}
        style={{
          WebkitMaskImage: `url(${logoImg})`,
          maskImage: `url(${logoImg})`,
        }}
      />
    )
  }
  return (
    <img
      src={logoUrl}
      alt={siteName || "LevelPro Audio"}
      style={{ height: 24, maxWidth: 112, objectFit: "contain" }}
    />
  )
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
  const filteredNotifications = categoryFilter === "all"
    ? allNotifications
    : allNotifications.filter((n) => n.category === categoryFilter)

  const handleMarkOneRead = async (item, shouldNavigate = false) => {
    try {
      if (!item.is_read) {
        await markAdminNotificationsRead({ key: item.key })
        await queryClient.invalidateQueries({ queryKey: ["admin-notifications-center"] })
      }
    } catch {
      // Best-effort read persistence
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
      case "critical": return { label: "Crítica", tone: "danger" }
      case "high": return { label: "Prioritaria", tone: "warning" }
      case "warning": return { label: "Stock mínimo", tone: "warning" }
      default: return { label: "Operativa", tone: "success" }
    }
  }

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button
        type="button"
        className="lp-topbar-icon-btn"
        aria-label="Centro de notificaciones operativas"
        data-testid="admin-notifications-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={16} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span
            data-testid="admin-notifications-badge"
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 17,
              height: 17,
              padding: "0 4px",
              borderRadius: 9999,
              background: "#09090B",
              color: "#FFFFFF",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #FFFFFF",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Centro de Notificaciones"
          data-testid="admin-notifications-panel"
          className="lp-popover-panel"
          style={{ width: 380, maxWidth: "calc(100vw - 24px)" }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #E4E4E7",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0, color: "#09090B" }}>
                Centro de Notificaciones
              </p>
              <span style={{ fontSize: 11, color: "#71717A" }}>
                {notifData?.delivery_disclosure || "Polling controlado (60s)"}
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
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "#0F7A38",
                    background: "transparent",
                    border: "none",
                    padding: "3px 6px",
                    cursor: "pointer",
                  }}
                >
                  {markingAll ? "Marcando..." : "Marcar todas leídas"}
                </button>
              )}
              <button
                type="button"
                onClick={() => refetch()}
                data-testid="admin-notifications-refresh"
                aria-label="Actualizar notificaciones"
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "#52525B",
                  background: "#FAFAFA",
                  border: "1px solid #E4E4E7",
                  padding: "3px 8px",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                {isFetching ? "..." : "Actualizar"}
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 6,
              padding: "8px 14px",
              borderBottom: "1px solid #E4E4E7",
              overflowX: "auto",
              background: "#FAFAFA",
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
                    fontSize: 11.5,
                    fontWeight: active ? 600 : 500,
                    padding: "4px 10px",
                    borderRadius: 9999,
                    border: active ? "1px solid #09090B" : "1px solid #E4E4E7",
                    background: active ? "#09090B" : "#FFFFFF",
                    color: active ? "#FFFFFF" : "#52525B",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {filteredNotifications.length === 0 ? (
              <div data-testid="admin-notifications-empty" style={{ padding: "32px 20px", textAlign: "center", color: "#71717A" }}>
                <CheckCircle2 size={26} style={{ color: "#16A34A", margin: "0 auto 8px" }} />
                <p style={{ fontSize: 13, fontWeight: 600, margin: "4px 0 2px", color: "#09090B" }}>
                  Bandeja operativa al día
                </p>
                <p style={{ fontSize: 12, margin: 0 }}>
                  No hay alertas operativas activas en esta categoría.
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
                      padding: "12px 16px",
                      borderBottom: "1px solid #E4E4E7",
                      background: item.is_read ? "#FFFFFF" : "#FAFAFA",
                      display: "flex",
                      flexDirection: "column",
                      gap: 5,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span className={`au-badge au-badge--${pMeta.tone}`}>
                        {pMeta.label}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: item.is_read ? "#71717A" : "#0F7A38" }}>
                        {item.is_read ? "Leída" : "No leída"}
                      </span>
                    </div>
                    <div onClick={() => handleMarkOneRead(item, true)} style={{ cursor: "pointer" }}>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 2px", color: "#09090B" }}>
                        {item.title}
                      </p>
                      <p style={{ fontSize: 12, margin: 0, color: "#52525B", lineHeight: 1.4 }}>
                        {item.description}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                      <button
                        type="button"
                        onClick={() => handleMarkOneRead(item, true)}
                        style={{ background: "none", border: "none", padding: 0, fontSize: 11.5, fontWeight: 600, color: "#0F7A38", cursor: "pointer" }}
                      >
                        Ir al módulo →
                      </button>
                      {!item.is_read && (
                        <button
                          type="button"
                          data-testid={`admin-notif-mark-read-${item.category}`}
                          onClick={() => handleMarkOneRead(item, false)}
                          style={{ background: "none", border: "none", padding: 0, fontSize: 11.5, color: "#71717A", cursor: "pointer" }}
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

  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [railFlyout, setRailFlyout] = useState(null)
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const initial = {}
    for (const sec of SIDEBAR_SECTIONS) {
      for (const entry of sec.entries) {
        if (entry.items && entryMatchesPath(entry, location.pathname + location.search)) {
          initial[entry.key] = true
        }
      }
    }
    if (entryMatchesPath(FOOTER_SECURITY_GROUP, location.pathname)) {
      initial[FOOTER_SECURITY_GROUP.key] = true
    }
    return initial
  })

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

  useEffect(() => {
    if (!myPerms) return
    const sig = JSON.stringify({
      id: myPerms.id,
      roles: myPerms.roles,
      modules: myPerms.modules,
      capabilities: myPerms.capabilities,
    })
    if (prevPermSig.current && prevPermSig.current !== sig) {
      queryClient.cancelQueries({ predicate: (q) => q.queryKey?.[0] !== "my-permissions" })
      queryClient.removeQueries({ predicate: (q) => q.queryKey?.[0] !== "my-permissions" })
    }
    prevPermSig.current = sig
  }, [myPerms, queryClient])

  const canAccessModule = (mod, cap = null) => {
    if (myPerms?.is_superuser) return true
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
    if (rule.capability && myPerms.capabilities && myPerms.capabilities[rule.capability] === false) return false
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

  const filterSection = (sec) => {
    const entries = sec.entries.map((entry) => {
      if (entry.items) {
        const vis = entry.items.filter((it) => canAccessModule(it.module, it.capability))
        if (vis.length === 0) return null
        return { ...entry, items: vis }
      }
      if (!canAccessModule(entry.module, entry.capability)) return null
      return entry
    }).filter(Boolean)
    if (entries.length === 0) return null
    return { ...sec, entries }
  }

  const visibleSections = SIDEBAR_SECTIONS.map(filterSection).filter(Boolean)
  const visibleSecurityItems = FOOTER_SECURITY_GROUP.items.filter((it) => canAccessModule(it.module, it.capability))

  useEffect(() => {
    setMobileOpen(false)
    setRailFlyout(null)
  }, [location.pathname, location.search])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen(true)
      } else if (e.key === "Escape") {
        setMobileOpen(false)
        setRailFlyout(null)
        setUserMenuOpen(false)
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

  const initial = (user?.first_name?.[0] || user?.email?.[0] || "A").toUpperCase()
  const secondInitial = (user?.last_name?.[0] || "").toUpperCase()
  const avatarText = `${initial}${secondInitial}`
  const displayName = user?.first_name ? `${user.first_name}${user.last_name ? ` ${user.last_name[0]}.` : ""}` : (user?.email?.split("@")[0] || "Administrador")
  const fullPath = location.pathname + location.search

  const toggleGroup = (key) => {
    if (collapsed) {
      setRailFlyout((prev) => (prev === key ? null : key))
      return
    }
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const renderGroup = (entry) => {
    const Icon = entry.icon
    const isActive = entryMatchesPath(entry, fullPath)
    if (!entry.items) {
      return (
        <NavLink
          key={entry.key}
          to={entry.to}
          end={entry.end}
          data-testid={entry.testId}
          title={collapsed ? entry.label : undefined}
          className={`lp-nav-item${isActive ? " is-active" : ""}`}
        >
          <Icon size={16} strokeWidth={1.75} style={{ flexShrink: 0 }} aria-hidden="true" />
          {!collapsed && <span style={{ flex: 1 }}>{entry.label}</span>}
        </NavLink>
      )
    }

    const isOpen = Boolean(expandedGroups[entry.key]) || isActive
    return (
      <div
        key={entry.key}
        className={collapsed ? "lp-rail-group" : undefined}
        onMouseEnter={() => collapsed && setRailFlyout(entry.key)}
        onMouseLeave={() => collapsed && setRailFlyout((p) => (p === entry.key ? null : p))}
      >
        <button
          type="button"
          className={`lp-nav-item${isActive ? " is-active" : ""}`}
          data-testid={entry.testId}
          title={collapsed ? entry.label : undefined}
          aria-expanded={collapsed ? railFlyout === entry.key : isOpen}
          onClick={() => toggleGroup(entry.key)}
        >
          <Icon size={16} strokeWidth={1.75} style={{ flexShrink: 0 }} aria-hidden="true" />
          {!collapsed && (
            <>
              <span style={{ flex: 1 }}>{entry.label}</span>
              {isOpen ? <ChevronDown size={14} style={{ color: "#71717A" }} /> : <ChevronRight size={14} style={{ color: "#71717A" }} />}
            </>
          )}
        </button>

        {!collapsed && isOpen && (
          <div className="lp-nav-sublist">
            {entry.items.map((it) => {
              const [itPath, itQuery] = it.to.split("?")
              const subActive = itQuery
                ? fullPath === it.to
                : (location.pathname === itPath && !location.search) || (location.pathname.startsWith(itPath + "/") && itPath !== "/admin")
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={`lp-nav-subitem${subActive ? " active" : ""}`}
                >
                  <span>{it.label}</span>
                </Link>
              )
            })}
          </div>
        )}

        {collapsed && railFlyout === entry.key && (
          <div className="lp-rail-popover" role="menu" data-testid={`admin-flyout-${entry.key}`}>
            <div className="lp-rail-popover__title">{entry.label}</div>
            {entry.items.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                role="menuitem"
                className="lp-nav-subitem"
                onClick={() => setRailFlyout(null)}
              >
                {it.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`admin-root admin-precision${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`}
      id="admin-shell"
    >
      {mobileOpen && <div className="lp-mobile-backdrop" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar Nimbus 240px Expandido / 48px Rail / Drawer Mobile */}
      <aside className="lp-sidebar" data-testid="admin-sidebar" aria-label="Menú administrativo LevelPro">
        <div className="lp-sidebar__head">
          <Link
            to="/admin"
            data-testid="admin-logo-home"
            className="v3-brand"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", minWidth: 0 }}
            aria-label={siteName || "LevelPro Audio"}
          >
            {collapsed ? (
              <img src="/favicon.png?v=2" alt="LevelPro Audio" style={{ width: 24, height: 24, objectFit: "contain" }} />
            ) : (
              <BrandLogo siteName={siteName} logoUrl={logoUrl} />
            )}
          </Link>

          <button
            type="button"
            className="lp-sidebar__collapse-btn"
            data-testid="admin-sidebar-toggle"
            aria-label={collapsed ? "Expandir barra lateral" : "Colapsar barra lateral a 48px"}
            title={collapsed ? "Expandir menú (240px)" : "Colapsar menú (48px)"}
            onClick={() => { setCollapsed((c) => !c); setRailFlyout(null) }}
          >
            {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          </button>

          {mobileOpen && (
            <button
              type="button"
              className="lp-mobile-menu-btn"
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menú lateral"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <nav className="lp-sidebar__body" aria-label="Navegación principal">
          {visibleSections.map((sec) => (
            <div key={sec.key}>
              {sec.title && !collapsed && <div className="lp-nav-section">{sec.title}</div>}
              {sec.entries.map(renderGroup)}
            </div>
          ))}
        </nav>

        <div className="lp-sidebar__footer">
          {visibleSecurityItems.length > 0 && renderGroup({ ...FOOTER_SECURITY_GROUP, items: visibleSecurityItems })}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="lp-nav-item lp-store-link"
            data-testid="admin-view-site"
            title="Ver mi tienda en nueva pestaña"
          >
            <ExternalLink size={15} strokeWidth={1.75} style={{ flexShrink: 0 }} aria-hidden="true" />
            {!collapsed && <span>Ver mi tienda</span>}
          </a>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="lp-shell-content">
        <header className="lp-topbar">
          <div className="lp-topbar__left">
            <button
              id="v3-mobile-toggle-btn"
              type="button"
              className="lp-mobile-menu-btn"
              data-testid="admin-mobile-menu"
              aria-label="Abrir menú lateral"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={17} />
            </button>

            <img
              src="/favicon.png?v=2"
              alt="LevelPro Audio"
              data-testid="admin-mobile-brand"
              className="lp-mobile-menu-btn"
              style={{ width: 22, height: 22, border: "none", padding: 0, objectFit: "contain" }}
            />

            <div className="lp-topbar__crumb" aria-label="Ubicación actual">
              <span>LevelPro OS</span>
              <span>/</span>
              <strong>{activeRouteRule?.label || "Administración"}</strong>
            </div>
          </div>

          <div className="lp-topbar__right">
            <button
              type="button"
              className="lp-cmdk-btn"
              aria-label="Buscar en LevelPro (Cmd+K)"
              onClick={() => setSearchOpen(true)}
              data-testid="admin-search-btn"
              title="Buscar SKU, serie, pedido o cliente (⌘K)"
            >
              <Search size={14} strokeWidth={1.75} />
              <span className="lp-cmdk-label">Buscar pedidos, SKUs o secciones...</span>
              <span className="lp-cmdk-kbd">⌘K</span>
            </button>

            <NotificationsBell />

            <div style={{ position: "relative" }} ref={userMenuRef}>
              <button
                type="button"
                className="lp-user-trigger"
                data-testid="admin-user-chip"
                onClick={() => setUserMenuOpen((o) => !o)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                title={user?.email || "Administrador"}
              >
                <span className="lp-user-avatar">{avatarText}</span>
                <span className="lp-user-name">{displayName}</span>
                <ChevronDown size={13} style={{ color: "#71717A" }} />
              </button>

              {userMenuOpen && (
                <div className="lp-popover-panel" role="menu" style={{ width: 228, padding: 6 }}>
                  <div style={{ padding: "8px 10px", borderBottom: "1px solid #E4E4E7", marginBottom: 4 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "#09090B" }}>
                      {user?.first_name ? `${user.first_name} ${user.last_name || ""}` : "Administrador"}
                    </p>
                    <p style={{ fontSize: 11.5, margin: "2px 0 0", color: "#71717A", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {user?.email}
                    </p>
                  </div>

                  <Link to="/" className="lp-nav-subitem" onClick={() => setUserMenuOpen(false)}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <ExternalLink size={14} /> Ver tienda pública
                    </span>
                  </Link>

                  {canAccessModule("settings", "manage_settings") && (
                    <Link
                      to="/admin/settings"
                      className="lp-nav-subitem"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <Settings size={14} /> Personalización y CMS
                      </span>
                    </Link>
                  )}

                  <button
                    type="button"
                    className="lp-nav-subitem"
                    style={{ width: "100%", border: "none", background: "none", color: "#DC2626", cursor: "pointer", textAlign: "left" }}
                    data-testid="admin-logout"
                    onClick={handleLogout}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <LogOut size={14} /> Cerrar sesión
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main id="admin-main" className="lp-main">
          {!isRouteAuthorized ? (
            <div
              className="au-card au-panel"
              data-testid="admin-access-denied"
              style={{ maxWidth: 640, margin: "32px auto" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#DC2626",
                  }}
                >
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "#71717A" }}>
                    LEVELPRO OS · HTTP 403
                  </span>
                  <h1 style={{ fontSize: 19, fontWeight: 600, margin: "2px 0 0", color: "#09090B" }}>
                    Acceso Restringido por Rol (RBAC)
                  </h1>
                </div>
              </div>

              <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "#52525B", marginBottom: 16 }}>
                Tu cuenta (<strong style={{ color: "#09090B", fontFamily: "var(--font-mono)" }}>{user?.email}</strong>) no posee
                los privilegios necesarios para acceder al módulo{" "}
                <strong style={{ color: "#09090B" }}>{activeRouteRule?.label || location.pathname}</strong>.
              </p>

              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  background: "#FAFAFA",
                  border: "1px solid #E4E4E7",
                  marginBottom: 18,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ color: "#71717A" }}>ROLES ACTIVOS:</span>
                  <span style={{ color: "#09090B", fontWeight: 600 }}>
                    {myPerms?.roles?.length ? myPerms.roles.join(", ") : "Sin rol asignado"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ color: "#71717A" }}>MÓDULO REQUERIDO:</span>
                  <span style={{ color: "#09090B" }}>{activeRouteRule?.module || "classified"}</span>
                </div>
                {activeRouteRule?.capability && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#71717A" }}>CAPACIDAD:</span>
                    <span style={{ color: "#B45309", fontWeight: 600 }}>{activeRouteRule.capability}</span>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="au-btn au-btn--primary"
                  onClick={() => navigate(primaryLandingRoute)}
                >
                  Ir a mi módulo autorizado
                </button>
                <Link to="/" className="au-btn au-btn--secondary">
                  Volver a la tienda pública
                </Link>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      <AdminSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
