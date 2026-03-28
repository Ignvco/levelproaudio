// pages/admin/AdminProducts.jsx

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getAdminProducts } from "../../api/admin.api"
import { Link } from "react-router-dom"

export default function AdminProducts() {
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", search],
    queryFn:  () => getAdminProducts({ ...(search && { search }) }),
  })

  const products = data?.results || []

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px" }}>
            Productos
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            {data?.count || 0} productos activos
          </p>
        </div>
        <a href="/admin/products/product/add/" target="_blank"
          className="btn btn-accent" style={{ padding: "10px 20px", fontSize: "13px" }}>
          + Nuevo producto
        </a>
      </div>

      <input
        placeholder="Buscar por nombre o SKU..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="input"
        style={{ maxWidth: "320px", marginBottom: "20px" }}
      />

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "200px" }} />
          ))}
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", overflow: "hidden" }}>

          {/* Header */}
          <div style={{ display: "grid",
            gridTemplateColumns: "auto 2fr 1fr 1fr 1fr 1fr",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span style={{ width: "40px" }}></span>
            <span>Producto</span>
            <span>Categoría</span>
            <span>Precio</span>
            <span>Stock</span>
            <span>Estado</span>
          </div>

          {products.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px" }}>
              No se encontraron productos.
            </div>
          ) : products.map((p, i) => (
            <div key={p.id} style={{
              display: "grid",
              gridTemplateColumns: "auto 2fr 1fr 1fr 1fr 1fr",
              padding: "12px 20px", alignItems: "center", gap: "12px",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              transition: "background var(--dur) var(--ease)",
            }}
              className="hover:bg-[var(--surface-2)]"
            >
              {/* Imagen */}
              <div style={{ width: "40px", height: "40px", borderRadius: "var(--r-sm)",
                background: "var(--surface-2)", overflow: "hidden",
                border: "1px solid var(--border)", flexShrink: 0 }}>
                {p.images?.[0]?.image ? (
                  <img src={p.images[0].image} alt={p.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex",
                    alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
                    🎧
                  </div>
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: "13px", fontWeight: 400, overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name}
                </p>
                {p.sku && (
                  <p style={{ fontSize: "11px", color: "var(--text-3)",
                    fontFamily: "monospace" }}>
                    {p.sku}
                  </p>
                )}
              </div>

              <span style={{ fontSize: "12px", color: "var(--text-2)" }}>
                {p.category?.name || "—"}
              </span>

              <span style={{ fontSize: "13px", fontWeight: 500 }}>
                ${Number(p.price).toLocaleString("es-CL")}
              </span>

              <span style={{
                fontSize: "13px",
                color: p.stock === 0 ? "var(--danger)"
                  : p.stock <= 5 ? "#facc15"
                  : "var(--text-2)",
                fontWeight: p.stock <= 5 ? 500 : 400,
              }}>
                {p.stock === 0 ? "Sin stock" : `${p.stock} uds.`}
              </span>

              <span style={{
                fontSize: "11px", padding: "2px 8px", borderRadius: "100px",
                fontWeight: 500,
                color:       p.is_active ? "#4ade80" : "var(--text-3)",
                background:  p.is_active ? "rgba(74,222,128,0.1)" : "var(--surface-3)",
                border:      `1px solid ${p.is_active ? "rgba(74,222,128,0.25)" : "var(--border)"}`,
              }}>
                {p.is_active ? "Activo" : "Inactivo"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}