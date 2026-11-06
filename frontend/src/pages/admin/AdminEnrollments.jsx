// pages/admin/AdminEnrollments.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getAdminEnrollments, createAdminEnrollment,
  getAdminCourses, getAdminUsers,
} from "../../api/admin.api"
import { AdminPageHeader, PrimaryButton, SecondaryButton, StatCard, FormModal, FormField, formInputStyle, ErrorState } from "../../components/admin/ui"
import { Users, CheckCircle2, GraduationCap } from "lucide-react"
import { listFromResponse, queryDisplayState } from "../../utils/queryDisplayState"
import { enrollmentProgress } from "../../utils/adminListData"

function EnrollModal({ courses, users, coursesQuery, usersQuery, onClose }) {
  const [form, setForm]     = useState({ user: "", course: "" })
  const [error, setError]   = useState("")
  const queryClient         = useQueryClient()
  const coursesState = queryDisplayState(coursesQuery)
  const usersState = queryDisplayState(usersQuery)
  const ready = coursesState === "ready" && usersState === "ready"

  const mutation = useMutation({
    mutationFn: createAdminEnrollment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-enrollments"] })
      onClose()
    },
    onError: (e) => setError(e?.response?.data?.detail || "Error al inscribir."),
  })

  return (
    <FormModal
      open
      title="Inscripción manual"
      onClose={onClose}
      onSave={() => {
        if (!ready || mutation.isPending) return
        if (!form.user || !form.course) { setError("Selecciona un usuario y un curso."); return }
        setError("")
        mutation.mutate(form)
      }}
      saving={mutation.isPending}
      saveDisabled={!ready}
      scrollableBody
      saveLabel="Inscribir"
      error={error}
      maxWidth="400px"
      testId="enroll-modal"
    >
      {(coursesState === "loading" || usersState === "loading") && <p role="status">Cargando opciones…</p>}
      {coursesState === "error" && <ErrorState title="No se pudieron cargar los cursos"
        action={<SecondaryButton onClick={() => coursesQuery.refetch()}>Reintentar cursos</SecondaryButton>} />}
      {usersState === "error" && <ErrorState title="No se pudieron cargar los usuarios"
        action={<SecondaryButton onClick={() => usersQuery.refetch()}>Reintentar usuarios</SecondaryButton>} />}
      {usersState === "ready" && usersQuery.data?.count > users.length && (
        <p className="au-formfield__help">Mostrando {users.length} de {usersQuery.data.count} usuarios.</p>
      )}
      <FormField label="Usuario *">
        <select value={form.user} onChange={e => setForm(p => ({ ...p, user: e.target.value }))}
          disabled={usersState !== "ready"} style={formInputStyle}>
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
          disabled={coursesState !== "ready"} style={formInputStyle}>
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
  const enrollmentsQuery = useQuery({
    queryKey: ["admin-enrollments"], queryFn: () => getAdminEnrollments({}),
  })
  const coursesQuery = useQuery({
    queryKey: ["admin-courses"], queryFn: () => getAdminCourses({}),
  })
  const usersQuery = useQuery({
    queryKey: ["admin-users"], queryFn: () => getAdminUsers({}),
  })

  const state = queryDisplayState(enrollmentsQuery)
  const coursesState = queryDisplayState(coursesQuery)
  const usersState = queryDisplayState(usersQuery)
  const enrollments = listFromResponse(enrollmentsQuery.data)
  const courses = listFromResponse(coursesQuery.data)
  const users = listFromResponse(usersQuery.data)
  const progress = enrollments.map(enrollmentProgress)
  const progressKnown = state === "ready" && progress.every(p => p !== null)
  const completedCount = progressKnown ? progress.filter(p => p === 100).length : "—"
  const avgProgress = progressKnown && progress.length
    ? `${Math.round(progress.reduce((sum, p) => sum + p, 0) / progress.length)}%` : "—"
  const canEnroll = state === "ready" && coursesState === "ready" && usersState === "ready"

  return (
    <div className="au-page">
      {modal && (
        <EnrollModal
          courses={courses} users={users}
          coursesQuery={coursesQuery} usersQuery={usersQuery}
          onClose={() => setModal(false)}
        />
      )}

      <AdminPageHeader
        eyebrow="LEVELPRO / ACADEMIA"
        title="Inscripciones"
        description={state === "ready" ? `${enrollments.length} inscripciones en esta vista · hasta 200 recientes` : undefined}
        breadcrumbs={[
          { label: "Academia", to: "/admin/academy" },
          { label: "Inscripciones" },
        ]}
        actions={
          <>
            <SecondaryButton to="/admin/academy" size="sm">← Cursos</SecondaryButton>
            <PrimaryButton disabled={!canEnroll} onClick={() => setModal(true)}>+ Inscripción manual</PrimaryButton>
          </>
        }
      />

      <div className="lp-kpi-strip">
        <StatCard
          variant="ink"
          Icon={Users}
          label="Inscripciones"
          value={state === "ready" ? enrollments.length : "—"}
          sub="En esta vista"
        />
        <StatCard
          variant="primary"
          Icon={CheckCircle2}
          label="Cursos completados"
          value={completedCount}
          sub="Avance 100% en esta vista"
        />
        <StatCard
          variant="light"
          Icon={GraduationCap}
          label="Avance promedio"
          value={avgProgress}
          sub="Inscripciones de esta vista"
        />
      </div>

      {coursesState === "error" && <ErrorState title="No se pudieron cargar los cursos"
        action={<SecondaryButton onClick={() => coursesQuery.refetch()}>Reintentar cursos</SecondaryButton>} />}
      {usersState === "error" && <ErrorState title="No se pudieron cargar los usuarios"
        action={<SecondaryButton onClick={() => usersQuery.refetch()}>Reintentar usuarios</SecondaryButton>} />}
      {state === "error" ? (
        <ErrorState title="No se pudieron cargar las inscripciones"
          action={<SecondaryButton onClick={() => enrollmentsQuery.refetch()}>Reintentar inscripciones</SecondaryButton>} />
      ) : state === "loading" ? (
        <div role="status" aria-label="Cargando inscripciones" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
                ) : enrollments.map((enr) => {
                  const percent = enrollmentProgress(enr)
                  return (
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
                        {percent !== null && <div role="progressbar" aria-label={`Progreso de ${enr.user_email} en ${enr.course_title}`}
                          aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}
                          style={{ flex: 1, height: "6px", borderRadius: "9999px",
                          background: "var(--admin-surface-muted)", overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: "9999px",
                            width: `${percent}%`,
                            background: "var(--admin-primary)",
                            transition: "width 600ms ease",
                          }} />
                        </div>}
                        <span style={{ fontSize: "11.5px", color: "var(--admin-primary-text)",
                          fontWeight: 700, fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                          {percent === null ? "—" : `${percent}%`}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--admin-text-muted)", fontFamily: "var(--font-mono)" }}>
                      {new Date(enr.enrolled_at || enr.created_at).toLocaleDateString("es-CL", {
                        day: "numeric", month: "short", year: "2-digit"
                      })}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
