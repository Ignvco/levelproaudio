// components/legal/LegalShell.jsx — Layout editorial premium para páginas legales
import { useState, useEffect } from "react"
import Seo from "../Seo"
import { useSiteSettings } from "../../hooks/useSiteSettings"

export default function LegalShell({ eyebrow, title, updated, intro, sections, seoDescription }) {
  const { whatsappUrl, instagramUrl, settings } = useSiteSettings()
  const [active, setActive] = useState(sections[0]?.id)

  useEffect(() => {
    const onScroll = () => {
      let current = sections[0]?.id
      for (const s of sections) {
        const el = document.getElementById(s.id)
        if (el && el.getBoundingClientRect().top <= 140) current = s.id
      }
      setActive(current)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [sections])

  return (
    <div data-testid={`legal-page-${title}`} style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Seo title={title} description={seoDescription} />

      {/* Hero */}
      <div style={{ maxWidth: "var(--container-max, 1440px)", margin: "0 auto",
        padding: "clamp(120px, 14vh, 180px) var(--container-pad, clamp(20px,4vw,64px)) clamp(32px,5vw,56px)",
        borderBottom: "1px solid var(--border)" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)",
          textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: "18px" }}>
          · {eyebrow}
        </p>
        <h1 className="display-bold" style={{ fontFamily: "var(--font-display)",
          fontSize: "clamp(2.4rem, 5vw, 4rem)", fontWeight: 800, letterSpacing: "-0.03em",
          lineHeight: 1.02, color: "var(--text)", maxWidth: "16ch" }}>
          {title}
        </h1>
        {updated && (
          <p style={{ fontSize: "13px", color: "var(--text-3)", marginTop: "22px" }}>
            Última actualización: {updated}
          </p>
        )}
      </div>

      {/* Body: TOC sticky + contenido */}
      <div className="legal-grid" style={{ maxWidth: "var(--container-max, 1440px)", margin: "0 auto",
        padding: "clamp(40px,6vw,72px) var(--container-pad, clamp(20px,4vw,64px)) clamp(80px,10vw,140px)",
        display: "grid", gridTemplateColumns: "260px 1fr", gap: "clamp(40px,6vw,80px)",
        alignItems: "start" }}>

        {/* Índice */}
        <nav className="legal-toc" style={{ position: "sticky", top: "120px",
          display: "flex", flexDirection: "column", gap: "4px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "12px" }}>
            En esta página
          </p>
          {sections.map((s, i) => (
            <a key={s.id} href={`#${s.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })
              }}
              style={{ fontSize: "13.5px", lineHeight: 1.4, textDecoration: "none",
                padding: "7px 12px", borderRadius: "10px",
                borderLeft: `2px solid ${active === s.id ? "var(--accent)" : "transparent"}`,
                color: active === s.id ? "var(--text)" : "var(--text-3)",
                background: active === s.id ? "rgba(26,255,110,0.06)" : "transparent",
                transition: "color 150ms, background 150ms, border-color 150ms" }}>
              {i + 1}. {s.title}
            </a>
          ))}
        </nav>

        {/* Contenido */}
        <div style={{ maxWidth: "760px" }}>
          {intro && (
            <p style={{ fontSize: "17px", lineHeight: 1.75, color: "var(--text-2)",
              marginBottom: "48px", paddingBottom: "40px", borderBottom: "1px solid var(--border)" }}>
              {intro}
            </p>
          )}
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} style={{ scrollMarginTop: "120px", marginBottom: "44px" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.3rem,2.4vw,1.6rem)",
                fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)", marginBottom: "18px",
                display: "flex", alignItems: "baseline", gap: "12px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--accent)",
                  fontFamily: "var(--font-sans)" }}>{String(i + 1).padStart(2, "0")}</span>
                {s.title}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {s.body.map((p, j) =>
                  typeof p === "string" ? (
                    <p key={j} style={{ fontSize: "15px", lineHeight: 1.8, color: "var(--text-2)" }}>{p}</p>
                  ) : (
                    <ul key={j} style={{ display: "flex", flexDirection: "column", gap: "10px",
                      paddingLeft: "4px", listStyle: "none" }}>
                      {p.map((li, k) => (
                        <li key={k} style={{ fontSize: "15px", lineHeight: 1.7, color: "var(--text-2)",
                          display: "flex", gap: "12px" }}>
                          <span style={{ color: "var(--accent)", flexShrink: 0, marginTop: "2px" }}>—</span>
                          <span>{li}</span>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            </section>
          ))}

          <div style={{ marginTop: "56px", padding: "24px 26px", borderRadius: "18px",
            background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
            <p style={{ fontSize: "13.5px", lineHeight: 1.7, color: "var(--text-3)" }}>
              ¿Tenés dudas sobre este documento? Escribinos por WhatsApp al{" "}
              <a href={whatsappUrl} target="_blank" rel="noreferrer"
                style={{ color: "var(--accent)", textDecoration: "none" }}>+54 9 2622 63-5045</a>{" "}
              o a través de nuestro Instagram{" "}
              <a href={instagramUrl} target="_blank" rel="noreferrer"
                style={{ color: "var(--accent)", textDecoration: "none" }}>@{settings?.contact_instagram || "levelproar"}</a>.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .legal-grid { grid-template-columns: 1fr !important; }
          .legal-toc { display: none !important; }
        }
      `}</style>
    </div>
  )
}
