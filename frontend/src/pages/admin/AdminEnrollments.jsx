// pages/admin/AdminEnrollments.jsx

import { useQuery } from "@tanstack/react-query"
import api from "../../api/client"

export default function AdminEnrollments() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-enrollments"],
    queryFn:  () => api.get("/admin/enrollments/").then(r => r.data),
  })

  const enrollments = data?.results || data || []

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)",
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px" }}>
          Inscripciones
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
          {enrollments.length} inscripciones totales
        </p>
      </div>
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "52px" }} />
          ))}
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>Usuario</span>
            <span>Curso</span>
            <span>Progreso</span>
            <span>Fecha</span>
          </div>
          {enrollments.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px" }}>
              No hay inscripciones todavía.
            </div>
          ) : enrollments.map((e, i) => (
            <div key={e.id} style={{
              display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr",
              padding: "13px 20px", alignItems: "center",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              transition: "background var(--dur) var(--ease)",
            }}
              className="hover:bg-[var(--surface-2)]"
            >
              <span style={{ fontSize: "13px", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {e.user_email || "—"}
              </span>
              <span style={{ fontSize: "13px", color: "var(--text-2)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {e.course_title || "—"}
              </span>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ flex: 1, height: "4px", borderRadius: "2px",
                    background: "var(--surface-3)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: "2px",
                      background: "var(--accent)",
                      width: `${e.progress_percentage || 0}%` }} />
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--text-3)", flexShrink: 0 }}>
                    {e.progress_percentage || 0}%
                  </span>
                </div>
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {new Date(e.created_at).toLocaleDateString("es-CL")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}