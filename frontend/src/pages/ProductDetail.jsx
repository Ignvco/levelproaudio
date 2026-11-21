// pages/ProductDetail.jsx
import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ShoppingBag, Minus, Plus, ArrowRight, Gift,
  Truck, ShieldCheck, RotateCcw, MessageCircle, PackageSearch,
  Scale, SlidersHorizontal,
} from "lucide-react"
import { getProduct } from "../api/products.api"
import { getProductParticipation } from "../api/rewards.api"
import { useCartStore } from "../store/cartStore"
import { useCompareStore } from "../store/compareStore"
import { useScrollReveal } from "../hooks/useScrollReveal"
import { mediaUrl } from "../utils/mediaUrl"
import { showToast } from "../utils/toast"
import { resolveEffectiveSpecs } from "../utils/variantSpecs"
import { RichText } from "../components/ui/RichText"
import Seo from "../components/Seo"
import Button from "../components/ui/Button"
import JsonLd from "../components/JsonLd"
import { SITE_URL, absUrl } from "../utils/seo"
import { useSiteSettings } from "../hooks/useSiteSettings"
import { usePrice } from "../hooks/usePrice"
import { getProductBadge } from "../utils/productBadge"

export default function ProductDetail() {
  const { whatsappUrl } = useSiteSettings()
  const { price, secondaryPrice } = usePrice()
  const { slug }  = useParams()
  const { addItem } = useCartStore()
  const { items: compareItems, toggleItem: toggleCompare, openModal: openCompare } = useCompareStore()
  const [qty, setQty]           = useState(1)
  const [activeImg, setActiveImg] = useState(0)
  const [selectedVariantId, setSelectedVariantId] = useState(null)

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", slug],
    queryFn:  () => getProduct(slug),
  })

  useEffect(() => {
    const vars = product?.variants || []
    if (!vars.length) {
      setSelectedVariantId(null)
      return
    }
    const def = vars.find(v => v.is_default && v.in_stock) || vars.find(v => v.in_stock) || vars[0]
    setSelectedVariantId(def?.id || null)
    setQty(1)
  }, [product])

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
      <Button to="/shop" variant="green" size="md" arrow>Ir a la tienda</Button>
    </div>
  )

  const variants        = product.variants || []
  const selectedVariant = variants.find(v => v.id === selectedVariantId) || null
  const activeSource    = selectedVariant || product

  const images      = product.images || []
  const activeImage = images[activeImg]
  const imgUrl      = selectedVariant?.image_url
    ? mediaUrl(selectedVariant.image_url)
    : (activeImage ? mediaUrl(activeImage.image) : null)

  const effectivePrice = Number(activeSource.price)
  const effectiveCompare = activeSource.compare_price ? Number(activeSource.compare_price) : null
  const hasDiscount = effectiveCompare && effectiveCompare > effectivePrice
  const discount    = hasDiscount
    ? Math.round((1 - effectivePrice / effectiveCompare) * 100) : 0
  const activeStock = selectedVariant ? selectedVariant.stock : product.stock
  const activeSku   = selectedVariant ? selectedVariant.sku : product.sku
  const activeInStock = selectedVariant ? selectedVariant.in_stock : product.in_stock
  const productBadge = getProductBadge(product)
  const isCompared = compareItems.some(i => i.id === product.id)

  const handleAddToCart = () => {
    addItem(product, qty, selectedVariant)
    showToast(`${product.name}${selectedVariant ? ` (${selectedVariant.name})` : ""} agregado al carrito`)
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
    ...(activeSku ? { sku: activeSku } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand.name } } : {}),
    ...(product.category ? { category: product.category.name } : {}),
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "CLP",
      price: effectivePrice,
      availability: activeInStock
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
      <Seo type="product" title={product.seo_title || product.name}
        description={product.seo_description || product.short_description || product.description?.replace(/<[^>]+>/g, "").slice(0, 160)}
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
              <img fetchPriority="high" decoding="async" src={imgUrl} alt={product.name} style={{ width: "100%", height: "100%",
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
                  <img loading="lazy" decoding="async" src={mediaUrl(img.image)} alt=""
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
                  {price(activeSource)}
                </p>
                {hasDiscount && (
                  <p style={{ fontSize: "16px", color: "var(--text-3)", textDecoration: "line-through" }}>
                    ${effectiveCompare.toLocaleString("es-CL")}
                  </p>
                )}
              </div>
              {secondaryPrice(activeSource) && (
                <p style={{ fontSize: "14px", color: "var(--text-3)", marginTop: "6px" }}>
                  ≈ {secondaryPrice(activeSource)} <span style={{ fontSize: "12px" }}>(referencial)</span>
                </p>
              )}
              {hasDiscount && (
                <span style={{ display: "inline-block", marginTop: "8px",
                  background: "var(--accent)", color: "#000", fontSize: "12px", fontWeight: 800,
                  padding: "3px 12px", borderRadius: "var(--r-full)" }}>
                  -{discount}% OFF
                </span>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <p data-testid="product-detail-stock" style={{ fontSize: "12px", fontWeight: 700,
                color: activeStock > 5 ? "var(--accent)" : activeStock > 0 ? "var(--warning)" : "var(--danger)" }}>
                {product.product_type === "bundle"
                  ? (product.in_stock ? "Disponible" : "Sin stock")
                  : activeStock > 0
                  ? (activeStock <= 5 ? `¡Solo ${activeStock} disponibles!` : "En stock")
                  : product.product_type === "preorder" ? "Preventa"
                  : product.product_type === "on_demand" ? "A pedido"
                  : "Sin stock"}
              </p>
              {activeSku && (
                <p data-testid="product-detail-sku" style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
                  SKU: {activeSku}
                </p>
              )}
            </div>
          </div>

          {/* Selector de Variantes (BF-14) */}
          {variants.length > 0 && (
            <div data-testid="variant-selector" style={{ padding: "18px 20px", background: "#121212",
              borderRadius: "var(--r-xl)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)",
                  textTransform: "uppercase", letterSpacing: "0.14em" }}>
                  Configuración / Variante
                </p>
                {selectedVariant && (
                  <span style={{ fontSize: "12px", color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
                    {selectedVariant.name}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {variants.map(v => {
                  const isSelected = v.id === selectedVariant?.id
                  const attrTags = Object.values(v.attributes || {}).filter(Boolean)
                  return (
                    <button
                      key={v.id}
                      type="button"
                      data-testid={`variant-option-${v.sku}`}
                      onClick={() => { setSelectedVariantId(v.id); setQty(1) }}
                      style={{
                        padding: "10px 14px",
                        borderRadius: "12px",
                        cursor: "pointer",
                        textAlign: "left",
                        background: isSelected ? "rgba(26,255,110,0.12)" : "rgba(255,255,255,0.03)",
                        border: isSelected ? "1.5px solid var(--accent)" : "1px solid rgba(255,255,255,0.1)",
                        color: "#fff",
                        opacity: v.in_stock ? 1 : 0.55,
                        transition: "all 180ms ease",
                      }}
                    >
                      <span style={{ display: "block", fontSize: "13px", fontWeight: 700, color: isSelected ? "var(--accent)" : "#fff" }}>
                        {v.name}
                      </span>
                      <span style={{ display: "block", fontSize: "11px", color: "var(--text-3)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                        {price(v)}{attrTags.length > 0 ? ` · ${attrTags.join(" / ")}` : ""} · {v.in_stock ? `${v.stock} u.` : "Agotado"}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

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
          {(activeStock > 0 || product.product_type !== "stock") && (
            <div className="pd-purchase-actions" style={{ display: "flex", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: "var(--r-full)",
                overflow: "hidden", flexShrink: 0 }}>
                <button data-testid="pd-qty-minus" onClick={() => setQty(q => Math.max(1, q - 1))}
                  style={qtyBtn}><Minus size={16} strokeWidth={2.5} /></button>
                <span style={{ minWidth: "36px", textAlign: "center", fontSize: "15px",
                  fontWeight: 700, color: "var(--text)" }}>{qty}</span>
                <button data-testid="pd-qty-plus"
                  onClick={() => setQty(q => Math.min(product.product_type === "stock" ? Math.max(1, activeStock) : 99, q + 1))}
                  style={qtyBtn}><Plus size={16} strokeWidth={2.5} /></button>
              </div>
              <Button testId="pd-add-to-cart" onClick={handleAddToCart}
                variant="green" size="md" arrow
                style={{ flex: 1, justifyContent: "space-between" }}>
                {activeStock > 0 ? "Agregar al carrito"
                  : product.product_type === "preorder" ? "Reservar (preventa)"
                  : "Pedir"}
              </Button>
            </div>
          )}

          {activeStock === 0 && product.product_type === "stock" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button disabled style={{ display: "inline-flex", justifyContent: "center",
                padding: "15px", borderRadius: "var(--r-full)", background: "rgba(255,255,255,0.04)",
                color: "var(--text-3)", border: "1px solid var(--border)", fontSize: "14px",
                fontWeight: 600, opacity: 0.6, cursor: "not-allowed" }}>
                Sin stock disponible
              </button>
              <Button to="/bajo-pedido" variant="green" size="md" arrow
                style={{ width: "100%", justifyContent: "space-between" }}>
                Pedilo bajo pedido
              </Button>
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

          {/* Especificaciones Técnicas Profesionales (BF-44) */}
          {(() => {
            const effectiveSpecs = resolveEffectiveSpecs(product.technical_specs, selectedVariant)
            if (effectiveSpecs.length === 0) return null
            return (
            <div data-testid="product-technical-specs" style={{ paddingTop: "22px", borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "14px" }}>
                <p style={{ ...eyebrowSt, display: "inline-flex", alignItems: "center", gap: "8px" }}>
                  <SlidersHorizontal size={13} /> Especificaciones Técnicas
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const res = toggleCompare(product)
                    if (res.limitReached) {
                      showToast("Máximo 4 equipos en el comparador.", "error")
                    } else if (res.added) {
                      showToast(`${product.name} agregado al comparador`)
                    }
                    if (compareItems.length >= 1 && res.added) {
                      openCompare()
                    }
                  }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    padding: "6px 12px", borderRadius: "999px", cursor: "pointer",
                    fontSize: "11px", fontWeight: 700,
                    background: isCompared ? "rgba(26,255,110,0.14)" : "rgba(255,255,255,0.05)",
                    color: isCompared ? "var(--accent)" : "var(--text-2)",
                    border: `1px solid ${isCompared ? "rgba(26,255,110,0.35)" : "rgba(255,255,255,0.1)"}`,
                  }}
                >
                  <Scale size={12} /> {isCompared ? "En comparador" : "Comparar equipo"}
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                {effectiveSpecs.map(spec => (
                  <div key={spec.id || spec.key} data-testid={`spec-item-${spec.key}`} style={{
                    padding: "12px 14px", borderRadius: "14px",
                    background: "#121212", border: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <p style={{ fontSize: "11px", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
                      {spec.label}
                    </p>
                    <p style={{ fontSize: "13.5px", fontWeight: 700, color: "#fff", fontFamily: "var(--font-mono)" }}>
                      {spec.display_value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            )
          })()}

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
          .product-detail-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .product-detail-grid > * { min-width: 0; }
          .pd-images { position: static !important; }
        }
        @media (max-width: 420px) {
          .pd-purchase-actions { flex-wrap: wrap; }
          .pd-purchase-actions > .lp-btn { flex: 1 1 100% !important; min-width: 0; }
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
