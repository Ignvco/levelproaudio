// pages/CourseDetail.jsx

import { useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getCourse, enrollCourse, markLessonComplete } from "../api/academy.api"
import { useAuthStore } from "../store/authStore"

function VideoPlayer({ url, title }) {
  const getEmbed = (url) => {
    if (!url) return null
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)
    return m ? `https://www.youtube.com/embed/${m[1]}` : url
  }
  const embed = getEmbed(url)
  if (!embed) return null
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "16/9",
      borderRadius: "var(--r-xl)", overflow: "hidden", background: "#000" }}>
      <iframe src={embed} title={title}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        frameBorder="0" allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />
    </div>
  )
}

function LessonRow({ lesson, isActive, isCompleted, onSelect }) {
  return (
    <button onClick={() => !lesson.is_locked && onSelect(lesson)}
      disabled={lesson.is_locked}
      style={{
        width: "100%", textAlign: "left", display: "flex", alignItems: "center",
        gap: "12px", padding: "10px 12px", borderRadius: "var(--r-md)",
        cursor: lesson.is_locked ? "not-allowed" : "pointer",
        background: isActive ? "var(--surface-2)" : "transparent",
        border: `1px solid ${isActive ? "var(--border-hover)" : "transparent"}`,
        opacity: lesson.is_locked ? 0.45 : 1,
        transition: "all var(--dur) var(--ease)",
      }}>
      {/* Ícono */}
      <div style={{
        width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "12px", fontWeight: 600,
        background: isCompleted ? "var(--accent)" : isActive ? "var(--surface-3)" : "var(--surface-2)",
        color: isCompleted ? "#000" : "var(--text-3)",
        border: `1px solid ${isCompleted ? "transparent" : "var(--border)"}`,
      }}>
        {lesson.is_locked ? "🔒" : isCompleted ? "✓" : "▷"}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "13px", fontWeight: isActive ? 500 : 400,
          color: isActive ? "var(--text)" : "var(--text-2)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {lesson.title}
        </p>
        {lesson.duration_minutes > 0 && (
          <p style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "1px" }}>
            {lesson.duration_minutes} min
          </p>
        )}
      </div>

      {lesson.is_free && !lesson.is_locked && (
        <span style={{ fontSize: "10px", fontWeight: 600, padding: "2px 7px",
          borderRadius: "100px", background: "var(--accent-glow)",
          color: "var(--accent)", border: "1px solid rgba(26,255,110,0.2)",
          flexShrink: 0 }}>
          FREE
        </span>
      )}
    </button>
  )
}

