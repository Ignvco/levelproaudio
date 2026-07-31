// pages/Shop.jsx — Tienda completa: sidebar de filtros, chips activos, orden y grid
import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { Search, SlidersHorizontal, X, ChevronDown, ArrowUpDown, PackageSearch, LayoutGrid, Rows3 } from "lucide-react"
import { getProducts, getCategories, getBrands } from "../api/products.api"
import ProductCard from "../components/product/ProductCard"
import ProductRow from "../components/product/ProductRow"
import ShopFilters, { money } from "../components/product/ShopFilters"
import Seo from "../components/Seo"
import { useScrollReveal } from "../hooks/useScrollReveal"
import { useFavoritesStore } from "../store/favoritesStore"
import { useAuthStore } from "../store/authStore"

const ORDERINGS = [
  { value: "-created_at", label: "Más recientes" },
  { value: "price",       label: "Precio: menor a mayor" },
  { value: "-price",      label: "Precio: mayor a menor" },
  { value: "name",        label: "Nombre: A → Z" },
]

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch]       = useState(searchParams.get("search") || "")
  const [page, setPage]           = useState(1)
  const [drawerOpen, setDrawer]   = useState(false)
  const [sortOpen, setSortOpen]   = useState(false)
  const [view, setView]           = useState(() => localStorage.getItem("shop_view") || "grid")

  const isAuth      = useAuthStore(s => s.isAuthenticated)
  const loadFavs    = useFavoritesStore(s => s.load)
  useEffect(() => {
    if (isAuth) loadFavs()
    else useFavoritesStore.setState({ ids: [], loaded: false })
  }, [isAuth, loadFavs])

  const changeView = (v) => { setView(v); localStorage.setItem("shop_view", v) }

  const values = {
    search:    searchParams.get("search")    || undefined,
    category:  searchParams.get("category")  || undefined,
    brand:     searchParams.get("brand")     || undefined,
    price_min: searchParams.get("price_min") || undefined,
    price_max: searchParams.get("price_max") || undefined,
    in_stock:  searchParams.get("in_stock")  || undefined,
    on_sale:   searchParams.get("on_sale")   || undefined,
    ordering:  searchParams.get("ordering")  || "-created_at",
  }

  const apiFilters = {
    search:         values.search,
    category__slug: values.category,
    brand__slug:    values.brand,
    price_min:      values.price_min,
    price_max:      values.price_max,
    in_stock:       values.in_stock,
    on_sale:        values.on_sale,
    ordering:       values.ordering,
    page,
  }

  const { data, isLoading } = useQuery({
    queryKey: ["products", apiFilters],
    queryFn:  () => getProducts(apiFilters),
    keepPreviousData: true,
  })
  const { data: categoriesData } = useQuery({ queryKey: ["categories"], queryFn: getCategories })
  const { data: brandsData }     = useQuery({ queryKey: ["brands"], queryFn: getBrands })

  const products   = data?.results || []
  const categories = categoriesData?.results || categoriesData || []
  const brands     = brandsData?.results || brandsData || []

  const headerRef = useScrollReveal({ delay: 0 })

  // Actualiza uno o varios params y resetea página
  const patch = (obj) => {
    setPage(1)
    setSearchParams(prev => {
      Object.entries(obj).forEach(([k, v]) => {
        if (v === null || v === undefined || v === "") prev.delete(k)
        else prev.set(k, v)
      })
      return prev
    }, { replace: false })
  }

  const handleSearch = (e) => { e.preventDefault(); patch({ search: search || null }) }
  const clearAll = () => { setSearch(""); setSearchParams({}); setPage(1) }

  // Chips de filtros activos
  const activeFilters = []
  if (values.search)   activeFilters.push({ key: "search",   label: `"${values.search}"` })
  if (values.category) activeFilters.push({ key: "category", label: categories.find(c => c.slug === values.category)?.name || values.category })
  if (values.brand)    activeFilters.push({ key: "brand",    label: brands.find(b => b.slug === values.brand)?.name || values.brand })
  if (values.price_min) activeFilters.push({ key: "price_min", label: `Desde ${money(values.price_min)}` })
  if (values.price_max) activeFilters.push({ key: "price_max", label: `Hasta ${money(values.price_max)}` })
  if (values.in_stock) activeFilters.push({ key: "in_stock", label: "En stock" })
  if (values.on_sale)  activeFilters.push({ key: "on_sale",  label: "En oferta" })
  const activeCount = activeFilters.length

  const removeChip = (key) => { if (key === "search") setSearch(""); patch({ [key]: null }) }

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [drawerOpen])

  const currentSort = ORDERINGS.find(o => o.value === values.ordering) || ORDERINGS[0]

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Seo title="Tienda" description="Equipamiento de audio profesional de las mejores marcas, con stock real y envíos en Chile y Argentina." />

      {/* ── Header ── */}
      <div ref={headerRef} style={{ padding: "clamp(60px, 9vw, 100px) 0 0" }}>
        <div className="lp-container">
          <p style={{
            fontSize: "11px", color: "var(--accent)", fontWeight: 600,
            letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "16px",
            display: "inline-flex", alignItems: "center", gap: "8px",
          }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%",
              background: "var(--accent)", boxShadow: "0 0 12px var(--accent)" }} />
            Tienda
          </p>
          <h1 className="display-bold" style={{
            fontFamily: "var(--font-display)", fontSize: "clamp(2.6rem, 5.8vw, 4.5rem)",
            fontWeight: 700, lineHeight: 1, letterSpacing: "-0.045em",
            marginBottom: "32px", color: "var(--text)",
          }}>
            Todo el equipamiento<br />
            <span style={{ fontStyle: "italic", fontWeight: 500, color: "var(--accent)" }}>
              que necesitás.
            </span>
          </h1>

          {/* Buscador */}
          <form onSubmit={handleSearch} style={{ display: "flex", gap: "10px", maxWidth: "560px" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={17} style={{ position: "absolute", left: "15px", top: "50%",
                transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                data-testid="shop-search-input"
                placeholder="Buscar productos, marcas..." className="input"
                style={{ paddingLeft: "44px" }} />
            </div>
            <button type="submit" data-testid="shop-search-btn" className="btn btn-accent"
              style={{ padding: "12px 24px", flexShrink: 0 }}>Buscar</button>
          </form>
        </div>
      </div>

      {/* ── Cuerpo: sidebar + contenido ── */}
      <div className="lp-container" style={{ paddingBlock: "clamp(32px, 4vw, 48px)" }}>
        <div className="shop-layout" style={{
          display: "grid", gridTemplateColumns: "272px 1fr", gap: "40px", alignItems: "start",
        }}>

          {/* Sidebar desktop */}
          <aside className="shop-sidebar" style={{
            position: "sticky", top: "96px",
            background: "#121212", border: "1px solid var(--border)",
            borderRadius: "22px", padding: "8px 22px 14px",
          }}>
            <ShopFilters categories={categories} brands={brands} values={values}
              onSet={patch} onClear={clearAll} activeCount={activeCount} />
          </aside>

          {/* Contenido principal */}
          <div>
            {/* Toolbar */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: "12px", marginBottom: "20px", flexWrap: "wrap",
            }}>
              <p style={{ fontSize: "14px", color: "var(--text-2)" }}>
                {isLoading ? "Cargando..." : (
                  <><strong style={{ color: "var(--text)" }}>{data?.count ?? products.length}</strong> productos</>
                )}
              </p>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                {/* Toggle grilla / lista */}
                <div style={{ display: "flex", gap: "2px", padding: "3px",
                  background: "var(--surface-2)", border: "1px solid var(--border)",
                  borderRadius: "var(--r-full)" }} className="shop-view-toggle">
                  {[["grid", LayoutGrid], ["list", Rows3]].map(([v, Icon]) => (
                    <button key={v} data-testid={`shop-view-${v}`} onClick={() => changeView(v)}
                      aria-label={v === "grid" ? "Vista grilla" : "Vista lista"}
                      style={{ width: "34px", height: "30px", borderRadius: "9999px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", border: "none",
                        background: view === v ? "var(--text)" : "transparent",
                        color: view === v ? "var(--bg)" : "var(--text-3)",
                        transition: "all 180ms var(--ease)" }}>
                      <Icon size={15} />
                    </button>
                  ))}
                </div>

                {/* Botón filtros (mobile) */}
                <button data-testid="shop-open-filters" onClick={() => setDrawer(true)}
                  className="btn btn-dark shop-filter-btn"
                  style={{ padding: "9px 16px", fontSize: "13px", gap: "8px", display: "none" }}>
                  <SlidersHorizontal size={15} /> Filtros
                  {activeCount > 0 && (
                    <span style={{ background: "var(--accent)", color: "#000", fontSize: "11px",
                      fontWeight: 800, minWidth: "18px", height: "18px", borderRadius: "9px",
                      display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                      {activeCount}
                    </span>
                  )}
                </button>

                {/* Orden dropdown */}
                <div style={{ position: "relative" }}>
                  <button data-testid="shop-sort-btn" onClick={() => setSortOpen(o => !o)}
                    onBlur={() => setTimeout(() => setSortOpen(false), 150)}
                    className="btn btn-dark"
                    style={{ padding: "9px 16px", fontSize: "13px", gap: "8px" }}>
                    <ArrowUpDown size={14} /> {currentSort.label}
                    <ChevronDown size={14} style={{ transition: "transform 200ms",
                      transform: sortOpen ? "rotate(180deg)" : "none" }} />
                  </button>
                  {sortOpen && (
                    <div style={{
                      position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 20,
                      minWidth: "220px", background: "rgba(18,18,18,0.98)",
                      border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "6px",
                      boxShadow: "0 24px 60px rgba(0,0,0,0.6)", animation: "scaleIn 160ms var(--ease)",
                      transformOrigin: "top right",
                    }}>
                      {ORDERINGS.map(o => (
                        <button key={o.value} data-testid={`shop-sort-${o.value}`}
                          onMouseDown={() => { patch({ ordering: o.value }); setSortOpen(false) }}
                          style={{ display: "block", width: "100%", textAlign: "left",
                            padding: "9px 12px", borderRadius: "var(--r-md, 12px)", cursor: "pointer",
                            background: values.ordering === o.value ? "rgba(26,255,110,0.12)" : "transparent",
                            color: values.ordering === o.value ? "var(--accent)" : "var(--text-2)",
                            border: "none", fontSize: "13px", fontFamily: "var(--font-sans)" }}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Chips de filtros activos */}
            {activeFilters.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
                {activeFilters.map(f => (
                  <button key={f.key} data-testid={`chip-${f.key}`} onClick={() => removeChip(f.key)}
                    style={{ display: "inline-flex", alignItems: "center", gap: "7px",
                      padding: "6px 8px 6px 14px", borderRadius: "9999px", cursor: "pointer",
                      background: "var(--surface-2)", border: "1px solid var(--border)",
                      color: "var(--text)", fontSize: "12.5px", fontWeight: 500,
                      transition: "border-color 180ms" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border-hover)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
                    {f.label}
                    <span style={{ width: "18px", height: "18px", borderRadius: "50%",
                      background: "rgba(255,255,255,0.08)", display: "inline-flex",
                      alignItems: "center", justifyContent: "center" }}>
                      <X size={11} />
                    </span>
                  </button>
                ))}
                <button data-testid="chip-clear-all" onClick={clearAll}
                  style={{ padding: "6px 14px", borderRadius: "9999px", cursor: "pointer",
                    background: "transparent", border: "1px dashed var(--border-hover)",
                    color: "var(--text-3)", fontSize: "12.5px" }}>
                  Limpiar todo
                </button>
              </div>
            )}

            {/* Grid */}
            {isLoading ? (
              <div className="shop-grid" style={{ display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "24px" }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: "420px", borderRadius: "26px" }} />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div style={{ textAlign: "center", padding: "100px 20px", display: "flex",
                flexDirection: "column", alignItems: "center", gap: "18px",
                background: "#121212", border: "1px solid var(--border)", borderRadius: "22px" }}>
                <span style={{ width: "64px", height: "64px", borderRadius: "50%",
                  background: "var(--surface-2)", display: "flex", alignItems: "center",
                  justifyContent: "center", color: "var(--text-3)" }}>
                  <PackageSearch size={28} />
                </span>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem",
                  fontWeight: 700, color: "var(--text)" }}>Sin resultados</h3>
                <p style={{ color: "var(--text-3)", fontSize: "15px", maxWidth: "340px" }}>
                  No encontramos productos con esos filtros. Probá ampliar tu búsqueda.
                </p>
                <button onClick={clearAll} data-testid="shop-empty-clear"
                  className="btn btn-accent" style={{ marginTop: "4px" }}>
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <div className={view === "list" ? "shop-list" : "shop-grid"} style={
                view === "list"
                  ? { display: "flex", flexDirection: "column", gap: "16px" }
                  : { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "24px" }
              }>
                {products.map((product, i) => (
                  <div key={product.id}
                    style={{ animation: `fadeUp 500ms cubic-bezier(0.16,1,0.3,1) ${i * 45}ms both` }}>
                    {view === "list"
                      ? <ProductRow product={product} />
                      : <ProductCard product={product} />}
                  </div>
                ))}
              </div>
            )}

            {/* Paginación */}
            {(data?.next || data?.previous) && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center",
                gap: "12px", marginTop: "56px" }}>
                <button disabled={!data.previous} onClick={() => setPage(p => p - 1)}
                  data-testid="shop-prev" className="btn btn-ghost"
                  style={{ opacity: data.previous ? 1 : 0.3 }}>← Anterior</button>
                <span style={{ padding: "8px 20px", borderRadius: "var(--r-full)",
                  background: "var(--surface)", border: "1px solid var(--border)",
                  fontSize: "13px", color: "var(--text-2)" }}>Página {page}</span>
                <button disabled={!data.next} onClick={() => setPage(p => p + 1)}
                  data-testid="shop-next" className="btn btn-ghost"
                  style={{ opacity: data.next ? 1 : 0.3 }}>Siguiente →</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Drawer de filtros (mobile) ── */}
      {drawerOpen && createPortal(
        <div data-testid="shop-drawer" style={{ position: "fixed", inset: 0, zIndex: 300 }}>
          <div onClick={() => setDrawer(false)} style={{ position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            animation: "fadeIn 200ms ease" }} />
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0,
            width: "min(340px, 88vw)", background: "#0e0e0e",
            borderRight: "1px solid var(--border)", padding: "20px 22px",
            overflowY: "auto", animation: "slideInLeft 300ms cubic-bezier(0.16,1,0.3,1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem",
                  fontWeight: 700, color: "var(--text)" }}>Filtros</p>
                {activeCount > 0 && (
                  <button data-testid="drawer-clear" onClick={clearAll}
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px",
                      fontSize: "12px", color: "var(--accent)", background: "transparent",
                      border: "none", cursor: "pointer", fontWeight: 600 }}>
                    <X size={12} /> Limpiar ({activeCount})
                  </button>
                )}
              </div>
              <button data-testid="shop-close-filters" onClick={() => setDrawer(false)}
                style={{ width: "36px", height: "36px", borderRadius: "50%",
                  background: "var(--surface-2)", border: "1px solid var(--border)",
                  color: "var(--text-2)", cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center" }}>
                <X size={17} />
              </button>
            </div>
            <ShopFilters categories={categories} brands={brands} values={values}
              onSet={patch} onClear={clearAll} activeCount={activeCount} hideHeader />
            <button onClick={() => setDrawer(false)} className="btn btn-accent"
              data-testid="shop-drawer-apply"
              style={{ width: "100%", marginTop: "20px", padding: "13px" }}>
              Ver {data?.count ?? products.length} productos
            </button>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes slideInLeft { from { transform: translateX(-100%) } to { transform: translateX(0) } }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @media (max-width: 900px) {
          .shop-layout { grid-template-columns: 1fr !important; }
          .shop-sidebar { display: none !important; }
          .shop-filter-btn { display: inline-flex !important; }
        }
        @media (max-width: 560px) {
          .shop-view-toggle { display: none !important; }
        }
      `}</style>
    </div>
  )
}
