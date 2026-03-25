// pages/Shop.jsx
// Catálogo completo con búsqueda, filtros y paginación

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { getProducts } from "../api/products.api"
import ProductCard from "../components/product/ProductCard"

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get("search") || "")

  const filters = {
    search: searchParams.get("search") || undefined,
    category__slug: searchParams.get("category") || undefined,
    ordering: searchParams.get("ordering") || "-created_at",
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ["products", filters],
    queryFn: () => getProducts(filters),
  })

  const handleSearch = (e) => {
    e.preventDefault()
    setSearchParams(prev => {
      if (search) prev.set("search", search)
      else prev.delete("search")
      return prev
    })
  }

  const handleOrdering = (value) => {
    setSearchParams(prev => {
      prev.set("ordering", value)
      return prev
    })
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      {/* Header de la tienda */}
      <div
        className="py-10 px-4 border-b"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)"
        }}
      >
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-black mb-6">Tienda</h1>

          {/* Búsqueda + ordenamiento */}
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <input
                type="text"
                placeholder="Buscar productos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg text-sm outline-none"
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
              >
                Buscar
              </button>
            </form>

            <select
              onChange={(e) => handleOrdering(e.target.value)}
              defaultValue="-created_at"
              className="px-4 py-2 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              <option value="-created_at">Más recientes</option>
              <option value="price">Precio: menor a mayor</option>
              <option value="-price">Precio: mayor a menor</option>
              <option value="name">Nombre A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grilla de productos */}
      <div className="max-w-7xl mx-auto px-4 py-10">
        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-64 rounded-xl animate-pulse"
                style={{ backgroundColor: "var(--color-surface)" }}
              />
            ))}
          </div>
        )}

        {isError && (
          <div className="text-center py-20" style={{ color: "var(--color-text-muted)" }}>
            Error al cargar los productos. Intenta de nuevo.
          </div>
        )}

        {!isLoading && !isError && data?.results?.length === 0 && (
          <div className="text-center py-20" style={{ color: "var(--color-text-muted)" }}>
            No se encontraron productos.
          </div>
        )}

        {!isLoading && !isError && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {data?.results?.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Paginación */}
            {(data?.next || data?.previous) && (
              <div className="flex justify-center gap-3 mt-10">
                <button
                  disabled={!data.previous}
                  className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-30"
                  style={{
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)"
                  }}
                >
                  ← Anterior
                </button>
                <button
                  disabled={!data.next}
                  className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-30"
                  style={{
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)"
                  }}
                >
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