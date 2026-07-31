// pages/CourseDetail.jsx
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getCourse, enrollCourse, purchaseCourse,
  markLessonComplete, getCourseProgress,
} from "../api/academy.api"
import { createPayment } from "../api/payments.api"
import { useAuthStore } from "../store/authStore"
import { mediaUrl } from "../utils/mediaUrl"
import Seo from "../components/Seo"
import JsonLd from "../components/JsonLd"
import { SITE_URL, absUrl } from "../utils/seo"
import {
  Lock, Check, Play, Film, Frown, CreditCard, Globe, Landmark,
  Video, Clock, Smartphone, Infinity as InfinityIcon, ArrowRight,
} from "lucide-react"

// ── Video Player ──────────────────────────────────────────────
function VideoPlayer({ lesson, title }) {
  const raw = lesson?.video_source || lesson?.video_url || lesson?.video_file || ""

  const getYouTube = (u) => {
    const m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)
    return m ? `https://www.youtube.com/embed/${m[1]}?rel=0&modestbranding=1` : null
  }
  const getVimeo = (u) => {
    const m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)
    return m ? `https://player.vimeo.com/video/${m[1]}` : null
  }

  if (!raw) return null

  const yt = getYouTube(raw)
  const vm = !yt ? getVimeo(raw) : null
  const embed = yt || vm

  const wrapSt = {
    position: "relative", width: "100%", aspectRatio: "16/9",
    borderRadius: "var(--r-2xl)", overflow: "hidden", background: "#000",
  }

  // Video subido (archivo) → <video>; externo YouTube/Vimeo → <iframe>
  if (!embed) {
    const fileSrc = /^https?:\/\//.test(raw) ? raw : mediaUrl(raw)
    return (
      <div style={wrapSt} data-testid="lesson-video-file">
        <video src={fileSrc} title={title} controls playsInline
          controlsList="nodownload"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "contain", background: "#000" }} />
      </div>
    )
  }

  return (
    <div style={wrapSt} data-testid="lesson-video-embed">
      <iframe src={embed} title={title}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen />
    </div>
  )
}

// ── Lesson Item ───────────────────────────────────────────────
function LessonItem({ lesson, isActive, isCompleted, onSelect }) {
  return (
    <button onClick={() => !lesson.is_locked && onSelect(lesson)}
      disabled={lesson.is_locked}
      style={{
        width:        "100%",
        textAlign:    "left",
        display:      "flex",
        alignItems:   "center",
        gap:          "12px",
        padding:      "10px 14px",
        borderRadius: "var(--r-lg)",
        background:   isActive ? "rgba(26,255,110,0.06)" : "transparent",
        border:       `1px solid ${isActive ? "rgba(26,255,110,0.2)" : "transparent"}`,
        cursor:       lesson.is_locked ? "not-allowed" : "pointer",
        opacity:      lesson.is_locked ? 0.45 : 1,
        transition:   "all var(--dur) var(--ease)",
      }}>
      {/* Indicador */}
      <div style={{
        width:           "28px",
        height:          "28px",
        borderRadius:    "50%",
        flexShrink:      0,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        fontSize:        "11px",
        fontWeight:      600,
        background:      isCompleted ? "var(--accent)"
          : isActive ? "rgba(26,255,110,0.15)"
          : "var(--surface-3)",
        color:           isCompleted ? "#000" : "var(--text-3)",
        border:          isCompleted || isActive
          ? "none" : "1px solid var(--border)",
      }}>
        {lesson.is_locked ? <Lock size={13} /> : isCompleted ? <Check size={14} strokeWidth={3} /> : <Play size={12} fill="currentColor" />}
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
        <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px",
          borderRadius: "var(--r-full)", color: "var(--accent)",
          background: "rgba(26,255,110,0.1)", flexShrink: 0 }}>
          FREE
        </span>
      )}
    </button>
  )
}

