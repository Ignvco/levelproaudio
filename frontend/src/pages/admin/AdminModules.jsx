// pages/admin/AdminModules.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSearchParams, Link } from "react-router-dom"
import {
  getAdminModules, createAdminModule,
  updateAdminModule, deleteAdminModule, getAdminCourses,
} from "../../api/admin.api"
import { FormModal, FormField, formInputStyle, ConfirmationModal } from "../../components/admin/ui"

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
      queryClient.invalidateQueries(["admin-modules"])
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
    onSuccess:  () => { queryClient.invalidateQueries(["admin-modules"]); setToDelete(null) },
  })

  const modules = data?.results || data || []
  const courses = coursesData?.results || coursesData || []
  const currentCourse = courses.find(c => c.id.toString() === courseFilter)

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      {modal && (
        <ModuleModal
          module={modal === "new" ? null : modal}
          courseId={courseFilter}
          courses={courses}
          onClose={() => setModal(null)}
          onSave={() => queryClient.invalidateQueries(["admin-modules"])}
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

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "28px", gap: "16px",
        flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px",
            marginBottom: "8px", fontSize: "13px", color: "var(--text-3)" }}>
            <Link to="/admin/academy" className="hover-accent"
              style={{ transition: "color var(--dur)" }}>
              Academia
            </Link>
            <span>/</span>
            <span style={{ color: "var(--text-2)" }}>
              {currentCourse?.title || "Todos los módulos"}
            </span>
          </div>
          <h1 style={{ fontFamily: "var(--font-display)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 800,
            letterSpacing: "-0.02em", marginBottom: "6px" }}>
            Módulos
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            {modules.length} módulos
          </p>
        </div>
        <button onClick={() => setModal("new")} className="btn btn-accent"
          style={{ padding: "10px 20px", fontSize: "13px" }}>
          + Nuevo módulo
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "56px" }} />
          ))}
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ display: "grid", gridTemplateColumns: "48px 3fr 2fr 1.4fr 80px", minWidth: "600px",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>#</span><span>Título</span>
            <span>Curso</span><span>Lecciones</span><span />
          </div>
          {modules.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px" }}>
              Sin módulos. Crea el primero arriba.
            </div>
          ) : modules.map((mod, i) => (
            <div key={mod.id} style={{
              display: "grid", gridTemplateColumns: "48px 3fr 2fr 1.4fr 80px", minWidth: "600px",
              padding: "13px 20px", alignItems: "center",
              borderTop: i > 0 ? "1px solid var(--border)" : "none", gap: "8px",
              transition: "background var(--dur) var(--ease)",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ fontSize: "13px", fontWeight: 600,
                color: "var(--text-3)" }}>{mod.order}</span>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 500 }}>{mod.title}</p>
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {mod.course_title || courses.find(c => c.id === mod.course)?.title || "—"}
              </span>
              <Link to={`/admin/academy/lessons?module=${mod.id}`}
                data-testid={`module-lessons-link-${mod.id}`}
                style={{
                  fontSize: "12px", fontWeight: 500, textDecoration: "none",
                  color: "#60a5fa", justifySelf: "start",
                  padding: "4px 10px", borderRadius: "var(--r-full)",
                  background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)",
                }}>
                {mod.lessons_count ?? 0} lecciones →
              </Link>
              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={() => setModal(mod)} style={{
                  padding: "4px 8px", borderRadius: "var(--r-sm)", fontSize: "11px",
                  cursor: "pointer", color: "#60a5fa",
                  background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)",
                }}>✎</button>
                <button onClick={() => setToDelete(mod)} style={{
                  padding: "4px 8px", borderRadius: "var(--r-sm)", fontSize: "11px",
                  cursor: "pointer", color: "#EF4444",
                  background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)",
                }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}