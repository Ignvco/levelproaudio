// pages/ServiceDetail.jsx
import { useParams, Link } from "react-router-dom"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { Check, Clock, ArrowRight, MessageCircle, SearchX } from "lucide-react"
import { getService } from "../api/services.api"
import { useAuthStore } from "../store/authStore"
import { mediaUrl } from "../utils/mediaUrl"
import api from "../api/client"

export default function ServiceDetail() {
  const { slug } = useParams()
  const { user } = useAuthStore()
  const [form, setForm] = useState({
    name: user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "",
    email: user?.email || "",
    phone: user?.phone || "",
    message: "",
    budget: "",
    preferred_date: "",
  })
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const { data: service, isLoading, isError } = useQuery({
    queryKey: ["service", slug],
    queryFn:  () => getService(slug),
  })

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/services/requests/", {
        service:        service.id,
        name:           form.name,
        email:          form.email,
        phone:          form.phone,
        message:        form.message,
        budget:         form.budget || null,
        preferred_date: form.preferred_date || null,
      })
    },
    onSuccess: () => setSent(true),
    onError:   () => setError("Error al enviar. Intenta de nuevo."),
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
    width: "100%", padding: "12px 16px",
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "var(--r-md)", color: "var(--text)",
    fontSize: "14px", outline: "none", transition: "border-color var(--dur)",
  }
  const labelSt = { display: "block", fontSize: "12px", fontWeight: 600,
    color: "var(--text-2)", marginBottom: "7px" }
  const eyebrowSt = { fontSize: "11px", fontWeight: 700, color: "var(--accent)",
    textTransform: "uppercase", letterSpacing: "0.15em" }
  const onFocus = e => e.target.style.borderColor = "rgba(26,255,110,0.5)"
  const onBlur  = e => e.target.style.borderColor = "rgba(255,255,255,0.1)"

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>

      {/* Hero del servicio */}
      {service.thumbnail && (
        <div style={{ height: "clamp(260px, 42vw, 460px)", overflow: "hidden", position: "relative" }}>
          <img src={mediaUrl(service.thumbnail)} alt={service.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0,
            background: "linear-gradient(to top, var(--bg) 2%, rgba(8,8,8,0.45) 55%, rgba(8,8,8,0.55) 100%)" }} />
        </div>
      )}

      <div className="lp-container" style={{
        paddingTop: service.thumbnail ? "clamp(24px, 3vw, 40px)" : "clamp(100px, 12vw, 140px)",
        paddingBottom: "clamp(60px, 8vw, 100px)",
        marginTop: service.thumbnail ? "clamp(-80px, -8vw, -40px)" : 0, position: "relative" }}>

        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px",
          fontSize: "13px", color: "var(--text-3)", marginBottom: "28px" }}>
          <Link to="/services" className="hover-accent" style={{ transition: "color var(--dur)" }}>Servicios</Link>
          <span>/</span>
          <span style={{ color: "var(--text-2)" }}>{service.name}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px",
          gap: "clamp(32px, 5vw, 64px)", alignItems: "start" }} className="service-grid">

          {/* Info */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div>
              {service.category && (
                <p style={{ ...eyebrowSt, marginBottom: "14px" }}>
                  · {service.category.name}
                </p>
              )}
              <h1 className="display-bold" style={{ fontFamily: "var(--font-display)",
                fontSize: "clamp(2rem, 4vw, 3.5rem)", fontWeight: 800,
                letterSpacing: "-0.03em", lineHeight: 1.02, marginBottom: "18px", color: "var(--text)" }}>
                {service.name}
              </h1>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 800,
                letterSpacing: "-0.02em", color: "var(--accent)", marginBottom: "20px" }}>
                {service.price_display}
              </p>
              {service.short_description && (
                <p style={{ fontSize: "16px", color: "var(--text-2)", lineHeight: 1.8 }}>
                  {service.short_description}
                </p>
              )}
            </div>

            {service.description && (
              <div style={{ paddingTop: "24px", borderTop: "1px solid var(--border)" }}>
                <p style={eyebrowSt}>· Descripción</p>
                <p style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.8, marginTop: "14px" }}>
                  {service.description}
                </p>
              </div>
            )}

            {/* Entregables */}
            {service.deliverables_list?.length > 0 && (
              <div style={{ paddingTop: "24px", borderTop: "1px solid var(--border)" }}>
                <p style={{ ...eyebrowSt, marginBottom: "16px" }}>· Qué incluye</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {service.deliverables_list.map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                      <span style={{ width: "22px", height: "22px", borderRadius: "50%",
                        background: "rgba(26,255,110,0.1)", border: "1px solid rgba(26,255,110,0.25)",
                        color: "var(--accent)", flexShrink: 0, marginTop: "1px",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Check size={13} strokeWidth={3} />
                      </span>
                      <p style={{ fontSize: "14px", color: "var(--text-2)", lineHeight: 1.6 }}>{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Duración */}
            {service.duration_hours && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px",
                padding: "14px 18px", borderRadius: "var(--r-lg)", background: "#121212",
                border: "1px solid rgba(255,255,255,0.06)", fontSize: "14px", color: "var(--text-2)" }}>
                <span style={{ color: "var(--accent)", display: "flex" }}><Clock size={18} /></span>
                Duración estimada: {service.duration_hours} hora{service.duration_hours !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Formulario */}
          <div style={{ position: "sticky", top: "100px" }} className="service-form">
            <div style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "var(--r-2xl)", overflow: "hidden" }}>

              <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={eyebrowSt}>· Solicitar</p>
                <p style={{ fontSize: "16px", fontWeight: 700, fontFamily: "var(--font-display)",
                  letterSpacing: "-0.01em", color: "var(--text)", marginTop: "8px" }}>
                  Solicitar este servicio
                </p>
                <p style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "4px" }}>
                  Te contactamos en menos de 24hs
                </p>
              </div>

              {sent ? (
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
                <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
                  {error && (
                    <div data-testid="service-request-error" style={{ padding: "10px 14px",
                      borderRadius: "var(--r-md)", background: "rgba(255,77,77,0.08)",
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
                    <textarea value={form.message} rows={3} placeholder="Contanos sobre tu proyecto..."
                      onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                      style={{ ...inputSt, resize: "vertical" }} onFocus={onFocus} onBlur={onBlur} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={labelSt}>Presupuesto</label>
                      <input type="text" value={form.budget} placeholder="Ej: $500.000"
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

                  <button
                    data-testid="service-submit"
                    onClick={() => mutation.mutate()}
                    disabled={mutation.isPending || !form.name || !form.email}
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "10px",
                      padding: "14px 14px 14px 24px", borderRadius: "var(--r-full)",
                      background: "var(--accent)", color: "#000", border: "none", fontSize: "14px",
                      fontWeight: 700, cursor: "pointer", marginTop: "4px",
                      opacity: (mutation.isPending || !form.name || !form.email) ? 0.6 : 1,
                      boxShadow: "0 8px 30px rgba(26,255,110,0.25)" }}>
                    {mutation.isPending ? "Enviando..." : "Enviar solicitud"}
                    {!mutation.isPending && (
                      <span style={{ width: "26px", height: "26px", borderRadius: "50%", background: "#000",
                        color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ArrowRight size={14} />
                      </span>
                    )}
                  </button>

                  <a href="https://wa.me/5492622635045" target="_blank" rel="noreferrer"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                      padding: "12px", borderRadius: "var(--r-lg)", fontSize: "13px", fontWeight: 600,
                      color: "#25d166", textDecoration: "none", background: "rgba(37,211,102,0.06)",
                      border: "1px solid rgba(37,211,102,0.15)" }}>
                    <MessageCircle size={16} /> Consultar por WhatsApp
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
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
