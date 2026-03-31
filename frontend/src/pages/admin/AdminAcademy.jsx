// pages/admin/AdminAcademy.jsx

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "../../api/client"

// ── API calls ────────────────────────────────────────────────
// ── API calls — URLs CORRECTAS ───────────────────────────────
const getAcademyFull = () =>
  api.get("/admin/academy/").then(r => r.data)

const createCourse = (data) =>
  api.post("/admin/academy/courses/", data, {
    headers: { "Content-Type": "multipart/form-data" }
  }).then(r => r.data)

const updateCourse = (id, data) =>
  api.patch(`/admin/academy/courses/${id}/`, data, {
    headers: { "Content-Type": "multipart/form-data" }
  }).then(r => r.data)

const deleteCourse = (id) =>
  api.delete(`/admin/academy/courses/${id}/`)

const createModule = (data) =>
  api.post("/admin/academy/modules/", data).then(r => r.data)

const updateModule = (id, data) =>
  api.patch(`/admin/academy/modules/${id}/`, data).then(r => r.data)

const deleteModule = (id) =>
  api.delete(`/admin/academy/modules/${id}/`)

const createLesson = (data) =>
  api.post("/admin/academy/lessons/", data).then(r => r.data)

const updateLesson = (id, data) =>
  api.patch(`/admin/academy/lessons/${id}/`, data).then(r => r.data)

const deleteLesson = (id) =>
  api.delete(`/admin/academy/lessons/${id}/`)

const getModules = (courseId) =>
  api.get(`/admin/academy/modules/?course=${courseId}`).then(r => r.data)

const getLessons = (moduleId) =>
  api.get(`/admin/academy/lessons/?module=${moduleId}`).then(r => r.data)
// ── Modal ────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 101,
        width: wide ? "min(820px, 95vw)" : "min(560px, 95vw)",
        maxHeight: "90vh", overflowY: "auto",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)",
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "20px 24px", borderBottom: "1px solid var(--border)",
          position: "sticky", top: 0, background: "var(--surface)", zIndex: 1,
        }}>
          <p style={{ fontSize: "15px", fontWeight: 500 }}>{title}</p>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-3)", fontSize: "22px", lineHeight: 1, padding: "2px 8px",
          }}>×</button>
        </div>
        <div style={{ padding: "24px" }}>{children}</div>
      </div>
    </>
  )
}

function Field({ label, required, children }) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: "12px", fontWeight: 500,
        color: "var(--text-2)", marginBottom: "7px"
      }}>
        {label}{required && <span style={{ color: "var(--accent)" }}> *</span>}
      </label>
      {children}
    </div>
  )
}

const inputSt = {
  width: "100%", padding: "10px 14px",
  background: "var(--surface-2)", border: "1px solid var(--border)",
  borderRadius: "var(--r-md)", color: "var(--text)", fontSize: "13px", outline: "none",
}

