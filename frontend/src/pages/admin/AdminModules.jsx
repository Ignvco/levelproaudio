// pages/admin/AdminModules.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSearchParams, Link } from "react-router-dom"
import {
  getAdminModules, createAdminModule,
  updateAdminModule, deleteAdminModule, getAdminCourses,
} from "../../api/admin.api"

const inputSt = {
  width: "100%", padding: "10px 14px",
  background: "var(--surface-2)", border: "1px solid var(--border)",
  borderRadius: "var(--r-md)", color: "var(--text)", fontSize: "13px", outline: "none",
}

function ModuleModal({ module, courseId, onClose, onSave }) {
  const [form, setForm]     = useState({
    title:     module?.title     || "",
    order:     module?.order     ?? 1,
    course:    module?.course    || courseId || "",
    is_active: module?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")
  const queryClient         = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => module?.id
      ? updateAdminModule(module.id, form)
      : createAdminModule(form),
    onSuccess: () => {
      queryClient.invalidateQueries(["admin-modules"])
      onSave?.(); onClose()
    },
    onError: (e) => setError(e?.response?.data?.detail || "Error al guardar."),
  })

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(8px)", zIndex: 200, display: "flex",
      alignItems: "center", justifyContent: "center", padding: "24px" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-2xl)", width: "100%", maxWidth: "400px",
        animation: "scaleIn 200ms var(--ease)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: "15px", fontWeight: 500 }}>
            {module?.id ? "Editar módulo" : "Nuevo módulo"}
          </p>
          <button onClick={onClose} style={{ background: "none", border: "none",
            cursor: "pointer", color: "var(--text-3)", fontSize: "22px" }}>×</button>
        </div>
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)",
              background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.2)",
              color: "var(--danger)", fontSize: "13px" }}>{error}</div>
          )}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "7px" }}>Título *</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              style={inputSt} placeholder="Nombre del módulo"
              onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "7px" }}>Orden</label>
            <input type="number" value={form.order} min="1"
              onChange={e => setForm(p => ({ ...p, order: parseInt(e.target.value) || 1 }))}
              style={inputSt}
              onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "8px",
            cursor: "pointer", fontSize: "13px" }}>
            <input type="checkbox" checked={form.is_active}
              onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
              style={{ accentColor: "var(--accent)" }} />
            Módulo activo
          </label>
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)",
          display: "flex", gap: "10px", justifyContent: "flex-end" }}>
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

export default function AdminModules() {
  const [searchParams]    = useSearchParams()
  const courseFilter      = searchParams.get("course") || ""
  const [modal, setModal] = useState(null)
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
    onSuccess:  () => queryClient.invalidateQueries(["admin-modules"]),
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
          onClose={() => setModal(null)}
          onSave={() => queryClient.invalidateQueries(["admin-modules"])}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "28px", gap: "16px",
        flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px",
            marginBottom: "8px", fontSize: "13px", color: "var(--text-3)" }}>
            <Link to="/admin/academy/courses" className="hover-accent"
              style={{ transition: "color var(--dur)" }}>
              Academia
            </Link>
            <span>/</span>
            <span style={{ color: "var(--text-2)" }}>
              {currentCourse?.title || "Todos los módulos"}
            </span>
          </div>
          <h1 style={{ fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 300,
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
          borderRadius: "var(--r-xl)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "48px 3fr 2fr 1fr 80px",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>#</span><span>Título</span>
            <span>Curso</span><span>Estado</span><span />
          </div>
          {modules.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px" }}>
              Sin módulos. Crea el primero arriba.
            </div>
          ) : modules.map((mod, i) => (
            <div key={mod.id} style={{
              display: "grid", gridTemplateColumns: "48px 3fr 2fr 1fr 80px",
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
                <p style={{ fontSize: "11px", color: "var(--text-3)" }}>
                  {mod.lessons_count ?? 0} lecciones
                </p>
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {mod.course_title || courses.find(c => c.id === mod.course)?.title || "—"}
              </span>
              <span style={{
                padding: "2px 8px", borderRadius: "var(--r-full)", fontSize: "11px",
                fontWeight: 500, display: "inline-block",
                color:      mod.is_active ? "var(--accent)" : "var(--text-3)",
                background: mod.is_active ? "var(--accent-dim)" : "var(--surface-2)",
                border:     `1px solid ${mod.is_active ? "var(--accent-glow)" : "var(--border)"}`,
              }}>
                {mod.is_active ? "Activo" : "Inactivo"}
              </span>
              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={() => setModal(mod)} style={{
                  padding: "4px 8px", borderRadius: "var(--r-sm)", fontSize: "11px",
                  cursor: "pointer", color: "#60a5fa",
                  background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)",
                }}>✎</button>
                <button onClick={() => {
                  if (window.confirm(`¿Eliminar "${mod.title}"?`))
                    deleteMutation.mutate(mod.id)
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