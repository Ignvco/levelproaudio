// pages/dashboard/MyCourses.jsx
// Cursos inscritos del usuario con progreso

import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { getEnrollments } from "../../api/academy.api"

function ProgressBar({ percentage }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: "var(--color-surface-2)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${percentage}%`,
            backgroundColor: "var(--color-accent)",
          }}
        />
      </div>
      <span
        className="text-xs font-bold flex-shrink-0"
        style={{ color: "var(--color-accent)" }}
      >
        {percentage}%
      </span>
    </div>
  )
}

export default function MyCourses() {
  const { data, isLoading } = useQuery({
    queryKey: ["enrollments"],
    queryFn: getEnrollments,
  })

  const enrollments = data?.results || data || []

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black">Mis cursos</h1>
        <Link
          to="/academy"
          className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          style={{
            backgroundColor: "var(--color-accent)",
            color: "#000",
          }}
        >
          Explorar academia
        </Link>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-2xl animate-pulse"
              style={{ backgroundColor: "var(--color-surface)" }}
            />
          ))}
        </div>
      )}

      {!isLoading && enrollments.length === 0 && (
        <div
          className="rounded-2xl p-12 text-center"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <p className="text-5xl mb-4">🎓</p>
          <p className="font-bold text-lg mb-2">No estás inscrito en ningún curso</p>
          <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
            Explora nuestra academia y empieza a aprender.
          </p>
          <Link
            to="/academy"
            className="inline-block px-6 py-2.5 rounded-lg font-semibold text-sm"
            style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
          >
            Ver cursos disponibles
          </Link>
        </div>
      )}

      {!isLoading && enrollments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {enrollments.map(enrollment => (
            <Link
              key={enrollment.id}
              to={`/academy/${enrollment.course.slug}`}
              className="rounded-2xl overflow-hidden flex gap-4 p-4 transition-all hover:scale-[1.02]"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              {/* Thumbnail */}
              <div
                className="w-20 h-20 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center"
                style={{ backgroundColor: "var(--color-surface-2)" }}
              >
                {enrollment.course.thumbnail ? (
                  <img
                    src={enrollment.course.thumbnail}
                    alt={enrollment.course.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl">🎛️</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm leading-snug mb-1 line-clamp-2">
                  {enrollment.course.title}
                </p>
                <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
                  {enrollment.course.total_lessons} lecciones
                </p>
                <ProgressBar percentage={enrollment.progress_percentage} />
                <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                  {enrollment.progress_percentage === 100
                    ? "✓ Completado"
                    : enrollment.progress_percentage === 0
                    ? "Sin iniciar"
                    : "En progreso"
                  }
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}