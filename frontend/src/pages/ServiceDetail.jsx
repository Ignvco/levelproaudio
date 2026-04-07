// pages/ServiceDetail.jsx
import { useParams, Link } from "react-router-dom"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { getService } from "../api/services.api"
import { useAuthStore } from "../store/authStore"
import { mediaUrl } from "../utils/mediaUrl"
import api from "../api/client"

export default function ServiceDetail() {
  const { slug } = useParams()
  const { isAuthenticated, user } = useAuthStore()
  const [form, setForm]     = useState({
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
    <div style={{ maxWidth: "960px", margin: "0 auto",
      padding: "clamp(48px, 6vw, 80px) clamp(20px, 5vw, 60px)",
      display: "flex", flexDirection: "column", gap: "16px" }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton" style={{ height: i === 0 ? "300px" : "60px" }} />
      ))}
    </div>
  )

  if (isError || !service) return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <p style={{ fontSize: "48px", marginBottom: "16px" }}>😕</p>
      <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 300,
        marginBottom: "16px" }}>
        Servicio no encontrado
      </h2>
      <Link to="/services" className="btn btn-ghost">← Servicios</Link>
    </div>
  )

  const inputSt = {
    width: "100%", padding: "12px 16px",
    background: "var(--surface-2)", border: "1px solid var(--border)",
    borderRadius: "var(--r-md)", color: "var(--text)",
    fontSize: "14px", outline: "none",
    transition: "border-color var(--dur)",
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>

      {/* Hero del servicio */}
      {service.thumbnail && (
        <div style={{ height: "clamp(240px, 40vw, 420px)", overflow: "hidden",
          position: "relative" }}>
          <img src={mediaUrl(service.thumbnail)} alt={service.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0,
            background: "linear-gradient(to top, rgba(8,8,8,0.9) 0%, rgba(8,8,8,0.3) 60%, transparent 100%)" }} />
        </div>
      )}

      <div style={{ maxWidth: "960px", margin: "0 auto",
        padding: "clamp(40px, 6vw, 80px) clamp(20px, 5vw, 60px)" }}>

        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px",
          fontSize: "13px", color: "var(--text-3)", marginBottom: "32px" }}>
          <Link to="/services" className="hover-accent"
            style={{ transition: "color var(--dur)" }}>
            Servicios
          </Link>
          <span>/</span>
          <span style={{ color: "var(--text-2)" }}>{service.name}</span>
        </div>

        <div style={{ display: "grid",
          gridTemplateColumns: "1fr 380px", gap: "56px", alignItems: "start" }}
          className="service-grid"
        >
          {/* Info */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div>
              {service.category && (
                <p style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 600,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  marginBottom: "12px" }}>
                  {service.category.name}
                </p>
              )}
              <h1 style={{ fontFamily: "var(--font-serif)",
                fontSize: "clamp(2rem, 4vw, 3.5rem)", fontWeight: 300,
                letterSpacing: "-0.02em", marginBottom: "16px" }}>
                {service.name}
              </h1>
              <p style={{ fontFamily: "var(--font-serif)", fontSize: "2rem",
                color: "var(--accent)", marginBottom: "20px" }}>
                {service.price_display}
              </p>
              {service.short_description && (
                <p style={{ fontSize: "16px", color: "var(--text-2)",
                  lineHeight: 1.8 }}>
                  {service.short_description}
                </p>
              )}
            </div>

            {service.description && (
              <div style={{ paddingTop: "24px", borderTop: "1px solid var(--border)" }}>
                <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-3)",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  marginBottom: "14px" }}>
                  Descripción
                </p>
                <p style={{ fontSize: "15px", color: "var(--text-2)",
                  lineHeight: 1.8 }}>
                  {service.description}
                </p>
              </div>
            )}

            {/* Entregables */}
            {service.deliverables_list?.length > 0 && (
              <div style={{ paddingTop: "24px", borderTop: "1px solid var(--border)" }}>
                <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-3)",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  marginBottom: "16px" }}>
                  Qué incluye
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {service.deliverables_list.map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start",
                      gap: "12px" }}>
                      <span style={{ color: "var(--accent)", flexShrink: 0,
                        fontWeight: 600, marginTop: "2px" }}>
                        ✓
                      </span>
                      <p style={{ fontSize: "14px", color: "var(--text-2)",
                        lineHeight: 1.6 }}>
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Duration */}
            {service.duration_hours && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px",
                padding: "14px 18px", borderRadius: "var(--r-lg)",
                background: "var(--surface-2)", border: "1px solid var(--border)",
                fontSize: "14px", color: "var(--text-2)" }}>
                <span style={{ fontSize: "18px" }}>⏱️</span>
                Duración estimada: {service.duration_hours} hora{service.duration_hours !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Formulario de solicitud */}
          <div style={{ position: "sticky", top: "88px" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--r-2xl)", overflow: "hidden" }}>

              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)",
                background: "var(--surface-2)" }}>
                <p style={{ fontSize: "15px", fontWeight: 500 }}>
                  Solicitar este servicio
                </p>
                <p style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "4px" }}>
                  Te contactamos en menos de 24hs
                </p>
              </div>

              {sent ? (
                <div style={{ padding: "40px 24px", textAlign: "center" }}>
                  <span style={{ fontSize: "40px", display: "block", marginBottom: "16px" }}>
                    ✓
                  </span>
                  <h3 style={{ fontFamily: "var(--font-serif)", fontWeight: 300,
                    fontSize: "1.4rem", marginBottom: "10px", color: "var(--accent)" }}>
                    Solicitud enviada
                  </h3>
                  <p style={{ fontSize: "14px", color: "var(--text-2)",
                    lineHeight: 1.6 }}>
                    Te contactamos a la brevedad para coordinar los detalles.
                  </p>
                </div>
              ) : (
                <div style={{ padding: "24px",
                  display: "flex", flexDirection: "column", gap: "14px" }}>
                  {error && (
                    <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)",
                      background: "rgba(255,77,77,0.08)",
                      border: "1px solid rgba(255,77,77,0.2)",
                      color: "var(--danger)", fontSize: "13px" }}>
                      {error}
                    </div>
                  )}

                  {[
                    { key: "name",    label: "Nombre",  type: "text",  placeholder: "Tu nombre" },
                    { key: "email",   label: "Email",   type: "email", placeholder: "tu@email.com" },
                    { key: "phone",   label: "Teléfono",type: "tel",   placeholder: "+56 9 1234 5678" },
                  ].map(({ key, label, type, placeholder }) => (
                    <div key={key}>
                      <label style={{ display: "block", fontSize: "12px",
                        fontWeight: 500, color: "var(--text-2)", marginBottom: "7px" }}>
                        {label}
                      </label>
                      <input type={type} value={form[key]} placeholder={placeholder}
                        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                        style={inputSt}
                        onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
                        onBlur={e => e.target.style.borderColor = "var(--border)"} />
                    </div>
                  ))}

                  <div>
                    <label style={{ display: "block", fontSize: "12px",
                      fontWeight: 500, color: "var(--text-2)", marginBottom: "7px" }}>
                      Mensaje
                    </label>
                    <textarea value={form.message} rows={3}
                      placeholder="Contanos sobre tu proyecto..."
                      onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                      style={{ ...inputSt, resize: "vertical" }}
                      onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
                      onBlur={e => e.target.style.borderColor = "var(--border)"} />
                  </div>

                  <div style={{ display: "grid",
                    gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px",
                        fontWeight: 500, color: "var(--text-2)", marginBottom: "7px" }}>
                        Presupuesto (opcional)
                      </label>
                      <input type="text" value={form.budget}
                        placeholder="Ej: $500.000"
                        onChange={e => setForm(p => ({ ...p, budget: e.target.value }))}
                        style={inputSt}
                        onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
                        onBlur={e => e.target.style.borderColor = "var(--border)"} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px",
                        fontWeight: 500, color: "var(--text-2)", marginBottom: "7px" }}>
                        Fecha preferida
                      </label>
                      <input type="date" value={form.preferred_date}
                        onChange={e => setForm(p => ({ ...p, preferred_date: e.target.value }))}
                        style={inputSt}
                        onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
                        onBlur={e => e.target.style.borderColor = "var(--border)"} />
                    </div>
                  </div>

                  <button
                    onClick={() => mutation.mutate()}
                    disabled={mutation.isPending || !form.name || !form.email}
                    className="btn btn-accent"
                    style={{ justifyContent: "center", fontSize: "14px",
                      padding: "14px", marginTop: "4px",
                      opacity: mutation.isPending ? 0.7 : 1 }}>
                    {mutation.isPending ? "Enviando..." : "Enviar solicitud →"}
                  </button>

                  <a href="https://wa.me/5492622635045" target="_blank" rel="noreferrer"
                    style={{ display: "flex", alignItems: "center",
                      justifyContent: "center", gap: "8px", padding: "10px",
                      borderRadius: "var(--r-lg)", fontSize: "13px",
                      color: "#25d166", textDecoration: "none",
                      background: "rgba(37,211,102,0.06)",
                      border: "1px solid rgba(37,211,102,0.15)",
                      transition: "all var(--dur) var(--ease)" }}>
                    💬 Consultar por WhatsApp
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .service-grid {
            grid-template-columns: 1fr !important;
          }
          .service-grid > div:last-child {
            position: static !important;
          }
        }
      `}</style>
    </div>
  )
}