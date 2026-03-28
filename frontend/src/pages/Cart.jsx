// pages/Cart.jsx

import { Link, useNavigate } from "react-router-dom"
import { useCartStore } from "../store/cartStore"
import { useAuthStore } from "../store/authStore"

function CartItem({ item }) {
  const { updateQuantity, removeItem } = useCartStore()
  const { product, quantity } = item

  return (
    <div style={{
      display: "flex", gap: "16px", paddingBottom: "24px", marginBottom: "24px",
      borderBottom: "1px solid var(--border)",
    }}>
      {/* Imagen */}
      <div style={{
        width: "88px", height: "88px", borderRadius: "var(--r-md)",
        background: "var(--surface-2)", overflow: "hidden", flexShrink: 0,
        border: "1px solid var(--border)",
      }}>
        {product.primary_image ? (
          <img src={product.primary_image} alt={product.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex",
            alignItems: "center", justifyContent: "center", fontSize: "28px" }}>
            🎧
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "11px", color: "var(--text-3)", textTransform: "uppercase",
          letterSpacing: "0.08em", marginBottom: "4px" }}>
          {product.brand_name}
        </p>
        <Link to={`/shop/${product.slug}`}
          style={{ fontSize: "15px", fontWeight: 400, lineHeight: 1.4,
            display: "block", marginBottom: "12px" }}
          className="hover:text-[var(--text-2)] transition-colors"
        >
          {product.name}
        </Link>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Cantidad */}
          <div style={{
            display: "flex", alignItems: "center", gap: "0",
            border: "1px solid var(--border)", borderRadius: "var(--r-sm)", overflow: "hidden",
          }}>
            <button onClick={() => updateQuantity(product.id, quantity - 1)}
              disabled={quantity <= 1}
              style={{ width: "32px", height: "32px", display: "flex", alignItems: "center",
                justifyContent: "center", background: "none", border: "none",
                color: "var(--text-2)", cursor: "pointer", fontSize: "16px",
                opacity: quantity <= 1 ? 0.3 : 1, transition: "opacity var(--dur)" }}>
              −
            </button>
            <span style={{ width: "32px", textAlign: "center", fontSize: "14px", fontWeight: 500 }}>
              {quantity}
            </span>
            <button onClick={() => updateQuantity(product.id, quantity + 1)}
              disabled={quantity >= product.stock}
              style={{ width: "32px", height: "32px", display: "flex", alignItems: "center",
                justifyContent: "center", background: "none", border: "none",
                color: "var(--text-2)", cursor: "pointer", fontSize: "16px",
                opacity: quantity >= product.stock ? 0.3 : 1, transition: "opacity var(--dur)" }}>
              +
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span style={{ fontSize: "16px", fontWeight: 500 }}>
              ${(Number(product.price) * quantity).toLocaleString("es-CL")}
            </span>
            <button onClick={() => removeItem(product.id)}
              style={{ fontSize: "12px", color: "var(--text-3)", background: "none",
                border: "none", cursor: "pointer", transition: "color var(--dur)" }}
              className="hover:text-[var(--danger)]">
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Cart() {
  const { items, clearCart, getTotal, getCount } = useCartStore()
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const total = getTotal()

  if (!items.length) return (
    <div style={{ minHeight: "80vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "16px", padding: "40px" }}>
      <div style={{ fontSize: "56px", marginBottom: "8px" }}>🛒</div>
      <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "2rem" }}>Tu carrito está vacío</h2>
      <p style={{ color: "var(--text-2)", fontSize: "15px" }}>
        Agrega productos desde la tienda para continuar.
      </p>
      <Link to="/shop" className="btn btn-accent" style={{ marginTop: "8px" }}>
        Ir a la tienda
      </Link>
    </div>
  )

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh",
      padding: "clamp(40px, 6vw, 80px) 0" }}>
      <div className="container" style={{ maxWidth: "960px" }}>

        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2rem, 4vw, 3rem)",
          marginBottom: "40px" }}>
          Carrito
        </h1>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "40px",
          alignItems: "start" }}
          className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-10"
        >
          {/* Items */}
          <div>
            {items.map(item => <CartItem key={item.product.id} item={item} />)}
            <button onClick={clearCart}
              style={{ fontSize: "13px", color: "var(--text-3)", background: "none",
                border: "none", cursor: "pointer", marginTop: "8px", transition: "color var(--dur)" }}
              className="hover:text-[var(--danger)]">
              Vaciar carrito
            </button>
          </div>

          {/* Resumen */}
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-xl)", padding: "28px",
            position: "sticky", top: "88px",
          }}>
            <h2 style={{ fontSize: "15px", fontWeight: 500, marginBottom: "20px" }}>Resumen</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              {items.map(item => (
                <div key={item.product.id} style={{ display: "flex", justifyContent: "space-between",
                  fontSize: "13px" }}>
                  <span style={{ color: "var(--text-2)", overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: "8px" }}>
                    {item.product.name} ×{item.quantity}
                  </span>
                  <span style={{ flexShrink: 0 }}>
                    ${(Number(item.product.price) * item.quantity).toLocaleString("es-CL")}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px",
              marginBottom: "24px", display: "flex", justifyContent: "space-between",
              alignItems: "center" }}>
              <span style={{ fontSize: "15px", fontWeight: 500 }}>Total</span>
              <span style={{ fontSize: "22px", fontWeight: 500 }}>
                ${Number(total || 0).toLocaleString("es-CL")}
              </span>
            </div>

            <button
              onClick={() => isAuthenticated ? navigate("/checkout") : navigate("/login?next=/checkout")}
              className="btn btn-accent"
              style={{ width: "100%", justifyContent: "center" }}>
              Proceder al pago
            </button>

            <Link to="/shop" style={{ display: "block", textAlign: "center",
              fontSize: "13px", color: "var(--text-3)", marginTop: "16px",
              transition: "color var(--dur)" }}
              className="hover:text-[var(--text-2)]">
              ← Seguir comprando
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}