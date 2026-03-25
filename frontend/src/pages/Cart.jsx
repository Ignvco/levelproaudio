// pages/Cart.jsx
// Carrito de compras — muestra items, permite editar cantidades
// y lleva al checkout

import { Link, useNavigate } from "react-router-dom"
import { useCartStore } from "../store/cartStore"
import { useAuthStore } from "../store/authStore"

// ── Item del carrito ─────────────────────────────────────────
function CartItem({ item }) {
  const { updateQuantity, removeItem } = useCartStore()
  const { product, quantity } = item

  return (
    <div
      className="flex gap-4 py-5 border-b"
      style={{ borderColor: "var(--color-border)" }}
    >
      {/* Imagen */}
      <div
        className="w-20 h-20 rounded-xl flex-shrink-0 overflow-hidden"
        style={{ backgroundColor: "var(--color-surface-2)" }}
      >
        {product.primary_image ? (
          <img
            src={product.primary_image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">
            🎧
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs mb-0.5" style={{ color: "var(--color-text-muted)" }}>
          {product.brand_name}
        </p>
        <Link
          to={`/shop/${product.slug}`}
          className="font-semibold text-sm leading-snug hover:underline line-clamp-2"
        >
          {product.name}
        </Link>

        <div className="flex items-center justify-between mt-3">
          {/* Selector cantidad */}
          <div
            className="flex items-center rounded-lg overflow-hidden"
            style={{ border: "1px solid var(--color-border)" }}
          >
            <button
              onClick={() => updateQuantity(product.id, quantity - 1)}
              disabled={quantity <= 1}
              className="w-8 h-8 flex items-center justify-center text-sm disabled:opacity-30 hover:bg-white/5"
              style={{ color: "var(--color-text-muted)" }}
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-semibold">
              {quantity}
            </span>
            <button
              onClick={() => updateQuantity(product.id, quantity + 1)}
              disabled={quantity >= product.stock}
              className="w-8 h-8 flex items-center justify-center text-sm disabled:opacity-30 hover:bg-white/5"
              style={{ color: "var(--color-text-muted)" }}
            >
              +
            </button>
          </div>

          {/* Precio + eliminar */}
          <div className="flex items-center gap-4">
            <span className="font-bold text-sm" style={{ color: "var(--color-accent)" }}>
              ${(Number(product.price) * quantity).toLocaleString("es-CL")}
            </span>
            <button
              onClick={() => removeItem(product.id)}
              className="text-xs transition-colors hover:text-red-400"
              style={{ color: "var(--color-text-muted)" }}
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Cart page ────────────────────────────────────────────────
export default function Cart() {
  const { items, total, clearCart } = useCartStore()
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  const handleCheckout = () => {
    if (!isAuthenticated) {
      navigate("/login?next=/checkout")
      return
    }
    navigate("/checkout")
  }

  // Carrito vacío
  if (!items.length) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 px-4"
        style={{ backgroundColor: "var(--color-bg)" }}
      >
        <span className="text-6xl">🛒</span>
        <h2 className="text-xl font-bold">Tu carrito está vacío</h2>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Agrega productos desde la tienda para continuar.
        </p>
        <Link
          to="/shop"
          className="mt-2 px-6 py-2.5 rounded-lg font-semibold text-sm"
          style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
        >
          Ir a la tienda
        </Link>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen py-10 px-4"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div className="max-w-4xl mx-auto">

        <h1 className="text-3xl font-black mb-8">Carrito</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Lista de items */}
          <div className="lg:col-span-2">
            {items.map(item => (
              <CartItem key={item.product.id} item={item} />
            ))}

            <button
              onClick={clearCart}
              className="mt-4 text-sm transition-colors hover:text-red-400"
              style={{ color: "var(--color-text-muted)" }}
            >
              Vaciar carrito
            </button>
          </div>

          {/* Resumen */}
          <div
            className="rounded-2xl p-6 h-fit sticky top-24"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h2 className="font-bold text-lg mb-5">Resumen</h2>

            <div className="space-y-3 mb-5">
              {items.map(item => (
                <div key={item.product.id} className="flex justify-between text-sm">
                  <span style={{ color: "var(--color-text-muted)" }} className="truncate mr-2">
                    {item.product.name} x{item.quantity}
                  </span>
                  <span className="flex-shrink-0">
                    ${(Number(item.product.price) * item.quantity).toLocaleString("es-CL")}
                  </span>
                </div>
              ))}
            </div>

            <div
              className="pt-4 border-t flex justify-between font-bold text-lg"
              style={{ borderColor: "var(--color-border)" }}
            >
              <span>Total</span>
              <span style={{ color: "var(--color-accent)" }}>
                ${total.toLocaleString("es-CL")}
              </span>
            </div>

            <button
              onClick={handleCheckout}
              className="w-full mt-5 py-3 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
            >
              Proceder al pago
            </button>

            <Link
              to="/shop"
              className="block text-center mt-3 text-sm transition-colors"
              style={{ color: "var(--color-text-muted)" }}
            >
              ← Seguir comprando
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}