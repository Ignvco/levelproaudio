// pages/dashboard/Courses.jsx
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { getEnrollments } from "../../api/academy.api"
import { mediaUrl } from "../../utils/mediaUrl"

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
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2rem, 4vw, 3rem)",
          fontWeight: 300, letterSpacing: "-0.02em" }}>
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
          <p style={{ fontSize: "48px", marginBottom: "16px" }}>🎓</p>
          <h3 style={{ fontFamily: "var(--font-serif)", fontWeight: 300,
            fontSize: "1.6rem", marginBottom: "8px" }}>
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
              <Link key={enrollment.id}
                to={`/academy/${course?.slug}`}
                style={{ display: "flex", alignItems: "center", gap: "20px",
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "var(--r-xl)", padding: "20px 24px",
                  textDecoration: "none",
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
                      justifyContent: "center", fontSize: "28px" }}>
                      🎬
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
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ flex: 1, height: "4px", borderRadius: "2px",
                      background: "var(--surface-3)", overflow: "hidden" }}>
                      <div style={{ width: `${progress}%`, height: "100%",
                        background: "var(--accent)", borderRadius: "2px",
                        transition: "width 1s var(--ease)" }} />
                    </div>
                    <span style={{ fontSize: "12px", color: "var(--accent)",
                      fontWeight: 500, flexShrink: 0 }}>
                      {progress}%
                    </span>
                  </div>
                  {progress === 100 && (
                    <p style={{ fontSize: "11px", color: "var(--accent)",
                      marginTop: "4px", fontWeight: 500 }}>
                      ✓ Completado
                    </p>
                  )}
                </div>

                {/* Progress ring */}
                <ProgressRing percentage={progress} />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}