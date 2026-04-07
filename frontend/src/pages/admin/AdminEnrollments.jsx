// pages/admin/AdminEnrollments.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getAdminEnrollments, createAdminEnrollment,
  getAdminCourses, getAdminUsers,
} from "../../api/admin.api"

const inputSt = {
  width: "100%", padding: "10px 14px",
  background: "var(--surface-2)", border: "1px solid var(--border)",
  borderRadius: "var(--r-md)", color: "var(--text)",
  fontSize: "13px", outline: "none",
}

function EnrollModal({ courses, users, onClose, onSave }) {
  const [form, setForm]     = useState({ user: "", course: "" })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")
  const queryClient         = useQueryClient()

  const mutation = useMutation({
    mutationFn: createAdminEnrollment,
    onSuccess: () => {
      queryClient.invalidateQueries(["admin-enrollments"])
      onSave?.(); onClose()
    },
    onError: (e) => setError(e?.response?.data?.detail || "Error al inscribir."),
  })

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(8px)", zIndex: 200, display: "flex",
      alignItems: "center", justifyContent: "center", padding: "24px" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-2xl)", width: "100%", maxWidth: "400px",
        animation: "scaleIn 200ms var(--ease)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: "15px", fontWeight: 500 }}>Inscripción manual</p>
          <button onClick={onClose} style={{ background: "none", border: "none",
            cursor: "pointer", color: "var(--text-3)", fontSize: "22px" }}>×</button>
        </div>
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)",
              background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.2)",
              color: "var(--danger)", fontSize: "13px" }}>{error}</div>
          )}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "7px" }}>Usuario *</label>
            <select value={form.user} onChange={e => setForm(p => ({ ...p, user: e.target.value }))}
              style={inputSt}>
              <option value="">Seleccionar usuario</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name} — {u.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "7px" }}>Curso *</label>
            <select value={form.course} onChange={e => setForm(p => ({ ...p, course: e.target.value }))}
              style={inputSt}>
              <option value="">Seleccionar curso</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)",
          display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onClose} className="btn btn-ghost"
            style={{ padding: "9px 18px", fontSize: "13px" }}>Cancelar</button>
          <button
            onClick={() => form.user && form.course && mutation.mutate(form)}
            disabled={mutation.isPending || !form.user || !form.course}
            className="btn btn-accent"
            style={{ padding: "9px 18px", fontSize: "13px",
              opacity: mutation.isPending ? 0.7 : 1 }}>
            {mutation.isPending ? "Inscribiendo..." : "Inscribir"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminEnrollments() {
  const [modal, setModal] = useState(false)
  const queryClient       = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin-enrollments"], queryFn: getAdminEnrollments,
  })
  const { data: coursesData } = useQuery({
    queryKey: ["admin-courses"], queryFn: getAdminCourses,
  })
  const { data: usersData } = useQuery({
    queryKey: ["admin-users"], queryFn: getAdminUsers,
  })

  const enrollments = data?.results || data || []
  const courses     = coursesData?.results || coursesData || []
  const users       = usersData?.results   || usersData   || []

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      {modal && (
        <EnrollModal
          courses={courses} users={users}
          onClose={() => setModal(false)}
          onSave={() => queryClient.invalidateQueries(["admin-enrollments"])}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "28px", gap: "16px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 300,
            letterSpacing: "-0.02em", marginBottom: "6px" }}>
            Inscripciones
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            {enrollments.length} inscripciones totales
          </p>
        </div>
        <button onClick={() => setModal(true)} className="btn btn-accent"
          style={{ padding: "10px 20px", fontSize: "13px" }}>
          + Inscripción manual
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "56px" }} />
          ))}
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)", overflow: "hidden" }}>
          <div style={{ display: "grid",
            gridTemplateColumns: "2fr 2fr 1fr 1fr",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>Curso</span><span>Usuario</span>
            <span>Progreso</span><span>Fecha</span>
          </div>

          {enrollments.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px" }}>
              Sin inscripciones todavía.
            </div>
          ) : enrollments.map((enr, i) => (
            <div key={enr.id} style={{
              display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr",
              padding: "14px 20px", alignItems: "center",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              gap: "8px", transition: "background var(--dur) var(--ease)",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <p style={{ fontSize: "13px", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {enr.course_title}
              </p>
              <p style={{ fontSize: "13px", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap",
                color: "var(--text-2)" }}>
                {enr.user_email}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ flex: 1, height: "4px", borderRadius: "2px",
                  background: "var(--surface-3)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: "2px",
                    width: `${enr.progress_percentage || 0}%`,
                    background: "var(--accent)",
                    transition: "width 600ms var(--ease)",
                  }} />
                </div>
                <span style={{ fontSize: "11px", color: "var(--accent)",
                  fontWeight: 500, flexShrink: 0 }}>
                  {enr.progress_percentage || 0}%
                </span>
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {new Date(enr.enrolled_at || enr.created_at).toLocaleDateString("es-CL", {
                  day: "numeric", month: "short", year: "2-digit"
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}