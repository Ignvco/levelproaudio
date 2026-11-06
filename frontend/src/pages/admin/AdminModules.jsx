// pages/admin/AdminModules.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSearchParams, Link } from "react-router-dom"
import {
  getAdminModules, createAdminModule,
  updateAdminModule, deleteAdminModule, getAdminCourses,
} from "../../api/admin.api"
import {
  AdminPageHeader, PrimaryButton, SecondaryButton, IconButton,
  FormModal, FormField, formInputStyle, ConfirmationModal,
} from "../../components/admin/ui"
import { showToast } from "../../components/ui/ToastNotification"
import { Pencil, Trash2 } from "lucide-react"

function ModuleModal({ module, courseId, courses = [], onClose, onSave }) {
  const [form, setForm]     = useState({
    title:  module?.title  || "",
    order:  module?.order  ?? 1,
    course: module?.course || courseId || "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")
  const queryClient         = useQueryClient()

  const handleSave = () => {
    if (!form.title.trim()) { setError("El título es requerido."); return }
    if (!form.course)       { setError("Seleccioná un curso."); return }
    setSaving(true); setError("")
    const payload = { title: form.title.trim(), order: form.order, course: form.course }
    const req = module?.id
      ? updateAdminModule(module.id, payload)
      : createAdminModule(payload)
    req.then(() => {
      queryClient.invalidateQueries({ queryKey: ["admin-modules"] })
      onSave?.(); onClose()
    }).catch(e => {
      setError(e?.response?.data?.detail || e?.response?.data?.course?.[0] || "Error al guardar.")
    }).finally(() => setSaving(false))
  }

  return (
    <FormModal
      open
      title={module?.id ? "Editar módulo" : "Nuevo módulo"}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      error={error}
      testId="module-modal"
    >
      <FormField label="Curso *">
        <select value={form.course}
          onChange={e => setForm(p => ({ ...p, course: e.target.value }))}
          style={formInputStyle} data-testid="module-course-select">
          <option value="">Seleccionar curso</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Título *">
        <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          style={formInputStyle} placeholder="Nombre del módulo" data-testid="module-title-input" />
      </FormField>
      <FormField label="Orden">
        <input type="number" value={form.order} min="1"
          onChange={e => setForm(p => ({ ...p, order: parseInt(e.target.value) || 1 }))}
          style={formInputStyle} />
      </FormField>
    </FormModal>
  )
}

export default function AdminModules() {
  const [searchParams]    = useSearchParams()
  const courseFilter      = searchParams.get("course") || ""
  const [modal, setModal]     = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const queryClient       = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin-modules", courseFilter],
    queryFn:  () => getAdminModules(courseFilter ? { course: courseFilter } : {}),
  })
  const { data: coursesData } = useQuery({
    queryKey: ["admin-courses"], queryFn: getAdminCourses,
  })
  const deleteMutation = useMutation({
    mutationFn: deleteAdminModule,
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ["admin-modules"] }); setToDelete(null) },
    onError:    (e) => {
      showToast(e?.response?.data?.detail || "No se pudo eliminar el módulo.", "error")
      setToDelete(null)
    },
  })

  const rawModules = data?.results ?? data
  const modules = Array.isArray(rawModules) ? rawModules : []
  const rawCourses = coursesData?.results ?? coursesData
  const courses = Array.isArray(rawCourses) ? rawCourses : []
  const currentCourse = courses.find(c => c.id.toString() === courseFilter)

  return (
    <div className="au-page">
      {modal && (
        <ModuleModal
          module={modal === "new" ? null : modal}
          courseId={courseFilter}
          courses={courses}
          onClose={() => setModal(null)}
          onSave={() => queryClient.invalidateQueries({ queryKey: ["admin-modules"] })}
        />
      )}

      <ConfirmationModal
        open={!!toDelete}
        title="¿Eliminar módulo?"
        description={toDelete ? `Se eliminará "${toDelete.title}" y sus lecciones.` : ""}
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
        testId="delete-module-modal"
      />

      <AdminPageHeader
        eyebrow="LEVELPRO / ACADEMIA"
        title="Módulos"
        description={`${modules.length} módulos configurados`}
        breadcrumbs={[
          { label: "Academia", to: "/admin/academy" },
          { label: currentCourse?.title || "Todos los módulos" },
        ]}
        actions={
          <>
            <SecondaryButton to="/admin/academy" size="sm">← Cursos</SecondaryButton>
            <PrimaryButton onClick={() => setModal("new")}>+ Nuevo módulo</PrimaryButton>
          </>
        }
      />

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "56px", borderRadius: "14px" }} />
          ))}
        </div>
      ) : (
        <div className="au-card au-table-wrap">
          <div className="au-tscroll">
            <table className="au-table">
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>#</th>
                  <th>Título</th>
                  <th>Curso</th>
                  <th>Lecciones</th>
                  <th style={{ width: "96px", textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {modules.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "42px", textAlign: "center", color: "var(--admin-text-secondary)" }}>
                      Sin módulos. Crea el primero arriba.
                    </td>
                  </tr>
                ) : modules.map((mod) => (
                  <tr key={mod.id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-text-muted)" }}>
                      {mod.order}
                    </td>
                    <td>
                      <p style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--admin-text)" }}>{mod.title}</p>
                    </td>
                    <td style={{ color: "var(--admin-text-secondary)" }}>
                      {mod.course_title || courses.find(c => c.id === mod.course)?.title || "—"}
                    </td>
                    <td>
                      <Link
                        to={`/admin/academy/lessons?module=${mod.id}`}
                        data-testid={`module-lessons-link-${mod.id}`}
                        className="au-pill-btn au-pill-btn--edit"
                        style={{ display: "inline-flex", padding: "5px 12px", textDecoration: "none", fontSize: "12px" }}
                      >
                        {mod.lessons_count ?? 0} lecciones →
                      </Link>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <IconButton icon={Pencil} label="Editar" onClick={() => setModal(mod)} />
                        <IconButton icon={Trash2} label="Eliminar" danger onClick={() => setToDelete(mod)} />
                      </div>
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