// pages/Services.jsx
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getServices } from "../api/services.api"
import { useScrollReveal } from "../hooks/useScrollReveal"
import { mediaUrl } from "../utils/mediaUrl"

function ServiceCard({ service, index }) {
  const ref = useScrollReveal({ delay: index * 80 })
  return (
    <Link ref={ref} to={`/services/${service.slug}`} style={{
      display:       "flex",
      flexDirection: "column",
      background:    "var(--surface)",
      border:        "1px solid var(--border)",
      borderRadius:  "var(--r-xl)",
      overflow:      "hidden",
      textDecoration:"none",
      transition:    "all var(--dur-slow) var(--ease)",
    }}
      className="card card-glow"
    >
      {service.thumbnail && (
        <div style={{ aspectRatio: "16/9", overflow: "hidden" }}>
          <img src={mediaUrl(service.thumbnail)} alt={service.name}
            style={{ width: "100%", height: "100%", objectFit: "cover",
              transition: "transform 600ms var(--ease)" }}
            onMouseEnter={e => e.target.style.transform = "scale(1.05)"}
            onMouseLeave={e => e.target.style.transform = "scale(1)"}
          />
        </div>
      )}
      <div style={{ padding: "24px", flex: 1,
        display: "flex", flexDirection: "column", gap: "12px" }}>
        <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.3rem",
          fontWeight: 300, color: "var(--text)" }}>
          {service.name}
        </h3>
        <p style={{ fontSize: "14px", color: "var(--text-3)", lineHeight: 1.7,
          flex: 1 }}>
          {service.short_description}
        </p>
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", paddingTop: "16px",
          borderTop: "1px solid var(--border)" }}>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.4rem",
            color: "var(--text)" }}>
            {service.price_display}
          </p>
          <span style={{ fontSize: "13px", color: "var(--accent)",
            display: "flex", alignItems: "center", gap: "4px",
            fontWeight: 500 }}>
            Ver más →
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function Services() {
  const headerRef = useScrollReveal()
  const ctaRef    = useScrollReveal({ delay: 0, scaleIn: true })

  const { data, isLoading } = useQuery({
    queryKey: ["services"],
    queryFn:  getServices,
  })
  const services = data?.results || data || []

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>

      {/* Hero */}
      <div ref={headerRef} style={{
        padding: "clamp(60px, 9vw, 100px) clamp(20px, 5vw, 60px)",
      }}>
        <div style={{ maxWidth: "var(--container)", margin: "0 auto" }}>
          <p style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 600,
            letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "16px",
            display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%",
              background: "var(--accent)",
              boxShadow: "0 0 12px var(--accent)" }} />
            Servicios
          </p>
          <h1 className="display-bold" style={{
            fontFamily:    "var(--font-display)",
            fontSize:      "clamp(2.6rem, 5.8vw, 4.5rem)",
            fontWeight:    700,
            lineHeight:    1,
            letterSpacing: "-0.045em",
            marginBottom:  "24px",
            color: "var(--text)",
          }}>
            Soluciones a{" "}
            <span style={{ fontStyle: "italic", fontWeight: 500,
              color: "var(--accent)" }}>medida.</span>
          </h1>
          <p style={{ fontSize: "17px", color: "var(--text-2)",
            maxWidth: "540px", lineHeight: 1.55, fontWeight: 400 }}>
            Asesoría técnica, instalación de estudios y producción profesional.
          </p>
        </div>
      </div>

      {/* Grid */}
      <div style={{ maxWidth: "var(--container)", margin: "0 auto",
        padding: "clamp(48px, 6vw, 80px) clamp(20px, 5vw, 60px)" }}>
        {isLoading ? (
          <div style={{ display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "340px" }} />
            ))}
          </div>
        ) : (
          <div style={{ display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
            {services.map((s, i) => (
              <ServiceCard key={s.id} service={s} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <div ref={ctaRef} style={{
        maxWidth: "var(--container)", margin: "0 auto",
        padding: "0 clamp(20px, 5vw, 60px) clamp(80px, 10vw, 120px)",
      }}>
        <div style={{
          background:   "var(--surface)",
          border:       "1px solid var(--border)",
          borderRadius: "var(--r-2xl)",
          padding:      "clamp(40px, 6vw, 72px)",
          textAlign:    "center",
          position:     "relative",
          overflow:     "hidden",
        }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(26,255,110,0.05), transparent)",
            pointerEvents: "none",
          }} />
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2rem, 4vw, 3rem)",
            fontWeight: 300, marginBottom: "16px" }}>
            ¿Tenés un proyecto en mente?
          </h2>
          <p style={{ fontSize: "16px", color: "var(--text-2)", lineHeight: 1.7,
            marginBottom: "32px" }}>
            Consultanos sin compromiso. Te asesoramos según tus necesidades y presupuesto.
          </p>
          <a href="https://wa.me/5492622635045" target="_blank" rel="noreferrer"
            className="btn btn-accent" style={{ fontSize: "15px", padding: "14px 32px" }}>
            💬 Consultar por WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}