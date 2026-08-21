// components/product/ProductCard.jsx
// Card de producto estilo "white card" (referencia del cliente):
//  - Imagen con badge arriba-izquierda + logo de marca (círculo) arriba-derecha
//  - Puntos de carrusel sobre la imagen
//  - Título + logo de marca como subtítulo + descripción corta
//  - Píldora de precio + botón "Comprar" oscuro con flecha
// Click en la card → detalle. Click en "Comprar" → agrega al carrito.

import { useState, useRef, useEffect } from "react"
import { useNavigate }     from "react-router-dom"
import { ArrowUpRight }    from "lucide-react"
import { useCartStore }    from "../../store/cartStore"
import { usePrice }        from "../../hooks/usePrice"
import { mediaUrl }        from "../../utils/mediaUrl"
import { showToast }       from "../ui/ToastNotification"
import { FavoriteButton }  from "./FavoriteButton"
import { getProductBadge } from "../../utils/productBadge"

export default function ProductCard({ product }) {
  const { addItem } = useCartStore()
  const { price }   = usePrice()
  const navigate    = useNavigate()

  const [imgIndex, setImgIndex] = useState(0)
  const [added, setAdded]       = useState(false)
  const addedTimer              = useRef(null)

  useEffect(() => () => clearTimeout(addedTimer.current), [])

  // Galería de imágenes (fallback a primary_image)
  const gallery = (product.images && product.images.length
    ? product.images
    : [product.primary_image].filter(Boolean)
  ).map(mediaUrl)

  const currentImg = gallery[imgIndex] || null
  const brandLogo  = product.brand_logo ? mediaUrl(product.brand_logo) : null

  const badgeInfo = getProductBadge(product)
  const badge     = badgeInfo?.label || null

  const outOfStock = product.stock === 0 && product.product_type === "stock"

  const goToDetail = () => navigate(`/shop/${product.slug}`)

  const handleBuy = (e) => {
    e.stopPropagation()
    if (outOfStock) return
    addItem(product, 1)
    showToast(`${product.name} agregado al carrito`)
    setAdded(true)
    clearTimeout(addedTimer.current)
    addedTimer.current = setTimeout(() => setAdded(false), 1000)
  }

  return (
    <div
      data-testid={`product-card-${product.slug}`}
      className="lp-product-card"
      onClick={goToDetail}
      style={{
        background:    "rgba(20,20,24,0.55)",
        backdropFilter: "blur(16px) saturate(1.3)",
        WebkitBackdropFilter: "blur(16px) saturate(1.3)",
        border:        "1px solid rgba(255,255,255,0.08)",
        borderRadius:  "26px",
        padding:       "14px",
        cursor:        "pointer",
        boxShadow:     "0 18px 50px -20px rgba(0,0,0,0.7)",
        transition:    "transform 400ms cubic-bezier(0.16,1,0.3,1), box-shadow 400ms cubic-bezier(0.16,1,0.3,1), border-color 300ms cubic-bezier(0.16,1,0.3,1)",
        display:       "flex",
        flexDirection: "column",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-6px)"
        e.currentTarget.style.boxShadow = "0 30px 60px -25px rgba(0,0,0,0.85)"
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0)"
        e.currentTarget.style.boxShadow = "0 18px 50px -20px rgba(0,0,0,0.7)"
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"
      }}
    >
      {/* ── Imagen ── */}
      <div style={{
        position:     "relative",
        borderRadius: "20px",
        overflow:     "hidden",
        aspectRatio:  "1 / 1.12",
        background:   "#1a1a1a",
      }}>
        {currentImg ? (
          <img
            src={currentImg}
            alt={product.name}
            data-testid={`product-image-${product.slug}`}
            style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
            onError={e => { e.target.style.display = "none" }}
          />
        ) : (
          <div style={{ width:"100%", height:"100%", display:"flex",
            alignItems:"center", justifyContent:"center", fontSize:"46px" }}>
            🎧
          </div>
        )}

        {/* Fila superior-izquierda: corazón + badge */}
        <div style={{ position:"absolute", top:"14px", left:"14px", zIndex:2,
          display:"flex", alignItems:"center", gap:"8px" }}>
          <FavoriteButton productId={product.id} slug={product.slug} size={38} />
          {badge && (
            <span
              data-testid={`product-badge-${product.slug}`}
              style={{
                background: badgeInfo?.tone === "urgent" ? "rgba(217,119,6,0.85)" : "rgba(20,20,20,0.72)",
                backdropFilter:"blur(8px)",
                color:"#fff", fontSize:"12px", fontWeight:600,
                padding:"6px 13px", borderRadius:"9999px",
              }}>
              {badge}
            </span>
          )}
        </div>

        {/* Logo de marca arriba-derecha */}
        {brandLogo && (
          <div style={{
            position:"absolute", top:"12px", right:"12px", zIndex:2,
            width:"46px", height:"46px", borderRadius:"50%",
            background:"#fff", display:"flex", alignItems:"center",
            justifyContent:"center", padding:"9px",
            boxShadow:"0 4px 14px rgba(0,0,0,0.18)",
          }}>
            <img src={brandLogo} alt={product.brand_name || ""}
              style={{ width:"100%", height:"100%", objectFit:"contain" }}
              onError={e => { e.target.parentElement.style.display = "none" }} />
          </div>
        )}

        {/* Puntos de carrusel */}
        {gallery.length > 1 && (
          <div style={{
            position:"absolute", bottom:"14px", left:"50%",
            transform:"translateX(-50%)", display:"flex", gap:"6px", zIndex:2,
          }}>
            {gallery.map((_, i) => (
              <button
                key={i}
                data-testid={`product-dot-${product.slug}-${i}`}
                onClick={(e) => { e.stopPropagation(); setImgIndex(i) }}
                style={{
                  width: i === imgIndex ? "20px" : "7px",
                  height:"7px",
                  borderRadius:"9999px",
                  border:"none", padding:0, cursor:"pointer",
                  background: i === imgIndex ? "#fff" : "rgba(255,255,255,0.5)",
                  transition:"all 300ms cubic-bezier(0.16,1,0.3,1)",
                }}
              />
            ))}
          </div>
        )}

        {/* Sin stock */}
        {outOfStock && (
          <div style={{ position:"absolute", inset:0, zIndex:3,
            background:"rgba(10,10,10,0.72)", backdropFilter:"blur(3px)",
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:"13px", fontWeight:600, color:"#fff",
              background:"#1c1c1c", padding:"8px 16px", borderRadius:"9999px",
              border:"1px solid rgba(255,255,255,0.12)" }}>
              Sin stock
            </span>
          </div>
        )}
      </div>

      {/* ── Info ── */}
      <div style={{ padding:"18px 8px 6px", display:"flex", flexDirection:"column", gap:"6px" }}>
        <h3 data-testid={`product-name-${product.slug}`} style={{
          fontFamily:"var(--font-display)", fontSize:"1.35rem", fontWeight:700,
          lineHeight:1.15, color:"#fff", letterSpacing:"-0.02em",
          overflow:"hidden", display:"-webkit-box",
          WebkitLineClamp:1, WebkitBoxOrient:"vertical",
        }}>
          {product.name}
        </h3>

        {/* Marca como logo (subtítulo) */}
        {brandLogo ? (
          <img src={brandLogo} alt={product.brand_name || ""}
            style={{ height:"20px", width:"auto", objectFit:"contain",
              objectPosition:"left center", opacity:0.55,
              filter:"brightness(0) invert(1)", alignSelf:"flex-start" }}
            onError={e => { e.target.style.display = "none" }} />
        ) : product.brand_name ? (
          <p style={{ fontSize:"15px", color:"#8c8c8c", fontWeight:500 }}>
            {product.brand_name}
          </p>
        ) : null}

        {product.short_description && (
          <p data-testid={`product-desc-${product.slug}`} style={{
            fontSize:"15px", color:"#8c8c8c", lineHeight:1.4, marginTop:"2px",
            overflow:"hidden", display:"-webkit-box",
            WebkitLineClamp:2, WebkitBoxOrient:"vertical",
          }}>
            {product.short_description}
          </p>
        )}

        {/* Precio + Comprar */}
        <div className="lp-product-buyrow" style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          gap:"10px", marginTop:"14px",
        }}>
          <span
            data-testid={`product-price-${product.slug}`}
            style={{
              background:"rgba(255,255,255,0.06)", color:"#fff", fontWeight:700,
              fontSize:"1.15rem", padding:"12px 22px", borderRadius:"9999px",
              border:"1px solid rgba(255,255,255,0.08)",
              lineHeight:1, whiteSpace:"nowrap",
            }}>
            {price(product)}
          </span>

          <button
            data-testid={`product-buy-${product.slug}`}
            onClick={handleBuy}
            disabled={outOfStock}
            style={{
              display:"flex", alignItems:"center", gap:"10px",
              background: added ? "#1aa34a" : "var(--accent)",
              color:"#000", fontWeight:700, fontSize:"1rem",
              padding:"12px 10px 12px 22px", borderRadius:"9999px",
              border:"none",
              cursor: outOfStock ? "not-allowed" : "pointer",
              opacity: outOfStock ? 0.4 : 1,
              transition:"all 300ms cubic-bezier(0.16,1,0.3,1)",
              whiteSpace:"nowrap",
            }}
            onMouseEnter={e => { if (!outOfStock) e.currentTarget.style.transform = "scale(1.04)" }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)" }}
          >
            {added ? (
              <>
                Agregado
                <span style={{
                  width:"26px", height:"26px", borderRadius:"50%",
                  background:"#fff", color:"#1aa34a", display:"flex",
                  alignItems:"center", justifyContent:"center", fontSize:"16px",
                  fontWeight:700,
                }}>
                  +
                </span>
              </>
            ) : (
              <>
                Comprar
                <span style={{
                  width:"26px", height:"26px", borderRadius:"50%",
                  background:"#000", color:"var(--accent)", display:"flex",
                  alignItems:"center", justifyContent:"center",
                }}>
                  <ArrowUpRight size={15} strokeWidth={2.5} />
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
