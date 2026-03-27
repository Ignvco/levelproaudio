// pages/ServiceDetail.jsx

import { useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { getService, createServiceRequest } from "../api/services.api"
import { useAuthStore } from "../store/authStore"

const schema = z.object({
  name:           z.string().min(2, "Requerido"),
  email:          z.string().email("Email inválido"),
  phone:          z.string().optional(),
  message:        z.string().min(10, "Mínimo 10 caracteres"),
  budget:         z.string().optional(),
  preferred_date: z.string().optional(),
})

const priceColors = {
  fixed: "#4ade80", quote: "#facc15", hourly: "#60a5fa", project: "#c084fc",
}

export default function ServiceDetail() {
  const { slug }    = useParams()
  const { isAuthenticated, user } = useAuthStore()
  const navigate    = useNavigate()
  const [submitted, setSubmitted] = useState(false)

  const { data: service, isLoading, isError } = useQuery({
    queryKey: ["service", slug],
    queryFn:  () => getService(slug),
  })

  const mutation = useMutation({
    mutationFn: createServiceRequest,
    onSuccess:  () => setSubmitted(true),
  })

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name:  user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() : "",
      email: user?.email || "",
      phone: user?.phone || "",
    },
  })

  const onSubmit = (data) => {
    if (!isAuthenticated) { navigate(`/login?next=/services/${slug}`); return }
    mutation.mutate({
      service:        service.id,
      name:           data.name,
      email:          data.email,
      phone:          data.phone || "",
      message:        data.message,
      budget:         data.budget ? parseFloat(data.budget) : null,
      preferred_date: data.preferred_date || null,
    })
  }

  if (isLoading) return (
    <div style={{ maxWidth: "1100px", margin: "0 auto",
      padding: "60px clamp(20px, 5vw, 60px)" }}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-12">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "60px" }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: "480px", borderRadius: "var(--r-xl)" }} />
      </div>
    </div>
  )

  if (isError || !service) return (
    <div style={{ textAlign: "center", padding: "120px 20px" }}>
      <p style={{ color: "var(--text-3)", marginBottom: "20px" }}>Servicio no encontrado.</p>
      <Link to="/services" className="btn btn-ghost">← Servicios</Link>
    </div>
  )

  const priceColor = priceColors[service.price_type] || "var(--text-2)"

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh",
      padding: "clamp(40px, 6vw, 80px) 0" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto",
        padding: "0 clamp(20px, 5vw, 60px)" }}>

        {/* Breadcrumb */}
        <nav style={{ display: "flex", alignItems: "center", gap: "8px",
          fontSize: "13px", color: "var(--text-3)", marginBottom: "40px" }}>
          <Link to="/services" className="hover:text-white" style={{ transition: "color var(--dur)" }}>
            Servicios
          </Link>
          <span>/</span>
          <span style={{ color: "var(--text-2)" }}>{service.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-12"
          style={{ alignItems: "start" }}>

          {/* Info */}
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>

            {service.thumbnail && (
              <div style={{ width: "100%", aspectRatio: "16/9",
                borderRadius: "var(--r-xl)", overflow: "hidden",
                background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <img src={service.thumbnail} alt={service.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}

            <div>
              {service.category && (
                <p style={{ fontSize: "11px", color: "var(--text-3)", textTransform: "uppercase",
                  letterSpacing: "0.1em", fontWeight: 500, marginBottom: "8px" }}>
                  {service.category.icon} {service.category.name}
                </p>
              )}
              <h1 style={{ fontFamily: "var(--font-serif)",
                fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.1, marginBottom: "16px" }}>
                {service.name}
              </h1>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
                <span style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem",
                  color: priceColor }}>
                  {service.price_display}
                </span>
                <span style={{ fontSize: "12px", padding: "3px 10px", borderRadius: "100px",
                  color: priceColor, background: `${priceColor}14`,
                  border: `1px solid ${priceColor}30` }}>
                  {service.price_type_display}
                </span>
                {service.duration_hours && (
                  <span style={{ fontSize: "13px", color: "var(--text-3)" }}>
                    ⏱ ~{service.duration_hours}h
                  </span>
                )}
              </div>
            </div>

            {/* Descripción */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)", padding: "24px" }}>
              <h2 style={{ fontSize: "15px", fontWeight: 500, marginBottom: "12px" }}>
                Descripción
              </h2>
              <p style={{ fontSize: "14px", color: "var(--text-2)", lineHeight: 1.75 }}>
                {service.description}
              </p>
            </div>

            {/* Entregables */}
            {service.deliverables_list?.length > 0 && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--r-lg)", padding: "24px" }}>
                <h2 style={{ fontSize: "15px", fontWeight: 500, marginBottom: "16px" }}>
                  ¿Qué incluye?
                </h2>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {service.deliverables_list.map((item, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start",
                      gap: "10px", fontSize: "14px" }}>
                      <span style={{ color: "var(--accent)", marginTop: "1px", flexShrink: 0 }}>✓</span>
                      <span style={{ color: "var(--text-2)" }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Formulario */}
          <div style={{ position: "sticky", top: "88px" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--r-xl)", padding: "28px" }}>

              {submitted ? (
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                  <div style={{
                    width: "52px", height: "52px", borderRadius: "50%",
                    background: "var(--accent-glow)", border: "1px solid rgba(26,255,110,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "20px", margin: "0 auto 16px", color: "var(--accent)",
                  }}>✓</div>
                  <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.3rem",
                    marginBottom: "8px" }}>
                    ¡Solicitud enviada!
                  </h3>
                  <p style={{ fontSize: "13px", color: "var(--text-2)", marginBottom: "20px",
                    lineHeight: 1.6 }}>
                    Te contactamos en menos de 24hs para coordinar los detalles.
                  </p>
                  <a href="https://wa.me/5492622635045" target="_blank" rel="noreferrer"
                    className="btn" style={{ width: "100%", justifyContent: "center",
                      background: "#22c55e", color: "#fff" }}>
                    💬 WhatsApp directo
                  </a>
                </div>
              ) : (
                <>
                  <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.3rem",
                    marginBottom: "6px" }}>
                    Solicitar servicio
                  </h3>
                  <p style={{ fontSize: "13px", color: "var(--text-3)", marginBottom: "20px" }}>
                    Te contactamos en menos de 24hs.
                  </p>

                  <form onSubmit={handleSubmit(onSubmit)}
                    style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {[
                      { name: "name",  label: "Nombre completo", type: "text" },
                      { name: "email", label: "Email",           type: "email" },
                      { name: "phone", label: "Teléfono (opcional)", type: "tel" },
                    ].map(({ name, label, type }) => (
                      <div key={name}>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                          color: "var(--text-2)", marginBottom: "6px" }}>
                          {label}
                        </label>
                        <input type={type} {...register(name)}
                          className={`input ${errors[name] ? "error" : ""}`} />
                        {errors[name] && (
                          <p style={{ fontSize: "11px", color: "var(--danger)", marginTop: "3px" }}>
                            {errors[name].message}
                          </p>
                        )}
                      </div>
                    ))}

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                        color: "var(--text-2)", marginBottom: "6px" }}>
                        Cuéntanos tu proyecto
                      </label>
                      <textarea {...register("message")} rows={4}
                        placeholder="Describe qué necesitas..."
                        className={`input ${errors.message ? "error" : ""}`}
                        style={{ resize: "none" }} />
                      {errors.message && (
                        <p style={{ fontSize: "11px", color: "var(--danger)", marginTop: "3px" }}>
                          {errors.message.message}
                        </p>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                          color: "var(--text-2)", marginBottom: "6px" }}>
                          Presupuesto (CLP)
                        </label>
                        <input type="number" {...register("budget")}
                          placeholder="150000" className="input" />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                          color: "var(--text-2)", marginBottom: "6px" }}>
                          Fecha preferida
                        </label>
                        <input type="date" {...register("preferred_date")}
                          className="input" style={{ colorScheme: "dark" }} />
                      </div>
                    </div>

                    {mutation.isError && (
                      <p style={{ fontSize: "12px", color: "var(--danger)" }}>
                        Error al enviar. Intenta de nuevo.
                      </p>
                    )}

                    <button type="submit" disabled={mutation.isPending}
                      className="btn btn-accent"
                      style={{ justifyContent: "center",
                        opacity: mutation.isPending ? 0.7 : 1 }}>
                      {mutation.isPending ? "Enviando..." : "Enviar solicitud"}
                    </button>

                    <a href="https://wa.me/5492622635045" target="_blank" rel="noreferrer"
                      style={{ textAlign: "center", fontSize: "13px", color: "var(--text-3)",
                        transition: "color var(--dur)", display: "block" }}
                      className="hover:text-[var(--text-2)]">
                      O por WhatsApp →
                    </a>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}