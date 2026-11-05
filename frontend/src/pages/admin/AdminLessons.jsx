// pages/admin/AdminLessons.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import {
  getAdminLessons, deleteAdminLesson, getAdminModules,
  getLessonVideoUploadUrl,
} from "../../api/admin.api"
import api from "../../api/client"
import {
  AdminPageHeader, PrimaryButton, SecondaryButton, StatusBadge, IconButton,
  FormModal, FormField, formInputStyle as inputSt, ConfirmationModal,
} from "../../components/admin/ui"
import { showToast } from "../../components/ui/ToastNotification"
import { Pencil, Trash2 } from "lucide-react"

// PUT directo a la URL firmada de GCS — Cloud Run tiene un límite duro
// de 32MB por request que no se puede subir con ninguna config de
// Django, así que un video de lección real (varios minutos) nunca
// llega si pasa por el backend. Usamos XHR (no fetch) para poder
// trackear el progreso de subida, igual que antes.
function uploadFileDirectToGCS(url, file, contentType, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    xhr.setRequestHeader("Content-Type", contentType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`No se pudo subir el video (${xhr.status}).`))
    }
    xhr.onerror = () => reject(new Error("Error de red subiendo el video."))
    xhr.send(file)
  })
}

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
      const payload = {
        title:            form.title,
        module:           form.module,
        description:      form.description || "",
        order:            form.order || 1,
        duration_minutes: form.duration_minutes || 0,
        is_free:          form.is_free,
      }

      if (videoMode === "url") {
        payload.video_url = form.video_url || ""
      } else if (videoFile) {
        // 1) Pedimos una URL firmada de subida directa a GCS
        const { upload_url, object_path, content_type } =
          await getLessonVideoUploadUrl(videoFile.name, videoFile.type || "video/mp4")
        // 2) Subimos el archivo DIRECTO a GCS (nunca pasa por Django/Cloud Run)
        await uploadFileDirectToGCS(upload_url, videoFile, content_type, setProgress)
        // 3) Recién ahora guardamos la lección, mandando la ruta ya subida
        payload.video_file_path = object_path
      }
      // Si videoMode === "local" y no se eligió un archivo nuevo (edición
      // sin cambiar el video), no mandamos nada de video — se mantiene el actual.

      const endpoint = lesson?.id
        ? `/admin/academy/lessons/${lesson.id}/`
        : `/admin/academy/lessons/`
      const method = lesson?.id ? "patch" : "post"

      await api[method](endpoint, payload)
      queryClient.invalidateQueries({ queryKey:["admin-lessons"] })
      onSave?.(); onClose()
    } catch (e) {
      const data = e?.response?.data
      let msg = e?.message || "Error al guardar."
      if (data) {
        if (typeof data === "string") msg = data
        else if (data.error) msg = data.error
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
    onError:    (e) => {
      showToast(e?.response?.data?.detail || "No se pudo eliminar la lección.", "error")
      setToDelete(null)
    },
  })

  const lessons = data?.results || data || []
  const modules = modulesData?.results || modulesData || []
  const currentModule = modules.find(m => m.id.toString() === moduleFilter)

  return (
    <div className="au-page">
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

      <AdminPageHeader
        eyebrow="LEVELPRO / ACADEMIA"
        title="Lecciones"
        description={`${lessons.length} lecciones registradas`}
        breadcrumbs={[
          { label: "Academia", to: "/admin/academy" },
          { label: "Módulos", to: "/admin/academy/modules" },
          { label: currentModule?.title || "Todas las lecciones" },
        ]}
        actions={
          <>
            <SecondaryButton to="/admin/academy/modules" size="sm">← Módulos</SecondaryButton>
            <PrimaryButton onClick={() => setModal("new")}>+ Nueva lección</PrimaryButton>
          </>
        }
      />

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
                  <th style={{ width: "56px" }}>#</th>
                  <th>Título</th>
                  <th>Módulo</th>
                  <th>Duración</th>
                  <th>Tipo</th>
                  <th style={{ width: "96px", textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lessons.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "42px", textAlign: "center", color: "var(--admin-text-secondary)" }}>
                      Sin lecciones. Crea la primera arriba.
                    </td>
                  </tr>
                ) : lessons.map((lesson) => (
                  <tr key={lesson.id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-text-muted)" }}>
                      {lesson.order}
                    </td>
                    <td>
                      <p style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--admin-text)" }}>
                        {lesson.title}
                      </p>
                      {(lesson.video_url || lesson.video_source) && (
                        <p style={{ fontSize: "11px", color: "var(--admin-primary-text)", fontWeight: 600 }}>
                          ▶ Video adjunto
                        </p>
                      )}
                    </td>
                    <td style={{ color: "var(--admin-text-secondary)" }}>
                      {lesson.module_title || modules.find(m => m.id === lesson.module)?.title || "—"}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text-muted)" }}>
                      {lesson.duration_minutes > 0 ? `${lesson.duration_minutes} min` : "—"}
                    </td>
                    <td>
                      <StatusBadge tone={lesson.is_free ? "success" : "neutral"}>
                        {lesson.is_free ? "Free" : "Pro"}
                      </StatusBadge>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <IconButton icon={Pencil} label="Editar" onClick={() => setModal(lesson)} />
                        <IconButton icon={Trash2} label="Eliminar" danger onClick={() => setToDelete(lesson)} />
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