// pages/Academy.jsx

import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getCourses } from "../api/academy.api"
import fondoImg from "../assets/fondo.png"

const levelConfig = {
  beginner:     { label: "Principiante", color: "#4ade80" },
  intermediate: { label: "Intermedio",   color: "#facc15" },
  advanced:     { label: "Avanzado",     color: "#f87171" },
}

function CourseCard({ course }) {
  const level = levelConfig[course.level] || { label: course.level, color: "var(--text-3)" }

  return (
    <Link to={`/academy/${course.slug}`} className="card"
      style={{ display: "flex", flexDirection: "column", position: "relative" }}
    >
      {/* Thumbnail */}
      <div style={{
        width: "100%",
        aspectRatio: "16/9",
        background: "var(--surface-2)",
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
      }}>
        {course.thumbnail ? (
          <img src={course.thumbnail} alt={course.title}
            style={{ width: "100%", height: "100%", objectFit: "cover",
              transition: "transform 400ms var(--ease)" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex",
            alignItems: "center", justifyContent: "center", fontSize: "40px" }}>
            🎛️
          </div>
        )}

        {/* Badges */}
        <div style={{ position: "absolute", top: "12px", left: "12px", display: "flex", gap: "6px" }}>
          {course.is_free && (
            <span style={{ padding: "3px 10px", borderRadius: "100px",
              background: "var(--accent)", color: "#000", fontSize: "11px", fontWeight: 600 }}>
              Gratis
            </span>
          )}
          {course.is_enrolled && (
            <span style={{ padding: "3px 10px", borderRadius: "100px",
              background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
              color: "var(--accent)", fontSize: "11px", fontWeight: 500,
              border: "1px solid rgba(26,255,110,0.25)" }}>
              ✓ Inscrito
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: "20px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <span style={{ fontSize: "11px", fontWeight: 500, color: level.color,
            padding: "2px 8px", borderRadius: "100px",
            background: `${level.color}14`, border: `1px solid ${level.color}30` }}>
            {level.label}
          </span>
          {course.total_lessons > 0 && (
            <span style={{ fontSize: "11px", color: "var(--text-3)" }}>
              {course.total_lessons} lecciones
            </span>
          )}
          {course.total_duration > 0 && (
            <span style={{ fontSize: "11px", color: "var(--text-3)" }}>
              · {course.total_duration}min
            </span>
          )}
        </div>

        <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.15rem",
          lineHeight: 1.25, marginBottom: "8px", flex: 1 }}>
          {course.title}
        </h3>

        {course.short_description && (
          <p style={{ fontSize: "13px", color: "var(--text-2)", lineHeight: 1.6,
            marginBottom: "16px", display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {course.short_description}
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", paddingTop: "16px",
          borderTop: "1px solid var(--border)" }}>
          <span style={{ fontSize: "16px", fontWeight: 500,
            color: course.is_free ? "var(--accent)" : "var(--text)" }}>
            {course.is_free ? "Gratis" : `$${Number(course.price).toLocaleString("es-CL")}`}
          </span>
          <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
            Ver curso →
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function Academy() {
  const [level, setLevel]       = useState("")
  const [onlyFree, setOnlyFree] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["courses", { level, onlyFree }],
    queryFn:  () => getCourses({ ...(level && { level }), ...(onlyFree && { is_free: true }) }),
  })

  const courses = data?.results || data || []

  const levels = [
    { value: "", label: "Todos" },
    { value: "beginner", label: "Principiante" },
    { value: "intermediate", label: "Intermedio" },
    { value: "advanced", label: "Avanzado" },
  ]

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>

      {/* Hero */}
      <div style={{
        position: "relative",
        padding: "clamp(64px, 10vw, 120px) 0 0",
        borderBottom: "1px solid var(--border)",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${fondoImg})`,
          backgroundSize: "cover", opacity: 0.05,
        }} />
        <div style={{
          position: "absolute", top: "-100px", right: "-100px",
          width: "500px", height: "500px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(26,255,110,0.06) 0%, transparent 60%)",
        }} />
        <div className="container" style={{ maxWidth: "var(--container)", position: "relative", zIndex: 1 }}>
          <span className="pill pill-accent" style={{ marginBottom: "24px", display: "inline-flex" }}>
            LevelPro Audio Academy
          </span>
          <h1 style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(2.8rem, 6vw, 5rem)",
            lineHeight: 1.06, marginBottom: "20px",
          }}>
            Aprende a sonar{" "}
            <em style={{ fontStyle: "italic", color: "var(--accent)" }}>profesional.</em>
          </h1>
          <p style={{ fontSize: "17px", color: "var(--text-2)", maxWidth: "500px",
            lineHeight: 1.7, marginBottom: "48px" }}>
            Producción musical, mezcla, mastering, live sound y sonido para iglesias.
          </p>

          {/* Filtros */}
          <div style={{ display: "flex", gap: "8px", paddingBottom: "32px", flexWrap: "wrap", alignItems: "center" }}>
            {levels.map(({ value, label }) => (
              <button key={value} onClick={() => setLevel(value)}
                style={{
                  padding: "7px 16px", borderRadius: "100px", fontSize: "13px",
                  fontWeight: 400, cursor: "pointer", transition: "all var(--dur) var(--ease)",
                  background: level === value ? "var(--text)" : "transparent",
                  color: level === value ? "var(--bg)" : "var(--text-2)",
                  border: `1px solid ${level === value ? "var(--text)" : "var(--border)"}`,
                }}>
                {label}
              </button>
            ))}
            <div style={{ width: "1px", height: "20px", background: "var(--border)", margin: "0 4px" }} />
            <button onClick={() => setOnlyFree(!onlyFree)}
              style={{
                padding: "7px 16px", borderRadius: "100px", fontSize: "13px",
                fontWeight: 400, cursor: "pointer", transition: "all var(--dur) var(--ease)",
                background: onlyFree ? "var(--accent-glow)" : "transparent",
                color: onlyFree ? "var(--accent)" : "var(--text-2)",
                border: `1px solid ${onlyFree ? "rgba(26,255,110,0.3)" : "var(--border)"}`,
              }}>
              Solo gratis
            </button>
            <span style={{ marginLeft: "auto", fontSize: "13px", color: "var(--text-3)" }}>
              {courses.length} curso{courses.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="container" style={{ maxWidth: "var(--container)", padding: "48px clamp(20px, 5vw, 60px)" }}>
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "360px" }} />
            ))}
          </div>
        )}
        {!isLoading && courses.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <p style={{ fontSize: "40px", marginBottom: "16px" }}>🎛️</p>
            <p style={{ color: "var(--text-3)", fontSize: "15px" }}>No hay cursos disponibles con estos filtros.</p>
          </div>
        )}
        {!isLoading && courses.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map(c => <CourseCard key={c.id} course={c} />)}
          </div>
        )}
      </div>
    </div>
  )
}