// pages/admin/AdminAcademy.jsx

import { useQuery } from "@tanstack/react-query"
import { getAdminAcademy } from "../../api/admin.api"

const levelLabels = {
  beginner: "Principiante", intermediate: "Intermedio", advanced: "Avanzado",
}
const levelColors = {
  beginner: "#4ade80", intermediate: "#facc15", advanced: "#f87171",
}

export default function AdminAcademy() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-academy"],
    queryFn:  getAdminAcademy,
  })

  const courses = data?.results || []
  const totalEnrollments = courses.reduce((a, c) => a + c.enrollment_count, 0)

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px" }}>
            Academia
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            {courses.length} cursos · {totalEnrollments} inscripciones totales
          </p>
        </div>
        <a href="/admin/academy/course/add/" target="_blank"
          className="btn btn-accent" style={{ padding: "10px 20px", fontSize: "13px" }}>
          + Nuevo curso
        </a>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: "56px" }} />)}
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", overflow: "hidden" }}>

          <div style={{ display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>Curso</span>
            <span>Nivel</span>
            <span>Precio</span>
            <span>Lecciones</span>
            <span>Inscritos</span>
            <span>Estado</span>
          </div>

          {courses.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px" }}>
              No hay cursos todavía.
            </div>
          ) : courses.map((c, i) => (
            <div key={c.id} style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
              padding: "13px 20px", alignItems: "center",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              transition: "background var(--dur) var(--ease)",
            }}
              className="hover:bg-[var(--surface-2)]"
            >
              <div>
                <p style={{ fontSize: "13px", fontWeight: 400 }}>{c.title}</p>
                <p style={{ fontSize: "11px", color: "var(--text-3)",
                  fontFamily: "monospace" }}>{c.slug}</p>
              </div>

              <span style={{
                fontSize: "11px", fontWeight: 500,
                color: levelColors[c.level] || "var(--text-3)",
                padding: "2px 8px", borderRadius: "100px",
                background: `${levelColors[c.level]}14`,
                border: `1px solid ${levelColors[c.level]}30`,
                display: "inline-block",
              }}>
                {levelLabels[c.level] || c.level}
              </span>

              <span style={{ fontSize: "13px" }}>
                {c.is_free ? (
                  <span style={{ color: "var(--accent)", fontWeight: 500 }}>Gratis</span>
                ) : `$${Number(c.price).toLocaleString("es-CL")}`}
              </span>

              <span style={{ fontSize: "13px", color: "var(--text-2)" }}>
                {c.total_lessons}
              </span>

              <span style={{ fontSize: "13px", fontWeight: 500 }}>
                {c.enrollment_count}
              </span>

              <span style={{
                fontSize: "11px", padding: "2px 8px", borderRadius: "100px",
                fontWeight: 500,
                color:      c.is_published ? "#4ade80" : "var(--text-3)",
                background: c.is_published ? "rgba(74,222,128,0.1)" : "var(--surface-3)",
                border:     `1px solid ${c.is_published ? "rgba(74,222,128,0.25)" : "var(--border)"}`,
              }}>
                {c.is_published ? "Publicado" : "Borrador"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}