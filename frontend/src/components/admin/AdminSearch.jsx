import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { globalAdminSearch } from "../../api/admin.api"
import { formatCurrency } from "../../utils/accountingCurrency"

const QUICK_ROUTES = [
  { id: "route-dashboard", label: "Dashboard Ejecutivo", hint: "/admin", route: "/admin", badge: "PANEL" },
  { id: "route-pim", label: "Catálogo de Productos (PIM)", hint: "/admin/products", route: "/admin/products", badge: "PIM" },
  { id: "route-oms", label: "Órdenes y Ventas (OMS)", hint: "/admin/orders", route: "/admin/orders", badge: "OMS" },
  { id: "route-wms", label: "Inventario y Kardex (WMS)", hint: "/admin/inventory", route: "/admin/inventory", badge: "WMS" },
  { id: "route-proc", label: "Órdenes de Compra & Recepciones", hint: "/admin/procurement", route: "/admin/procurement", badge: "PROC" },
  { id: "route-cost", label: "Landed Cost & Márgenes", hint: "/admin/costing", route: "/admin/costing", badge: "COST" },
  { id: "route-fin", label: "Finanzas, Tesorería & Conciliación", hint: "/admin/finance", route: "/admin/finance", badge: "FIN" },
  { id: "route-b2b", label: "Cotizaciones & Crédito B2B", hint: "/admin/b2b", route: "/admin/b2b", badge: "B2B" },
  { id: "route-log", label: "Logística, Garantías y Taller", hint: "/admin/logistics", route: "/admin/logistics", badge: "LOG" },
  { id: "route-mkt", label: "Marketing, Cupones y Promociones", hint: "/admin/marketing", route: "/admin/marketing", badge: "MKT" },
  { id: "route-cms", label: "Editorial Bento CMS & Personalización", hint: "/admin/settings", route: "/admin/settings", badge: "CMS" },
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

  // Global keyboard shortcut Cmd+K / Ctrl+K + Escape
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

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 20)
    }
  }, [open])

  // Debounced global search with AbortController cancellation
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

  // Flatten items for keyboard navigation
  const flatItems = useMemo(() => {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      return QUICK_ROUTES.map((r) => ({
        key: r.id,
        section: "Accesos Rápidos",
        primary: r.label,
        secondary: r.hint,
        rightTag: r.badge,
        rightColor: "#1AFF6E",
        route: r.route,
      }))
    }

    const items = []
    for (const p of results.products || []) {
      items.push({
        key: `prod-${p.id}`,
        section: "Productos (PIM)",
        primary: p.name,
        secondary: `${p.sku ? `SKU: ${p.sku} · ` : ""}${p.brand_name || "Catálogo"} · Stock: ${p.stock}`,
        rightTag: formatCurrency(p.price, p.currency || "CLP"),
        rightColor: "#F5F5F7",
        route: `/admin/products?highlight=${p.id}`,
      })
    }
    for (const v of results.variants || []) {
      items.push({
        key: `var-${v.id}`,
        section: "Variantes / SKU",
        primary: `${v.sku} — ${v.name}`,
        secondary: `${v.product_name || "Producto"} · Stock: ${v.stock}`,
        rightTag: formatCurrency(v.price, v.currency || "CLP"),
        rightColor: "#60a5fa",
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
        rightColor: "#1AFF6E",
        route: s.target_route === "/admin/logistica" ? "/admin/logistics" : "/admin/inventory",
      })
    }
    for (const o of results.orders || []) {
      items.push({
        key: `ord-${o.id}`,
        section: "Pedidos (OMS)",
        primary: `#${o.short_id || String(o.id).slice(0, 8).toUpperCase()} — ${o.email}`,
        secondary: `Estado: ${o.status}${o.tracking_code ? ` · Tracking: ${o.tracking_code}` : ""}`,
        rightTag: formatCurrency(o.total, o.currency || "CLP"),
        rightColor: "#fbbf24",
        route: `/admin/orders?id=${o.id}`,
      })
    }
    for (const c of results.customers || []) {
      items.push({
        key: `cust-${c.id}`,
        section: "Clientes",
        primary: c.full_name || c.email,
        secondary: c.email,
        rightTag: String(c.role || "customer").toUpperCase(),
        rightColor: "#a78bfa",
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
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "7px 13px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 999,
            color: "rgba(255,255,255,0.8)",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          <span>Buscar...</span>
          <kbd style={{ fontSize: 10, opacity: 0.7 }}>⌘K</kbd>
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Paleta de comandos y búsqueda global administrativa"
          data-testid="admin-command-palette-modal"
          onClick={closePalette}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(12, 13, 14, 0.72)",
            backdropFilter: "blur(6px)",
            zIndex: 1200,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "8vh 16px 24px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 640,
              background: "#0B0E14",
              border: "1px solid #242A34",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 28px 80px rgba(0,0,0,0.65)",
            }}
          >
            {/* Combobox input bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "14px 16px",
                borderBottom: "1px solid #242A34",
                background: "#131822",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1AFF6E" strokeWidth="2.2" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
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
                placeholder="Buscar SKU, producto, número de serie, pedido (#ID/tracking) o cliente..."
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#F5F5F7",
                  fontSize: 14,
                }}
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label="Limpiar búsqueda"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 6,
                    color: "#a1a1aa",
                    fontSize: 11,
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
                  padding: "3px 8px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 6,
                  fontSize: 10,
                  color: "#d4d4d8",
                  cursor: "pointer",
                  fontFamily: "var(--font-mono, 'Geist Mono', monospace)",
                }}
              >
                ESC
              </button>
            </div>

            {/* Results listbox */}
            <div
              id="admin-command-palette-listbox"
              role="listbox"
              aria-label="Resultados de comando y búsqueda"
              style={{ maxHeight: 420, overflowY: "auto", padding: "10px 8px" }}
            >
              {loading && (
                <p
                  role="status"
                  style={{ textAlign: "center", color: "#a1a1aa", fontSize: 12, padding: "22px 12px", margin: 0 }}
                >
                  Consultando índice administrativo (RBAC)...
                </p>
              )}

              {!loading && errorMsg && (
                <p
                  role="alert"
                  style={{ textAlign: "center", color: "#f87171", fontSize: 12, padding: "20px 12px", margin: 0 }}
                >
                  {errorMsg}
                </p>
              )}

              {!loading && !errorMsg && q.trim().length >= 2 && flatItems.length === 0 && (
                <div style={{ textAlign: "center", padding: "28px 16px" }} data-testid="admin-command-palette-empty">
                  <p style={{ color: "#e4e4e7", fontSize: 13, fontWeight: 600, margin: "0 0 4px" }}>
                    Sin coincidencias para “{q.trim()}”
                  </p>
                  <p style={{ color: "#8E8E98", fontSize: 12, margin: 0 }}>
                    Verifica el SKU, número de serie, ID de pedido o tus permisos de módulo.
                  </p>
                </div>
              )}

              {!loading &&
                !errorMsg &&
                groupedSections.map((group) => (
                  <div key={group.title} style={{ marginBottom: 10 }}>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "#9CA3AF",
                        padding: "4px 12px 6px",
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
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            padding: "9px 12px",
                            borderRadius: 8,
                            cursor: "pointer",
                            background: isSelected ? "rgba(26, 255, 110, 0.12)" : "transparent",
                            border: isSelected
                              ? "1px solid rgba(26, 255, 110, 0.35)"
                              : "1px solid transparent",
                            transition: "background 0.1s",
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#F5F5F7",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {entry.primary}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "#A1A1AA",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                marginTop: 2,
                              }}
                            >
                              {entry.secondary}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: entry.rightColor || "#F5F5F7",
                              fontFamily: "var(--font-mono, 'Geist Mono', monospace)",
                              fontVariantNumeric: "tabular-nums",
                              flexShrink: 0,
                              padding: "2px 8px",
                              borderRadius: 6,
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.1)",
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

            {/* Footer keyboard hints */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
                padding: "9px 16px",
                borderTop: "1px solid #242A34",
                background: "#0B0E14",
                fontSize: 11,
                color: "#9CA3AF",
              }}
            >
              <span>↑↓ Navegar · ↵ Abrir módulo · ESC Cerrar</span>
              <span style={{ fontFamily: "var(--font-mono, 'Geist Mono', monospace)", fontSize: 10 }}>
                RBAC Zero-Trust · Multi-moneda Original
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
