// pages/admin/AdminEnrollments.jsx

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { getAdminEnrollments, getAnalytics } from "../../api/admin.api"
import api from "../../api/client"

export default function AdminEnrollments() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [showManual, setShowManual] = useState(false)
  const [manualForm, setManualForm] = useState({ user_id: "", course_id: "" })
  const [manualMsg, setManualMsg]   = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["admin-enrollments"],
    queryFn:  getAdminEnrollments,
  })

  const enrollments = (data?.results || []).filter(e =>
    !search ||
    e.user_email.toLowerCase().includes(search.toLowerCase()) ||
    e.course_title.toLowerCase().includes(search.toLowerCase())
  )

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/academy/enrollments/${id}/`),
    onSuccess: () => queryClient.invalidateQueries(["admin-enrollments"]),
  })

  const manualMutation = useMutation({
    mutationFn: () => api.post("/admin/enrollments/create/", manualForm).then(r => r.data),
    onSuccess: (data) => {
      setManualMsg(`✓ ${data.created ? "Inscripción creada" : "Ya existía"}: ${data.user} → ${data.course}`)
      queryClient.invalidateQueries(["admin-enrollments"])
    },
    onError: (e) => setManualMsg(`Error: ${JSON.stringify(e.response?.data)}`),
  })

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "28px",
        flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px" }}>
            Inscripciones
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            {data?.results?.length || 0} inscripciones totales
          </p>
        </div>
        <button onClick={() => setShowManual(!showManual)}
          className="btn btn-accent"
          style={{ padding: "10px 20px", fontSize: "13px" }}>
          + Inscribir manualmente
        </button>
      </div>

      {/* Panel inscripción manual */}
      {showManual && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", padding: "20px 24px",
          marginBottom: "20px",
        }}>
          <p style={{ fontSize: "13px", fontWeight: 500, marginBottom: "16px" }}>
            Inscribir usuario en curso manualmente
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "12px",
            alignItems: "end" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px",
                color: "var(--text-2)", marginBottom: "6px" }}>
                ID del usuario (UUID)
              </label>
              <input
                value={manualForm.user_id}
                onChange={e => setManualForm(p => ({ ...p, user_id: e.target.value }))}
                className="input" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px",
                color: "var(--text-2)", marginBottom: "6px" }}>
                ID del curso (UUID)
              </label>
              <input
                value={manualForm.course_id}
                onChange={e => setManualForm(p => ({ ...p, course_id: e.target.value }))}
                className="input" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>
            <button
              onClick={() => manualMutation.mutate()}
              disabled={manualMutation.isPending || !manualForm.user_id || !manualForm.course_id}
              className="btn btn-accent"
              style={{ padding: "10px 20px",
                opacity: manualMutation.isPending ? 0.6 : 1 }}>
              {manualMutation.isPending ? "Inscribiendo..." : "Inscribir"}
            </button>
          </div>
          {manualMsg && (
            <p style={{ fontSize: "13px", marginTop: "12px",
              color: manualMsg.startsWith("✓") ? "var(--accent)" : "var(--danger)" }}>
              {manualMsg}
            </p>
          )}
        </div>
      )}

      {/* Búsqueda */}
      <input
        placeholder="Buscar por email o curso..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="input"
        style={{ maxWidth: "320px", marginBottom: "16px" }}
      />

      {/* Tabla */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "52px" }} />
          ))}
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", overflow: "hidden" }}>

          <div style={{
            display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 60px",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            <span>Usuario</span>
            <span>Curso</span>
            <span>Progreso</span>
            <span>Fecha</span>
            <span />
          </div>

          {enrollments.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px" }}>
              No hay inscripciones todavía.
            </div>
          ) : enrollments.map((e, i) => (
            <div key={e.id} style={{
              display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 60px",
              padding: "13px 20px", alignItems: "center",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              transition: "background var(--dur) var(--ease)",
            }}
              className="hover:bg-[var(--surface-2)]"
            >
              <div>
                <p style={{ fontSize: "13px" }}>{e.user_email}</p>
                {e.user_name && (
                  <p style={{ fontSize: "11px", color: "var(--text-3)" }}>{e.user_name}</p>
                )}
              </div>

              <span style={{ fontSize: "13px", color: "var(--text-2)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {e.course_title}
              </span>

              {/* Progress bar */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ flex: 1, height: "4px", borderRadius: "2px",
                  background: "var(--surface-3)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: "2px",
                    width: `${e.progress}%`,
                    background: e.progress === 100 ? "var(--accent)"
                      : e.progress > 0 ? "#facc15" : "var(--surface-3)",
                    transition: "width 0.4s ease",
                  }} />
                </div>
                <span style={{ fontSize: "11px", color: "var(--text-3)",
                  flexShrink: 0, width: "28px", textAlign: "right" }}>
                  {e.progress}%
                </span>
              </div>

              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {e.created_at}
              </span>

              <button
                onClick={() => {
                  if (window.confirm("¿Eliminar esta inscripción?")) {
                    deleteMutation.mutate(e.id)
                  }
                }}
                style={{
                  padding: "4px 10px", borderRadius: "100px", fontSize: "11px",
                  cursor: "pointer", color: "#f87171",
                  background: "rgba(248,113,113,0.08)",
                  border: "1px solid rgba(248,113,113,0.2)",
                }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}