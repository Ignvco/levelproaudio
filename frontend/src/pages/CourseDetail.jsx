// pages/CourseDetail.jsx

import { useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getCourse, enrollCourse, purchaseCourse } from "../api/academy.api"
import { createPayment } from "../api/payments.api"
import { useAuthStore } from "../store/authStore"
import fondoImg from "../assets/fondo.png"

// ── Video Player ─────────────────────────────────────────────
function VideoPlayer({ url, title }) {
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
    <div style={{
      position: "relative", width: "100%", aspectRatio: "16/9",
      borderRadius: "var(--r-lg)", overflow: "hidden", background: "#000",
    }}>
      <iframe
        src={embedUrl} title={title}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
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
      style={{
        width: "100%", textAlign: "left",
        display: "flex", alignItems: "center", gap: "12px",
        padding: "10px 14px", borderRadius: "var(--r-md)",
        background: isActive ? "rgba(26,255,110,0.06)" : "transparent",
        border: `1px solid ${isActive ? "rgba(26,255,110,0.2)" : "transparent"}`,
        cursor: lesson.is_locked ? "not-allowed" : "pointer",
        opacity: lesson.is_locked ? 0.5 : 1,
        transition: "all var(--dur) var(--ease)",
      }}
    >
      <div style={{
        width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "11px", fontWeight: 600,
        background: isCompleted ? "var(--accent)"
          : isActive ? "rgba(26,255,110,0.15)"
          : "var(--surface-3)",
        color: isCompleted ? "#000" : "var(--text-2)",
      }}>
        {lesson.is_locked ? "🔒" : isCompleted ? "✓" : "▶"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "13px", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap",
          color: isActive ? "var(--accent)" : "var(--text)" }}>
          {lesson.title}
        </p>
        {lesson.duration_minutes > 0 && (
          <p style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "2px" }}>
            {lesson.duration_minutes} min
          </p>
        )}
      </div>
      {lesson.is_free && !lesson.is_locked && (
        <span style={{
          fontSize: "10px", fontWeight: 600, padding: "2px 6px",
          borderRadius: "100px", color: "var(--accent)",
          background: "rgba(26,255,110,0.1)", flexShrink: 0,
        }}>
          FREE
        </span>
      )}
    </button>
  )
}

// ── Progress Bar ─────────────────────────────────────────────
function ProgressBar({ percentage }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div style={{ flex: 1, height: "4px", borderRadius: "2px",
        background: "var(--surface-3)", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: "2px",
          background: "var(--accent)",
          width: `${percentage}%`,
          transition: "width 0.5s ease",
        }} />
      </div>
      <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--accent)",
        flexShrink: 0 }}>
        {percentage}%
      </span>
    </div>
  )
}

