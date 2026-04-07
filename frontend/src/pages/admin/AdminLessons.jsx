// pages/admin/AdminLessons.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSearchParams, Link } from "react-router-dom"
import {
  getAdminLessons, createAdminLesson,
  updateAdminLesson, deleteAdminLesson, getAdminModules,
} from "../../api/admin.api"

const inputSt = {
  width: "100%", padding: "10px 14px",
  background: "var(--surface-2)", border: "1px solid var(--border)",
  borderRadius: "var(--r-md)", color: "var(--text)", fontSize: "13px", outline: "none",
}

function LessonModal({ lesson, moduleId, modules, onClose, onSave }) {
  const [form, setForm]     = useState({
    title:              lesson?.title              || "",
    video_url:          lesson?.video_url          || "",
    description:        lesson?.description        || "",
    order:              lesson?.order              ?? 1,
    duration_minutes:   lesson?.duration_minutes   ?? 0,
    module:             lesson?.module             || moduleId || "",
    is_active:          lesson?.is_active          ?? true,
    is_free:            lesson?.is_free            ?? false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")
  const queryClient         = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => lesson?.id
      ? updateAdminLesson(lesson.id, form)
      : createAdminLesson(form),
    onSuccess: () => {
      queryClient.invalidateQueries(["admin-lessons"])
      onSave?.(); onClose()
    },
    onError: (e) => setError(e?.response?.data?.detail || "Error al guardar."),
  })

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      backdropFilter: "blur(8px)", zIndex: 200, display: "flex",
      alignItems: "center", justifyContent: "center", padding: "24px" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-2xl)", width: "100%", maxWidth: "500px",
        maxHeight: "90vh", display: "flex", flexDirection: "column",
        animation: "scaleIn 200ms var(--ease)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexShrink: 0 }}>
          <p style={{ fontSize: "15px", fontWeight: 500 }}>
            {lesson?.id ? "Editar lección" : "Nueva lección"}
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
              style={inputSt} placeholder="Nombre de la lección"
              onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "7px" }}>Módulo *</label>
            <select value={form.module}
              onChange={e => setForm(p => ({ ...p, module: e.target.value }))}
              style={inputSt}>
              <option value="">Seleccionar módulo</option>
              {modules.map(m => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "7px" }}>URL del video</label>
            <input value={form.video_url}
              onChange={e => setForm(p => ({ ...p, video_url: e.target.value }))}
              style={inputSt} placeholder="https://youtube.com/watch?v=..."
              onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"} />
            {form.video_url && form.video_url.includes("youtube") && (
              <p style={{ fontSize: "11px", color: "var(--accent)", marginTop: "4px" }}>
                ✓ URL de YouTube detectada
              </p>
            )}
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "7px" }}>Descripción</label>
            <textarea value={form.description} rows={3}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              style={{ ...inputSt, resize: "vertical" }}
              onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                color: "var(--text-2)", marginBottom: "7px" }}>Orden</label>
              <input type="number" value={form.order} min="1"
                onChange={e => setForm(p => ({ ...p, order: parseInt(e.target.value) || 1 }))}
                style={inputSt}
                onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
                onBlur={e => e.target.style.borderColor = "var(--border)"} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                color: "var(--text-2)", marginBottom: "7px" }}>Duración (min)</label>
              <input type="number" value={form.duration_minutes} min="0"
                onChange={e => setForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 0 }))}
                style={inputSt}
                onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
                onBlur={e => e.target.style.borderColor = "var(--border)"} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "20px" }}>
            {[
              { key: "is_active", label: "Lección activa" },
              { key: "is_free",   label: "Gratis (preview)" },
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
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="btn btn-accent"
            style={{ padding: "9px 18px", fontSize: "13px", opacity: mutation.isPending ? 0.7 : 1 }}>
            {mutation.isPending ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminLessons() {
  const [searchParams]    = useSearchParams()
  const moduleFilter      = searchParams.get("module") || ""
  const [modal, setModal] = useState(null)
  const queryClient       = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin-lessons", moduleFilter],
    queryFn:  () => getAdminLessons(moduleFilter ? { module: moduleFilter } : {}),
  })
  const { data: modulesData } = useQuery({
    queryKey: ["admin-modules-all"], queryFn: () => getAdminModules({}),
  })
  const deleteMutation = useMutation({
    mutationFn: deleteAdminLesson,
    onSuccess:  () => queryClient.invalidateQueries(["admin-lessons"]),
  })

  const lessons = data?.results || data || []
  const modules = modulesData?.results || modulesData || []

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      {modal && (
        <LessonModal
          lesson={modal === "new" ? null : modal}
          moduleId={moduleFilter}
          modules={modules}
          onClose={() => setModal(null)}
          onSave={() => queryClient.invalidateQueries(["admin-lessons"])}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "28px", gap: "16px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 300,
            letterSpacing: "-0.02em", marginBottom: "6px" }}>
            Lecciones
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            {lessons.length} lecciones
          </p>
        </div>
        <button onClick={() => setModal("new")} className="btn btn-accent"
          style={{ padding: "10px 20px", fontSize: "13px" }}>
          + Nueva lección
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
            gridTemplateColumns: "40px 2.5fr 2fr 80px 80px 1fr 80px",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>#</span><span>Título</span><span>Módulo</span>
            <span>Duración</span><span>Tipo</span><span>Estado</span><span />
          </div>
          {lessons.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px" }}>
              Sin lecciones. Crea la primera arriba.
            </div>
          ) : lessons.map((lesson, i) => (
            <div key={lesson.id} style={{
              display: "grid",
              gridTemplateColumns: "40px 2.5fr 2fr 80px 80px 1fr 80px",
              padding: "12px 20px", alignItems: "center",
              borderTop: i > 0 ? "1px solid var(--border)" : "none", gap: "8px",
              transition: "background var(--dur) var(--ease)",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ fontSize: "12px", color: "var(--text-3)",
                fontWeight: 600 }}>{lesson.order}</span>
              <div>
                <p style={{ fontSize: "13px", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {lesson.title}
                </p>
                {lesson.video_url && (
                  <p style={{ fontSize: "11px", color: "var(--text-3)" }}>
                    ▶ Video adjunto
                  </p>
                )}
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-3)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {lesson.module_title || modules.find(m => m.id === lesson.module)?.title || "—"}
              </span>
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {lesson.duration_minutes > 0 ? `${lesson.duration_minutes} min` : "—"}
              </span>
              <span style={{
                padding: "2px 8px", borderRadius: "var(--r-full)", fontSize: "11px",
                fontWeight: 500,
                color:      lesson.is_free ? "var(--accent)" : "var(--text-3)",
                background: lesson.is_free ? "var(--accent-dim)" : "var(--surface-2)",
                border:     `1px solid ${lesson.is_free ? "var(--accent-glow)" : "var(--border)"}`,
              }}>
                {lesson.is_free ? "Free" : "Pro"}
              </span>
              <span style={{
                padding: "2px 8px", borderRadius: "var(--r-full)", fontSize: "11px",
                fontWeight: 500, display: "inline-block",
                color:      lesson.is_active ? "var(--accent)" : "var(--text-3)",
                background: lesson.is_active ? "var(--accent-dim)" : "var(--surface-2)",
                border:     `1px solid ${lesson.is_active ? "var(--accent-glow)" : "var(--border)"}`,
              }}>
                {lesson.is_active ? "Activa" : "Inactiva"}
              </span>
              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={() => setModal(lesson)} style={{
                  padding: "4px 8px", borderRadius: "var(--r-sm)", fontSize: "11px",
                  cursor: "pointer", color: "#60a5fa",
                  background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)",
                }}>✎</button>
                <button onClick={() => {
                  if (window.confirm(`¿Eliminar "${lesson.title}"?`))
                    deleteMutation.mutate(lesson.id)
                }} style={{
                  padding: "4px 8px", borderRadius: "var(--r-sm)", fontSize: "11px",
                  cursor: "pointer", color: "#f87171",
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