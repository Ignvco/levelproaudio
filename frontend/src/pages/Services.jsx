// pages/Services.jsx
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { MessageCircle, ArrowRight } from "lucide-react"
import { getServices, getServiceCategories } from "../api/services.api"
import { useScrollReveal } from "../hooks/useScrollReveal"
import { useSiteSettings } from "../hooks/useSiteSettings"
import ServiceCard from "../components/services/ServiceCard"
import ServiceProcess from "../components/services/ServiceProcess"
import Seo from "../components/Seo"

export default function Services() {
  const { whatsappUrl } = useSiteSettings()
  const headerRef = useScrollReveal()
  const ctaRef    = useScrollReveal({ delay: 0, scaleIn: true })
  const [category, setCategory] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["services", { category }],
    queryFn:  () => getServices({ category__slug: category || undefined }),
  })
  const services = data?.results || data || []

  const { data: allData } = useQuery({
    queryKey: ["services", { category: "" }],
    queryFn:  () => getServices(),
  })
  const totalCount = (allData?.results || allData || []).length

  const { data: catData } = useQuery({
    queryKey: ["service-categories"],
    queryFn:  getServiceCategories,
  })
  const categories = catData?.results || catData || []

  const pill = (active) => ({
    display: "inline-flex", alignItems: "center", gap: "8px",
    padding: "8px 16px", borderRadius: "var(--r-full)",
    fontSize: "13px", fontWeight: 500, cursor: "pointer",
    background: active ? "var(--text)" : "transparent",
    color:      active ? "var(--bg)" : "var(--text-2)",
    border:     active ? "1px solid var(--text)" : "1px solid var(--border)",
    transition: "all var(--dur) var(--ease)", fontFamily: "var(--font-sans)",
  })
  const countBadge = (active) => ({
    fontSize: "11px", fontWeight: 700, minWidth: "20px", height: "18px",
    borderRadius: "9999px", padding: "0 6px",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    background: active ? "rgba(0,0,0,0.15)" : "var(--surface-3)",
    color: active ? "rgba(0,0,0,0.6)" : "var(--text-3)",
  })

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Seo title="Servicios" description="Mezcla, mastering, operación en vivo y asesoría técnica de audio profesional, a medida de tu proyecto." />

      {/* Hero */}
      <div ref={headerRef} style={{ padding: "clamp(60px, 9vw, 100px) 0 0" }}>
        <div className="lp-container">
          <p style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 600,
            letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "16px",
            display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%",
              background: "var(--accent)", boxShadow: "0 0 12px var(--accent)" }} />
            Servicios
          </p>
          <h1 className="display-bold" style={{ fontFamily: "var(--font-display)",
            fontSize: "clamp(2.6rem, 5.8vw, 4.5rem)", fontWeight: 700, lineHeight: 1,
            letterSpacing: "-0.045em", marginBottom: "24px", color: "var(--text)" }}>
            Soluciones a{" "}
            <span style={{ fontStyle: "italic", fontWeight: 500, color: "var(--accent)" }}>medida.</span>
          </h1>
          <p style={{ fontSize: "17px", color: "var(--text-2)", maxWidth: "540px",
            lineHeight: 1.55, fontWeight: 400 }}>
            Asesoría técnica, instalación de estudios y producción profesional para llevar tu sonido al siguiente nivel.
          </p>

          {/* Filtros por categoría con contador */}
          {categories.length > 0 && (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "32px" }}
              data-testid="service-category-filters">
              <button onClick={() => setCategory("")} data-testid="service-filter-all"
                style={pill(category === "")}>
                Todos <span style={countBadge(category === "")}>{totalCount}</span>
              </button>
              {categories.map((cat) => (
                <button key={cat.id} onClick={() => setCategory(cat.slug)}
                  data-testid={`service-filter-${cat.slug}`} style={pill(category === cat.slug)}>
                  {cat.name}
                  {cat.services_count != null && (
                    <span style={countBadge(category === cat.slug)}>{cat.services_count}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="lp-container" style={{ paddingBlock: "clamp(40px, 5vw, 64px)" }}>
        {isLoading ? (
          <div className="services-page-grid" style={{ display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "24px" }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "440px", borderRadius: "26px" }} />
            ))}
          </div>
        ) : services.length === 0 ? (
          <div data-testid="services-empty" style={{ textAlign: "center", padding: "80px 0",
            color: "var(--text-3)", fontSize: "15px" }}>
            No hay servicios en esta categoría.
          </div>
        ) : (
          <div className="services-page-grid" style={{ display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "24px" }}>
            {services.map((s, i) => (
              <ServiceCard key={s.id} service={s} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Cómo trabajamos */}
      <div className="lp-container" style={{ paddingBottom: "clamp(56px, 7vw, 88px)" }}>
        <div style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "24px", padding: "clamp(28px, 4vw, 48px)" }}>
          <div style={{ marginBottom: "32px", maxWidth: "560px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)",
              textTransform: "uppercase", letterSpacing: "0.15em" }}>· Cómo trabajamos</p>
            <h2 className="display-bold" style={{ fontFamily: "var(--font-display)",
              fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 800, letterSpacing: "-0.03em",
              marginTop: "12px", color: "var(--text)" }}>
              Simple, claro y sin vueltas
            </h2>
          </div>
          <ServiceProcess variant="grid" />
        </div>
      </div>

      {/* CTA */}
      <div ref={ctaRef} className="lp-container" style={{ paddingBottom: "clamp(80px, 10vw, 120px)" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-2xl)", padding: "clamp(40px, 6vw, 72px)", textAlign: "center",
          position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0,
            background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(26,255,110,0.06), transparent)",
            pointerEvents: "none" }} />
          <h2 className="display-bold" style={{ fontFamily: "var(--font-display)",
            fontSize: "clamp(1.9rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.03em",
            marginBottom: "16px", color: "var(--text)", position: "relative" }}>
            ¿Tenés un proyecto en mente?
          </h2>
          <p style={{ fontSize: "16px", color: "var(--text-2)", lineHeight: 1.7,
            marginBottom: "32px", position: "relative", maxWidth: "520px", margin: "0 auto 32px" }}>
            Consultanos sin compromiso. Te asesoramos según tus necesidades y presupuesto.
          </p>
          <a href={whatsappUrl} target="_blank" rel="noreferrer"
            className="btn btn-accent" style={{ fontSize: "15px", padding: "14px 30px",
              position: "relative", gap: "10px" }}>
            <MessageCircle size={18} /> Consultar por WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}
