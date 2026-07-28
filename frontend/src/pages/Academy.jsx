// pages/Academy.jsx
import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getCourses } from "../api/academy.api"
import { useScrollReveal } from "../hooks/useScrollReveal"
import { mediaUrl } from "../utils/mediaUrl"

function CourseCard({ course, index }) {
  const ref = useScrollReveal({ delay: index * 80 })

  const LEVELS = {
    beginner:     { label: "Principiante", color: "#4ade80" },
    intermediate: { label: "Intermedio",   color: "#facc15" },
    advanced:     { label: "Avanzado",     color: "#f87171" },
  }
  const level = LEVELS[course.level] || { label: course.level, color: "#888" }

  return (
    <Link ref={ref} to={`/academy/${course.slug}`} style={{
      display:      "flex",
      flexDirection:"column",
      background:   "var(--surface)",
      border:       "1px solid var(--border)",
      borderRadius: "var(--r-xl)",
      overflow:     "hidden",
      textDecoration:"none",
      transition:   "all var(--dur-slow) var(--ease)",
    }}
      className="card card-glow"
    >
      {/* Thumbnail */}
      <div style={{ aspectRatio: "16/9", overflow: "hidden",
        background: "var(--surface-2)", position: "relative" }}>
        {course.thumbnail ? (
          <img src={mediaUrl(course.thumbnail)} alt={course.title}
            style={{ width: "100%", height: "100%", objectFit: "cover",
              transition: "transform 600ms var(--ease)" }}
            onMouseEnter={e => e.target.style.transform = "scale(1.05)"}
            onMouseLeave={e => e.target.style.transform = "scale(1)"}
          />
        ) : (
          <div style={{ width: "100%", height: "100%",
            display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "40px" }}>
            🎬
          </div>
        )}

        {/* Badges */}
        <div style={{ position: "absolute", top: "12px", left: "12px",
          display: "flex", gap: "6px" }}>
          <span style={{
            background: level.color, color: "#000",
            fontSize: "10px", fontWeight: 700,
            padding: "3px 8px", borderRadius: "var(--r-full)",
          }}>
            {level.label}
          </span>
          {course.is_free && (
            <span style={{
              background: "var(--accent)", color: "#000",
              fontSize: "10px", fontWeight: 700,
              padding: "3px 8px", borderRadius: "var(--r-full)",
            }}>
              GRATIS
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: "20px", flex: 1,
        display: "flex", flexDirection: "column", gap: "10px" }}>
        <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.2rem",
          fontWeight: 300, lineHeight: 1.3, color: "var(--text)" }}>
          {course.title}
        </h3>
        {course.short_description && (
          <p style={{ fontSize: "13px", color: "var(--text-3)",
            lineHeight: 1.6, overflow: "hidden",
            display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" }}>
            {course.short_description}
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", marginTop: "auto", paddingTop: "12px",
          borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: "14px", fontSize: "12px",
            color: "var(--text-3)" }}>
            <span>📹 {course.total_lessons || 0} lecciones</span>
            {course.total_duration > 0 && (
              <span>⏱ {course.total_duration} min</span>
            )}
          </div>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.2rem",
            color: course.is_free ? "var(--accent)" : "var(--text)" }}>
            {course.is_free ? "Gratis" : `$${Number(course.price).toLocaleString("es-CL")}`}
          </p>
        </div>
      </div>
    </Link>
  )
}

export default function Academy() {
  const [level, setLevel] = useState("")
  const headerRef = useScrollReveal()

  const { data, isLoading } = useQuery({
    queryKey: ["courses", { level }],
    queryFn:  () => getCourses({ level: level || undefined }),
  })
  const courses = data?.results || data || []

  const LEVELS = [
    { value: "",             label: "Todos"         },
    { value: "beginner",     label: "Principiante"  },
    { value: "intermediate", label: "Intermedio"    },
    { value: "advanced",     label: "Avanzado"      },
  ]

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>

      {/* Header */}
      <div ref={headerRef} style={{
        padding: "clamp(60px, 9vw, 100px) clamp(20px, 5vw, 60px) clamp(40px, 6vw, 64px)",
        position: "relative",
      }}>
        <div style={{ maxWidth: "var(--container)", margin: "0 auto" }}>
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

      {/* Grid */}
      <div style={{ maxWidth: "var(--container)", margin: "0 auto",
        padding: "clamp(32px, 4vw, 48px) clamp(20px, 5vw, 60px)" }}>

        {isLoading ? (
          <div style={{ display: "grid",
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
          <div style={{ display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
            {courses.map((course, i) => (
              <CourseCard key={course.id} course={course} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}