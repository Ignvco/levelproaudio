// pages/ProductDetail.jsx
import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getProduct } from "../api/products.api"
import { useCartStore } from "../store/cartStore"
import { useScrollReveal } from "../hooks/useScrollReveal"
import { mediaUrl } from "../utils/mediaUrl"
import { showToast } from "../components/ui/ToastNotification"

export default function ProductDetail() {
  const { slug }  = useParams()
  const { addItem } = useCartStore()
  const [qty, setQty]           = useState(1)
  const [activeImg, setActiveImg] = useState(0)

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", slug],
    queryFn:  () => getProduct(slug),
  })

  const infoRef = useScrollReveal({ delay: 100 })

  if (isLoading) return (
    <div style={{ maxWidth: "var(--container)", margin: "0 auto",
      padding: "clamp(48px, 6vw, 80px) clamp(20px, 5vw, 60px)",
      display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px" }}>
      <div className="skeleton" style={{ aspectRatio: "1", borderRadius: "var(--r-2xl)" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: i === 0 ? "60px" : "24px" }} />
        ))}
      </div>
    </div>
  )

  if (isError || !product) return (
    <div style={{ textAlign: "center", padding: "120px 24px" }}>
      <p style={{ fontSize: "48px", marginBottom: "16px" }}>😕</p>
      <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 300, marginBottom: "16px" }}>
        Producto no encontrado
      </h2>
      <Link to="/shop" className="btn btn-accent">Ir a la tienda</Link>
    </div>
  )

  const images      = product.images || []
  const activeImage = images[activeImg]
  const imgUrl      = activeImage ? mediaUrl(activeImage.image) : null
  const hasDiscount = product.compare_price && product.compare_price > product.price
  const discount    = hasDiscount
    ? Math.round((1 - product.price / product.compare_price) * 100) : 0

  const handleAddToCart = () => {
    addItem(product, qty)
    showToast(`${product.name} agregado al carrito`)
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>

      {/* Breadcrumb */}
      <div style={{
        maxWidth: "var(--container)", margin: "0 auto",
        padding: "24px clamp(20px, 5vw, 60px) 0",
        display: "flex", gap: "8px", alignItems: "center",
        fontSize: "13px", color: "var(--text-3)",
      }}>
        <Link to="/" style={{ transition: "color var(--dur)" }} className="hover-accent">Inicio</Link>
        <span>/</span>
        <Link to="/shop" style={{ transition: "color var(--dur)" }} className="hover-accent">Tienda</Link>
        {product.category && <>
          <span>/</span>
          <Link to={`/shop?category=${product.category.slug}`}
            style={{ transition: "color var(--dur)" }} className="hover-accent">
            {product.category.name}
          </Link>
        </>}
        <span>/</span>
        <span style={{ color: "var(--text-2)" }}>{product.name}</span>
      </div>

      {/* Grid principal */}
      <div style={{
        maxWidth: "var(--container)", margin: "0 auto",
        padding: "clamp(32px, 4vw, 60px) clamp(20px, 5vw, 60px)",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "clamp(40px, 6vw, 80px)",
        alignItems: "start",
      }}
        className="product-detail-grid"
      >

        {/* Imágenes */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px",
          position: "sticky", top: "88px" }}>

          {/* Imagen principal */}
          <div style={{
            aspectRatio:  "1",
            borderRadius: "var(--r-2xl)",
            overflow:     "hidden",
            background:   "var(--surface)",
            border:       "1px solid var(--border)",
          }}>
            {imgUrl ? (
              <img src={imgUrl} alt={product.name} style={{
                width: "100%", height: "100%", objectFit: "cover",
                transition: "transform 600ms cubic-bezier(0.16, 1, 0.3, 1)",
              }}
                onMouseEnter={e => e.target.style.transform = "scale(1.04)"}
                onMouseLeave={e => e.target.style.transform = "scale(1)"}
              />
            ) : (
              <div style={{ width: "100%", height: "100%",
                display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: "80px" }}>
                🎧
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div style={{ display: "flex", gap: "10px", overflowX: "auto" }}>
              {images.map((img, i) => (
                <button key={img.id}
                  onClick={() => setActiveImg(i)}
                  style={{
                    width:        "72px",
                    height:       "72px",
                    borderRadius: "var(--r-md)",
                    overflow:     "hidden",
                    flexShrink:   0,
                    border:       `2px solid ${activeImg === i ? "var(--accent)" : "var(--border)"}`,
                    padding:      0,
                    cursor:       "pointer",
                    transition:   "border-color var(--dur) var(--ease)",
                  }}>
                  <img src={mediaUrl(img.image)} alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div ref={infoRef} style={{
          display: "flex", flexDirection: "column", gap: "24px",
        }}>
          {/* Marca */}
          {product.brand && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {product.brand.logo && (
                <img src={mediaUrl(product.brand.logo)} alt={product.brand.name}
                  style={{ height: "20px", width: "auto",
                    filter: "brightness(0) invert(0.7)" }} />
              )}
              <span style={{ fontSize: "12px", color: "var(--text-3)",
                textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {product.brand.name}
              </span>
            </div>
          )}

          {/* Nombre */}
          <h1 style={{
            fontFamily:   "var(--font-serif)",
            fontSize:     "clamp(1.8rem, 3.5vw, 3rem)",
            fontWeight:   300,
            lineHeight:   1.1,
            letterSpacing:"-0.02em",
          }}>
            {product.name}
          </h1>

          {/* Descripción corta */}
          {product.short_description && (
            <p style={{ fontSize: "16px", color: "var(--text-2)", lineHeight: 1.7 }}>
              {product.short_description}
            </p>
          )}

          {/* Precio */}
          <div style={{
            padding:      "20px 24px",
            background:   "var(--surface)",
            borderRadius: "var(--r-xl)",
            border:       "1px solid var(--border)",
            display:      "flex",
            alignItems:   "center",
            justifyContent: "space-between",
            gap:          "16px",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                <p style={{
                  fontFamily:  "var(--font-serif)",
                  fontSize:    "2.4rem",
                  color:       "var(--text)",
                  lineHeight:  1,
                }}>
                  ${Number(product.price).toLocaleString("es-CL")}
                </p>
                {hasDiscount && (
                  <p style={{ fontSize: "16px", color: "var(--text-3)",
                    textDecoration: "line-through" }}>
                    ${Number(product.compare_price).toLocaleString("es-CL")}
                  </p>
                )}
              </div>
              {hasDiscount && (
                <span style={{
                  display: "inline-block", marginTop: "6px",
                  background: "var(--accent)", color: "#000",
                  fontSize: "12px", fontWeight: 700,
                  padding: "2px 10px", borderRadius: "var(--r-full)",
                }}>
                  -{discount}% OFF
                </span>
              )}
            </div>

            {/* Stock */}
            <div style={{ textAlign: "right" }}>
              <p style={{
                fontSize:   "12px",
                color:      product.stock > 5 ? "var(--accent)"
                          : product.stock > 0 ? "var(--warning)"
                          : "var(--danger)",
                fontWeight: 500,
              }}>
                {product.stock === 0 ? "Sin stock"
                  : product.stock <= 5 ? `¡Solo ${product.stock} disponibles!`
                  : "En stock"}
              </p>
              {product.sku && (
                <p style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "4px" }}>
                  SKU: {product.sku}
                </p>
              )}
            </div>
          </div>

          {/* Cantidad + Agregar */}
          {product.stock > 0 && (
            <div style={{ display: "flex", gap: "12px" }}>
              {/* Selector cantidad */}
              <div style={{
                display:      "flex",
                alignItems:   "center",
                background:   "var(--surface)",
                border:       "1px solid var(--border)",
                borderRadius: "var(--r-full)",
                overflow:     "hidden",
                flexShrink:   0,
              }}>
                <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{
                  width: "44px", height: "48px",
                  background: "none", border: "none",
                  color: "var(--text-2)", fontSize: "18px",
                  cursor: "pointer", transition: "color var(--dur)",
                }}>−</button>
                <span style={{ width: "36px", textAlign: "center",
                  fontSize: "15px", fontWeight: 500 }}>
                  {qty}
                </span>
                <button onClick={() => setQty(q => Math.min(product.stock, q + 1))} style={{
                  width: "44px", height: "48px",
                  background: "none", border: "none",
                  color: "var(--text-2)", fontSize: "18px",
                  cursor: "pointer", transition: "color var(--dur)",
                }}>+</button>
              </div>

              {/* Botón agregar */}
              <button onClick={handleAddToCart} className="btn btn-accent"
                style={{ flex: 1, justifyContent: "center", fontSize: "15px",
                  padding: "14px", borderRadius: "var(--r-full)" }}>
                Agregar al carrito
              </button>
            </div>
          )}

          {product.stock === 0 && (
            <button disabled className="btn btn-ghost"
              style={{ justifyContent: "center", opacity: 0.5, cursor: "not-allowed" }}>
              Sin stock disponible
            </button>
          )}

          {/* Descripción completa */}
          {product.description && (
            <div style={{
              paddingTop:  "24px",
              borderTop:   "1px solid var(--border)",
            }}>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-3)",
                textTransform: "uppercase", letterSpacing: "0.08em",
                marginBottom: "14px" }}>
                Descripción
              </p>
              <p style={{ fontSize: "15px", color: "var(--text-2)",
                lineHeight: 1.8 }}>
                {product.description}
              </p>
            </div>
          )}

          {/* Features rápidos */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: "10px", paddingTop: "8px",
          }}>
            {[
              { icon: "🚚", text: "Envío a Chile y Argentina" },
              { icon: "🔒", text: "Compra 100% segura"       },
              { icon: "↩️", text: "Cambios y devoluciones"   },
              { icon: "💬", text: "Soporte por WhatsApp"      },
            ].map(({ icon, text }) => (
              <div key={text} style={{
                display:    "flex",
                alignItems: "center",
                gap:        "8px",
                fontSize:   "13px",
                color:      "var(--text-3)",
                padding:    "10px 12px",
                background: "var(--surface)",
                borderRadius: "var(--r-md)",
                border:     "1px solid var(--border)",
              }}>
                <span>{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .product-detail-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}