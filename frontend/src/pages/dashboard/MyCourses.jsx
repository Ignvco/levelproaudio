// pages/dashboard/MyCourses.jsx — LevelPro Dashboard Experience V2 (Usuario / Cursos)
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { GraduationCap, Film, Download, BookOpen, CheckCircle2, ArrowRight } from "lucide-react"
import { getEnrollments, downloadCertificate } from "../../api/academy.api"
import { mediaUrl } from "../../utils/mediaUrl"
import { showToast } from "../../components/ui/ToastNotification"
import {
  AdminPageHeader,
  StatCard,
  PrimaryButton,
  SecondaryButton,
  ErrorState,
} from "../../components/admin/ui"

async function handleDownloadCertificate(e, enrollmentId, courseSlug) {
  e.preventDefault()
  e.stopPropagation()
  try {
    const resp = await downloadCertificate(enrollmentId)
    const url  = window.URL.createObjectURL(new Blob([resp.data], { type: "application/pdf" }))
    const a    = document.createElement("a")
    a.href = url
    a.setAttribute("download", `certificado-${courseSlug || "levelpro"}.pdf`)
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  } catch {
    showToast("No se pudo descargar el certificado en este momento.", "error")
  }
}

export default function MyCourses() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["enrollments"],
    queryFn: getEnrollments,
  })

  const rawEnrollments = data?.results ?? data
  const enrollments = Array.isArray(rawEnrollments) ? rawEnrollments : []

  const totalEnrollments = enrollments.length
  const completedCount = enrollments.filter(e => (Number(e.progress_percentage) || 0) >= 100).length
  const inProgressCount = enrollments.filter(e => {
    const p = Number(e.progress_percentage) || 0
    return p > 0 && p < 100
  }).length

  return (
    <div className="au-page" data-testid="courses-page">
      <AdminPageHeader
        eyebrow="LEVELPRO / ACADEMIA"
        title="Mis cursos"
        description={isLoading || isError ? "Tu biblioteca de aprendizaje" : `${totalEnrollments} curso${totalEnrollments !== 1 ? "s" : ""} registrado${totalEnrollments !== 1 ? "s" : ""} en tu aula virtual`}
        breadcrumbs={[
          { label: "Inicio", to: "/dashboard" },
          { label: "Mis cursos" },
        ]}
        actions={
          <PrimaryButton to="/academy" size="sm">
            + Ver catálogo de cursos
          </PrimaryButton>
        }
      />

      {/* KPIs sobre información confirmada por la API. */}
      {!isLoading && !isError && <div className="lp-grid-kpi">
        <StatCard
          variant="ink"
          Icon={GraduationCap}
          label="Cursos inscritos"
          value={totalEnrollments}
          sub="En tu biblioteca"
        />
        <StatCard
          variant="primary"
          Icon={BookOpen}
          label="En progreso"
          value={inProgressCount}
          sub="Lecciones pendientes"
        />
        <StatCard
          variant="light"
          Icon={CheckCircle2}
          label="Completados"
          value={completedCount}
          sub={`${completedCount} certificado${completedCount !== 1 ? "s" : ""} disponible${completedCount !== 1 ? "s" : ""}`}
        />
      </div>}

      {!isLoading && isError && (
        <ErrorState title="No pudimos cargar tus cursos"
          description="Tus inscripciones siguen guardadas. Intenta consultar nuevamente."
          action={<SecondaryButton onClick={() => refetch()}>Reintentar</SecondaryButton>} />
      )}

      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "110px", borderRadius: "18px" }} />
          ))}
        </div>
      )}

      {!isLoading && !isError && enrollments.length === 0 && (
        <div className="au-card" style={{ padding: "64px 24px", textAlign: "center" }}>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              background: "rgba(26, 255, 110, 0.1)",
              border: "1px solid rgba(26, 255, 110, 0.25)",
              color: "var(--admin-primary-text)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <GraduationCap size={28} />
          </div>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.35rem", marginBottom: "8px" }}>
            Sin cursos todavía
          </h3>
          <p style={{ fontSize: "13.5px", color: "var(--admin-text-secondary)", marginBottom: "24px", maxWidth: "420px", margin: "0 auto 24px" }}>
            Explora los programas de mezcla, masterización, acústica e ingeniería de LevelPro Academy.
          </p>
          <PrimaryButton to="/academy">
            Explorar programas formativos →
          </PrimaryButton>
        </div>
      )}

      {!isLoading && !isError && enrollments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {enrollments.map(enrollment => {
            const course = enrollment.course || {}
            const progress = Math.min(100, Math.max(0, Math.round(Number(enrollment.progress_percentage) || 0)))
            const isCompleted = progress === 100
            const thumb = course.thumbnail ? mediaUrl(course.thumbnail) : null

            return (
              <div
                key={enrollment.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/academy/${course.slug || ""}`)}
                onKeyDown={e => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); navigate(`/academy/${course.slug || ""}`) } }}
                aria-label={`Abrir curso ${course.title || "inscrito"}`}
                className="au-card"
                style={{
                  padding: "18px 22px",
                  display: "flex",
                  alignItems: "center",
                  gap: "18px",
                  cursor: "pointer",
                  flexWrap: "wrap",
                  transition: "transform 0.15s ease, border-color 0.15s ease",
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    width: "72px",
                    height: "72px",
                    flexShrink: 0,
                    borderRadius: "14px",
                    overflow: "hidden",
                    background: "var(--admin-surface-soft)",
                    border: "1px solid var(--admin-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {thumb ? (
                    <img src={thumb} alt={course.title || "Curso"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <Film size={26} style={{ color: "var(--admin-text-muted)" }} />
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: isCompleted ? "var(--admin-primary-text)" : "var(--admin-text-muted)",
                      }}
                    >
                      {course.level ? String(course.level).toUpperCase() : "PROGRAMA FORMATIVO"}
                    </span>
                    {isCompleted && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "100px",
                          background: "rgba(26, 255, 110, 0.14)",
                          color: "var(--admin-primary-text)",
                        }}
                      >
                        ✓ Certificado disponible
                      </span>
                    )}
                  </div>

                  <h4 style={{ fontSize: "15px", fontWeight: 700, color: "var(--admin-text)", marginBottom: "8px" }}>
                    {course.title || "Curso sin título"}
                  </h4>

                  {/* Barra de progreso */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        flex: 1,
                        height: "6px",
                        borderRadius: "100px",
                        background: "var(--admin-surface-soft)",
                        overflow: "hidden",
                        border: "1px solid var(--admin-border)",
                      }}
                    >
                      <div
                        style={{
                          width: `${progress}%`,
                          height: "100%",
                          background: isCompleted ? "var(--admin-primary)" : "var(--admin-text)",
                          borderRadius: "100px",
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        fontFamily: "var(--font-mono)",
                        color: isCompleted ? "var(--admin-primary-text)" : "var(--admin-text)",
                      }}
                    >
                      {progress}%
                    </span>
                  </div>
                </div>

                {/* Acciones */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                  {isCompleted && (
                    <button
                      type="button"
                      onClick={e => handleDownloadCertificate(e, enrollment.id, course.slug)}
                      title="Descargar certificado oficial"
                      data-testid={`btn-certificate-${enrollment.id}`}
                      className="au-pill-btn au-pill-btn--edit"
                      style={{ padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
                    >
                      <Download size={13} /> Certificado PDF
                    </button>
                  )}

                  <SecondaryButton
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/academy/${course.slug || ""}`)
                    }}
                  >
                    {isCompleted ? "Revisar lecciones" : "Continuar"} <ArrowRight size={13} style={{ marginLeft: "4px" }} />
                  </SecondaryButton>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
