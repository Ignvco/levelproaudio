// pages/Services.jsx
// Catálogo de servicios profesionales

import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getServices, getServiceCategories } from "../api/services.api"

// ── Price type config ────────────────────────────────────────
const priceTypeConfig = {
  fixed: { label: "Precio fijo", color: "#00e676" },
  quote: { label: "A cotizar", color: "#f59e0b" },
  hourly: { label: "Por hora", color: "#3b82f6" },
  project: { label: "Por proyecto", color: "#a78bfa" },
}

// ── Service Card ─────────────────────────────────────────────
function ServiceCard({ service }) {
  const typeConfig = priceTypeConfig[service.price_type] || { color: "#888" }

  return (
    <Link
      to={`/services/${service.slug}`}
      className="group rounded-2xl overflow-hidden flex flex-col transition-all hover:-translate-y-1"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Thumbnail */}
      <div
        className="relative w-full aspect-video overflow-hidden"
        style={{ backgroundColor: "var(--color-surface-2)" }}
      >
        {service.thumbnail ? (
          <img
            src={service.thumbnail}
            alt={service.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-6xl">🎚️</span>
          </div>
        )}

        {service.is_featured && (
          <span
            className="absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
          >
            Destacado
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 p-5">
        {service.category_name && (
          <p className="text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: "var(--color-text-muted)" }}
          >
            {service.category_name}
          </p>
        )}

        <h3 className="font-bold text-base leading-snug mb-2">
          {service.name}
        </h3>

        {service.short_description && (
          <p className="text-sm leading-relaxed line-clamp-2 mb-4 flex-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            {service.short_description}
          </p>
        )}

        <div
          className="flex items-center justify-between pt-3 mt-auto"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <div>
            <span
              className="font-black text-base"
              style={{ color: typeConfig.color }}
            >
              {service.price_display}
            </span>
            {service.duration_hours && (
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                ~{service.duration_hours}h estimado
              </p>
            )}
          </div>
          <span className="text-xs font-semibold" style={{ color: "var(--color-accent)" }}>
            Ver detalle →
          </span>
        </div>
      </div>
    </Link>
  )
}

// ── Services page ────────────────────────────────────────────
export default function Services() {
  const [activeCategory, setActiveCategory] = useState("")

  const { data: categoriesData } = useQuery({
    queryKey: ["service-categories"],
    queryFn: getServiceCategories,
  })

  const params = activeCategory ? { category__slug: activeCategory } : {}

  const { data, isLoading } = useQuery({
    queryKey: ["services", params],
    queryFn: () => getServices(params),
  })

  const categories = categoriesData?.results || categoriesData || []
  const services = data?.results || data || []
  const featured = services.filter(s => s.is_featured)
  const rest = services.filter(s => !s.is_featured)

  return (
    <div style={{ backgroundColor: "var(--color-bg)" }}>

      {/* Hero */}
      <div
        className="py-20 px-4 border-b"
        style={{
          background: "linear-gradient(135deg, var(--color-surface) 0%, var(--color-bg) 70%)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="max-w-7xl mx-auto">
          <span
            className="inline-block text-xs font-bold tracking-widest uppercase mb-4 px-3 py-1 rounded-full"
            style={{
              color: "var(--color-accent)",
              border: "1px solid var(--color-accent)",
              backgroundColor: "rgba(0,230,118,0.05)",
            }}
          >
            Servicios Profesionales
          </span>
          <h1 className="text-4xl md:text-5xl font-black mb-4">
            Lleva tu sonido al<br />
            <span style={{ color: "var(--color-accent)" }}>siguiente nivel</span>
          </h1>
          <p className="text-lg max-w-xl" style={{ color: "var(--color-text-muted)" }}>
            Producción musical, mezcla, grabación, live sound y soporte técnico
            para iglesias. Trabajamos con tu visión.
          </p>

          <div className="flex gap-4 mt-8">
            <Link
              to="/services/contact"
              className="px-6 py-3 rounded-xl font-semibold text-sm"
              style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
            >
              Solicitar cotización
            </Link><a

              href="https://wa.me/5492622635045"
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 rounded-xl font-semibold text-sm transition-colors"
              style={{
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              WhatsApp directo
            </a>
          </div>
        </div>
      </div>

      {/* Categorías */}
      {categories.length > 0 && (
        <div
          className="sticky top-16 z-40 px-4 py-3 border-b"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="max-w-7xl mx-auto flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory("")}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: !activeCategory
                  ? "var(--color-accent)"
                  : "var(--color-surface-2)",
                color: !activeCategory ? "#000" : "var(--color-text-muted)",
                border: "1px solid var(--color-border)",
              }}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat.slug}
                onClick={() => setActiveCategory(cat.slug)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                style={{
                  backgroundColor: activeCategory === cat.slug
                    ? "var(--color-accent)"
                    : "var(--color-surface-2)",
                  color: activeCategory === cat.slug ? "#000" : "var(--color-text-muted)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {cat.icon && <span>{cat.icon}</span>}
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-12">

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl animate-pulse"
                style={{ backgroundColor: "var(--color-surface)", height: 340 }}
              />
            ))}
          </div>
        )}

        {/* Destacados */}
        {!isLoading && featured.length > 0 && !activeCategory && (
          <div className="mb-12">
            <h2 className="text-xl font-bold mb-6">Servicios destacados</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featured.map(service => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          </div>
        )}

        {/* Todos los servicios */}
        {!isLoading && (
          <div>
            {!activeCategory && rest.length > 0 && (
              <h2 className="text-xl font-bold mb-6">Todos los servicios</h2>
            )}
            {services.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-5xl mb-4">🎚️</p>
                <p className="font-bold text-lg mb-2">Sin servicios en esta categoría</p>
                <button
                  onClick={() => setActiveCategory("")}
                  className="mt-4 text-sm"
                  style={{ color: "var(--color-accent)" }}
                >
                  Ver todos los servicios
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {(activeCategory ? services : rest).map(service => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}