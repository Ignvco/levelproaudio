// pages/admin/AdminAcademy.jsx

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getAdminAcademy } from "../../api/admin.api"
import api from "../../api/client"

const levelLabels = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
}
const levelColors = {
  beginner: "#4ade80",
  intermediate: "#facc15",
  advanced: "#f87171",
}

// ── Modal curso ──────────────────────────────────────────────
function CourseModal({ course, onClose, onSave }) {
  const [form, setForm] = useState({
    title:             course?.title || "",
    price:             course?.price || 0,
    level:             course?.level || "beginner",
    is_free:           course?.is_free ?? false,
    is_published:      course?.is_published ?? false,
    short_description: course?.short_description || "",
    description:       course?.description || "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")

  const handleSave = async () => {
    setSaving(true)
    setError("")
    try {
      if (course?.id) {
        await api.patch(`/admin/courses/${course.id}/`, form)
      } else {
        await api.post("/admin/courses/", form)
      }
      onSave()
      onClose()
    } catch {
      setError("Error al guardar. Verifica los datos.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(8px)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)", width: "100%", maxWidth: "520px",
        maxHeight: "85vh", overflow: "auto",
      }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>
          <p style={{ fontSize: "15px", fontWeight: 500 }}>
            {course?.id ? "Editar curso" : "Nuevo curso"}
          </p>
          <button onClick={onClose} style={{ background: "none", border: "none",
            cursor: "pointer", color: "var(--text-3)", fontSize: "20px" }}>×</button>
        </div>

        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)",
              background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.2)",
              color: "var(--danger)", fontSize: "13px" }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "6px" }}>Título *</label>
            <input value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="input" placeholder="Nombre del curso" />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "6px" }}>Nivel</label>
            <select value={form.level}
              onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
              className="input" style={{ cursor: "pointer" }}>
              {Object.entries(levelLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                color: "var(--text-2)", marginBottom: "6px" }}>Precio</label>
              <input type="number" value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                className="input" disabled={form.is_free} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px",
              justifyContent: "flex-end", paddingBottom: "2px" }}>
              {[
                { key: "is_free",      label: "Gratis" },
                { key: "is_published", label: "Publicado" },
              ].map(({ key, label }) => (
                <label key={key} style={{ display: "flex", alignItems: "center",
                  gap: "8px", cursor: "pointer", fontSize: "13px" }}>
                  <input type="checkbox" checked={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                    style={{ accentColor: "var(--accent)" }} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "6px" }}>Descripción corta</label>
            <input value={form.short_description}
              onChange={e => setForm(f => ({ ...f, short_description: e.target.value }))}
              className="input" />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "6px" }}>Descripción completa</label>
            <textarea value={form.description} rows={4}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="input" style={{ resize: "vertical" }} />
          </div>
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)",
          display: "flex", gap: "10px", justifyContent: "flex-end",
          position: "sticky", bottom: 0, background: "var(--surface)" }}>
          <button onClick={onClose} className="btn btn-ghost"
            style={{ padding: "9px 20px", fontSize: "13px" }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="btn btn-accent"
            style={{ padding: "9px 20px", fontSize: "13px",
              opacity: saving ? 0.7 : 1 }}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── AdminAcademy ─────────────────────────────────────────────
export default function AdminAcademy() {
  const [modal, setModal]   = useState(null)
  const [levelFilter, setLevelFilter] = useState("")
  const queryClient         = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin-academy"],
    queryFn:  getAdminAcademy,
  })

  const courses = (data?.results || []).filter(
    c => !levelFilter || c.level === levelFilter
  )
  const onSave  = () => queryClient.invalidateQueries(["admin-academy"])

  // Agrupados por nivel
  const grouped = Object.entries(levelLabels).reduce((acc, [key, label]) => {
    const items = courses.filter(c => c.level === key)
    if (items.length) acc[key] = { label, items }
    return acc
  }, {})

  const totalEnrollments = (data?.results || []).reduce(
    (a, c) => a + c.enrollment_count, 0
  )

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      {modal !== null && (
        <CourseModal
          course={modal}
          onClose={() => setModal(null)}
          onSave={onSave}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px" }}>
            Academia
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            {(data?.results || []).length} cursos · {totalEnrollments} inscripciones
          </p>
        </div>
        <button onClick={() => setModal({})} className="btn btn-accent"
          style={{ padding: "10px 20px", fontSize: "13px" }}>
          + Nuevo curso
        </button>
      </div>

      {/* Filtros por nivel */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "24px", flexWrap: "wrap" }}>
        <button onClick={() => setLevelFilter("")} style={{
          padding: "6px 14px", borderRadius: "100px", fontSize: "12px",
          cursor: "pointer", transition: "all var(--dur) var(--ease)",
          background: !levelFilter ? "var(--text)" : "transparent",
          color: !levelFilter ? "var(--bg)" : "var(--text-2)",
          border: `1px solid ${!levelFilter ? "var(--text)" : "var(--border)"}`,
        }}>
          Todos
        </button>
        {Object.entries(levelLabels).map(([key, label]) => (
          <button key={key} onClick={() => setLevelFilter(key)} style={{
            padding: "6px 14px", borderRadius: "100px", fontSize: "12px",
            cursor: "pointer", transition: "all var(--dur) var(--ease)",
            background: levelFilter === key ? levelColors[key] : "transparent",
            color: levelFilter === key ? "#000" : "var(--text-2)",
            border: `1px solid ${levelFilter === key ? levelColors[key] : "var(--border)"}`,
          }}>
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "56px" }} />
          ))}
        </div>
      ) : levelFilter ? (
        /* Vista filtrada — tabla simple */
        <CourseTable courses={courses} onEdit={setModal} />
      ) : (
        /* Vista agrupada por nivel */
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          {Object.entries(grouped).map(([key, { label, items }]) => (
            <div key={key}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px",
                marginBottom: "12px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%",
                  background: levelColors[key] }} />
                <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-3)",
                  textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {label} — {items.length} curso{items.length > 1 ? "s" : ""}
                </p>
              </div>
              <CourseTable courses={items} onEdit={setModal} />
            </div>
          ))}
          {courses.length === 0 && (
            <div style={{ padding: "40px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px" }}>
              No hay cursos todavía.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tabla de cursos reutilizable ─────────────────────────────
function CourseTable({ courses, onEdit }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-lg)", overflow: "hidden" }}>
      <div style={{ display: "grid",
        gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 80px",
        padding: "10px 20px", borderBottom: "1px solid var(--border)",
        fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
        textTransform: "uppercase", letterSpacing: "0.08em" }}>
        <span>Curso</span>
        <span>Precio</span>
        <span>Lecciones</span>
        <span>Inscritos</span>
        <span>Estado</span>
        <span></span>
      </div>
      {courses.map((c, i) => (
        <div key={c.id} style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 80px",
          padding: "13px 20px", alignItems: "center",
          borderTop: i > 0 ? "1px solid var(--border)" : "none",
          transition: "background var(--dur) var(--ease)",
        }}
          className="hover:bg-[var(--surface-2)]"
        >
          <div>
            <p style={{ fontSize: "13px" }}>{c.title}</p>
            <p style={{ fontSize: "11px", color: "var(--text-3)",
              fontFamily: "monospace" }}>{c.slug}</p>
          </div>
          <span style={{ fontSize: "13px" }}>
            {c.is_free
              ? <span style={{ color: "var(--accent)", fontWeight: 500 }}>Gratis</span>
              : `$${Number(c.price).toLocaleString("es-CL")}`}
          </span>
          <span style={{ fontSize: "13px", color: "var(--text-2)" }}>
            {c.total_lessons}
          </span>
          <span style={{ fontSize: "13px", fontWeight: 500 }}>
            {c.enrollment_count}
          </span>
          <span style={{
            fontSize: "11px", padding: "2px 8px", borderRadius: "100px",
            fontWeight: 500, display: "inline-block",
            color:      c.is_published ? "#4ade80" : "var(--text-3)",
            background: c.is_published ? "rgba(74,222,128,0.1)" : "var(--surface-3)",
            border:     `1px solid ${c.is_published ? "rgba(74,222,128,0.25)" : "var(--border)"}`,
          }}>
            {c.is_published ? "Publicado" : "Borrador"}
          </span>
          <button onClick={() => onEdit(c)}
            style={{ fontSize: "12px", color: "var(--text-2)", background: "none",
              border: "none", cursor: "pointer", transition: "color var(--dur)" }}
            className="hover:text-white">
            Editar →
          </button>
        </div>
      ))}
    </div>
  )
}