// pages/ProductDetail.jsx
// Página de detalle de un producto
// Muestra galería, info completa y botón agregar al carrito

import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getProduct } from "../api/products.api"
import { useCartStore } from "../store/cartStore"

// ── Galería de imágenes ──────────────────────────────────────
function ImageGallery({ images, name }) {
  const [selected, setSelected] = useState(0)

  if (!images?.length) {
    return (
      <div
        className="w-full aspect-square rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: "var(--color-surface-2)" }}
      >
        <span className="text-8xl">🎧</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Imagen principal */}
      <div
        className="w-full aspect-square rounded-2xl overflow-hidden"
        style={{ backgroundColor: "var(--color-surface-2)" }}
      >
        <img
          src={images[selected]?.image}
          alt={images[selected]?.alt_text || name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setSelected(i)}
              className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-all"
              style={{
                border: `2px solid ${i === selected
                  ? "var(--color-accent)"
                  : "var(--color-border)"
                }`,
              }}
            >
              <img
                src={img.image}
                alt={img.alt_text || name}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── ProductDetail page ───────────────────────────────────────
export default function ProductDetail() {
  const { slug } = useParams()
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const { addItem } = useCartStore()

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => getProduct(slug),
  })

  const handleAddToCart = () => {
    addItem(product, quantity)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  // ── Loading ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div
            className="aspect-square rounded-2xl animate-pulse"
            style={{ backgroundColor: "var(--color-surface)" }}
          />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-6 rounded animate-pulse"
                style={{
                  backgroundColor: "var(--color-surface)",
                  width: `${[80, 50, 60, 40, 70][i]}%`
                }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────
  if (isError || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-lg mb-4" style={{ color: "var(--color-text-muted)" }}>
          Producto no encontrado.
        </p>
        <Link
          to="/shop"
          style={{ color: "var(--color-accent)" }}
          className="text-sm font-medium"
        >
          ← Volver a la tienda
        </Link>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen py-10 px-4"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div className="max-w-7xl mx-auto">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-8" style={{ color: "var(--color-text-muted)" }}>
          <Link to="/" className="hover:text-white transition-colors">Inicio</Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-white transition-colors">Tienda</Link>
          <span>/</span>
          <span style={{ color: "var(--color-text)" }}>{product.name}</span>
        </nav>

        {/* Grid principal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">

          {/* Galería */}
          <ImageGallery images={product.images} name={product.name} />

          {/* Info del producto */}
          <div className="flex flex-col gap-6">

            {/* Marca + nombre */}
            <div>
              {product.brand && (
                <p
                  className="text-sm font-medium mb-1 uppercase tracking-widest"
                  style={{ color: "var(--color-accent)" }}
                >
                  {product.brand.name}
                </p>
              )}
              <h1 className="text-3xl font-black leading-tight">
                {product.name}
              </h1>
              {product.sku && (
                <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                  SKU: {product.sku}
                </p>
              )}
            </div>

            {/* Precio */}
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-black" style={{ color: "var(--color-accent)" }}>
                ${Number(product.price).toLocaleString("es-CL")}
              </span>
              {product.has_discount && (
                <>
                  <span
                    className="text-xl line-through"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    ${Number(product.compare_price).toLocaleString("es-CL")}
                  </span>
                  <span
                    className="text-sm font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
                  >
                    -{product.discount_percentage}%
                  </span>
                </>
              )}
            </div>

            {/* Descripción corta */}
            {product.short_description && (
              <p style={{ color: "var(--color-text-muted)" }} className="text-sm leading-relaxed">
                {product.short_description}
              </p>
            )}

            {/* Divider */}
            <div style={{ borderTop: "1px solid var(--color-border)" }} />

            {/* Stock */}
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: product.in_stock
                    ? "var(--color-accent)"
                    : "var(--color-danger)"
                }}
              />
              <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                {product.in_stock
                  ? `En stock (${product.stock} disponibles)`
                  : "Sin stock"
                }
              </span>
            </div>

            {/* Cantidad + agregar al carrito */}
            {product.in_stock && (
              <div className="flex gap-3">
                {/* Selector de cantidad */}
                <div
                  className="flex items-center rounded-lg overflow-hidden"
                  style={{ border: "1px solid var(--color-border)" }}
                >
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-10 h-10 flex items-center justify-center text-lg font-bold transition-colors hover:bg-white/5"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    −
                  </button>
                  <span className="w-10 text-center text-sm font-semibold">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(q => Math.min(product.stock, q + 1))}
                    className="w-10 h-10 flex items-center justify-center text-lg font-bold transition-colors hover:bg-white/5"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    +
                  </button>
                </div>

                {/* Botón agregar */}
                <button
                  onClick={handleAddToCart}
                  className="flex-1 py-3 rounded-lg font-semibold text-sm transition-all"
                  style={{
                    backgroundColor: added ? "var(--color-accent-dim)" : "var(--color-accent)",
                    color: "#000",
                  }}
                >
                  {added ? "✓ Agregado al carrito" : "Agregar al carrito"}
                </button>
              </div>
            )}

            {/* Categoría */}
            {product.category && (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
                <span>Categoría:</span>
                <Link
                  to={`/shop?category=${product.category.slug}`}
                  className="transition-colors hover:text-white"
                  style={{ color: "var(--color-accent)" }}
                >
                  {product.category.name}
                </Link>
              </div>
            )}

          </div>
        </div>

        {/* Descripción completa */}
        {product.description && (
          <div
            className="mt-16 pt-10 border-t"
            style={{ borderColor: "var(--color-border)" }}
          >
            <h2 className="text-xl font-bold mb-4">Descripción</h2>
            <div
              className="text-sm leading-relaxed prose prose-invert max-w-none"
              style={{ color: "var(--color-text-muted)" }}
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          </div>
        )}

      </div>
    </div>
  )
}