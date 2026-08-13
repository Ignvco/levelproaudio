// pages/Checkout.jsx — Checkout estilo editorial premium
import { useState, useEffect, useMemo } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Seo from "../components/Seo"
import {
  ArrowLeft, ArrowRight, User, MapPin, CreditCard,
  Globe, Landmark, ShieldCheck, ShoppingBag,
} from "lucide-react"
import api from "../api/client"
import { createPayment, getPaymentMethods } from "../api/payments.api"
import { cancelOrder } from "../api/orders.api"
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

// Ícono y color por método — el catálogo de métodos viene del backend
// (configurable desde el admin); acá solo resolvemos la parte visual.
const METHOD_ICON = {
  mercadopago_cl: CreditCard,
  mercadopago_ar: CreditCard,
  paypal:         Globe,
  payoneer:       Globe,
  dlocal:         CreditCard,
  transfer:       Landmark,
  global66:       Landmark,
}

function Eyebrow({ children }) {
  return (
    <p style={{ fontFamily: "var(--font-sans)", fontSize: "11px",
      color: "var(--accent)", textTransform: "uppercase",
      letterSpacing: "0.15em", fontWeight: 700 }}>
      {children}
    </p>
  )
}

function Field({ label, error, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "12px", fontWeight: 600,
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

// Section — card oscura con encabezado + ícono lucide
function Section({ title, icon: Icon, children }) {
  return (
    <div style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: "var(--r-2xl)", overflow: "hidden" }}>
      <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ width: "34px", height: "34px", borderRadius: "50%",
          background: "rgba(26,255,110,0.08)", border: "1px solid rgba(26,255,110,0.2)",
          color: "var(--accent)", display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0 }}>
          <Icon size={16} />
        </span>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "15px",
          fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text)" }}>{title}</p>
      </div>
      <div style={{ padding: "24px" }}>{children}</div>
    </div>
  )
}

