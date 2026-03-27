// pages/Home.jsx

import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getProducts } from "../api/products.api"
import ProductCard from "../components/product/ProductCard"
import iconImg from "../assets/icon.png"
import fondoImg from "../assets/fondo.png"

// ── Hero ─────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{
      minHeight: "94vh",
      display: "flex",
      alignItems: "center",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Fondo textura sutil */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `url(${fondoImg})`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
        opacity: 0.06,
      }} />

      {/* Glow verde — esquina inferior derecha */}
      <div style={{
        position: "absolute",
        bottom: "-200px",
        right: "-100px",
        width: "600px",
        height: "600px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(26,255,110,0.06) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />

      <div className="container" style={{
        maxWidth: "var(--container)",
        padding: "clamp(80px, 12vh, 140px) clamp(20px, 5vw, 60px)",
        position: "relative",
        zIndex: 1,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "60px",
        alignItems: "center",
      }}>

        {/* Texto izquierda */}
        <div>
          <div className="fade-up d-1" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "32px" }}>
            <img src={iconImg} alt="" style={{ width: "20px", height: "20px", filter: "brightness(0) invert(0.4)" }} />
            <span style={{ fontSize: "12px", color: "var(--text-3)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500 }}>
              Audio Profesional — Chile & Argentina
            </span>
          </div>

          <h1 className="fade-up d-2" style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(3rem, 5.5vw, 5.5rem)",
            lineHeight: 1.06,
            letterSpacing: "-0.03em",
            marginBottom: "24px",
            fontWeight: 400,
          }}>
            Suena en<br />
            <em style={{ color: "var(--accent)", fontStyle: "italic" }}>otro nivel.</em>
          </h1>

          <p className="fade-up d-3" style={{
            fontSize: "clamp(15px, 1.2vw, 17px)",
            color: "var(--text-2)",
            lineHeight: 1.7,
            maxWidth: "420px",
            marginBottom: "40px",
          }}>
            Equipamiento profesional, academia online y servicios de producción musical.
            Todo en un solo lugar.
          </p>

          <div className="fade-up d-4" style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Link to="/shop" className="btn btn-accent">
              Ver tienda
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
              </svg>
            </Link>
            <Link to="/academy" className="btn btn-ghost">
              Academia
            </Link>
          </div>

          {/* Stats */}
          <div className="fade-up d-5" style={{
            display: "flex",
            gap: "32px",
            marginTop: "56px",
            paddingTop: "32px",
            borderTop: "1px solid var(--border)",
          }}>
            {[
              { value: "+500", label: "Productos" },
              { value: "+15",  label: "Marcas" },
              { value: "+20",  label: "Cursos" },
            ].map(({ value, label }) => (
              <div key={label}>
                <p style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "2rem",
                  lineHeight: 1,
                  color: "var(--text)",
                  marginBottom: "4px",
                }}>
                  {value}
                </p>
                <p style={{ fontSize: "12px", color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Visual derecha — placeholder elegante */}
        <div className="hidden md:flex fade-in d-3" style={{
          justifyContent: "center",
          alignItems: "center",
          position: "relative",
        }}>
          <div style={{
            width: "100%",
            aspectRatio: "4/5",
            borderRadius: "var(--r-xl)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Textura dentro */}
            <div style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${fondoImg})`,
              backgroundSize: "cover",
              opacity: 0.08,
            }} />
            <img src={iconImg} alt="" style={{
              width: "80px",
              height: "80px",
              filter: "brightness(0) invert(0.15)",
              position: "relative",
              zIndex: 1,
            }} />
            <p style={{
              fontSize: "12px",
              color: "var(--text-3)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              position: "relative",
              zIndex: 1,
            }}>
              Agregar imagen de producto destacado
            </p>
          </div>

          {/* Floating card */}
          <div style={{
            position: "absolute",
            bottom: "32px",
            left: "-24px",
            background: "rgba(15,15,15,0.9)",
            backdropFilter: "blur(20px)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "var(--accent-glow)",
              border: "1px solid rgba(26,255,110,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}>
              🎧
            </div>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 500, marginBottom: "2px" }}>Shure SM58</p>
              <p style={{ fontSize: "12px", color: "var(--accent)" }}>$150.000</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Categorías ───────────────────────────────────────────────
function Categories() {
  const cats = [
    { label: "Audio Pro",    icon: "🎛️", slug: "audio-pro" },
    { label: "Micrófonos",   icon: "🎤", slug: "microfonos" },
    { label: "Instrumentos", icon: "🎸", slug: "instrumentos-musicales" },
    { label: "Pedales",      icon: "🎚️", slug: "pedales" },
    { label: "In-Ears",      icon: "🎧", slug: "in-ears" },
    { label: "Academia",     icon: "🎓", slug: null, to: "/academy" },
  ]

  return (
    <section style={{ padding: "var(--section) 0", borderTop: "1px solid var(--border)" }}>
      <div className="container" style={{ maxWidth: "var(--container)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "40px" }}>
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2rem, 3.5vw, 2.8rem)" }}>
            Explorar
          </h2>
          <Link to="/shop" style={{ fontSize: "13px", color: "var(--text-2)", transition: "color var(--dur)" }}
            className="hover:text-white"
          >
            Ver todo →
          </Link>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "12px",
        }}
          className="grid grid-cols-3 md:grid-cols-6 gap-3"
        >
          {cats.map(({ label, icon, slug, to }) => (
            <Link
              key={label}
              to={to || `/shop?category=${slug}`}
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "10px",
                padding: "24px 12px",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: "28px", lineHeight: 1 }}>{icon}</span>
              <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-2)" }}>
                {label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Productos destacados ─────────────────────────────────────
function Featured() {
  const { data, isLoading } = useQuery({
    queryKey: ["products", "featured"],
    queryFn:  () => getProducts({ is_featured: true, page_size: 4 }),
  })

  const products = data?.results || data || []

  return (
    <section style={{ padding: "var(--section) 0", borderTop: "1px solid var(--border)" }}>
      <div className="container" style={{ maxWidth: "var(--container)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "40px" }}>
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2rem, 3.5vw, 2.8rem)" }}>
            Destacados
          </h2>
          <Link to="/shop" style={{ fontSize: "13px", color: "var(--text-2)", transition: "color var(--dur)" }}
            className="hover:text-white"
          >
            Ver todos →
          </Link>
        </div>

        {isLoading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "320px" }} />
            ))}
          </div>
        )}

        {!isLoading && products.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}

        {!isLoading && products.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-3)" }}>
            <Link to="/shop" style={{ color: "var(--accent)", fontSize: "14px" }}>
              Ver todos los productos →
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

// ── Academia banner ──────────────────────────────────────────
function AcademyBanner() {
  return (
    <section style={{ padding: "var(--section) 0", borderTop: "1px solid var(--border)" }}>
      <div className="container" style={{ maxWidth: "var(--container)" }}>
        <div style={{
          position: "relative",
          borderRadius: "var(--r-xl)",
          border: "1px solid var(--border)",
          overflow: "hidden",
          padding: "clamp(48px, 8vw, 80px)",
          background: "var(--surface)",
        }}>
          {/* Textura */}
          <div style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${fondoImg})`,
            backgroundSize: "cover",
            opacity: 0.05,
          }} />
          {/* Glow */}
          <div style={{
            position: "absolute",
            top: "-100px",
            right: "-100px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(26,255,110,0.07) 0%, transparent 60%)",
          }} />

          <div style={{ position: "relative", zIndex: 1, maxWidth: "560px" }}>
            <span className="pill pill-accent" style={{ marginBottom: "24px", display: "inline-flex" }}>
              LevelPro Audio Academy
            </span>
            <h2 style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(2.2rem, 4vw, 3.8rem)",
              marginBottom: "20px",
              lineHeight: 1.1,
            }}>
              Aprende a sonar{" "}
              <em style={{ fontStyle: "italic", color: "var(--accent)" }}>profesional.</em>
            </h2>
            <p style={{ fontSize: "16px", color: "var(--text-2)", marginBottom: "36px", lineHeight: 1.7 }}>
              Cursos de producción musical, mezcla, mastering, live sound y sonido para iglesias.
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <Link to="/academy" className="btn btn-accent">Ver cursos</Link>
              <Link to="/services" className="btn btn-ghost">Servicios</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Value props ──────────────────────────────────────────────
function ValueProps() {
  const items = [
    { icon: "🚚", title: "Envíos Chile y Argentina",  desc: "Rápido, coordinado y seguro." },
    { icon: "💳", title: "Múltiples medios de pago",  desc: "MercadoPago, PayPal, transferencia." },
    { icon: "💬", title: "Atención inmediata",         desc: "Asesoramiento técnico por WhatsApp." },
    { icon: "🎓", title: "Academia online",            desc: "Cursos de producción y live sound." },
  ]

  return (
    <section style={{ padding: "60px 0", borderTop: "1px solid var(--border)" }}>
      <div className="container" style={{ maxWidth: "var(--container)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px" }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6"
        >
          {items.map(({ icon, title, desc }) => (
            <div key={title} style={{ padding: "4px" }}>
              <span style={{ fontSize: "24px", display: "block", marginBottom: "12px" }}>{icon}</span>
              <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text)", marginBottom: "6px" }}>
                {title}
              </p>
              <p style={{ fontSize: "13px", color: "var(--text-3)", lineHeight: 1.6 }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <>
      <Hero />
      <Categories />
      <Featured />
      <AcademyBanner />
      <ValueProps />
    </>
  )
}