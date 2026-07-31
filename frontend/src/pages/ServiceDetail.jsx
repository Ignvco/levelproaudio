// pages/ServiceDetail.jsx — Detalle premium basado en cards
import { useParams, Link, useNavigate } from "react-router-dom"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useState, useEffect } from "react"
import {
  Check, Clock, ArrowRight, MessageCircle, SearchX,
  Tag, Layers, Zap, ShieldCheck, Sparkles, CreditCard, Globe,
} from "lucide-react"
import { getService, getServices } from "../api/services.api"
import { createServiceRequest, checkoutService } from "../api/services.api"
import { createPayment } from "../api/payments.api"
import { useAuthStore } from "../store/authStore"
import { RichText } from "../components/ui/RichText"
import { showToast } from "../components/ui/ToastNotification"
import ServiceProcess from "../components/services/ServiceProcess"
import ServiceCard from "../components/services/ServiceCard"
import { serviceCover } from "../utils/serviceCover"
import Seo from "../components/Seo"

const CARD = {
  background: "#121212", border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "22px", padding: "clamp(22px, 3vw, 32px)",
}
const EYEBROW = { fontSize: "11px", fontWeight: 700, color: "var(--accent)",
  textTransform: "uppercase", letterSpacing: "0.15em" }

function Chip({ Icon, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px",
      padding: "9px 15px", borderRadius: "9999px", fontSize: "13px", fontWeight: 500,
      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
      color: "var(--text-2)" }}>
      <Icon size={15} style={{ color: "var(--accent)" }} /> {children}
    </span>
  )
}

