// pages/admin/AdminModules.jsx

import { useQuery } from "@tanstack/react-query"
import api from "../../api/client"

export default function AdminModules() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-modules"],
    queryFn:  () => api.get("/admin/academy/modules/").then(r => r.data), // ← corregido
  })

  const modules = data?.results || data || []

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)",
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px" }}>
          Módulos
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
          {modules.length} módulos
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
          <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>Módulo</span><span>Curso</span><span>Orden</span>
          </div>
          {modules.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px" }}>
              No hay módulos. Créalos desde la sección Cursos.
            </div>
          ) : modules.map((m, i) => (
            <div key={m.id} style={{
              display: "grid", gridTemplateColumns: "2fr 2fr 1fr",
              padding: "13px 20px", alignItems: "center",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
            }}>
              <span style={{ fontSize: "13px" }}>{m.title}</span>
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {m.course_title || "—"} {/* ← ahora funciona con el serializer corregido */}
              </span>
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>{m.order}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}