// pages/Shop.jsx
import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { getProducts, getCategories } from "../api/products.api"
import ProductCard from "../components/product/ProductCard"
import { useScrollReveal } from "../hooks/useScrollReveal"

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch]   = useState(searchParams.get("search") || "")
  const [page, setPage]       = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const filters = {
    search:         searchParams.get("search")   || undefined,
    category__slug: searchParams.get("category") || undefined,
    ordering:       searchParams.get("ordering") || "-created_at",
    page,
  }

  const { data, isLoading } = useQuery({
    queryKey: ["products", filters],
    queryFn:  () => getProducts(filters),
  })

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn:  getCategories,
  })
  

  const products   = data?.results || []
  const categories = categoriesData?.results || categoriesData || []
  const headerRef  = useScrollReveal({ delay: 0 })
  const gridRef    = useScrollReveal({ delay: 100, scaleIn: true })

  const activeCategory = searchParams.get("category")
  const activeOrdering = searchParams.get("ordering") || "-created_at"

  const ORDERINGS = [
    { value: "-created_at", label: "Más recientes" },
    { value: "price",       label: "Precio ↑"      },
    { value: "-price",      label: "Precio ↓"      },
    { value: "name",        label: "A → Z"          },
  ]

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    setSearchParams(prev => {
      if (search) prev.set("search", search)
      else prev.delete("search")
      return prev
    })
  }

  const setCategory = (slug) => {
    setPage(1)
    setSearchParams(prev => {
      if (slug) prev.set("category", slug)
      else prev.delete("category")
      return prev
    })
  }

  const setOrdering = (val) => {
    setPage(1)
    setSearchParams(prev => {
      prev.set("ordering", val)
      return prev
    })
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>

      {/* ── Header ── */}
      <div ref={headerRef} style={{
        borderBottom: "1px solid var(--border)",
        padding: "clamp(48px, 8vw, 80px) clamp(20px, 5vw, 60px) 0",
        background: `radial-gradient(ellipse 60% 40% at 50% 0%,
          rgba(26,255,110,0.05) 0%, transparent 70%)`,
      }}>
        <div style={{ maxWidth: "var(--container)", margin: "0 auto" }}>
          <p style={{
            fontSize: "12px", color: "var(--accent)", fontWeight: 600,
            letterSpacing: "0.1em", textTransform: "uppercase",
            marginBottom: "12px",
          }}>
            Tienda
          </p>
          <h1 style={{
            fontFamily:   "var(--font-serif)",
            fontSize:     "clamp(2.5rem, 6vw, 5rem)",
            fontWeight:   300,
            lineHeight:   1.05,
            letterSpacing:"-0.02em",
            marginBottom: "32px",
          }}>
            Todo el equipamiento<br />
            <em style={{ fontStyle: "italic", color: "var(--text-2)" }}>
              que necesitás
            </em>
          </h1>

          {/* Buscador */}
          <form onSubmit={handleSearch} style={{
            display: "flex", gap: "10px",
            maxWidth: "560px", marginBottom: "36px",
          }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{
                position: "absolute", left: "14px", top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-3)", fontSize: "15px",
                pointerEvents: "none",
              }}>
                ⌕
              </span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar productos..."
                className="input"
                style={{ paddingLeft: "40px" }}
              />
            </div>
            <button type="submit" className="btn btn-accent"
              style={{ padding: "12px 22px", flexShrink: 0 }}>
              Buscar
            </button>
          </form>

          {/* Tabs de categorías */}
          <div style={{
            display:    "flex",
            gap:        "4px",
            overflowX:  "auto",
            paddingBottom: "0",
            scrollbarWidth: "none",
          }}>
            <button
              onClick={() => setCategory("")}
              style={{
                padding:      "8px 18px",
                borderRadius: "var(--r-full) var(--r-full) 0 0",
                fontSize:     "13px",
                fontWeight:   !activeCategory ? 500 : 400,
                background:   !activeCategory ? "var(--surface)" : "transparent",
                border:       !activeCategory ? "1px solid var(--border)" : "1px solid transparent",
                borderBottom: !activeCategory ? "1px solid var(--surface)" : "1px solid transparent",
                color:        !activeCategory ? "var(--text)" : "var(--text-3)",
                cursor:       "pointer",
                whiteSpace:   "nowrap",
                transition:   "all var(--dur) var(--ease)",
                marginBottom: "-1px",
              }}>
              Todo
            </button>
            {categories.map(cat => (
              <button key={cat.id}
                onClick={() => setCategory(cat.slug)}
                style={{
                  padding:      "8px 18px",
                  borderRadius: "var(--r-full) var(--r-full) 0 0",
                  fontSize:     "13px",
                  fontWeight:   activeCategory === cat.slug ? 500 : 400,
                  background:   activeCategory === cat.slug ? "var(--surface)" : "transparent",
                  border:       activeCategory === cat.slug ? "1px solid var(--border)" : "1px solid transparent",
                  borderBottom: activeCategory === cat.slug ? "1px solid var(--surface)" : "1px solid transparent",
                  color:        activeCategory === cat.slug ? "var(--text)" : "var(--text-3)",
                  cursor:       "pointer",
                  whiteSpace:   "nowrap",
                  transition:   "all var(--dur) var(--ease)",
                  marginBottom: "-1px",
                }}>
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Contenido ── */}
      <div style={{
        maxWidth: "var(--container)", margin: "0 auto",
        padding: "clamp(32px, 4vw, 48px) clamp(20px, 5vw, 60px)",
      }}>

        {/* Toolbar */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: "28px", flexWrap: "wrap", gap: "12px",
        }}>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            {isLoading ? "Cargando..." : `${data?.count || products.length} productos`}
            {activeCategory && ` · ${categories.find(c => c.slug === activeCategory)?.name}`}
          </p>

          {/* Ordenar */}
          <div style={{ display: "flex", gap: "6px" }}>
            {ORDERINGS.map(({ value, label }) => (
              <button key={value}
                onClick={() => setOrdering(value)}
                style={{
                  padding:      "6px 14px",
                  borderRadius: "var(--r-full)",
                  fontSize:     "12px",
                  cursor:       "pointer",
                  background:   activeOrdering === value ? "var(--text)" : "transparent",
                  color:        activeOrdering === value ? "var(--bg)" : "var(--text-3)",
                  border:       activeOrdering === value ? "1px solid var(--text)" : "1px solid var(--border)",
                  transition:   "all var(--dur) var(--ease)",
                  whiteSpace:   "nowrap",
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "20px",
          }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "360px" }} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "120px 0",
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: "16px",
          }}>
            <span style={{ fontSize: "48px" }}>🔍</span>
            <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.6rem",
              fontWeight: 300 }}>
              Sin resultados
            </h3>
            <p style={{ color: "var(--text-3)", fontSize: "15px" }}>
              Probá con otros términos o explorá todas las categorías.
            </p>
            <button onClick={() => {
              setSearch("")
              setSearchParams({})
            }} className="btn btn-ghost" style={{ marginTop: "8px" }}>
              Ver todos los productos
            </button>
          </div>
        ) : (
          <div ref={gridRef} style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "20px",
          }}>
            {products.map((product, i) => (
              <div key={product.id}
                style={{
                  animation: `fadeUp 500ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 50}ms both`,
                }}>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        )}

        {/* Paginación */}
        {(data?.next || data?.previous) && (
          <div style={{
            display: "flex", justifyContent: "center",
            alignItems: "center", gap: "12px", marginTop: "60px",
          }}>
            <button
              disabled={!data.previous}
              onClick={() => setPage(p => p - 1)}
              className="btn btn-ghost"
              style={{ opacity: data.previous ? 1 : 0.3 }}>
              ← Anterior
            </button>
            <span style={{
              padding: "8px 20px", borderRadius: "var(--r-full)",
              background: "var(--surface)", border: "1px solid var(--border)",
              fontSize: "13px", color: "var(--text-2)",
            }}>
              Página {page}
            </span>
            <button
              disabled={!data.next}
              onClick={() => setPage(p => p + 1)}
              className="btn btn-ghost"
              style={{ opacity: data.next ? 1 : 0.3 }}>
              Siguiente →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}