export default function ServiceDetail() {
  const { slug } = useParams()
  const { user, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "",
    email: user?.email || "",
    phone: user?.phone || "",
    message: "", budget: "", preferred_date: "",
  })
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  const [payLoading, setPayLoading] = useState(false)

  // Precargar datos del usuario logueado (cuando el store hidrata)
  useEffect(() => {
    if (!user) return
    setForm(prev => ({
      ...prev,
      name:  prev.name  || (user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : ""),
      email: prev.email || user.email || "",
      phone: prev.phone || user.phone || "",
    }))
  }, [user])

  const { data: service, isLoading, isError } = useQuery({
    queryKey: ["service", slug],
    queryFn:  () => getService(slug),
  })

  const { data: allData } = useQuery({
    queryKey: ["services", "all-for-related"],
    queryFn:  () => getServices(),
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const budgetNum = form.budget ? Number(String(form.budget).replace(/[^\d]/g, "")) : null
      const fallbackName = user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : ""
      await createServiceRequest({
        service: service.id,
        name: form.name || fallbackName,
        email: form.email || user?.email || "",
        phone: form.phone,
        message: form.message,
        budget: budgetNum && budgetNum > 0 ? budgetNum : null,
        preferred_date: form.preferred_date || null,
      })
    },
    onSuccess: () => setSent(true),
    onError:   (err) => {
      const data = err?.response?.data
      const msg = data
        ? (typeof data === "string" ? data : Object.values(data).flat().join(" "))
        : "Error al enviar. Intenta de nuevo."
      setError(msg)
    },
  })

  if (isLoading) return (
    <div className="lp-container" style={{ paddingTop: "clamp(100px, 12vw, 140px)",
      paddingBottom: "80px", display: "flex", flexDirection: "column", gap: "16px" }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton" style={{ height: i === 0 ? "300px" : "60px" }} />
      ))}
    </div>
  )

  if (isError || !service) return (
    <div style={{ textAlign: "center", padding: "clamp(120px,16vw,160px) 24px" }}>
      <div style={{ width: "72px", height: "72px", borderRadius: "50%",
        background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)",
        color: "var(--text-3)", display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 20px" }}>
        <SearchX size={30} />
      </div>
      <h2 className="display-bold" style={{ fontFamily: "var(--font-display)", fontWeight: 800,
        letterSpacing: "-0.03em", marginBottom: "20px", color: "var(--text)" }}>
        Servicio no encontrado
      </h2>
      <Link to="/services" style={{ display: "inline-flex", alignItems: "center", gap: "8px",
        padding: "12px 22px", borderRadius: "var(--r-full)", background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--border)", color: "var(--text)", textDecoration: "none",
        fontSize: "14px", fontWeight: 600 }}>← Servicios</Link>
    </div>
  )

  const inputSt = {
    width: "100%", padding: "14px 16px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "16px", color: "var(--text)",
    fontSize: "15px", outline: "none",
    transition: "border-color 220ms var(--ease), background 220ms var(--ease)",
  }
  const labelSt = { display: "block", fontSize: "13px", fontWeight: 600,
    color: "var(--text)", marginBottom: "9px" }
  const onFocus = e => { e.target.style.borderColor = "rgba(26,255,110,0.5)"; e.target.style.background = "rgba(255,255,255,0.06)" }
  const onBlur  = e => { e.target.style.borderColor = "rgba(255,255,255,0.06)"; e.target.style.background = "rgba(255,255,255,0.04)" }

  const cover = serviceCover(service)
  const related = (allData?.results || allData || [])
    .filter(s => s.slug !== service.slug).slice(0, 3)
  const modalidad = service.price_type_display || "A cotizar"
  const isFixed = service.price_type === "fixed" && Number(service.price) > 0

  const handlePay = async (provider) => {
    if (!isAuthenticated) {
      showToast("Iniciá sesión para pagar el servicio", "error")
      navigate("/login")
      return
    }
    try {
      setPayLoading(true)
      const { order_id } = await checkoutService(service.slug)
      const pay = await createPayment(order_id, provider)
      const url = pay.init_point || pay.approve_url
      if (url) { window.location.href = url; return }
      showToast("No se pudo iniciar el pago. Intentá de nuevo.", "error")
      setPayLoading(false)
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.detail || "Error al iniciar el pago."
      showToast(msg, "error")
      setPayLoading(false)
    }
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Seo type="product" title={service.name}
        description={service.short_description || service.description?.slice(0, 160)}
        image={cover} />

      {/* ── Hero con imagen difuminada ── */}
      <div style={{ position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0,
          backgroundImage: `url(${cover})`, backgroundSize: "cover",
          backgroundPosition: "center", filter: "saturate(1.05)" }} />
        <div style={{ position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(8,8,8,0.55) 0%, rgba(8,8,8,0.8) 55%, var(--bg) 100%)" }} />
        <div className="lp-container" style={{ position: "relative",
          paddingTop: "clamp(110px, 13vw, 160px)", paddingBottom: "clamp(40px, 6vw, 72px)" }}>

          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px",
            fontSize: "13px", color: "var(--text-3)", marginBottom: "22px" }}>
            <Link to="/services" className="hover-accent" style={{ transition: "color var(--dur)" }}>Servicios</Link>
            <span>/</span>
            <span style={{ color: "var(--text-2)" }}>{service.name}</span>
          </div>

          {service.category && (
            <p style={{ ...EYEBROW, marginBottom: "14px" }}>· {service.category.name}</p>
          )}
          <h1 className="display-bold" style={{ fontFamily: "var(--font-display)",
            fontSize: "clamp(2.2rem, 5vw, 4rem)", fontWeight: 800, letterSpacing: "-0.035em",
            lineHeight: 1.0, marginBottom: "18px", color: "#fff", maxWidth: "800px" }}>
            {service.name}
          </h1>
          {service.short_description && (
            <p style={{ fontSize: "clamp(15px,1.8vw,18px)", color: "rgba(255,255,255,0.82)",
              lineHeight: 1.6, maxWidth: "620px", marginBottom: "26px" }}>
              {service.short_description}
            </p>
          )}

          {/* Chips meta */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            <Chip Icon={Tag}>{service.price_display}</Chip>
            <Chip Icon={Layers}>{modalidad}</Chip>
            {service.duration_hours && (
              <Chip Icon={Clock}>{service.duration_hours} hora{service.duration_hours !== 1 ? "s" : ""}</Chip>
            )}
            <Chip Icon={Zap}>Respuesta en 24 hs</Chip>
          </div>
        </div>
      </div>

      {/* ── Contenido ── */}
      <div className="lp-container" style={{ paddingBottom: "clamp(60px, 8vw, 100px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 400px",
          gap: "clamp(24px, 3vw, 40px)", alignItems: "start" }} className="service-grid">

          {/* Columna izquierda: cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {service.description && (
              <div style={CARD} data-testid="service-about-card">
                <p style={EYEBROW}>· Sobre el servicio</p>
                <div style={{ marginTop: "16px" }}>
                  <RichText text={service.description} size="15.5px" />
                </div>
              </div>
            )}

            {service.deliverables_list?.length > 0 && (
              <div style={CARD} data-testid="service-includes-card">
                <p style={{ ...EYEBROW, marginBottom: "20px" }}>· Qué incluye</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "14px" }}>
                  {service.deliverables_list.map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "12px",
                      padding: "14px 16px", borderRadius: "14px",
                      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <span style={{ width: "22px", height: "22px", borderRadius: "50%",
                        background: "rgba(26,255,110,0.12)", border: "1px solid rgba(26,255,110,0.3)",
                        color: "var(--accent)", flexShrink: 0, marginTop: "1px",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Check size={13} strokeWidth={3} />
                      </span>
                      <p style={{ fontSize: "14px", color: "var(--text-2)", lineHeight: 1.5 }}>{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cómo trabajamos */}
            <div style={CARD} data-testid="service-process-card">
              <p style={{ ...EYEBROW, marginBottom: "22px" }}>· Cómo trabajamos</p>
              <ServiceProcess variant="card" />
            </div>

            {/* Card promocional oscura con imagen */}
            <div data-testid="service-promo-card" style={{ position: "relative", overflow: "hidden",
              borderRadius: "var(--r-2xl)", border: "1px solid rgba(255,255,255,0.06)",
              minHeight: "300px", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <img
                src="https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200"
                alt="" loading="lazy"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                  objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0,
                background: "linear-gradient(115deg, rgba(8,8,8,0.94) 0%, rgba(8,8,8,0.78) 45%, rgba(8,8,8,0.35) 100%)" }} />
              <div style={{ position: "absolute", inset: 0,
                boxShadow: "inset 0 0 120px rgba(26,255,110,0.06)" }} />
              <div style={{ position: "relative", padding: "clamp(28px, 4vw, 44px)", maxWidth: "560px" }}>
                <p style={{ ...EYEBROW, color: "var(--accent)", marginBottom: "14px" }}>· Tu proyecto</p>
                <h3 className="display-bold" style={{ fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.7rem, 3.4vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.03em",
                  lineHeight: 1.02, color: "#fff", marginBottom: "14px" }}>
                  Hablemos de tu proyecto
                </h3>
                <p style={{ fontSize: "14.5px", color: "rgba(255,255,255,0.72)", lineHeight: 1.6,
                  marginBottom: "24px", maxWidth: "440px" }}>
                  Contanos qué necesitás y armamos una propuesta a medida para tu iglesia,
                  estudio o evento. Sin compromiso y con respuesta en menos de 24 horas.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                  {isFixed ? (
                    <button onClick={() => handlePay("mercadopago_cl")} data-testid="service-promo-cta"
                      style={{ display: "inline-flex", alignItems: "center", gap: "10px",
                        padding: "13px 12px 13px 22px", borderRadius: "var(--r-full)",
                        background: "var(--accent)", color: "#000", border: "none", cursor: "pointer",
                        fontSize: "14px", fontWeight: 700, boxShadow: "0 8px 30px rgba(26,255,110,0.28)" }}>
                      Contratar ahora
                      <span style={{ width: "26px", height: "26px", borderRadius: "50%", background: "#000",
                        color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ArrowRight size={14} />
                      </span>
                    </button>
                  ) : (
                    <a href="https://wa.me/5492622635045" target="_blank" rel="noreferrer"
                      data-testid="service-promo-cta"
                      style={{ display: "inline-flex", alignItems: "center", gap: "10px",
                        padding: "13px 22px", borderRadius: "var(--r-full)",
                        background: "var(--accent)", color: "#000", textDecoration: "none",
                        fontSize: "14px", fontWeight: 700, boxShadow: "0 8px 30px rgba(26,255,110,0.28)" }}>
                      <MessageCircle size={16} /> Escribinos por WhatsApp
                    </a>
                  )}
                  <a href="#solicitar-card"
                    onClick={(e) => { e.preventDefault(); document.querySelector('[data-testid="service-quote-card"]')?.scrollIntoView({ behavior: "smooth", block: "center" }) }}
                    style={{ display: "inline-flex", alignItems: "center", gap: "8px",
                      padding: "13px 22px", borderRadius: "var(--r-full)",
                      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)",
                      color: "#fff", textDecoration: "none", fontSize: "14px", fontWeight: 600,
                      backdropFilter: "blur(6px)" }}>
                    Ver detalles
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Columna derecha: formulario sticky */}
          <div style={{ position: "sticky", top: "96px", display: "flex",
            flexDirection: "column", gap: "14px" }} className="service-form">
            <div data-testid="service-quote-card" style={{ background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-2xl)", overflow: "hidden",
              boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}>

              {/* Encabezado con precio */}
              <div style={{ padding: "22px 24px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "linear-gradient(135deg, rgba(26,255,110,0.06), transparent)" }}>
                <p style={EYEBROW}>{isFixed ? "· Contratar" : "· Solicitar"}</p>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between",
                  gap: "10px", marginTop: "12px" }}>
                  <h2 className="display-bold" style={{ fontFamily: "var(--font-display)",
                    fontSize: "clamp(1.8rem, 2.4vw, 2.2rem)", fontWeight: 800,
                    letterSpacing: "-0.03em", color: "var(--text)", lineHeight: 1 }}>
                    {service.price_display}
                  </h2>
                  <span style={{ fontSize: "12px", color: "var(--text-3)" }}>{modalidad}</span>
                </div>
                <p style={{ fontSize: "13px", color: "var(--text-2)", marginTop: "10px", lineHeight: 1.55 }}>
                  {isFixed
                    ? "Pagá online de forma segura y coordinamos la entrega del servicio."
                    : "Dejanos tus datos y te contactamos en menos de 24 hs."}
                </p>
              </div>

              {isFixed ? (
                <div data-testid="service-pay-block" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <p style={{ fontSize: "12px", color: "var(--text-3)", fontWeight: 600, marginBottom: "2px" }}>
                    Elegí cómo pagar:
                  </p>
                  {[
                    { id: "mercadopago_cl", label: "MercadoPago", Icon: CreditCard, desc: "Tarjetas, Khipu, efectivo" },
                    { id: "paypal",         label: "PayPal",      Icon: Globe,      desc: "Tarjetas internacionales" },
                  ].map(({ id, label, Icon, desc }) => (
                    <button key={id} data-testid={`service-pay-${id}`} disabled={payLoading}
                      onClick={() => handlePay(id)}
                      style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%",
                        padding: "14px 16px", borderRadius: "14px", cursor: payLoading ? "wait" : "pointer",
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                        color: "#fff", textAlign: "left", opacity: payLoading ? 0.6 : 1 }}
                      onMouseEnter={e => !payLoading && (e.currentTarget.style.borderColor = "rgba(26,255,110,0.4)")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}>
                      <Icon size={20} style={{ color: "var(--accent)", flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>
                        <span style={{ display: "block", fontSize: "14px", fontWeight: 700 }}>{label}</span>
                        <span style={{ display: "block", fontSize: "12px", color: "var(--text-3)" }}>{desc}</span>
                      </span>
                      <ArrowRight size={16} style={{ color: "var(--text-3)" }} />
                    </button>
                  ))}
                  <p style={{ fontSize: "12px", color: "var(--text-3)", textAlign: "center", marginTop: "6px" }}>
                    {payLoading ? "Redirigiendo al pago…" : `Total a pagar: ${service.price_display}`}
                  </p>
                  <a href="https://wa.me/5492622635045" target="_blank" rel="noreferrer"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                      padding: "12px", borderRadius: "14px", fontSize: "13px", fontWeight: 600,
                      color: "#25d166", textDecoration: "none", background: "rgba(37,211,102,0.06)",
                      border: "1px solid rgba(37,211,102,0.15)", marginTop: "4px" }}>
                    <MessageCircle size={16} /> ¿Dudas? Consultá por WhatsApp
                  </a>
                </div>
              ) : sent ? (
                <div data-testid="service-request-sent" style={{ padding: "44px 24px", textAlign: "center" }}>
                  <div style={{ width: "64px", height: "64px", borderRadius: "50%",
                    background: "rgba(26,255,110,0.1)", border: "1px solid rgba(26,255,110,0.3)",
                    color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 20px" }}>
                    <Check size={30} strokeWidth={3} />
                  </div>
                  <h3 className="display-bold" style={{ fontFamily: "var(--font-display)", fontWeight: 800,
                    fontSize: "1.4rem", letterSpacing: "-0.02em", marginBottom: "10px", color: "var(--text)" }}>
                    Solicitud enviada
                  </h3>
                  <p style={{ fontSize: "14px", color: "var(--text-2)", lineHeight: 1.6 }}>
                    Te contactamos a la brevedad para coordinar los detalles.
                  </p>
                </div>
              ) : (
                <div style={{ padding: "26px 24px 24px", display: "flex", flexDirection: "column", gap: "18px" }}>
                  {error && (
                    <div data-testid="service-request-error" style={{ padding: "10px 14px",
                      borderRadius: "12px", background: "rgba(255,77,77,0.08)",
                      border: "1px solid rgba(255,77,77,0.2)", color: "var(--danger)", fontSize: "13px" }}>
                      {error}
                    </div>
                  )}
                  {[
                    { key: "name",  label: "Nombre",   type: "text",  placeholder: "Tu nombre" },
                    { key: "email", label: "Email",    type: "email", placeholder: "tu@email.com" },
                    { key: "phone", label: "Teléfono", type: "tel",   placeholder: "+56 9 1234 5678" },
                  ].map(({ key, label, type, placeholder }) => (
                    <div key={key}>
                      <label style={labelSt}>{label}</label>
                      <input type={type} value={form[key]} placeholder={placeholder}
                        data-testid={`service-input-${key}`}
                        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                        style={inputSt} onFocus={onFocus} onBlur={onBlur} />
                    </div>
                  ))}
                  <div>
                    <label style={labelSt}>Mensaje</label>
                    <textarea value={form.message} rows={4} placeholder="Contanos sobre tu proyecto..."
                      data-testid="service-input-message"
                      onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                      style={{ ...inputSt, resize: "vertical" }} onFocus={onFocus} onBlur={onBlur} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={labelSt}>Presupuesto</label>
                      <input type="text" value={form.budget} placeholder="Ej: 500000"
                        inputMode="numeric"
                        onChange={e => setForm(p => ({ ...p, budget: e.target.value }))}
                        style={inputSt} onFocus={onFocus} onBlur={onBlur} />
                    </div>
                    <div>
                      <label style={labelSt}>Fecha preferida</label>
                      <input type="date" value={form.preferred_date}
                        onChange={e => setForm(p => ({ ...p, preferred_date: e.target.value }))}
                        style={inputSt} onFocus={onFocus} onBlur={onBlur} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                    <a href="https://wa.me/5492622635045" target="_blank" rel="noreferrer"
                      style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center",
                        gap: "8px", padding: "14px", borderRadius: "var(--r-full)", fontSize: "14px",
                        fontWeight: 700, color: "#000", textDecoration: "none", background: "#25d366",
                        boxShadow: "0 8px 26px rgba(37,211,102,0.28)",
                        transition: "transform 200ms var(--ease)" }}
                      onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
                      onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
                      <MessageCircle size={17} /> WhatsApp
                    </a>
                    <button data-testid="service-submit"
                      onClick={() => {
                        if (!isAuthenticated) {
                          showToast("Iniciá sesión para enviar tu solicitud", "error")
                          navigate(`/login?next=/services/${service.slug}`)
                          return
                        }
                        setError("")
                        mutation.mutate()
                      }}
                      disabled={mutation.isPending || (isAuthenticated && !form.message.trim())}
                      style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center",
                        gap: "9px", padding: "14px 10px 14px 18px", borderRadius: "var(--r-full)",
                        background: "#fff", color: "#000", border: "none", fontSize: "14px",
                        fontWeight: 700, cursor: "pointer",
                        opacity: (mutation.isPending || (isAuthenticated && !form.message.trim())) ? 0.45 : 1,
                        transition: "transform 200ms var(--ease), opacity 200ms var(--ease)" }}
                      onMouseEnter={e => { if (!(mutation.isPending || (isAuthenticated && !form.message.trim()))) e.currentTarget.style.transform = "translateY(-2px)" }}
                      onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
                      {mutation.isPending ? "Enviando..." : "Enviar"}
                      {!mutation.isPending && (
                        <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: "var(--accent)",
                          color: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <ArrowRight size={13} strokeWidth={2.5} />
                        </span>
                      )}
                    </button>
                  </div>
                  {!isAuthenticated && (
                    <p style={{ fontSize: "11.5px", color: "var(--text-3)", textAlign: "center",
                      lineHeight: 1.5 }}>
                      Necesitás una cuenta para enviar la solicitud. También podés escribirnos por WhatsApp.
                    </p>
                  )}
                  {isAuthenticated && !form.message.trim() && (
                    <p style={{ fontSize: "11.5px", color: "var(--text-3)", textAlign: "center",
                      lineHeight: 1.5 }}>
                      Escribí un mensaje para habilitar el envío.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Fila de confianza */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px",
              padding: "16px 20px", borderRadius: "18px",
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {[
                [ShieldCheck, "Presupuesto sin compromiso"],
                [Zap,         "Respuesta en menos de 24 hs"],
                [Sparkles,    "Atención personalizada"],
              ].map(([Icon, text]) => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: "10px",
                  fontSize: "13px", color: "var(--text-2)" }}>
                  <Icon size={16} style={{ color: "var(--accent)", flexShrink: 0 }} /> {text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Otros servicios ── */}
        {related.length > 0 && (
          <div style={{ marginTop: "clamp(56px, 8vw, 88px)" }} data-testid="service-related">
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between",
              gap: "16px", marginBottom: "28px", flexWrap: "wrap" }}>
              <div>
                <p style={EYEBROW}>· Seguí explorando</p>
                <h2 className="display-bold" style={{ fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 800,
                  letterSpacing: "-0.03em", marginTop: "10px", color: "var(--text)" }}>
                  Otros servicios
                </h2>
              </div>
              <Link to="/services" style={{ display: "inline-flex", alignItems: "center", gap: "8px",
                fontSize: "14px", fontWeight: 600, color: "var(--text-2)", textDecoration: "none" }}
                className="hover-accent">
                Ver todos <ArrowRight size={15} />
              </Link>
            </div>
            <div className="services-page-grid" style={{ display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "24px" }}>
              {related.map((s, i) => <ServiceCard key={s.id} service={s} index={i} />)}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 900px) {
          .service-grid { grid-template-columns: 1fr !important; }
          .service-form { position: static !important; }
        }
      `}</style>
    </div>
  )
}
