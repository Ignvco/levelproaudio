// pages/admin/AdminAcademy.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getAdminCourses, createAdminCourse,
  updateAdminCourse, deleteAdminCourse,
} from "../../api/admin.api"
import { mediaUrl } from "../../utils/mediaUrl"
import { showToast } from "../../components/ui/ToastNotification"
import { Link } from "react-router-dom"
import { Pencil, Trash2 } from "lucide-react"
import BulkImportPanel from "../../components/admin/BulkImportPanel"
import { FormModal, FormField, formInputStyle, ConfirmationModal } from "../../components/admin/ui"

function CourseModal({ course, onClose, onSave }) {
  const [form, setForm]       = useState({
    title:             course?.title             || "",
    slug:              course?.slug              || "",
    short_description: course?.short_description || "",
    description:       course?.description       || "",
    price:             course?.price             || "",
    level:             course?.level             || "beginner",
    is_published:      course?.is_published      ?? true,
    is_free:           course?.is_free           ?? false,
  })
  const [thumbnail, setThumbnail] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState("")

  const handleSave = async () => {
    if (!form.title.trim()) { setError("El título es requerido."); return }
    setSaving(true); setError("")
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      if (thumbnail) fd.append("thumbnail", thumbnail)
      if (course?.id) await updateAdminCourse(course.id, fd)
      else await createAdminCourse(fd)
      onSave(); onClose()
    } catch (e) {
      const data = e?.response?.data
      setError(data?.detail || (data && typeof data === "object"
        ? Object.entries(data).map(([f, m]) => `${f}: ${Array.isArray(m) ? m.join(", ") : m}`).join(" · ")
        : "Error al guardar."))
    } finally { setSaving(false) }
  }

  return (
    <FormModal
      open
      title={course?.id ? "Editar curso" : "Nuevo curso"}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      error={error}
      maxWidth="540px"
      scrollableBody
      testId="course-modal"
    >
      <FormField label="Título *">
        <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          style={formInputStyle} placeholder="Nombre del curso" />
      </FormField>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <FormField label="Nivel">
          <select value={form.level} onChange={e => setForm(p => ({ ...p, level: e.target.value }))}
            style={formInputStyle}>
            <option value="beginner">Principiante</option>
            <option value="intermediate">Intermedio</option>
            <option value="advanced">Avanzado</option>
          </select>
        </FormField>
        <FormField label="Precio (CLP)">
          <input type="number" min="0" value={form.price}
            onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
            disabled={form.is_free}
            style={{ ...formInputStyle, opacity: form.is_free ? 0.4 : 1 }}
            placeholder="0" />
        </FormField>
      </div>
      <FormField label="Descripción corta">
        <textarea value={form.short_description} rows={2}
          onChange={e => setForm(p => ({ ...p, short_description: e.target.value }))}
          style={{ ...formInputStyle, resize: "vertical" }} />
      </FormField>
      <FormField label="Descripción completa">
        <textarea value={form.description} rows={4}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          style={{ ...formInputStyle, resize: "vertical" }} />
      </FormField>
      <FormField label="Miniatura">
        <input type="file" accept="image/*"
          onChange={e => setThumbnail(e.target.files?.[0])}
          style={{ ...formInputStyle, padding: "8px" }} />
        {course?.thumbnail_url && !thumbnail && (
          <div style={{ marginTop: "8px" }}>
            <img src={mediaUrl(course.thumbnail_url)} alt=""
              style={{ height: "60px", borderRadius: "var(--r-md)", objectFit: "cover" }} />
          </div>
        )}
      </FormField>
      <div style={{ display: "flex", gap: "20px" }}>
        {[
          { key: "is_published", label: "Publicado (visible en la web)" },
          { key: "is_free",   label: "Gratuito" },
        ].map(({ key, label }) => (
          <label key={key} style={{ display: "flex", alignItems: "center",
            gap: "8px", cursor: "pointer", fontSize: "13px" }}>
            <input type="checkbox" checked={form[key]}
              onChange={e => setForm(p => ({ ...p, [key]: e.target.checked }))}
              style={{ accentColor: "var(--accent)" }} />
            {label}
          </label>
        ))}
      </div>
    </FormModal>
  )
}

