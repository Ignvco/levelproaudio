// pages/Academy.jsx
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getCourses } from "../api/academy.api"
import { useScrollReveal } from "../hooks/useScrollReveal"
import CourseCard from "../components/academy/CourseCard"
import Seo from "../components/Seo"

export default function Academy() {
  const [level, setLevel] = useState("")
  const headerRef = useScrollReveal()

  const { data, isLoading } = useQuery({
    queryKey: ["courses", { level }],
    queryFn:  () => getCourses({ level: level || undefined }),
  })
  const courses = data?.results || data || []

  const LEVELS = [
    { value: "",             label: "Todos"         },
    { value: "beginner",     label: "Principiante"  },
    { value: "intermediate", label: "Intermedio"    },
    { value: "advanced",     label: "Avanzado"      },
  ]

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Seo title="Academia" description="Cursos técnicos de audio en video con instructores del oficio: producción, mezcla, masterización y más. Certificaciones LevelPro." />

      {/* Header */}
      <div ref={headerRef} style={{
        padding: "clamp(60px, 9vw, 100px) 0 clamp(40px, 6vw, 64px)",
        position: "relative",
      }}>
        <div className="lp-container">
          <p style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 600,
            letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "16px",
            display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%",
              background: "var(--accent)",
              boxShadow: "0 0 12px var(--accent)" }} />
            Academia
          </p>
          <h1 className="display-bold" style={{
            fontFamily:    "var(--font-display)",
            fontSize:      "clamp(2.6rem, 5.8vw, 4.5rem)",
            fontWeight:    700,
            lineHeight:    1,
            letterSpacing: "-0.045em",
            marginBottom:  "24px",
            color: "var(--text)",
          }}>
            Aprendé a{" "}
            <span style={{ fontStyle: "italic", fontWeight: 500,
              color: "var(--accent)" }}>
              producir.
            </span>
          </h1>
          <p style={{ fontSize: "17px", color: "var(--text-2)", maxWidth: "540px",
            marginBottom: "36px", lineHeight: 1.55, fontWeight: 400 }}>
            Cursos online de producción musical, mezcla, masterización y más.
            Para todos los niveles.
          </p>

          {/* Filtros */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {LEVELS.map(({ value, label }) => (
              <button key={value}
                onClick={() => setLevel(value)}
                style={{
                  padding:      "8px 18px",
                  borderRadius: "var(--r-full)",
                  fontSize:     "13px", fontWeight: 500,
                  cursor:       "pointer",
                  background:   level === value ? "var(--text)" : "transparent",
                  color:        level === value ? "var(--bg)" : "var(--text-2)",
                  border:       level === value ? "1px solid var(--text)" : "1px solid var(--border)",
                  transition:   "all var(--dur) var(--ease)",
                  fontFamily:   "var(--font-sans)",
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="lp-container" style={{ paddingBlock: "clamp(32px, 4vw, 48px)" }}>

        {isLoading ? (
          <div className="academy-grid" style={{ display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "360px" }} />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0",
            color: "var(--text-3)", fontSize: "15px" }}>
            No hay cursos disponibles todavía.
          </div>
        ) : (
          <div className="academy-grid" style={{ display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
            {courses.map((course, i) => (
              <CourseCard key={course.id} course={course} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}