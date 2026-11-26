import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Mic, Layers, Hash, ShoppingBag, Users, ArrowUpRight } from "lucide-react"
import { globalAdminSearch } from "../../api/admin.api"
import { formatCurrency } from "../../utils/accountingCurrency"

const QUICK_ROUTES = [
  { id: "route-dashboard", label: "Inicio · Panel Ejecutivo", hint: "/admin", route: "/admin", badge: "PANEL" },
  { id: "route-pim", label: "Catálogo de Productos (PIM)", hint: "/admin/products", route: "/admin/products", badge: "PIM" },
  { id: "route-oms", label: "Lista de Ventas y OMS", hint: "/admin/orders", route: "/admin/orders", badge: "OMS" },
  { id: "route-wms", label: "Inventario y Kardex (WMS)", hint: "/admin/inventory", route: "/admin/inventory", badge: "WMS" },
  { id: "route-proc", label: "Órdenes de Compra & Recepciones", hint: "/admin/procurement", route: "/admin/procurement", badge: "PROC" },
  { id: "route-cost", label: "Costos, Landed Cost & Márgenes", hint: "/admin/costing", route: "/admin/costing", badge: "COST" },
  { id: "route-fin", label: "Finanzas, Tesorería & Conciliación", hint: "/admin/finance", route: "/admin/finance", badge: "FIN" },
  { id: "route-b2b", label: "Cotizaciones & Crédito B2B", hint: "/admin/b2b", route: "/admin/b2b", badge: "B2B" },
  { id: "route-log", label: "Logística, Garantías y Taller", hint: "/admin/logistics", route: "/admin/logistics", badge: "LOG" },
  { id: "route-mkt", label: "Marketing, Cupones y Promociones", hint: "/admin/marketing", route: "/admin/marketing", badge: "MKT" },
  { id: "route-cms", label: "Tienda Online (CMS) & Configuración", hint: "/admin/settings", route: "/admin/settings", badge: "CMS" },
]

