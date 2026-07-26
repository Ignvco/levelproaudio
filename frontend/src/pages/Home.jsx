// pages/Home.jsx — SaaS platform redesign (Qouice-inspired · dark + neon green)
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getProducts, getBrands } from "../api/products.api"
import { mediaUrl } from "../utils/mediaUrl"

// ─────────────────────────────────────────────────────────────────
const clp = (n) => new Intl.NumberFormat("es-CL", { style: "currency",
  currency: "CLP", maximumFractionDigits: 0 }).format(n)

// ── Persona images (Unsplash portraits, mono) ────────────────────
const AVATARS = {
  female: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=600&q=80",
  male:   "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80",
  small1: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80",
  small2: "https://images.unsplash.com/photo-1500048993953-d23a436266cf?auto=format&fit=crop&w=200&q=80",
}

// ── SVG icons ─────────────────────────────────────────────────────
function Icon({ name, size = 18 }) {
  const paths = {
    arrow:      "M5 12h14 M12 5l7 7-7 7",
    plus:       "M12 5v14 M5 12h14",
    check:      "M20 6L9 17l-5-5",
    trend:      "M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6",
    play:       "M5 3l14 9-14 9V3z",
    chart:      "M18 20V10 M12 20V4 M6 20v-6",
    mic:        "M12 1a3 3 0 013 3v8a3 3 0 11-6 0V4a3 3 0 013-3z M19 10v2a7 7 0 11-14 0v-2 M12 19v4 M8 23h8",
    users:      "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75",
    lightning:  "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
    shield:     "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    grad:       "M22 10L12 4 2 10l10 6 10-6z M6 12v5c3 3 9 3 12 0v-5",
    sparkles:   "M12 3l1.9 5.9L20 11l-6.1 2.1L12 19l-1.9-5.9L4 11l6.1-2.1L12 3z",
    star:       "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21l1.18-6.88-5-4.87 6.91-1.01L12 2z",
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

// ── Animated counter ─────────────────────────────────────────────
function AnimatedNumber({ value, suffix = "" }) {
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
  return <span ref={ref}>{display.toLocaleString("es-CL")}{suffix}</span>
}

// ── Floating glass 3D element (pure CSS) ─────────────────────────
function GlassShape({ style, children, delay = 0, tint = "neutral" }) {
  const tints = {
    neutral: "rgba(255,255,255,0.08)",
    green:   "rgba(26,255,110,0.15)",
    dark:    "rgba(20,20,20,0.6)",
  }
  return (
    <div style={{
      position: "absolute",
      background: tints[tint],
      backdropFilter: "blur(20px) saturate(1.4)",
      WebkitBackdropFilter: "blur(20px) saturate(1.4)",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: "var(--r-xl)",
      boxShadow: `
        inset 0 1px 0 rgba(255,255,255,0.25),
        inset 0 -1px 0 rgba(0,0,0,0.15),
        0 20px 60px rgba(0,0,0,0.4)
      `,
      animation: `float 6s ease-in-out infinite ${delay}s`,
      display: "flex", alignItems: "center", justifyContent: "center",
      ...style,
    }}>
      {children}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
export default function Home() {
  const { data: featuredData } = useQuery({
    queryKey: ["products", { featured: true }],
    queryFn:  () => getProducts({ is_featured: true, page_size: 4 }),
  })
  const { data: brandsData } = useQuery({
    queryKey: ["brands"], queryFn: getBrands,
  })

  const featured = featuredData?.results || featuredData || []
  const brands   = brandsData?.results   || brandsData   || []

  // ── Data ────────────────────────────────────────────────────────
  const metrics = [
    { label: "Productos",  value: "2478",  cta: "Ver" },
    { label: "Usuarios",   value: "2033",  cta: "Ver" },
    { label: "Cursos",     value: "10",    suffix: "+", cta: "Ver" },
    { label: "Servicios",  value: "38",    suffix: "+", cta: "Ver" },
  ]

  const plans = [
    { name: "Básico",  price: 0,      features: ["Acceso a la tienda", "1 curso gratis", "Newsletter técnica"], cta: "Empezar gratis", highlighted: false },
    { name: "Pro",     price: 12990,  features: ["Todo Básico +", "3 cursos incluidos", "Descuentos exclusivos", "Soporte prioritario"], cta: "Ir con Pro", highlighted: true },
    { name: "Estudio", price: 39990,  features: ["Todo Pro +", "Acceso academia completa", "Mezcla profesional 1/mes", "Consultoría técnica"], cta: "Elegir Estudio", highlighted: false },
  ]

  return (
    <div style={{
      background: "var(--bg)",
      padding: "16px clamp(12px, 2vw, 20px) 40px",
      display: "flex", flexDirection: "column",
      gap: "clamp(20px, 3vw, 32px)",
    }} data-testid="home-page">

      {/* ═════════════════════════════════════════════════════════════
          HERO — split layout: left copy + CTAs, right floating glass
          ═════════════════════════════════════════════════════════════ */}
      <section
        data-testid="home-hero"
        style={{
          position: "relative",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-2xl)",
          overflow: "hidden",
          minHeight: "clamp(560px, 78vh, 780px)",
          padding: "clamp(40px, 5vw, 72px)",
        }}
      >
        {/* Background glow — subtle green */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `
            radial-gradient(ellipse 55% 60% at 78% 40%, rgba(26,255,110,0.10) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 15% 90%, rgba(26,255,110,0.05) 0%, transparent 60%)
          `,
        }} />

        <div style={{
          position: "relative", zIndex: 2,
          display: "grid", gridTemplateColumns: "1.15fr 1fr",
          gap: "40px", alignItems: "center",
          height: "100%", minHeight: "inherit",
        }} className="hero-grid">

          {/* LEFT — copy */}
          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "6px 14px", borderRadius: "var(--r-full)",
              background: "var(--accent-dim)",
              border: "1px solid rgba(26,255,110,0.25)",
              marginBottom: "28px",
            }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%",
                background: "var(--accent)",
                boxShadow: "0 0 12px var(--accent)" }} />
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px",
                fontWeight: 600, color: "var(--accent)",
                letterSpacing: "0.02em" }}>
                Audio profesional · Chile & Argentina
              </span>
            </div>

            <h1 className="display-bold" data-testid="hero-headline" style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.4rem, 5.5vw, 4.5rem)",
              fontWeight: 800, lineHeight: 0.95,
              letterSpacing: "-0.04em", color: "var(--text)",
              marginBottom: "24px",
            }}>
              Llevá tu sonido <br />
              al nivel <span style={{
                background: "linear-gradient(135deg, var(--accent) 0%, #7dff9b 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>profesional.</span>
            </h1>

            <p style={{
              fontFamily: "var(--font-sans)", fontSize: "16px",
              color: "var(--text-2)", lineHeight: 1.65,
              maxWidth: "480px", marginBottom: "36px",
            }}>
              Más que una tienda — el ecosistema completo para músicos, productores
              e ingenieros. Equipamiento, formación y servicios profesionales
              en un solo lugar.
            </p>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <Link to="/shop" data-testid="hero-cta-primary" style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "13px 24px", borderRadius: "var(--r-full)",
                background: "var(--accent)", color: "#000",
                fontSize: "14px", fontWeight: 700, textDecoration: "none",
                fontFamily: "var(--font-sans)",
                boxShadow: "0 8px 30px rgba(26,255,110,0.25)",
                transition: "transform 200ms var(--ease), box-shadow 200ms var(--ease)",
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateY(-2px)"
                  e.currentTarget.style.boxShadow = "0 12px 40px rgba(26,255,110,0.4)"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "translateY(0)"
                  e.currentTarget.style.boxShadow = "0 8px 30px rgba(26,255,110,0.25)"
                }}>
                Empezar ahora <Icon name="arrow" size={16} />
              </Link>
              <Link to="/academy" data-testid="hero-cta-secondary" style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "13px 24px", borderRadius: "var(--r-full)",
                background: "transparent", color: "var(--text)",
                border: "1px solid var(--border)",
                fontSize: "14px", fontWeight: 600, textDecoration: "none",
                fontFamily: "var(--font-sans)",
                transition: "all 200ms var(--ease)",
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "var(--accent)"
                  e.currentTarget.style.color = "var(--accent)"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "var(--border)"
                  e.currentTarget.style.color = "var(--text)"
                }}>
                <Icon name="play" size={14} /> Ver tour
              </Link>
            </div>

            {/* Small trust indicator */}
            <div style={{
              display: "flex", alignItems: "center", gap: "12px",
              marginTop: "40px",
            }}>
              <div style={{ display: "flex" }}>
                {[AVATARS.small1, AVATARS.small2, AVATARS.male].map((src, i) => (
                  <img key={i} src={src} alt=""
                    style={{
                      width: "32px", height: "32px", borderRadius: "50%",
                      objectFit: "cover", border: "2px solid var(--surface)",
                      marginLeft: i === 0 ? 0 : "-8px",
                      filter: "grayscale(30%)",
                    }} />
                ))}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px",
                  color: "var(--accent)", marginBottom: "2px" }}>
                  {[...Array(5)].map((_, i) => (
                    <Icon key={i} name="star" size={11} />
                  ))}
                </div>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "12px",
                  color: "var(--text-2)" }}>
                  +2.000 profesionales confían en LevelPro
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT — floating glass 3D shapes */}
          <div style={{
            position: "relative", height: "460px",
            perspective: "1200px",
          }} className="hero-visual">
            {/* Big center card w/ waveform illustration */}
            <GlassShape tint="green" style={{
              width: "300px", height: "180px",
              top: "50%", left: "50%",
              transform: "translate(-50%, -50%) rotate(-4deg)",
            }} delay={0}>
              <div style={{ padding: "20px", width: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px",
                  marginBottom: "12px" }}>
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "50%",
                    background: "var(--accent)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#000",
                  }}>
                    <Icon name="mic" size={14} />
                  </div>
                  <div>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "13px",
                      fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>
                      Tu sesión de mezcla
                    </p>
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: "10px",
                      color: "var(--text-3)", marginTop: "2px" }}>
                      02:34 · 24-bit / 48 kHz
                    </p>
                  </div>
                </div>
                {/* Fake waveform */}
                <div style={{ display: "flex", alignItems: "center",
                  gap: "3px", height: "60px", justifyContent: "space-between" }}>
                  {[10, 30, 60, 40, 80, 65, 45, 90, 55, 30, 70, 50, 85, 40, 60, 35, 75, 45, 55, 25].map((h, i) => (
                    <div key={i} style={{
                      width: "3px", height: `${h}%`,
                      background: i < 12 ? "var(--accent)" : "rgba(255,255,255,0.2)",
                      borderRadius: "2px",
                    }} />
                  ))}
                </div>
              </div>
            </GlassShape>

            {/* Top-right small shape */}
            <GlassShape style={{
              width: "110px", height: "110px",
              top: "6%", right: "8%",
              transform: "rotate(12deg)",
            }} delay={1}>
              <div style={{ color: "var(--accent)" }}>
                <Icon name="trend" size={36} />
              </div>
            </GlassShape>

            {/* Bottom-left square with number */}
            <GlassShape tint="dark" style={{
              width: "140px", height: "80px",
              bottom: "10%", left: "3%",
              transform: "rotate(-6deg)",
            }} delay={0.5}>
              <div style={{ padding: "12px", width: "100%" }}>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "10px",
                  color: "var(--text-3)", textTransform: "uppercase",
                  letterSpacing: "0.1em", marginBottom: "4px" }}>
                  Ventas hoy
                </p>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "22px",
                  fontWeight: 800, color: "var(--text)",
                  letterSpacing: "-0.02em", lineHeight: 1 }}>
                  $3.489
                </p>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "10px",
                  color: "var(--accent)", marginTop: "4px",
                  display: "flex", alignItems: "center", gap: "3px" }}>
                  <Icon name="trend" size={10} /> +12.3%
                </p>
              </div>
            </GlassShape>

            {/* Top-left tiny pill */}
            <GlassShape style={{
              width: "56px", height: "56px",
              top: "18%", left: "0%",
              transform: "rotate(-8deg)",
            }} delay={1.5}>
              <div style={{ color: "var(--accent)" }}>
                <Icon name="sparkles" size={22} />
              </div>
            </GlassShape>

            {/* Right bottom small pill */}
            <GlassShape style={{
              width: "70px", height: "70px",
              bottom: "8%", right: "0%",
              transform: "rotate(10deg)",
            }} delay={2}>
              <div style={{ color: "var(--text)" }}>
                <Icon name="chart" size={26} />
              </div>
            </GlassShape>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
          METRICS ROW — 4 pill cards
          ═════════════════════════════════════════════════════════════ */}
      <section data-testid="metrics-row" style={{
        padding: "0 clamp(0px, 1vw, 8px)",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "12px",
        }} className="metrics-grid">
          {metrics.map((m, i) => (
            <div key={m.label} data-testid={`metric-${i}`} style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-xl)",
              padding: "22px 24px",
              display: "flex", justifyContent: "space-between",
              alignItems: "center", gap: "16px",
              transition: "border-color 200ms var(--ease)",
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(26,255,110,0.3)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
              <div>
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: "11px",
                  color: "var(--text-3)", textTransform: "uppercase",
                  letterSpacing: "0.1em", marginBottom: "6px",
                }}>{m.label}</p>
                <p style={{
                  fontFamily: "var(--font-display)", fontSize: "26px",
                  fontWeight: 800, color: "var(--text)",
                  letterSpacing: "-0.02em", lineHeight: 1,
                }}>
                  <AnimatedNumber value={m.value} suffix={m.suffix || ""} />
                </p>
              </div>
              <button style={{
                padding: "6px 14px", borderRadius: "var(--r-full)",
                background: "var(--accent-dim)",
                border: "1px solid rgba(26,255,110,0.3)",
                color: "var(--accent)",
                fontSize: "11px", fontWeight: 700, cursor: "pointer",
                fontFamily: "var(--font-sans)",
                transition: "all 200ms var(--ease)",
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "var(--accent)"
                  e.currentTarget.style.color = "#000"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "var(--accent-dim)"
                  e.currentTarget.style.color = "var(--accent)"
                }}>
                {m.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
          FEATURE CARDS ROW — dark card + photo card + testimonial card
          ═════════════════════════════════════════════════════════════ */}
      <section data-testid="feature-cards" style={{ padding: 0 }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.4fr 1fr",
          gap: "12px",
        }} className="features-grid">

          {/* CARD 1 — dark w/ CTA */}
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-2xl)",
            padding: "28px",
            display: "flex", flexDirection: "column",
            justifyContent: "space-between", gap: "24px",
            minHeight: "300px",
            position: "relative", overflow: "hidden",
          }} data-testid="feature-card-0">
            {/* Green corner glow */}
            <div style={{
              position: "absolute", top: "-40%", right: "-40%",
              width: "80%", height: "80%",
              background: "radial-gradient(circle, rgba(26,255,110,0.15) 0%, transparent 70%)",
              pointerEvents: "none",
            }} />
            <div style={{ position: "relative" }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "50%",
                background: "var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#000", marginBottom: "20px",
              }}>
                <Icon name="lightning" size={16} />
              </div>
              <p style={{
                fontFamily: "var(--font-display)", fontSize: "22px",
                fontWeight: 800, color: "var(--text)",
                letterSpacing: "-0.02em", lineHeight: 1.1,
                marginBottom: "12px",
              }}>
                Tienda profesional
              </p>
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: "13px",
                color: "var(--text-2)", lineHeight: 1.6,
              }}>
                Equipamiento boutique + marcas top de la industria, con precios
                en CLP y stock real.
              </p>
            </div>
            <Link to="/shop" style={{
              alignSelf: "flex-start",
              padding: "9px 18px", borderRadius: "var(--r-full)",
              background: "var(--accent)", color: "#000",
              fontSize: "12px", fontWeight: 700, textDecoration: "none",
              fontFamily: "var(--font-sans)",
              display: "inline-flex", alignItems: "center", gap: "6px",
            }}>
              Ir a la tienda <Icon name="arrow" size={12} />
            </Link>
          </div>

          {/* CARD 2 — big w/ person photo + toggle */}
          <div style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-2xl)",
            padding: "28px",
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "24px", alignItems: "center",
            minHeight: "300px",
            position: "relative",
          }} data-testid="feature-card-1">
            <div style={{
              width: "140px", height: "180px",
              borderRadius: "var(--r-xl)",
              overflow: "hidden",
              background: "var(--surface-3)",
              flexShrink: 0,
            }}>
              <img src={AVATARS.female} alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover",
                  filter: "grayscale(15%) contrast(1.05)" }} />
            </div>
            <div>
              <p style={{
                fontFamily: "var(--font-display)", fontSize: "22px",
                fontWeight: 800, color: "var(--text)",
                letterSpacing: "-0.02em", lineHeight: 1.15,
                marginBottom: "12px",
              }}>
                Academia con instructores del oficio.
              </p>
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: "13px",
                color: "var(--text-2)", lineHeight: 1.6,
                marginBottom: "20px",
              }}>
                Aprendé mezcla, masterización y producción con profesionales
                de la industria — cursos técnicos con proyectos reales.
              </p>

              {/* Toggle-like control mimicking reference */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "4px", borderRadius: "var(--r-full)",
                background: "var(--surface-3)",
                border: "1px solid var(--border)",
              }}>
                <span style={{
                  padding: "6px 14px", borderRadius: "var(--r-full)",
                  background: "var(--accent)", color: "#000",
                  fontSize: "11px", fontWeight: 700,
                  fontFamily: "var(--font-sans)",
                }}>
                  Video 4K
                </span>
                <span style={{
                  padding: "6px 14px", borderRadius: "var(--r-full)",
                  color: "var(--text-2)",
                  fontSize: "11px", fontWeight: 600,
                  fontFamily: "var(--font-sans)",
                }}>
                  Proyectos incluidos
                </span>
              </div>
            </div>
          </div>

          {/* CARD 3 — testimonial + mini stats */}
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-2xl)",
            padding: "24px",
            display: "flex", flexDirection: "column",
            gap: "20px",
            minHeight: "300px",
          }} data-testid="feature-card-2">
            {/* Mini stats mock */}
            <div style={{
              padding: "14px", borderRadius: "var(--r-md)",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: "8px",
              }}>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "10px",
                  color: "var(--text-3)", textTransform: "uppercase",
                  letterSpacing: "0.1em" }}>
                  Ingresos mes
                </p>
                <p style={{ fontFamily: "var(--font-display)",
                  fontSize: "11px", fontWeight: 700, color: "var(--accent)",
                }}>
                  +18%
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end",
                gap: "3px", height: "36px" }}>
                {[40, 55, 30, 70, 50, 85, 65, 90].map((h, i) => (
                  <div key={i} style={{
                    flex: 1, height: `${h}%`,
                    background: i === 7 ? "var(--accent)" : "rgba(255,255,255,0.15)",
                    borderRadius: "2px 2px 0 0",
                  }} />
                ))}
              </div>
            </div>

            {/* Testimonial */}
            <div style={{ marginTop: "auto" }}>
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: "12px",
                color: "var(--text-2)", lineHeight: 1.5,
                marginBottom: "16px", fontStyle: "italic",
              }}>
                &ldquo;La asesoría técnica marcó la diferencia. Compré exactamente
                lo que necesitaba.&rdquo;
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <img src={AVATARS.male} alt=""
                  style={{ width: "34px", height: "34px", borderRadius: "50%",
                    objectFit: "cover", filter: "grayscale(15%)" }} />
                <div>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: "12px",
                    fontWeight: 700, color: "var(--text)" }}>
                    Diego Ramírez
                  </p>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: "10px",
                    color: "var(--text-3)" }}>
                    Productor · Santiago
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
          PRICING + FEATURED PROMO — 2 col
          ═════════════════════════════════════════════════════════════ */}
      <section data-testid="pricing-section" style={{ padding: 0 }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr",
          gap: "12px",
        }} className="pricing-grid">

          {/* LEFT — Pricing card with 3 tiers */}
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-2xl)",
            padding: "clamp(28px, 3vw, 40px)",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "flex-start", marginBottom: "32px",
              flexWrap: "wrap", gap: "16px",
            }}>
              <div>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "4px 12px", borderRadius: "var(--r-full)",
                  background: "var(--surface-3)",
                  border: "1px solid var(--border)",
                  color: "var(--text-2)", fontSize: "11px",
                  fontFamily: "var(--font-sans)", fontWeight: 500,
                  marginBottom: "16px",
                }}>
                  <Icon name="sparkles" size={12} /> Planes
                </div>
                <h2 className="display-bold" style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.6rem, 2.4vw, 2.2rem)",
                  fontWeight: 800, lineHeight: 1,
                  letterSpacing: "-0.03em", color: "var(--text)",
                }}>
                  Elegí cómo empezar.
                </h2>
              </div>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "12px",
            }} className="pricing-tiers">
              {plans.map((p, i) => (
                <div key={p.name} data-testid={`plan-${p.name.toLowerCase()}`} style={{
                  padding: "24px 20px",
                  borderRadius: "var(--r-xl)",
                  background: p.highlighted ? "var(--surface-2)" : "var(--surface-3)",
                  border: p.highlighted ? "1px solid rgba(26,255,110,0.35)" : "1px solid var(--border)",
                  display: "flex", flexDirection: "column",
                  gap: "16px", position: "relative",
                }}>
                  {p.highlighted && (
                    <div style={{
                      position: "absolute", top: "-10px", right: "16px",
                      padding: "3px 10px", borderRadius: "var(--r-full)",
                      background: "var(--accent)", color: "#000",
                      fontSize: "10px", fontWeight: 700,
                      fontFamily: "var(--font-sans)",
                      letterSpacing: "0.05em", textTransform: "uppercase",
                    }}>
                      Popular
                    </div>
                  )}
                  <div>
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: "11px",
                      color: "var(--text-3)", textTransform: "uppercase",
                      letterSpacing: "0.1em", marginBottom: "8px" }}>
                      {p.name}
                    </p>
                    <p style={{ fontFamily: "var(--font-display)",
                      fontSize: "26px", fontWeight: 800, color: "var(--text)",
                      letterSpacing: "-0.02em", lineHeight: 1 }}>
                      {p.price === 0 ? "Gratis" : clp(p.price)}
                      {p.price > 0 && (
                        <span style={{
                          fontSize: "12px", color: "var(--text-3)",
                          fontWeight: 500, marginLeft: "4px",
                        }}>/mes</span>
                      )}
                    </p>
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0,
                    display: "flex", flexDirection: "column", gap: "8px",
                    fontFamily: "var(--font-sans)", fontSize: "12px",
                    color: "var(--text-2)", lineHeight: 1.5 }}>
                    {p.features.map(f => (
                      <li key={f} style={{ display: "flex", gap: "8px",
                        alignItems: "flex-start" }}>
                        <span style={{ color: "var(--accent)", marginTop: "2px",
                          flexShrink: 0 }}>
                          <Icon name="check" size={12} />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button style={{
                    padding: "10px 16px", borderRadius: "var(--r-full)",
                    background: p.highlighted ? "var(--accent)" : "transparent",
                    color: p.highlighted ? "#000" : "var(--text)",
                    border: p.highlighted ? "none" : "1px solid var(--border)",
                    fontSize: "12px", fontWeight: 700, cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                    transition: "all 200ms var(--ease)",
                    marginTop: "auto",
                  }}
                    onMouseEnter={e => {
                      if (!p.highlighted) {
                        e.currentTarget.style.borderColor = "var(--accent)"
                        e.currentTarget.style.color = "var(--accent)"
                      }
                    }}
                    onMouseLeave={e => {
                      if (!p.highlighted) {
                        e.currentTarget.style.borderColor = "var(--border)"
                        e.currentTarget.style.color = "var(--text)"
                      }
                    }}>
                    {p.cta}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — CTA card with floating shape */}
          <div style={{
            position: "relative",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-2xl)",
            padding: "clamp(28px, 3vw, 40px)",
            overflow: "hidden",
            display: "flex", flexDirection: "column",
          }}>
            {/* Background gradient */}
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: `
                radial-gradient(ellipse 60% 40% at 80% 20%, rgba(26,255,110,0.25) 0%, transparent 60%),
                radial-gradient(ellipse 60% 40% at 20% 100%, rgba(26,255,110,0.1) 0%, transparent 60%)
              `,
            }} />

            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "4px 12px", borderRadius: "var(--r-full)",
                background: "rgba(0,0,0,0.4)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "var(--text-2)", fontSize: "11px",
                fontFamily: "var(--font-sans)", fontWeight: 500,
                marginBottom: "20px",
              }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%",
                  background: "var(--accent)" }} />
                Servicios pro
              </div>

              <h3 className="display-bold" style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.5rem, 2.2vw, 2rem)",
                fontWeight: 800, lineHeight: 1,
                letterSpacing: "-0.03em", color: "var(--text)",
                marginBottom: "16px",
              }}>
                Mezcla, mastering<br />y operación en vivo.
              </h3>

              <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px",
                color: "var(--text-2)", lineHeight: 1.6,
                marginBottom: "28px" }}>
                Contratá servicios profesionales a la medida de tu proyecto.
                Presupuesto claro sin sorpresas.
              </p>

              <Link to="/services" data-testid="services-cta" style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "11px 22px", borderRadius: "var(--r-full)",
                background: "var(--accent)", color: "#000",
                fontSize: "13px", fontWeight: 700, textDecoration: "none",
                fontFamily: "var(--font-sans)",
              }}>
                Ver servicios <Icon name="arrow" size={14} />
              </Link>
            </div>

            {/* Floating glass mini card w/ price */}
            <GlassShape tint="dark" style={{
              width: "180px", height: "80px",
              bottom: "24px", right: "24px",
              transform: "rotate(-4deg)",
              zIndex: 2,
            }} delay={0.3}>
              <div style={{ padding: "14px", width: "100%" }}>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "10px",
                  color: "var(--text-3)", textTransform: "uppercase",
                  letterSpacing: "0.08em", marginBottom: "4px" }}>
                  Desde
                </p>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "20px",
                  fontWeight: 800, color: "var(--text)",
                  letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {clp(80000)}
                </p>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "10px",
                  color: "var(--accent)", marginTop: "4px" }}>
                  · Mastering profesional
                </p>
              </div>
            </GlassShape>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
          FEATURED PRODUCTS (compact strip)
          ═════════════════════════════════════════════════════════════ */}
      {featured.length > 0 && (
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
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: "11px",
                  color: "var(--accent)", textTransform: "uppercase",
                  letterSpacing: "0.15em", marginBottom: "12px",
                  fontWeight: 700,
                }}>
                  · Destacados
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
                Ver todo <Icon name="arrow" size={12} />
              </Link>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "12px",
            }} className="feat-products-grid">
              {featured.slice(0, 4).map((p) => {
                const img = p.primary_image || p.images?.[0]?.image
                return (
                  <Link key={p.id} to={`/product/${p.slug}`}
                    data-testid={`featured-${p.slug}`} style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-xl)",
                    padding: "16px",
                    textDecoration: "none", display: "block",
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
                    <div style={{
                      aspectRatio: "1", background: "var(--surface-3)",
                      borderRadius: "var(--r-md)", marginBottom: "12px",
                      overflow: "hidden",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {img ? (
                        <img src={mediaUrl(img)} alt={p.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ color: "var(--text-3)", fontSize: "11px" }}>
                          Sin imagen
                        </div>
                      )}
                    </div>
                    <p style={{
                      fontFamily: "var(--font-sans)", fontSize: "10px",
                      color: "var(--text-3)", marginBottom: "6px",
                      textTransform: "uppercase", letterSpacing: "0.05em",
                    }}>
                      {p.brand?.name || p.brand_name || "—"}
                    </p>
                    <p style={{
                      fontFamily: "var(--font-display)", fontSize: "13px",
                      fontWeight: 700, color: "var(--text)",
                      letterSpacing: "-0.01em", lineHeight: 1.2,
                      marginBottom: "10px",
                      overflow: "hidden", textOverflow: "ellipsis",
                      display: "-webkit-box", WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical", minHeight: "32px",
                    }}>
                      {p.name}
                    </p>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center",
                    }}>
                      <span style={{
                        fontFamily: "var(--font-display)", fontSize: "14px",
                        fontWeight: 800, color: "var(--accent)",
                        letterSpacing: "-0.01em",
                      }}>
                        {clp(Number(p.price))}
                      </span>
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
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ═════════════════════════════════════════════════════════════
          BRANDS STRIP
          ═════════════════════════════════════════════════════════════ */}
      {brands.length > 0 && (
        <section data-testid="brands-strip" style={{ padding: 0 }}>
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-2xl)",
            padding: "24px clamp(24px, 3vw, 40px)",
            display: "grid", gridTemplateColumns: "auto 1fr",
            gap: "40px", alignItems: "center",
          }} className="brands-strip-grid">
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "12px",
              color: "var(--text-3)", maxWidth: "160px", lineHeight: 1.5,
              textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
              Marcas top del mundo
            </p>
            <div style={{ overflow: "hidden", position: "relative" }}>
              <div style={{
                display: "flex", gap: "60px", flexWrap: "nowrap",
                animation: "marquee 30s linear infinite", width: "max-content",
              }}>
                {[...brands, ...brands].map((b, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", flexShrink: 0,
                    opacity: 0.4, height: "32px",
                    transition: "opacity 200ms var(--ease)",
                  }}
                    onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                    onMouseLeave={e => e.currentTarget.style.opacity = "0.4"}>
                    {b.logo_url || b.logo ? (
                      <img src={mediaUrl(b.logo_url || b.logo)} alt={b.name}
                        style={{ height: "22px", maxWidth: "120px",
                          objectFit: "contain",
                          filter: "brightness(0) invert(1)" }} />
                    ) : (
                      <span style={{ fontFamily: "var(--font-display)",
                        fontSize: "18px", fontWeight: 700,
                        letterSpacing: "-0.02em", color: "var(--text)",
                        whiteSpace: "nowrap" }}>
                        {b.name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <style>{`
        @media (max-width: 1024px) {
          .hero-grid          { grid-template-columns: 1fr !important; }
          .hero-visual        { height: 360px !important; }
          .metrics-grid       { grid-template-columns: repeat(2, 1fr) !important; }
          .features-grid      { grid-template-columns: 1fr !important; }
          .pricing-grid       { grid-template-columns: 1fr !important; }
          .feat-products-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .brands-strip-grid  { grid-template-columns: 1fr !important; gap: 16px !important; }
        }
        @media (max-width: 640px) {
          .pricing-tiers      { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
