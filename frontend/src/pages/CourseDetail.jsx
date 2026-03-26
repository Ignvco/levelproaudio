// pages/CourseDetail.jsx
// Página de detalle de curso con módulos, lecciones y reproductor

import { useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getCourse, enrollCourse, unenrollCourse } from "../api/academy.api"
import { useAuthStore } from "../store/authStore"

// ── Level badge ──────────────────────────────────────────────
const levelConfig = {
  beginner:     { label: "Principiante", color: "#00e676" },
  intermediate: { label: "Intermedio",   color: "#f59e0b" },
  advanced:     { label: "Avanzado",     color: "#ff4444" },
}

// ── Video Player ─────────────────────────────────────────────
function VideoPlayer({ url, title }) {
  // Convierte URL de YouTube a embed
  const getEmbedUrl = (url) => {
    if (!url) return null
    const match = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/
    )
    return match ? `https://www.youtube.com/embed/${match[1]}` : url
  }

  const embedUrl = getEmbedUrl(url)
  if (!embedUrl) return null

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden"
      style={{ backgroundColor: "#000" }}
    >
      <iframe
        src={embedUrl}
        title={title}
        className="absolute inset-0 w-full h-full"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}

// ── Lesson Item ──────────────────────────────────────────────
function LessonItem({ lesson, isActive, isCompleted, onSelect }) {
  return (
    <button
      onClick={() => !lesson.is_locked && onSelect(lesson)}
      disabled={lesson.is_locked}
      className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
      style={{
        backgroundColor: isActive
          ? "rgba(0,230,118,0.1)"
          : "transparent",
        border: isActive
          ? "1px solid var(--color-accent)"
          : "1px solid transparent",
        opacity: lesson.is_locked ? 0.5 : 1,
        cursor: lesson.is_locked ? "not-allowed" : "pointer",
      }}
    >
      {/* Ícono estado */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
        style={{
          backgroundColor: isCompleted
            ? "var(--color-accent)"
            : isActive
            ? "rgba(0,230,118,0.2)"
            : "var(--color-surface-2)",
          color: isCompleted ? "#000" : "var(--color-text-muted)",
        }}
      >
        {lesson.is_locked ? "🔒" : isCompleted ? "✓" : "▶"}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{
            color: isActive ? "var(--color-accent)" : "var(--color-text)"
          }}
        >
          {lesson.title}
        </p>
        {lesson.duration_minutes > 0 && (
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            {lesson.duration_minutes} min
          </p>
        )}
      </div>

      {lesson.is_free && !lesson.is_locked && (
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
          style={{
            color: "var(--color-accent)",
            backgroundColor: "rgba(0,230,118,0.1)",
          }}
        >
          FREE
        </span>
      )}
    </button>
  )
}

// ── Progress Bar ─────────────────────────────────────────────
function ProgressBar({ percentage }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex-1 h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: "var(--color-surface-2)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percentage}%`,
            backgroundColor: "var(--color-accent)",
          }}
        />
      </div>
      <span
        className="text-sm font-bold flex-shrink-0"
        style={{ color: "var(--color-accent)" }}
      >
        {percentage}%
      </span>
    </div>
  )
}

