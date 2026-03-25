// pages/Home.jsx
// Landing page principal — Hero + productos destacados + secciones

import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getProducts } from "../api/products.api"
import ProductCard from "../components/product/ProductCard"

// ── Hero ────────────────────────────────────────────────────
function Hero() {
  return (
    <section
      className="relative overflow-hidden py-24 px-4"
      style={{
        background: "linear-gradient(135deg, var(--color-surface) 0%, var(--color-bg) 60%)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      {/* Glow decorativo */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-10 pointer-events-none"
        style={{ backgroundColor: "var(--color-accent)" }}
      />

      <div className="max-w-7xl mx-auto relative">
        <div className="max-w-2xl">

          <span
            className="inline-block text-xs font-bold tracking-widest uppercase mb-4 px-3 py-1 rounded-full"
            style={{
              color: "var(--color-accent)",
              border: "1px solid var(--color-accent)",
              backgroundColor: "rgba(0,230,118,0.05)"
            }}
          >
            Audio Profesional
          </span>

          <h1 className="text-5xl md:text-6xl font-black leading-tight mb-6">
            Suena en{" "}
            <span style={{ color: "var(--color-accent)" }}>otro nivel</span>
          </h1>

          <p
            className="text-lg mb-8 leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            Equipamiento profesional, academia online y servicios de producción
            musical. Todo en un solo lugar.
          </p>

          <div className="flex flex-wrap gap-4">
            <Link
              to="/shop"
              className="px-6 py-3 rounded-lg font-semibold text-sm transition-all hover:opacity-90"
              style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
            >
              Ver tienda
            </Link>
            <Link
              to="/academy"
              className="px-6 py-3 rounded-lg font-semibold text-sm transition-colors"
              style={{
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              Explorar academia
            </Link>
          </div>

        </div>
      </div>
    </section>
  )
}

// ── Sección de categorías ────────────────────────────────────
function CategorySection() {
  const categories = [
    { label: "Audio Pro",     emoji: "🎛️", slug: "audio-pro" },
    { label: "Micrófonos",    emoji: "🎤", slug: "microfonos" },
    { label: "Instrumentos",  emoji: "🎸", slug: "instrumentos-musicales" },
    { label: "Pedales",       emoji: "🎚️", slug: "pedales" },
    { label: "In-Ears",       emoji: "🎧", slug: "in-ears" },
    { label: "Academia",      emoji: "🎓", slug: null, to: "/academy" },
  ]

  return (
    <section className="py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold mb-8">Explorar por categoría</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {categories.map(({ label, emoji, slug, to }) => (
            <Link
              key={label}
              to={to || `/shop?category=${slug}`}
              className="flex flex-col items-center gap-2 p-4 rounded-xl text-center transition-all hover:scale-105"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <span className="text-3xl">{emoji}</span>
              <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
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
function FeaturedProducts() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["products", "featured"],
    queryFn: () => getProducts({ is_featured: true, page_size: 4 }),
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-64 rounded-xl animate-pulse"
            style={{ backgroundColor: "var(--color-surface)" }}
          />
        ))}
      </div>
    )
  }

  if (isError || !data?.results?.length) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {data.results.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}

// ── Sección SaaS / Propuesta de valor ───────────────────────
function ValueProps() {
  const props = [
    {
      icon: "🚚",
      title: "Envíos a todo Chile",
      desc: "Coordinamos tu entrega de forma rápida y segura."
    },
    {
      icon: "💳",
      title: "Múltiples medios de pago",
      desc: "Tarjetas, transferencia, efectivo. Compra como prefieras."
    },
    {
      icon: "💬",
      title: "Atención inmediata",
      desc: "Asesoramiento técnico por WhatsApp en tiempo real."
    },
    {
      icon: "🎓",
      title: "Academia online",
      desc: "Cursos de producción, mezcla, live sound y más."
    },
  ]

  return (
    <section
      className="py-16 px-4 border-t"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        {props.map(({ icon, title, desc }) => (
          <div key={title} className="flex flex-col gap-2">
            <span className="text-3xl">{icon}</span>
            <h4 className="font-semibold text-sm">{title}</h4>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Home page ───────────────────────────────────────────────
export default function Home() {
  return (
    <>
      <Hero />
      <CategorySection />

      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">Productos destacados</h2>
            <Link
              to="/shop"
              className="text-sm font-medium transition-colors"
              style={{ color: "var(--color-accent)" }}
            >
              Ver todos →
            </Link>
          </div>
          <FeaturedProducts />
        </div>
      </section>

      <ValueProps />
    </>
  )
}