// ── Modal comprobante inscripción ────────────────────────────
function EnrollmentReceipt({ course, onClose, navigate }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
      backdropFilter: "blur(10px)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)", padding: "40px", maxWidth: "420px",
        width: "100%", textAlign: "center",
      }}>
        <div style={{
          width: "64px", height: "64px", borderRadius: "50%",
          background: "rgba(26,255,110,0.1)",
          border: "1px solid rgba(26,255,110,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px", fontSize: "28px",
        }}>
          ✓
        </div>

        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.6rem",
          marginBottom: "8px" }}>
          ¡Inscripción exitosa!
        </h2>
        <p style={{ fontSize: "14px", color: "var(--text-2)",
          lineHeight: 1.7, marginBottom: "6px" }}>
          Estás inscrito en
        </p>
        <p style={{ fontSize: "15px", fontWeight: 500, marginBottom: "20px" }}>
          {course?.title}
        </p>

        {/* Comprobante */}
        <div style={{
          padding: "14px 16px", borderRadius: "var(--r-md)",
          background: "var(--surface-2)", border: "1px solid var(--border)",
          marginBottom: "24px", textAlign: "left",
        }}>
          <p style={{ fontSize: "11px", color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em",
            fontWeight: 500, marginBottom: "10px" }}>
            Comprobante
          </p>
          {[
            { label: "Curso",  value: course?.title },
            { label: "Tipo",   value: "Acceso gratuito" },
            { label: "Fecha",  value: new Date().toLocaleDateString("es-CL", {
              day: "numeric", month: "long", year: "numeric" }) },
            { label: "Estado", value: "✓ Confirmado" },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between",
              fontSize: "12px", marginBottom: "6px" }}>
              <span style={{ color: "var(--text-3)" }}>{label}</span>
              <span style={{ color: label === "Estado" ? "var(--accent)" : "var(--text)" }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onClose} className="btn btn-accent"
            style={{ flex: 1, justifyContent: "center", fontSize: "13px" }}>
            Comenzar ahora
          </button>
          <button onClick={() => navigate("/dashboard/courses")}
            className="btn btn-ghost"
            style={{ flex: 1, justifyContent: "center", fontSize: "13px" }}>
            Mis cursos
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CourseDetail ─────────────────────────────────────────────
export default function CourseDetail() {
  const { slug }    = useParams()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuthStore()

  const [activeLesson,    setActiveLesson]    = useState(null)
  const [completedIds,    setCompletedIds]    = useState(new Set())
  const [showReceipt,     setShowReceipt]     = useState(false)
  const [showPayment,     setShowPayment]     = useState(false)
  const [paymentMethod,   setPaymentMethod]   = useState("mercadopago_cl")
  const [purchaseOrderId, setPurchaseOrderId] = useState(null)

  const { data: course, isLoading, isError } = useQuery({
    queryKey: ["course", slug],
    queryFn:  () => getCourse(slug),
    onSuccess: (data) => {
      const first = data.modules?.[0]?.lessons?.[0]
      if (first && !first.is_locked && !activeLesson) {
        setActiveLesson(first)
      }
    },
  })

  // ── Inscripción gratuita ─────────────────────────────────
  const enrollMutation = useMutation({
    mutationFn: () => enrollCourse(slug),
    onSuccess: () => {
      setShowReceipt(true)
      queryClient.invalidateQueries(["course", slug])
      queryClient.invalidateQueries(["enrollments"])
    },
  })

  // ── Compra de curso de pago ──────────────────────────────
  const purchaseMutation = useMutation({
    mutationFn: () => purchaseCourse(slug),
    onSuccess: (data) => {
      setPurchaseOrderId(data.order_id)
      setShowPayment(true)
    },
  })

  // ── Procesar pago ────────────────────────────────────────
  const payMutation = useMutation({
    mutationFn: () => createPayment(purchaseOrderId, paymentMethod),
    onSuccess: (data) => {
      if (paymentMethod === "mercadopago_cl" || paymentMethod === "mercadopago_ar") {
        window.location.href = data.sandbox_url || data.init_point
      } else if (paymentMethod === "paypal") {
        window.location.href = data.approve_url
      } else {
        navigate(`/payment/transfer/${purchaseOrderId}`, {
          state: { transferData: data }
        })
      }
    },
  })

  // ── Marcar lección completa ──────────────────────────────
  const handleMarkComplete = async (lesson) => {
    if (!isAuthenticated || !course?.is_enrolled) return
    const newSet = new Set(completedIds)
    if (newSet.has(lesson.id)) newSet.delete(lesson.id)
    else newSet.add(lesson.id)
    setCompletedIds(newSet)
    try {
      const { markLessonComplete } = await import("../api/academy.api")
      await markLessonComplete(lesson.id, !completedIds.has(lesson.id))
      queryClient.invalidateQueries(["course", slug])
    } catch (e) { console.error(e) }
  }

  const handleEnrollOrBuy = () => {
    if (!isAuthenticated) {
      navigate(`/login?next=/academy/${slug}`)
      return
    }
    if (course.is_free) {
      enrollMutation.mutate()
    } else {
      purchaseMutation.mutate()
    }
  }

  const allLessons = course?.modules?.flatMap(m => m.lessons) || []

  // ── Loading ──────────────────────────────────────────────
  if (isLoading) return (
    <div style={{ maxWidth: "1280px", margin: "0 auto",
      padding: "clamp(40px, 6vw, 80px) clamp(20px, 5vw, 60px)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "48px" }}
        className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-12">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="skeleton" style={{ aspectRatio: "16/9", borderRadius: "var(--r-lg)" }} />
          <div className="skeleton" style={{ height: "32px", width: "60%" }} />
          <div className="skeleton" style={{ height: "16px", width: "40%" }} />
        </div>
        <div className="skeleton" style={{ height: "360px", borderRadius: "var(--r-xl)" }} />
      </div>
    </div>
  )

  if (isError || !course) return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <p style={{ color: "var(--text-3)", marginBottom: "16px" }}>
        Curso no encontrado.
      </p>
      <Link to="/academy" style={{ color: "var(--accent)", fontSize: "14px" }}>
        ← Volver a la academia
      </Link>
    </div>
  )

  const levelConfig = {
    beginner:     { label: "Principiante", color: "#4ade80" },
    intermediate: { label: "Intermedio",   color: "#facc15" },
    advanced:     { label: "Avanzado",     color: "#f87171" },
  }
  const levelInfo = levelConfig[course.level] || { label: course.level, color: "#888" }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>

      {/* Comprobante inscripción gratuita */}
      {showReceipt && (
        <EnrollmentReceipt
          course={course}
          onClose={() => setShowReceipt(false)}
          navigate={navigate}
        />
      )}

      <div style={{ maxWidth: "1280px", margin: "0 auto",
        padding: "clamp(40px, 6vw, 80px) clamp(20px, 5vw, 60px)" }}>

        {/* Breadcrumb */}
        <nav style={{ display: "flex", alignItems: "center", gap: "8px",
          fontSize: "13px", color: "var(--text-3)", marginBottom: "32px" }}>
          <Link to="/academy"
            style={{ transition: "color var(--dur)" }}
            className="hover:text-white">
            Academia
          </Link>
          <span>/</span>
          <span style={{ color: "var(--text)" }}>{course.title}</span>
        </nav>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "48px",
          alignItems: "start" }}
          className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-12"
        >
          {/* ── Columna principal ──────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

            {/* Reproductor o thumbnail */}
            {activeLesson ? (
              <>
                <VideoPlayer url={activeLesson.video_url} title={activeLesson.title} />

                {/* Info lección activa */}
                <div style={{ display: "flex", alignItems: "flex-start",
                  justifyContent: "space-between", gap: "16px" }}>
                  <div>
                    <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.4rem",
                      marginBottom: "6px" }}>
                      {activeLesson.title}
                    </h2>
                    {activeLesson.description && (
                      <p style={{ fontSize: "14px", color: "var(--text-2)", lineHeight: 1.6 }}>
                        {activeLesson.description}
                      </p>
                    )}
                  </div>
                  {course.is_enrolled && (
                    <button
                      onClick={() => handleMarkComplete(activeLesson)}
                      style={{
                        flexShrink: 0,
                        display: "flex", alignItems: "center", gap: "8px",
                        padding: "8px 14px", borderRadius: "var(--r-md)",
                        fontSize: "12px", fontWeight: 500, cursor: "pointer",
                        transition: "all var(--dur) var(--ease)",
                        background: completedIds.has(activeLesson.id)
                          ? "rgba(26,255,110,0.1)" : "var(--surface-2)",
                        color: completedIds.has(activeLesson.id)
                          ? "var(--accent)" : "var(--text-2)",
                        border: `1px solid ${completedIds.has(activeLesson.id)
                          ? "rgba(26,255,110,0.3)" : "var(--border)"}`,
                      }}>
                      {completedIds.has(activeLesson.id) ? "✓ Completada" : "Marcar completa"}
                    </button>
                  )}
                </div>

                {/* Progreso */}
                {course.is_enrolled && course.progress !== undefined && (
                  <div style={{
                    padding: "16px 20px", borderRadius: "var(--r-md)",
                    background: "var(--surface)", border: "1px solid var(--border)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between",
                      fontSize: "12px", marginBottom: "10px" }}>
                      <span style={{ color: "var(--text-3)" }}>Progreso del curso</span>
                      <span style={{ fontWeight: 500 }}>
                        {completedIds.size}/{allLessons.length} lecciones
                      </span>
                    </div>
                    <ProgressBar percentage={course.progress} />
                  </div>
                )}
              </>
            ) : (
              <div style={{
                width: "100%", aspectRatio: "16/9", borderRadius: "var(--r-lg)",
                overflow: "hidden", background: "var(--surface-2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {course.thumbnail ? (
                  <img src={course.thumbnail} alt={course.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: "80px" }}>🎛️</span>
                )}
              </div>
            )}

            {/* Info del curso */}
            <div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center",
                gap: "10px", marginBottom: "12px" }}>
                <span style={{
                  fontSize: "11px", fontWeight: 500, color: levelInfo.color,
                  padding: "2px 10px", borderRadius: "100px",
                  background: `${levelInfo.color}14`,
                  border: `1px solid ${levelInfo.color}30`,
                }}>
                  {levelInfo.label}
                </span>
                <span style={{ fontSize: "13px", color: "var(--text-3)" }}>
                  {course.total_lessons} lecciones
                </span>
                {course.total_duration > 0 && (
                  <span style={{ fontSize: "13px", color: "var(--text-3)" }}>
                    · {course.total_duration} min
                  </span>
                )}
                <span style={{ fontSize: "13px", color: "var(--text-3)" }}>
                  · {course.enrolled_count} estudiante{course.enrolled_count !== 1 ? "s" : ""}
                </span>
              </div>

              <h1 style={{ fontFamily: "var(--font-serif)",
                fontSize: "clamp(1.8rem, 3vw, 2.6rem)", marginBottom: "14px" }}>
                {course.title}
              </h1>

              {course.description && (
                <p style={{ fontSize: "15px", color: "var(--text-2)",
                  lineHeight: 1.7 }}>
                  {course.description}
                </p>
              )}
            </div>

            {/* Módulos y lecciones */}
            {course.modules?.map(module => (
              <div key={module.id} style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--r-lg)", overflow: "hidden",
              }}>
                <div style={{
                  padding: "14px 18px", borderBottom: "1px solid var(--border)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <h3 style={{ fontSize: "14px", fontWeight: 500 }}>{module.title}</h3>
                  <span style={{ fontSize: "11px", color: "var(--text-3)" }}>
                    {module.lessons_count} lección{module.lessons_count !== 1 ? "es" : ""}
                  </span>
                </div>
                <div style={{ padding: "10px" }}>
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

          {/* ── Sidebar ────────────────────────────────── */}
          <div style={{ position: "sticky", top: "88px" }}>
            <div style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--r-xl)", overflow: "hidden",
            }}>
              {/* Precio */}
              <div style={{ padding: "24px 24px 20px" }}>
                <p style={{
                  fontFamily: "var(--font-serif)", fontSize: "2.2rem",
                  lineHeight: 1, marginBottom: "4px",
                  color: course.is_free ? "var(--accent)" : "var(--text)",
                }}>
                  {course.is_free
                    ? "Gratis"
                    : `$${Number(course.price).toLocaleString("es-CL")}`}
                </p>
                {!course.is_free && (
                  <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                    Acceso de por vida
                  </p>
                )}
              </div>

              <div style={{ padding: "0 24px 24px",
                display: "flex", flexDirection: "column", gap: "12px" }}>

                {/* ── Estado: Inscrito ── */}
                {course.is_enrolled ? (
                  <>
                    <div style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      padding: "10px 14px", borderRadius: "var(--r-md)",
                      background: "rgba(26,255,110,0.06)",
                      border: "1px solid rgba(26,255,110,0.2)",
                      fontSize: "13px", color: "var(--accent)",
                    }}>
                      <span>✓</span>
                      <span>Estás inscrito en este curso</span>
                    </div>
                    <ProgressBar percentage={course.progress || 0} />
                  </>

                ) : !showPayment ? (
                  /* ── Botón inscribirse / comprar ── */
                  <button
                    onClick={handleEnrollOrBuy}
                    disabled={enrollMutation.isPending || purchaseMutation.isPending}
                    className="btn btn-accent"
                    style={{ width: "100%", justifyContent: "center",
                      opacity: (enrollMutation.isPending || purchaseMutation.isPending) ? 0.7 : 1 }}>
                    {enrollMutation.isPending || purchaseMutation.isPending
                      ? "Procesando..."
                      : course.is_free
                      ? "Inscribirse gratis"
                      : `Comprar curso`}
                  </button>

                ) : (
                  /* ── Selector de método de pago ── */
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 500, marginBottom: "10px" }}>
                      Elige método de pago:
                    </p>

                    {[
                      { id: "mercadopago_cl", label: "MercadoPago", icon: "💳",
                        desc: "Tarjetas, Khipu, efectivo" },
                      { id: "paypal",         label: "PayPal",      icon: "🌎",
                        desc: "Tarjetas internacionales" },
                      { id: "global66",       label: "Transferencia", icon: "🏦",
                        desc: "Global66 — pago manual" },
                    ].map(m => (
                      <button key={m.id} onClick={() => setPaymentMethod(m.id)} style={{
                        width: "100%", display: "flex", alignItems: "center",
                        gap: "10px", padding: "10px 12px", borderRadius: "var(--r-md)",
                        marginBottom: "6px", cursor: "pointer",
                        transition: "all var(--dur) var(--ease)",
                        background: paymentMethod === m.id
                          ? "var(--surface-2)" : "transparent",
                        border: `1px solid ${paymentMethod === m.id
                          ? "var(--border-hover)" : "var(--border)"}`,
                      }}>
                        <div style={{
                          width: "14px", height: "14px", borderRadius: "50%",
                          flexShrink: 0,
                          border: `2px solid ${paymentMethod === m.id
                            ? "var(--accent)" : "var(--border)"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {paymentMethod === m.id && (
                            <div style={{ width: "6px", height: "6px",
                              borderRadius: "50%", background: "var(--accent)" }} />
                          )}
                        </div>
                        <span style={{ fontSize: "16px" }}>{m.icon}</span>
                        <div style={{ textAlign: "left" }}>
                          <p style={{ fontSize: "13px", fontWeight: 500 }}>{m.label}</p>
                          <p style={{ fontSize: "11px", color: "var(--text-3)" }}>{m.desc}</p>
                        </div>
                      </button>
                    ))}

                    <button
                      onClick={() => payMutation.mutate()}
                      disabled={payMutation.isPending}
                      className="btn btn-accent"
                      style={{ width: "100%", justifyContent: "center",
                        marginTop: "8px",
                        opacity: payMutation.isPending ? 0.7 : 1 }}>
                      {payMutation.isPending
                        ? "Redirigiendo..."
                        : paymentMethod === "global66"
                        ? "Ver instrucciones de transferencia"
                        : "Ir al pago →"}
                    </button>

                    <button
                      onClick={() => {
                        setShowPayment(false)
                        setPurchaseOrderId(null)
                      }}
                      style={{
                        width: "100%", fontSize: "12px", color: "var(--text-3)",
                        background: "none", border: "none", cursor: "pointer",
                        marginTop: "6px", padding: "6px",
                        transition: "color var(--dur)",
                      }}
                      className="hover:text-[var(--text-2)]">
                      Cancelar
                    </button>
                  </div>
                )}

                {/* Qué incluye */}
                <div style={{
                  paddingTop: "16px", borderTop: "1px solid var(--border)",
                  display: "flex", flexDirection: "column", gap: "8px",
                }}>
                  <p style={{ fontSize: "12px", fontWeight: 500, marginBottom: "4px" }}>
                    Este curso incluye
                  </p>
                  {[
                    { icon: "📹", text: `${course.total_lessons} lecciones en video` },
                    { icon: "⏱️", text: `${course.total_duration} min de contenido` },
                    { icon: "📱", text: "Acceso desde cualquier dispositivo" },
                    { icon: "♾️", text: "Acceso de por vida" },
                  ].map(({ icon, text }) => (
                    <div key={text} style={{ display: "flex", alignItems: "center",
                      gap: "10px", fontSize: "13px", color: "var(--text-2)" }}>
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
    </div>
  )
}