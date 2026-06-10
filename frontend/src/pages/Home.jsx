// pages/Home.jsx — Folioblox-inspired redesign
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getProducts, getBrands } from "../api/products.api"
import ProductCard from "../components/product/ProductCard"
import { mediaUrl } from "../utils/mediaUrl"

// ── Imagen lifestyle del hero (estilo Folioblox: silueta musical) ─
const HERO_IMG = "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1200&q=80"
const GRID_IMGS = [
  "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1598653222000-6b7b7a552625?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=900&q=80",
]

// ── Número animado ────────────────────────────────────────────
function AnimatedNumber({ value, suffix = "" }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      let s = 0, end = parseInt(value), step = end / (1500 / 16)
      const t = setInterval(() => {
        s += step
        if (s >= end) { setDisplay(end); clearInterval(t) }
        else { setDisplay(Math.floor(s)) }
      }, 16)
      obs.disconnect()
    }, { threshold: 0.5 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [value])
  return <span ref={ref}>{display.toLocaleString("es-CL")}{suffix}</span>
}

// ── Marquee de marcas ─────────────────────────────────────────
function BrandsMarquee({ brands }) {
  if (!brands?.length) return null
  const doubled = [...brands, ...brands]
  return (
    <div style={{ overflow: "hidden", position: "relative" }} data-testid="brands-marquee">
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "140px",
        zIndex: 1, background: "linear-gradient(to right, var(--bg), transparent)",
        pointerEvents: "none" }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "140px",
        zIndex: 1, background: "linear-gradient(to left, var(--bg), transparent)",
        pointerEvents: "none" }} />
      <div className="marquee-track" style={{ gap: "80px", padding: "8px 0" }}>
        {doubled.map((brand, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px",
            opacity: 0.6, transition: "opacity var(--dur) var(--ease)",
            flexShrink: 0, cursor: brand.website ? "pointer" : "default" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "1"}
            onMouseLeave={e => e.currentTarget.style.opacity = "0.6"}
            onClick={() => brand.website && window.open(brand.website, "_blank")}>
            {brand.logo_url || brand.logo ? (
              <img src={mediaUrl(brand.logo_url || brand.logo)} alt={brand.name}
                style={{ height: "26px", width: "auto",
                  filter: "brightness(0) invert(1)", objectFit: "contain" }} />
            ) : (
              <span style={{ fontFamily: "var(--font-display)", fontSize: "20px",
                fontWeight: 700, letterSpacing: "-0.02em", whiteSpace: "nowrap",
                color: "var(--text)" }}>
                {brand.name}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Home ──────────────────────────────────────────────────────
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

  const stats = [
    { value: "500",  suffix: "+", label: "Productos"    },
    { value: "50",   suffix: "+", label: "Marcas"       },
    { value: "2000", suffix: "+", label: "Clientes"     },
    { value: "99",   suffix: "%", label: "Satisfacción" },
  ]

  const offerings = [
    { num: "01", title: "Tienda",    desc: "Equipamiento profesional",     to: "/shop"     },
    { num: "02", title: "Academia",  desc: "Cursos técnicos en video",     to: "/academy"  },
    { num: "03", title: "Servicios", desc: "Mezcla, masterización & más",  to: "/services" },
    { num: "04", title: "Soporte",   desc: "Asesoría técnica especializada", to: "/services" },
  ]

  const gridCards = [
    { title: "Equipamiento de estudio", desc: "Micrófonos, interfaces, monitores y procesadores de las mejores marcas del mundo.", to: "/shop", img: GRID_IMGS[0] },
    { title: "Formación profesional",   desc: "Cursos técnicos en video sobre producción, mezcla, masterización y diseño sonoro.", to: "/academy", img: GRID_IMGS[1] },
    { title: "Servicios a medida",      desc: "Mezcla, masterización, operación en vivo y asesoría de estudios.", to: "/services", img: GRID_IMGS[2] },
  ]

  return (
    <div style={{ background: "var(--bg)", padding: "16px clamp(16px, 3vw, 24px)" }} data-testid="home-page">

      {/* ══════════════════════════════════════════════════════════════════
          HERO — Card grande con gradiente verde fade a negro (estilo Folioblox)
          ══════════════════════════════════════════════════════════════════ */}
      <section
        data-testid="home-hero"
        className="hero-gradient"
        style={{
          position: "relative",
          borderRadius: "var(--r-2xl)",
          overflow: "hidden",
          marginTop: "0",
          minHeight: "780px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Imagen lifestyle a la derecha (silueta musical) */}
        <div style={{
          position: "absolute", top: 0, right: 0, bottom: 0,
          width: "55%", overflow: "hidden", pointerEvents: "none",
        }} className="hero-image-wrap">
          <img src={HERO_IMG} alt="Audio professional"
            style={{
              width: "100%", height: "100%", objectFit: "cover",
              objectPosition: "center 30%",
              filter: "grayscale(60%) contrast(1.1) brightness(0.65)",
              mixBlendMode: "screen",
              opacity: 0.55,
            }} />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to right, rgba(10,40,20,0.7) 0%, transparent 30%, transparent 100%)",
          }} />
        </div>

        {/* Contenido del hero */}
        <div style={{
          position: "relative", zIndex: 2,
          padding: "clamp(40px, 6vw, 88px) clamp(28px, 5vw, 80px)",
          display: "flex", flexDirection: "column",
          flex: 1, gap: "clamp(40px, 6vw, 80px)",
        }}>
          {/* Top: badge */}
          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <span className="badge badge-accent" data-testid="hero-tagline">
              <span style={{ width: "6px", height: "6px", borderRadius: "50%",
                background: "var(--accent)", animation: "glowPulse 2s ease-in-out infinite" }} />
              Audio profesional · Chile & Argentina
            </span>
          </div>

          {/* Headline */}
          <div style={{ maxWidth: "780px", display: "flex",
            flexDirection: "column", gap: "28px" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1rem, 1.6vw, 1.3rem)",
              fontWeight: 500, color: "var(--text)", letterSpacing: "-0.01em" }}>
              Hola, sos un
            </p>
            <h1
              data-testid="hero-headline"
              className="display-bold"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(3.5rem, 9vw, 8rem)",
                fontWeight: 900,
                lineHeight: 0.88,
                letterSpacing: "-0.05em",
                color: "var(--text)",
              }}
            >
              Productor<br />
              <span style={{
                background: "linear-gradient(135deg, #fff 0%, var(--accent) 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>Sonidista</span>
            </h1>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto",
              gap: "32px", alignItems: "end", marginTop: "16px",
              maxWidth: "640px" }} className="hero-bottom-grid">
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "16px",
                color: "var(--text-2)", lineHeight: 1.6, maxWidth: "420px" }}>
                Equipamiento, formación y servicios profesionales para producir,
                grabar y mezclar al nivel de los grandes.
              </p>
              <Link to="/shop" className="btn btn-accent"
                data-testid="hero-cta-shop"
                style={{ fontSize: "14px", fontWeight: 700 }}>
                Ver tienda
              </Link>
            </div>
          </div>

          {/* Spacer */}
          <div style={{ flex: 1, minHeight: "20px" }} />

          {/* Bottom row: 4 numbered offerings */}
          <div
            data-testid="offerings-row"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "clamp(12px, 2vw, 32px)",
              paddingTop: "32px",
              borderTop: "1px solid rgba(255,255,255,0.1)",
            }}
            className="offerings-grid">
            {offerings.map(o => (
              <Link key={o.num} to={o.to} style={{ textDecoration: "none" }}
                data-testid={`offering-${o.title.toLowerCase()}`}>
                <div style={{ display: "flex", alignItems: "baseline",
                  gap: "10px", marginBottom: "10px" }}>
                  <span style={{
                    fontFamily: "var(--font-sans)", fontSize: "11px",
                    color: "var(--accent)", fontWeight: 700,
                    letterSpacing: "0.1em",
                  }}>#{o.num}</span>
                </div>
                <p style={{ fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.1rem, 1.6vw, 1.4rem)",
                  fontWeight: 700, color: "var(--text)",
                  letterSpacing: "-0.02em", marginBottom: "4px" }}>
                  {o.title}
                </p>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "12px",
                  color: "rgba(255,255,255,0.55)" }}>
                  {o.desc}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          TRUSTED BY BRANDS — dark band con marquee
          ══════════════════════════════════════════════════════════════════ */}
      <section
        data-testid="trusted-brands"
        style={{
          background: "var(--surface)",
          borderRadius: "var(--r-2xl)",
          marginTop: "20px",
          padding: "clamp(28px, 4vw, 48px) clamp(28px, 5vw, 80px)",
        }}>
        <div style={{ display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "60px", alignItems: "center" }}
          className="trusted-grid">
          <div style={{ maxWidth: "200px" }}>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px",
              color: "var(--text-2)", lineHeight: 1.5 }}>
              Las marcas que<br />
              elegimos para vos
            </p>
          </div>
          <BrandsMarquee brands={brands} />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          BEHIND THE DESIGNS — sección con título display gigante
          ══════════════════════════════════════════════════════════════════ */}
      <section
        data-testid="behind-section"
        style={{
          padding: "clamp(80px, 12vw, 160px) clamp(28px, 5vw, 80px)",
        }}>
        <div style={{ maxWidth: "var(--container)", margin: "0 auto",
          display: "grid", gridTemplateColumns: "7fr 5fr",
          gap: "clamp(40px, 6vw, 80px)", alignItems: "end" }}
          className="behind-grid">
          <div>
            <p className="badge-label" style={{ marginBottom: "32px",
              display: "inline-block" }}>
              Detrás del sonido
            </p>
            <h2 className="display-bold"
              data-testid="behind-headline"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2.5rem, 6vw, 5.5rem)",
                fontWeight: 900, lineHeight: 0.9,
                letterSpacing: "-0.04em",
                color: "var(--text)",
              }}>
              Equipo que da<br />vida a cada<br />idea sonora.
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column",
            gap: "32px", alignItems: "flex-start" }}>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "17px",
              color: "var(--text-2)", lineHeight: 1.7 }}>
              Construimos un ecosistema digital donde encontrás todo lo que
              necesitás para llevar tu sonido al nivel profesional — desde
              el primer micrófono hasta el master final.
            </p>
            <Link to="/services" className="btn btn-accent"
              data-testid="behind-cta"
              style={{ fontSize: "14px", fontWeight: 700 }}>
              Contratar servicio
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          3-CARD MONOCHROME GRID
          ══════════════════════════════════════════════════════════════════ */}
      <section
        data-testid="services-grid"
        style={{
          padding: "0 clamp(28px, 5vw, 80px) clamp(80px, 12vw, 140px)",
        }}>
        <div style={{ maxWidth: "var(--container)", margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "clamp(16px, 2vw, 28px)" }}
          className="three-card-grid">
          {gridCards.map((card, i) => (
            <Link key={i} to={card.to}
              data-testid={`feature-card-${i}`}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-2xl)",
                overflow: "hidden", textDecoration: "none",
                transition: "all var(--dur-slow) var(--ease)",
                display: "flex", flexDirection: "column",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "rgba(26,255,110,0.3)"
                e.currentTarget.style.boxShadow = "0 0 60px rgba(26,255,110,0.12), 0 20px 50px rgba(0,0,0,0.4)"
                e.currentTarget.style.transform = "translateY(-6px)"
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "var(--border)"
                e.currentTarget.style.boxShadow = "none"
                e.currentTarget.style.transform = "translateY(0)"
              }}>
              <div style={{ aspectRatio: "4/5", overflow: "hidden",
                position: "relative" }}>
                <img src={card.img} alt={card.title} className="mono-img"
                  style={{ width: "100%", height: "100%", objectFit: "cover",
                    transition: "transform 600ms var(--ease)" }} />
              </div>
              <div style={{ padding: "28px 28px 32px",
                display: "flex", flexDirection: "column", gap: "12px" }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "20px",
                  fontWeight: 700, color: "var(--text)",
                  letterSpacing: "-0.02em" }}>
                  {card.title}
                </p>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px",
                  color: "var(--text-2)", lineHeight: 1.6 }}>
                  {card.desc}
                </p>
                <span style={{ fontSize: "13px", color: "var(--accent)",
                  fontWeight: 600, marginTop: "8px",
                  display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  Ver más →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          STATS — números grandes display
          ══════════════════════════════════════════════════════════════════ */}
      <section
        data-testid="stats-section"
        style={{
          background: "var(--surface)",
          borderRadius: "var(--r-2xl)",
          padding: "clamp(48px, 6vw, 80px) clamp(28px, 5vw, 80px)",
          margin: "0 clamp(0px, 0vw, 0px)",
        }}>
        <div style={{ display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "clamp(24px, 4vw, 60px)" }} className="stats-grid">
          {stats.map(({ value, suffix, label }) => (
            <div key={label} data-testid={`stat-${label.toLowerCase()}`}>
              <p style={{ fontFamily: "var(--font-display)",
                fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
                fontWeight: 900, lineHeight: 0.9, letterSpacing: "-0.04em",
                color: "var(--text)", marginBottom: "10px" }}>
                <AnimatedNumber value={value} suffix={suffix} />
              </p>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "12px",
                color: "var(--text-3)", textTransform: "uppercase",
                letterSpacing: "0.15em", fontWeight: 600 }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          PRODUCTOS DESTACADOS
          ══════════════════════════════════════════════════════════════════ */}
      <section
        data-testid="featured-products"
        style={{
          padding: "clamp(80px, 12vw, 140px) clamp(28px, 5vw, 80px)",
        }}>
        <div style={{ maxWidth: "var(--container)", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "end", marginBottom: "60px", flexWrap: "wrap", gap: "20px" }}>
            <div>
              <p className="badge-label" style={{ marginBottom: "20px",
                display: "inline-block" }}>
                Selección
              </p>
              <h2 className="display-bold" style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2.2rem, 5vw, 4rem)",
                fontWeight: 900, lineHeight: 0.9,
                letterSpacing: "-0.04em", color: "var(--text)",
              }}>
                Lo más destacado.
              </h2>
            </div>
            <Link to="/shop" className="btn btn-ghost"
              data-testid="view-all-products">
              Ver toda la tienda →
            </Link>
          </div>

          <div style={{ display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "20px" }}>
            {(featured.length > 0 ? featured.slice(0, 4) : [...Array(4)]).map((product, i) =>
              product ? (
                <ProductCard key={product.id} product={product} />
              ) : (
                <div key={i} className="skeleton" style={{ height: "380px" }} />
              )
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          FINAL CTA
          ══════════════════════════════════════════════════════════════════ */}
      <section
        data-testid="final-cta"
        className="hero-gradient"
        style={{
          position: "relative",
          borderRadius: "var(--r-2xl)",
          padding: "clamp(80px, 12vw, 160px) clamp(28px, 5vw, 80px)",
          textAlign: "center", overflow: "hidden",
          marginBottom: "20px",
        }}>
        <div style={{ maxWidth: "780px", margin: "0 auto",
          position: "relative", zIndex: 1 }}>
          <h2 className="display-bold" style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(3rem, 7vw, 6rem)",
            fontWeight: 900, lineHeight: 0.9,
            letterSpacing: "-0.045em", marginBottom: "32px",
            color: "var(--text)",
          }}>
            Subí el<br />nivel.
          </h2>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "17px",
            color: "var(--text-2)", lineHeight: 1.7,
            marginBottom: "48px", maxWidth: "520px", margin: "0 auto 48px" }}>
            Explorá nuestro catálogo y encontrá el equipamiento que llevará
            tu sonido al próximo nivel.
          </p>
          <div style={{ display: "flex", gap: "12px",
            justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/shop" className="btn btn-accent"
              data-testid="final-cta-shop"
              style={{ fontSize: "15px", fontWeight: 700 }}>
              Explorar tienda
            </Link>
            <a href="https://wa.me/5492622635045" target="_blank" rel="noreferrer"
              className="btn btn-ghost"
              data-testid="final-cta-whatsapp"
              style={{ fontSize: "15px", fontWeight: 600 }}>
              Hablar con un experto
            </a>
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 980px) {
          .hero-image-wrap { width: 100% !important; opacity: 0.3 !important; }
          .offerings-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 24px !important; }
          .behind-grid { grid-template-columns: 1fr !important; }
          .trusted-grid { grid-template-columns: 1fr !important; gap: 20px !important; }
          .three-card-grid { grid-template-columns: 1fr !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .hero-bottom-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
        }
        @media (max-width: 540px) {
          .offerings-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  )
}
