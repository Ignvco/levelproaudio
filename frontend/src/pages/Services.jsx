// pages/Services.jsx

import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getServices, getServiceCategories } from "../api/services.api"
import fondoImg from "../assets/fondo.png"

const priceColors = {
  fixed:   "#4ade80",
  quote:   "#facc15",
  hourly:  "#60a5fa",
  project: "#c084fc",
}

function ServiceCard({ service }) {
  const color = priceColors[service.price_type] || "var(--text-2)"
  return (
    <Link to={`/services/${service.slug}`} className="card"
      style={{ display: "flex", flexDirection: "column" }}
    >
      <div style={{
        width: "100%", aspectRatio: "16/9",
        background: "var(--surface-2)", overflow: "hidden", flexShrink: 0,
      }}>
        {service.thumbnail ? (
          <img src={service.thumbnail} alt={service.name}
            style={{ width: "100%", height: "100%", objectFit: "cover",
              transition: "transform 400ms var(--ease)" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex",
            alignItems: "center", justifyContent: "center", fontSize: "40px" }}>
            🎚️
          </div>
        )}
        {service.is_featured && (
          <span style={{
            position: "absolute", top: "12px", left: "12px",
            padding: "3px 10px", borderRadius: "100px",
            background: "var(--accent)", color: "#000",
            fontSize: "11px", fontWeight: 600,
          }}>
            Destacado
          </span>
        )}
      </div>

      <div style={{ padding: "20px", flex: 1, display: "flex", flexDirection: "column" }}>
        {service.category_name && (
          <p style={{ fontSize: "11px", color: "var(--text-3)", textTransform: "uppercase",
            letterSpacing: "0.08em", marginBottom: "8px", fontWeight: 500 }}>
            {service.category_name}
          </p>
        )}
        <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.1rem",
          lineHeight: 1.3, marginBottom: "8px", flex: 1 }}>
          {service.name}
        </h3>
        {service.short_description && (
          <p style={{ fontSize: "13px", color: "var(--text-2)", lineHeight: 1.6,
            marginBottom: "16px", display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {service.short_description}
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
          <div>
            <span style={{ fontSize: "16px", fontWeight: 500, color }}>
              {service.price_display}
            </span>
            {service.duration_hours && (
              <p style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "2px" }}>
                ~{service.duration_hours}h estimado
              </p>
            )}
          </div>
          <span style={{ fontSize: "12px", color: "var(--text-3)" }}>Ver detalle →</span>
        </div>
      </div>
    </Link>
  )
}

export default function Services() {
  const [activeCategory, setActiveCategory] = useState("")

  const { data: categoriesData } = useQuery({
    queryKey: ["service-categories"],
    queryFn: getServiceCategories,
  })

  const { data, isLoading } = useQuery({
    queryKey: ["services", activeCategory],
    queryFn: () => getServices(activeCategory ? { category__slug: activeCategory } : {}),
  })

  const categories = categoriesData?.results || categoriesData || []
  const services   = data?.results || data || []
  const featured   = services.filter(s => s.is_featured)
  const rest       = activeCategory ? services : services.filter(s => !s.is_featured)

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>

      {/* Hero */}
      <div style={{
        position: "relative",
        padding: "clamp(64px, 10vw, 120px) 0 0",
        borderBottom: "1px solid var(--border)",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${fondoImg})`,
          backgroundSize: "cover", opacity: 0.05,
        }} />
        <div style={{
          position: "absolute", bottom: "-100px", left: "-100px",
          width: "400px", height: "400px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(26,255,110,0.05) 0%, transparent 60%)",
        }} />
        <div className="container" style={{ maxWidth: "var(--container)", position: "relative", zIndex: 1 }}>
          <span className="pill pill-accent" style={{ marginBottom: "24px", display: "inline-flex" }}>
            Servicios Profesionales
          </span>
          <h1 style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(2.8rem, 6vw, 5rem)",
            lineHeight: 1.06, marginBottom: "20px",
          }}>
            Lleva tu sonido al{" "}
            <em style={{ fontStyle: "italic", color: "var(--accent)" }}>siguiente nivel.</em>
          </h1>
          <p style={{ fontSize: "17px", color: "var(--text-2)", maxWidth: "480px",
            lineHeight: 1.7, marginBottom: "32px" }}>
            Producción musical, mezcla, grabación, live sound y soporte técnico para iglesias.
          </p>
          <div style={{ display: "flex", gap: "12px", marginBottom: "40px" }}>
            <Link to="/services/contact" className="btn btn-accent">Solicitar cotización</Link>
            <a href="https://wa.me/5492622635045" target="_blank" rel="noreferrer"
              className="btn btn-ghost">
              WhatsApp directo
            </a>
          </div>

          {/* Categorías */}
          {categories.length > 0 && (
            <div style={{ display: "flex", gap: "8px", paddingBottom: "32px", flexWrap: "wrap" }}>
              <button onClick={() => setActiveCategory("")}
                style={{
                  padding: "7px 16px", borderRadius: "100px", fontSize: "13px",
                  cursor: "pointer", transition: "all var(--dur) var(--ease)",
                  background: !activeCategory ? "var(--text)" : "transparent",
                  color: !activeCategory ? "var(--bg)" : "var(--text-2)",
                  border: `1px solid ${!activeCategory ? "var(--text)" : "var(--border)"}`,
                }}>
                Todos
              </button>
              {categories.map(cat => (
                <button key={cat.slug} onClick={() => setActiveCategory(cat.slug)}
                  style={{
                    padding: "7px 16px", borderRadius: "100px", fontSize: "13px",
                    cursor: "pointer", transition: "all var(--dur) var(--ease)",
                    display: "flex", alignItems: "center", gap: "6px",
                    background: activeCategory === cat.slug ? "var(--text)" : "transparent",
                    color: activeCategory === cat.slug ? "var(--bg)" : "var(--text-2)",
                    border: `1px solid ${activeCategory === cat.slug ? "var(--text)" : "var(--border)"}`,
                  }}>
                  {cat.icon && <span>{cat.icon}</span>}
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="container" style={{ maxWidth: "var(--container)", padding: "48px clamp(20px, 5vw, 60px)" }}>
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "340px" }} />
            ))}
          </div>
        )}

        {!isLoading && !activeCategory && featured.length > 0 && (
          <div style={{ marginBottom: "48px" }}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem", marginBottom: "24px" }}>
              Destacados
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {featured.map(s => <ServiceCard key={s.id} service={s} />)}
            </div>
          </div>
        )}

        {!isLoading && rest.length > 0 && (
          <div>
            {!activeCategory && <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem", marginBottom: "24px" }}>
              Todos los servicios
            </h2>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {rest.map(s => <ServiceCard key={s.id} service={s} />)}
            </div>
          </div>
        )}

        {!isLoading && services.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <p style={{ fontSize: "40px", marginBottom: "16px" }}>🎚️</p>
            <p style={{ color: "var(--text-3)", fontSize: "15px" }}>Sin servicios en esta categoría.</p>
          </div>
        )}
      </div>
    </div>
  )
}