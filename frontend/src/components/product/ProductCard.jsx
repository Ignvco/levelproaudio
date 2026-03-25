// components/product/ProductCard.jsx
// Card de producto para grillas — conectada al router

import { Link } from "react-router-dom"

export default function ProductCard({ product }) {
  return (
    <Link
      to={`/shop/${product.slug}`}
      className="group rounded-xl overflow-hidden transition-all hover:-translate-y-1"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Imagen */}
      <div
        className="relative w-full h-48 overflow-hidden"
        style={{ backgroundColor: "var(--color-surface-2)" }}
      >
        {product.primary_image ? (
          <img
            src={product.primary_image}
            alt={product.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl">🎧</span>
          </div>
        )}

        {/* Badge descuento */}
        {product.has_discount && (
          <span
            className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
          >
            -{product.discount_percentage}%
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>
          {product.brand_name}
        </p>
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 mb-3">
          {product.name}
        </h3>

        {/* Precio */}
        <div className="flex items-baseline gap-2">
          <span
            className="font-bold text-base"
            style={{ color: "var(--color-accent)" }}
          >
            ${Number(product.price).toLocaleString("es-CL")}
          </span>
          {product.has_discount && (
            <span
              className="text-xs line-through"
              style={{ color: "var(--color-text-muted)" }}
            >
              ${Number(product.compare_price).toLocaleString("es-CL")}
            </span>
          )}
        </div>

        {/* Stock */}
        {!product.in_stock && (
          <p className="mt-2 text-xs" style={{ color: "var(--color-danger)" }}>
            Sin stock
          </p>
        )}
      </div>
    </Link>
  )
}