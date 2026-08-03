// pages/Cart.jsx — Carrito estilo editorial premium
import { Link, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ShoppingBag, Minus, Plus, Trash2, ArrowRight, ArrowLeft,
  Gift, Star, Clock, X,
} from "lucide-react"
import { useCartStore } from "../store/cartStore"
import { useAuthStore } from "../store/authStore"
import { getOrders } from "../api/orders.api"
import { previewCartEntries } from "../api/rewards.api"
import { getMyLoyalty } from "../api/loyalty.api"
import { mediaUrl } from "../utils/mediaUrl"
import Seo from "../components/Seo"

// ─────────────────────────────────────────────────────────────
// Eyebrow reutilizable
// ─────────────────────────────────────────────────────────────
function Eyebrow({ children, color = "var(--accent)" }) {
  return (
    <p style={{
      fontFamily: "var(--font-sans)", fontSize: "11px",
      color, textTransform: "uppercase",
      letterSpacing: "0.15em", fontWeight: 700,
    }}>
      {children}
    </p>
  )
}

// ─────────────────────────────────────────────────────────────
// CTA principal (pill accent con flecha) reutilizable
// ─────────────────────────────────────────────────────────────
function AccentCTA({ children, testid, onClick, to, full = false }) {
  const style = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: "10px",
    padding: "14px 14px 14px 24px", borderRadius: "var(--r-full)",
    background: "var(--accent)", color: "#000",
    fontSize: "14px", fontWeight: 700, textDecoration: "none",
    fontFamily: "var(--font-sans)", border: "none", cursor: "pointer",
    width: full ? "100%" : "auto",
    boxShadow: "0 8px 30px rgba(26,255,110,0.3)",
    transition: "transform 200ms var(--ease)",
  }
  const onEnter = e => { e.currentTarget.style.transform = "translateY(-2px)" }
  const onLeave = e => { e.currentTarget.style.transform = "translateY(0)" }
  const arrow = (
    <span style={{ width: "26px", height: "26px", borderRadius: "50%",
      background: "#000", color: "var(--accent)", display: "flex",
      alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <ArrowRight size={14} />
    </span>
  )
  if (to) {
    return (
      <Link to={to} data-testid={testid} style={style}
        onMouseEnter={onEnter} onMouseLeave={onLeave}>
        {children}{arrow}
      </Link>
    )
  }
  return (
    <button data-testid={testid} onClick={onClick} style={style}
      onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}{arrow}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Item del carrito — card oscura estilo premium
// ─────────────────────────────────────────────────────────────
function CartItem({ item }) {
  const { updateQuantity, removeItem } = useCartStore()
  const { product, quantity }          = item

  const primaryImg = product.images?.find(i => i.is_primary) || product.images?.[0]
  const img        = primaryImg ? mediaUrl(primaryImg.image) : null

  const stepBtn = {
    width: "34px", height: "34px", background: "none",
    border: "none", color: "var(--text)", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "opacity 200ms var(--ease)",
  }

  return (
    <div
      data-testid={`cart-item-${product.slug}`}
      style={{
        display: "flex", gap: "16px", padding: "14px",
        background: "#121212",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "20px", alignItems: "center",
      }}>
      {/* Imagen */}
      <Link to={`/shop/${product.slug}`} style={{ flexShrink: 0 }}>
        <div style={{
          width: "92px", height: "92px", borderRadius: "16px",
          overflow: "hidden", background: "#1a1a1a",
        }}>
          {img ? (
            <img src={img} alt={product.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ width: "100%", height: "100%",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.4)" }}>
              <ShoppingBag size={30} />
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {product.brand_name && (
          <p style={{ fontSize: "10px", color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.12em",
            fontWeight: 700, marginBottom: "5px" }}>
            {product.brand_name}
          </p>
        )}
        <Link to={`/shop/${product.slug}`}>
          <p data-testid={`cart-item-name-${product.slug}`} style={{
            fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700,
            color: "var(--text)", letterSpacing: "-0.01em", lineHeight: 1.25,
            marginBottom: "12px",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {product.name}
          </p>
        </Link>

        <div style={{ display: "flex", alignItems: "center",
          justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          {/* Cantidad */}
          <div style={{ display: "flex", alignItems: "center",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "var(--r-full)", overflow: "hidden" }}>
            <button
              data-testid={`cart-qty-minus-${product.slug}`}
              onClick={() => updateQuantity(product.id, quantity - 1)}
              disabled={quantity <= 1}
              style={{ ...stepBtn, opacity: quantity <= 1 ? 0.3 : 1,
                cursor: quantity <= 1 ? "not-allowed" : "pointer" }}>
              <Minus size={15} strokeWidth={2.5} />
            </button>
            <span data-testid={`cart-qty-${product.slug}`} style={{
              minWidth: "30px", textAlign: "center",
              fontSize: "14px", fontWeight: 700, color: "var(--text)",
              fontVariantNumeric: "tabular-nums" }}>
              {quantity}
            </span>
            <button
              data-testid={`cart-qty-plus-${product.slug}`}
              onClick={() => updateQuantity(product.id, quantity + 1)}
              disabled={quantity >= product.stock}
              style={{ ...stepBtn, opacity: quantity >= product.stock ? 0.3 : 1,
                cursor: quantity >= product.stock ? "not-allowed" : "pointer" }}>
              <Plus size={15} strokeWidth={2.5} />
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem",
              fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums" }}>
              ${(Number(product.price) * quantity).toLocaleString("es-CL")}
            </p>
            <button
              data-testid={`cart-remove-${product.slug}`}
              onClick={() => removeItem(product.id)}
              title="Eliminar"
              style={{ width: "34px", height: "34px", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--text-3)", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer",
                transition: "all 200ms var(--ease)", flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.color = "#ff6b6b"; e.currentTarget.style.borderColor = "rgba(255,107,107,0.35)" }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)" }}>
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Cart() {
  const { items, clearCart, getTotal } = useCartStore()
  const { isAuthenticated }            = useAuthStore()
  const navigate                       = useNavigate()
  const total                          = getTotal()

  const { data: ordersData } = useQuery({
    queryKey: ["orders"],
    queryFn:  getOrders,
    enabled:  isAuthenticated,
    staleTime: 0,
  })

  // ── Preview de participaciones para el carrito actual
  const cartPreviewItems = items.map(it => ({
    product_id: it.product.id,
    quantity:   it.quantity,
  }))
  const { data: rewardsPreview } = useQuery({
    queryKey: ["rewards-preview", cartPreviewItems],
    queryFn:  () => previewCartEntries(cartPreviewItems),
    enabled:  items.length > 0,
    staleTime: 30_000,
  })
  const totalEntries = rewardsPreview?.total_entries || 0

  // ── Loyalty: cuenta del usuario ────────────────────────
  const { data: loyalty } = useQuery({
    queryKey: ["my-loyalty"],
    queryFn:  getMyLoyalty,
    enabled:  isAuthenticated && items.length > 0,
    staleTime: 60_000,
  })
  const { pointsToRedeem, setPointsToRedeem } = useCartStore()

  const canRedeem      = loyalty && loyalty.puntos_disponibles >= (loyalty.minimo_canje || 0)
  const pesoPorPunto   = loyalty ? (loyalty.valor_disponible / Math.max(1, loyalty.puntos_disponibles)) : 0
  const maxPointsForCart = loyalty
    ? Math.min(loyalty.puntos_disponibles,
               Math.floor((total || 0) / Math.max(0.01, pesoPorPunto)))
    : 0
  const loyaltyDiscount = Math.min(
    total || 0,
    Math.floor(pointsToRedeem * pesoPorPunto)
  )
  const finalTotal = Math.max(0, (total || 0) - loyaltyDiscount)

  const pendingOrder = (ordersData?.results || ordersData || [])
    .find(o => o.status === "pending")

  const pageWrap = {
    background: "var(--bg)", minHeight: "100vh",
    paddingTop: "clamp(100px, 12vw, 140px)",
    paddingBottom: "clamp(60px, 8vw, 100px)",
  }

  // ── Carrito vacío con orden pendiente ──────────────────
  if (!items.length && isAuthenticated && pendingOrder) {
    return (
      <div style={pageWrap}>
        <Seo title="Carrito" noindex />
        <div className="lp-container" style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: "24px", textAlign: "center",
          minHeight: "50vh", maxWidth: "560px" }}>
          <div style={{ width: "72px", height: "72px", borderRadius: "50%",
            background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.25)",
            color: "#facc15", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Clock size={32} />
          </div>
          <div>
            <h1 className="display-bold" style={{ fontFamily: "var(--font-display)",
              fontSize: "clamp(1.8rem, 4vw, 2.6rem)", fontWeight: 800,
              letterSpacing: "-0.03em", marginBottom: "12px", color: "var(--text)" }}>
              Tenés una orden pendiente
            </h1>
            <p style={{ color: "var(--text-2)", fontSize: "15px", lineHeight: 1.6 }}>
              Tu carrito está vacío porque ya iniciaste una compra.
              Podés completar el pago o cancelarla.
            </p>
          </div>
          <div style={{ width: "100%", background: "#121212",
            border: "1px solid rgba(250,204,21,0.2)", borderRadius: "var(--r-2xl)",
            padding: "24px 28px" }}>
            <Eyebrow color="#facc15">Pago pendiente</Eyebrow>
            <p style={{ fontFamily: "monospace", fontSize: "13px",
              color: "var(--text-3)", margin: "10px 0 6px" }}>
              #{pendingOrder.id.slice(0, 8).toUpperCase()}
            </p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "2.2rem",
              fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)" }}>
              ${Number(pendingOrder.total).toLocaleString("es-CL")}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column",
            gap: "12px", width: "100%", maxWidth: "380px", alignItems: "center" }}>
            <AccentCTA to={`/dashboard/orders/${pendingOrder.id}`}
              testid="cart-resume-order" full>
              Retomar o cambiar el pago
            </AccentCTA>
            <Link to="/shop" style={{ fontSize: "13px", color: "var(--text-3)",
              padding: "8px", textDecoration: "none" }}>
              Ir a la tienda
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Carrito vacío normal ───────────────────────────────
  if (!items.length) return (
    <div style={pageWrap}>
      <Seo title="Carrito" noindex />
      <div className="lp-container" style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: "22px", textAlign: "center",
        minHeight: "50vh" }} data-testid="cart-empty">
        <div style={{ width: "76px", height: "76px", borderRadius: "50%",
          background: "rgba(26,255,110,0.08)", border: "1px solid rgba(26,255,110,0.2)",
          color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ShoppingBag size={34} />
        </div>
        <div>
          <h1 className="display-bold" style={{ fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 4.5vw, 3rem)", fontWeight: 800,
            letterSpacing: "-0.03em", marginBottom: "12px", color: "var(--text)" }}>
            Tu carrito está vacío
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: "15px" }}>
            Explorá la tienda y encontrá el equipo que necesitás.
          </p>
        </div>
        <AccentCTA to="/shop" testid="cart-empty-shop">
          Ir a la tienda
        </AccentCTA>
      </div>
    </div>
  )

  // ── Carrito con items ──────────────────────────────────
  return (
    <div style={pageWrap} data-testid="cart-page">
      <Seo title="Carrito" noindex />
      <div className="lp-container">

        {/* Encabezado */}
        <div style={{ marginBottom: "clamp(28px, 4vw, 44px)" }}>
          <Eyebrow>· Carrito</Eyebrow>
          <h1 className="display-bold" style={{ fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 4vw, 3.2rem)", fontWeight: 800,
            letterSpacing: "-0.03em", lineHeight: 1, marginTop: "12px",
            color: "var(--text)", display: "flex", alignItems: "baseline",
            gap: "14px", flexWrap: "wrap" }}>
            Tu carrito
            <span style={{ fontSize: "1rem", color: "var(--text-3)",
              fontFamily: "var(--font-sans)", fontWeight: 500, letterSpacing: 0 }}>
              {items.length} producto{items.length !== 1 ? "s" : ""}
            </span>
          </h1>
        </div>

        <div style={{ display: "grid",
          gridTemplateColumns: "1fr 380px", gap: "clamp(24px, 3vw, 40px)",
          alignItems: "start" }} className="cart-grid">

          {/* Items */}
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {items.map(item => (
                <CartItem key={item.product.id} item={item} />
              ))}
            </div>
            <button
              data-testid="cart-clear"
              onClick={clearCart}
              style={{ marginTop: "16px", display: "inline-flex", alignItems: "center",
                gap: "7px", fontSize: "13px", color: "var(--text-3)",
                background: "none", border: "none", cursor: "pointer",
                transition: "color var(--dur)" }}
              onMouseEnter={e => e.currentTarget.style.color = "#ff6b6b"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--text-3)"}>
              <X size={14} /> Vaciar carrito
            </button>
          </div>

          {/* Resumen */}
          <div data-testid="cart-summary" style={{
            background: "#121212",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "var(--r-2xl)",
            padding: "26px", position: "sticky", top: "100px",
          }}>
            <Eyebrow>· Resumen</Eyebrow>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "18px",
              fontWeight: 700, letterSpacing: "-0.01em", margin: "10px 0 20px",
              color: "var(--text)" }}>
              Resumen del pedido
            </h2>

            <div style={{ display: "flex", flexDirection: "column",
              gap: "10px", marginBottom: "20px" }}>
              {items.map(item => (
                <div key={item.product.id} style={{ display: "flex",
                  justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "var(--text-2)", overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap",
                    marginRight: "8px", maxWidth: "220px" }}>
                    {item.product.name} ×{item.quantity}
                  </span>
                  <span style={{ flexShrink: 0, color: "var(--text-2)",
                    fontVariantNumeric: "tabular-nums" }}>
                    ${(Number(item.product.price) * item.quantity).toLocaleString("es-CL")}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid var(--border)",
              paddingTop: "16px", marginBottom: "24px",
              display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between",
                fontSize: "13px", color: "var(--text-3)" }}>
                <span>Subtotal</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  ${Number(total || 0).toLocaleString("es-CL")}
                </span>
              </div>
              {loyaltyDiscount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between",
                  fontSize: "13px", color: "var(--accent)" }}>
                  <span>Descuento por puntos ({pointsToRedeem} pts)</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    − ${loyaltyDiscount.toLocaleString("es-CL")}
                  </span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between",
                alignItems: "baseline", paddingTop: "10px",
                borderTop: "1px solid var(--border)" }}>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>Total</span>
                <span data-testid="cart-total" style={{ fontFamily: "var(--font-display)",
                  fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em",
                  color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                  ${finalTotal.toLocaleString("es-CL")}
                </span>
              </div>
            </div>

            {/* Loyalty — canjear puntos */}
            {isAuthenticated && canRedeem && maxPointsForCart > 0 && (
              <div data-testid="cart-loyalty-redeem" style={{
                marginBottom: "20px", padding: "16px",
                background: "rgba(96,165,250,0.06)",
                border: "1px solid rgba(96,165,250,0.25)",
                borderRadius: "var(--r-lg)" }}>
                <div style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start", marginBottom: "12px" }}>
                  <div>
                    <p style={{ display: "inline-flex", alignItems: "center", gap: "6px",
                      fontSize: "10px", fontWeight: 700, color: "#60a5fa",
                      letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px" }}>
                      <Star size={12} fill="#60a5fa" color="#60a5fa" /> Tus puntos
                    </p>
                    <p style={{ fontSize: "13px", color: "var(--text)" }}>
                      Disponibles:{" "}
                      <strong>{loyalty.puntos_disponibles.toLocaleString("es-CL")} pts</strong>
                      {" "}(${loyalty.valor_disponible.toLocaleString("es-CL")})
                    </p>
                  </div>
                  {pointsToRedeem > 0 && (
                    <button data-testid="btn-remove-points"
                      onClick={() => setPointsToRedeem(0)}
                      style={{ background: "none", border: "none",
                        color: "var(--text-3)", fontSize: "12px",
                        cursor: "pointer", textDecoration: "underline" }}>
                      Quitar
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <input type="range" min="0" max={maxPointsForCart}
                    step={Math.max(1, Math.floor(loyalty.minimo_canje / 10))}
                    value={pointsToRedeem}
                    onChange={e => {
                      const n = Number(e.target.value)
                      if (n > 0 && n < loyalty.minimo_canje) {
                        setPointsToRedeem(loyalty.minimo_canje)
                      } else {
                        setPointsToRedeem(n)
                      }
                    }}
                    data-testid="input-points-slider"
                    style={{ flex: 1, accentColor: "#60a5fa" }} />
                  <div style={{ textAlign: "right", minWidth: "110px" }}>
                    <p style={{ fontSize: "14px", fontWeight: 700,
                      color: "#60a5fa", fontVariantNumeric: "tabular-nums" }}>
                      {pointsToRedeem.toLocaleString("es-CL")} pts
                    </p>
                    <p style={{ fontSize: "11px", color: "var(--text-3)" }}>
                      = ${loyaltyDiscount.toLocaleString("es-CL")}
                    </p>
                  </div>
                </div>
                <p style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "8px" }}>
                  Mínimo: {loyalty.minimo_canje} pts. Máximo usable: {maxPointsForCart.toLocaleString("es-CL")}.
                </p>
              </div>
            )}

            {/* Rewards preview */}
            {totalEntries > 0 && (
              <div data-testid="cart-rewards-preview" style={{
                marginBottom: "20px", padding: "16px",
                background: "rgba(26,255,110,0.06)",
                border: "1px solid rgba(26,255,110,0.25)",
                borderRadius: "var(--r-lg)" }}>
                <p style={{ display: "inline-flex", alignItems: "center", gap: "8px",
                  fontSize: "10px", fontWeight: 700, color: "var(--accent)",
                  letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>
                  <Gift size={13} /> LevelPro Rewards
                </p>
                <p style={{ fontSize: "13px", color: "var(--text)", lineHeight: 1.5 }}>
                  Con esta compra obtendrás{" "}
                  <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                    {totalEntries} participaciones
                  </span>
                  {" "}en {rewardsPreview.campaigns.length > 1
                    ? `${rewardsPreview.campaigns.length} sorteos`
                    : "el sorteo activo"}.
                </p>
                <Link to="/rewards" style={{ display: "inline-flex", alignItems: "center",
                  gap: "5px", marginTop: "8px", fontSize: "12px",
                  color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
                  Ver detalles del sorteo <ArrowRight size={12} />
                </Link>
              </div>
            )}

            <AccentCTA
              testid="cart-checkout"
              full
              onClick={() => isAuthenticated
                ? navigate("/checkout")
                : navigate("/login?next=/checkout")}>
              {isAuthenticated ? "Proceder al pago" : "Iniciar sesión para comprar"}
            </AccentCTA>

            <Link to="/shop" data-testid="cart-continue" style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: "7px", fontSize: "13px", color: "var(--text-3)",
              marginTop: "16px", textDecoration: "none",
              transition: "color var(--dur)" }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--text-3)"}>
              <ArrowLeft size={14} /> Seguir comprando
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .cart-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
