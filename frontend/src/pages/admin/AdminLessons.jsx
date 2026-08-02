// pages/admin/AdminLessons.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSearchParams, Link } from "react-router-dom"
import {
  getAdminLessons, createAdminLesson,
  updateAdminLesson, deleteAdminLesson, getAdminModules,
} from "../../api/admin.api"
import { FormModal, FormField, formInputStyle as inputSt, ConfirmationModal } from "../../components/admin/ui"

function LessonModal({ lesson, moduleId, modules, onClose, onSave }) {
  const [form, setForm]     = useState({
    title:              lesson?.title              || "",
    video_url:          lesson?.video_url          || "",
    description:        lesson?.description        || "",
    order:              lesson?.order              ?? 1,
    duration_minutes:   lesson?.duration_minutes   ?? 0,
    module:             lesson?.module             || moduleId || "",
    is_free:            lesson?.is_free             ?? false,
  })
  const [videoFile, setVideoFile]     = useState(null)
  const [uploadProgress, setProgress] = useState(0)
  const [videoMode, setVideoMode]     = useState(
    lesson?.video_file ? "local" : (lesson?.video_url ? "url" : "local")
  )
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")
  const queryClient         = useQueryClient()

  const submit = async () => {
    setSaving(true); setError(""); setProgress(0)
    try {
      const fd = new FormData()
      fd.append("title",            form.title)
      fd.append("module",           form.module)
      fd.append("description",      form.description || "")
      fd.append("order",            form.order || 1)
      fd.append("duration_minutes", form.duration_minutes || 0)
      fd.append("is_free",          form.is_free ? "true" : "false")
      if (videoMode === "url") {
        fd.append("video_url", form.video_url || "")
      } else if (videoFile) {
        fd.append("video_file", videoFile)
      }

      const { default: api } = await import("../../api/client")
      const endpoint = lesson?.id
        ? `/admin/academy/lessons/${lesson.id}/`
        : `/admin/academy/lessons/`
      const method = lesson?.id ? "patch" : "post"

      await api[method](endpoint, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100))
        },
      })
      queryClient.invalidateQueries({ queryKey:["admin-lessons"] })
      onSave?.(); onClose()
    } catch (e) {
      const data = e?.response?.data
      let msg = "Error al guardar."
      if (data) {
        if (typeof data === "string") msg = data
        else if (data.detail) msg = data.detail
        else {
          const firstKey = Object.keys(data)[0]
          const val = data[firstKey]
          msg = `${firstKey}: ${Array.isArray(val) ? val[0] : val}`
        }
      }
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open
      title={lesson?.id ? "Editar lección" : "Nueva lección"}
      onClose={onClose}
      onSave={submit}
      saving={saving}
      error={error}
      maxWidth="500px"
      scrollableBody
      testId="lesson-modal"
    >
      <FormField label="Título *">
        <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          style={inputSt} placeholder="Nombre de la lección" />
      </FormField>
      <FormField label="Módulo *">
        <select value={form.module}
          onChange={e => setForm(p => ({ ...p, module: e.target.value }))}
          style={inputSt}>
          <option value="">Seleccionar módulo</option>
          {modules.map(m => (
            <option key={m.id} value={m.id}>
              {m.course_title ? `${m.course_title} — ${m.title}` : m.title}
            </option>
          ))}
        </select>
      </FormField>

          {/* Fuente de video: toggle local / URL */}
          <div>
            <label style={{ display:"block", fontSize:"12px", fontWeight:500,
              color:"var(--text-2)", marginBottom:"7px" }}>Video *</label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr",
              gap:"6px", marginBottom:"10px",
              padding:"3px", background:"var(--surface-2)",
              border:"1px solid var(--border)", borderRadius:"var(--r-md)" }}>
              <button type="button" onClick={() => setVideoMode("local")}
                data-testid="video-mode-local"
                style={{
                  padding:"7px", fontSize:"12px", cursor:"pointer",
                  borderRadius:"var(--r-sm)", border:"none",
                  background: videoMode==="local" ? "var(--accent)" : "transparent",
                  color: videoMode==="local" ? "#000" : "var(--text-2)",
                  fontWeight: videoMode==="local" ? 600 : 400,
                }}>
                📁 Subir archivo
              </button>
              <button type="button" onClick={() => setVideoMode("url")}
                data-testid="video-mode-url"
                style={{
                  padding:"7px", fontSize:"12px", cursor:"pointer",
                  borderRadius:"var(--r-sm)", border:"none",
                  background: videoMode==="url" ? "var(--accent)" : "transparent",
                  color: videoMode==="url" ? "#000" : "var(--text-2)",
                  fontWeight: videoMode==="url" ? 600 : 400,
                }}>
                🔗 URL externa
              </button>
            </div>

            {videoMode === "url" ? (
              <>
                <input value={form.video_url}
                  data-testid="input-video-url"
                  onChange={e => setForm(p => ({ ...p, video_url: e.target.value }))}
                  style={inputSt} placeholder="https://youtube.com/watch?v=..." />
                {form.video_url && form.video_url.includes("youtube") && (
                  <p style={{ fontSize: "11px", color: "var(--accent-text)", marginTop: "4px" }}>
                    ✓ URL de YouTube detectada
                  </p>
                )}
              </>
            ) : (
              <>
                <label style={{
                  display:"flex", flexDirection:"column", alignItems:"center",
                  gap:"6px", padding:"22px",
                  background:"var(--surface-2)",
                  border:"1px dashed var(--border)",
                  borderRadius:"var(--r-md)", cursor:"pointer",
                  transition:"border-color var(--dur)",
                }}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor="var(--accent)" }}
                  onDragLeave={e => e.currentTarget.style.borderColor="var(--border)"}
                  onDrop={e => {
                    e.preventDefault()
                    e.currentTarget.style.borderColor="var(--border)"
                    const f = e.dataTransfer.files?.[0]
                    if (f) setVideoFile(f)
                  }}>
                  <input type="file" accept="video/*"
                    data-testid="input-video-file"
                    onChange={e => setVideoFile(e.target.files?.[0] || null)}
                    style={{ display:"none" }} />
                  {videoFile ? (
                    <>
                      <p style={{ fontSize:"13px", color:"var(--accent-text)", fontWeight:500 }}>
                        📁 {videoFile.name}
                      </p>
                      <p style={{ fontSize:"11px", color:"var(--text-3)" }}>
                        {(videoFile.size / 1024 / 1024).toFixed(1)} MB · Clic para cambiar
                      </p>
                    </>
                  ) : lesson?.video_source ? (
                    <>
                      <p style={{ fontSize:"13px", color:"var(--text-2)" }}>
                        ✓ Video actual cargado
                      </p>
                      <p style={{ fontSize:"11px", color:"var(--text-3)" }}>
                        Clic o arrastrá para reemplazar
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize:"13px", color:"var(--text-2)" }}>
                        📁 Clic o arrastrá tu video acá
                      </p>
                      <p style={{ fontSize:"11px", color:"var(--text-3)" }}>
                        MP4 recomendado · hasta 500 MB
                      </p>
                    </>
                  )}
                </label>
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div style={{ marginTop:"10px", background:"var(--surface-2)",
                    borderRadius:"var(--r-full)", overflow:"hidden", height:"6px" }}>
                    <div style={{
                      width:`${uploadProgress}%`, height:"100%",
                      background:"var(--accent)", transition:"width 200ms",
                    }} />
                  </div>
                )}
                {uploadProgress > 0 && (
                  <p style={{ fontSize:"11px", color:"var(--text-3)",
                    marginTop:"6px", textAlign:"center" }}>
                    {uploadProgress === 100 ? "Procesando…" : `Subiendo ${uploadProgress}%`}
                  </p>
                )}
              </>
            )}
          </div>
      <FormField label="Descripción">
        <textarea value={form.description} rows={3}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          style={{ ...inputSt, resize: "vertical" }} />
      </FormField>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <FormField label="Orden">
          <input type="number" value={form.order} min="1"
            onChange={e => setForm(p => ({ ...p, order: parseInt(e.target.value) || 1 }))}
            style={inputSt} />
        </FormField>
        <FormField label="Duración (min)">
          <input type="number" value={form.duration_minutes} min="0"
            onChange={e => setForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 0 }))}
            style={inputSt} />
        </FormField>
      </div>
      <div style={{ display: "flex", gap: "20px" }}>
        {[
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
    </FormModal>
  )
}

