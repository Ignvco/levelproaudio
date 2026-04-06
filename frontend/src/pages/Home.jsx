// pages/Home.jsx

import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getProducts, getBrands } from "../api/products.api"
import ProductCard from "../components/product/ProductCard"
import { mediaUrl } from "../utils/mediaUrl"
import { useScrollReveal } from "../hooks/useScrollReveal"

// ── Número animado ────────────────────────────────────────────
function AnimatedNumber({ value, suffix = "" }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        let start = 0
        const end      = parseInt(value)
        const duration = 1500
        const step     = end / (duration / 16)
        const timer    = setInterval(() => {
          start += step
          if (start >= end) {
            setDisplay(end)
            clearInterval(timer)
          } else {
            setDisplay(Math.floor(start))
          }
        }, 16)
        observer.disconnect()
      },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [value])

  return <span ref={ref}>{display.toLocaleString("es-CL")}{suffix}</span>
}

// ── Marquee de marcas ─────────────────────────────────────────
function BrandsMarquee({ brands }) {
  if (!brands?.length) return null
  const doubled = [...brands, ...brands]

  return (
    <div style={{ overflow: "hidden", position: "relative" }}>
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: "120px",
        zIndex: 1,
        background: "linear-gradient(to right, var(--bg-2), transparent)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: "120px",
        zIndex: 1,
        background: "linear-gradient(to left, var(--bg-2), transparent)",
        pointerEvents: "none",
      }} />

      <div className="marquee-track" style={{ gap: "60px", padding: "8px 0" }}>
        {doubled.map((brand, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: "12px",
            opacity: 0.4, transition: "opacity var(--dur) var(--ease)",
            flexShrink: 0,
            cursor: brand.website ? "pointer" : "default",
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
            onMouseLeave={e => e.currentTarget.style.opacity = "0.4"}
            onClick={() => brand.website && window.open(brand.website, "_blank")}
          >
            {brand.logo ? (
              <img src={mediaUrl(brand.logo)} alt={brand.name}
                style={{
                  height: "22px", width: "auto",
                  filter: "brightness(0) invert(1)", objectFit: "contain",
                }} />
            ) : (
              <span style={{
                fontSize: "14px", fontWeight: 600,
                letterSpacing: "0.06em", whiteSpace: "nowrap",
              }}>
                {brand.name.toUpperCase()}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Hero product card mini ────────────────────────────────────
function HeroProductCard({ product, style }) {
  const primaryImg = product?.images?.find(i => i.is_primary) || product?.images?.[0]
  const img = primaryImg ? mediaUrl(primaryImg.image) : null

  return (
    <Link to={`/shop/${product.slug}`} style={{
      display: "block",
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--r-xl)",
      overflow: "hidden",
      textDecoration: "none",
      transition: "all var(--dur-slow) var(--ease)",
      ...style,
    }}>
      <div style={{
        aspectRatio: "1", background: "var(--surface-2)", overflow: "hidden",
      }}>
        {img ? (
          <img src={img} alt={product.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "40px",
          }}>
            🎧
          </div>
        )}
      </div>
      <div style={{ padding: "12px 14px" }}>
        <p style={{
          fontSize: "12px", fontWeight: 500, marginBottom: "4px",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {product.name}
        </p>
        <p style={{ fontSize: "13px", color: "var(--accent)", fontWeight: 600 }}>
          ${Number(product.price).toLocaleString("es-CL")}
        </p>
      </div>
    </Link>
  )
}

// ── Home ──────────────────────────────────────────────────────
export default function Home() {

  // ── Data ────────────────────────────────────────────────────
  const { data: featuredData } = useQuery({
    queryKey: ["products", { featured: true }],
    queryFn:  () => getProducts({ is_featured: true, page_size: 8 }),
  })
  const { data: brandsData } = useQuery({
    queryKey: ["brands"],
    queryFn:  getBrands,
  })
  const { data: newProductsData } = useQuery({
    queryKey: ["products", { new: true }],
    queryFn:  () => getProducts({ page_size: 4, ordering: "-created_at" }),
  })

  const featured    = featuredData?.results    || featuredData    || []
  const brands      = brandsData?.results      || brandsData      || []
  const newProducts = newProductsData?.results || newProductsData || []
  const heroProduct = featured[0] || newProducts[0]

  // ── Scroll reveal refs ───────────────────────────────────────
  const badgeRef    = useScrollReveal({ delay: 0 })
  const headlineRef = useScrollReveal({ delay: 100 })
  const subtitleRef = useScrollReveal({ delay: 200 })
  const ctasRef     = useScrollReveal({ delay: 300 })
  const statsRef    = useScrollReveal({ delay: 400 })
  const heroImgRef  = useScrollReveal({ delay: 300, scaleIn: true })
  const brandsRef   = useScrollReveal({ delay: 0 })
  const featLabelRef = useScrollReveal({ delay: 0 })
  const featGridRef  = useScrollReveal({ delay: 150, scaleIn: true })
  const featuresRef  = useScrollReveal({ delay: 0, scaleIn: true })
  const ctaSectionRef = useScrollReveal({ delay: 0, scaleIn: true })

  const stats = [
    { value: "500",  suffix: "+", label: "Productos"    },
    { value: "50",   suffix: "+", label: "Marcas"       },
    { value: "2000", suffix: "+", label: "Clientes"     },
    { value: "99",   suffix: "%", label: "Satisfacción" },
  ]

  return (
    <div style={{ background: "var(--bg)" }}>

      {/* ══════════════════════════════════════════════════════
          HERO
         ══════════════════════════════════════════════════════ */}
      <section style={{
        position:      "relative",
        minHeight:     "100vh",
        display:       "flex",
        alignItems:    "center",
        overflow:      "hidden",
        paddingTop:    "120px",
        paddingBottom: "80px",
      }}>

        {/* Gradiente radial de fondo */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `
            radial-gradient(ellipse 60% 60% at 70% 50%,
              rgba(26,255,110,0.06) 0%, transparent 70%),
            radial-gradient(ellipse 40% 40% at 20% 80%,
              rgba(26,255,110,0.04) 0%, transparent 60%)
          `,
        }} />

        {/* Grid de puntos */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent)",
        }} />

        <div style={{
          maxWidth: "var(--container)", margin: "0 auto",
          padding: "0 clamp(20px, 5vw, 60px)",
          width: "100%", display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "80px", alignItems: "center",
        }}
          className="hero-grid"
        >
          {/* ── Columna texto ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>

            <div ref={badgeRef} style={{ display: "inline-flex" }}>
              <span className="badge badge-accent">
                <span style={{
                  width: "6px", height: "6px", borderRadius: "50%",
                  background: "var(--accent)",
                  animation: "glowPulse 2s ease-in-out infinite",
                }} />
                Audio profesional · Chile & Argentina
              </span>
            </div>

            <div ref={headlineRef}>
              <h1 style={{
                fontFamily: "var(--font-serif)",
                fontSize:   "clamp(3rem, 7vw, 6rem)",
                fontWeight: 300,
                lineHeight: 1.0,
                letterSpacing: "-0.03em",
              }}>
                El sonido<br />
                <em style={{
                  fontStyle: "italic",
                  background: "linear-gradient(135deg, #fff 30%, var(--accent) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>
                  que buscabas
                </em>
              </h1>
            </div>

            <p ref={subtitleRef} style={{
              fontSize: "17px", color: "var(--text-2)",
              lineHeight: 1.7, maxWidth: "480px",
            }}>
              Micrófonos, interfaces, monitores y más — todo lo que necesitás
              para producir, grabar y mezclar al nivel profesional.
            </p>

            <div ref={ctasRef} style={{
              display: "flex", gap: "12px", flexWrap: "wrap",
            }}>
              <Link to="/shop" className="btn btn-accent"
                style={{ fontSize: "15px", padding: "14px 28px" }}>
                Ver tienda →
              </Link>
              <Link to="/academy" className="btn btn-ghost"
                style={{ fontSize: "15px", padding: "14px 28px" }}>
                Academia
              </Link>
            </div>

            {/* Stats */}
            <div ref={statsRef} style={{
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
              gap: "24px", paddingTop: "28px",
              borderTop: "1px solid var(--border)",
            }}
              className="stats-grid"
            >
              {stats.map(({ value, suffix, label }) => (
                <div key={label}>
                  <p style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
                    lineHeight: 1, marginBottom: "4px",
                  }}>
                    <AnimatedNumber value={value} suffix={suffix} />
                  </p>
                  <p style={{
                    fontSize: "11px", color: "var(--text-3)",
                    textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Columna visual ── */}
          <div ref={heroImgRef} style={{
            position: "relative",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {heroProduct && (
              <div style={{ position: "relative", zIndex: 2 }}>
                <Link to={`/shop/${heroProduct.slug}`}>
                  <div
                    className="animate-float"
                    style={{
                      width: "340px", aspectRatio: "1",
                      borderRadius: "var(--r-2xl)", overflow: "hidden",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      boxShadow: "0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(26,255,110,0.05)",
                    }}
                  >
                    {(() => {
                      const img = heroProduct?.images?.find(i => i.is_primary)
                        || heroProduct?.images?.[0]
                      return img ? (
                        <img src={mediaUrl(img.image)} alt={heroProduct.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{
                          width: "100%", height: "100%",
                          display: "flex", alignItems: "center",
                          justifyContent: "center", fontSize: "80px",
                        }}>
                          🎧
                        </div>
                      )
                    })()}
                  </div>

                  {/* Info card glassmorphism */}
                  <div className="glass" style={{
                    position: "absolute",
                    bottom: "-16px", left: "50%",
                    transform: "translateX(-50%)",
                    borderRadius: "var(--r-xl)",
                    padding: "14px 20px",
                    minWidth: "260px", textAlign: "center",
                  }}>
                    <p style={{
                      fontSize: "14px", fontWeight: 500,
                      marginBottom: "4px",
                    }}>
                      {heroProduct.name}
                    </p>
                    <p style={{
                      fontSize: "18px", fontWeight: 600,
                      color: "var(--accent)",
                      fontFamily: "var(--font-serif)",
                    }}>
                      ${Number(heroProduct.price).toLocaleString("es-CL")}
                    </p>
                  </div>
                </Link>
              </div>
            )}

            {/* Productos secundarios flotantes */}
            {featured[1] && (
              <div style={{
                position: "absolute", top: "0", right: "-20px",
                width: "140px", zIndex: 1,
                animation: "float 5s ease-in-out infinite 1s",
                opacity: 0.9,
              }}>
                <HeroProductCard product={featured[1]} />
              </div>
            )}
            {featured[2] && (
              <div style={{
                position: "absolute", bottom: "40px", left: "-30px",
                width: "130px", zIndex: 1,
                animation: "float 6s ease-in-out infinite 0.5s",
                opacity: 0.85,
              }}>
                <HeroProductCard product={featured[2]} />
              </div>
            )}

            {/* Glow */}
            <div style={{
              position: "absolute",
              width: "400px", height: "400px", borderRadius: "50%",
              background: "radial-gradient(circle, rgba(26,255,110,0.08), transparent 70%)",
              zIndex: 0, pointerEvents: "none",
            }} />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          MARCAS
         ══════════════════════════════════════════════════════ */}
      <section style={{
        padding: "60px 0",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-2)",
      }}>
        <div ref={brandsRef} style={{
          maxWidth: "var(--container)", margin: "0 auto",
          padding: "0 clamp(20px, 5vw, 60px)",
        }}>
          <p style={{
            fontSize: "12px", color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.12em",
            fontWeight: 500, textAlign: "center", marginBottom: "28px",
          }}>
            Marcas que trabajamos
          </p>
          <BrandsMarquee brands={brands} />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          PRODUCTOS DESTACADOS
         ══════════════════════════════════════════════════════ */}
      <section style={{
        padding: "clamp(80px, 10vw, 140px) 0",
        position: "relative",
      }}
        className="section-gradient-dark"
      >
        <div style={{
          maxWidth: "var(--container)", margin: "0 auto",
          padding: "0 clamp(20px, 5vw, 60px)",
        }}>

          <div ref={featLabelRef} style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "flex-end", marginBottom: "48px",
            flexWrap: "wrap", gap: "16px",
          }}>
            <div>
              <p style={{
                fontSize: "12px", color: "var(--accent)", fontWeight: 600,
                letterSpacing: "0.08em", textTransform: "uppercase",
                marginBottom: "12px",
              }}>
                Selección
              </p>
              <h2 style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(2rem, 4vw, 3.5rem)",
                fontWeight: 300, lineHeight: 1.1,
              }}>
                Lo más destacado
              </h2>
            </div>
            <Link to="/shop" className="btn btn-ghost">Ver todo →</Link>
          </div>

          <div ref={featGridRef} style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "20px",
          }}>
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

      {/* ══════════════════════════════════════════════════════
          FEATURES — 3 columnas
         ══════════════════════════════════════════════════════ */}
      <section style={{
        padding: "clamp(80px, 10vw, 140px) 0",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-2)",
      }}>
        <div style={{
          maxWidth: "var(--container)", margin: "0 auto",
          padding: "0 clamp(20px, 5vw, 60px)",
        }}>
          <div ref={featuresRef} style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "2px",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-2xl)",
            overflow: "hidden",
          }}>
            {[
              {
                icon: "🎙",
                title: "Academia\nprofesional",
                desc: "Cursos en video para producción, mezcla, masterización y más.",
                link: "/academy", cta: "Ver cursos",
              },
              {
                icon: "🔧",
                title: "Servicios\na medida",
                desc: "Asesoría técnica, instalación y configuración de estudios.",
                link: "/services", cta: "Ver servicios",
              },
              {
                icon: "🚀",
                title: "Envíos\nrápidos",
                desc: "Despacho a todo Chile y Argentina. Envío gratis sobre $200.000.",
                link: "/shop", cta: "Ir a la tienda",
              },
            ].map(({ icon, title, desc, link, cta }, i) => (
              <Link key={i} to={link} style={{
                display: "flex", flexDirection: "column",
                padding: "clamp(32px, 4vw, 52px)",
                background: "var(--surface)",
                transition: "background var(--dur-slow) var(--ease)",
                borderRight: i < 2 ? "1px solid var(--border)" : "none",
                textDecoration: "none", gap: "20px",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)"}
                onMouseLeave={e => e.currentTarget.style.background = "var(--surface)"}
              >
                <span style={{ fontSize: "36px" }}>{icon}</span>
                <div>
                  <h3 style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
                    fontWeight: 300, lineHeight: 1.2,
                    marginBottom: "12px", whiteSpace: "pre-line",
                  }}>
                    {title}
                  </h3>
                  <p style={{
                    fontSize: "14px", color: "var(--text-3)", lineHeight: 1.7,
                  }}>
                    {desc}
                  </p>
                </div>
                <span style={{
                  fontSize: "13px", color: "var(--accent)", fontWeight: 500,
                  display: "inline-flex", alignItems: "center",
                  gap: "4px", marginTop: "auto",
                }}>
                  {cta} →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          CTA FINAL
         ══════════════════════════════════════════════════════ */}
      <section style={{
        padding: "clamp(100px, 12vw, 160px) clamp(20px, 5vw, 60px)",
        textAlign: "center", position: "relative", overflow: "hidden",
      }}
        className="section-gradient-green"
      >
        <div ref={ctaSectionRef} style={{
          maxWidth: "640px", margin: "0 auto",
          position: "relative", zIndex: 1,
        }}>
          <h2 style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(2.5rem, 6vw, 5rem)",
            fontWeight: 300, lineHeight: 1.05,
            marginBottom: "24px", letterSpacing: "-0.02em",
          }}>
            Tu próximo nivel{" "}
            <em style={{ fontStyle: "italic", color: "var(--accent)" }}>
              empieza acá
            </em>
          </h2>
          <p style={{
            fontSize: "17px", color: "var(--text-2)",
            lineHeight: 1.7, marginBottom: "40px",
          }}>
            Explorá toda nuestra tienda y encontrá el equipo que llevará
            tu sonido al siguiente nivel.
          </p>
          <div style={{
            display: "flex", gap: "12px",
            justifyContent: "center", flexWrap: "wrap",
          }}>
            <Link to="/shop" className="btn btn-accent"
              style={{ fontSize: "16px", padding: "16px 36px" }}>
              Explorar tienda
            </Link>
            <a href="https://wa.me/5492622635045"
              target="_blank" rel="noreferrer"
              className="btn btn-ghost"
              style={{ fontSize: "16px", padding: "16px 36px" }}>
              💬 Consultar
            </a>
          </div>
        </div>

        {/* Glow */}
        <div style={{
          position: "absolute", width: "600px", height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(26,255,110,0.08), transparent 70%)",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }} />
      </section>

      {/* Responsive */}
      <style>{`
        .hero-grid {
          grid-template-columns: 1fr 1fr;
        }
        .stats-grid {
          grid-template-columns: repeat(4, 1fr);
        }
        @media (max-width: 900px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
          }
          .hero-grid > div:last-child {
            display: none !important;
          }
          .stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </div>
  )
}