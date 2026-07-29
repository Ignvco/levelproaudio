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
import { mediaUrl }        from "../../utils/mediaUrl"
import { showToast }       from "../ui/ToastNotification"

export default function ProductCard({ product }) {
  const { addItem } = useCartStore()
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

  const hasDiscount = product.compare_price && Number(product.compare_price) > Number(product.price)
  const discount    = hasDiscount
    ? Math.round((1 - Number(product.price) / Number(product.compare_price)) * 100)
    : 0

  const badge = hasDiscount
    ? `-${discount}%`
    : product.is_featured
      ? "Destacado"
      : null

  const outOfStock = product.stock === 0

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
        background:    "#ffffff",
        borderRadius:  "28px",
        padding:       "14px",
        cursor:        "pointer",
        boxShadow:     "0 18px 50px -12px rgba(0,0,0,0.45)",
        transition:    "transform 400ms cubic-bezier(0.16,1,0.3,1), box-shadow 400ms cubic-bezier(0.16,1,0.3,1)",
        display:       "flex",
        flexDirection: "column",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-6px)"
        e.currentTarget.style.boxShadow = "0 30px 70px -12px rgba(0,0,0,0.6)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0)"
        e.currentTarget.style.boxShadow = "0 18px 50px -12px rgba(0,0,0,0.45)"
      }}
    >
      {/* ── Imagen ── */}
      <div style={{
        position:     "relative",
        borderRadius: "20px",
        overflow:     "hidden",
        aspectRatio:  "1 / 1.12",
        background:   "#f1f1f1",
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

        {/* Badge arriba-izquierda */}
        {badge && (
          <span
            data-testid={`product-badge-${product.slug}`}
            style={{
              position:"absolute", top:"14px", left:"14px",
              background:"rgba(20,20,20,0.72)", backdropFilter:"blur(8px)",
              color:"#fff", fontSize:"12px", fontWeight:600,
              padding:"6px 13px", borderRadius:"9999px", zIndex:2,
            }}>
            {badge}
          </span>
        )}

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
            background:"rgba(255,255,255,0.7)", backdropFilter:"blur(3px)",
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:"13px", fontWeight:600, color:"#111",
              background:"#fff", padding:"8px 16px", borderRadius:"9999px",
              boxShadow:"0 4px 14px rgba(0,0,0,0.15)" }}>
              Sin stock
            </span>
          </div>
        )}
      </div>

      {/* ── Info ── */}
      <div style={{ padding:"18px 8px 6px", display:"flex", flexDirection:"column", gap:"6px" }}>
        <h3 data-testid={`product-name-${product.slug}`} style={{
          fontFamily:"var(--font-display)", fontSize:"1.35rem", fontWeight:700,
          lineHeight:1.15, color:"#111", letterSpacing:"-0.02em",
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
              filter:"grayscale(1)", alignSelf:"flex-start" }}
            onError={e => { e.target.style.display = "none" }} />
        ) : product.brand_name ? (
          <p style={{ fontSize:"15px", color:"#b0b0b0", fontWeight:500 }}>
            {product.brand_name}
          </p>
        ) : null}

        {product.short_description && (
          <p data-testid={`product-desc-${product.slug}`} style={{
            fontSize:"15px", color:"#a0a0a0", lineHeight:1.4, marginTop:"2px",
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
              background:"#f0f0f0", color:"#111", fontWeight:700,
              fontSize:"1.15rem", padding:"12px 22px", borderRadius:"9999px",
              lineHeight:1, whiteSpace:"nowrap",
            }}>
            ${Number(product.price).toLocaleString("es-CL")}
          </span>

          <button
            data-testid={`product-buy-${product.slug}`}
            onClick={handleBuy}
            disabled={outOfStock}
            style={{
              display:"flex", alignItems:"center", gap:"10px",
              background: added ? "#1aa34a" : "#111",
              color:"#fff", fontWeight:600, fontSize:"1rem",
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
                  background:"#fff", color:"#111", display:"flex",
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
