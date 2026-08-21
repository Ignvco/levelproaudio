// pages/Academy.jsx
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getCourses, getCertifications, downloadCertificationSeal } from "../api/academy.api"
import { useScrollReveal } from "../hooks/useScrollReveal"
import CourseCard from "../components/academy/CourseCard"
import Seo from "../components/Seo"
import { showToast } from "../components/ui/ToastNotification"
import { useAuthStore } from "../store/authStore"

export default function Academy() {
  const [level, setLevel] = useState("")
  const headerRef = useScrollReveal()

  const { data, isLoading } = useQuery({
    queryKey: ["courses", { level }],
    queryFn:  () => getCourses({ level: level || undefined }),
  })
  const courses = data?.results || data || []

  const { data: certData } = useQuery({
    queryKey: ["certifications"],
    queryFn:  getCertifications,
  })
  const certifications = certData?.results || certData || []

  const LEVELS = [
    { value: "",             label: "Todos"         },
    { value: "beginner",     label: "Principiante"  },
    { value: "intermediate", label: "Intermedio"    },
    { value: "advanced",     label: "Avanzado"      },
  ]

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", position: "relative" }}>
      {/* Capa de gradiente atmosférico fija — para el efecto vidrio esmerilado
          de las CourseCards (folder-card con backdrop-filter). */}
      <div aria-hidden style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: `
          radial-gradient(circle at 18% 25%, rgba(26,255,110,0.07) 0%, transparent 38%),
          radial-gradient(circle at 82% 65%, rgba(70,90,140,0.10) 0%, transparent 42%),
          radial-gradient(circle at 50% 90%, rgba(26,255,110,0.04) 0%, transparent 40%)
        `,
      }} />
      <div style={{ position: "relative", zIndex: 1 }}>
      <Seo title="Academia" description="Cursos técnicos de audio en video con instructores del oficio: producción, mezcla, masterización y más. Certificaciones LevelPro." />

      {/* Header */}
      <div ref={headerRef} style={{
        padding: "clamp(60px, 9vw, 100px) 0 clamp(40px, 6vw, 64px)",
        position: "relative",
      }}>
        <div className="lp-container">
          <p style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 600,
            letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "16px",
            display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%",
              background: "var(--accent)",
              boxShadow: "0 0 12px var(--accent)" }} />
            Academia
          </p>
          <h1 className="display-bold" style={{
            fontFamily:    "var(--font-display)",
            fontSize:      "clamp(2.6rem, 5.8vw, 4.5rem)",
            fontWeight:    700,
            lineHeight:    1,
            letterSpacing: "-0.045em",
            marginBottom:  "24px",
            color: "var(--text)",
          }}>
            Aprendé a{" "}
            <span style={{ fontStyle: "italic", fontWeight: 500,
              color: "var(--accent)" }}>
              producir.
            </span>
          </h1>
          <p style={{ fontSize: "17px", color: "var(--text-2)", maxWidth: "540px",
            marginBottom: "36px", lineHeight: 1.55, fontWeight: 400 }}>
            Cursos online de producción musical, mezcla, masterización y más.
            Para todos los niveles.
          </p>

          {/* Filtros */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {LEVELS.map(({ value, label }) => (
              <button key={value}
                onClick={() => setLevel(value)}
                style={{
                  padding:      "8px 18px",
                  borderRadius: "var(--r-full)",
                  fontSize:     "13px", fontWeight: 500,
                  cursor:       "pointer",
                  background:   level === value ? "var(--text)" : "transparent",
                  color:        level === value ? "var(--bg)" : "var(--text-2)",
                  border:       level === value ? "1px solid var(--text)" : "1px solid var(--border)",
                  transition:   "all var(--dur) var(--ease)",
                  fontFamily:   "var(--font-sans)",
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Certificaciones profesionales */}
      {certifications.length > 0 && (
        <div className="lp-container" style={{ paddingTop: "clamp(24px, 3vw, 40px)" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)",
            textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>
            Certificación Profesional
          </p>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.3rem, 2.4vw, 1.9rem)",
            fontWeight: 800, color: "var(--text)", marginBottom: "18px" }}>
            Convertite en Profesional Certificado LevelPro
          </h2>
          <div style={{ display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
            {certifications.map(cert => (
              <CertificationCard key={cert.id} cert={cert} />
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="lp-container" style={{ paddingBlock: "clamp(32px, 4vw, 48px)" }}>

        {isLoading ? (
          <div className="academy-grid" style={{ display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "360px" }} />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0",
            color: "var(--text-3)", fontSize: "15px" }}>
            No hay cursos disponibles todavía.
          </div>
        ) : (
          <div className="academy-grid" style={{ display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
            {courses.map((course, i) => (
              <CourseCard key={course.id} course={course} index={i} />
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

function CertificationCard({ cert }) {
  const { isAuthenticated } = useAuthStore()
  const pct = cert.total > 0 ? Math.round((cert.completed / cert.total) * 100) : 0

  const handleDownload = async () => {
    try {
      const resp = await downloadCertificationSeal(cert.slug)
      const url  = window.URL.createObjectURL(new Blob([resp.data]))
      const a    = document.createElement("a")
      a.href = url
      a.setAttribute("download", `certificacion-${cert.slug}.pdf`)
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      showToast("No se pudo descargar la certificación.", "error")
    }
  }

  return (
    <div style={{ padding: "22px", borderRadius: "var(--r-xl)",
      background: "var(--surface)", border: "1px solid var(--border)",
      display: "flex", flexDirection: "column", gap: "14px" }}>
      <div>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "16px",
          fontWeight: 800, color: "var(--text)", marginBottom: "4px" }}>
          {cert.title}
        </p>
        {cert.description && (
          <p style={{ fontSize: "13px", color: "var(--text-3)", lineHeight: 1.5 }}>
            {cert.description}
          </p>
        )}
      </div>

      <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
        {cert.courses?.length || cert.total} cursos ·{" "}
        {cert.courses?.map(c => c.title).join(" · ")}
      </p>

      {/* Progreso */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between",
          fontSize: "12px", color: "var(--text-2)", marginBottom: "6px" }}>
          <span>{isAuthenticated ? `${cert.completed}/${cert.total} completados` : "Iniciá sesión para ver tu progreso"}</span>
          {isAuthenticated && <span>{pct}%</span>}
        </div>
        <div style={{ height: "6px", borderRadius: "9999px", background: "var(--surface-3)",
          overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)",
            transition: "width 400ms var(--ease)" }} />
        </div>
      </div>

      {cert.is_completed ? (
        <button onClick={handleDownload}
          style={{ padding: "11px", borderRadius: "var(--r-full)", border: "none",
            background: "var(--accent)", color: "#000", fontWeight: 700, fontSize: "13px",
            cursor: "pointer" }}>
          Descargar mi certificación
        </button>
      ) : (
        <div style={{ padding: "11px", borderRadius: "var(--r-full)",
          border: "1px solid var(--border)", background: "transparent",
          color: "var(--text-3)", fontSize: "13px", textAlign: "center" }}>
          {isAuthenticated ? "Completá todos los cursos para obtenerla" : "Sello al completar la ruta"}
        </div>
      )}
    </div>
  )
}
