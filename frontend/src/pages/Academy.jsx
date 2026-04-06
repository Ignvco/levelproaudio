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
        padding: "clamp(80px, 10vw, 140px) clamp(20px, 5vw, 60px) clamp(60px, 8vw, 100px)",
        textAlign: "center",
        borderBottom: "1px solid var(--border)",
        background: `radial-gradient(ellipse 70% 50% at 50% 0%,
          rgba(26,255,110,0.06) 0%, transparent 70%)`,
        position: "relative",
      }}>
        <p style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 600,
          letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "16px" }}>
          Academia
        </p>
        <h1 style={{
          fontFamily:    "var(--font-serif)",
          fontSize:      "clamp(2.5rem, 7vw, 6rem)",
          fontWeight:    300,
          lineHeight:    1.05,
          letterSpacing: "-0.03em",
          marginBottom:  "20px",
        }}>
          Aprendé a{" "}
          <em style={{ fontStyle: "italic", color: "var(--accent)" }}>
            producir
          </em>
        </h1>
        <p style={{ fontSize: "17px", color: "var(--text-2)", maxWidth: "520px",
          margin: "0 auto 36px", lineHeight: 1.7 }}>
          Cursos online de producción musical, mezcla, masterización y más.
          Para todos los niveles.
        </p>

        {/* Filtros */}
        <div style={{ display: "flex", gap: "8px",
          justifyContent: "center", flexWrap: "wrap" }}>
          {LEVELS.map(({ value, label }) => (
            <button key={value}
              onClick={() => setLevel(value)}
              style={{
                padding:      "8px 20px",
                borderRadius: "var(--r-full)",
                fontSize:     "13px",
                cursor:       "pointer",
                background:   level === value ? "var(--text)" : "transparent",
                color:        level === value ? "var(--bg)" : "var(--text-3)",
                border:       level === value ? "1px solid var(--text)" : "1px solid var(--border)",
                transition:   "all var(--dur) var(--ease)",
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ maxWidth: "var(--container)", margin: "0 auto",
        padding: "clamp(48px, 6vw, 80px) clamp(20px, 5vw, 60px)" }}>

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