// pages/Shop.jsx

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { getProducts } from "../api/products.api"
import ProductCard from "../components/product/ProductCard"

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get("search") || "")

  const filters = {
    search:        searchParams.get("search") || undefined,
    category__slug: searchParams.get("category") || undefined,
    ordering:      searchParams.get("ordering") || "-created_at",
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ["products", filters],
    queryFn:  () => getProducts(filters),
  })

  const products = data?.results || []

  const handleSearch = (e) => {
    e.preventDefault()
    setSearchParams(prev => {
      if (search) prev.set("search", search)
      else prev.delete("search")
      return prev
    })
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{
        padding: "clamp(48px, 8vw, 80px) 0 0",
        borderBottom: "1px solid var(--border)",
      }}>
        <div className="container" style={{ maxWidth: "var(--container)" }}>
          <h1 style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(2.5rem, 5vw, 4rem)",
            marginBottom: "32px",
          }}>
            Tienda
          </h1>

          {/* Búsqueda + ordenamiento */}
          <div style={{
            display: "flex",
            gap: "12px",
            paddingBottom: "32px",
            flexWrap: "wrap",
          }}>
            <form onSubmit={handleSearch} style={{ display: "flex", gap: "8px", flex: 1, minWidth: "240px" }}>
              <input
                type="text"
                placeholder="Buscar productos..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input"
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-accent" style={{ padding: "12px 20px", flexShrink: 0 }}>
                Buscar
              </button>
            </form>

            <select
              onChange={e => setSearchParams(prev => { prev.set("ordering", e.target.value); return prev })}
              defaultValue="-created_at"
              className="input"
              style={{ width: "auto", minWidth: "180px" }}
            >
              <option value="-created_at">Más recientes</option>
              <option value="price">Precio: menor a mayor</option>
              <option value="-price">Precio: mayor a menor</option>
              <option value="name">Nombre A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grilla */}
      <div className="container" style={{ maxWidth: "var(--container)", padding: "48px clamp(20px, 5vw, 60px)" }}>

        {isLoading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "320px" }} />
            ))}
          </div>
        )}

        {isError && (
          <p style={{ textAlign: "center", padding: "60px 0", color: "var(--text-3)" }}>
            Error al cargar los productos.
          </p>
        )}

        {!isLoading && !isError && products.length === 0 && (
          <p style={{ textAlign: "center", padding: "80px 0", color: "var(--text-3)", fontSize: "15px" }}>
            No se encontraron productos.
          </p>
        )}

        {!isLoading && !isError && products.length > 0 && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              {products.map(p => <ProductCard key={p.id} product={p} />)}
            </div>

            {/* Paginación */}
            {(data?.next || data?.previous) && (
              <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "48px" }}>
                <button disabled={!data.previous} className="btn btn-ghost" style={{ opacity: data.previous ? 1 : 0.4 }}>
                  ← Anterior
                </button>
                <button disabled={!data.next} className="btn btn-ghost" style={{ opacity: data.next ? 1 : 0.4 }}>
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}