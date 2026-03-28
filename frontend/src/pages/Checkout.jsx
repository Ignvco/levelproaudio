// pages/Checkout.jsx

import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import api from "../api/client"
import { createPayment } from "../api/payments.api"
import { useCartStore } from "../store/cartStore"
import { useAuthStore } from "../store/authStore"

const schema = z.object({
  first_name:       z.string().min(1, "Requerido"),
  last_name:        z.string().min(1, "Requerido"),
  email:            z.string().email("Email inválido"),
  phone:            z.string().min(8, "Teléfono inválido"),
  address_street:   z.string().min(5, "Dirección requerida"),
  address_city:     z.string().min(2, "Ciudad requerida"),
  address_province: z.string().min(2, "Región requerida"),
  notes:            z.string().optional(),
})

const PAYMENT_METHODS = [
  { id: "mercadopago_cl", label: "MercadoPago",  icon: "💳", desc: "Tarjetas, saldo MP, Servipag" },
  { id: "paypal",         label: "PayPal",        icon: "🌎", desc: "Tarjetas internacionales" },
  { id: "global66",       label: "Transferencia", icon: "🏦", desc: "Global66 — procesamos en 24hs" },
]

function Field({ label, error, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
        color: "var(--text-2)", marginBottom: "8px" }}>
        {label}
      </label>
      {children}
      {error && (
        <p style={{ fontSize: "11px", color: "var(--danger)", marginTop: "4px" }}>
          {error}
        </p>
      )}
    </div>
  )
}

