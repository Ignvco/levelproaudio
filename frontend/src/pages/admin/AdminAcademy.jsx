// pages/admin/AdminAcademy.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getAdminCourses, createAdminCourse,
  updateAdminCourse, deleteAdminCourse,
} from "../../api/admin.api"
import { mediaUrl } from "../../utils/mediaUrl"
import { Link } from "react-router-dom"
import { Pencil, Trash2 } from "lucide-react"
import BulkImportPanel from "../../components/admin/BulkImportPanel"

const inputSt = {
  width: "100%", padding: "10px 14px",
  background: "var(--surface-2)", border: "1px solid var(--border)",
  borderRadius: "var(--r-md)", color: "var(--text)",
  fontSize: "13px", outline: "none",
}

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
      setError(e?.response?.data?.detail || "Error al guardar.")
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      backdropFilter: "blur(8px)", zIndex: 200, display: "flex",
      alignItems: "center", justifyContent: "center", padding: "24px" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-2xl)", width: "100%", maxWidth: "540px",
        maxHeight: "90vh", display: "flex", flexDirection: "column",
        animation: "scaleIn 200ms var(--ease)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexShrink: 0 }}>
          <p style={{ fontSize: "15px", fontWeight: 500 }}>
            {course?.id ? "Editar curso" : "Nuevo curso"}
          </p>
          <button onClick={onClose} style={{ background: "none", border: "none",
            cursor: "pointer", color: "var(--text-3)", fontSize: "22px" }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "24px",
          display: "flex", flexDirection: "column", gap: "14px" }}>
          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)",
              background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.2)",
              color: "var(--danger)", fontSize: "13px" }}>{error}</div>
          )}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "7px" }}>Título *</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              style={inputSt} placeholder="Nombre del curso"
              onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                color: "var(--text-2)", marginBottom: "7px" }}>Nivel</label>
              <select value={form.level} onChange={e => setForm(p => ({ ...p, level: e.target.value }))}
                style={inputSt}>
                <option value="beginner">Principiante</option>
                <option value="intermediate">Intermedio</option>
                <option value="advanced">Avanzado</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                color: "var(--text-2)", marginBottom: "7px" }}>Precio (CLP)</label>
              <input type="number" value={form.price}
                onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                disabled={form.is_free}
                style={{ ...inputSt, opacity: form.is_free ? 0.4 : 1 }}
                placeholder="0"
                onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
                onBlur={e => e.target.style.borderColor = "var(--border)"} />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "7px" }}>Descripción corta</label>
            <textarea value={form.short_description} rows={2}
              onChange={e => setForm(p => ({ ...p, short_description: e.target.value }))}
              style={{ ...inputSt, resize: "vertical" }}
              onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "7px" }}>Descripción completa</label>
            <textarea value={form.description} rows={4}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              style={{ ...inputSt, resize: "vertical" }}
              onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "7px" }}>Miniatura</label>
            <input type="file" accept="image/*"
              onChange={e => setThumbnail(e.target.files?.[0])}
              style={{ ...inputSt, padding: "8px" }} />
            {course?.thumbnail_url && !thumbnail && (
              <div style={{ marginTop: "8px" }}>
                <img src={mediaUrl(course.thumbnail_url)} alt=""
                  style={{ height: "60px", borderRadius: "var(--r-md)", objectFit: "cover" }} />
              </div>
            )}
          </div>
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
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)",
          display: "flex", gap: "10px", justifyContent: "flex-end", flexShrink: 0 }}>
          <button onClick={onClose} className="btn btn-ghost"
            style={{ padding: "9px 18px", fontSize: "13px" }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-accent"
            style={{ padding: "9px 18px", fontSize: "13px", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminAcademy() {
  const [modal, setModal] = useState(null)
  const queryClient       = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin-courses"], queryFn: getAdminCourses,
  })
  const deleteMutation = useMutation({
    mutationFn: deleteAdminCourse,
    onSuccess:  () => queryClient.invalidateQueries(["admin-courses"]),
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
                    {course.is_free && <span className="au-acard__tag" style={{ background: "#1AFF6E", color: "#00160b" }}>Gratis</span>}
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
                      onClick={() => { if (window.confirm(`¿Eliminar "${course.title}"?`)) deleteMutation.mutate(course.id) }}
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