// ── Course Form ──────────────────────────────────────────────
function CourseForm({ course, onClose }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    title: course?.title || "",
    short_description: course?.short_description || "",
    description: course?.description || "",
    price: course?.price || "0",
    level: course?.level || "beginner",
    is_free: course?.is_free ?? false,
    is_published: course?.is_published ?? false,
    preview_url: course?.preview_url || "",
  })
  const [thumb, setThumb] = useState(null)
  const [thumbPreview, setPreview] = useState(course?.thumbnail || null)
  const [error, setError] = useState("")

  const mutation = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      if (thumb) fd.append("thumbnail", thumb)
      return course ? updateCourse(course.id, fd) : createCourse(fd)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["admin-academy-full"])
      onClose()
    },
    onError: (e) => setError(
      JSON.stringify(e.response?.data) || "Error al guardar."
    ),
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {error && (
        <div style={{
          padding: "10px 14px", borderRadius: "var(--r-md)",
          background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.2)",
          color: "var(--danger)", fontSize: "13px"
        }}>
          {error}
        </div>
      )}

      <Field label="Título" required>
        <input value={form.title}
          onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          style={inputSt} placeholder="Ej: Mezcla para principiantes" />
      </Field>

      <Field label="Descripción corta">
        <input value={form.short_description}
          onChange={e => setForm(p => ({ ...p, short_description: e.target.value }))}
          style={inputSt} placeholder="Máx. 500 caracteres" />
      </Field>

      <Field label="Descripción completa">
        <textarea value={form.description}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          rows={4} style={{ ...inputSt, resize: "vertical" }} />
      </Field>

      <Field label="URL de video preview">
        <input value={form.preview_url}
          onChange={e => setForm(p => ({ ...p, preview_url: e.target.value }))}
          style={inputSt} placeholder="https://youtube.com/watch?v=..." />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
        <Field label="Nivel" required>
          <select value={form.level}
            onChange={e => setForm(p => ({ ...p, level: e.target.value }))}
            style={inputSt}>
            <option value="beginner">Principiante</option>
            <option value="intermediate">Intermedio</option>
            <option value="advanced">Avanzado</option>
          </select>
        </Field>
        <Field label="Precio (CLP)">
          <input type="number" value={form.price}
            onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
            style={inputSt} min="0" disabled={form.is_free} />
        </Field>
        <Field label="Gratis">
          <select value={form.is_free ? "1" : "0"}
            onChange={e => setForm(p => ({
              ...p, is_free: e.target.value === "1",
              price: e.target.value === "1" ? "0" : p.price,
            }))}
            style={inputSt}>
            <option value="0">No — tiene precio</option>
            <option value="1">Sí — gratis</option>
          </select>
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <Field label="Estado de publicación">
          <select value={form.is_published ? "1" : "0"}
            onChange={e => setForm(p => ({ ...p, is_published: e.target.value === "1" }))}
            style={inputSt}>
            <option value="0">Borrador</option>
            <option value="1">Publicado</option>
          </select>
        </Field>
      </div>

      {/* Thumbnail */}
      <Field label="Imagen de portada">
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {thumbPreview && (
            <img src={thumbPreview} alt=""
              style={{
                width: "80px", height: "48px", objectFit: "cover",
                borderRadius: "var(--r-sm)", border: "1px solid var(--border)"
              }} />
          )}
          <label style={{
            padding: "10px 16px", borderRadius: "var(--r-md)",
            border: "2px dashed var(--border)", cursor: "pointer",
            color: "var(--text-2)", fontSize: "13px",
          }}
            className="hover:border-[var(--border-hover)]"
          >
            {thumbPreview ? "Cambiar imagen" : "Subir imagen"}
            <input type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => {
                const file = e.target.files[0]
                if (file) { setThumb(file); setPreview(URL.createObjectURL(file)) }
              }} />
          </label>
        </div>
      </Field>

      <div style={{
        display: "flex", gap: "10px", justifyContent: "flex-end",
        paddingTop: "8px", borderTop: "1px solid var(--border)"
      }}>
        <button onClick={onClose} className="btn btn-ghost" style={{ padding: "10px 20px" }}>
          Cancelar
        </button>
        <button onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !form.title}
          className="btn btn-accent"
          style={{ padding: "10px 24px", opacity: mutation.isPending ? 0.6 : 1 }}>
          {mutation.isPending ? "Guardando..." : course ? "Guardar cambios" : "Crear curso"}
        </button>
      </div>
    </div>
  )
}