export default function Checkout() {
  const [selectedMethod, setSelectedMethod] = useState("mercadopago_cl")
  const [isLoading, setIsLoading]           = useState(false)
  const [serverError, setServerError]       = useState("")
  const { items, clearCart, getTotal }      = useCartStore()
  const { user }                            = useAuthStore()
  const navigate                            = useNavigate()
  const total                               = getTotal()

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
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
      const { data: order } = await api.post("/orders/", {
        email:            data.email,
        shipping_address: `${data.address_street}, ${data.address_city}, ${data.address_province}`,
        notes:            data.notes || "",
        total,
        items: items.map(i => ({
          product:      i.product.id,
          product_name: i.product.name,
          price:        i.product.price,
          quantity:     i.quantity,
        })),
      })

      const paymentData = await createPayment(order.id, selectedMethod)
      clearCart()

      if (selectedMethod === "mercadopago_cl" || selectedMethod === "mercadopago_ar") {
        window.location.href = paymentData.sandbox_url || paymentData.init_point
      } else if (selectedMethod === "paypal") {
        window.location.href = paymentData.approve_url
      } else {
        navigate(`/payment/transfer/${order.id}`, { state: { transferData: paymentData } })
      }
    } catch {
      setServerError("Error al procesar tu pedido. Intenta de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  if (!items.length) return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center",
      justifyContent: "center", flexDirection: "column", gap: "16px" }}>
      <p style={{ color: "var(--text-2)" }}>Tu carrito está vacío.</p>
      <Link to="/shop" className="btn btn-accent">Ir a la tienda</Link>
    </div>
  )

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh",
      padding: "clamp(40px, 6vw, 80px) 0" }}>
      <div className="container" style={{ maxWidth: "960px" }}>

        <h1 style={{ fontFamily: "var(--font-serif)",
          fontSize: "clamp(2rem, 4vw, 3rem)", marginBottom: "40px" }}>
          Checkout
        </h1>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-10"
            style={{ alignItems: "start" }}>

            {/* ── Columna izquierda ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

              {/* Datos de contacto */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--r-xl)", padding: "24px" }}>
                <p style={{ fontSize: "14px", fontWeight: 500, marginBottom: "20px" }}>
                  Datos de contacto
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nombre" error={errors.first_name?.message}>
                    <input {...register("first_name")} className={`input ${errors.first_name ? "error" : ""}`} />
                  </Field>
                  <Field label="Apellido" error={errors.last_name?.message}>
                    <input {...register("last_name")} className={`input ${errors.last_name ? "error" : ""}`} />
                  </Field>
                  <Field label="Email" error={errors.email?.message}>
                    <input type="email" {...register("email")} className={`input ${errors.email ? "error" : ""}`} />
                  </Field>
                  <Field label="Teléfono" error={errors.phone?.message}>
                    <input {...register("phone")} className={`input ${errors.phone ? "error" : ""}`} />
                  </Field>
                </div>
              </div>

              {/* Dirección */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--r-xl)", padding: "24px" }}>
                <p style={{ fontSize: "14px", fontWeight: 500, marginBottom: "20px" }}>
                  Dirección de envío
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <Field label="Calle y número" error={errors.address_street?.message}>
                    <input {...register("address_street")} placeholder="Ej: Av. Providencia 1234"
                      className={`input ${errors.address_street ? "error" : ""}`} />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Ciudad" error={errors.address_city?.message}>
                      <input {...register("address_city")} className={`input ${errors.address_city ? "error" : ""}`} />
                    </Field>
                    <Field label="Región" error={errors.address_province?.message}>
                      <input {...register("address_province")} className={`input ${errors.address_province ? "error" : ""}`} />
                    </Field>
                  </div>
                  <Field label="Notas (opcional)">
                    <textarea {...register("notes")} rows={2}
                      className="input" style={{ resize: "none" }} />
                  </Field>
                </div>
              </div>

              {/* Método de pago */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--r-xl)", padding: "24px" }}>
                <p style={{ fontSize: "14px", fontWeight: 500, marginBottom: "16px" }}>
                  Método de pago
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {PAYMENT_METHODS.map(m => (
                    <button key={m.id} type="button" onClick={() => setSelectedMethod(m.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: "14px",
                        padding: "14px 16px", borderRadius: "var(--r-md)",
                        textAlign: "left", cursor: "pointer",
                        transition: "all var(--dur) var(--ease)",
                        background: selectedMethod === m.id
                          ? "rgba(26,255,110,0.04)" : "transparent",
                        border: `1px solid ${selectedMethod === m.id
                          ? "rgba(26,255,110,0.3)" : "var(--border)"}`,
                      }}>
                      {/* Radio */}
                      <div style={{
                        width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0,
                        border: `2px solid ${selectedMethod === m.id
                          ? "var(--accent)" : "var(--border)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "border-color var(--dur)",
                      }}>
                        {selectedMethod === m.id && (
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%",
                            background: "var(--accent)" }} />
                        )}
                      </div>
                      <span style={{ fontSize: "20px" }}>{m.icon}</span>
                      <div>
                        <p style={{ fontSize: "14px", fontWeight: 400 }}>{m.label}</p>
                        <p style={{ fontSize: "12px", color: "var(--text-3)" }}>{m.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Resumen sticky ── */}
            <div style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--r-xl)", padding: "24px",
              position: "sticky", top: "88px",
            }}>
              <p style={{ fontSize: "14px", fontWeight: 500, marginBottom: "16px" }}>
                Tu pedido
              </p>

              <div style={{ display: "flex", flexDirection: "column",
                gap: "10px", marginBottom: "16px" }}>
                {items.map(item => (
                  <div key={item.product.id}
                    style={{ display: "flex", justifyContent: "space-between",
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

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "14px",
                marginBottom: "20px", display: "flex", justifyContent: "space-between",
                alignItems: "center" }}>
                <span style={{ fontSize: "14px", fontWeight: 500 }}>Total</span>
                <span style={{ fontSize: "22px", fontWeight: 500 }}>
                  ${Number(total || 0).toLocaleString("es-CL")}
                </span>
              </div>

              {/* Método seleccionado */}
              {selectedMethod && (
                <div style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "10px 12px", borderRadius: "var(--r-md)",
                  background: "rgba(26,255,110,0.04)",
                  border: "1px solid rgba(26,255,110,0.15)",
                  fontSize: "13px", marginBottom: "16px",
                  color: "var(--text-2)",
                }}>
                  <span>{PAYMENT_METHODS.find(m => m.id === selectedMethod)?.icon}</span>
                  <span>{PAYMENT_METHODS.find(m => m.id === selectedMethod)?.label}</span>
                </div>
              )}

              {serverError && (
                <div style={{ padding: "10px 12px", borderRadius: "var(--r-md)",
                  background: "rgba(255,59,59,0.08)",
                  border: "1px solid rgba(255,59,59,0.2)",
                  color: "var(--danger)", fontSize: "12px", marginBottom: "14px" }}>
                  {serverError}
                </div>
              )}

              <button type="submit" disabled={isLoading || !selectedMethod}
                className="btn btn-accent"
                style={{ width: "100%", justifyContent: "center",
                  opacity: isLoading ? 0.7 : 1 }}>
                {isLoading ? "Procesando..." :
                  selectedMethod === "global66"
                    ? "Ver instrucciones de pago"
                    : "Ir al pago →"}
              </button>

              <Link to="/cart" style={{ display: "block", textAlign: "center",
                fontSize: "13px", color: "var(--text-3)", marginTop: "14px",
                transition: "color var(--dur)" }}
                className="hover:text-[var(--text-2)]">
                ← Volver al carrito
              </Link>

              <p style={{ fontSize: "11px", color: "var(--text-3)",
                textAlign: "center", marginTop: "12px" }}>
                Pago 100% seguro
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}