// pages/ProductDetail.jsx

import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getProduct } from "../api/products.api"
import { useCartStore } from "../store/cartStore"

function ImageGallery({ images, name }) {
  const [selected, setSelected] = useState(0)

  if (!images?.length) return (
    <div style={{
      width: "100%", aspectRatio: "1",
      borderRadius: "var(--r-xl)", overflow: "hidden",
      background: "var(--surface-2)", border: "1px solid var(--border)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "64px",
    }}>
      🎧
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Principal */}
      <div style={{
        width: "100%", aspectRatio: "1", borderRadius: "var(--r-xl)",
        overflow: "hidden", background: "var(--surface-2)",
        border: "1px solid var(--border)",
      }}>
        <img src={images[selected]?.image} alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
          {images.map((img, i) => (
            <button key={img.id} onClick={() => setSelected(i)}
              style={{
                flexShrink: 0, width: "64px", height: "64px",
                borderRadius: "var(--r-md)", overflow: "hidden",
                border: `2px solid ${i === selected ? "var(--text)" : "var(--border)"}`,
                cursor: "pointer", background: "none", padding: 0,
                transition: "border-color var(--dur) var(--ease)",
              }}>
              <img src={img.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProductDetail() {
  const { slug }    = useParams()
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const { addItem } = useCartStore()

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", slug],
    queryFn:  () => getProduct(slug),
  })

  const handleAdd = () => {
    addItem(product, qty)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  if (isLoading) return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "60px clamp(20px, 5vw, 60px)" }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="skeleton" style={{ aspectRatio: "1", borderRadius: "var(--r-xl)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {[80, 50, 60, 40, 70].map((w, i) => (
            <div key={i} className="skeleton" style={{ height: "20px", width: `${w}%` }} />
          ))}
        </div>
      </div>
    </div>
  )

  if (isError || !product) return (
    <div style={{ textAlign: "center", padding: "120px 20px" }}>
      <p style={{ color: "var(--text-3)", marginBottom: "20px" }}>Producto no encontrado.</p>
      <Link to="/shop" className="btn btn-ghost">← Volver a la tienda</Link>
    </div>
  )

  const inStock = Number(product.stock) > 0

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh",
      padding: "clamp(40px, 6vw, 80px) 0" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto",
        padding: "0 clamp(20px, 5vw, 60px)" }}>

        {/* Breadcrumb */}
        <nav style={{ display: "flex", alignItems: "center", gap: "8px",
          fontSize: "13px", color: "var(--text-3)", marginBottom: "40px" }}>
          <Link to="/" className="hover:text-white" style={{ transition: "color var(--dur)" }}>
            Inicio
          </Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-white" style={{ transition: "color var(--dur)" }}>
            Tienda
          </Link>
          <span>/</span>
          <span style={{ color: "var(--text-2)" }}>{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16" style={{ alignItems: "start" }}>

          {/* Galería */}
          <ImageGallery images={product.images} name={product.name} />

          {/* Info */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px",
            position: "sticky", top: "88px" }}>

            {/* Marca + nombre */}
            <div>
              {product.brand && (
                <p style={{ fontSize: "12px", color: "var(--text-3)", textTransform: "uppercase",
                  letterSpacing: "0.1em", fontWeight: 500, marginBottom: "8px" }}>
                  {product.brand.name}
                </p>
              )}
              <h1 style={{ fontFamily: "var(--font-serif)",
                fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)", lineHeight: 1.1 }}>
                {product.name}
              </h1>
              {product.sku && (
                <p style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "6px" }}>
                  SKU: {product.sku}
                </p>
              )}
            </div>

            {/* Precio */}
            <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: "2.2rem",
                fontWeight: 400, lineHeight: 1 }}>
                ${Number(product.price).toLocaleString("es-CL")}
              </span>
              {product.has_discount && (
                <>
                  <span style={{ fontSize: "1.1rem", color: "var(--text-3)",
                    textDecoration: "line-through" }}>
                    ${Number(product.compare_price).toLocaleString("es-CL")}
                  </span>
                  <span style={{ padding: "2px 8px", borderRadius: "100px",
                    background: "var(--accent)", color: "#000", fontSize: "12px", fontWeight: 600 }}>
                    -{product.discount_percentage}%
                  </span>
                </>
              )}
            </div>

            {/* Descripción corta */}
            {product.short_description && (
              <p style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.7 }}>
                {product.short_description}
              </p>
            )}

            <div style={{ height: "1px", background: "var(--border)" }} />

            {/* Stock */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "7px", height: "7px", borderRadius: "50%",
                background: inStock ? "var(--accent)" : "var(--danger)",
              }} />
              <span style={{ fontSize: "13px", color: "var(--text-2)" }}>
                {inStock
                  ? `En stock — ${product.stock} disponibles`
                  : "Sin stock disponible"}
              </span>
            </div>

            {/* Cantidad + agregar */}
            {inStock && (
              <div style={{ display: "flex", gap: "12px" }}>
                {/* Cantidad */}
                <div style={{
                  display: "flex", alignItems: "center",
                  border: "1px solid var(--border)", borderRadius: "var(--r-md)",
                  overflow: "hidden", flexShrink: 0,
                }}>
                  <button onClick={() => setQty(q => Math.max(1, q - 1))}
                    style={{ width: "40px", height: "44px", display: "flex",
                      alignItems: "center", justifyContent: "center",
                      background: "none", border: "none", color: "var(--text-2)",
                      cursor: "pointer", fontSize: "18px" }}>
                    −
                  </button>
                  <span style={{ width: "36px", textAlign: "center",
                    fontSize: "14px", fontWeight: 500 }}>
                    {qty}
                  </span>
                  <button onClick={() => setQty(q => Math.min(product.stock, q + 1))}
                    style={{ width: "40px", height: "44px", display: "flex",
                      alignItems: "center", justifyContent: "center",
                      background: "none", border: "none", color: "var(--text-2)",
                      cursor: "pointer", fontSize: "18px" }}>
                    +
                  </button>
                </div>

                {/* Agregar */}
                <button onClick={handleAdd} className="btn btn-accent"
                  style={{ flex: 1, justifyContent: "center",
                    background: added ? "var(--surface-3)" : "var(--accent)",
                    color: added ? "var(--text)" : "#000",
                    border: added ? "1px solid var(--border)" : "none",
                    transition: "all 300ms var(--ease)" }}>
                  {added ? "✓ Agregado" : "Agregar al carrito"}
                </button>
              </div>
            )}

            {/* Categoría */}
            {product.category && (
              <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
                Categoría:{" "}
                <Link to={`/shop?category=${product.category.slug}`}
                  style={{ color: "var(--text-2)", transition: "color var(--dur)" }}
                  className="hover:text-white">
                  {product.category.name}
                </Link>
              </p>
            )}
          </div>
        </div>

        {/* Descripción completa */}
        {product.description && (
          <div style={{
            marginTop: "80px", paddingTop: "48px",
            borderTop: "1px solid var(--border)",
          }}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem",
              marginBottom: "24px" }}>
              Descripción
            </h2>
            <div style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.8,
              maxWidth: "680px" }}
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          </div>
        )}
      </div>
    </div>
  )
}