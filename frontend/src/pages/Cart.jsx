// pages/Cart.jsx
import { Link, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useCartStore } from "../store/cartStore"
import { useAuthStore } from "../store/authStore"
import { getOrders } from "../api/orders.api"
import { mediaUrl } from "../utils/mediaUrl"

function CartItem({ item }) {
  const { updateQuantity, removeItem } = useCartStore()
  const { product, quantity }          = item

  const primaryImg = product.images?.find(i => i.is_primary) || product.images?.[0]
  const img        = primaryImg ? mediaUrl(primaryImg.image) : null

  return (
    <div style={{
      display:       "flex",
      gap:           "16px",
      padding:       "20px 0",
      borderBottom:  "1px solid var(--border)",
      alignItems:    "center",
    }}>
      {/* Imagen */}
      <Link to={`/shop/${product.slug}`}>
        <div style={{
          width:        "80px",
          height:       "80px",
          borderRadius: "var(--r-lg)",
          overflow:     "hidden",
          background:   "var(--surface-2)",
          flexShrink:   0,
          border:       "1px solid var(--border)",
        }}>
          {img ? (
            <img src={img} alt={product.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%",
              display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "28px" }}>
              🎧
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {product.brand_name && (
          <p style={{ fontSize: "11px", color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em",
            marginBottom: "4px" }}>
            {product.brand_name}
          </p>
        )}
        <Link to={`/shop/${product.slug}`}>
          <p style={{ fontSize: "15px", fontWeight: 400, color: "var(--text)",
            lineHeight: 1.4, marginBottom: "12px",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {product.name}
          </p>
        </Link>

        <div style={{ display: "flex", alignItems: "center",
          justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          {/* Cantidad */}
          <div style={{
            display: "flex", alignItems: "center",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-full)", overflow: "hidden",
          }}>
            <button onClick={() => updateQuantity(product.id, quantity - 1)}
              disabled={quantity <= 1}
              style={{ width: "36px", height: "36px", background: "none",
                border: "none", color: "var(--text-2)", fontSize: "16px",
                cursor: "pointer", opacity: quantity <= 1 ? 0.3 : 1 }}>
              −
            </button>
            <span style={{ width: "32px", textAlign: "center",
              fontSize: "14px", fontWeight: 500 }}>
              {quantity}
            </span>
            <button onClick={() => updateQuantity(product.id, quantity + 1)}
              disabled={quantity >= product.stock}
              style={{ width: "36px", height: "36px", background: "none",
                border: "none", color: "var(--text-2)", fontSize: "16px",
                cursor: "pointer", opacity: quantity >= product.stock ? 0.3 : 1 }}>
              +
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.2rem",
              color: "var(--text)" }}>
              ${(Number(product.price) * quantity).toLocaleString("es-CL")}
            </p>
            <button onClick={() => removeItem(product.id)} style={{
              fontSize: "12px", color: "var(--text-3)", background: "none",
              border: "none", cursor: "pointer", transition: "color var(--dur)",
            }}
              className="hover-accent"
            >
              Eliminar
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

  const pendingOrder = (ordersData?.results || ordersData || [])
    .find(o => o.status === "pending")

  // Carrito vacío con orden pendiente
  if (!items.length && isAuthenticated && pendingOrder) {
    return (
      <div style={{
        minHeight: "80vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: "24px", padding: "40px 24px",
        background: `radial-gradient(ellipse 50% 50% at 50% 50%,
          rgba(250,204,21,0.04) 0%, transparent 70%)`,
      }}>
        <span style={{ fontSize: "56px" }}>⏳</span>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "2rem",
            fontWeight: 300, marginBottom: "10px" }}>
            Tenés una orden pendiente
          </h2>
          <p style={{ color: "var(--text-2)", fontSize: "15px", lineHeight: 1.6 }}>
            Tu carrito está vacío porque ya iniciaste una compra.
            Podés completar el pago o cancelarla.
          </p>
        </div>
        <div style={{
          background: "var(--surface)", border: "1px solid rgba(250,204,21,0.2)",
          borderRadius: "var(--r-xl)", padding: "20px 28px", textAlign: "center",
        }}>
          <p style={{ fontSize: "11px", color: "#facc15", fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
            Pago pendiente
          </p>
          <p style={{ fontFamily: "monospace", fontSize: "13px",
            color: "var(--text-2)", marginBottom: "6px" }}>
            #{pendingOrder.id.slice(0, 8).toUpperCase()}
          </p>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: "2rem" }}>
            ${Number(pendingOrder.total).toLocaleString("es-CL")}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column",
          gap: "10px", width: "100%", maxWidth: "360px" }}>
          <Link to={`/dashboard/orders/${pendingOrder.id}`}
            className="btn btn-accent"
            style={{ justifyContent: "center" }}>
            Retomar o cambiar método de pago →
          </Link>
          <Link to="/shop" style={{ textAlign: "center", fontSize: "13px",
            color: "var(--text-3)", padding: "10px" }}>
            Ir a la tienda
          </Link>
        </div>
      </div>
    )
  }

  // Carrito vacío normal
  if (!items.length) return (
    <div style={{
      minHeight: "80vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "20px", padding: "40px",
      background: `radial-gradient(ellipse 50% 50% at 50% 50%,
        rgba(26,255,110,0.03) 0%, transparent 70%)`,
    }}>
      <span style={{ fontSize: "64px" }}>🛒</span>
      <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "2.4rem",
        fontWeight: 300 }}>
        Tu carrito está vacío
      </h2>
      <p style={{ color: "var(--text-2)", fontSize: "15px" }}>
        Explorá la tienda y encontrá el equipo que necesitás.
      </p>
      <Link to="/shop" className="btn btn-accent" style={{ marginTop: "8px" }}>
        Ir a la tienda →
      </Link>
    </div>
  )

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh",
      padding: "clamp(40px, 6vw, 80px) 0" }}>
      <div style={{ maxWidth: "var(--container)", margin: "0 auto",
        padding: "0 clamp(20px, 5vw, 60px)" }}>

        <h1 style={{ fontFamily: "var(--font-serif)",
          fontSize: "clamp(2rem, 5vw, 4rem)",
          fontWeight: 300, marginBottom: "48px", letterSpacing: "-0.02em" }}>
          Tu carrito
          <span style={{ fontSize: "1rem", color: "var(--text-3)",
            marginLeft: "16px", fontFamily: "var(--font-sans)",
            fontWeight: 400, letterSpacing: 0 }}>
            {items.length} producto{items.length !== 1 ? "s" : ""}
          </span>
        </h1>

        <div style={{ display: "grid",
          gridTemplateColumns: "1fr 360px", gap: "48px", alignItems: "start" }}
          className="cart-grid"
        >
          {/* Items */}
          <div>
            {items.map(item => (
              <CartItem key={item.product.id} item={item} />
            ))}
            <button onClick={clearCart} style={{
              marginTop: "16px", fontSize: "13px", color: "var(--text-3)",
              background: "none", border: "none", cursor: "pointer",
              transition: "color var(--dur)",
            }}
              className="hover-accent"
            >
              Vaciar carrito
            </button>
          </div>

          {/* Resumen */}
          <div style={{
            background:   "var(--surface)",
            border:       "1px solid var(--border)",
            borderRadius: "var(--r-2xl)",
            padding:      "28px",
            position:     "sticky",
            top:          "88px",
          }}>
            <h2 style={{ fontSize: "15px", fontWeight: 500, marginBottom: "20px" }}>
              Resumen del pedido
            </h2>

            <div style={{ display: "flex", flexDirection: "column",
              gap: "10px", marginBottom: "20px" }}>
              {items.map(item => (
                <div key={item.product.id} style={{ display: "flex",
                  justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "var(--text-2)", overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap",
                    marginRight: "8px", maxWidth: "200px" }}>
                    {item.product.name} ×{item.quantity}
                  </span>
                  <span style={{ flexShrink: 0 }}>
                    ${(Number(item.product.price) * item.quantity).toLocaleString("es-CL")}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid var(--border)",
              paddingTop: "16px", marginBottom: "24px",
              display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: "14px", fontWeight: 500 }}>Total</span>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: "2rem" }}>
                ${Number(total || 0).toLocaleString("es-CL")}
              </span>
            </div>

            <button
              onClick={() => isAuthenticated
                ? navigate("/checkout")
                : navigate("/login?next=/checkout")
              }
              className="btn btn-accent"
              style={{ width: "100%", justifyContent: "center",
                fontSize: "15px", padding: "14px" }}>
              {isAuthenticated ? "Proceder al pago →" : "Iniciar sesión para comprar"}
            </button>

            <Link to="/shop" style={{ display: "block", textAlign: "center",
              fontSize: "13px", color: "var(--text-3)", marginTop: "16px",
              transition: "color var(--dur)" }}
              className="hover-accent">
              ← Seguir comprando
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .cart-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}