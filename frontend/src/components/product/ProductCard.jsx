// components/product/ProductCard.jsx
// La API pública de lista devuelve:
//   product.primary_image  → URL relativa /media/... (campo plano del serializer de lista)
//   product.images[]       → array completo (solo en detail)
// Usamos primary_image para la lista, con fallback a images[0]

import { useRef }          from "react"
import { Link }            from "react-router-dom"
import { useCartStore }    from "../../store/cartStore"
import { mediaUrl }        from "../../utils/mediaUrl"
import { showToast }       from "../ui/ToastNotification"

export default function ProductCard({ product }) {
  const { addItem } = useCartStore()
  const cardRef     = useRef(null)
  const glowRef     = useRef(null)

  // primary_image viene del serializer de lista como URL relativa (/media/...)
  // images[0].image viene del serializer de detalle — fallback por si acaso
  const rawImg  = product.primary_image
    || product.images?.find(i => i.is_primary)?.image
    || product.images?.[0]?.image
    || null
  const img     = rawImg ? mediaUrl(rawImg) : null

  const hasDiscount = product.compare_price && Number(product.compare_price) > Number(product.price)
  const discount    = hasDiscount
    ? Math.round((1 - Number(product.price) / Number(product.compare_price)) * 100)
    : 0

  // ── 3D Tilt + Spotlight ──────────────────────────────────
  const handleMouseMove = (e) => {
    const card = cardRef.current
    const glow = glowRef.current
    if (!card) return
    const rect    = card.getBoundingClientRect()
    const x       = e.clientX - rect.left
    const y       = e.clientY - rect.top
    const cx      = rect.width  / 2
    const cy      = rect.height / 2
    const rX      = ((y - cy) / cy) * -6
    const rY      = ((x - cx) / cx) *  6
    card.style.transform  = `perspective(1000px) rotateX(${rX}deg) rotateY(${rY}deg) scale3d(1.02,1.02,1.02)`
    card.style.transition = "transform 50ms linear"
    if (glow) {
      glow.style.opacity    = "1"
      glow.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(26,255,110,0.12), transparent 60%)`
    }
  }
  const handleMouseLeave = () => {
    const card = cardRef.current
    const glow = glowRef.current
    if (!card) return
    card.style.transform  = "perspective(1000px) rotateX(0) rotateY(0) scale3d(1,1,1)"
    card.style.transition = "transform 500ms cubic-bezier(0.16, 1, 0.3, 1)"
    if (glow) glow.style.opacity = "0"
  }

  return (
    <div ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ position:"relative", borderRadius:"var(--r-xl)",
        background:"var(--surface)", border:"1px solid var(--border)",
        overflow:"hidden", willChange:"transform", transformStyle:"preserve-3d" }}>

      {/* Spotlight */}
      <div ref={glowRef} style={{ position:"absolute", inset:0, opacity:0,
        zIndex:1, pointerEvents:"none", transition:"opacity 200ms",
        borderRadius:"inherit" }} />

      {/* Imagen */}
      <Link to={`/shop/${product.slug}`} style={{ display:"block" }}>
        <div style={{ aspectRatio:"1", overflow:"hidden",
          background:"var(--surface-2)", position:"relative" }}>
          {img ? (
            <img src={img} alt={product.name}
              style={{ width:"100%", height:"100%", objectFit:"cover",
                transition:"transform 600ms cubic-bezier(0.16, 1, 0.3, 1)" }}
              onMouseEnter={e => e.target.style.transform = "scale(1.06)"}
              onMouseLeave={e => e.target.style.transform = "scale(1)"}
              onError={e => { e.target.style.display = "none" }} />
          ) : (
            <div style={{ width:"100%", height:"100%", display:"flex",
              alignItems:"center", justifyContent:"center", fontSize:"48px" }}>
              🎧
            </div>
          )}

          {/* Badges */}
          <div style={{ position:"absolute", top:"12px", left:"12px",
            display:"flex", gap:"6px", zIndex:2 }}>
            {hasDiscount && (
              <span style={{ background:"var(--accent)", color:"#000",
                fontSize:"11px", fontWeight:700, padding:"3px 8px",
                borderRadius:"var(--r-full)" }}>
                -{discount}%
              </span>
            )}
            {product.is_featured && (
              <span style={{ background:"rgba(255,255,255,0.1)",
                backdropFilter:"blur(10px)", color:"var(--text)",
                fontSize:"11px", padding:"3px 8px", borderRadius:"var(--r-full)",
                border:"1px solid rgba(255,255,255,0.1)" }}>
                ⭐ Destacado
              </span>
            )}
          </div>

          {/* Sin stock overlay */}
          {product.stock === 0 && (
            <div style={{ position:"absolute", inset:0, zIndex:3,
              background:"rgba(0,0,0,0.6)", backdropFilter:"blur(4px)",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:"13px", fontWeight:500, color:"var(--text-2)",
                background:"var(--surface)", padding:"8px 16px",
                borderRadius:"var(--r-full)", border:"1px solid var(--border)" }}>
                Sin stock
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div style={{ padding:"16px 18px 18px", position:"relative", zIndex:2 }}>
        {product.brand_name && (
          <p style={{ fontSize:"11px", color:"var(--text-3)", textTransform:"uppercase",
            letterSpacing:"0.08em", marginBottom:"6px" }}>
            {product.brand_name}
          </p>
        )}
        <Link to={`/shop/${product.slug}`} style={{ display:"block", marginBottom:"12px" }}>
          <h3 style={{ fontSize:"14px", fontWeight:500, lineHeight:1.4,
            color:"var(--text)", overflow:"hidden", display:"-webkit-box",
            WebkitLineClamp:2, WebkitBoxOrient:"vertical",
            transition:"color var(--dur) var(--ease)" }}
            className="hover-accent">
            {product.name}
          </h3>
        </Link>

        <div style={{ display:"flex", alignItems:"center",
          justifyContent:"space-between", gap:"8px" }}>
          <div>
            <p style={{ fontFamily:"var(--font-serif)", fontSize:"1.3rem",
              color:"var(--text)", lineHeight:1 }}>
              ${Number(product.price).toLocaleString("es-CL")}
            </p>
            {hasDiscount && (
              <p style={{ fontSize:"12px", color:"var(--text-3)",
                textDecoration:"line-through", marginTop:"2px" }}>
                ${Number(product.compare_price).toLocaleString("es-CL")}
              </p>
            )}
          </div>

          <button
            onClick={e => {
              e.preventDefault()
              if (product.stock > 0) {
                addItem(product, 1)
                showToast(`${product.name} agregado al carrito`)
                const btn = e.currentTarget
                btn.style.background  = "var(--accent)"
                btn.style.color       = "#000"
                btn.style.transform   = "scale(1.1)"
                btn.textContent       = "✓"
                setTimeout(() => {
                  btn.style.background  = ""
                  btn.style.color       = ""
                  btn.style.transform   = ""
                  btn.textContent       = "+"
                }, 800)
              }
            }}
            disabled={product.stock === 0}
            style={{ width:"36px", height:"36px", borderRadius:"50%",
              background:"var(--surface-2)", border:"1px solid var(--border)",
              color:"var(--text-2)", fontSize:"20px", fontWeight:300,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor: product.stock > 0 ? "pointer" : "not-allowed",
              transition:"all 300ms cubic-bezier(0.16, 1, 0.3, 1)",
              flexShrink:0, opacity: product.stock === 0 ? 0.4 : 1 }}
            onMouseEnter={e => {
              if (product.stock > 0) {
                e.currentTarget.style.background   = "var(--accent)"
                e.currentTarget.style.color        = "#000"
                e.currentTarget.style.borderColor  = "var(--accent)"
              }
            }}
            onMouseLeave={e => {
              if (e.currentTarget.textContent === "+") {
                e.currentTarget.style.background  = ""
                e.currentTarget.style.color       = ""
                e.currentTarget.style.borderColor = ""
              }
            }}>
            +
          </button>
        </div>
      </div>
    </div>
  )
}