// ── CourseDetail page ────────────────────────────────────────
export default function CourseDetail() {
  const { slug } = useParams()
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [activeLesson, setActiveLesson] = useState(null)
  const [completedIds, setCompletedIds] = useState(new Set())

  const { data: course, isLoading, isError } = useQuery({
    queryKey: ["course", slug],
    queryFn: () => getCourse(slug),
    onSuccess: (data) => {
      // Activa la primera lección disponible por defecto
      const firstLesson = data.modules?.[0]?.lessons?.[0]
      if (firstLesson && !firstLesson.is_locked) {
        setActiveLesson(firstLesson)
      }
    },
  })

  const enrollMutation = useMutation({
    mutationFn: () => enrollCourse(slug),
    onSuccess: () => {
      queryClient.invalidateQueries(["course", slug])
      queryClient.invalidateQueries(["enrollments"])
    },
  })

  const handleEnroll = () => {
    if (!isAuthenticated) {
      navigate(`/login?next=/academy/${slug}`)
      return
    }
    enrollMutation.mutate()
  }

  const handleMarkComplete = async (lesson) => {
    if (!isAuthenticated || !course?.is_enrolled) return
    const newCompleted = new Set(completedIds)
    if (newCompleted.has(lesson.id)) {
      newCompleted.delete(lesson.id)
    } else {
      newCompleted.add(lesson.id)
    }
    setCompletedIds(newCompleted)

    try {
      const { markLessonComplete } = await import("../api/academy.api")
      await markLessonComplete(lesson.id, !completedIds.has(lesson.id))
      queryClient.invalidateQueries(["course", slug])
    } catch (e) {
      console.error(e)
    }
  }

  // Loading
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="aspect-video rounded-2xl animate-pulse"
            style={{ backgroundColor: "var(--color-surface)" }} />
          <div className="h-8 w-2/3 rounded animate-pulse"
            style={{ backgroundColor: "var(--color-surface)" }} />
        </div>
        <div className="rounded-2xl animate-pulse h-96"
          style={{ backgroundColor: "var(--color-surface)" }} />
      </div>
    )
  }

  if (isError || !course) {
    return (
      <div className="text-center py-20">
        <p style={{ color: "var(--color-text-muted)" }}>Curso no encontrado.</p>
        <Link to="/academy" style={{ color: "var(--color-accent)" }}
          className="mt-4 inline-block text-sm"
        >
          ← Volver a la academia
        </Link>
      </div>
    )
  }

  const levelInfo = levelConfig[course.level] || { label: course.level, color: "#888" }
  const allLessons = course.modules?.flatMap(m => m.lessons) || []

  return (
    <div style={{ backgroundColor: "var(--color-bg)" }} className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-10">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-8"
          style={{ color: "var(--color-text-muted)" }}
        >
          <Link to="/academy" className="hover:text-white transition-colors">Academia</Link>
          <span>/</span>
          <span style={{ color: "var(--color-text)" }}>{course.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Columna principal ─────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Reproductor / Thumbnail */}
            {activeLesson ? (
              <div className="space-y-4">
                <VideoPlayer url={activeLesson.video_url} title={activeLesson.title} />

                {/* Info de la lección activa */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">{activeLesson.title}</h2>
                    {activeLesson.description && (
                      <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
                        {activeLesson.description}
                      </p>
                    )}
                  </div>

                  {/* Marcar como completada */}
                  {course.is_enrolled && (
                    <button
                      onClick={() => handleMarkComplete(activeLesson)}
                      className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                      style={{
                        backgroundColor: completedIds.has(activeLesson.id)
                          ? "rgba(0,230,118,0.15)"
                          : "var(--color-surface-2)",
                        color: completedIds.has(activeLesson.id)
                          ? "var(--color-accent)"
                          : "var(--color-text-muted)",
                        border: `1px solid ${completedIds.has(activeLesson.id)
                          ? "var(--color-accent)"
                          : "var(--color-border)"
                        }`,
                      }}
                    >
                      {completedIds.has(activeLesson.id) ? "✓ Completada" : "Marcar completa"}
                    </button>
                  )}
                </div>

                {/* Progreso */}
                {course.is_enrolled && course.progress !== undefined && (
                  <div
                    className="rounded-xl p-4"
                    style={{
                      backgroundColor: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div className="flex justify-between text-sm mb-2">
                      <span style={{ color: "var(--color-text-muted)" }}>
                        Progreso del curso
                      </span>
                      <span className="font-semibold">
                        {completedIds.size}/{allLessons.length} lecciones
                      </span>
                    </div>
                    <ProgressBar percentage={course.progress} />
                  </div>
                )}
              </div>
            ) : (
              /* Thumbnail cuando no hay lección activa */
              <div
                className="relative w-full aspect-video rounded-2xl overflow-hidden flex items-center justify-center"
                style={{ backgroundColor: "var(--color-surface-2)" }}
              >
                {course.thumbnail ? (
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-8xl">🎛️</span>
                )}
              </div>
            )}

            {/* Info del curso */}
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{
                    color: levelInfo.color,
                    backgroundColor: `${levelInfo.color}18`,
                  }}
                >
                  {levelInfo.label}
                </span>
                <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  {course.total_lessons} lecciones
                </span>
                {course.total_duration > 0 && (
                  <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    · {course.total_duration} min
                  </span>
                )}
                <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  · {course.enrolled_count} estudiante{course.enrolled_count !== 1 ? "s" : ""}
                </span>
              </div>

              <h1 className="text-3xl font-black mb-4">{course.title}</h1>

              {course.description && (
                <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                  {course.description}
                </p>
              )}
            </div>

            {/* Módulos */}
            {course.modules?.map(module => (
              <div
                key={module.id}
                className="rounded-2xl overflow-hidden"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div
                  className="px-5 py-4 border-b flex justify-between items-center"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <h3 className="font-bold">{module.title}</h3>
                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {module.lessons_count} lección{module.lessons_count !== 1 ? "es" : ""}
                  </span>
                </div>
                <div className="p-3 space-y-1">
                  {module.lessons.map(lesson => (
                    <LessonItem
                      key={lesson.id}
                      lesson={lesson}
                      isActive={activeLesson?.id === lesson.id}
                      isCompleted={completedIds.has(lesson.id)}
                      onSelect={setActiveLesson}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ── Sidebar ───────────────────────────────────── */}
          <div className="space-y-4">
            <div
              className="rounded-2xl p-6 sticky top-24"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              {/* Precio */}
              <p
                className="text-4xl font-black mb-1"
                style={{ color: course.is_free ? "var(--color-accent)" : "var(--color-text)" }}
              >
                {course.is_free
                  ? "Gratis"
                  : `$${Number(course.price).toLocaleString("es-CL")}`
                }
              </p>

              {course.is_enrolled ? (
                <div className="space-y-3 mt-4">
                  <div
                    className="flex items-center gap-2 text-sm py-2 px-3 rounded-xl"
                    style={{
                      backgroundColor: "rgba(0,230,118,0.1)",
                      color: "var(--color-accent)",
                    }}
                  >
                    <span>✓</span>
                    <span className="font-semibold">Estás inscrito en este curso</span>
                  </div>
                  <ProgressBar percentage={course.progress || 0} />
                </div>
              ) : (
                <button
                  onClick={handleEnroll}
                  disabled={enrollMutation.isPending}
                  className="w-full mt-4 py-3 rounded-xl font-bold text-sm transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
                >
                  {enrollMutation.isPending
                    ? "Procesando..."
                    : course.is_free
                    ? "Inscribirse gratis"
                    : "Comprar curso"
                  }
                </button>
              )}

              {/* Resumen del curso */}
              <div
                className="mt-6 pt-5 border-t space-y-3"
                style={{ borderColor: "var(--color-border)" }}
              >
                <h4 className="font-semibold text-sm mb-3">Este curso incluye</h4>
                {[
                  { icon: "📹", text: `${course.total_lessons} lecciones en video` },
                  { icon: "⏱️", text: `${course.total_duration} minutos de contenido` },
                  { icon: "📱", text: "Acceso desde cualquier dispositivo" },
                  { icon: "♾️", text: "Acceso de por vida" },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-3 text-sm"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    <span>{icon}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}