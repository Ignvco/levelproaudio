// pages/Home.jsx — LevelPro Audio · SaaS Home (3 pilares reales: Tienda / Academia / Servicios)
// UI inspirada en consola de estudio: LED, VU meter, digital readout, knob, fader, waveform
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getProducts, getBrands } from "../api/products.api"
import { getCourses } from "../api/academy.api"
import { getServices } from "../api/services.api"
import { getSiteSettings } from "../api/siteSettings.api"
import { mediaUrl } from "../utils/mediaUrl"
import ProductCard from "../components/product/ProductCard"
import CourseCard from "../components/academy/CourseCard"
import ServiceCard from "../components/services/ServiceCard"
import {
  LED, VUMeter, DigitalReadout, Knob, Fader, AnimatedWaveform,
} from "../components/ui/StudioUI"

// ─── helpers ───────────────────────────────────────────────────
const clp = (n) => new Intl.NumberFormat("es-CL", { style: "currency",
  currency: "CLP", maximumFractionDigits: 0 }).format(Number(n))

const AVATARS = {
  female: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=600&q=80",
  male:   "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80",
  small1: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80",
  small2: "https://images.unsplash.com/photo-1500048993953-d23a436266cf?auto=format&fit=crop&w=200&q=80",
}

// Icono SVG minimalista
function Icon({ name, size = 18 }) {
  const paths = {
    arrow:    "M5 12h14 M12 5l7 7-7 7",
    cart:     "M9 22a1 1 0 100-2 1 1 0 000 2z M20 22a1 1 0 100-2 1 1 0 000 2z M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6",
    grad:     "M22 10L12 4 2 10l10 6 10-6z M6 12v5c3 3 9 3 12 0v-5",
    tools:    "M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z",
    play:     "M5 3l14 9-14 9V3z",
    trend:    "M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6",
    star:     "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21l1.18-6.88-5-4.87 6.91-1.01L12 2z",
    mic:      "M12 1a3 3 0 013 3v8a3 3 0 11-6 0V4a3 3 0 013-3z M19 10v2a7 7 0 11-14 0v-2 M12 19v4 M8 23h8",
    clock:    "M12 22a10 10 0 100-20 10 10 0 000 20z M12 6v6l4 2",
    check:    "M20 6L9 17l-5-5",
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[name].split(" M").map((p, i) => (
        <path key={i} d={i === 0 ? p : `M${p}`} />
      ))}
    </svg>
  )
}

// ── Animated counter ─────────────────────────────────────────
function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      const end = parseInt(String(value).replace(/\D/g, ""))
      let s = 0, step = end / (1400 / 16)
      const t = setInterval(() => {
        s += step
        if (s >= end) { setDisplay(end); clearInterval(t) }
        else { setDisplay(Math.floor(s)) }
      }, 16)
      obs.disconnect()
    }, { threshold: 0.4 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [value])
  return <span ref={ref}>{display}</span>
}