export default function CourseDetail() {
  const { slug }    = useParams()
  const { isAuthenticated } = useAuthStore()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [activeLesson, setActiveLesson]   = useState(null)
  const [completedIds, setCompletedIds]   = useState(new Set())

  const { data: course, isLoading, isError } = useQuery({
    queryKey: ["course", slug],
    queryFn:  () => getCourse(slug),
    onSuccess: (data) => {
      const first = data.modules?.[0]?.lessons?.[0]
      if (first && !first.is_locked && !activeLesson) setActiveLesson(first)
    },
  })

  const enrollMutation = useMutation({
    mutationFn: () => enrollCourse(slug),
    onSuccess:  () => {
      queryClient.invalidateQueries(["course", slug])
      queryClient.invalidateQueries(["enrollments"])
    },
  })

  const handleEnroll = () => {
    if (!isAuthenticated) { navigate(`/login?next=/academy/${slug}`); return }
    enrollMutation.mutate()
  }

  const handleToggleComplete = async (lesson) => {
    if (!isAuthenticated || !course?.is_enrolled) return
    const next = new Set(completedIds)
    const nowCompleted = !next.has(lesson.id)
    nowCompleted ? next.add(lesson.id) : next.delete(lesson.id)
    setCompletedIds(next)
    try { await markLessonComplete(lesson.id, nowCompleted) } catch {}
  }

  if (isLoading) return (
    <div style={{ maxWidth: "1200px", margin: "0 auto",
      padding: "60px clamp(20px, 5vw, 60px)" }}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="skeleton" style={{ aspectRatio: "16/9", borderRadius: "var(--r-xl)" }} />
          <div className="skeleton" style={{ height: "40px", width: "60%" }} />
        </div>
        <div className="skeleton" style={{ borderRadius: "var(--r-xl)", height: "400px" }} />
      </div>
    </div>
  )

  if (isError || !course) return (
    <div style={{ textAlign: "center", padding: "120px 20px" }}>
      <p style={{ color: "var(--text-3)", marginBottom: "20px" }}>Curso no encontrado.</p>
      <Link to="/academy" className="btn btn-ghost">← Academia</Link>
    </div>
  )

  const allLessons = course.modules?.flatMap(m => m.lessons) || []
  const levelColors = { beginner: "#4ade80", intermediate: "#facc15", advanced: "#f87171" }
  const levelColor  = levelColors[course.level] || "var(--text-3)"

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh",
      padding: "clamp(32px, 5vw, 60px) 0" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto",
        padding: "0 clamp(20px, 5vw, 60px)" }}>

        {/* Breadcrumb */}
        <nav style={{ display: "flex", alignItems: "center", gap: "8px",
          fontSize: "13px", color: "var(--text-3)", marginBottom: "32px" }}>
          <Link to="/academy" className="hover:text-white" style={{ transition: "color var(--dur)" }}>
            Academia
          </Link>
          <span>/</span>
          <span style={{ color: "var(--text-2)" }}>{course.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10"
          style={{ alignItems: "start" }}>

          {/* ── Columna principal ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

            {/* Reproductor / Thumbnail */}
            {activeLesson ? (
              <>
                <VideoPlayer url={activeLesson.video_url} title={activeLesson.title} />
                <div style={{ display: "flex", alignItems: "flex-start",
                  justifyContent: "space-between", gap: "16px" }}>
                  <div>
                    <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.4rem",
                      marginBottom: "4px" }}>
                      {activeLesson.title}
                    </h2>
                    {activeLesson.description && (
                      <p style={{ fontSize: "14px", color: "var(--text-2)" }}>
                        {activeLesson.description}
                      </p>
                    )}
                  </div>
                  {course.is_enrolled && (
                    <button onClick={() => handleToggleComplete(activeLesson)}
                      className="btn btn-ghost"
                      style={{
                        flexShrink: 0, padding: "8px 16px", fontSize: "13px",
                        color: completedIds.has(activeLesson.id) ? "var(--accent)" : "var(--text-2)",
                        borderColor: completedIds.has(activeLesson.id)
                          ? "rgba(26,255,110,0.3)" : "var(--border)",
                      }}>
                      {completedIds.has(activeLesson.id) ? "✓ Completada" : "Marcar completa"}
                    </button>
                  )}
                </div>

                {/* Barra de progreso */}
                {course.is_enrolled && (
                  <div style={{
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: "var(--r-md)", padding: "14px 16px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between",
                      fontSize: "12px", color: "var(--text-3)", marginBottom: "8px" }}>
                      <span>Progreso del curso</span>
                      <span>{completedIds.size}/{allLessons.length} lecciones</span>
                    </div>
                    <div style={{ height: "3px", borderRadius: "2px",
                      background: "var(--surface-3)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: "2px",
                        background: "var(--accent)",
                        width: `${allLessons.length ? (completedIds.size / allLessons.length) * 100 : 0}%`,
                        transition: "width 500ms var(--ease)",
                      }} />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{
                width: "100%", aspectRatio: "16/9",
                borderRadius: "var(--r-xl)", overflow: "hidden",
                background: "var(--surface-2)", border: "1px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {course.thumbnail
                  ? <img src={course.thumbnail} alt={course.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: "64px" }}>🎛️</span>
                }
              </div>
            )}

            {/* Info del curso */}
            <div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center",
                gap: "10px", marginBottom: "12px" }}>
                <span style={{
                  padding: "3px 10px", borderRadius: "100px", fontSize: "11px",
                  fontWeight: 500, color: levelColor,
                  background: `${levelColor}14`, border: `1px solid ${levelColor}30`,
                }}>
                  {course.level === "beginner" ? "Principiante"
                    : course.level === "intermediate" ? "Intermedio" : "Avanzado"}
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                  {course.total_lessons} lecciones
                </span>
                {course.total_duration > 0 && (
                  <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                    · {course.total_duration} min
                  </span>
                )}
                <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                  · {course.enrolled_count} estudiante{course.enrolled_count !== 1 ? "s" : ""}
                </span>
              </div>
              <h1 style={{ fontFamily: "var(--font-serif)",
                fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)", marginBottom: "16px" }}>
                {course.title}
              </h1>
              {course.description && (
                <p style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.75 }}>
                  {course.description}
                </p>
              )}
            </div>

            {/* Módulos */}
            {course.modules?.map(module => (
              <div key={module.id} style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--r-lg)", overflow: "hidden",
              }}>
                <div style={{
                  padding: "14px 16px", borderBottom: "1px solid var(--border)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <h3 style={{ fontSize: "14px", fontWeight: 500 }}>{module.title}</h3>
                  <span style={{ fontSize: "11px", color: "var(--text-3)" }}>
                    {module.lessons_count} lección{module.lessons_count !== 1 ? "es" : ""}
                  </span>
                </div>
                <div style={{ padding: "8px" }}>
                  {module.lessons.map(lesson => (
                    <LessonRow key={lesson.id} lesson={lesson}
                      isActive={activeLesson?.id === lesson.id}
                      isCompleted={completedIds.has(lesson.id)}
                      onSelect={setActiveLesson}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ── Sidebar ── */}
          <div style={{ position: "sticky", top: "88px" }}>
            <div style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--r-xl)", padding: "24px",
            }}>
              <p style={{ fontFamily: "var(--font-serif)", fontSize: "2rem",
                lineHeight: 1, marginBottom: "4px",
                color: course.is_free ? "var(--accent)" : "var(--text)" }}>
                {course.is_free ? "Gratis" : `$${Number(course.price).toLocaleString("es-CL")}`}
              </p>

              {course.is_enrolled ? (
                <div style={{ marginTop: "16px" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "10px 12px", borderRadius: "var(--r-md)",
                    background: "var(--accent-glow)", border: "1px solid rgba(26,255,110,0.2)",
                    marginBottom: "12px",
                  }}>
                    <span style={{ color: "var(--accent)", fontSize: "13px", fontWeight: 500 }}>
                      ✓ Inscrito en este curso
                    </span>
                  </div>
                  <div style={{ height: "3px", borderRadius: "2px",
                    background: "var(--surface-3)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: "2px", background: "var(--accent)",
                      width: `${course.progress || 0}%`, transition: "width 500ms var(--ease)",
                    }} />
                  </div>
                  <p style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "6px" }}>
                    {course.progress || 0}% completado
                  </p>
                </div>
              ) : (
                <button onClick={handleEnroll}
                  disabled={enrollMutation.isPending}
                  className="btn btn-accent"
                  style={{ width: "100%", justifyContent: "center",
                    marginTop: "16px", opacity: enrollMutation.isPending ? 0.7 : 1 }}>
                  {enrollMutation.isPending ? "Procesando..."
                    : course.is_free ? "Inscribirse gratis" : "Comprar curso"}
                </button>
              )}

              {/* Incluye */}
              <div style={{ marginTop: "24px", paddingTop: "20px",
                borderTop: "1px solid var(--border)",
                display: "flex", flexDirection: "column", gap: "10px" }}>
                <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-3)",
                  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                  Incluye
                </p>
                {[
                  `${course.total_lessons} lecciones en video`,
                  `${course.total_duration} minutos de contenido`,
                  "Acceso de por vida",
                  "Cualquier dispositivo",
                ].map(item => (
                  <div key={item} style={{ display: "flex", alignItems: "center",
                    gap: "8px", fontSize: "13px", color: "var(--text-2)" }}>
                    <span style={{ color: "var(--text-3)", fontSize: "12px" }}>✓</span>
                    {item}
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