// ── Barra de progreso ─────────────────────────────────────────
function ProgressBar({ pct }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div style={{ flex: 1, height: "4px", borderRadius: "2px",
        background: "var(--surface-3)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%",
          background: "var(--accent)", borderRadius: "2px",
          transition: "width 600ms var(--ease)" }} />
      </div>
      <span style={{ fontSize: "12px", fontWeight: 600,
        color: "var(--accent)", flexShrink: 0, minWidth: "36px" }}>
        {pct}%
      </span>
    </div>
  )
}

export default function CourseDetail() {
  const { slug }    = useParams()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuthStore()

  const [activeLesson,   setActiveLesson]   = useState(null)
  const [completedIds,   setCompletedIds]   = useState(new Set())
  const [showPayment,    setShowPayment]    = useState(false)
  const [paymentMethod,  setPaymentMethod]  = useState("mercadopago_cl")
  const [purchaseOrderId,setPurchaseOrderId] = useState(null)
  const [showSuccess,    setShowSuccess]    = useState(false)

  const { data: course, isLoading, isError } = useQuery({
    queryKey: ["course", slug],
    queryFn:  () => getCourse(slug),
  })

  const { data: progressData } = useQuery({
    queryKey: ["course-progress", slug],
    queryFn:  () => getCourseProgress(slug),
    enabled:  !!course?.is_enrolled,
  })

  useEffect(() => {
    if (!course) return
    const first = course.modules?.[0]?.lessons?.[0]
    if (first && !first.is_locked && !activeLesson) setActiveLesson(first)
  }, [course])

  useEffect(() => {
    if (!progressData) return
    setCompletedIds(new Set(
      progressData.filter(p => p.completed).map(p => p.lesson)
    ))
  }, [progressData])

  const enrollMutation = useMutation({
    mutationFn: () => enrollCourse(slug),
    onSuccess: () => {
      setShowSuccess(true)
      queryClient.invalidateQueries(["course", slug])
    },
  })

  const purchaseMutation = useMutation({
    mutationFn: () => purchaseCourse(slug),
    onSuccess: (data) => {
      setPurchaseOrderId(data.order_id)
      setShowPayment(true)
    },
  })

  const payMutation = useMutation({
    mutationFn: () => createPayment(purchaseOrderId, paymentMethod),
    onSuccess: (data) => {
      if (paymentMethod === "mercadopago_cl")
        window.location.href = data.sandbox_url || data.init_point
      else if (paymentMethod === "paypal")
        window.location.href = data.approve_url
      else navigate(`/payment/transfer/${purchaseOrderId}`)
    },
  })

  const handleMarkComplete = async (lesson) => {
    if (!isAuthenticated || !course?.is_enrolled) return
    const done = completedIds.has(lesson.id)
    const next = new Set(completedIds)
    done ? next.delete(lesson.id) : next.add(lesson.id)
    setCompletedIds(next)
    try {
      await markLessonComplete(lesson.id, !done)
      queryClient.invalidateQueries(["course", slug])
      queryClient.invalidateQueries(["course-progress", slug])
    } catch { setCompletedIds(completedIds) }
  }

  const allLessons   = course?.modules?.flatMap(m => m.lessons) || []
  const localProgress = allLessons.length
    ? Math.round((completedIds.size / allLessons.length) * 100) : 0

  if (isLoading) return (
    <div className="lp-container" style={{
      paddingTop: "clamp(96px, 12vw, 130px)", paddingBottom: "80px" }}>
      <div style={{ display: "grid",
        gridTemplateColumns: "1fr 340px", gap: "48px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="skeleton" style={{ aspectRatio: "16/9",
            borderRadius: "var(--r-2xl)" }} />
          <div className="skeleton" style={{ height: "40px", width: "60%" }} />
          <div className="skeleton" style={{ height: "20px" }} />
        </div>
        <div className="skeleton" style={{ height: "400px",
          borderRadius: "var(--r-2xl)" }} />
      </div>
    </div>
  )

  if (isError || !course) return (
    <div style={{ textAlign: "center", padding: "clamp(120px,16vw,160px) 24px" }}>
      <div style={{ width: "72px", height: "72px", borderRadius: "50%",
        background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)",
        color: "var(--text-3)", display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 20px" }}><Frown size={30} /></div>
      <h2 className="display-bold" style={{ fontFamily: "var(--font-display)", fontWeight: 800,
        letterSpacing: "-0.03em", marginBottom: "20px" }}>
        Curso no encontrado
      </h2>
      <Link to="/academy" className="btn btn-accent">← Academia</Link>
    </div>
  )

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Seo title={course.title}
        description={course.description?.replace(/<[^>]+>/g, "").slice(0, 160)}
        image={course.thumbnail ? mediaUrl(course.thumbnail) : undefined} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Course",
        name: course.title,
        ...(course.description ? { description: course.description.replace(/<[^>]+>/g, "").slice(0, 300) } : {}),
        provider: { "@type": "Organization", name: "LevelPro Audio", url: SITE_URL },
        ...(course.thumbnail ? { image: absUrl(mediaUrl(course.thumbnail)) } : {}),
        offers: {
          "@type": "Offer",
          price: course.is_free ? 0 : Number(course.price),
          priceCurrency: "CLP",
          category: course.is_free ? "Free" : "Paid",
          url: `${SITE_URL}/academy/${slug}`,
        },
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Academia", item: `${SITE_URL}/academy` },
          { "@type": "ListItem", position: 3, name: course.title, item: `${SITE_URL}/academy/${slug}` },
        ],
      }} />

      {/* Éxito de inscripción */}
      {showSuccess && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
          backdropFilter: "blur(12px)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px",
        }}>
          <div style={{
            background: "var(--surface)", border: "1px solid rgba(26,255,110,0.2)",
            borderRadius: "var(--r-2xl)", padding: "48px 40px",
            maxWidth: "400px", width: "100%", textAlign: "center",
          }}
            className="animate-scale-in"
          >
            <div style={{ width: "72px", height: "72px", borderRadius: "50%",
              background: "rgba(26,255,110,0.1)",
              border: "2px solid rgba(26,255,110,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px", color: "var(--accent)" }}>
              <Check size={34} strokeWidth={3} />
            </div>
            <h2 className="display-bold" style={{ fontFamily: "var(--font-display)", fontSize: "1.7rem",
              fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "10px" }}>
              ¡Inscripción exitosa!
            </h2>
            <p style={{ fontSize: "14px", color: "var(--text-2)",
              marginBottom: "24px", lineHeight: 1.6 }}>
              Ya tenés acceso a <strong>{course.title}</strong>.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShowSuccess(false)}
                className="btn btn-accent"
                style={{ flex: 1, justifyContent: "center" }}>
                Comenzar ahora
              </button>
              <button onClick={() => navigate("/dashboard/courses")}
                className="btn btn-ghost"
                style={{ flex: 1, justifyContent: "center" }}>
                Mis cursos
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="lp-container" style={{
        paddingTop: "clamp(96px, 12vw, 130px)", paddingBottom: "clamp(60px, 8vw, 100px)" }}>

        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px",
          fontSize: "13px", color: "var(--text-3)", marginBottom: "32px" }}>
          <Link to="/academy" className="hover-accent"
            style={{ transition: "color var(--dur)" }}>
            Academia
          </Link>
          <span>/</span>
          <span style={{ color: "var(--text-2)" }}>{course.title}</span>
        </div>

        <div style={{ display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: "clamp(32px, 5vw, 56px)", alignItems: "start" }}
          className="course-grid"
        >
          {/* ── Columna principal ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

            {/* Video o thumbnail */}
            {activeLesson ? (
              <>
                <VideoPlayer lesson={activeLesson} title={activeLesson.title} />

                {/* Info de la lección activa */}
                <div style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem",
                      fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "6px" }}>
                      {activeLesson.title}
                    </h2>
                    {activeLesson.description && (
                      <p style={{ fontSize: "14px", color: "var(--text-2)",
                        lineHeight: 1.7 }}>
                        {activeLesson.description}
                      </p>
                    )}
                  </div>
                  {course.is_enrolled && (
                    <button onClick={() => handleMarkComplete(activeLesson)}
                      style={{
                        flexShrink:   0,
                        display:      "flex",
                        alignItems:   "center",
                        gap:          "8px",
                        padding:      "9px 16px",
                        borderRadius: "var(--r-full)",
                        fontSize:     "13px",
                        fontWeight:   500,
                        cursor:       "pointer",
                        background:   completedIds.has(activeLesson.id)
                          ? "rgba(26,255,110,0.1)" : "var(--surface-2)",
                        color:        completedIds.has(activeLesson.id)
                          ? "var(--accent)" : "var(--text-2)",
                        border:       `1px solid ${completedIds.has(activeLesson.id)
                          ? "rgba(26,255,110,0.3)" : "var(--border)"}`,
                        transition:   "all var(--dur) var(--ease)",
                      }}>
                      {completedIds.has(activeLesson.id)
                        ? <><Check size={14} strokeWidth={3} /> Completada</> : "Marcar completa"}
                    </button>
                  )}
                </div>

                {/* Progreso */}
                {course.is_enrolled && (
                  <div style={{ background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-xl)", padding: "16px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between",
                      fontSize: "12px", marginBottom: "10px" }}>
                      <span style={{ color: "var(--text-3)" }}>Progreso del curso</span>
                      <span style={{ fontWeight: 500 }}>
                        {completedIds.size}/{allLessons.length} lecciones
                      </span>
                    </div>
                    <ProgressBar pct={localProgress} />
                  </div>
                )}
              </>
            ) : (
              <div style={{ aspectRatio: "16/9", borderRadius: "var(--r-2xl)",
                overflow: "hidden", background: "var(--surface-2)",
                border: "1px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                {course.thumbnail ? (
                  <img src={mediaUrl(course.thumbnail)} alt={course.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <Film size={72} style={{ color: "var(--text-3)" }} />
                )}
              </div>
            )}

            {/* Info del curso */}
            <div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap",
                alignItems: "center", marginBottom: "14px" }}>
                {[
                  { label: `${course.total_lessons} lecciones` },
                  ...(course.total_duration > 0 ? [{ label: `${course.total_duration} min` }] : []),
                  { label: `${course.enrolled_count} estudiantes` },
                ].map(({ label }) => (
                  <span key={label} style={{ fontSize: "13px", color: "var(--text-3)",
                    padding: "4px 12px", borderRadius: "var(--r-full)",
                    background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    {label}
                  </span>
                ))}
              </div>
              <h1 className="display-bold" style={{ fontFamily: "var(--font-display)",
                fontSize: "clamp(1.9rem, 3.5vw, 3rem)", fontWeight: 800,
                letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: "14px" }}>
                {course.title}
              </h1>
              {course.description && (
                <p style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.8 }}>
                  {course.description}
                </p>
              )}
            </div>

            {/* Módulos */}
            {course.modules?.map(mod => (
              <div key={mod.id} style={{ background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-xl)", overflow: "hidden" }}>
                <div style={{ padding: "14px 18px",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: 500 }}>
                    {mod.title}
                  </h3>
                  <span style={{ fontSize: "11px", color: "var(--text-3)" }}>
                    {mod.lessons_count} lección{mod.lessons_count !== 1 ? "es" : ""}
                  </span>
                </div>
                <div style={{ padding: "10px" }}>
                  {mod.lessons.map(lesson => (
                    <LessonItem key={lesson.id} lesson={lesson}
                      isActive={activeLesson?.id === lesson.id}
                      isCompleted={completedIds.has(lesson.id)}
                      onSelect={setActiveLesson} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ── Sidebar ── */}
          <div style={{ position: "sticky", top: "88px" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--r-2xl)", overflow: "hidden" }}>

              {/* Precio */}
              <div style={{ padding: "24px 24px 20px" }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem",
                  lineHeight: 1, marginBottom: "4px", fontWeight: 800, letterSpacing: "-0.03em",
                  color: course.is_free ? "var(--accent)" : "var(--text)" }}>
                  {course.is_free ? "Gratis"
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

                {course.is_enrolled ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px",
                      padding: "12px 16px", borderRadius: "var(--r-xl)",
                      background: "rgba(26,255,110,0.06)",
                      border: "1px solid rgba(26,255,110,0.2)",
                      fontSize: "13px", color: "var(--accent)" }}>
                      <Check size={14} strokeWidth={3} />
                      <span>Inscripto en este curso</span>
                    </div>
                    <ProgressBar pct={localProgress} />
                  </>

                ) : !showPayment ? (
                  <button onClick={() => {
                    if (!isAuthenticated) {
                      navigate(`/login?next=/academy/${slug}`)
                      return
                    }
                    course.is_free
                      ? enrollMutation.mutate()
                      : purchaseMutation.mutate()
                  }}
                    disabled={enrollMutation.isPending || purchaseMutation.isPending}
                    className="btn btn-accent"
                    style={{ justifyContent: "center", fontSize: "15px",
                      padding: "14px", width: "100%",
                      opacity: (enrollMutation.isPending || purchaseMutation.isPending) ? 0.7 : 1 }}>
                    {enrollMutation.isPending || purchaseMutation.isPending
                      ? "Procesando..."
                      : course.is_free ? "Inscribirse gratis" : "Comprar curso"}
                  </button>

                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <p style={{ fontSize: "13px", fontWeight: 500, marginBottom: "4px" }}>
                      Método de pago:
                    </p>
                    {[
                      { id: "mercadopago_cl", label: "MercadoPago", Icon: CreditCard },
                      { id: "paypal",         label: "PayPal",      Icon: Globe },
                      { id: "global66",       label: "Transferencia",Icon: Landmark },
                    ].map(m => (
                      <button key={m.id} type="button"
                        onClick={() => setPaymentMethod(m.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: "10px",
                          padding: "10px 14px", borderRadius: "var(--r-lg)",
                          cursor: "pointer",
                          background: paymentMethod === m.id
                            ? "rgba(26,255,110,0.06)" : "var(--surface-2)",
                          border: `1px solid ${paymentMethod === m.id
                            ? "rgba(26,255,110,0.3)" : "var(--border)"}`,
                          transition: "all var(--dur) var(--ease)",
                          width: "100%",
                        }}>
                        <span style={{ display: "flex", color: "var(--text-2)" }}><m.Icon size={18} /></span>
                        <span style={{ fontSize: "13px" }}>{m.label}</span>
                      </button>
                    ))}
                    <button onClick={() => payMutation.mutate()}
                      disabled={payMutation.isPending}
                      className="btn btn-accent"
                      style={{ justifyContent: "center", marginTop: "4px",
                        width: "100%", opacity: payMutation.isPending ? 0.7 : 1 }}>
                      {payMutation.isPending ? "Redirigiendo..." : "Ir al pago"}
                    </button>
                    <button onClick={() => { setShowPayment(false); setPurchaseOrderId(null) }}
                      style={{ fontSize: "12px", color: "var(--text-3)",
                        background: "none", border: "none", cursor: "pointer",
                        padding: "6px", textAlign: "center" }}>
                      Cancelar
                    </button>
                  </div>
                )}

                {/* Incluye */}
                <div style={{ paddingTop: "16px", borderTop: "1px solid var(--border)",
                  display: "flex", flexDirection: "column", gap: "8px" }}>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-3)",
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    marginBottom: "4px" }}>
                    Este curso incluye
                  </p>
                  {[
                    { Icon: Video, text: `${course.total_lessons} lecciones en video` },
                    { Icon: Clock, text: `${course.total_duration} min de contenido` },
                    { Icon: Smartphone, text: "Acceso desde cualquier dispositivo" },
                    { Icon: InfinityIcon, text: "Acceso de por vida" },
                  ].map(({ Icon, text }) => (
                    <div key={text} style={{ display: "flex", alignItems: "center",
                      gap: "10px", fontSize: "13px", color: "var(--text-2)" }}>
                      <span style={{ display: "flex", color: "var(--accent)" }}><Icon size={16} /></span>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .course-grid {
            grid-template-columns: 1fr !important;
          }
          .course-grid > div:last-child {
            position: static !important;
          }
        }
      `}</style>
    </div>
  )
}