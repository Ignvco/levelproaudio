// components/product/ProductRow.jsx — Vista lista (horizontal) con más detalle
import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowUpRight, Check, Truck } from "lucide-react"
import { useCartStore } from "../../store/cartStore"
import { mediaUrl } from "../../utils/mediaUrl"
import { showToast } from "../ui/ToastNotification"
import { FavoriteButton } from "./FavoriteButton"

export default function ProductRow({ product }) {
  const { addItem } = useCartStore()
  const navigate    = useNavigate()
  const [added, setAdded] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const img = mediaUrl(product.primary_image || (product.images && product.images[0]))
  const brandLogo = product.brand_logo ? mediaUrl(product.brand_logo) : null
  const hasDiscount = product.compare_price && Number(product.compare_price) > Number(product.price)
  const discount = hasDiscount
    ? Math.round((1 - Number(product.price) / Number(product.compare_price)) * 100) : 0
  const outOfStock = product.stock === 0

  const goTo = () => navigate(`/shop/${product.slug}`)
  const buy = (e) => {
    e.stopPropagation()
    if (outOfStock) return
    addItem(product, 1)
    showToast(`${product.name} agregado al carrito`)
    setAdded(true); clearTimeout(timer.current)
    timer.current = setTimeout(() => setAdded(false), 1000)
  }

  return (
    <div data-testid={`product-row-${product.slug}`} onClick={goTo}
      className="lp-product-row"
      style={{
        display: "flex", alignItems: "stretch", gap: "20px",
        background: "#121212", border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "22px", padding: "14px", cursor: "pointer",
        transition: "border-color 300ms var(--ease), transform 300ms var(--ease)",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; e.currentTarget.style.transform = "translateY(-2px)" }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)" }}>

      {/* Imagen */}
      <div style={{ position: "relative", width: "160px", flexShrink: 0,
        borderRadius: "16px", overflow: "hidden", background: "#1a1a1a", alignSelf: "stretch",
        minHeight: "140px" }} className="lp-row-img">
        {img ? (
          <img src={img} alt={product.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
            onError={e => { e.target.style.display = "none" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center", fontSize: "40px" }}>🎧</div>
        )}
        {hasDiscount && (
          <span style={{ position: "absolute", top: "10px", left: "10px",
            background: "var(--accent)", color: "#000", fontSize: "11px", fontWeight: 800,
            padding: "5px 10px", borderRadius: "9999px" }}>-{discount}%</span>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
        justifyContent: "center", gap: "8px", paddingBlock: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {product.brand_name && (
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "var(--accent)" }}>{product.brand_name}</span>
          )}
          {product.is_featured && (
            <span style={{ fontSize: "11px", color: "var(--text-3)",
              border: "1px solid var(--border)", padding: "2px 8px", borderRadius: "9999px" }}>Destacado</span>
          )}
        </div>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", fontWeight: 700,
          color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{product.name}</h3>
        {product.short_description && (
          <p style={{ fontSize: "14px", color: "#8c8c8c", lineHeight: 1.5, overflow: "hidden",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", maxWidth: "560px" }}>
            {product.short_description}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "2px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px",
            fontSize: "12.5px", color: outOfStock ? "#ff6b6b" : "var(--text-2)" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%",
              background: outOfStock ? "#ff6b6b" : "var(--accent)" }} />
            {outOfStock ? "Sin stock" : "En stock"}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px",
            fontSize: "12.5px", color: "var(--text-3)" }}>
            <Truck size={14} /> Envío a Chile y Argentina
          </span>
        </div>
      </div>

      {/* Precio + acciones */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end",
        justifyContent: "center", gap: "12px", flexShrink: 0, paddingRight: "6px" }}
        className="lp-row-actions">
        {hasDiscount && (
          <span style={{ fontSize: "13px", color: "var(--text-3)", textDecoration: "line-through" }}>
            ${Number(product.compare_price).toLocaleString("es-CL")}
          </span>
        )}
        <span style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 800,
          color: "#fff", whiteSpace: "nowrap" }}>
          ${Number(product.price).toLocaleString("es-CL")}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FavoriteButton productId={product.id} slug={product.slug} size={40} variant="solid" />
          <button data-testid={`row-buy-${product.slug}`} onClick={buy} disabled={outOfStock}
            style={{ display: "flex", alignItems: "center", gap: "8px",
              background: added ? "#1aa34a" : "var(--accent)", color: "#000",
              fontWeight: 700, fontSize: "14px", padding: "11px 10px 11px 20px",
              borderRadius: "9999px", border: "none",
              cursor: outOfStock ? "not-allowed" : "pointer", opacity: outOfStock ? 0.4 : 1,
              whiteSpace: "nowrap", transition: "all 300ms var(--ease)" }}
            onMouseEnter={e => { if (!outOfStock) e.currentTarget.style.transform = "scale(1.04)" }}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
            {added ? "Agregado" : "Comprar"}
            <span style={{ width: "24px", height: "24px", borderRadius: "50%",
              background: added ? "#fff" : "#000", color: added ? "#1aa34a" : "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              {added ? <Check size={14} strokeWidth={3} /> : <ArrowUpRight size={14} strokeWidth={2.5} />}
            </span>
          </button>
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .lp-product-row { flex-direction: column !important; }
          .lp-row-img { width: 100% !important; height: 200px; min-height: 200px !important; }
          .lp-row-actions { flex-direction: row !important; align-items: center !important;
            justify-content: space-between !important; width: 100%; }
        }
      `}</style>
    </div>
  )
}