export default function AdminSearch({ open: controlledOpen, onClose, renderTrigger = false }) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = typeof controlledOpen === "boolean"
  const open = isControlled ? controlledOpen : internalOpen

  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [results, setResults] = useState({
    products: [],
    variants: [],
    serials: [],
    orders: [],
    customers: [],
  })

  const inputRef = useRef(null)
  const navigate = useNavigate()

  const setOpenState = useCallback((next) => {
    if (isControlled) {
      if (!next && typeof onClose === "function") onClose()
    } else {
      setInternalOpen(next)
    }
  }, [isControlled, onClose])

  const closePalette = useCallback(() => {
    setOpenState(false)
    setQ("")
    setErrorMsg("")
    setActiveIndex(0)
    setTimeout(() => {
      const btn = document.querySelector('[data-testid="admin-search-btn"], [data-testid="admin-command-palette-trigger"]')
      if (btn && typeof btn.focus === "function") {
        btn.focus()
      }
    }, 0)
  }, [setOpenState])

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        if (open) {
          closePalette()
        } else if (!isControlled) {
          setInternalOpen(true)
        }
      } else if (e.key === "Escape" && open) {
        e.preventDefault()
        closePalette()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, isControlled, closePalette])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 20)
    }
  }, [open])

  useEffect(() => {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setResults({ products: [], variants: [], serials: [], orders: [], customers: [] })
      setLoading(false)
      setErrorMsg("")
      setActiveIndex(0)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      setErrorMsg("")
      try {
        const data = await globalAdminSearch(trimmed, {
          limit: 5,
          signal: controller.signal,
        })
        if (!controller.signal.aborted) {
          setResults(
            data?.results || {
              products: [],
              variants: [],
              serials: [],
              orders: [],
              customers: [],
            }
          )
          setActiveIndex(0)
        }
      } catch (err) {
        if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED" || controller.signal.aborted) {
          return
        }
        setErrorMsg("No fue posible completar la búsqueda global en este momento.")
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }, 200)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [q])

  const flatItems = useMemo(() => {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      return QUICK_ROUTES.map((r) => ({
        key: r.id,
        section: "Accesos directos",
        primary: r.label,
        secondary: r.hint,
        rightTag: r.badge,
        iconType: "route",
        route: r.route,
      }))
    }

    const items = []
    for (const p of results.products || []) {
      items.push({
        key: `prod-${p.id}`,
        section: "Productos y SKUs",
        primary: p.name,
        secondary: `${p.sku ? `${p.sku} · ` : ""}${p.brand_name || "Catálogo"} · ${p.stock} disp.`,
        rightTag: formatCurrency(p.price, p.currency || "CLP"),
        iconType: "product",
        route: `/admin/products?highlight=${p.id}`,
      })
    }
    for (const v of results.variants || []) {
      items.push({
        key: `var-${v.id}`,
        section: "Variantes",
        primary: `${v.sku} — ${v.name}`,
        secondary: `${v.product_name || "Producto"} · ${v.stock} disp.`,
        rightTag: formatCurrency(v.price, v.currency || "CLP"),
        iconType: "variant",
        route: `/admin/products?highlight=${v.product_id || v.id}`,
      })
    }
    for (const s of results.serials || []) {
      items.push({
        key: `ser-${s.id}`,
        section: "Números de Serie",
        primary: s.serial_number,
        secondary: `${s.product_name || "Equipo"}${s.sku ? ` (${s.sku})` : ""} · Bodega: ${s.warehouse_code || "N/A"}`,
        rightTag: String(s.status || "").toUpperCase(),
        badgeTone: "success",
        iconType: "serial",
        route: s.target_route === "/admin/logistica" ? "/admin/logistics" : "/admin/inventory",
      })
    }
    for (const o of results.orders || []) {
      items.push({
        key: `ord-${o.id}`,
        section: "Órdenes recientes",
        primary: `#${o.short_id || String(o.id).slice(0, 8).toUpperCase()} — ${o.email}`,
        secondary: `Estado: ${o.status}${o.tracking_code ? ` · Tracking: ${o.tracking_code}` : ""}`,
        rightTag: formatCurrency(o.total, o.currency || "CLP"),
        badgeTone: o.status === "paid" || o.status === "completed" ? "success" : "neutral",
        iconType: "order",
        route: `/admin/orders?id=${o.id}`,
      })
    }
    for (const c of results.customers || []) {
      items.push({
        key: `cust-${c.id}`,
        section: "Clientes CRM",
        primary: c.full_name || c.email,
        secondary: c.email,
        rightTag: String(c.role || "customer").toUpperCase(),
        iconType: "customer",
        route: "/admin/users",
      })
    }
    return items
  }, [q, results])

  const handleSelect = (item) => {
    if (!item?.route) return
    const targetRoute = item.route
    closePalette()
    navigate(targetRoute)
  }

  const handleInputKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (flatItems.length > 0) {
        setActiveIndex((prev) => (prev + 1) % flatItems.length)
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (flatItems.length > 0) {
        setActiveIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length)
      }
    } else if (e.key === "Enter") {
      if (flatItems.length > 0 && flatItems[activeIndex]) {
        e.preventDefault()
        handleSelect(flatItems[activeIndex])
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      closePalette()
    }
  }

  const groupedSections = useMemo(() => {
    const groups = []
    const byName = new Map()
    flatItems.forEach((item, idx) => {
      if (!byName.has(item.section)) {
        const g = { title: item.section, entries: [] }
        byName.set(item.section, g)
        groups.push(g)
      }
      byName.get(item.section).entries.push({ ...item, index: idx })
    })
    return groups
  }, [flatItems])

  const activeItemKey = flatItems[activeIndex]?.key || undefined

  const renderEntryIcon = (type) => {
    switch (type) {
      case "product": return <Mic size={15} strokeWidth={1.75} />
      case "variant": return <Layers size={15} strokeWidth={1.75} />
      case "serial": return <Hash size={15} strokeWidth={1.75} />
      case "order": return <ShoppingBag size={15} strokeWidth={1.75} />
      case "customer": return <Users size={15} strokeWidth={1.75} />
      default: return <ArrowUpRight size={15} strokeWidth={1.75} />
    }
  }

  return (
    <>
      {renderTrigger && (
        <button
          type="button"
          onClick={() => setOpenState(true)}
          data-testid="admin-command-palette-trigger"
          aria-label="Abrir paleta de comandos y búsqueda global (Cmd+K)"
          aria-haspopup="dialog"
          aria-expanded={open}
          className="lp-cmdk-btn"
        >
          <Search size={14} strokeWidth={1.75} />
          <span>Buscar...</span>
          <kbd className="lp-cmdk-kbd">⌘K</kbd>
        </button>
      )}

      {open && (
        <div
          className="admin-portal-root"
          role="dialog"
          aria-modal="true"
          aria-label="Paleta de comandos y búsqueda global administrativa"
          data-testid="admin-command-palette-modal"
          onClick={closePalette}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(9, 9, 11, 0.45)",
            zIndex: 1200,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "9vh 16px 24px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 620,
              background: "#FFFFFF",
              border: "1px solid #E4E4E7",
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 20px 48px -12px rgba(9, 9, 11, 0.18), 0 0 0 1px rgba(9, 9, 11, 0.06)",
            }}
          >
            {/* Input Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 16px",
                borderBottom: "1px solid #E4E4E7",
                background: "#FFFFFF",
              }}
            >
              <Search size={16} strokeWidth={1.75} style={{ color: "#52525B", flexShrink: 0 }} aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls="admin-command-palette-listbox"
                aria-activedescendant={activeItemKey ? `cmd-opt-${activeItemKey}` : undefined}
                aria-autocomplete="list"
                aria-label="Término de búsqueda global administrativa"
                data-testid="admin-command-palette-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Buscar SKU, producto, serie, pedido (#ID/tracking) o cliente..."
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#09090B",
                  fontSize: 13.5,
                  fontWeight: 500,
                  boxShadow: "none",
                  padding: 0,
                }}
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label="Limpiar búsqueda"
                  style={{
                    background: "#F4F4F5",
                    border: "1px solid #E4E4E7",
                    borderRadius: 6,
                    color: "#52525B",
                    fontSize: 11,
                    fontWeight: 500,
                    padding: "2px 8px",
                    cursor: "pointer",
                  }}
                >
                  Limpiar
                </button>
              )}
              <button
                type="button"
                onClick={closePalette}
                data-testid="admin-command-palette-close"
                aria-label="Cerrar paleta de comandos"
                style={{
                  padding: "2px 8px",
                  background: "#FAFAFA",
                  border: "1px solid #E4E4E7",
                  borderRadius: 6,
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: "#52525B",
                  cursor: "pointer",
                  fontFamily: "var(--font-mono)",
                }}
              >
                ESC
              </button>
            </div>

            {/* Results Listbox */}
            <div
              id="admin-command-palette-listbox"
              role="listbox"
              aria-label="Resultados de comando y búsqueda"
              style={{ maxHeight: 420, overflowY: "auto", padding: "8px" }}
            >
              {loading && (
                <p role="status" style={{ textAlign: "center", color: "#71717A", fontSize: 12.5, padding: "22px 12px", margin: 0 }}>
                  Consultando índice administrativo (RBAC)...
                </p>
              )}

              {!loading && errorMsg && (
                <p role="alert" style={{ textAlign: "center", color: "#DC2626", fontSize: 12.5, padding: "20px 12px", margin: 0 }}>
                  {errorMsg}
                </p>
              )}

              {!loading && !errorMsg && q.trim().length >= 2 && flatItems.length === 0 && (
                <div style={{ textAlign: "center", padding: "28px 16px" }} data-testid="admin-command-palette-empty">
                  <p style={{ color: "#09090B", fontSize: 13.5, fontWeight: 600, margin: "0 0 4px" }}>
                    Sin coincidencias para “{q.trim()}”
                  </p>
                  <p style={{ color: "#71717A", fontSize: 12, margin: 0 }}>
                    Verifica el SKU, número de serie, ID de pedido o tus permisos de módulo.
                  </p>
                </div>
              )}

              {!loading &&
                !errorMsg &&
                groupedSections.map((group) => (
                  <div key={group.title} style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#71717A",
                        padding: "6px 10px 4px",
                      }}
                    >
                      {group.title}
                    </div>
                    {group.entries.map((entry) => {
                      const isSelected = entry.index === activeIndex
                      return (
                        <div
                          key={entry.key}
                          id={`cmd-opt-${entry.key}`}
                          role="option"
                          aria-selected={isSelected}
                          data-testid={`cmd-option-${entry.key}`}
                          onMouseEnter={() => setActiveIndex(entry.index)}
                          onClick={() => handleSelect(entry)}
                          style={{
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            padding: "8px 12px",
                            borderRadius: 8,
                            cursor: "pointer",
                            background: isSelected ? "#F4F4F5" : "transparent",
                            transition: "background 120ms ease",
                          }}
                        >
                          {isSelected && (
                            <span
                              aria-hidden="true"
                              style={{
                                position: "absolute",
                                left: 2,
                                top: 7,
                                bottom: 7,
                                width: 2.5,
                                borderRadius: 99,
                                background: "#1AFF6E",
                              }}
                            />
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                            <span style={{ color: isSelected ? "#09090B" : "#71717A", display: "inline-flex", flexShrink: 0 }}>
                              {renderEntryIcon(entry.iconType)}
                            </span>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: isSelected ? 600 : 500,
                                  color: "#09090B",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {entry.primary}
                              </div>
                              <div
                                style={{
                                  fontSize: 11.5,
                                  color: "#71717A",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  marginTop: 1,
                                }}
                              >
                                {entry.secondary}
                              </div>
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: entry.badgeTone === "success" ? "#0F7A38" : "#52525B",
                              fontFamily: "var(--font-mono)",
                              fontVariantNumeric: "tabular-nums",
                              flexShrink: 0,
                              padding: "2px 8px",
                              borderRadius: 9999,
                              background: entry.badgeTone === "success" ? "#ECFDF3" : "#FAFAFA",
                              border: `1px solid ${entry.badgeTone === "success" ? "#BBF7D0" : "#E4E4E7"}`,
                            }}
                          >
                            {entry.rightTag}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ))}
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
                padding: "8px 16px",
                borderTop: "1px solid #E4E4E7",
                background: "#FAFAFA",
                fontSize: 11,
                color: "#71717A",
              }}
            >
              <span>↑↓ Navegar · ↵ Abrir · ESC Cerrar</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5 }}>
                RBAC Zero-Trust · Multi-moneda
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