export default function AdminLessons() {
  const [searchParams]    = useSearchParams()
  const moduleFilter      = searchParams.get("module") || ""
  const [modal, setModal]     = useState(null)
  const [toDelete, setToDelete] = useState(null)
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
    onSuccess:  () => { queryClient.invalidateQueries(["admin-lessons"]); setToDelete(null) },
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

      <ConfirmationModal
        open={!!toDelete}
        title="¿Eliminar lección?"
        description={toDelete ? `Se eliminará "${toDelete.title}" permanentemente.` : ""}
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
        testId="delete-lesson-modal"
      />

      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "28px", gap: "16px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 800,
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
          borderRadius: "var(--r-xl)", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ display: "grid",
            gridTemplateColumns: "40px 2.5fr 2fr 80px 80px 80px", minWidth: "680px",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>#</span><span>Título</span><span>Módulo</span>
            <span>Duración</span><span>Tipo</span><span />
          </div>
          {lessons.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px" }}>
              Sin lecciones. Crea la primera arriba.
            </div>
          ) : lessons.map((lesson, i) => (
            <div key={lesson.id} style={{
              display: "grid",
              gridTemplateColumns: "40px 2.5fr 2fr 80px 80px 80px", minWidth: "680px",
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
              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={() => setModal(lesson)} style={{
                  padding: "4px 8px", borderRadius: "var(--r-sm)", fontSize: "11px",
                  cursor: "pointer", color: "#60a5fa",
                  background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)",
                }}>✎</button>
                <button onClick={() => setToDelete(lesson)} style={{
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