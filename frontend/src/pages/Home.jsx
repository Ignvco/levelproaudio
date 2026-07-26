// pages/Home.jsx — WANDER-inspired redesign (dark + green neon)
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getProducts, getBrands } from "../api/products.api"
import { mediaUrl } from "../utils/mediaUrl"

// ── Imágenes lifestyle ─────────────────────────────────────────
const HERO_IMG = "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?auto=format&fit=crop&w=2000&q=80"
const PACK_IMGS = [
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80",
]

// ── Icono SVG ──────────────────────────────────────────────────
function Icon({ name, size = 20 }) {
  const paths = {
    map:      "M12 21s-8-7.58-8-12a8 8 0 1116 0c0 4.42-8 12-8 12z M12 11a2 2 0 100-4 2 2 0 000 4z",
    check:    "M9 12l2 2 4-4 M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z",
    headset:  "M3 18v-6a9 9 0 1118 0v6 M21 19a2 2 0 01-2 2h-1v-6h3v4z M5 21H4a2 2 0 01-2-2v-4h3v6z",
    cart:     "M9 22a1 1 0 100-2 1 1 0 000 2z M20 22a1 1 0 100-2 1 1 0 000 2z M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6",
    star:     "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21l1.18-6.88-5-4.87 6.91-1.01L12 2z",
    play:     "M5 3l14 9-14 9V3z",
    arrow:    "M5 12h14 M12 5l7 7-7 7",
    grad:     "M22 10L12 4 2 10l10 6 10-6z M6 12v5c3 3 9 3 12 0v-5",
    settings: "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h.01a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.01a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z",
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

// ── Precio formateado CLP ─────────────────────────────────────
const clp = (n) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)

// ── Número animado ─────────────────────────────────────────────
function AnimatedNumber({ value, suffix = "" }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      let s = 0, end = parseInt(value), step = end / (1200 / 16)
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

// ═══════════════════════════════════════════════════════════════
export default function Home() {
  const { data: featuredData } = useQuery({
    queryKey: ["products", { featured: true }],
    queryFn:  () => getProducts({ is_featured: true, page_size: 8 }),
  })
  const { data: brandsData } = useQuery({
    queryKey: ["brands"], queryFn: getBrands,
  })
  const featured = featuredData?.results || featuredData || []
  const brands   = brandsData?.results   || brandsData   || []

  // Carrusel top-products
  const [prodOffset, setProdOffset] = useState(0)

  const features = [
    { icon: "map",     title: "Experiencia local",  desc: "Nuestro equipo conoce el equipamiento profesional que se usa en los mejores estudios de Chile y Argentina." },
    { icon: "cart",    title: "Compra en un lugar", desc: "Equipamiento, cursos y servicios profesionales — todo en una sola plataforma, con envío en 24 hs." },
    { icon: "headset", title: "Soporte 24/7",       desc: "Estamos acá antes, durante y después de la compra. Asesoría técnica real por especialistas en audio." },
  ]

  const smallStats = [
    { icon: "star",  value: "12k", label: "Clientes satisfechos"      },
    { icon: "check", value: "10",  suffix: " años", label: "En la industria"           },
    { icon: "grad",  value: "50",  suffix: "+",     label: "Marcas top representadas"  },
  ]

  const steps = [
    { num: "01", title: "Elegí tu equipo",   desc: "Explorá la tienda o pedí asesoría — te ayudamos a decidir." },
    { num: "02", title: "Personalizá tu setup", desc: "Configuramos tu compra: cables, adaptadores y todo lo necesario." },
    { num: "03", title: "Confirmá y grabá",  desc: "Confirmás online y en 24 hs tenés tu equipamiento listo." },
  ]

  return (
    <div style={{ background: "var(--bg)", padding: "16px clamp(12px, 2.5vw, 24px) 32px",
      display: "flex", flexDirection: "column", gap: "clamp(16px, 2vw, 24px)" }} data-testid="home-page">

      {/* ═════════════════════════════════════════════════════════════════
          HERO — landscape image + giant transparent text overlay + 2 pill CTAs
          ═════════════════════════════════════════════════════════════════ */}
      <section
        data-testid="home-hero"
        style={{
          position: "relative",
          borderRadius: "var(--r-2xl)",
          overflow: "hidden",
          minHeight: "clamp(480px, 78vh, 720px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Background image */}
        <img src={HERO_IMG} alt="Studio"
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%", objectFit: "cover",
            filter: "brightness(0.55) saturate(1.1)",
          }} />

        {/* Verde neón tint overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 100% 80% at 50% 50%, rgba(26,255,110,0.18) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.7) 100%)",
        }} />

        {/* Contenido centrado */}
        <div style={{
          position: "relative", zIndex: 2,
          padding: "clamp(28px, 5vw, 60px)",
          textAlign: "center",
          maxWidth: "1000px",
          width: "100%",
        }}>
          <h1
            data-testid="hero-headline"
            className="display-bold"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(4rem, 15vw, 12rem)",
              fontWeight: 900,
              lineHeight: 0.85,
              letterSpacing: "-0.06em",
              color: "rgba(255,255,255,0.95)",
              mixBlendMode: "overlay",
              textShadow: "0 0 60px rgba(26,255,110,0.3)",
            }}>
            LEVELPRO
            <span style={{
              fontSize: "0.35em",
              color: "var(--accent)",
              verticalAlign: "top",
              marginLeft: "0.2em",
              mixBlendMode: "normal",
              letterSpacing: "0.05em",
            }}>.AUDIO</span>
          </h1>

          <p style={{
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(14px, 1.4vw, 17px)",
            color: "rgba(255,255,255,0.85)",
            lineHeight: 1.6,
            maxWidth: "560px",
            margin: "clamp(20px, 3vw, 32px) auto clamp(32px, 4vw, 40px)",
          }}>
            Descubrí el equipamiento, la formación y los servicios que buscabas —
            todo con asesoría profesional en un solo lugar.
          </p>

          <div style={{ display: "flex", gap: "12px", justifyContent: "center",
            flexWrap: "wrap" }}>
            <Link to="/shop" data-testid="hero-cta-shop" style={{
              padding: "13px 28px", borderRadius: "var(--r-full)",
              background: "#ffffff", color: "#0a0a0a",
              fontSize: "14px", fontWeight: 600, textDecoration: "none",
              fontFamily: "var(--font-sans)",
              transition: "transform 200ms var(--ease), background 200ms var(--ease)",
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)" }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)" }}>
              Explorar tienda
            </Link>
            <Link to="/academy" data-testid="hero-cta-academy" style={{
              padding: "13px 28px", borderRadius: "var(--r-full)",
              background: "rgba(255,255,255,0.1)", color: "#fff",
              backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.25)",
              fontSize: "14px", fontWeight: 600, textDecoration: "none",
              fontFamily: "var(--font-sans)",
              transition: "background 200ms var(--ease), transform 200ms var(--ease)",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; e.currentTarget.style.transform = "translateY(-2px)" }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "translateY(0)" }}>
              Ver academia
            </Link>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════
          WHY CHOOSE US — split layout: left heading + stats, right feature cards
          ═════════════════════════════════════════════════════════════════ */}
      <section
        data-testid="why-choose-us"
        style={{
          padding: "clamp(60px, 8vw, 100px) clamp(16px, 4vw, 60px)",
        }}>
        <div style={{
          maxWidth: "1200px", margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "clamp(32px, 5vw, 80px)",
          alignItems: "start",
        }} className="why-grid">

          {/* LEFT: heading + description + 3 small stat cards */}
          <div>
            <h2 className="display-bold" data-testid="why-headline" style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.8rem, 3vw, 2.5rem)",
              fontWeight: 800, lineHeight: 1.05,
              letterSpacing: "-0.03em", color: "var(--text)",
              marginBottom: "20px",
            }}>
              Por qué miles de profesionales<br />eligen LevelPro.
            </h2>
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: "15px",
              color: "var(--text-2)", lineHeight: 1.7,
              marginBottom: "40px", maxWidth: "480px",
            }}>
              Desde estudios boutique hasta broadcasters — hacemos que conseguir
              el equipo, la formación y los servicios profesionales sea simple,
              rápido y con asesoría real.
            </p>

            {/* Small stat cards */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "16px",
              maxWidth: "500px",
            }} className="stats-3">
              {smallStats.map((s, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{
                    width: "48px", height: "48px",
                    borderRadius: "50%",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 14px",
                    color: "var(--accent)",
                  }}>
                    <Icon name={s.icon} size={20} />
                  </div>
                  <p style={{
                    fontFamily: "var(--font-display)", fontSize: "22px",
                    fontWeight: 800, color: "var(--text)", lineHeight: 1,
                    marginBottom: "6px", letterSpacing: "-0.02em",
                  }}>
                    <AnimatedNumber value={s.value} suffix={s.suffix || ""} />
                  </p>
                  <p style={{
                    fontFamily: "var(--font-sans)", fontSize: "11px",
                    color: "var(--text-3)", lineHeight: 1.4,
                  }}>
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: 3 stacked feature cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {features.map((f, i) => (
              <div key={f.title}
                data-testid={`feature-card-${i}`}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-xl)",
                  padding: "22px 24px",
                  display: "grid",
                  gridTemplateColumns: "56px 1fr",
                  gap: "20px", alignItems: "start",
                  transition: "border-color 240ms var(--ease), transform 240ms var(--ease)",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "rgba(26,255,110,0.3)"
                  e.currentTarget.style.transform = "translateX(4px)"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "var(--border)"
                  e.currentTarget.style.transform = "translateX(0)"
                }}>
                <div style={{
                  width: "56px", height: "56px",
                  borderRadius: "var(--r-md)",
                  background: "var(--accent-dim)",
                  border: "1px solid rgba(26,255,110,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--accent)",
                }}>
                  <Icon name={f.icon} size={22} />
                </div>
                <div>
                  <p style={{
                    fontFamily: "var(--font-display)", fontSize: "17px",
                    fontWeight: 700, color: "var(--text)",
                    letterSpacing: "-0.01em", marginBottom: "6px",
                  }}>
                    {f.title}
                  </p>
                  <p style={{
                    fontFamily: "var(--font-sans)", fontSize: "13px",
                    color: "var(--text-2)", lineHeight: 1.6,
                  }}>
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════
          TOP PRODUCTS — big rounded container with 4 image cards + nav arrows
          ═════════════════════════════════════════════════════════════════ */}
      <section data-testid="top-products" style={{ padding: "0 clamp(16px, 4vw, 60px)" }}>
        <div style={{
          maxWidth: "1200px", margin: "0 auto",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-2xl)",
          padding: "clamp(28px, 4vw, 44px)",
        }}>
          {/* Header split */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: "24px", alignItems: "start",
            marginBottom: "32px",
          }} className="products-header">
            <h2 className="display-bold" style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.6rem, 2.5vw, 2.2rem)",
              fontWeight: 800, lineHeight: 1,
              letterSpacing: "-0.03em", color: "var(--text)",
            }}>
              Productos destacados
            </h2>
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: "14px",
              color: "var(--text-2)", lineHeight: 1.6,
            }}>
              Desde interfaces boutique hasta micrófonos de referencia — descubrí
              el equipo que están usando los productores del momento.
            </p>
          </div>

          {/* 4 product cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "16px",
          }} className="products-4">
            {(featured.length ? featured : [...Array(4)])
              .slice(prodOffset, prodOffset + 4)
              .map((p, i) => p ? (
                <ProductMiniCard key={p.id} product={p} />
              ) : (
                <div key={`s-${i}`} className="skeleton" style={{ height: "260px" }} />
              ))}
          </div>

          {/* Footer with view-more + arrows */}
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginTop: "32px", gap: "16px", flexWrap: "wrap",
          }}>
            <Link to="/shop" data-testid="view-all-products" style={{
              padding: "11px 22px", borderRadius: "var(--r-full)",
              background: "var(--surface-3)", color: "var(--text)",
              border: "1px solid var(--border)",
              fontSize: "13px", fontWeight: 600, textDecoration: "none",
              fontFamily: "var(--font-sans)",
              transition: "all 200ms var(--ease)",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.color = "#000"; e.currentTarget.style.borderColor = "var(--accent)" }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.borderColor = "var(--border)" }}>
              Ver todos
            </Link>
            <div style={{ display: "flex", gap: "10px" }}>
              <ArrowBtn dir="prev" onClick={() => setProdOffset(Math.max(0, prodOffset - 4))}
                disabled={prodOffset === 0} />
              <ArrowBtn dir="next" onClick={() => setProdOffset(Math.min(featured.length - 4, prodOffset + 4))}
                disabled={prodOffset + 4 >= featured.length} />
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════
          PACKAGES — mixed grid: 1 big card left + 2 image cards right
          ═════════════════════════════════════════════════════════════════ */}
      <section data-testid="packages-section" style={{ padding: "0 clamp(16px, 4vw, 60px)" }}>
        <div style={{
          maxWidth: "1200px", margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "16px",
        }} className="packages-grid">
          {/* Big feature card left */}
          <div style={{
            background: "linear-gradient(135deg, var(--surface-2) 0%, rgba(26,255,110,0.08) 100%)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-2xl)",
            padding: "clamp(24px, 3vw, 36px)",
            display: "flex", flexDirection: "column", justifyContent: "space-between",
            minHeight: "300px",
          }}>
            <div>
              <p style={{
                fontFamily: "var(--font-display)", fontSize: "22px",
                fontWeight: 800, color: "var(--text)",
                letterSpacing: "-0.02em", marginBottom: "12px",
              }}>
                Cursos y servicios profesionales
              </p>
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: "13px",
                color: "var(--text-2)", lineHeight: 1.6,
              }}>
                Mezclá, masterizá y aprendé con los mejores.
                Cursos técnicos + servicios a medida.
              </p>
            </div>
            <Link to="/academy" data-testid="packages-cta" style={{
              alignSelf: "flex-start", marginTop: "24px",
              padding: "10px 20px", borderRadius: "var(--r-full)",
              background: "var(--accent)", color: "#000",
              fontSize: "13px", fontWeight: 700, textDecoration: "none",
              fontFamily: "var(--font-sans)",
              transition: "transform 200ms var(--ease)",
            }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
              Ver academia
            </Link>
          </div>

          {/* 2 image cards */}
          {[
            { title: "Curso: Mezcla profesional", img: PACK_IMGS[0], to: "/academy", badge: "Nuevo" },
            { title: "Servicio: Mastering",      img: PACK_IMGS[1], to: "/services", badge: "Popular" },
          ].map((c, i) => (
            <Link key={i} to={c.to} data-testid={`package-card-${i}`} style={{
              position: "relative",
              borderRadius: "var(--r-2xl)",
              overflow: "hidden", minHeight: "300px",
              textDecoration: "none",
              display: "block",
            }}>
              <img src={c.img} alt={c.title}
                style={{ width: "100%", height: "100%", objectFit: "cover",
                  position: "absolute", inset: 0,
                  filter: "brightness(0.65) saturate(0.85)",
                  transition: "transform 500ms var(--ease)" }}
                onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
                onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"} />
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.75) 100%)",
              }} />
              <div style={{
                position: "absolute", top: "20px", left: "20px",
                display: "flex", alignItems: "center", gap: "8px",
                padding: "6px 12px", borderRadius: "var(--r-full)",
                background: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff", fontSize: "11px", fontWeight: 600,
                letterSpacing: "0.05em", textTransform: "uppercase",
              }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%",
                  background: "var(--accent)" }} />
                {c.badge}
              </div>
              <p style={{
                position: "absolute", left: "20px", bottom: "20px", right: "20px",
                fontFamily: "var(--font-display)", fontSize: "18px",
                fontWeight: 700, color: "#fff", letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}>
                {c.title}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════
          BOOKING 1-2-3 — steps con líneas conectadas
          ═════════════════════════════════════════════════════════════════ */}
      <section data-testid="steps-section" style={{
        padding: "clamp(60px, 8vw, 100px) clamp(16px, 4vw, 60px) clamp(40px, 6vw, 60px)",
      }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <h2 className="display-bold" style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.6rem, 2.5vw, 2.2rem)",
            fontWeight: 800, lineHeight: 1,
            letterSpacing: "-0.03em", color: "var(--text)",
            marginBottom: "48px",
          }}>
            Comprá y grabá en 3 pasos.
          </h2>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "clamp(16px, 3vw, 40px)",
            position: "relative",
          }} className="steps-grid">
            {steps.map((s, i) => (
              <div key={s.num} data-testid={`step-${i}`} style={{
                display: "flex", alignItems: "flex-start", gap: "16px",
              }}>
                {/* Circle with number */}
                <div style={{
                  minWidth: "44px", width: "44px", height: "44px",
                  borderRadius: "50%",
                  border: "1px dashed rgba(26,255,110,0.5)",
                  background: "var(--surface-2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--accent)",
                  fontFamily: "var(--font-display)", fontSize: "15px", fontWeight: 700,
                  letterSpacing: "-0.01em",
                }}>
                  {s.num}
                </div>
                <div>
                  <p style={{
                    fontFamily: "var(--font-display)", fontSize: "17px",
                    fontWeight: 700, color: "var(--text)",
                    letterSpacing: "-0.01em", marginBottom: "6px",
                  }}>
                    {s.title}
                  </p>
                  <p style={{
                    fontFamily: "var(--font-sans)", fontSize: "13px",
                    color: "var(--text-2)", lineHeight: 1.6,
                  }}>
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════
          BRANDS STRIP
          ═════════════════════════════════════════════════════════════════ */}
      {brands.length > 0 && (
        <section data-testid="brands-strip" style={{ padding: "0 clamp(16px, 4vw, 60px)" }}>
          <div style={{
            maxWidth: "1200px", margin: "0 auto",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-2xl)",
            padding: "clamp(24px, 3vw, 36px)",
            display: "grid", gridTemplateColumns: "auto 1fr",
            gap: "40px", alignItems: "center",
          }} className="brands-strip-grid">
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: "13px",
              color: "var(--text-2)", maxWidth: "180px", lineHeight: 1.5,
            }}>
              Trabajamos con las marcas top de la industria
            </p>
            <div style={{ overflow: "hidden", position: "relative" }}>
              <div style={{
                display: "flex", gap: "60px", flexWrap: "nowrap",
                animation: "marquee 30s linear infinite", width: "max-content",
              }}>
                {[...brands, ...brands].map((b, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", flexShrink: 0,
                    opacity: 0.5, height: "40px",
                    transition: "opacity 200ms var(--ease)",
                  }}
                    onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                    onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}>
                    {b.logo_url || b.logo ? (
                      <img src={mediaUrl(b.logo_url || b.logo)} alt={b.name}
                        style={{ height: "26px", maxWidth: "140px",
                          objectFit: "contain",
                          filter: "brightness(0) invert(1)" }} />
                    ) : (
                      <span style={{ fontFamily: "var(--font-display)",
                        fontSize: "20px", fontWeight: 700,
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
        @media (max-width: 900px) {
          .why-grid           { grid-template-columns: 1fr !important; gap: 32px !important; }
          .stats-3            { max-width: 100% !important; }
          .products-header    { grid-template-columns: 1fr !important; }
          .products-4         { grid-template-columns: repeat(2, 1fr) !important; }
          .packages-grid      { grid-template-columns: 1fr !important; }
          .steps-grid         { grid-template-columns: 1fr !important; gap: 24px !important; }
          .brands-strip-grid  { grid-template-columns: 1fr !important; gap: 16px !important; }
        }
      `}</style>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Product mini card (compact — used inside the "Top Products" container)
// ═══════════════════════════════════════════════════════════════
function ProductMiniCard({ product }) {
  const img = product.primary_image
    || product.images?.[0]?.image
    || null
  const price = Number(product.price)

  return (
    <Link to={`/product/${product.slug}`} data-testid={`mini-product-${product.slug}`} style={{
      position: "relative",
      borderRadius: "var(--r-xl)",
      overflow: "hidden",
      textDecoration: "none",
      display: "block",
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      transition: "transform 240ms var(--ease), border-color 240ms var(--ease)",
      minHeight: "260px",
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-4px)"
        e.currentTarget.style.borderColor = "rgba(26,255,110,0.3)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0)"
        e.currentTarget.style.borderColor = "var(--border)"
      }}>
      {img ? (
        <img src={mediaUrl(img)} alt={product.name}
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            position: "absolute", inset: 0,
            filter: "brightness(0.7) saturate(0.9)",
          }} />
      ) : (
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(135deg, var(--surface-3), var(--surface))",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-3)", fontSize: "12px",
        }}>Sin imagen</div>
      )}

      {/* Gradient overlay for readability */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.85) 100%)",
      }} />

      {/* Badge "desde $X" */}
      <div style={{
        position: "absolute", top: "12px", left: "12px",
        padding: "5px 10px", borderRadius: "var(--r-full)",
        background: "rgba(255,255,255,0.14)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.22)",
        color: "#fff", fontSize: "10px", fontWeight: 600,
        letterSpacing: "0.03em",
      }}>
        desde {clp(price)}
      </div>

      {/* Bottom info */}
      <div style={{
        position: "absolute", left: "14px", right: "14px", bottom: "14px",
      }}>
        <p style={{
          fontFamily: "var(--font-display)", fontSize: "15px",
          fontWeight: 700, color: "#fff", letterSpacing: "-0.01em",
          lineHeight: 1.2, marginBottom: "6px",
          overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {product.name}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "8px",
          fontSize: "11px", color: "rgba(255,255,255,0.75)",
          fontFamily: "var(--font-sans)" }}>
          <span style={{ color: "var(--accent)" }}>●</span>
          <span>{product.brand?.name || product.brand_name || "Audio pro"}</span>
        </div>
      </div>
    </Link>
  )
}

// ═══════════════════════════════════════════════════════════════
// Arrow button (like WANDER's carousel controls)
// ═══════════════════════════════════════════════════════════════
function ArrowBtn({ dir, onClick, disabled }) {
  return (
    <button
      data-testid={`arrow-${dir}`}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "40px", height: "40px", borderRadius: "50%",
        background: "transparent",
        border: "1px solid var(--border)",
        color: disabled ? "var(--text-3)" : "var(--text)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "18px", fontFamily: "var(--font-sans)",
        transition: "all 200ms var(--ease)",
      }}
      onMouseEnter={e => {
        if (!disabled) {
          e.currentTarget.style.borderColor = "var(--accent)"
          e.currentTarget.style.color = "var(--accent)"
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "var(--border)"
        e.currentTarget.style.color = "var(--text)"
      }}>
      {dir === "prev" ? "‹" : "›"}
    </button>
  )
}
