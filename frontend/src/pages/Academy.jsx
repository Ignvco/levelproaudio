// pages/Academy.jsx
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import api from "../api/client"

function CourseCard({ course }) {
  return (
    <div
      className="rounded-xl overflow-hidden transition-all hover:-translate-y-1"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Thumbnail */}
      <div
        className="w-full h-44 flex items-center justify-center"
        style={{ backgroundColor: "var(--color-surface-2)" }}
      >
        {course.thumbnail
          ? <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
          : <span className="text-5xl">🎓</span>
        }
      </div>

      <div className="p-5">
        <h3 className="font-bold text-base mb-2 line-clamp-2">{course.title}</h3>
        <p className="text-sm mb-4 line-clamp-2" style={{ color: "var(--color-text-muted)" }}>
          {course.description}
        </p>
        <div className="flex items-center justify-between">
          <span className="font-black text-lg" style={{ color: "var(--color-accent)" }}>
            {Number(course.price) === 0
              ? "Gratis"
              : `$${Number(course.price).toLocaleString("es-CL")}`
            }
          </span>
          <Link
            to={`/academy/${course.slug}`}
            className="text-sm font-semibold px-4 py-2 rounded-lg"
            style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
          >
            Ver curso
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function Academy() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const res = await api.get("/courses/")
      return res.data
    },
  })

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-bg)" }}>

      {/* Header */}
      <div
        className="py-16 px-4 border-b"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="max-w-7xl mx-auto">
          <span
            className="inline-block text-xs font-bold tracking-widest uppercase mb-3 px-3 py-1 rounded-full"
            style={{
              color: "var(--color-accent)",
              border: "1px solid var(--color-accent)",
              backgroundColor: "rgba(0,230,118,0.05)"
            }}
          >
            LevelPro Academy
          </span>
          <h1 className="text-4xl font-black mb-3">Aprende audio profesional</h1>
          <p className="text-lg" style={{ color: "var(--color-text-muted)" }}>
            Cursos de producción, mezcla, mastering, live sound y más.
          </p>
        </div>
      </div>

      {/* Cursos */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-72 rounded-xl animate-pulse"
                style={{ backgroundColor: "var(--color-surface)" }}
              />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-center py-20" style={{ color: "var(--color-text-muted)" }}>
            Error al cargar los cursos.
          </p>
        )}

        {!isLoading && data?.results?.length === 0 && (
          <p className="text-center py-20" style={{ color: "var(--color-text-muted)" }}>
            Próximamente nuevos cursos.
          </p>
        )}

        {!isLoading && data?.results && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.results.map(course => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}