// ── Module Form ──────────────────────────────────────────────
function ModuleForm({ module, courseId, courses, onClose }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    title: module?.title || "",
    order: module?.order || 0,
    course: courseId || module?.course || "",
  })
  const [error, setError] = useState("")

  const mutation = useMutation({
    mutationFn: () => module ? updateModule(module.id, form) : createModule(form),
    onSuccess: () => {
      queryClient.invalidateQueries(["admin-modules", form.course])
      queryClient.invalidateQueries(["admin-all-modules"])
      queryClient.invalidateQueries(["admin-academy-full"])
      onClose()
    },
    onError: (e) => setError(JSON.stringify(e.response?.data) || "Error."),
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {error && (
        <div style={{
          padding: "10px 14px", borderRadius: "var(--r-md)",
          background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.2)",
          color: "var(--danger)", fontSize: "13px"
        }}>
          {error}
        </div>
      )}

      {/* Selector de curso — solo si no viene de un curso específico */}
      {!courseId && (
        <Field label="Curso" required>
          <select value={form.course}
            onChange={e => setForm(p => ({ ...p, course: e.target.value }))}
            style={inputSt}>
            <option value="">— Seleccionar curso —</option>
            {(courses || []).map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Título del módulo" required>
        <input value={form.title}
          onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          style={inputSt} placeholder="Ej: Módulo 1 — Fundamentos" />
      </Field>

      <Field label="Orden">
        <input type="number" value={form.order}
          onChange={e => setForm(p => ({ ...p, order: parseInt(e.target.value) || 0 }))}
          style={inputSt} min="0" />
      </Field>

      <div style={{
        display: "flex", gap: "10px", justifyContent: "flex-end",
        paddingTop: "8px", borderTop: "1px solid var(--border)"
      }}>
        <button onClick={onClose} className="btn btn-ghost"
          style={{ padding: "10px 20px" }}>
          Cancelar
        </button>
        <button onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !form.title || !form.course}
          className="btn btn-accent"
          style={{ padding: "10px 24px", opacity: mutation.isPending ? 0.6 : 1 }}>
          {mutation.isPending ? "Guardando..." : module ? "Guardar" : "Crear módulo"}
        </button>
      </div>
    </div>
  )
}

// ── Lesson Form ──────────────────────────────────────────────
function LessonForm({ lesson, moduleId, onClose }) {
  const queryClient = useQueryClient()

  // Carga módulos para el selector
  const { data: modulesData } = useQuery({
    queryKey: ["admin-all-modules"],
    queryFn: () => api.get("/admin/academy/modules/").then(r => r.data), // ← corregido
    enabled: !moduleId,
  })
  const allModules = modulesData?.results || modulesData || []

  const [form, setForm] = useState({
    title: lesson?.title || "",
    video_url: lesson?.video_url || "",
    description: lesson?.description || "",
    duration_minutes: lesson?.duration_minutes || 0,
    order: lesson?.order || 0,
    is_free: lesson?.is_free ?? false,
    module: moduleId || lesson?.module || "",
  })
  const [error, setError] = useState("")

  const mutation = useMutation({
    mutationFn: () => lesson ? updateLesson(lesson.id, form) : createLesson(form),
    onSuccess: () => {
      queryClient.invalidateQueries(["admin-lessons", form.module])
      queryClient.invalidateQueries(["admin-all-lessons"])
      queryClient.invalidateQueries(["admin-academy-full"])
      onClose()
    },
    onError: (e) => setError(JSON.stringify(e.response?.data) || "Error."),
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {error && (
        <div style={{
          padding: "10px 14px", borderRadius: "var(--r-md)",
          background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.2)",
          color: "var(--danger)", fontSize: "13px"
        }}>
          {error}
        </div>
      )}

      {/* Selector de módulo — solo si no viene de un módulo específico */}
      {!moduleId && (
        <Field label="Módulo" required>
          <select value={form.module}
            onChange={e => setForm(p => ({ ...p, module: e.target.value }))}
            style={inputSt}>
            <option value="">— Seleccionar módulo —</option>
            {allModules.map(m => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Título de la lección" required>
        <input value={form.title}
          onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          style={inputSt} placeholder="Ej: Introducción a la mezcla" />
      </Field>

      <Field label="URL del video" required>
        <input value={form.video_url}
          onChange={e => setForm(p => ({ ...p, video_url: e.target.value }))}
          style={inputSt} placeholder="https://youtube.com/watch?v=..." />
      </Field>

      <Field label="Descripción">
        <textarea value={form.description}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          rows={3} style={{ ...inputSt, resize: "vertical" }} />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
        <Field label="Duración (minutos)">
          <input type="number" value={form.duration_minutes}
            onChange={e => setForm(p => ({
              ...p, duration_minutes: parseInt(e.target.value) || 0,
            }))}
            style={inputSt} min="0" />
        </Field>
        <Field label="Orden">
          <input type="number" value={form.order}
            onChange={e => setForm(p => ({ ...p, order: parseInt(e.target.value) || 0 }))}
            style={inputSt} min="0" />
        </Field>
        <Field label="¿Gratis?">
          <select value={form.is_free ? "1" : "0"}
            onChange={e => setForm(p => ({ ...p, is_free: e.target.value === "1" }))}
            style={inputSt}>
            <option value="0">No — requiere inscripción</option>
            <option value="1">Sí — acceso libre</option>
          </select>
        </Field>
      </div>

      <div style={{
        display: "flex", gap: "10px", justifyContent: "flex-end",
        paddingTop: "8px", borderTop: "1px solid var(--border)"
      }}>
        <button onClick={onClose} className="btn btn-ghost"
          style={{ padding: "10px 20px" }}>
          Cancelar
        </button>
        <button onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !form.title || !form.video_url || !form.module}
          className="btn btn-accent"
          style={{ padding: "10px 24px", opacity: mutation.isPending ? 0.6 : 1 }}>
          {mutation.isPending ? "Guardando..." : lesson ? "Guardar" : "Crear lección"}
        </button>
      </div>
    </div>
  )
}

// ── Course Card expandible ───────────────────────────────────
function CourseCard({ course, onEdit, onDelete }) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [modal, setModal] = useState(null)

  const { data: modulesData } = useQuery({
    queryKey: ["admin-modules", course.id],
    queryFn: () => getModules(course.id),
    enabled: expanded,
  })
  const modules = modulesData?.results || modulesData || []

  const delModMutation = useMutation({
    mutationFn: deleteModule,
    onSuccess: () => queryClient.invalidateQueries(["admin-modules", course.id]),
  })

  const levelColors = {
    beginner: "#4ade80", intermediate: "#facc15", advanced: "#f87171",
  }
  const levelLabels = {
    beginner: "Principiante", intermediate: "Intermedio", advanced: "Avanzado",
  }

  return (
    <>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)", overflow: "hidden",
        transition: "border-color var(--dur) var(--ease)",
      }}
        className="hover:border-[var(--border-hover)]"
      >
        {/* Header de la card */}
        <div style={{
          display: "flex", gap: "16px", padding: "16px 20px",
          alignItems: "flex-start"
        }}>

          {/* Thumbnail */}
          <div style={{
            width: "80px", height: "48px", borderRadius: "var(--r-sm)",
            background: "var(--surface-2)", overflow: "hidden",
            border: "1px solid var(--border)", flexShrink: 0,
          }}>
            {course.thumbnail ? (
              <img src={course.thumbnail} alt={course.title}
                style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{
                width: "100%", height: "100%", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: "20px"
              }}>
                🎛️
              </div>
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: "flex", alignItems: "center",
              gap: "8px", marginBottom: "6px", flexWrap: "wrap"
            }}>
              <p style={{ fontSize: "14px", fontWeight: 500 }}>{course.title}</p>
              <span style={{
                fontSize: "10px", fontWeight: 600, padding: "1px 7px",
                borderRadius: "100px",
                color: levelColors[course.level] || "#888",
                background: `${levelColors[course.level]}14`,
                border: `1px solid ${levelColors[course.level]}30`,
              }}>
                {levelLabels[course.level] || course.level}
              </span>
              <span style={{
                fontSize: "10px", fontWeight: 600, padding: "1px 7px",
                borderRadius: "100px",
                color: course.is_published ? "#4ade80" : "var(--text-3)",
                background: course.is_published
                  ? "rgba(74,222,128,0.1)" : "var(--surface-3)",
                border: `1px solid ${course.is_published
                  ? "rgba(74,222,128,0.25)" : "var(--border)"}`,
              }}>
                {course.is_published ? "Publicado" : "Borrador"}
              </span>
            </div>

            <div style={{
              display: "flex", gap: "16px", fontSize: "12px",
              color: "var(--text-3)"
            }}>
              <span>
                {course.is_free ? (
                  <span style={{ color: "var(--accent)" }}>Gratis</span>
                ) : `$${Number(course.price).toLocaleString("es-CL")}`}
              </span>
              <span>{course.total_lessons} lecciones</span>
              <span>{course.enrollment_count} inscritos</span>
            </div>
          </div>

          {/* Acciones */}
          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                padding: "6px 12px", borderRadius: "100px", fontSize: "12px",
                cursor: "pointer", transition: "all var(--dur) var(--ease)",
                background: expanded ? "var(--surface-3)" : "transparent",
                color: "var(--text-2)", border: "1px solid var(--border)",
              }}>
              {expanded ? "▲ Ocultar" : "▼ Módulos"}
            </button>
            <button onClick={() => onEdit(course)}
              style={{
                padding: "6px 12px", borderRadius: "100px", fontSize: "12px",
                cursor: "pointer", color: "#60a5fa",
                background: "rgba(96,165,250,0.1)",
                border: "1px solid rgba(96,165,250,0.25)",
              }}>
              ✎ Editar
            </button>
            <button onClick={() => onDelete(course)}
              style={{
                padding: "6px 12px", borderRadius: "100px", fontSize: "12px",
                cursor: "pointer", color: "#f87171",
                background: "rgba(248,113,113,0.1)",
                border: "1px solid rgba(248,113,113,0.25)",
              }}>
              × Eliminar
            </button>
          </div>
        </div>

        {/* Módulos expandidos */}
        {expanded && (
          <div style={{
            borderTop: "1px solid var(--border)",
            padding: "16px 20px", background: "var(--surface-2)"
          }}>

            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: "12px"
            }}>
              <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-2)" }}>
                Módulos ({modules.length})
              </p>
              <button
                onClick={() => setModal({ type: "module", item: null, courseId: course.id })}
                style={{
                  padding: "5px 12px", borderRadius: "100px", fontSize: "12px",
                  cursor: "pointer", color: "var(--accent)",
                  background: "var(--accent-glow)",
                  border: "1px solid rgba(26,255,110,0.25)",
                }}>
                + Módulo
              </button>
            </div>

            {modules.length === 0 ? (
              <p style={{
                fontSize: "13px", color: "var(--text-3)",
                textAlign: "center", padding: "16px 0"
              }}>
                Sin módulos. Agrega el primero.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {modules.map(mod => (
                  <ModuleRow
                    key={mod.id}
                    module={mod}
                    onEdit={() => setModal({
                      type: "module", item: mod, courseId: course.id,
                    })}
                    onDelete={() => {
                      if (window.confirm(`¿Eliminar módulo "${mod.title}"?`)) {
                        delModMutation.mutate(mod.id)
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {modal?.type === "module" && (
        <Modal title={modal.item ? "Editar módulo" : "Nuevo módulo"}
          onClose={() => setModal(null)}>
          <ModuleForm
            module={modal.item}
            courseId={modal.courseId}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.type === "lesson" && (
        <Modal title={modal.item ? "Editar lección" : "Nueva lección"}
          onClose={() => setModal(null)}>
          <LessonForm
            lesson={modal.item}
            moduleId={modal.moduleId}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </>
  )
}

// ── Module Row con lecciones ─────────────────────────────────
function ModuleRow({ module, onEdit, onDelete }) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [modal, setModal] = useState(null)

  const { data: lessonsData } = useQuery({
    queryKey: ["admin-lessons", module.id],
    queryFn: () => getLessons(module.id),
    enabled: expanded,
  })
  const lessons = lessonsData?.results || lessonsData || []

  const delLessonMutation = useMutation({
    mutationFn: deleteLesson,
    onSuccess: () => queryClient.invalidateQueries(["admin-lessons", module.id]),
  })

  return (
    <>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-md)", overflow: "hidden",
      }}>
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "11px 16px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{
              fontSize: "11px", color: "var(--text-3)",
              width: "20px", textAlign: "center"
            }}>
              {module.order}
            </span>
            <p style={{ fontSize: "13px" }}>{module.title}</p>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                padding: "4px 10px", borderRadius: "100px", fontSize: "11px",
                cursor: "pointer", color: "var(--text-2)",
                background: "transparent", border: "1px solid var(--border)",
              }}>
              {expanded ? "▲" : `▼ Lecciones`}
            </button>
            <button onClick={onEdit} style={{
              padding: "4px 10px", borderRadius: "100px", fontSize: "11px",
              cursor: "pointer", color: "#60a5fa",
              background: "rgba(96,165,250,0.08)",
              border: "1px solid rgba(96,165,250,0.2)",
            }}>✎</button>
            <button onClick={onDelete} style={{
              padding: "4px 10px", borderRadius: "100px", fontSize: "11px",
              cursor: "pointer", color: "#f87171",
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.2)",
            }}>×</button>
          </div>
        </div>

        {/* Lecciones */}
        {expanded && (
          <div style={{
            borderTop: "1px solid var(--border)",
            padding: "12px 16px", background: "var(--surface-2)"
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: "10px"
            }}>
              <p style={{ fontSize: "11px", color: "var(--text-3)" }}>
                {lessons.length} lección{lessons.length !== 1 ? "es" : ""}
              </p>
              <button
                onClick={() => setModal({ type: "lesson", item: null, moduleId: module.id })}
                style={{
                  padding: "4px 10px", borderRadius: "100px", fontSize: "11px",
                  cursor: "pointer", color: "var(--accent)",
                  background: "var(--accent-glow)",
                  border: "1px solid rgba(26,255,110,0.2)",
                }}>
                + Lección
              </button>
            </div>

            {lessons.length === 0 ? (
              <p style={{
                fontSize: "12px", color: "var(--text-3)",
                textAlign: "center", padding: "8px 0"
              }}>
                Sin lecciones todavía.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {lessons.map(lesson => (
                  <div key={lesson.id} style={{
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px", borderRadius: "var(--r-sm)",
                    background: "var(--surface)", border: "1px solid var(--border)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{
                        fontSize: "11px", color: "var(--text-3)",
                        width: "16px", textAlign: "center"
                      }}>
                        {lesson.order}
                      </span>
                      <div>
                        <p style={{ fontSize: "12px" }}>{lesson.title}</p>
                        <p style={{ fontSize: "11px", color: "var(--text-3)" }}>
                          {lesson.duration_minutes}min
                          {lesson.is_free && (
                            <span style={{ color: "var(--accent)", marginLeft: "6px" }}>
                              · GRATIS
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => setModal({
                          type: "lesson", item: lesson, moduleId: module.id,
                        })}
                        style={{
                          padding: "3px 8px", borderRadius: "100px", fontSize: "11px",
                          cursor: "pointer", color: "#60a5fa",
                          background: "rgba(96,165,250,0.08)",
                          border: "1px solid rgba(96,165,250,0.2)",
                        }}>✎</button>
                      <button
                        onClick={() => {
                          if (window.confirm(`¿Eliminar lección "${lesson.title}"?`)) {
                            delLessonMutation.mutate(lesson.id)
                          }
                        }}
                        style={{
                          padding: "3px 8px", borderRadius: "100px", fontSize: "11px",
                          cursor: "pointer", color: "#f87171",
                          background: "rgba(248,113,113,0.08)",
                          border: "1px solid rgba(248,113,113,0.2)",
                        }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {modal?.type === "lesson" && (
        <Modal title={modal.item ? "Editar lección" : "Nueva lección"}
          onClose={() => setModal(null)}>
          <LessonForm
            lesson={modal.item}
            moduleId={modal.moduleId}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </>
  )
}

// ── AdminAcademy ─────────────────────────────────────────────
// ── AdminAcademy — con tabs ──────────────────────────────────
export default function AdminAcademy() {
  const queryClient = useQueryClient()
  const [modal, setModal] = useState(null)
  const [tab, setTab] = useState("courses")

  // ── Datos ────────────────────────────────────────────────
  const { data: coursesData, isLoading: loadingCourses } = useQuery({
    queryKey: ["admin-academy-full"],
    queryFn: getAcademyFull,
    refetchOnMount: true,
  })

  const { data: modulesData, isLoading: loadingModules } = useQuery({
    queryKey: ["admin-all-modules"],
    queryFn: () => api.get("/admin/academy/modules/").then(r => r.data), // ← corregido
    enabled: tab === "modules",
    refetchOnMount: true,
  })

  const { data: lessonsData, isLoading: loadingLessons } = useQuery({
    queryKey: ["admin-all-lessons"],
    queryFn: () => api.get("/admin/academy/lessons/").then(r => r.data), // ← corregido
    enabled: tab === "lessons",
    refetchOnMount: true,
  })

  const courses = coursesData?.results || []
  const modules = modulesData?.results || modulesData || []
  const lessons = lessonsData?.results || lessonsData || []

  const deleteMutation = useMutation({
    mutationFn: deleteCourse,
    onSuccess: () => queryClient.invalidateQueries(["admin-academy-full"]),
  })
  const delModMutation = useMutation({
    mutationFn: deleteModule,
    onSuccess: () => queryClient.invalidateQueries(["admin-all-modules"]),
  })
  const delLessonMutation = useMutation({
    mutationFn: deleteLesson,
    onSuccess: () => queryClient.invalidateQueries(["admin-all-lessons"]),
  })

  const totalEnrollments = courses.reduce((a, c) => a + (c.enrollment_count || 0), 0)

  const tabs = [
    { key: "courses", label: `Cursos (${courses.length})` },
    { key: "modules", label: `Módulos${tab === "modules" ? ` (${modules.length})` : ""}` },
    { key: "lessons", label: `Lecciones${tab === "lessons" ? ` (${lessons.length})` : ""}` },
  ]


  const actionBtnSt = (color) => ({
    padding: "4px 10px", borderRadius: "100px", fontSize: "11px",
    cursor: "pointer", color,
    background: `${color}14`, border: `1px solid ${color}30`,
  })

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>

      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "24px",
        flexWrap: "wrap", gap: "16px"
      }}>
        <div>
          <h1 style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px"
          }}>
            Academia
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            {courses.length} cursos · {totalEnrollments} inscripciones
          </p>
        </div>
        <button
          onClick={() => setModal({
            type: tab === "modules" ? "module"
              : tab === "lessons" ? "lesson"
                : "course",
            item: null,
            courseId: null,
            moduleId: null,
          })}
          className="btn btn-accent"
          style={{ padding: "10px 20px", fontSize: "13px" }}>
          + {tab === "modules" ? "Nuevo módulo"
            : tab === "lessons" ? "Nueva lección"
              : "Nuevo curso"}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: "7px 16px", borderRadius: "100px", fontSize: "13px",
            cursor: "pointer", transition: "all var(--dur) var(--ease)",
            background: tab === key ? "var(--text)" : "transparent",
            color: tab === key ? "var(--bg)" : "var(--text-2)",
            border: `1px solid ${tab === key ? "var(--text)" : "var(--border)"}`,
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB CURSOS ── */}
      {tab === "courses" && (
        <>
          {loadingCourses ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: "96px" }} />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--r-xl)", padding: "60px", textAlign: "center"
            }}>
              <p style={{ fontSize: "40px", marginBottom: "16px" }}>🎛️</p>
              <p style={{ fontSize: "16px", fontWeight: 500, marginBottom: "16px" }}>
                No hay cursos todavía
              </p>
              <button onClick={() => setModal({ type: "course", item: null })}
                className="btn btn-accent">
                Crear primer curso
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {courses.map(course => (
                <CourseCard
                  key={course.id}
                  course={course}
                  onEdit={(c) => setModal({ type: "course", item: c })}
                  onDelete={(c) => {
                    if (window.confirm(`¿Eliminar curso "${c.title}"?`)) {
                      deleteMutation.mutate(c.id)
                    }
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── TAB MÓDULOS ── */}
      {tab === "modules" && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", overflow: "hidden"
        }}>

          {/* Header tabla */}
          <div style={{
            display: "grid", gridTemplateColumns: "2fr 2fr 1fr 80px",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            <span>Módulo</span>
            <span>Curso</span>
            <span>Orden</span>
            <span>Acciones</span>
          </div>

          {loadingModules ? (
            <div style={{
              padding: "20px", display: "flex",
              flexDirection: "column", gap: "8px"
            }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: "48px" }} />
              ))}
            </div>
          ) : modules.length === 0 ? (
            <div style={{
              padding: "40px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px"
            }}>
              No hay módulos. Créalos desde la pestaña Cursos o desde aquí.
            </div>
          ) : modules.map((mod, i) => (
            <div key={mod.id} style={{
              display: "grid", gridTemplateColumns: "2fr 2fr 1fr 80px",
              padding: "13px 20px", alignItems: "center",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              transition: "background var(--dur) var(--ease)",
            }}
              className="hover:bg-[var(--surface-2)]"
            >
              <span style={{ fontSize: "13px" }}>{mod.title}</span>
              <span style={{ fontSize: "12px", color: "var(--text-2)" }}>
                {courses.find(c => c.id === mod.course)?.title || `Curso ${mod.course?.slice(0, 8)}`}
              </span>
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>{mod.order}</span>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => setModal({
                    type: "module", item: mod, courseId: mod.course,
                  })}
                  style={actionBtnSt("#60a5fa")}>✎</button>
                <button
                  onClick={() => {
                    if (window.confirm(`¿Eliminar módulo "${mod.title}"?`)) {
                      delModMutation.mutate(mod.id)
                    }
                  }}
                  style={actionBtnSt("#f87171")}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB LECCIONES ── */}
      {tab === "lessons" && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", overflow: "hidden"
        }}>

          <div style={{
            display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr 80px",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            <span>Lección</span>
            <span>Módulo</span>
            <span>Duración</span>
            <span>Orden</span>
            <span>Gratis</span>
            <span>Acciones</span>
          </div>

          {loadingLessons ? (
            <div style={{
              padding: "20px", display: "flex",
              flexDirection: "column", gap: "8px"
            }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: "48px" }} />
              ))}
            </div>
          ) : lessons.length === 0 ? (
            <div style={{
              padding: "40px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px"
            }}>
              No hay lecciones. Créalas desde Cursos o desde aquí.
            </div>
          ) : lessons.map((lesson, i) => (
            <div key={lesson.id} style={{
              display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr 80px",
              padding: "13px 20px", alignItems: "center",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              transition: "background var(--dur) var(--ease)",
            }}
              className="hover:bg-[var(--surface-2)]"
            >
              <div>
                <p style={{ fontSize: "13px" }}>{lesson.title}</p>
                {lesson.video_url && (
                  <a href={lesson.video_url} target="_blank" rel="noreferrer"
                    style={{
                      fontSize: "11px", color: "var(--text-3)",
                      transition: "color var(--dur)"
                    }}
                    className="hover:text-[var(--accent)]">
                    Ver video ↗
                  </a>
                )}
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-2)" }}>
                {modules.find(m => m.id === lesson.module)?.title
                  || `Módulo ${String(lesson.module).slice(0, 8)}`}
              </span>
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {lesson.duration_minutes}min
              </span>
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {lesson.order}
              </span>
              <span style={{
                fontSize: "11px", fontWeight: 500, padding: "2px 8px",
                borderRadius: "100px", display: "inline-block",
                color: lesson.is_free ? "var(--accent)" : "var(--text-3)",
                background: lesson.is_free ? "var(--accent-glow)" : "var(--surface-3)",
                border: `1px solid ${lesson.is_free
                  ? "rgba(26,255,110,0.2)" : "var(--border)"}`,
              }}>
                {lesson.is_free ? "Gratis" : "Pago"}
              </span>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => setModal({
                    type: "lesson", item: lesson, moduleId: lesson.module,
                  })}
                  style={actionBtnSt("#60a5fa")}>✎</button>
                <button
                  onClick={() => {
                    if (window.confirm(`¿Eliminar lección "${lesson.title}"?`)) {
                      delLessonMutation.mutate(lesson.id)
                    }
                  }}
                  style={actionBtnSt("#f87171")}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {modal?.type === "course" && (
        <Modal
          title={modal.item ? `Editar: ${modal.item.title}` : "Nuevo curso"}
          onClose={() => setModal(null)} wide>
          <CourseForm course={modal.item} onClose={() => setModal(null)} />
        </Modal>
      )}

      {modal?.type === "module" && (
        <Modal
          title={modal.item ? "Editar módulo" : "Nuevo módulo"}
          onClose={() => setModal(null)}>
          <ModuleForm
            module={modal.item}
            courseId={modal.courseId}
            courses={courses}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.type === "lesson" && (
        <Modal
          title={modal.item ? "Editar lección" : "Nueva lección"}
          onClose={() => setModal(null)}>
          <LessonForm
            lesson={modal.item}
            moduleId={modal.moduleId}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  )
}