export default function AdminAcademy() {
  const [modal, setModal]     = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const queryClient       = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin-courses"], queryFn: getAdminCourses,
  })
  const deleteMutation = useMutation({
    mutationFn: deleteAdminCourse,
    onSuccess:  () => { queryClient.invalidateQueries(["admin-courses"]); setToDelete(null) },
    onError:    (e) => {
      showToast(e?.response?.data?.detail || "No se pudo eliminar el curso.", "error")
      setToDelete(null)
    },
  })
  const courses = data?.results || data || []

  const LEVELS = {
    beginner:     { label: "Principiante", color: "#0F9940" },
    intermediate: { label: "Intermedio",   color: "#D97706" },
    advanced:     { label: "Avanzado",     color: "#EF4444" },
  }

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      {modal && (
        <CourseModal
          course={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => queryClient.invalidateQueries(["admin-courses"])}
        />
      )}

      <ConfirmationModal
        open={!!toDelete}
        title="¿Eliminar curso?"
        description={toDelete ? `Se eliminará "${toDelete.title}" permanentemente.` : ""}
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
        testId="delete-course-modal"
      />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "28px", gap: "16px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 800,
            letterSpacing: "-0.02em", marginBottom: "6px" }}>
            Academia
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            {courses.length} cursos publicados
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link to="/admin/enrollments" className="btn btn-ghost"
            style={{ padding: "10px 16px", fontSize: "13px" }}>
            Inscripciones →
          </Link>
          <button onClick={() => setModal("new")} className="btn btn-accent"
            style={{ padding: "10px 20px", fontSize: "13px" }}>
            + Nuevo curso
          </button>
        </div>
      </div>

      {/* Bulk import */}
      <div style={{ marginBottom: "22px" }}>
        <BulkImportPanel
          endpoint="/admin/courses/import/"
          entityLabel="cursos"
          templateColumns={["titulo", "precio", "descripcion_corta", "nivel", "duracion_horas", "publicado"]}
          templateExample={["Mezcla y Master Pro", "89990", "Curso avanzado de mezcla", "avanzado", "12", "si"]}
          invalidateKey="admin-courses"
          testId="bulk-import-courses" />
      </div>

      {isLoading ? (
        <div style={{ display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "200px" }} />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 24px",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-2xl)" }}>
          <p style={{ fontSize: "40px", marginBottom: "12px" }}>🎬</p>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800,
            fontSize: "1.4rem", marginBottom: "8px" }}>Sin cursos</h3>
          <p style={{ fontSize: "14px", color: "var(--text-3)", marginBottom: "20px" }}>
            Crea el primer curso de la academia.
          </p>
          <button onClick={() => setModal("new")} className="btn btn-accent">
            + Nuevo curso
          </button>
        </div>
      ) : (
        <div style={{ display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
          {courses.map(course => {
            const lvl = LEVELS[course.level] || { label: course.level, color: "#888" }
            return (
              <div key={course.id} className="au-acard">
                <div className="au-acard__strip" />
                <div className="au-acard__head">
                  <span className="au-acard__tag" style={{ background: lvl.color, color: "#000" }}>{lvl.label}</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {course.is_free && <span className="au-acard__tag" style={{ background: "var(--accent)", color: "#00160b" }}>Gratis</span>}
                    {!course.is_published && <span className="au-acard__tag" style={{ background: "#f59e0b", color: "#000" }}>Borrador</span>}
                  </div>
                </div>
                <p className="au-acard__title">{course.title}</p>
                <p className="au-acard__sub">{course.total_lessons || 0} lecciones · {course.enrollment_count || 0} inscritos</p>
                <div className="au-acard__foot">
                  <span className="au-acard__price">
                    {course.is_free ? "Gratis" : `$${Number(course.price).toLocaleString("es-CL")}`}
                  </span>
                  <div className="au-acard__actions">
                    <Link to={`/admin/academy/modules?course=${course.id}`}
                      className="au-pill-btn au-pill-btn--edit" style={{ flex: "none", padding: "8px 13px", textDecoration: "none" }}>
                      Módulos →
                    </Link>
                    <button onClick={() => setModal(course)} title="Editar"
                      className="au-pill-btn au-pill-btn--edit" style={{ flex: "none", padding: "8px 10px" }}><Pencil size={13} /></button>
                    <button title="Eliminar"
                      onClick={() => setToDelete(course)}
                      className="au-pill-btn au-pill-btn--del" style={{ flex: "none", padding: "8px 10px" }}><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}