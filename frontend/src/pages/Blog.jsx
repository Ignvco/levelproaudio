// pages/Blog.jsx — Índice del blog, filtrable por pilar de contenido
import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getArticles } from "../api/blog.api"
import Seo from "../components/Seo"

const PILLARS = [
  { value: "",          label: "Todos"            },
  { value: "education", label: "Educación"        },
  { value: "problems",  label: "Problemas reales" },
  { value: "brand",     label: "Detrás de escena" },
  { value: "products",  label: "Productos"        },
]

function ArticleCard({ article }) {
  return (
    <Link to={`/blog/${article.slug}`}
      style={{ display: "flex", flexDirection: "column", textDecoration: "none",
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)", overflow: "hidden",
        transition: "border-color 200ms var(--ease)" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
      {article.cover_image && (
        <div style={{ aspectRatio: "16/9", overflow: "hidden", background: "var(--surface-3)" }}>
          <img src={article.cover_image} alt={article.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)",
          textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {article.pillar_label}
        </span>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "17px",
          fontWeight: 800, color: "var(--text)", lineHeight: 1.3 }}>
          {article.title}
        </p>
        {article.excerpt && (
          <p style={{ fontSize: "13.5px", color: "var(--text-3)", lineHeight: 1.5 }}>
            {article.excerpt}
          </p>
        )}
      </div>
    </Link>
  )
}

export default function Blog() {
  const [pillar, setPillar] = useState("")
  const { data, isLoading } = useQuery({
    queryKey: ["articles", { pillar }],
    queryFn:  () => getArticles({ pillar: pillar || undefined }),
  })
  const articles = data?.results || data || []

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh",
      paddingTop: "clamp(96px, 12vw, 130px)", paddingBottom: "80px" }}>
      <Seo title="Blog · LevelPro Audio"
        description="Guías, consejos técnicos y contenido sobre audio profesional, sonido en vivo y equipamiento." />

      <div className="lp-container">
        <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)",
          textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>
          Blog
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
          fontWeight: 800, color: "var(--text)", marginBottom: "24px", letterSpacing: "-0.02em" }}>
          Aprendé sobre audio profesional
        </h1>

        {/* Filtros por pilar */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "32px" }}>
          {PILLARS.map(p => (
            <button key={p.value} onClick={() => setPillar(p.value)}
              style={{ padding: "8px 16px", borderRadius: "var(--r-full)",
                border: "1px solid var(--border)", cursor: "pointer", fontSize: "13px",
                background: pillar === p.value ? "var(--accent)" : "transparent",
                color: pillar === p.value ? "#000" : "var(--text-2)",
                fontWeight: pillar === p.value ? 700 : 400,
                transition: "all 160ms var(--ease)" }}>
              {p.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p style={{ color: "var(--text-3)" }}>Cargando…</p>
        ) : articles.length === 0 ? (
          <p style={{ color: "var(--text-3)", padding: "40px 0" }}>
            Todavía no hay artículos {pillar ? "en esta categoría" : "publicados"}.
          </p>
        ) : (
          <div style={{ display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
            {articles.map(a => <ArticleCard key={a.id} article={a} />)}
          </div>
        )}
      </div>
    </div>
  )
}
