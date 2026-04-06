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
  { id: "mercadopago_cl", label: "MercadoPago",   icon: "💳", desc: "Tarjetas, Khipu, efectivo" },
  { id: "paypal",         label: "PayPal",         icon: "🌐", desc: "Tarjetas internacionales"  },
  { id: "global66",       label: "Transferencia",  icon: "🏦", desc: "Global66 · 24hs hábiles"  },
]

function Field({ label, error, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
        color: "var(--text-2)", marginBottom: "8px", letterSpacing: "0.02em" }}>
        {label}
      </label>
      {children}
      {error && (
        <p style={{ fontSize: "11px", color: "var(--danger)", marginTop: "5px" }}>
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
      first_name:       user?.first_name       || "",
      last_name:        user?.last_name        || "",
      email:            user?.email            || "",
      phone:            user?.phone            || "",
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

      if (selectedMethod === "global66") {
        clearCart()
        navigate(`/payment/transfer/${order.id}`, { state: { transferData: paymentData } })
      } else if (selectedMethod === "mercadopago_cl" || selectedMethod === "mercadopago_ar") {
        window.location.href = paymentData.sandbox_url || paymentData.init_point
      } else if (selectedMethod === "paypal") {
        window.location.href = paymentData.approve_url
      }
    } catch (e) {
      setServerError(e?.response?.data?.error || "Error al procesar. Intenta de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  if (!items.length) return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center",
      justifyContent: "center", flexDirection: "column", gap: "16px",
      padding: "40px" }}>
      <span style={{ fontSize: "48px" }}>🛒</span>
      <p style={{ color: "var(--text-2)", fontSize: "15px" }}>
        Tu carrito está vacío.
      </p>
      <Link to="/shop" className="btn btn-accent">Ir a la tienda</Link>
    </div>
  )

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh",
      padding: "clamp(40px, 6vw, 80px) 0" }}>
      <div style={{ maxWidth: "var(--container)", margin: "0 auto",
        padding: "0 clamp(20px, 5vw, 60px)" }}>

        {/* Header */}
        <div style={{ marginBottom: "48px" }}>
          <Link to="/cart" style={{ fontSize: "13px", color: "var(--text-3)",
            display: "inline-flex", alignItems: "center", gap: "6px",
            marginBottom: "16px", transition: "color var(--dur)" }}
            className="hover-accent">
            ← Volver al carrito
          </Link>
          <h1 style={{ fontFamily: "var(--font-serif)",
            fontSize: "clamp(2rem, 5vw, 4rem)",
            fontWeight: 300, letterSpacing: "-0.02em" }}>
            Checkout
          </h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ display: "grid",
            gridTemplateColumns: "1fr 360px", gap: "48px",
            alignItems: "start" }}
            className="checkout-grid"
          >
            {/* Columna izquierda */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

              {/* Datos de contacto */}
              <Section title="Datos de contacto" icon="◈">
                <div style={{ display: "grid",
                  gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <Field label="Nombre" error={errors.first_name?.message}>
                    <input {...register("first_name")} className="input"
                      placeholder="Juan" />
                  </Field>
                  <Field label="Apellido" error={errors.last_name?.message}>
                    <input {...register("last_name")} className="input"
                      placeholder="García" />
                  </Field>
                </div>
                <div style={{ display: "grid",
                  gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: "14px" }}>
                  <Field label="Email" error={errors.email?.message}>
                    <input type="email" {...register("email")} className="input"
                      placeholder="tu@email.com" />
                  </Field>
                  <Field label="Teléfono" error={errors.phone?.message}>
                    <input {...register("phone")} className="input"
                      placeholder="+56 9 1234 5678" />
                  </Field>
                </div>
              </Section>

              {/* Dirección de envío */}
              <Section title="Dirección de envío" icon="◫">
                <Field label="Calle y número" error={errors.address_street?.message}>
                  <input {...register("address_street")} className="input"
                    placeholder="Av. Providencia 1234" />
                </Field>
                <div style={{ display: "grid",
                  gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: "14px" }}>
                  <Field label="Ciudad" error={errors.address_city?.message}>
                    <input {...register("address_city")} className="input"
                      placeholder="Santiago" />
                  </Field>
                  <Field label="Región" error={errors.address_province?.message}>
                    <input {...register("address_province")} className="input"
                      placeholder="Metropolitana" />
                  </Field>
                </div>
                <div style={{ marginTop: "14px" }}>
                  <Field label="Notas (opcional)">
                    <textarea {...register("notes")} className="input"
                      rows={2} style={{ resize: "none" }}
                      placeholder="Instrucciones especiales de entrega..." />
                  </Field>
                </div>
              </Section>

              {/* Método de pago */}
              <Section title="Método de pago" icon="◎">
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {PAYMENT_METHODS.map(m => (
                    <button key={m.id} type="button"
                      onClick={() => setSelectedMethod(m.id)}
                      style={{
                        display:    "flex",
                        alignItems: "center",
                        gap:        "14px",
                        padding:    "16px 18px",
                        borderRadius: "var(--r-xl)",
                        textAlign:  "left",
                        cursor:     "pointer",
                        background: selectedMethod === m.id
                          ? "rgba(26,255,110,0.04)" : "var(--surface-2)",
                        border:     `1px solid ${selectedMethod === m.id
                          ? "rgba(26,255,110,0.3)" : "var(--border)"}`,
                        transition: "all var(--dur) var(--ease)",
                        width:      "100%",
                      }}>
                      {/* Radio */}
                      <div style={{
                        width:           "18px",
                        height:          "18px",
                        borderRadius:    "50%",
                        border:          `2px solid ${selectedMethod === m.id
                          ? "var(--accent)" : "var(--border)"}`,
                        display:         "flex",
                        alignItems:      "center",
                        justifyContent:  "center",
                        flexShrink:      0,
                        transition:      "border-color var(--dur)",
                      }}>
                        {selectedMethod === m.id && (
                          <div style={{ width: "8px", height: "8px",
                            borderRadius: "50%", background: "var(--accent)" }} />
                        )}
                      </div>
                      <span style={{ fontSize: "22px" }}>{m.icon}</span>
                      <div>
                        <p style={{ fontSize: "14px", fontWeight: 500,
                          marginBottom: "2px" }}>{m.label}</p>
                        <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                          {m.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </Section>
            </div>

            {/* Resumen sticky */}
            <div style={{
              background:   "var(--surface)",
              border:       "1px solid var(--border)",
              borderRadius: "var(--r-2xl)",
              padding:      "28px",
              position:     "sticky",
              top:          "88px",
            }}>
              <h2 style={{ fontSize: "15px", fontWeight: 500,
                marginBottom: "20px" }}>
                Tu pedido
              </h2>

              {/* Items */}
              <div style={{ display: "flex", flexDirection: "column",
                gap: "10px", marginBottom: "16px" }}>
                {items.map(item => (
                  <div key={item.product.id} style={{ display: "flex",
                    justifyContent: "space-between", fontSize: "13px",
                    alignItems: "center", gap: "8px" }}>
                    <span style={{ color: "var(--text-2)", overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {item.product.name}
                      <span style={{ color: "var(--text-3)" }}>
                        {" "}×{item.quantity}
                      </span>
                    </span>
                    <span style={{ flexShrink: 0, fontWeight: 500 }}>
                      ${(Number(item.product.price) * item.quantity).toLocaleString("es-CL")}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div style={{ borderTop: "1px solid var(--border)",
                paddingTop: "16px", marginBottom: "24px",
                display: "flex", justifyContent: "space-between",
                alignItems: "baseline" }}>
                <span style={{ fontSize: "14px", fontWeight: 500 }}>Total</span>
                <span style={{ fontFamily: "var(--font-serif)", fontSize: "2rem" }}>
                  ${Number(total || 0).toLocaleString("es-CL")}
                </span>
              </div>

              {/* Método seleccionado */}
              {selectedMethod && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px",
                  padding: "10px 14px", borderRadius: "var(--r-lg)",
                  background: "rgba(26,255,110,0.04)",
                  border: "1px solid rgba(26,255,110,0.12)",
                  fontSize: "13px", marginBottom: "16px",
                  color: "var(--text-2)" }}>
                  <span>{PAYMENT_METHODS.find(m => m.id === selectedMethod)?.icon}</span>
                  <span>{PAYMENT_METHODS.find(m => m.id === selectedMethod)?.label}</span>
                </div>
              )}

              {serverError && (
                <div style={{ padding: "12px 14px", borderRadius: "var(--r-md)",
                  background: "rgba(255,77,77,0.08)",
                  border: "1px solid rgba(255,77,77,0.2)",
                  color: "var(--danger)", fontSize: "13px",
                  marginBottom: "14px" }}>
                  {serverError}
                </div>
              )}

              <button type="submit" disabled={isLoading || !selectedMethod}
                className="btn btn-accent"
                style={{ width: "100%", justifyContent: "center",
                  fontSize: "15px", padding: "15px",
                  opacity: isLoading ? 0.7 : 1 }}>
                {isLoading ? "Procesando..." :
                  selectedMethod === "global66"
                    ? "Ver instrucciones de transferencia"
                    : "Ir al pago →"}
              </button>

              <p style={{ fontSize: "11px", color: "var(--text-3)",
                textAlign: "center", marginTop: "14px",
                display: "flex", alignItems: "center",
                justifyContent: "center", gap: "6px" }}>
                🔒 Compra 100% segura
              </p>
            </div>
          </div>
        </form>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .checkout-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

// Componente Section reutilizable
function Section({ title, icon, children }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-2xl)", overflow: "hidden" }}>
      <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)",
        background: "var(--surface-2)", display: "flex", alignItems: "center",
        gap: "10px" }}>
        <span style={{ fontSize: "13px", color: "var(--text-3)" }}>{icon}</span>
        <p style={{ fontSize: "14px", fontWeight: 500 }}>{title}</p>
      </div>
      <div style={{ padding: "24px" }}>{children}</div>
    </div>
  )
}