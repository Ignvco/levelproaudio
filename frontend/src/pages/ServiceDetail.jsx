// pages/ServiceDetail.jsx
// Detalle de servicio con formulario de solicitud integrado

import { useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { getService, createServiceRequest } from "../api/services.api"
import { useAuthStore } from "../store/authStore"

const requestSchema = z.object({
    name: z.string().min(2, "Requerido"),
    email: z.string().email("Email inválido"),
    phone: z.string().optional(),
    message: z.string().min(10, "Describe tu proyecto (mínimo 10 caracteres)"),
    budget: z.string().optional(),
    preferred_date: z.string().optional(),
})

const priceTypeConfig = {
    fixed: { label: "Precio fijo", color: "#00e676" },
    quote: { label: "A cotizar", color: "#f59e0b" },
    hourly: { label: "Por hora", color: "#3b82f6" },
    project: { label: "Por proyecto", color: "#a78bfa" },
}

function Field({ label, error, children }) {
    return (
        <div>
            <label className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--color-text-muted)" }}
            >
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

export default function ServiceDetail() {
    const { slug } = useParams()
    const { isAuthenticated, user } = useAuthStore()
    const navigate = useNavigate()
    const [submitted, setSubmitted] = useState(false)

    const { data: service, isLoading, isError } = useQuery({
        queryKey: ["service", slug],
        queryFn: () => getService(slug),
    })

    const mutation = useMutation({
        mutationFn: createServiceRequest,
        onSuccess: () => setSubmitted(true),
    })

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(requestSchema),
        defaultValues: {
            name: user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() : "",
            email: user?.email || "",
            phone: user?.phone || "",
        },
    })

    const onSubmit = (data) => {
        if (!isAuthenticated) {
            navigate(`/login?next=/services/${slug}`)
            return
        }
        mutation.mutate({
            service: service.id,
            name: data.name,
            email: data.email,
            phone: data.phone || "",
            message: data.message,
            budget: data.budget ? parseFloat(data.budget) : null,
            preferred_date: data.preferred_date || null,
        })
    }

    const inputStyle = (hasError) => ({
        backgroundColor: "var(--color-surface-2)",
        border: `1px solid ${hasError ? "var(--color-danger)" : "var(--color-border)"}`,
        color: "var(--color-text)",
    })

    if (isLoading) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-16 rounded-xl animate-pulse"
                            style={{ backgroundColor: "var(--color-surface)" }}
                        />
                    ))}
                </div>
                <div className="h-96 rounded-2xl animate-pulse"
                    style={{ backgroundColor: "var(--color-surface)" }}
                />
            </div>
        )
    }

    if (isError || !service) {
        return (
            <div className="text-center py-20">
                <p style={{ color: "var(--color-text-muted)" }}>Servicio no encontrado.</p>
                <Link to="/services" style={{ color: "var(--color-accent)" }}
                    className="mt-4 inline-block text-sm"
                >
                    ← Volver a servicios
                </Link>
            </div>
        )
    }

    const typeConfig = priceTypeConfig[service.price_type] || { color: "#888" }

    return (
        <div style={{ backgroundColor: "var(--color-bg)" }} className="min-h-screen py-10 px-4">
            <div className="max-w-7xl mx-auto">

                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-sm mb-8"
                    style={{ color: "var(--color-text-muted)" }}
                >
                    <Link to="/services" className="hover:text-white transition-colors">Servicios</Link>
                    <span>/</span>
                    <span style={{ color: "var(--color-text)" }}>{service.name}</span>
                </nav>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

                    {/* ── Info del servicio ──────────────────────────── */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Thumbnail */}
                        {service.thumbnail && (
                            <div className="w-full aspect-video rounded-2xl overflow-hidden"
                                style={{ backgroundColor: "var(--color-surface-2)" }}
                            >
                                <img
                                    src={service.thumbnail}
                                    alt={service.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        )}

                        {/* Cabecera */}
                        <div>
                            {service.category && (
                                <p className="text-xs font-bold uppercase tracking-widest mb-2"
                                    style={{ color: "var(--color-accent)" }}
                                >
                                    {service.category.icon} {service.category.name}
                                </p>
                            )}
                            <h1 className="text-4xl font-black mb-4">{service.name}</h1>

                            <div className="flex flex-wrap items-center gap-4">
                                <span className="text-2xl font-black" style={{ color: typeConfig.color }}>
                                    {service.price_display}
                                </span>
                                <span className="text-sm px-2.5 py-1 rounded-full"
                                    style={{
                                        color: typeConfig.color,
                                        backgroundColor: `${typeConfig.color}18`,
                                    }}
                                >
                                    {service.price_type_display}
                                </span>
                                {service.duration_hours && (
                                    <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                                        ⏱ ~{service.duration_hours}h estimado
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Descripción */}
                        <div
                            className="rounded-2xl p-6"
                            style={{
                                backgroundColor: "var(--color-surface)",
                                border: "1px solid var(--color-border)",
                            }}
                        >
                            <h2 className="font-bold text-lg mb-4">Descripción</h2>
                            <p className="text-sm leading-relaxed"
                                style={{ color: "var(--color-text-muted)" }}
                            >
                                {service.description}
                            </p>
                        </div>

                        {/* Entregables */}
                        {service.deliverables_list?.length > 0 && (
                            <div
                                className="rounded-2xl p-6"
                                style={{
                                    backgroundColor: "var(--color-surface)",
                                    border: "1px solid var(--color-border)",
                                }}
                            >
                                <h2 className="font-bold text-lg mb-4">¿Qué incluye?</h2>
                                <ul className="space-y-3">
                                    {service.deliverables_list.map((item, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm">
                                            <span
                                                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold"
                                                style={{
                                                    backgroundColor: "rgba(0,230,118,0.15)",
                                                    color: "var(--color-accent)",
                                                }}
                                            >
                                                ✓
                                            </span>
                                            <span style={{ color: "var(--color-text-muted)" }}>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* ── Formulario de solicitud ───────────────────── */}
                    <div className="sticky top-24 h-fit">
                        <div
                            className="rounded-2xl p-6"
                            style={{
                                backgroundColor: "var(--color-surface)",
                                border: "1px solid var(--color-border)",
                            }}
                        >
                            {submitted ? (
                                /* ── Confirmación ── */
                                <div className="text-center py-6">
                                    <div
                                        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                                        style={{ backgroundColor: "rgba(0,230,118,0.1)" }}
                                    >
                                        <span className="text-3xl">✓</span>
                                    </div>
                                    <h3 className="text-lg font-bold mb-2">¡Solicitud enviada!</h3>
                                    <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
                                        Nos pondremos en contacto contigo a la brevedad para coordinar los detalles.
                                    </p><a

                                    href="https://wa.me/5492622635045"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block w-full py-2.5 rounded-xl text-sm font-semibold text-center"
                                    style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
                  >
                                    Contactar por WhatsApp
                                </a>
                </div>
                        ) : (
                        /* ── Formulario ── */
                        <>
                            <h3 className="font-bold text-lg mb-1">Solicitar este servicio</h3>
                            <p className="text-sm mb-5" style={{ color: "var(--color-text-muted)" }}>
                                Completa el formulario y te contactamos en menos de 24hs.
                            </p>

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                <Field label="Nombre completo" error={errors.name?.message}>
                                    <input
                                        {...register("name")}
                                        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                                        style={inputStyle(errors.name)}
                                    />
                                </Field>

                                <Field label="Email" error={errors.email?.message}>
                                    <input
                                        type="email"
                                        {...register("email")}
                                        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                                        style={inputStyle(errors.email)}
                                    />
                                </Field>

                                <Field label="Teléfono (opcional)">
                                    <input
                                        {...register("phone")}
                                        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                                        style={inputStyle(false)}
                                    />
                                </Field>

                                <Field label="Cuéntanos tu proyecto" error={errors.message?.message}>
                                    <textarea
                                        {...register("message")}
                                        rows={4}
                                        placeholder="Describe qué necesitas, estilo, referencias..."
                                        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                                        style={inputStyle(errors.message)}
                                    />
                                </Field>

                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Presupuesto (CLP)">
                                        <input
                                            type="number"
                                            {...register("budget")}
                                            placeholder="Ej: 150000"
                                            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                                            style={inputStyle(false)}
                                        />
                                    </Field>
                                    <Field label="Fecha preferida">
                                        <input
                                            type="date"
                                            {...register("preferred_date")}
                                            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                                            style={{
                                                ...inputStyle(false),
                                                colorScheme: "dark",
                                            }}
                                        />
                                    </Field>
                                </div>

                                {mutation.isError && (
                                    <p className="text-xs" style={{ color: "var(--color-danger)" }}>
                                        Error al enviar. Intenta de nuevo.
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={mutation.isPending}
                                    className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50 transition-opacity"
                                    style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
                                >
                                    {mutation.isPending ? "Enviando..." : "Enviar solicitud"}
                                </button><a
                                href="https://wa.me/5492622635045"
                                target="_blank"
                                rel="noreferrer"
                                className="block text-center text-sm transition-colors"
                                style={{ color: "var(--color-text-muted)" }}>O escríbenos por WhatsApp →
                            </a>
                        </form>
                    </>
              )}
                </div>
            </div>

        </div>
      </div >
    </div >
  )
}