export default function Checkout() {
  const [selectedMethod, setSelectedMethod] = useState("")
  const [isLoading, setIsLoading]           = useState(false)
  const [serverError, setServerError]       = useState("")
  const { items, clearCart, getTotal, pointsToRedeem } = useCartStore()
  const { user }                            = useAuthStore()
  const navigate                            = useNavigate()
  const total                               = getTotal()

  // Métodos de pago activos (configurables desde el admin). Por ahora
  // en CLP; cuando entre el multi-moneda, se pasa la moneda elegida.
  const { data: methodsData } = useQuery({
    queryKey: ["payment-methods", "CLP"],
    queryFn:  () => getPaymentMethods("CLP"),
  })
  const paymentMethods = useMemo(
    () => (methodsData?.methods || []).map(m => ({
      id:    m.id,
      label: m.label,
      desc:  m.description,
      Icon:  METHOD_ICON[m.id] || CreditCard,
    })),
    [methodsData]
  )
  const bankAccounts = methodsData?.bank_accounts || []

  // Si no hay método elegido y ya llegaron los métodos, elegir el primero
  useEffect(() => {
    if (!selectedMethod && paymentMethods.length > 0) {
      setSelectedMethod(paymentMethods[0].id)
    }
  }, [selectedMethod, paymentMethods])

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
        loyalty_points_redeemed: pointsToRedeem || 0,
        items: items.map(i => ({
          product:      i.product.id,
          product_name: i.product.name,
          price:        i.product.price,
          quantity:     i.quantity,
        })),
      })

      let paymentData
      try {
        paymentData = await createPayment(order.id, selectedMethod)
      } catch (paymentError) {
        // La orden ya descontó stock — si la pasarela falla acá, hay
        // que cancelarla de inmediato (devuelve el stock) para que el
        // reintento del cliente empiece limpio, en vez de quedar una
        // orden huérfana sumándose cada vez que reintenta.
        try {
          await cancelOrder(order.id)
        } catch {
          // Si ni la cancelación funciona, seguimos igual al catch de
          // afuera — el mensaje de error ya avisa que hay que reintentar.
        }
        throw paymentError
      }

      if (selectedMethod === "transfer") {
        clearCart()
        navigate(`/payment/transfer/${order.id}`, {
          state: { bankAccounts, amount: total, currency: "CLP" }
        })
      } else if (selectedMethod === "global66") {
        clearCart()
        navigate(`/payment/transfer/${order.id}`, { state: { transferData: paymentData } })
      } else if (selectedMethod === "mercadopago_cl" || selectedMethod === "mercadopago_ar") {
        window.location.href = paymentData.init_point || paymentData.sandbox_url
      } else if (selectedMethod === "paypal") {
        window.location.href = paymentData.approve_url
      }
    } catch (e) {
      setServerError(e?.response?.data?.error || "Error al procesar. Intenta de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  const pageWrap = {
    background: "var(--bg)", minHeight: "100vh",
    paddingTop: "clamp(100px, 12vw, 140px)",
    paddingBottom: "clamp(60px, 8vw, 100px)",
  }

  if (!items.length) return (
    <div style={pageWrap}>
      <Seo title="Finalizar compra" noindex />
      <div className="lp-container" style={{ display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: "22px",
        textAlign: "center", minHeight: "50vh" }} data-testid="checkout-empty">
        <div style={{ width: "76px", height: "76px", borderRadius: "50%",
          background: "rgba(26,255,110,0.08)", border: "1px solid rgba(26,255,110,0.2)",
          color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ShoppingBag size={34} />
        </div>
        <p style={{ color: "var(--text-2)", fontSize: "15px" }}>Tu carrito está vacío.</p>
        <Link to="/shop" style={{ display: "inline-flex", alignItems: "center", gap: "10px",
          padding: "14px 14px 14px 24px", borderRadius: "var(--r-full)",
          background: "var(--accent)", color: "#000", fontSize: "14px", fontWeight: 700,
          textDecoration: "none", boxShadow: "0 8px 30px rgba(26,255,110,0.3)" }}>
          Ir a la tienda
          <span style={{ width: "26px", height: "26px", borderRadius: "50%", background: "#000",
            color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowRight size={14} />
          </span>
        </Link>
      </div>
    </div>
  )

  return (
    <div style={pageWrap} data-testid="checkout-page">
      <Seo title="Finalizar compra" noindex />
      <div className="lp-container">

        {/* Header */}
        <div style={{ marginBottom: "clamp(28px, 4vw, 44px)" }}>
          <Link to="/cart" data-testid="checkout-back" style={{ fontSize: "13px",
            color: "var(--text-3)", display: "inline-flex", alignItems: "center", gap: "7px",
            marginBottom: "18px", textDecoration: "none", transition: "color var(--dur)" }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-3)"}>
            <ArrowLeft size={14} /> Volver al carrito
          </Link>
          <Eyebrow>· Pago seguro</Eyebrow>
          <h1 className="display-bold" style={{ fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 4vw, 3.2rem)", fontWeight: 800,
            letterSpacing: "-0.03em", lineHeight: 1, marginTop: "12px", color: "var(--text)" }}>
            Finalizá tu compra
          </h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 380px",
            gap: "clamp(24px, 3vw, 40px)", alignItems: "start" }} className="checkout-grid">

            {/* Columna izquierda */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

              <Section title="Datos de contacto" icon={User}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <Field label="Nombre" error={errors.first_name?.message}>
                    <input {...register("first_name")} className="input" placeholder="Juan" />
                  </Field>
                  <Field label="Apellido" error={errors.last_name?.message}>
                    <input {...register("last_name")} className="input" placeholder="García" />
                  </Field>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
                  gap: "14px", marginTop: "14px" }}>
                  <Field label="Email" error={errors.email?.message}>
                    <input type="email" {...register("email")} className="input" placeholder="tu@email.com" />
                  </Field>
                  <Field label="Teléfono" error={errors.phone?.message}>
                    <input {...register("phone")} className="input" placeholder="+56 9 1234 5678" />
                  </Field>
                </div>
              </Section>

              <Section title="Dirección de envío" icon={MapPin}>
                <Field label="Calle y número" error={errors.address_street?.message}>
                  <input {...register("address_street")} className="input" placeholder="Av. Providencia 1234" />
                </Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
                  gap: "14px", marginTop: "14px" }}>
                  <Field label="Ciudad" error={errors.address_city?.message}>
                    <input {...register("address_city")} className="input" placeholder="Santiago" />
                  </Field>
                  <Field label="Región" error={errors.address_province?.message}>
                    <input {...register("address_province")} className="input" placeholder="Metropolitana" />
                  </Field>
                </div>
                <div style={{ marginTop: "14px" }}>
                  <Field label="Notas (opcional)">
                    <textarea {...register("notes")} className="input" rows={2}
                      style={{ resize: "none" }} placeholder="Instrucciones especiales de entrega..." />
                  </Field>
                </div>
              </Section>

              <Section title="Método de pago" icon={CreditCard}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {paymentMethods.map(m => {
                    const active = selectedMethod === m.id
                    return (
                      <button key={m.id} type="button"
                        data-testid={`checkout-method-${m.id}`}
                        onClick={() => setSelectedMethod(m.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: "14px",
                          padding: "16px 18px", borderRadius: "var(--r-xl)",
                          textAlign: "left", cursor: "pointer", width: "100%",
                          background: active ? "rgba(26,255,110,0.05)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${active ? "rgba(26,255,110,0.35)" : "rgba(255,255,255,0.08)"}`,
                          transition: "all var(--dur) var(--ease)",
                        }}>
                        <div style={{ width: "18px", height: "18px", borderRadius: "50%",
                          border: `2px solid ${active ? "var(--accent)" : "var(--border)"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, transition: "border-color var(--dur)" }}>
                          {active && <div style={{ width: "8px", height: "8px",
                            borderRadius: "50%", background: "var(--accent)" }} />}
                        </div>
                        <span style={{ color: active ? "var(--accent)" : "var(--text-2)",
                          display: "flex", alignItems: "center" }}>
                          <m.Icon size={22} />
                        </span>
                        <div>
                          <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)",
                            marginBottom: "2px" }}>{m.label}</p>
                          <p style={{ fontSize: "12px", color: "var(--text-3)" }}>{m.desc}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </Section>
            </div>

            {/* Resumen sticky */}
            <div data-testid="checkout-summary" style={{
              background: "#121212", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "var(--r-2xl)", padding: "26px",
              position: "sticky", top: "100px" }}>
              <Eyebrow>· Tu pedido</Eyebrow>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "18px",
                fontWeight: 700, letterSpacing: "-0.01em", margin: "10px 0 20px",
                color: "var(--text)" }}>
                Resumen
              </h2>

              <div style={{ display: "flex", flexDirection: "column",
                gap: "10px", marginBottom: "16px" }}>
                {items.map(item => (
                  <div key={item.product.id} style={{ display: "flex",
                    justifyContent: "space-between", fontSize: "13px",
                    alignItems: "center", gap: "8px" }}>
                    <span style={{ color: "var(--text-2)", overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {item.product.name}
                      <span style={{ color: "var(--text-3)" }}> ×{item.quantity}</span>
                    </span>
                    <span style={{ flexShrink: 0, color: "var(--text-2)", fontWeight: 600,
                      fontVariantNumeric: "tabular-nums" }}>
                      ${(Number(item.product.price) * item.quantity).toLocaleString("es-CL")}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px",
                marginBottom: "24px", display: "flex", justifyContent: "space-between",
                alignItems: "baseline" }}>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>Total</span>
                <span data-testid="checkout-total" style={{ fontFamily: "var(--font-display)",
                  fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em",
                  color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                  ${Number(total || 0).toLocaleString("es-CL")}
                </span>
              </div>

              {selectedMethod && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px",
                  padding: "12px 14px", borderRadius: "var(--r-lg)",
                  background: "rgba(26,255,110,0.05)", border: "1px solid rgba(26,255,110,0.15)",
                  fontSize: "13px", marginBottom: "16px", color: "var(--text)" }}>
                  {(() => {
                    const m = paymentMethods.find(m => m.id === selectedMethod)
                    return m ? <><span style={{ color: "var(--accent)", display: "flex" }}><m.Icon size={16} /></span><span>{m.label}</span></> : null
                  })()}
                </div>
              )}

              {serverError && (
                <div data-testid="checkout-error" style={{ padding: "12px 14px",
                  borderRadius: "var(--r-md)", background: "rgba(255,77,77,0.08)",
                  border: "1px solid rgba(255,77,77,0.2)", color: "var(--danger)",
                  fontSize: "13px", marginBottom: "14px" }}>
                  {serverError}
                </div>
              )}

              <button type="submit" disabled={isLoading || !selectedMethod}
                data-testid="checkout-submit"
                style={{ width: "100%", display: "inline-flex", alignItems: "center",
                  justifyContent: "center", gap: "10px",
                  padding: "15px 14px 15px 24px", borderRadius: "var(--r-full)",
                  background: "var(--accent)", color: "#000", border: "none",
                  fontSize: "15px", fontWeight: 700, fontFamily: "var(--font-sans)",
                  cursor: isLoading ? "wait" : "pointer", opacity: isLoading ? 0.7 : 1,
                  boxShadow: "0 8px 30px rgba(26,255,110,0.3)",
                  transition: "transform 200ms var(--ease)" }}
                onMouseEnter={e => { if (!isLoading) e.currentTarget.style.transform = "translateY(-2px)" }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)" }}>
                {isLoading ? "Procesando..." :
                  (selectedMethod === "global66" || selectedMethod === "transfer") ? "Ver instrucciones de transferencia" : "Ir al pago"}
                {!isLoading && (
                  <span style={{ width: "26px", height: "26px", borderRadius: "50%",
                    background: "#000", color: "var(--accent)", display: "flex",
                    alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <ArrowRight size={14} />
                  </span>
                )}
              </button>

              <p style={{ fontSize: "11px", color: "var(--text-3)", textAlign: "center",
                marginTop: "14px", display: "flex", alignItems: "center",
                justifyContent: "center", gap: "6px" }}>
                <ShieldCheck size={13} color="var(--accent)" /> Compra 100% segura
              </p>
            </div>
          </div>
        </form>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .checkout-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
