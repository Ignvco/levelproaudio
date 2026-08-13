// pages/admin/AdminCertifications.jsx — Rutas de certificación profesional
// (antes se configuraban desde el admin de Django).

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  listAdminCertifications, createAdminCertification,
  updateAdminCertification, deleteAdminCertification, getAdminCourses,
} from "../../api/admin.api"
import {
  AdminPageHeader, StatusBadge, FormModal, FormField, formInputStyle,
  ConfirmationModal, EmptyState,
} from "../../components/admin/ui"
import { showToast } from "../../components/ui/ToastNotification"
import { Award, Plus, Pencil, Trash2 } from "lucide-react"

function CertModal({ item, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!item?.id
  const [form, setForm] = useState({
    title:        item?.title        || "",
    description:  item?.description   || "",
    seal_label:   item?.seal_label    || "Profesional Certificado LevelPro",
    is_published: item?.is_published  ?? false,
    order:        item?.order         ?? 0,
    course_ids:   item?.courses?.map(c => c.id) || [],
  })

  const { data: coursesData } = useQuery({
    queryKey: ["admin-courses-all"],
    queryFn:  () => getAdminCourses({ page_size: 100 }),
  })
  const courses = coursesData?.results || coursesData || []

  const toggleCourse = (id) => {
    setForm(p => ({
      ...p,
      course_ids: p.course_ids.includes(id)
        ? p.course_ids.filter(c => c !== id)
        : [...p.course_ids, id],
    }))
  }

  const save = useMutation({
    mutationFn: () => isEdit
      ? updateAdminCertification(item.id, form)
      : createAdminCertification(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-certifications"] })
      showToast(isEdit ? "Certificación actualizada" : "Certificación creada")
      onClose()
    },
    onError: (e) => showToast(e?.response?.data?.detail || "No se pudo guardar.", "error"),
  })

  return (
    <FormModal title={isEdit ? "Editar certificación" : "Nueva certificación"} onClose={onClose}
      onSave={() => save.mutate()} saving={save.isPending}>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <FormField label="Título">
          <input style={formInputStyle} value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Ej: Certificación en Sonido en Vivo" />
        </FormField>
        <FormField label="Descripción">
          <textarea style={{ ...formInputStyle, minHeight: "60px" }} value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        </FormField>
        <FormField label="Texto del sello">
          <input style={formInputStyle} value={form.seal_label}
            onChange={e => setForm(p => ({ ...p, seal_label: e.target.value }))} />
        </FormField>

        <FormField label="Cursos requeridos (se obtiene al completar TODOS)">
          <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid var(--border)",
            borderRadius: "var(--r-md)", padding: "4px" }}>
            {courses.length === 0 ? (
              <p style={{ padding: "10px", fontSize: "12px", color: "var(--text-3)" }}>
                No hay cursos disponibles.
              </p>
            ) : courses.map(c => (
              <label key={c.id} style={{ display: "flex", alignItems: "center", gap: "10px",
                padding: "8px 10px", cursor: "pointer", fontSize: "13px", borderRadius: "var(--r-sm)" }}>
                <input type="checkbox" checked={form.course_ids.includes(c.id)}
                  onChange={() => toggleCourse(c.id)}
                  style={{ accentColor: "var(--accent)", width: "14px", height: "14px" }} />
                {c.title}
              </label>
            ))}
          </div>
        </FormField>

        <FormField label="Publicada">
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <input type="checkbox" checked={form.is_published}
              onChange={e => setForm(p => ({ ...p, is_published: e.target.checked }))} />
            <span style={{ fontSize: "13px", color: "var(--text-2)" }}>
              {form.is_published ? "Visible en la Academia" : "Borrador (oculta)"}
            </span>
          </label>
        </FormField>
      </div>
    </FormModal>
  )
}

export default function AdminCertifications() {
  const qc = useQueryClient()
  const [modal, setModal]       = useState(null)
  const [toDelete, setToDelete] = useState(null)

  const { data: certs = [] } = useQuery({
    queryKey: ["admin-certifications"], queryFn: listAdminCertifications,
  })

  const delMutation = useMutation({
    mutationFn: () => deleteAdminCertification(toDelete.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-certifications"] })
      showToast("Eliminada")
      setToDelete(null)
    },
    onError: () => showToast("No se pudo eliminar.", "error"),
  })

  const iconBtn = {
    display: "inline-flex", padding: "6px", borderRadius: "var(--r-md)",
    cursor: "pointer", border: "1px solid var(--border)",
    background: "transparent", color: "var(--text-2)",
  }

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      <AdminPageHeader
        title="Certificaciones"
        subtitle="Rutas de certificación profesional: un conjunto de cursos que, al completarse todos, otorgan un sello al alumno."
      />

      {modal && <CertModal item={modal === "new" ? null : modal} onClose={() => setModal(null)} />}
      {toDelete && (
        <ConfirmationModal
          title="Eliminar certificación"
          message="¿Seguro? Esto no borra el progreso de los alumnos, solo la ruta."
          onConfirm={() => delMutation.mutate()}
          onCancel={() => setToDelete(null)}
          confirming={delMutation.isPending}
        />
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
        <button onClick={() => setModal("new")}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "8px 14px", borderRadius: "var(--r-md)", cursor: "pointer",
            fontSize: "13px", fontWeight: 600, border: "none",
            background: "var(--accent)", color: "#000" }}>
          <Plus size={15} /> Nueva certificación
        </button>
      </div>

      {certs.length === 0 ? (
        <EmptyState icon={Award}
          message="No hay certificaciones. Creá una ruta agrupando varios cursos." />
      ) : (
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left",
                color: "var(--text-3)", fontSize: "11px", textTransform: "uppercase" }}>
                <th style={{ padding: "12px 16px" }}>Título</th>
                <th style={{ padding: "12px 16px" }}>Cursos</th>
                <th style={{ padding: "12px 16px" }}>Estado</th>
                <th style={{ padding: "12px 16px" }}></th>
              </tr>
            </thead>
            <tbody>
              {certs.map(c => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px" }}>{c.title}</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-3)" }}>
                    {c.courses?.length || 0} curso{(c.courses?.length || 0) !== 1 ? "s" : ""}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <StatusBadge tone={c.is_published ? "success" : "neutral"}>
                      {c.is_published ? "Publicada" : "Borrador"}
                    </StatusBadge>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "6px" }}>
                      <button style={iconBtn} onClick={() => setModal(c)}><Pencil size={13} /></button>
                      <button style={iconBtn} onClick={() => setToDelete(c)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
