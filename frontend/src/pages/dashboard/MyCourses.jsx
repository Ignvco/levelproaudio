// pages/dashboard/MyCourses.jsx

import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { getEnrollments } from "../../api/academy.api"

// ── Progress Ring ────────────────────────────────────────────
function ProgressRing({ pct, size = 48 }) {
  const stroke = 3
  const r      = (size - stroke) / 2
  const circ   = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="var(--surface-3)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={pct === 100 ? "var(--accent)" : "var(--accent)"}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s var(--ease)" }}
      />
    </svg>
  )
}

// ── Status pill ──────────────────────────────────────────────
function StatusPill({ pct }) {
  if (pct === 100) return (
    <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--accent)",
      padding: "2px 8px", borderRadius: "100px",
      background: "rgba(26,255,110,0.1)", border: "1px solid rgba(26,255,110,0.25)" }}>
      Completado
    </span>
  )
  if (pct === 0) return (
    <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
      padding: "2px 8px", borderRadius: "100px",
      background: "var(--surface-3)", border: "1px solid var(--border)" }}>
      Sin iniciar
    </span>
  )
  return (
    <span style={{ fontSize: "11px", fontWeight: 500, color: "#facc15",
      padding: "2px 8px", borderRadius: "100px",
      background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.25)" }}>
      En progreso
    </span>
  )
}

// ── Course row ───────────────────────────────────────────────
function CourseRow({ enrollment }) {
  const { course, progress_percentage: pct } = enrollment

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "16px",
      padding: "16px 20px",
      borderBottom: "1px solid var(--border)",
      transition: "background var(--dur) var(--ease)",
    }}
      className="hover:bg-[var(--surface-2)]"
    >
      {/* Thumbnail */}
      <div style={{
        width: "56px", height: "56px", borderRadius: "var(--r-sm)",
        background: "var(--surface-2)", overflow: "hidden", flexShrink: 0,
        border: "1px solid var(--border)",
      }}>
        {course.thumbnail ? (
          <img src={course.thumbnail} alt={course.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex",
            alignItems: "center", justifyContent: "center", fontSize: "22px" }}>
            🎛️
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "14px", fontWeight: 400, lineHeight: 1.3,
          marginBottom: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {course.title}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <StatusPill pct={pct} />
          {course.total_lessons > 0 && (
            <span style={{ fontSize: "11px", color: "var(--text-3)" }}>
              {course.total_lessons} lecciones
            </span>
          )}
        </div>
      </div>

      {/* Progress ring + CTA */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ProgressRing pct={pct} size={44} />
          <span style={{
            position: "absolute",
            fontSize: "9px", fontWeight: 600,
            color: pct === 100 ? "var(--accent)" : "var(--text-2)",
          }}>
            {pct}%
          </span>
        </div>
        <Link to={`/academy/${course.slug}`}
          className="btn btn-ghost"
          style={{ padding: "7px 16px", fontSize: "12px" }}>
          {pct === 0 ? "Empezar" : pct === 100 ? "Repasar" : "Continuar"}
        </Link>
      </div>
    </div>
  )
}

// ── Certificado ──────────────────────────────────────────────
function Certificate({ enrollment }) {
  return (
    <div style={{
      position: "relative", borderRadius: "var(--r-lg)", overflow: "hidden",
      padding: "20px 24px",
      background: "linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%)",
      border: "1px solid rgba(26,255,110,0.2)",
      marginTop: "8px",
    }}>
      <div style={{
        position: "absolute", top: "-40px", right: "-40px",
        width: "160px", height: "160px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(26,255,110,0.08) 0%, transparent 70%)",
      }} />
      <div style={{ position: "relative", display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: "16px" }}>
        <div>
          <p style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 500,
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>
            Certificado disponible
          </p>
          <p style={{ fontSize: "14px", fontWeight: 400 }}>
            {enrollment.course.title}
          </p>
        </div>
        <button onClick={() => window.print()}
          className="btn btn-ghost" style={{ padding: "8px 16px", fontSize: "12px", flexShrink: 0 }}>
          Descargar
        </button>
      </div>
    </div>
  )
}

// ── MyCourses ────────────────────────────────────────────────
export default function MyCourses() {
  const { data, isLoading } = useQuery({
    queryKey: ["enrollments"],
    queryFn:  getEnrollments,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  })

  const enrollments = data?.results || data || []
  const completed   = enrollments.filter(e => e.progress_percentage === 100)
  const inProgress  = enrollments.filter(e => e.progress_percentage > 0 && e.progress_percentage < 100)
  const notStarted  = enrollments.filter(e => e.progress_percentage === 0)

  const totalMins = enrollments.reduce((a, e) => a + (e.course.total_duration || 0), 0)

  return (
    <div style={{ padding: "clamp(32px, 5vw, 56px)", maxWidth: "720px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "40px", flexWrap: "wrap", gap: "16px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)",
          fontSize: "clamp(2rem, 4vw, 2.8rem)" }}>
          Mis cursos
        </h1>
        <Link to="/academy" className="btn btn-ghost" style={{ padding: "9px 18px", fontSize: "13px" }}>
          Explorar academia →
        </Link>
      </div>

      {/* Stats */}
      {enrollments.length > 0 && (
        <div className="grid grid-cols-3 gap-4" style={{ marginBottom: "40px" }}>
          {[
            { value: enrollments.length,  label: "Inscritos" },
            { value: completed.length,    label: "Completados" },
            { value: `${Math.round(totalMins / 60)}h`, label: "Contenido" },
          ].map(({ value, label }) => (
            <div key={label} style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)", padding: "18px 20px",
            }}>
              <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem",
                lineHeight: 1, marginBottom: "4px" }}>
                {value}
              </p>
              <p style={{ fontSize: "11px", color: "var(--text-3)", textTransform: "uppercase",
                letterSpacing: "0.06em", fontWeight: 500 }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: "88px" }} />)}
        </div>
      )}

      {/* Sin cursos */}
      {!isLoading && enrollments.length === 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)", padding: "64px", textAlign: "center" }}>
          <p style={{ fontSize: "40px", marginBottom: "16px" }}>🎛️</p>
          <p style={{ fontSize: "16px", fontWeight: 500, marginBottom: "8px" }}>
            Sin cursos todavía
          </p>
          <p style={{ fontSize: "14px", color: "var(--text-3)", marginBottom: "28px" }}>
            Explora la academia y empieza a aprender.
          </p>
          <Link to="/academy" className="btn btn-accent">Ver cursos disponibles</Link>
        </div>
      )}

      {/* En progreso */}
      {!isLoading && inProgress.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <p style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
            En progreso
          </p>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)", overflow: "hidden" }}>
            {inProgress.map(e => <CourseRow key={e.id} enrollment={e} />)}
          </div>
        </div>
      )}

      {/* Sin iniciar */}
      {!isLoading && notStarted.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <p style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
            Sin iniciar
          </p>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)", overflow: "hidden" }}>
            {notStarted.map(e => <CourseRow key={e.id} enrollment={e} />)}
          </div>
        </div>
      )}

      {/* Completados */}
      {!isLoading && completed.length > 0 && (
        <div>
          <p style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
            Completados
          </p>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)", overflow: "hidden", marginBottom: "8px" }}>
            {completed.map(e => <CourseRow key={e.id} enrollment={e} />)}
          </div>
          {completed.map(e => <Certificate key={e.id} enrollment={e} />)}
        </div>
      )}
    </div>
  )
}