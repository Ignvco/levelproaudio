// components/product/ProductCard.jsx

import { Link } from "react-router-dom"

export default function ProductCard({ product }) {
  const inStock = Number(product.stock) > 0

  return (
    <Link
      to={`/shop/${product.slug}`}
      className="card"
      style={{ display: "flex", flexDirection: "column" }}
    >
      {/* Imagen */}
      <div style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1",
        background: "var(--surface-2)",
        overflow: "hidden",
      }}>
        {product.primary_image ? (
          <img
            src={product.primary_image}
            alt={product.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform 400ms var(--ease)",
            }}
            className="group-hover:scale-105"
          />
        ) : (
          <div style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "40px",
          }}>
            🎧
          </div>
        )}

        {/* Badges */}
        <div style={{ position: "absolute", top: "12px", left: "12px", display: "flex", gap: "6px" }}>
          {product.has_discount && (
            <span style={{
              padding: "3px 8px",
              borderRadius: "100px",
              background: "var(--accent)",
              color: "#000",
              fontSize: "11px",
              fontWeight: 600,
            }}>
              -{product.discount_percentage}%
            </span>
          )}
          {!inStock && (
            <span style={{
              padding: "3px 8px",
              borderRadius: "100px",
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(8px)",
              color: "var(--text-2)",
              fontSize: "11px",
              fontWeight: 500,
              border: "1px solid var(--border)",
            }}>
              Sin stock
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", flex: 1 }}>
        {product.brand_name && (
          <p style={{ fontSize: "11px", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px", fontWeight: 500 }}>
            {product.brand_name}
          </p>
        )}
        <p style={{ fontSize: "14px", fontWeight: 400, color: "var(--text)", lineHeight: 1.4, marginBottom: "16px", flex: 1 }}
          className="line-clamp-2"
        >
          {product.name}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px", fontWeight: 500, color: inStock ? "var(--text)" : "var(--text-3)" }}>
            ${Number(product.price).toLocaleString("es-CL")}
          </span>
          {product.has_discount && (
            <span style={{ fontSize: "13px", color: "var(--text-3)", textDecoration: "line-through" }}>
              ${Number(product.compare_price).toLocaleString("es-CL")}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}