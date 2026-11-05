// pages/admin/AdminEnrollments.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getAdminEnrollments, createAdminEnrollment,
  getAdminCourses, getAdminUsers,
} from "../../api/admin.api"
import { AdminPageHeader, PrimaryButton, SecondaryButton, StatCard, FormModal, FormField, formInputStyle } from "../../components/admin/ui"
import { Users, CheckCircle2, GraduationCap } from "lucide-react"

function EnrollModal({ courses, users, onClose, onSave }) {
  const [form, setForm]     = useState({ user: "", course: "" })
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
    <FormModal
      open
      title="Inscripción manual"
      onClose={onClose}
      onSave={() => form.user && form.course && mutation.mutate(form)}
      saving={mutation.isPending}
      saveLabel="Inscribir"
      error={error}
      maxWidth="400px"
      testId="enroll-modal"
    >
      <FormField label="Usuario *">
        <select value={form.user} onChange={e => setForm(p => ({ ...p, user: e.target.value }))}
          style={formInputStyle}>
          <option value="">Seleccionar usuario</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>
              {u.first_name} {u.last_name} — {u.email}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Curso *">
        <select value={form.course} onChange={e => setForm(p => ({ ...p, course: e.target.value }))}
          style={formInputStyle}>
          <option value="">Seleccionar curso</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </FormField>
    </FormModal>
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
  const completedCount = enrollments.filter(e => (e.progress_percentage || 0) >= 100).length
  const avgProgress = enrollments.length > 0
    ? Math.round(enrollments.reduce((acc, e) => acc + (Number(e.progress_percentage) || 0), 0) / enrollments.length)
    : 0

  return (
    <div className="au-page">
      {modal && (
        <EnrollModal
          courses={courses} users={users}
          onClose={() => setModal(false)}
          onSave={() => queryClient.invalidateQueries(["admin-enrollments"])}
        />
      )}

      <AdminPageHeader
        eyebrow="LEVELPRO / ACADEMIA"
        title="Inscripciones"
        description={`${enrollments.length} inscripciones registradas`}
        breadcrumbs={[
          { label: "Academia", to: "/admin/academy" },
          { label: "Inscripciones" },
        ]}
        actions={
          <>
            <SecondaryButton to="/admin/academy" size="sm">← Cursos</SecondaryButton>
            <PrimaryButton onClick={() => setModal(true)}>+ Inscripción manual</PrimaryButton>
          </>
        }
      />

      <div className="lp-kpi-strip">
        <StatCard
          variant="ink"
          Icon={Users}
          label="Inscripciones totales"
          value={enrollments.length}
          sub="Alumnos matriculados"
        />
        <StatCard
          variant="primary"
          Icon={CheckCircle2}
          label="Cursos completados"
          value={completedCount}
          sub="Avance 100%"
        />
        <StatCard
          variant="light"
          Icon={GraduationCap}
          label="Avance promedio"
          value={`${avgProgress}%`}
          sub="Sobre matrículas activas"
        />
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "56px", borderRadius: "14px" }} />
          ))}
        </div>
      ) : (
        <div className="au-card au-table-wrap">
          <div className="au-tscroll">
            <table className="au-table">
              <thead>
                <tr>
                  <th>Curso</th>
                  <th>Usuario</th>
                  <th>Progreso</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "42px", textAlign: "center", color: "var(--admin-text-secondary)" }}>
                      Sin inscripciones todavía.
                    </td>
                  </tr>
                ) : enrollments.map((enr) => (
                  <tr key={enr.id}>
                    <td>
                      <p style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--admin-text)" }}>
                        {enr.course_title}
                      </p>
                    </td>
                    <td style={{ color: "var(--admin-text-secondary)", fontFamily: "var(--font-mono)", fontSize: "12.5px" }}>
                      {enr.user_email}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "120px" }}>
                        <div style={{ flex: 1, height: "6px", borderRadius: "9999px",
                          background: "var(--admin-surface-muted)", overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: "9999px",
                            width: `${enr.progress_percentage || 0}%`,
                            background: "var(--admin-primary)",
                            transition: "width 600ms ease",
                          }} />
                        </div>
                        <span style={{ fontSize: "11.5px", color: "var(--admin-primary-text)",
                          fontWeight: 700, fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                          {enr.progress_percentage || 0}%
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--admin-text-muted)", fontFamily: "var(--font-mono)" }}>
                      {new Date(enr.enrolled_at || enr.created_at).toLocaleDateString("es-CL", {
                        day: "numeric", month: "short", year: "2-digit"
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}