// pages/BlogArticle.jsx — Artículo individual, con productos enlazados y relacionados
import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getArticle } from "../api/blog.api"
import ProductCard from "../components/product/ProductCard"
import Seo from "../components/Seo"
import JsonLd from "../components/JsonLd"
import { SITE_URL } from "../utils/seo"

export default function BlogArticle() {
  const { slug } = useParams()
  const { data: article, isLoading, isError } = useQuery({
    queryKey: ["article", slug],
    queryFn:  () => getArticle(slug),
  })

  if (isLoading) return (
    <div style={{ minHeight: "60vh", display: "grid", placeItems: "center",
      paddingTop: "120px", color: "var(--text-3)" }}>Cargando…</div>
  )
  if (isError || !article) return (
    <div style={{ minHeight: "60vh", display: "grid", placeItems: "center",
      paddingTop: "120px", color: "var(--text-3)" }}>Artículo no encontrado.</div>
  )

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "datePublished": article.published_at,
    "author": { "@type": "Organization", "name": article.author_name || "LevelPro Audio" },
    "image": article.cover_image || undefined,
    "mainEntityOfPage": `${SITE_URL}/blog/${article.slug}`,
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh",
      paddingTop: "clamp(96px, 12vw, 130px)", paddingBottom: "80px" }}>
      <Seo type="article"
        title={article.seo_title || article.title}
        description={article.seo_description || article.excerpt}
        image={article.cover_image} />
      <JsonLd data={articleSchema} />

      <article className="lp-container" style={{ maxWidth: "760px" }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap",
          fontSize: "13px", color: "var(--text-3)", marginBottom: "24px" }}>
          <Link to="/" className="hover-accent" style={{ transition: "color var(--dur)" }}>Inicio</Link>
          <span>/</span>
          <Link to="/blog" className="hover-accent" style={{ transition: "color var(--dur)" }}>Blog</Link>
          <span>/</span>
          <span style={{ color: "var(--text-2)" }}>{article.title}</span>
        </div>

        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)",
          textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {article.pillar_label}
        </span>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
          fontWeight: 800, color: "var(--text)", lineHeight: 1.15, letterSpacing: "-0.02em",
          margin: "10px 0 16px" }}>
          {article.title}
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-3)", marginBottom: "28px" }}>
          Por {article.author_name}
          {article.published_at && ` · ${new Date(article.published_at).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}`}
        </p>

        {article.cover_image && (
          <img src={article.cover_image} alt={article.title}
            style={{ width: "100%", borderRadius: "var(--r-xl)", marginBottom: "32px" }} />
        )}

        {/* Contenido rico (HTML del admin) */}
        <div className="blog-body"
          style={{ fontSize: "16px", lineHeight: 1.8, color: "var(--text-2)" }}
          dangerouslySetInnerHTML={{ __html: article.body }} />

        {/* Productos enlazados — blog → tienda */}
        {article.linked_products?.length > 0 && (
          <div style={{ marginTop: "48px", paddingTop: "32px", borderTop: "1px solid var(--border)" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)",
              textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "18px" }}>
              Productos mencionados
            </p>
            <div style={{ display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px" }}>
              {article.linked_products.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}
      </article>

      {/* Artículos relacionados */}
      {article.related_articles?.length > 0 && (
        <div className="lp-container" style={{ marginTop: "56px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)",
            textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "18px" }}>
            Seguí leyendo
          </p>
          <div style={{ display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "18px" }}>
            {article.related_articles.map(rel => (
              <Link key={rel.id} to={`/blog/${rel.slug}`}
                style={{ display: "block", padding: "18px", textDecoration: "none",
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "var(--r-xl)" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)",
                  textTransform: "uppercase" }}>{rel.pillar_label}</span>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "15px",
                  fontWeight: 700, color: "var(--text)", marginTop: "6px" }}>
                  {rel.title}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
