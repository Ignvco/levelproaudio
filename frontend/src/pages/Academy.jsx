// pages/Academy.jsx
// Catálogo de cursos de la academia

import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getCourses } from "../api/academy.api"

// ── Level badge ──────────────────────────────────────────────
const levelConfig = {
  beginner:     { label: "Principiante", color: "#00e676" },
  intermediate: { label: "Intermedio",   color: "#f59e0b" },
  advanced:     { label: "Avanzado",     color: "#ff4444" },
}

function LevelBadge({ level }) {
  const config = levelConfig[level] || { label: level, color: "#888" }
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{
        color: config.color,
        backgroundColor: `${config.color}18`,
      }}
    >
      {config.label}
    </span>
  )
}

// ── Course Card ──────────────────────────────────────────────
function CourseCard({ course }) {
  return (
    <Link
      to={`/academy/${course.slug}`}
      className="group rounded-2xl overflow-hidden flex flex-col transition-all hover:-translate-y-1"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Thumbnail */}
      <div
        className="relative w-full aspect-video overflow-hidden"
        style={{ backgroundColor: "var(--color-surface-2)" }}
      >
        {course.thumbnail ? (
          <img
            src={course.thumbnail}
            alt={course.title}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-5xl">🎛️</span>
          </div>
        )}

        {/* Free badge */}
        {course.is_free && (
          <span
            className="absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
          >
            GRATIS
          </span>
        )}

        {/* Enrolled badge */}
        {course.is_enrolled && (
          <span
            className="absolute top-3 right-3 text-xs font-bold px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: "rgba(0,0,0,0.7)",
              color: "var(--color-accent)",
              border: "1px solid var(--color-accent)"
            }}
          >
            ✓ Inscrito
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 p-5">
        <div className="flex items-center gap-2 mb-3">
          <LevelBadge level={course.level} />
          {course.total_lessons > 0 && (
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {course.total_lessons} lecciones
            </span>
          )}
          {course.total_duration > 0 && (
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              · {course.total_duration}min
            </span>
          )}
        </div>

        <h3 className="font-bold text-base leading-snug mb-2 flex-1">
          {course.title}
        </h3>

        {course.short_description && (
          <p
            className="text-sm leading-relaxed line-clamp-2 mb-4"
            style={{ color: "var(--color-text-muted)" }}
          >
            {course.short_description}
          </p>
        )}

        <div className="flex items-center justify-between mt-auto pt-3"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <span
            className="font-black text-lg"
            style={{ color: course.is_free ? "var(--color-accent)" : "var(--color-text)" }}
          >
            {course.is_free ? "Gratis" : `$${Number(course.price).toLocaleString("es-CL")}`}
          </span>
          <span
            className="text-xs font-semibold"
            style={{ color: "var(--color-accent)" }}
          >
            Ver curso →
          </span>
        </div>
      </div>
    </Link>
  )
}

// ── Academy page ─────────────────────────────────────────────
export default function Academy() {
  const [level, setLevel] = useState("")
  const [onlyFree, setOnlyFree] = useState(false)

  const params = {
    ...(level && { level }),
    ...(onlyFree && { is_free: true }),
  }

  const { data, isLoading } = useQuery({
    queryKey: ["courses", params],
    queryFn: () => getCourses(params),
  })

  const courses = data?.results || data || []

  const levels = [
    { value: "",             label: "Todos" },
    { value: "beginner",     label: "Principiante" },
    { value: "intermediate", label: "Intermedio" },
    { value: "advanced",     label: "Avanzado" },
  ]

  return (
    <div style={{ backgroundColor: "var(--color-bg)" }}>

      {/* Hero */}
      <div
        className="py-16 px-4 border-b"
        style={{
          background: "linear-gradient(135deg, var(--color-surface) 0%, var(--color-bg) 70%)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="max-w-7xl mx-auto">
          <span
            className="inline-block text-xs font-bold tracking-widest uppercase mb-4 px-3 py-1 rounded-full"
            style={{
              color: "var(--color-accent)",
              border: "1px solid var(--color-accent)",
              backgroundColor: "rgba(0,230,118,0.05)",
            }}
          >
            LevelPro Audio Academy
          </span>
          <h1 className="text-4xl md:text-5xl font-black mb-4">
            Aprende a sonar<br />
            <span style={{ color: "var(--color-accent)" }}>profesional</span>
          </h1>
          <p className="text-lg max-w-xl" style={{ color: "var(--color-text-muted)" }}>
            Cursos de producción musical, mezcla, mastering, live sound y más.
            Aprende a tu ritmo con instructores de la industria.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div
        className="sticky top-16 z-40 px-4 py-3 border-b"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
          {/* Nivel */}
          <div className="flex gap-2">
            {levels.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setLevel(value)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: level === value
                    ? "var(--color-accent)"
                    : "var(--color-surface-2)",
                  color: level === value ? "#000" : "var(--color-text-muted)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Solo gratis */}
          <button
            onClick={() => setOnlyFree(!onlyFree)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: onlyFree ? "rgba(0,230,118,0.15)" : "var(--color-surface-2)",
              color: onlyFree ? "var(--color-accent)" : "var(--color-text-muted)",
              border: `1px solid ${onlyFree ? "var(--color-accent)" : "var(--color-border)"}`,
            }}
          >
            Solo gratis
          </button>

          <span className="text-sm ml-auto" style={{ color: "var(--color-text-muted)" }}>
            {courses.length} curso{courses.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Grilla */}
      <div className="max-w-7xl mx-auto px-4 py-10">
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl overflow-hidden animate-pulse"
                style={{ backgroundColor: "var(--color-surface)", height: 360 }}
              />
            ))}
          </div>
        )}

        {!isLoading && courses.length === 0 && (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🎓</p>
            <p className="font-bold text-lg mb-2">No hay cursos disponibles</p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Intenta con otros filtros.
            </p>
          </div>
        )}

        {!isLoading && courses.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map(course => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}