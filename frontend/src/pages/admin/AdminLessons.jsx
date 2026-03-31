// pages/admin/AdminLessons.jsx

import { useQuery } from "@tanstack/react-query"
import api from "../../api/client"

export default function AdminLessons() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-lessons"],
    queryFn:  () => api.get("/admin/academy/lessons/").then(r => r.data), // ← corregido
  })

  const lessons = data?.results || data || []

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)",
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px" }}>
          Lecciones
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
          {lessons.length} lecciones en total
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
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 80px",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>Título</span><span>Módulo</span><span>Duración</span>
            <span>Gratis</span><span>Orden</span>
          </div>
          {lessons.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px" }}>
              No hay lecciones todavía.
            </div>
          ) : lessons.map((l, i) => (
            <div key={l.id} style={{
              display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 80px",
              padding: "13px 20px", alignItems: "center",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              transition: "background var(--dur) var(--ease)",
            }} className="hover:bg-[var(--surface-2)]">
              <span style={{ fontSize: "13px" }}>{l.title}</span>
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {l.module_title || "—"} {/* ← ahora funciona */}
              </span>
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {l.duration_minutes ? `${l.duration_minutes}min` : "—"}
              </span>
              <span style={{
                fontSize: "11px", padding: "2px 8px", borderRadius: "100px",
                fontWeight: 500, display: "inline-block",
                color:      l.is_free ? "#4ade80" : "var(--text-3)",
                background: l.is_free ? "rgba(74,222,128,0.1)" : "var(--surface-3)",
                border:     `1px solid ${l.is_free ? "rgba(74,222,128,0.25)" : "var(--border)"}`,
              }}>
                {l.is_free ? "Gratis" : "Pago"}
              </span>
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>{l.order}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}