// pages/admin/AdminProductImport.jsx
import { useState, useRef } from "react"
import { useMutation } from "@tanstack/react-query"
import { importProducts, downloadTemplate } from "../../api/admin.api"
import { AdminPageHeader, SectionCard, PrimaryButton, SecondaryButton } from "../../components/admin/ui"

export default function AdminProductImport() {
  const [file, setFile]         = useState(null)
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState("")
  const fileRef                 = useRef(null)

  const importMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append("file", file)
      return importProducts(fd)
    },
    onSuccess: (data) => { setResult(data); setFile(null); setError("") },
    onError:   (e)    => setError(e?.response?.data?.error || "Error al importar."),
  })

  const handleDownloadTemplate = async () => {
    const blob = await downloadTemplate()
    const url  = window.URL.createObjectURL(new Blob([blob]))
    const link = document.createElement("a")
    link.href  = url
    link.setAttribute("download", "template_productos.xlsx")
    document.body.appendChild(link)
    link.click(); link.remove()
  }

  return (
    <div className="au-page">
      <AdminPageHeader
        eyebrow="LEVELPRO / CATÁLOGO"
        title="Importar productos"
        description="Cargá múltiples productos desde un archivo Excel (.xlsx)"
        breadcrumbs={[
          { label: "Productos", to: "/admin/products" },
          { label: "Importar" },
        ]}
        actions={
          <SecondaryButton to="/admin/products" size="sm">
            ← Volver a Productos
          </SecondaryButton>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "18px", alignItems: "start" }}>
        {/* Paso 1 — Descargar template */}
        <SectionCard
          eyebrow="PASO 1"
          title="Descargá la plantilla oficial"
          description="Usá esta plantilla como base. Completá los campos obligatorios (nombre, precio, SKU, stock) y guardá como .xlsx."
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", paddingTop: "8px" }}>
            <span style={{ fontSize: "12px", color: "var(--admin-text-muted)", fontFamily: "var(--font-mono)" }}>
              template_productos.xlsx
            </span>
            <SecondaryButton onClick={handleDownloadTemplate}>
              ⬇ Descargar template
            </SecondaryButton>
          </div>
        </SectionCard>

        {/* Paso 2 — Subir archivo */}
        <SectionCard
          eyebrow="PASO 2"
          title="Subí el archivo completado"
          description="Formatos admitidos: .xlsx, .xls y .csv codificado en UTF-8."
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
            onChange={e => setFile(e.target.files?.[0])}
            style={{ display: "none" }} />
          <button type="button" onClick={() => fileRef.current?.click()} style={{
            width: "100%", padding: "32px 20px", borderRadius: "16px",
            background: file ? "var(--admin-primary-soft)" : "var(--admin-surface-soft)",
            border: `2px dashed ${file ? "var(--admin-primary)" : "var(--admin-border-strong)"}`,
            color: file ? "var(--admin-primary-text)" : "var(--admin-text-secondary)",
            fontSize: "13.5px", fontWeight: 700, cursor: "pointer", marginBottom: "14px",
            transition: "all 180ms ease",
          }}>
            {file ? `✓ ${file.name}` : "Seleccionar archivo .xlsx"}
          </button>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "12px",
              background: "var(--admin-danger-soft)", border: "1px solid rgba(239,68,68,0.25)",
              color: "#B91C1C", fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>
              {error}
            </div>
          )}

          <PrimaryButton
            onClick={() => importMutation.mutate()}
            disabled={!file || importMutation.isPending}
            loading={importMutation.isPending}
            style={{ width: "100%" }}
          >
            {importMutation.isPending ? "⏳ Importando..." : "🚀 Importar productos"}
          </PrimaryButton>
        </SectionCard>
      </div>

      {/* Resultado */}
      {result && (
        <SectionCard
          eyebrow="RESULTADO DE IMPORTACIÓN"
          title="Importación completada"
          description={`${result.created?.length || 0} creados · ${result.updated?.length || 0} actualizados${result.errors?.length > 0 ? ` · ${result.errors.length} errores` : ""}`}
          actions={
            <SecondaryButton size="sm" onClick={() => setResult(null)}>
              Importar más productos
            </SecondaryButton>
          }
        >
          {result.errors?.length > 0 && (
            <div style={{ padding: "12px 14px", borderRadius: "12px",
              background: "var(--admin-danger-soft)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "#B91C1C",
                marginBottom: "8px" }}>
                Filas con errores:
              </p>
              {result.errors.map((err, i) => (
                <p key={i} style={{ fontSize: "12px", color: "var(--admin-text)",
                  marginBottom: "4px" }}>
                  Fila {err.row} ({err.name}): {err.error}
                </p>
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  )
}