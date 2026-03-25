// pages/Checkout.jsx
// Formulario de checkout — datos de envío + resumen + confirmar orden
// Crea la Order en el backend y redirige al pago

import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import api from "../api/client"
import { useCartStore } from "../store/cartStore"
import { useAuthStore } from "../store/authStore"

// ── Schema de validación ─────────────────────────────────────
const checkoutSchema = z.object({
  first_name:      z.string().min(1, "Requerido"),
  last_name:       z.string().min(1, "Requerido"),
  email:           z.string().email("Email inválido"),
  phone:           z.string().min(8, "Teléfono inválido"),
  address_street:  z.string().min(5, "Dirección requerida"),
  address_city:    z.string().min(2, "Ciudad requerida"),
  address_province:z.string().min(2, "Región requerida"),
  notes:           z.string().optional(),
})

// ── Campo de formulario reutilizable ─────────────────────────
function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}
    </div>
  )
}

// ── Input styling helper ─────────────────────────────────────
function inputStyle(hasError) {
  return {
    backgroundColor: "var(--color-surface-2)",
    border: `1px solid ${hasError ? "var(--color-danger)" : "var(--color-border)"}`,
    color: "var(--color-text)",
  }
}

// ── Checkout page ────────────────────────────────────────────
export default function Checkout() {
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState("")
  const { items, total, clearCart } = useCartStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      first_name:       user?.first_name || "",
      last_name:        user?.last_name  || "",
      email:            user?.email      || "",
      phone:            user?.phone      || "",
      address_street:   user?.address_street   || "",
      address_city:     user?.address_city     || "",
      address_province: user?.address_province || "",
    },
  })

  const onSubmit = async (data) => {
    if (!items.length) return
    setIsLoading(true)
    setServerError("")

    try {
      // 1 — Crear la orden en el backend
      const orderPayload = {
        email:            data.email,
        shipping_address: `${data.address_street}, ${data.address_city}, ${data.address_province}`,
        notes:            data.notes || "",
        total:            total,
        items:            items.map(i => ({
          product:      i.product.id,
          product_name: i.product.name,
          price:        i.product.price,
          quantity:     i.quantity,
        })),
      }

      const { data: order } = await api.post("/orders/", orderPayload)

      // 2 — Vaciar el carrito
      clearCart()

      // 3 — Redirigir a confirmación
      navigate(`/order-confirmation/${order.id}`)

    } catch (err) {
      setServerError("Hubo un error al procesar tu pedido. Intenta de nuevo.")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  // Sin items → redirige al carrito
  if (!items.length) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4" style={{ color: "var(--color-text-muted)" }}>
            Tu carrito está vacío.
          </p>
          <Link to="/shop" style={{ color: "var(--color-accent)" }}>
            Ir a la tienda
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen py-10 px-4"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div className="max-w-5xl mx-auto">

        <h1 className="text-3xl font-black mb-8">Checkout</h1>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Formulario de envío */}
            <div className="lg:col-span-2 space-y-5">
              <div
                className="rounded-2xl p-6"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <h2 className="font-bold text-lg mb-5">Datos de contacto</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nombre" error={errors.first_name?.message}>
                    <input
                      {...register("first_name")}
                      className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                      style={inputStyle(errors.first_name)}
                    />
                  </Field>

                  <Field label="Apellido" error={errors.last_name?.message}>
                    <input
                      {...register("last_name")}
                      className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                      style={inputStyle(errors.last_name)}
                    />
                  </Field>

                  <Field label="Email" error={errors.email?.message}>
                    <input
                      type="email"
                      {...register("email")}
                      className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                      style={inputStyle(errors.email)}
                    />
                  </Field>

                  <Field label="Teléfono" error={errors.phone?.message}>
                    <input
                      {...register("phone")}
                      className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                      style={inputStyle(errors.phone)}
                    />
                  </Field>
                </div>
              </div>

              {/* Dirección */}
              <div
                className="rounded-2xl p-6"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <h2 className="font-bold text-lg mb-5">Dirección de envío</h2>

                <div className="space-y-4">
                  <Field label="Calle y número" error={errors.address_street?.message}>
                    <input
                      {...register("address_street")}
                      placeholder="Ej: Av. Providencia 1234"
                      className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                      style={inputStyle(errors.address_street)}
                    />
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Ciudad" error={errors.address_city?.message}>
                      <input
                        {...register("address_city")}
                        placeholder="Ej: Santiago"
                        className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                        style={inputStyle(errors.address_city)}
                      />
                    </Field>

                    <Field label="Región" error={errors.address_province?.message}>
                      <input
                        {...register("address_province")}
                        placeholder="Ej: Región Metropolitana"
                        className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                        style={inputStyle(errors.address_province)}
                      />
                    </Field>
                  </div>

                  <Field label="Notas del pedido (opcional)" error={null}>
                    <textarea
                      {...register("notes")}
                      rows={3}
                      placeholder="Instrucciones especiales de entrega..."
                      className="w-full px-4 py-2.5 rounded-lg text-sm outline-none resize-none"
                      style={inputStyle(false)}
                    />
                  </Field>
                </div>
              </div>
            </div>

            {/* Resumen del pedido */}
            <div
              className="rounded-2xl p-6 h-fit sticky top-24"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <h2 className="font-bold text-lg mb-5">Tu pedido</h2>

              <div className="space-y-3 mb-4">
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
                className="pt-4 border-t flex justify-between font-bold text-lg mb-5"
                style={{ borderColor: "var(--color-border)" }}
              >
                <span>Total</span>
                <span style={{ color: "var(--color-accent)" }}>
                  ${total.toLocaleString("es-CL")}
                </span>
              </div>

              {serverError && (
                <p
                  className="text-xs mb-4 p-3 rounded-lg"
                  style={{
                    color: "var(--color-danger)",
                    backgroundColor: "rgba(255,68,68,0.1)",
                    border: "1px solid var(--color-danger)",
                  }}
                >
                  {serverError}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-lg font-semibold text-sm disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
              >
                {isLoading ? "Procesando..." : "Confirmar pedido"}
              </button>

              <p className="text-xs text-center mt-3" style={{ color: "var(--color-text-muted)" }}>
                Al confirmar aceptas nuestros términos y condiciones.
              </p>
            </div>

          </div>
        </form>

      </div>
    </div>
  )
}