// ═══════════════════════════════════════════════════════════════
export default function Home() {
  const { data: featuredData } = useQuery({
    queryKey: ["products", { featured: true }],
    queryFn:  () => getProducts({ is_featured: true, page_size: 4 }),
  })
  const { data: coursesData } = useQuery({
    queryKey: ["courses-home"],
    queryFn:  () => getCourses({ page_size: 3 }),
  })
  const { data: servicesData } = useQuery({
    queryKey: ["services-home"],
    queryFn:  () => getServices({ page_size: 3 }),
  })
  const { data: brandsData } = useQuery({
    queryKey: ["brands"], queryFn: getBrands,
  })
  const { data: settings } = useQuery({
    queryKey: ["site-settings"], queryFn: getSiteSettings,
    staleTime: 30 * 1000,  // 30s — para que cambios en admin se reflejen rápido
  })

  const featured  = featuredData?.results  || featuredData  || []
  const courses   = coursesData?.results   || coursesData   || []
  const services  = servicesData?.results  || servicesData  || []
  const brands    = brandsData?.results    || brandsData    || []
  const s         = settings || {}

  return (
    <div style={{
      background: "var(--bg)",
      display: "flex", flexDirection: "column",
    }} data-testid="home-page">

      {/* ═════════════════════════════════════════════════════════════
          HERO — split · left copy · right console-inspired glass
          ═════════════════════════════════════════════════════════════ */}
      <section
        data-testid="home-hero"
        style={{
          position: "relative",
          background: "#0b0b0b",
          overflow: "hidden",
          minHeight: "100vh",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Imagen de fondo custom (si el admin subió una en Personalización) */}
        {s.hero_image_url && (
          <div
            aria-hidden
            style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              backgroundImage: `url(${mediaUrl(s.hero_image_url)})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              opacity: 1,
              zIndex: 0,
            }}
          />
        )}
        {/* Overlay oscuro para asegurar legibilidad del texto sobre la imagen */}
        {s.hero_image_url && (
          <div
            aria-hidden
            style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: "linear-gradient(90deg, rgba(8,8,8,0.82) 0%, rgba(8,8,8,0.5) 38%, rgba(8,8,8,0.12) 68%, rgba(8,8,8,0.35) 100%), linear-gradient(180deg, rgba(8,8,8,0.35) 0%, transparent 30%, transparent 55%, rgba(8,8,8,0.75) 100%)",
              zIndex: 1,
            }}
          />
        )}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `
            radial-gradient(ellipse 55% 60% at 78% 40%, rgba(26,255,110,0.10) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 15% 90%, rgba(26,255,110,0.05) 0%, transparent 60%)
          `,
        }} />

        <div style={{
          position: "relative", zIndex: 2,
          display: "grid", gridTemplateColumns: "1.25fr 0.85fr",
          gap: "40px", alignItems: "end",
          flex: 1,
          padding: "clamp(110px, 15vh, 165px) clamp(28px, 5vw, 72px) 40px",
        }} className="hero-grid">

          {/* LEFT — headline + tags */}
          <div style={{ alignSelf: "start" }}>
            <LED color="green" label={s.tagline || "Chile & Argentina"} />

            <h1 className="display-bold" data-testid="hero-headline" style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.6rem, 5.8vw, 4.8rem)",
              fontWeight: 700, lineHeight: 1,
              letterSpacing: "-0.045em", color: "var(--text)",
              marginTop: "32px", marginBottom: "28px",
              textShadow: s.hero_image_url ? "0 6px 40px rgba(0,0,0,0.5)" : "none",
            }}>
              {(s.hero_title || "Llevá tu sonido al nivel profesional.").split(" ").map((w, i, arr) => {
                const isLast = i === arr.length - 1
                return isLast ? (
                  <span key={i} style={{
                    color: "var(--accent)", fontStyle: "italic", fontWeight: 500,
                  }}>{w}</span>
                ) : (
                  <span key={i}>{w} </span>
                )
              })}
            </h1>

            <div data-testid="hero-tags" style={{ display: "flex",
              alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              {(s.hero_tags?.length ? s.hero_tags
                : ["Equipamiento", "Formación", "Servicios"]).map((t, i) => (
                <span key={i} style={{ display: "inline-flex",
                  alignItems: "center", gap: "16px" }}>
                  {i > 0 && (
                    <span style={{ color: "var(--accent)", fontSize: "18px",
                      fontWeight: 800, lineHeight: 1 }}>+</span>
                  )}
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px",
                    fontWeight: 700, letterSpacing: "0.14em",
                    textTransform: "uppercase", color: "var(--text-2)" }}>
                    {t}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* RIGHT — copy + CTA */}
          <div className="hero-right" style={{ alignSelf: "end", justifySelf: "end",
            maxWidth: "380px", paddingBottom: "6px" }}>
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: "16px",
              color: "var(--text-2)", lineHeight: 1.6, marginBottom: "24px",
            }}>
              {s.hero_subtitle || "El ecosistema completo para músicos, productores e ingenieros. Equipamiento, formación y servicios en un solo lugar."}
            </p>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <Link to={s.hero_cta1_link || "/shop"} data-testid="hero-cta-primary" style={{
                display: "inline-flex", alignItems: "center", gap: "10px",
                padding: "14px 12px 14px 24px", borderRadius: "var(--r-full)",
                background: "var(--accent)", color: "#000",
                fontSize: "14px", fontWeight: 700, textDecoration: "none",
                fontFamily: "var(--font-sans)",
                boxShadow: "0 8px 30px rgba(26,255,110,0.3)",
                transition: "transform 200ms var(--ease)",
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)" }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)" }}>
                {s.hero_cta1_text || "Explorar tienda"}
                <span style={{ width: "26px", height: "26px", borderRadius: "50%",
                  background: "#000", color: "var(--accent)", display: "flex",
                  alignItems: "center", justifyContent: "center" }}>
                  <Icon name="arrow" size={14} />
                </span>
              </Link>
              <Link to={s.hero_cta2_link || "/academy"} data-testid="hero-cta-secondary" style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "14px 22px", borderRadius: "var(--r-full)",
                background: "rgba(255,255,255,0.06)", color: "var(--text)",
                border: "1px solid rgba(255,255,255,0.16)",
                fontSize: "14px", fontWeight: 600, textDecoration: "none",
                fontFamily: "var(--font-sans)", backdropFilter: "blur(6px)",
                transition: "all 200ms var(--ease)",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)" }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)"; e.currentTarget.style.color = "var(--text)" }}>
                {s.hero_cta2_text || "Ver academia"}
              </Link>
            </div>
          </div>
        </div>

        {/* Tira de marcas dentro del hero — transparente, un poco elevada */}
        {s.show_brands !== false && brands.length > 0 && (
          <div data-testid="hero-brands-strip" style={{
            position: "relative", zIndex: 2,
            background: "transparent",
            padding: "16px 0", overflow: "hidden",
            marginBottom: "clamp(60px, 9vh, 110px)",
          }}>
            <div style={{ display: "flex", gap: "60px", width: "max-content",
              alignItems: "center", animation: "marquee 30s linear infinite",
              paddingLeft: "60px" }}>
              {[...brands, ...brands].map((b, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center",
                  flexShrink: 0, height: "30px", opacity: 0.75,
                  transition: "opacity 200ms var(--ease)" }}
                  onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                  onMouseLeave={e => e.currentTarget.style.opacity = "0.75"}>
                  {b.logo_url || b.logo ? (
                    <img src={mediaUrl(b.logo_url || b.logo)} alt={b.name}
                      style={{ height: "26px", maxWidth: "130px", objectFit: "contain",
                        filter: "brightness(0) invert(1)" }} />
                  ) : (
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "17px",
                      fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)",
                      whiteSpace: "nowrap" }}>
                      {b.name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* BODY — sube sobre el hero con bordes redondos superiores */}
      <div className="home-body" style={{
        position: "relative", zIndex: 3,
        background: "var(--bg)",
        borderRadius: "clamp(28px, 4vw, 44px) clamp(28px, 4vw, 44px) 0 0",
        marginTop: "clamp(-56px, -6vh, -40px)",
        padding: "clamp(40px, 5vw, 60px) clamp(12px, 2vw, 20px) 40px",
        display: "flex", flexDirection: "column",
        gap: "clamp(20px, 3vw, 32px)",
      }} data-testid="home-body">

      {/* ═════════════════════════════════════════════════════════════
          TRUST STRIP — 4 métricas reales con digital readout
          ═════════════════════════════════════════════════════════════ */}
      {s.show_trust_strip !== false && (
      <section data-testid="trust-strip" style={{ padding: 0 }}>
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-2xl)",
          padding: "24px clamp(20px, 3vw, 40px)",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "24px",
        }} className="trust-grid">
          {[
            { label: "Productos",   value: featured.length > 0 ? "500+" : "500+", unit: "" },
            { label: "Marcas top",  value: String(brands.length || 45),           unit: "+" },
            { label: "Estudiantes", value: "2000",                                unit: "+" },
            { label: "Proyectos",   value: "1300",                                unit: "+" },
          ].map((m) => (
            <div key={m.label} style={{
              display: "flex", flexDirection: "column",
              gap: "10px", alignItems: "flex-start",
            }}>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "10px",
                color: "var(--text-3)", textTransform: "uppercase",
                letterSpacing: "0.15em", fontWeight: 700 }}>
                {m.label}
              </p>
              <p style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.9rem, 3vw, 2.5rem)",
                fontWeight: 800, color: "var(--text)",
                letterSpacing: "-0.03em", lineHeight: 1,
              }}>
                <AnimatedNumber value={m.value} />{m.unit}
              </p>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* ═════════════════════════════════════════════════════════════
          3 PILARES DE LEVELPRO — Tienda · Academia · Servicios
          Reemplaza el bloque "planes" ficticio con los verticales reales
          ═════════════════════════════════════════════════════════════ */}
      {s.show_pillars !== false && (
      <section data-testid="pillars-section" style={{ padding: "clamp(24px, 3vw, 40px) 0" }}>
        <div style={{
          display: "flex", flexDirection: "column",
          gap: "clamp(32px, 4vw, 48px)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "flex-end", flexWrap: "wrap", gap: "16px",
            padding: "0 clamp(4px, 1vw, 8px)" }}>
            <div>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "11px",
                color: "var(--accent)", textTransform: "uppercase",
                letterSpacing: "0.15em", marginBottom: "12px", fontWeight: 700 }}>
                · Todo lo que necesitás
              </p>
              <h2 className="display-bold" style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.8rem, 3vw, 2.6rem)",
                fontWeight: 800, lineHeight: 1,
                letterSpacing: "-0.03em", color: "var(--text)",
                maxWidth: "600px",
              }}>
                Un ecosistema. Tres pilares.
              </h2>
            </div>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px",
              color: "var(--text-2)", lineHeight: 1.6, maxWidth: "380px" }}>
              LevelPro combina tienda, academia y servicios profesionales
              en una sola plataforma pensada para audio pro.
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "12px",
          }} className="pillars-grid">
            {[
              {
                num: "01", icon: "cart",
                title: "Tienda",
                desc: "Equipamiento profesional de las marcas top de la industria — con stock real y precios en CLP.",
                to: "/shop", cta: "Ver tienda",
                stat: { label: "Productos", value: "500+" },
              },
              {
                num: "02", icon: "grad",
                title: "Academia",
                desc: "Cursos técnicos en video con instructores del oficio. Producción, mezcla, masterización y más.",
                to: "/academy", cta: "Ver cursos",
                stat: { label: "Cursos", value: String(courses.length || 12) },
              },
              {
                num: "03", icon: "tools",
                title: "Servicios",
                desc: "Mezcla, mastering, operación en vivo y asesoría técnica — contratados a medida de tu proyecto.",
                to: "/services", cta: "Ver servicios",
                stat: { label: "Servicios", value: String(services.length || 8) },
              },
            ].map(p => (
              <Link key={p.num} to={p.to} data-testid={`pillar-${p.title.toLowerCase()}`}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-2xl)",
                  padding: "32px 28px 28px",
                  textDecoration: "none",
                  display: "flex", flexDirection: "column",
                  gap: "24px", minHeight: "320px",
                  position: "relative", overflow: "hidden",
                  transition: "border-color 240ms var(--ease), transform 240ms var(--ease)",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "rgba(26,255,110,0.35)"
                  e.currentTarget.style.transform = "translateY(-4px)"
                  const g = e.currentTarget.querySelector(".pillar-glow")
                  if (g) g.style.opacity = "1"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "var(--border)"
                  e.currentTarget.style.transform = "translateY(0)"
                  const g = e.currentTarget.querySelector(".pillar-glow")
                  if (g) g.style.opacity = "0"
                }}>

                {/* Glow decorativo */}
                <div className="pillar-glow" style={{
                  position: "absolute", top: "-30%", right: "-30%",
                  width: "70%", height: "70%",
                  background: "radial-gradient(circle, rgba(26,255,110,0.15) 0%, transparent 70%)",
                  opacity: 0, transition: "opacity 300ms var(--ease)",
                  pointerEvents: "none",
                }} />

                <div style={{ position: "relative", display: "flex",
                  justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{
                    width: "48px", height: "48px", borderRadius: "var(--r-md)",
                    background: "var(--accent-dim)",
                    border: "1px solid rgba(26,255,110,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--accent)",
                  }}>
                    <Icon name={p.icon} size={22} />
                  </div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "11px", color: "var(--text-3)",
                    letterSpacing: "0.05em" }}>
                    /{p.num}
                  </span>
                </div>

                <div style={{ position: "relative", flex: 1 }}>
                  <h3 style={{ fontFamily: "var(--font-display)",
                    fontSize: "26px", fontWeight: 800, color: "var(--text)",
                    letterSpacing: "-0.02em", lineHeight: 1,
                    marginBottom: "12px" }}>
                    {p.title}
                  </h3>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px",
                    color: "var(--text-2)", lineHeight: 1.6 }}>
                    {p.desc}
                  </p>
                </div>

                <div style={{ position: "relative",
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: "20px",
                  borderTop: "1px solid var(--border)" }}>
                  <div>
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: "9px",
                      color: "var(--text-3)", textTransform: "uppercase",
                      letterSpacing: "0.15em", fontWeight: 700, marginBottom: "4px" }}>
                      {p.stat.label}
                    </p>
                    <p style={{
                      fontFamily: "var(--font-display)", fontSize: "20px",
                      fontWeight: 800, color: "var(--text)",
                      letterSpacing: "-0.02em", lineHeight: 1,
                    }}>{p.stat.value}</p>
                  </div>
                  {/* arrow cta */}
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    color: "var(--accent)", fontSize: "12px", fontWeight: 700,
                    fontFamily: "var(--font-sans)",
                  }}>
                    {p.cta} <Icon name="arrow" size={12} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ═════════════════════════════════════════════════════════════
          PRODUCTOS DESTACADOS — con LED stock + VU meter rating
          ═════════════════════════════════════════════════════════════ */}
      {s.show_products !== false && featured.length > 0 && (
        <section data-testid="featured-products" style={{ padding: 0 }}>
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-2xl)",
            padding: "clamp(28px, 3vw, 40px)",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "flex-end", marginBottom: "32px", flexWrap: "wrap",
              gap: "16px",
            }}>
              <div>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "11px",
                  color: "var(--accent)", textTransform: "uppercase",
                  letterSpacing: "0.15em", marginBottom: "12px", fontWeight: 700 }}>
                  · Tienda · Destacados
                </p>
                <h2 className="display-bold" style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.6rem, 2.4vw, 2.2rem)",
                  fontWeight: 800, lineHeight: 1,
                  letterSpacing: "-0.03em", color: "var(--text)",
                }}>
                  Lo que suena en los mejores estudios.
                </h2>
              </div>
              <Link to="/shop" style={{
                padding: "10px 20px", borderRadius: "var(--r-full)",
                border: "1px solid var(--border)",
                color: "var(--text)", background: "transparent",
                fontSize: "12px", fontWeight: 600, textDecoration: "none",
                fontFamily: "var(--font-sans)",
                display: "inline-flex", alignItems: "center", gap: "6px",
              }}>
                Ver toda la tienda <Icon name="arrow" size={12} />
              </Link>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "20px",
            }} className="products-grid">
              {featured.slice(0, 4).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Academia */}
      {s.show_courses !== false && courses.length > 0 && (
        <section data-testid="featured-courses" style={{ padding: 0 }}>
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-2xl)",
            padding: "clamp(28px, 3vw, 40px)",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "flex-end", marginBottom: "32px", flexWrap: "wrap",
              gap: "16px",
            }}>
              <div>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "11px",
                  color: "var(--accent)", textTransform: "uppercase",
                  letterSpacing: "0.15em", marginBottom: "12px", fontWeight: 700 }}>
                  · Academia
                </p>
                <h2 className="display-bold" style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.6rem, 2.4vw, 2.2rem)",
                  fontWeight: 800, lineHeight: 1,
                  letterSpacing: "-0.03em", color: "var(--text)",
                }}>
                  Aprendé de los que graban a los grandes.
                </h2>
              </div>
              <Link to="/academy" style={{
                padding: "10px 20px", borderRadius: "var(--r-full)",
                border: "1px solid var(--border)",
                color: "var(--text)", background: "transparent",
                fontSize: "12px", fontWeight: 600, textDecoration: "none",
                fontFamily: "var(--font-sans)",
                display: "inline-flex", alignItems: "center", gap: "6px",
              }}>
                Ver todos los cursos <Icon name="arrow" size={12} />
              </Link>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "20px",
            }} className="courses-grid">
              {courses.slice(0, 3).map((c, i) => (
                <CourseCard key={c.id} course={c} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Servicios */}
      {s.show_services !== false && services.length > 0 && (
        <section data-testid="featured-services" style={{ padding: 0 }}>
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-2xl)",
            padding: "clamp(28px, 3vw, 40px)",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "flex-end", marginBottom: "32px", flexWrap: "wrap",
              gap: "16px",
            }}>
              <div>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "11px",
                  color: "var(--accent)", textTransform: "uppercase",
                  letterSpacing: "0.15em", marginBottom: "12px", fontWeight: 700 }}>
                  · Servicios
                </p>
                <h2 className="display-bold" style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.6rem, 2.4vw, 2.2rem)",
                  fontWeight: 800, lineHeight: 1,
                  letterSpacing: "-0.03em", color: "var(--text)",
                }}>
                  Contratá servicios profesionales a medida.
                </h2>
              </div>
              <Link to="/services" style={{
                padding: "10px 20px", borderRadius: "var(--r-full)",
                border: "1px solid var(--border)",
                color: "var(--text)", background: "transparent",
                fontSize: "12px", fontWeight: 600, textDecoration: "none",
                fontFamily: "var(--font-sans)",
                display: "inline-flex", alignItems: "center", gap: "6px",
              }}>
                Ver todos <Icon name="arrow" size={12} />
              </Link>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "20px",
            }} className="services-grid">
              {services.slice(0, 3).map((s, i) => (
                <ServiceCard key={s.id} service={s} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonial */}
      {s.show_testimonial !== false && (
      <section data-testid="testimonial" style={{ padding: 0 }}>
        <div style={{
          background: "linear-gradient(135deg, var(--surface) 0%, rgba(26,255,110,0.03) 100%)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-2xl)",
          padding: "clamp(32px, 4vw, 60px)",
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "clamp(24px, 4vw, 48px)",
          alignItems: "center",
        }} className="testimonial-grid">
          <div style={{
            width: "160px", height: "200px",
            borderRadius: "var(--r-xl)", overflow: "hidden",
            flexShrink: 0,
          }}>
            <img src={s.testimonial_photo_url ? mediaUrl(s.testimonial_photo_url) : AVATARS.male} alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover",
                filter: "grayscale(15%) contrast(1.05)" }} />
          </div>
          <div>
            <LED color="green" label="Cliente verificado" />
            <p style={{ fontFamily: "var(--font-display)",
              fontSize: "clamp(1.3rem, 2.2vw, 1.8rem)",
              fontWeight: 700, color: "var(--text)",
              lineHeight: 1.3, letterSpacing: "-0.02em",
              marginTop: "20px", marginBottom: "20px" }}>
              &ldquo;{s.testimonial_quote || "La asesoría técnica marcó la diferencia. Compré exactamente lo que necesitaba para mi estudio y encima aprendí a mezclarlo con los cursos."}&rdquo;
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "12px",
              flexWrap: "wrap" }}>
              <div>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "14px",
                  fontWeight: 700, color: "var(--text)" }}>
                  {s.testimonial_name || "Diego Ramírez"}
                </p>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "12px",
                  color: "var(--text-3)" }}>
                  {s.testimonial_role || "Productor · Santiago de Chile"}
                </p>
              </div>
              <div style={{ height: "24px", width: "1px",
                background: "var(--border)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: "4px",
                color: "var(--accent)" }}>
                {[...Array(5)].map((_, i) => (
                  <Icon key={i} name="star" size={12} />
                ))}
                <span style={{ fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "11px", color: "var(--text-2)", marginLeft: "6px" }}>
                  5.0
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Brands strip movido al hero */}


      {/* Final CTA */}
      {s.show_final_cta !== false && (
      <section data-testid="final-cta" style={{ padding: 0 }}>
        <div style={{
          position: "relative",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-2xl)",
          padding: "clamp(56px, 8vw, 100px) clamp(28px, 4vw, 60px)",
          overflow: "hidden",
          textAlign: "center",
        }}>
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: `
              radial-gradient(ellipse 70% 60% at 50% 30%, rgba(26,255,110,0.15) 0%, transparent 60%)
            `,
          }} />
          <div style={{ position: "relative", zIndex: 1, maxWidth: "640px",
            margin: "0 auto" }}>
            <LED color="green" label="Empezá hoy" />
            <h2 className="display-bold" style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 4vw, 3.4rem)",
              fontWeight: 900, lineHeight: 0.95,
              letterSpacing: "-0.04em", color: "var(--text)",
              marginTop: "20px", marginBottom: "20px",
            }}>
              Subí el nivel.<br />
              De verdad.
            </h2>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "16px",
              color: "var(--text-2)", lineHeight: 1.65,
              marginBottom: "36px", maxWidth: "480px",
              margin: "0 auto 36px" }}>
              Sumate a los +2.000 profesionales que compraron equipo,
              se capacitaron y contrataron servicios con LevelPro.
            </p>
            <div style={{ display: "flex", gap: "12px",
              justifyContent: "center", flexWrap: "wrap" }}>
              <Link to="/shop" data-testid="final-cta-shop" style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "13px 26px", borderRadius: "var(--r-full)",
                background: "var(--accent)", color: "#000",
                fontSize: "14px", fontWeight: 700, textDecoration: "none",
                fontFamily: "var(--font-sans)",
                boxShadow: "0 8px 30px rgba(26,255,110,0.3)",
              }}>
                Explorar tienda <Icon name="arrow" size={14} />
              </Link>
              <Link to="/services" data-testid="final-cta-services" style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "13px 26px", borderRadius: "var(--r-full)",
                background: "transparent", color: "var(--text)",
                border: "1px solid var(--border)",
                fontSize: "14px", fontWeight: 600, textDecoration: "none",
                fontFamily: "var(--font-sans)",
              }}>
                Hablar con un experto
              </Link>
            </div>
          </div>
        </div>
      </section>
      )}

      </div>
      {/* /home-body */}

      <style>{`
        @media (max-width: 1024px) {
          .hero-grid       { grid-template-columns: 1fr !important; }
          .hero-right      { justify-self: start !important; max-width: 100% !important; }
          .hero-visual     { height: 380px !important; margin-top: 20px !important; }
          .trust-grid      { grid-template-columns: repeat(2, 1fr) !important; gap: 20px !important; }
          .pillars-grid    { grid-template-columns: 1fr !important; }
          .products-grid   { grid-template-columns: repeat(2, 1fr) !important; }
          .courses-grid    { grid-template-columns: 1fr !important; }
          .services-grid   { grid-template-columns: 1fr !important; }
          .testimonial-grid{ grid-template-columns: 1fr !important; }
          .brands-strip-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
        }
      `}</style>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Product card — con LED de stock + VU meter + digital price
// ═══════════════════════════════════════════════════════════════
function ProductStudioCard({ product }) {
  const img = product.primary_image || product.images?.[0]?.image
  const stockNum = product.stock ?? 12
  const inStock = stockNum > 0
  const lowStock = inStock && stockNum <= 3
  // Random-ish "rating" derivado del ID (para el VU meter demo — reemplazar por rating real)
  const rating = Math.min(100, 60 + (product.name?.length || 20) * 1.5)

  return (
    <Link to={`/product/${product.slug}`}
      data-testid={`featured-${product.slug}`} style={{
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      borderRadius: "var(--r-xl)",
      padding: "16px",
      textDecoration: "none", display: "flex", flexDirection: "column",
      gap: "12px",
      transition: "all 240ms var(--ease)",
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "rgba(26,255,110,0.3)"
        e.currentTarget.style.transform = "translateY(-4px)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "var(--border)"
        e.currentTarget.style.transform = "translateY(0)"
      }}>
      {/* Image */}
      <div style={{
        aspectRatio: "1", background: "var(--surface-3)",
        borderRadius: "var(--r-md)", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
      }}>
        {img ? (
          <img src={mediaUrl(img)} alt={product.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Icon name="mic" size={40} />
        )}
        {/* LED stock indicator sobre la imagen */}
        <div style={{
          position: "absolute", top: "10px", left: "10px",
          padding: "5px 10px", borderRadius: "var(--r-full)",
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}>
          {inStock
            ? <LED color={lowStock ? "amber" : "green"}
                label={lowStock ? `Últimos ${stockNum}` : "En stock"}
                size={6} />
            : <LED color="red" label="Agotado" blinking={false} size={6} />
          }
        </div>
      </div>

      {/* Brand */}
      <p style={{
        fontFamily: "var(--font-sans)", fontSize: "9px",
        color: "var(--text-3)", textTransform: "uppercase",
        letterSpacing: "0.1em", fontWeight: 700,
      }}>
        {product.brand?.name || product.brand_name || "—"}
      </p>

      {/* Name */}
      <p style={{
        fontFamily: "var(--font-display)", fontSize: "14px",
        fontWeight: 700, color: "var(--text)",
        letterSpacing: "-0.01em", lineHeight: 1.25,
        overflow: "hidden", textOverflow: "ellipsis",
        display: "-webkit-box", WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical", minHeight: "36px",
      }}>
        {product.name}
      </p>

      {/* VU meter rating */}
      <VUMeter value={rating} segments={14} showLabel label="RATING" />

      {/* Price + arrow */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginTop: "4px",
      }}>
        <span style={{
          fontFamily: "var(--font-display)", fontSize: "16px",
          fontWeight: 800, color: "var(--text)",
          letterSpacing: "-0.01em", lineHeight: 1,
        }}>
          {clp(Number(product.price))}
        </span>
        <span style={{
          width: "26px", height: "26px", borderRadius: "50%",
          background: "var(--accent-dim)",
          border: "1px solid rgba(26,255,110,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--accent)", flexShrink: 0,
        }}>
          <Icon name="arrow" size={12} />
        </span>
      </div>
    </Link>
  )
}

// ═══════════════════════════════════════════════════════════════
// (legacy) Course card antigua — reemplazada por el CourseCard folder-tab compartido
// ═══════════════════════════════════════════════════════════════
// eslint-disable-next-line no-unused-vars
function CourseCardLegacy({ course }) {
  const thumb = course.thumbnail_url || course.thumbnail
  const levelColors = {
    beginner:     "#4ade80",
    intermediate: "#facc15",
    advanced:     "#f87171",
  }
  const levelColor = levelColors[course.level] || "var(--accent)"

  return (
    <Link to={`/academy/${course.slug}`}
      data-testid={`featured-course-${course.slug}`} style={{
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      borderRadius: "var(--r-xl)",
      overflow: "hidden",
      textDecoration: "none", display: "flex", flexDirection: "column",
      transition: "all 240ms var(--ease)",
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "rgba(26,255,110,0.3)"
        e.currentTarget.style.transform = "translateY(-4px)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "var(--border)"
        e.currentTarget.style.transform = "translateY(0)"
      }}>
      {/* Thumbnail */}
      <div style={{
        aspectRatio: "16/9", background: "var(--surface-3)",
        overflow: "hidden", position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {thumb ? (
          <img src={mediaUrl(thumb)} alt={course.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Icon name="grad" size={40} />
        )}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.7) 100%)",
        }} />
        {/* Level badge */}
        <div style={{
          position: "absolute", top: "12px", left: "12px",
          padding: "4px 10px", borderRadius: "var(--r-full)",
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(12px)",
          border: `1px solid ${levelColor}44`,
          fontFamily: "var(--font-sans)", fontSize: "10px",
          fontWeight: 700, color: levelColor,
          textTransform: "uppercase", letterSpacing: "0.08em",
        }}>
          {course.level_display || course.level}
        </div>
        {/* Free badge */}
        {course.is_free && (
          <div style={{
            position: "absolute", top: "12px", right: "12px",
            padding: "4px 10px", borderRadius: "var(--r-full)",
            background: "var(--accent)", color: "#000",
            fontFamily: "var(--font-sans)", fontSize: "10px", fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            Gratis
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "20px", display: "flex", flexDirection: "column",
        gap: "12px", flex: 1 }}>
        <p style={{
          fontFamily: "var(--font-display)", fontSize: "16px",
          fontWeight: 700, color: "var(--text)",
          letterSpacing: "-0.01em", lineHeight: 1.25,
        }}>
          {course.title}
        </p>
        <p style={{
          fontFamily: "var(--font-sans)", fontSize: "12px",
          color: "var(--text-2)", lineHeight: 1.5,
          overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {course.short_description}
        </p>

        {/* Stats — lecciones + duración */}
        <div style={{ display: "flex", gap: "14px",
          fontFamily: "var(--font-sans)", fontSize: "11px",
          color: "var(--text-3)", marginTop: "auto" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
            <Icon name="play" size={11} />
            {course.total_lessons || 0} lecciones
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
            <Icon name="clock" size={11} />
            {course.total_duration || 0} min
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", marginTop: "8px",
          paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
          {course.is_free ? (
            <p style={{ fontFamily: "var(--font-display)",
              fontSize: "16px", fontWeight: 800, color: "var(--text)",
              letterSpacing: "-0.01em" }}>
              Gratis
            </p>
          ) : (
            <span style={{
              fontFamily: "var(--font-display)", fontSize: "16px",
              fontWeight: 800, color: "var(--text)",
              letterSpacing: "-0.01em", lineHeight: 1,
            }}>
              {clp(course.price)}
            </span>
          )}
          <span style={{
            width: "26px", height: "26px", borderRadius: "50%",
            background: "var(--accent-dim)",
            border: "1px solid rgba(26,255,110,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--accent)",
          }}>
            <Icon name="arrow" size={12} />
          </span>
        </div>
      </div>
    </Link>
  )
}

// ═══════════════════════════════════════════════════════════════
// (legacy) Service card antigua — reemplazada por el ServiceCard profile compartido
// ═══════════════════════════════════════════════════════════════
// eslint-disable-next-line no-unused-vars
function ServiceCardLegacy({ service }) {
  return (
    <Link to={`/services/${service.slug}`}
      data-testid={`featured-service-${service.slug}`} style={{
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      borderRadius: "var(--r-xl)",
      padding: "24px",
      textDecoration: "none", display: "flex", flexDirection: "column",
      gap: "16px", minHeight: "240px",
      transition: "all 240ms var(--ease)",
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "rgba(26,255,110,0.3)"
        e.currentTarget.style.transform = "translateY(-4px)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "var(--border)"
        e.currentTarget.style.transform = "translateY(0)"
      }}>
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", gap: "16px" }}>
        <div style={{
          width: "40px", height: "40px", borderRadius: "var(--r-md)",
          background: "var(--accent-dim)",
          border: "1px solid rgba(26,255,110,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--accent)",
        }}>
          <Icon name="tools" size={18} />
        </div>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "9px",
          color: "var(--text-3)", textTransform: "uppercase",
          letterSpacing: "0.1em", fontWeight: 700 }}>
          {service.category_name || "Servicio"}
        </p>
      </div>

      <div style={{ flex: 1 }}>
        <p style={{
          fontFamily: "var(--font-display)", fontSize: "18px",
          fontWeight: 800, color: "var(--text)",
          letterSpacing: "-0.02em", lineHeight: 1.15,
          marginBottom: "8px",
        }}>
          {service.name}
        </p>
        <p style={{
          fontFamily: "var(--font-sans)", fontSize: "12px",
          color: "var(--text-2)", lineHeight: 1.55,
          overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
        }}>
          {service.short_description}
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "center",
        paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
        <div>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "9px",
            color: "var(--text-3)", textTransform: "uppercase",
            letterSpacing: "0.1em", fontWeight: 700, marginBottom: "4px" }}>
            {service.price ? "Desde" : "Precio"}
          </p>
          <p style={{
            fontFamily: "var(--font-display)", fontSize: "18px",
            fontWeight: 800, color: "var(--text)",
            letterSpacing: "-0.02em", lineHeight: 1,
          }}>
            {service.price_display || "A cotizar"}
          </p>
        </div>
        <span style={{
          padding: "8px 14px", borderRadius: "var(--r-full)",
          background: "var(--accent-dim)",
          border: "1px solid rgba(26,255,110,0.3)",
          color: "var(--accent)",
          fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 700,
        }}>
          Solicitar
        </span>
      </div>
    </Link>
  )
}
