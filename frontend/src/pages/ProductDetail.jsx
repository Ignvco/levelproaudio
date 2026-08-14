// pages/ProductDetail.jsx
import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ShoppingBag, Minus, Plus, ArrowRight, Gift,
  Truck, ShieldCheck, RotateCcw, MessageCircle, PackageSearch,
} from "lucide-react"
import { getProduct } from "../api/products.api"
import { getProductParticipation } from "../api/rewards.api"
import { useCartStore } from "../store/cartStore"
import { useScrollReveal } from "../hooks/useScrollReveal"
import { mediaUrl } from "../utils/mediaUrl"
import { showToast } from "../components/ui/ToastNotification"
import ProductCard from "../components/product/ProductCard"
import { RichText } from "../components/ui/RichText"
import Seo from "../components/Seo"
import JsonLd from "../components/JsonLd"
import { SITE_URL, absUrl } from "../utils/seo"
import { useSiteSettings } from "../hooks/useSiteSettings"
import { getProductBadge } from "../utils/productBadge"

export default function ProductDetail() {
  const { whatsappUrl } = useSiteSettings()
  const { slug }  = useParams()
  const { addItem } = useCartStore()
  const [qty, setQty]           = useState(1)
  const [activeImg, setActiveImg] = useState(0)

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", slug],
    queryFn:  () => getProduct(slug),
  })

  const { data: rewardCampaigns = [] } = useQuery({
    queryKey: ["reward-participation", slug],
    queryFn:  () => getProductParticipation(slug),
    enabled:  !!slug,
  })

  const infoRef = useScrollReveal({ delay: 100 })

  const pageTop = { paddingTop: "clamp(96px, 12vw, 130px)" }

  if (isLoading) return (
    <div className="lp-container" style={{ ...pageTop, paddingBottom: "80px",
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
    <div style={{ ...pageTop, textAlign: "center", padding: "clamp(120px,16vw,160px) 24px" }}>
      <div style={{ width: "72px", height: "72px", borderRadius: "50%",
        background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)",
        color: "var(--text-3)", display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 20px" }}>
        <PackageSearch size={30} />
      </div>
      <h2 className="display-bold" style={{ fontFamily: "var(--font-display)", fontWeight: 800,
        letterSpacing: "-0.03em", marginBottom: "20px", color: "var(--text)" }}>
        Producto no encontrado
      </h2>
      <Link to="/shop" style={accentPill}>Ir a la tienda {arrowSpan}</Link>
    </div>
  )

  const images      = product.images || []
  const activeImage = images[activeImg]
  const imgUrl      = activeImage ? mediaUrl(activeImage.image) : null
  const hasDiscount = product.compare_price && product.compare_price > product.price
  const discount    = hasDiscount
    ? Math.round((1 - product.price / product.compare_price) * 100) : 0
  const productBadge = getProductBadge(product)

  const handleAddToCart = () => {
    addItem(product, qty)
    showToast(`${product.name} agregado al carrito`)
  }

  const productUrl = `${SITE_URL}/shop/${product.slug}`
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(imgUrl ? { image: [absUrl(imgUrl)] } : {}),
    ...(product.description || product.short_description
      ? { description: (product.short_description || product.description).replace(/<[^>]+>/g, "").slice(0, 300) }
      : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand.name } } : {}),
    ...(product.category ? { category: product.category.name } : {}),
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "CLP",
      price: Number(product.price),
      availability: product.stock > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  }
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Tienda", item: `${SITE_URL}/shop` },
      ...(product.category
        ? [{ "@type": "ListItem", position: 3, name: product.category.name, item: `${SITE_URL}/shop?category=${product.category.slug}` }]
        : []),
      { "@type": "ListItem", position: product.category ? 4 : 3, name: product.name, item: productUrl },
    ],
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", ...pageTop }}>
      <Seo type="product" title={product.name}
        description={product.short_description || product.description?.slice(0, 160)}
        image={imgUrl} />
      <JsonLd data={productSchema} />
      <JsonLd data={breadcrumbSchema} />

      {/* Breadcrumb */}
      <div className="lp-container" style={{ paddingTop: "20px",
        display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap",
        fontSize: "13px", color: "var(--text-3)" }}>
        <Link to="/" className="hover-accent" style={{ transition: "color var(--dur)" }}>Inicio</Link>
        <span>/</span>
        <Link to="/shop" className="hover-accent" style={{ transition: "color var(--dur)" }}>Tienda</Link>
        {product.category && <>
          <span>/</span>
          <Link to={`/shop?category=${product.category.slug}`} className="hover-accent"
            style={{ transition: "color var(--dur)" }}>{product.category.name}</Link>
        </>}
        <span>/</span>
        <span style={{ color: "var(--text-2)" }}>{product.name}</span>
      </div>

      {/* Grid principal */}
      <div className="lp-container product-detail-grid" style={{
        paddingTop: "clamp(28px, 4vw, 48px)", paddingBottom: "clamp(60px, 8vw, 100px)",
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(32px, 5vw, 72px)",
        alignItems: "start" }}>

        {/* Imágenes */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px",
          position: "sticky", top: "100px" }} className="pd-images">
          <div style={{ aspectRatio: "1", borderRadius: "var(--r-2xl)", overflow: "hidden",
            background: "#121212", border: "1px solid rgba(255,255,255,0.06)" }}>
            {imgUrl ? (
              <img src={imgUrl} alt={product.name} style={{ width: "100%", height: "100%",
                objectFit: "cover", transition: "transform 600ms cubic-bezier(0.16,1,0.3,1)" }}
                onMouseEnter={e => e.target.style.transform = "scale(1.04)"}
                onMouseLeave={e => e.target.style.transform = "scale(1)"} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex",
                alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.35)" }}>
                <ShoppingBag size={72} />
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div style={{ display: "flex", gap: "10px", overflowX: "auto" }}>
              {images.map((img, i) => (
                <button key={img.id} onClick={() => setActiveImg(i)}
                  style={{ width: "72px", height: "72px", borderRadius: "14px", overflow: "hidden",
                    flexShrink: 0, padding: 0, cursor: "pointer", background: "#1a1a1a",
                    border: `2px solid ${activeImg === i ? "var(--accent)" : "rgba(255,255,255,0.1)"}`,
                    transition: "border-color var(--dur) var(--ease)" }}>
                  <img src={mediaUrl(img.image)} alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div ref={infoRef} style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          {/* Marca */}
          {product.brand && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {product.brand.logo && (
                <img src={mediaUrl(product.brand.logo)} alt={product.brand.name}
                  style={{ height: "20px", width: "auto", objectFit: "contain",
                    filter: "brightness(0) invert(1)", opacity: 0.7 }} />
              )}
              <span style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.15em" }}>
                {product.brand.name}
              </span>
            </div>
          )}

          {/* Badge (descuento / últimas unidades / etiqueta curada / etc.) */}
          {productBadge && (
            <span style={{ display: "inline-flex", alignSelf: "flex-start",
              fontSize: "12px", fontWeight: 700,
              color: productBadge.tone === "urgent" ? "#D97706" : "var(--accent)",
              background: productBadge.tone === "urgent" ? "rgba(217,119,6,0.1)" : "rgba(26,255,110,0.1)",
              border: `1px solid ${productBadge.tone === "urgent" ? "rgba(217,119,6,0.3)" : "rgba(26,255,110,0.3)"}`,
              padding: "5px 12px", borderRadius: "9999px" }}>
              {productBadge.label}
            </span>
          )}

          {/* Nombre */}
          <h1 className="display-bold" style={{ fontFamily: "var(--font-display)",
            fontSize: "clamp(1.9rem, 3.5vw, 3rem)", fontWeight: 800, lineHeight: 1.05,
            letterSpacing: "-0.03em", color: "var(--text)" }}>
            {product.name}
          </h1>

          {product.short_description && (
            <p style={{ fontSize: "16px", color: "var(--text-2)", lineHeight: 1.7, maxWidth: "60ch" }}>
              {product.short_description}
            </p>
          )}

          {/* Precio */}
          <div style={{ padding: "20px 24px", background: "#121212",
            borderRadius: "var(--r-xl)", border: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                <p data-testid="product-detail-price" style={{ fontFamily: "var(--font-display)",
                  fontSize: "2.4rem", fontWeight: 800, letterSpacing: "-0.03em",
                  color: "var(--text)", lineHeight: 1 }}>
                  ${Number(product.price).toLocaleString("es-CL")}
                </p>
                {hasDiscount && (
                  <p style={{ fontSize: "16px", color: "var(--text-3)", textDecoration: "line-through" }}>
                    ${Number(product.compare_price).toLocaleString("es-CL")}
                  </p>
                )}
              </div>
              {hasDiscount && (
                <span style={{ display: "inline-block", marginTop: "8px",
                  background: "var(--accent)", color: "#000", fontSize: "12px", fontWeight: 800,
                  padding: "3px 12px", borderRadius: "var(--r-full)" }}>
                  -{discount}% OFF
                </span>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "12px", fontWeight: 700,
                color: product.stock > 5 ? "var(--accent)" : product.stock > 0 ? "var(--warning)" : "var(--danger)" }}>
                {product.product_type === "bundle"
                  ? (product.in_stock ? "Disponible" : "Sin stock")
                  : product.stock > 0
                  ? (product.stock <= 5 ? `¡Solo ${product.stock} disponibles!` : "En stock")
                  : product.product_type === "preorder" ? "Preventa"
                  : product.product_type === "on_demand" ? "A pedido"
                  : "Sin stock"}
              </p>
              {product.sku && (
                <p style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "4px" }}>
                  SKU: {product.sku}
                </p>
              )}
            </div>
          </div>

          {/* Este kit incluye — componentes del bundle */}
          {product.product_type === "bundle" && product.bundle_items?.length > 0 && (
            <div style={{ padding: "18px 20px", background: "rgba(26,255,110,0.04)",
              border: "1px solid rgba(26,255,110,0.2)", borderRadius: "var(--r-xl)" }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--accent)",
                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>
                Este kit incluye
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {product.bundle_items.map((bi, idx) => (
                  <Link key={idx} to={`/shop/${bi.product.slug}`}
                    style={{ display: "flex", alignItems: "center", gap: "12px",
                      textDecoration: "none", color: "var(--text)" }}>
                    <span style={{ minWidth: "28px", height: "28px", borderRadius: "8px",
                      background: "var(--surface-3)", display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: "13px", fontWeight: 700,
                      color: "var(--accent)" }}>
                      {bi.quantity}×
                    </span>
                    <span style={{ fontSize: "14px" }}>{bi.product.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Cantidad + Agregar */}
          {(product.stock > 0 || product.product_type !== "stock") && (
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: "var(--r-full)",
                overflow: "hidden", flexShrink: 0 }}>
                <button data-testid="pd-qty-minus" onClick={() => setQty(q => Math.max(1, q - 1))}
                  style={qtyBtn}><Minus size={16} strokeWidth={2.5} /></button>
                <span style={{ minWidth: "36px", textAlign: "center", fontSize: "15px",
                  fontWeight: 700, color: "var(--text)" }}>{qty}</span>
                <button data-testid="pd-qty-plus"
                  onClick={() => setQty(q => Math.min(product.product_type === "stock" ? product.stock : 99, q + 1))}
                  style={qtyBtn}><Plus size={16} strokeWidth={2.5} /></button>
              </div>
              <button data-testid="pd-add-to-cart" onClick={handleAddToCart} style={{ ...accentPill, flex: 1,
                justifyContent: "center", padding: "14px 14px 14px 24px", fontSize: "15px" }}>
                {product.stock > 0 ? "Agregar al carrito"
                  : product.product_type === "preorder" ? "Reservar (preventa)"
                  : "Pedir"} {arrowSpan}
              </button>
            </div>
          )}

          {product.stock === 0 && product.product_type === "stock" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button disabled style={{ display: "inline-flex", justifyContent: "center",
                padding: "15px", borderRadius: "var(--r-full)", background: "rgba(255,255,255,0.04)",
                color: "var(--text-3)", border: "1px solid var(--border)", fontSize: "14px",
                fontWeight: 600, opacity: 0.6, cursor: "not-allowed" }}>
                Sin stock disponible
              </button>
              <Link to="/bajo-pedido"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  padding: "14px", borderRadius: "var(--r-full)", background: "var(--accent)",
                  color: "#000", textDecoration: "none", fontSize: "14px", fontWeight: 700 }}>
                Pedilo bajo pedido <ArrowRight size={16} />
              </Link>
            </div>
          )}

          {/* ¿No sabés si es para vos? — asesoría directa por WhatsApp */}
          <a href={`${whatsappUrl}?text=${encodeURIComponent(`Hola! Quería consultar sobre ${product.name}`)}`}
            target="_blank" rel="noreferrer"
            style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px",
              borderRadius: "var(--r-xl)", background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border)", textDecoration: "none",
              transition: "border-color 200ms var(--ease), background 200ms var(--ease)" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "rgba(26,255,110,0.05)" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)" }}>
            <span style={{ width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
              background: "rgba(26,255,110,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageCircle size={17} color="var(--accent)" />
            </span>
            <span>
              <span style={{ display: "block", fontSize: "13.5px", fontWeight: 700, color: "var(--text)" }}>
                ¿No sabés si es para vos?
              </span>
              <span style={{ display: "block", fontSize: "12px", color: "var(--text-3)" }}>
                Hablá con un especialista LevelPro
              </span>
            </span>
          </a>

          {/* Descripción completa */}
          {product.description && (
            <div style={{ paddingTop: "22px", borderTop: "1px solid var(--border)" }}>
              <p style={eyebrowSt}>· Descripción</p>
              <RichText text={product.description} style={{ marginTop: "16px" }} />
            </div>
          )}

          {/* Rewards */}
          {rewardCampaigns.length > 0 && (
            <div data-testid="reward-participation-block" style={{ padding: "18px 20px",
              background: "rgba(26,255,110,0.06)", border: "1px solid rgba(26,255,110,0.25)",
              borderRadius: "var(--r-xl)", display: "flex", flexDirection: "column", gap: "12px" }}>
              <p style={{ display: "inline-flex", alignItems: "center", gap: "8px",
                fontSize: "11px", fontWeight: 700, color: "var(--accent)",
                letterSpacing: "0.15em", textTransform: "uppercase" }}>
                <Gift size={14} /> LevelPro Rewards
              </p>
              {rewardCampaigns.map(c => (
                <div key={c.campaign_id} style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", gap: "12px", paddingTop: "12px",
                  borderTop: "1px solid rgba(26,255,110,0.12)" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)", marginBottom: "3px" }}>
                      Obtenés <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                        {c.entries_per_purchase} participaciones</span>
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                      Sorteo del {new Date(c.draw_date).toLocaleDateString("es-CL",
                        { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <Link to="/rewards" style={{ display: "inline-flex", alignItems: "center", gap: "5px",
                    fontSize: "12px", color: "var(--accent)", whiteSpace: "nowrap", textDecoration: "none",
                    padding: "7px 12px", borderRadius: "var(--r-full)", background: "rgba(26,255,110,0.1)",
                    border: "1px solid rgba(26,255,110,0.2)", fontWeight: 600 }}>
                    Ver campaña <ArrowRight size={12} />
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* Features */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", paddingTop: "4px" }}>
            {[
              { Icon: Truck, text: "Envío a Chile y Argentina" },
              { Icon: ShieldCheck, text: "Compra 100% segura" },
              { Icon: RotateCcw, text: "Cambios y devoluciones" },
              { Icon: MessageCircle, text: "Soporte por WhatsApp" },
            ].map(({ Icon, text }) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: "10px",
                fontSize: "13px", color: "var(--text-2)", padding: "12px 14px",
                background: "#121212", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ color: "var(--accent)", display: "flex", flexShrink: 0 }}><Icon size={16} /></span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Completá tu setup — accesorios/complementarios elegidos a mano en el admin */}
      {product.related_products?.length > 0 && (
        <div className="lp-container" style={{ paddingBottom: "clamp(60px, 8vw, 100px)" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)",
            textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "18px" }}>
            Completá tu setup
          </p>
          <div style={{ display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "20px" }}>
            {product.related_products.map(rp => (
              <ProductCard key={rp.id} product={rp} />
            ))}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .product-detail-grid { grid-template-columns: 1fr !important; }
          .pd-images { position: static !important; }
        }
      `}</style>
    </div>
  )
}

// ── estilos compartidos ──
const qtyBtn = { width: "44px", height: "48px", background: "none", border: "none",
  color: "var(--text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }
const eyebrowSt = { fontSize: "11px", fontWeight: 700, color: "var(--accent)",
  textTransform: "uppercase", letterSpacing: "0.15em" }
const accentPill = { display: "inline-flex", alignItems: "center", gap: "10px",
  padding: "14px 14px 14px 24px", borderRadius: "var(--r-full)", background: "var(--accent)",
  color: "#000", fontSize: "14px", fontWeight: 700, textDecoration: "none", border: "none",
  cursor: "pointer", boxShadow: "0 8px 30px rgba(26,255,110,0.3)" }
const arrowSpan = (
  <span style={{ width: "26px", height: "26px", borderRadius: "50%", background: "#000",
    color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <ArrowRight size={14} />
  </span>
)
