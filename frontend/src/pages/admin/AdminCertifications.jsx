// pages/admin/AdminCertifications.jsx — Rutas de certificación profesional
// (antes se configuraban desde el admin de Django).

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  listAdminCertifications, createAdminCertification,
  updateAdminCertification, deleteAdminCertification, getAdminCourses,
} from "../../api/admin.api"
import {
  AdminPageHeader, PrimaryButton, SecondaryButton, StatCard, IconButton,
  StatusBadge, FormModal, FormField, formInputStyle,
  ConfirmationModal, EmptyState, ErrorState,
} from "../../components/admin/ui"
import { showToast } from "../../utils/toast"
import { Award, Plus, Pencil, Trash2, CheckCircle2, BookOpen } from "lucide-react"
import { listFromResponse, queryDisplayState } from "../../utils/queryDisplayState"

function CertModal({ item, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!item?.id
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    title:        item?.title        || "",
    description:  item?.description   || "",
    seal_label:   item?.seal_label    || "Profesional Certificado LevelPro",
    is_published: item?.is_published  ?? false,
    order:        item?.order         ?? 0,
    course_ids:   item?.courses?.map(c => c.id) || [],
  })

  const coursesQuery = useQuery({
    queryKey: ["admin-courses-all"],
    queryFn:  () => getAdminCourses({ page_size: 100 }),
  })
  const courses = listFromResponse(coursesQuery.data)
  const coursesState = queryDisplayState(coursesQuery)

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
    onError: (e) => setError(e?.response?.data?.detail || "No se pudo guardar la certificación."),
  })

  return (
    <FormModal open title={isEdit ? "Editar certificación" : "Nueva certificación"} onClose={onClose}
      onSave={() => {
        if (coursesState !== "ready" || save.isPending) return
        if (!form.title.trim()) { setError("Ingresa un título."); return }
        setError("")
        save.mutate()
      }} saving={save.isPending} saveDisabled={coursesState !== "ready"} error={error} scrollableBody>
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
            {coursesState === "error" ? (
              <ErrorState title="No se pudieron cargar los cursos"
                action={<SecondaryButton onClick={() => coursesQuery.refetch()}>Reintentar cursos</SecondaryButton>} />
            ) : coursesState === "loading" ? (
              <p role="status">Cargando cursos…</p>
            ) : courses.length === 0 ? (
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

  const certsQuery = useQuery({
    queryKey: ["admin-certifications"], queryFn: listAdminCertifications,
  })
  const state = queryDisplayState(certsQuery)
  const certs = listFromResponse(certsQuery.data)

  const delMutation = useMutation({
    mutationFn: () => deleteAdminCertification(toDelete.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-certifications"] })
      showToast("Eliminada")
      setToDelete(null)
    },
    onError: () => showToast("No se pudo eliminar.", "error"),
  })

  const publishedCount = certs.filter(c => c.is_published).length
  const linkedCoursesCount = certs.reduce((acc, c) => acc + (c.courses?.length || 0), 0)

  return (
    <div className="au-page">
      <AdminPageHeader
        eyebrow="LEVELPRO / ACADEMIA"
        title="Certificaciones"
        description="Rutas de cursos y sellos profesionales."
        breadcrumbs={[
          { label: "Academia", to: "/admin/academy" },
          { label: "Certificaciones" },
        ]}
        actions={
          <>
            <SecondaryButton to="/admin/academy" size="sm">← Cursos</SecondaryButton>
            <PrimaryButton icon={Plus} disabled={state !== "ready"} onClick={() => setModal("new")}>
              Nueva certificación
            </PrimaryButton>
          </>
        }
      />

      <div className="lp-kpi-strip">
        <StatCard
          variant="ink"
          Icon={Award}
          label="Rutas de certificación"
          value={state === "ready" ? certs.length : "—"}
          sub="Configuradas en Academia"
        />
        <StatCard
          variant="primary"
          Icon={CheckCircle2}
          label="Publicadas"
          value={state === "ready" ? publishedCount : "—"}
          sub="Visibles para alumnos"
        />
        <StatCard
          variant="light"
          Icon={BookOpen}
          label="Cursos vinculados"
          value={state === "ready" ? linkedCoursesCount : "—"}
          sub="Requisitos acumulados"
        />
      </div>

      {modal && <CertModal item={modal === "new" ? null : modal} onClose={() => setModal(null)} />}
      {toDelete && (
        <ConfirmationModal
          open
          title="Eliminar certificación"
          description="¿Seguro? Esto no borra el progreso de los alumnos, solo la ruta."
          danger
          onConfirm={() => delMutation.mutate()}
          onCancel={() => setToDelete(null)}
          loading={delMutation.isPending}
        />
      )}

      {state === "error" ? (
        <ErrorState title="No se pudieron cargar las certificaciones"
          action={<SecondaryButton onClick={() => certsQuery.refetch()}>Reintentar certificaciones</SecondaryButton>} />
      ) : state === "loading" ? (
        <div role="status" aria-label="Cargando certificaciones">
          <div className="skeleton" style={{ height: "200px", borderRadius: "14px" }} />
        </div>
      ) : certs.length === 0 ? (
        <div className="au-card au-panel">
          <EmptyState Icon={Award}
            title="Sin certificaciones"
            description="Crea una ruta agrupando cursos." />
        </div>
      ) : (
        <div className="au-card au-table-wrap">
          <div className="au-tscroll">
            <table className="au-table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Sello</th>
                  <th>Cursos</th>
                  <th>Estado</th>
                  <th style={{ width: "96px", textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {certs.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700, color: "var(--admin-text)" }}>{c.title}</td>
                    <td style={{ color: "var(--admin-text-secondary)", fontSize: "12.5px" }}>{c.seal_label || "—"}</td>
                    <td style={{ color: "var(--admin-text-muted)", fontFamily: "var(--font-mono)" }}>
                      {c.courses?.length || 0} curso{(c.courses?.length || 0) !== 1 ? "s" : ""}
                    </td>
                    <td>
                      <StatusBadge tone={c.is_published ? "success" : "neutral"}>
                        {c.is_published ? "Publicada" : "Borrador"}
                      </StatusBadge>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <IconButton icon={Pencil} label={`Editar certificación ${c.title}`} onClick={() => setModal(c)} />
                        <IconButton icon={Trash2} label={`Eliminar certificación ${c.title}`} danger onClick={() => setToDelete(c)} />
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
