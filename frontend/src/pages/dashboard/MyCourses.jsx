// pages/dashboard/Courses.jsx
import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "react-router-dom"
import { GraduationCap, Film, Download } from "lucide-react"
import { getEnrollments, downloadCertificate } from "../../api/academy.api"
import { mediaUrl } from "../../utils/mediaUrl"
import { showToast } from "../../components/ui/ToastNotification"

async function handleDownloadCertificate(e, enrollmentId, courseSlug) {
  e.preventDefault()
  e.stopPropagation()
  try {
    const resp = await downloadCertificate(enrollmentId)
    const url  = window.URL.createObjectURL(new Blob([resp.data], { type: "application/pdf" }))
    const a    = document.createElement("a")
    a.href = url; a.setAttribute("download", `certificado-${courseSlug}.pdf`)
    document.body.appendChild(a); a.click(); a.remove()
    window.URL.revokeObjectURL(url)
  } catch {
    showToast("No se pudo descargar el certificado")
  }
}

function ProgressRing({ percentage, size = 56 }) {
  const r   = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (percentage / 100) * circ

  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="var(--surface-3)" strokeWidth={3} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="var(--accent)" strokeWidth={3}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: "stroke-dashoffset 1s var(--ease)" }} />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        fontSize="11" fontWeight="600" fill="var(--accent)">
        {percentage}%
      </text>
    </svg>
  )
}

export default function Courses() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ["enrollments"], queryFn: getEnrollments,
  })
  const enrollments = data?.results || data || []

  return (
    <div style={{ padding: "clamp(32px, 5vw, 56px)", maxWidth: "800px" }}>
      <div style={{ marginBottom: "32px" }}>
        <p style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 600,
          letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>
          Academia
        </p>
        <h1 className="display-bold" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.7rem, 3vw, 2.4rem)",
          fontWeight: 800, letterSpacing: "-0.03em" }}>
          Mis cursos
        </h1>
      </div>

      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "100px" }} />
          ))}
        </div>
      )}

      {!isLoading && enrollments.length === 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-2xl)", padding: "64px 32px", textAlign: "center" }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "50%",
            background: "rgba(26,255,110,0.08)", border: "1px solid rgba(26,255,110,0.2)",
            color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 18px" }}><GraduationCap size={28} /></div>
          <h3 className="display-bold" style={{ fontFamily: "var(--font-display)", fontWeight: 800,
            fontSize: "1.4rem", letterSpacing: "-0.02em", marginBottom: "8px" }}>
            Sin cursos todavía
          </h3>
          <p style={{ fontSize: "14px", color: "var(--text-3)", marginBottom: "28px" }}>
            Explorá la academia y comenzá a aprender.
          </p>
          <Link to="/academy" className="btn btn-accent">Ver cursos →</Link>
        </div>
      )}

      {!isLoading && enrollments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {enrollments.map(enrollment => {
            const course = enrollment.course
            const progress = enrollment.progress_percentage || 0
            const thumb = course?.thumbnail ? mediaUrl(course.thumbnail) : null

            return (
              <div key={enrollment.id}
                role="link" tabIndex={0}
                onClick={() => navigate(`/academy/${course?.slug}`)}
                onKeyDown={e => { if (e.key === "Enter") navigate(`/academy/${course?.slug}`) }}
                style={{ display: "flex", alignItems: "center", gap: "20px",
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "var(--r-xl)", padding: "20px 24px",
                  cursor: "pointer",
                  transition: "all var(--dur-slow) var(--ease)" }}
                className="card card-glow"
              >
                {/* Thumbnail */}
                <div style={{ width: "72px", height: "72px", flexShrink: 0,
                  borderRadius: "var(--r-lg)", overflow: "hidden",
                  background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  {thumb ? (
                    <img src={thumb} alt={course?.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%",
                      display: "flex", alignItems: "center",
                      justifyContent: "center", color: "var(--text-3)" }}>
                      <Film size={28} />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "15px", fontWeight: 500, color: "var(--text)",
                    marginBottom: "6px", overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {course?.title}
                  </p>
                  <p style={{ fontSize: "12px", color: progress === 100 ? "var(--accent)" : "var(--text-3)",
                    fontWeight: progress === 100 ? 500 : 400 }}>
                    {progress === 100 ? "✓ Completado" : progress === 0 ? "Sin empezar" : "En progreso"}
                  </p>
                </div>

                {/* Progress ring */}
                <ProgressRing percentage={progress} />

                {progress === 100 && (
                  <button
                    onClick={e => handleDownloadCertificate(e, enrollment.id, course?.slug)}
                    title="Descargar certificado"
                    data-testid={`btn-certificate-${enrollment.id}`}
                    style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "6px",
                      padding: "8px 14px", borderRadius: "var(--r-full)",
                      background: "var(--accent-dim)", border: "1px solid var(--accent-glow)",
                      color: "var(--accent)", fontSize: "12px", fontWeight: 500, cursor: "pointer" }}>
                    <Download size={13} /> Certificado
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}