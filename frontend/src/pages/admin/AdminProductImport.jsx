// pages/admin/AdminProductImport.jsx — Centro de Importación PIM (BF-16)
import { useState, useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { importProducts, downloadTemplate } from "../../api/admin.api"
import { AdminPageHeader, SectionCard, PrimaryButton, SecondaryButton, StatusBadge } from "../../components/admin/ui"
import { showToast } from "../../utils/toast"
import { Eye, CheckCircle2, FileSpreadsheet, AlertTriangle } from "lucide-react"

export default function AdminProductImport() {
  const [file, setFile]           = useState(null)
  const [simulation, setSimulation] = useState(null)
  const [confirmed, setConfirmed] = useState(null)
  const [error, setError]         = useState("")
  const fileRef                   = useRef(null)
  const queryClient               = useQueryClient()

  const runImportMutation = useMutation({
    mutationFn: async ({ dryRun }) => {
      const fd = new FormData()
      fd.append("file", file)
      return importProducts(fd, { dryRun, confirm: !dryRun })
    },
    onSuccess: (data, vars) => {
      setError("")
      if (vars.dryRun) {
        setSimulation(data)
        setConfirmed(null)
      } else {
        setConfirmed(data)
        setSimulation(null)
        setFile(null)
        queryClient.invalidateQueries({ queryKey: ["admin-products"] })
        showToast("Importación aplicada y auditada correctamente")
      }
    },
    onError: (e) => setError(e?.response?.data?.error || "Error al procesar el archivo."),
  })

  const handleDownloadTemplate = async (fmt) => {
    try {
      const blob = await downloadTemplate(fmt)
      const url  = window.URL.createObjectURL(new Blob([blob]))
      const link = document.createElement("a")
      link.href  = url
      link.setAttribute("download", `template_pim_productos.${fmt}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch {
      showToast("No se pudo descargar la plantilla", "error")
    }
  }

  const activeReport = confirmed || simulation
  const summary = activeReport?.summary || { new: 0, updated: 0, skipped: 0, rejected: 0 }

  return (
    <div className="au-page">
      <AdminPageHeader
        eyebrow="LEVELPRO / CATÁLOGO PIM"
        title="Importar productos y variantes"
        description="Simulación previa (dry-run), validación de monedas CLP/USD/ARS, reporte por fila y confirmación explícita."
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: "18px", alignItems: "start" }}>
        {/* Paso 1 — Descargar plantilla */}
        <SectionCard
          eyebrow="PASO 1"
          title="Descargá la plantilla oficial PIM"
          description="Incluye columnas para productos maestros, variantes (parent_sku), precios aislados CLP/USD/ARS y especificaciones técnicas (spec:*)."
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", paddingTop: "8px" }}>
            <span style={{ fontSize: "12px", color: "var(--admin-text-muted)", fontFamily: "var(--font-mono)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <FileSpreadsheet size={14} /> template_pim_productos
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <SecondaryButton size="sm" onClick={() => handleDownloadTemplate("xlsx")}>
                ⬇ .xlsx
              </SecondaryButton>
              <SecondaryButton size="sm" onClick={() => handleDownloadTemplate("csv")}>
                ⬇ .csv
              </SecondaryButton>
            </div>
          </div>
        </SectionCard>

        {/* Paso 2 — Subir archivo y simular */}
        <SectionCard
          eyebrow="PASO 2"
          title="Simulá antes de aplicar cambios"
          description="Celdas vacías conservan el dato actual; 0 aplica valor cero; __CLEAR__ limpia campos opcionales."
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
            onChange={e => { setFile(e.target.files?.[0] || null); setSimulation(null); setConfirmed(null); setError("") }}
            style={{ display: "none" }} />
          <button type="button" onClick={() => fileRef.current?.click()} style={{
            width: "100%", padding: "28px 20px", borderRadius: "16px",
            background: file ? "var(--admin-primary-soft)" : "var(--admin-surface-soft)",
            border: `2px dashed ${file ? "var(--admin-primary)" : "var(--admin-border-strong)"}`,
            color: file ? "var(--admin-primary-text)" : "var(--admin-text-secondary)",
            fontSize: "13.5px", fontWeight: 700, cursor: "pointer", marginBottom: "14px",
            transition: "all 180ms ease",
          }}>
            {file ? `✓ ${file.name}` : "Seleccionar archivo .xlsx o .csv (máx 10 MB)"}
          </button>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "12px",
              background: "var(--admin-danger-soft)", border: "1px solid rgba(239,68,68,0.25)",
              color: "#B91C1C", fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <SecondaryButton
              data-testid="import-dry-run-btn"
              onClick={() => runImportMutation.mutate({ dryRun: true })}
              disabled={!file || runImportMutation.isPending}
              style={{ flex: 1 }}
            >
              <Eye size={14} /> {runImportMutation.isPending ? "Analizando..." : "1. Simular (Dry-Run)"}
            </SecondaryButton>

            {simulation && (simulation.summary.new + simulation.summary.updated > 0) && (
              <PrimaryButton
                data-testid="import-confirm-btn"
                onClick={() => runImportMutation.mutate({ dryRun: false })}
                disabled={runImportMutation.isPending}
                loading={runImportMutation.isPending}
                style={{ flex: 1 }}
              >
                <CheckCircle2 size={14} /> 2. Confirmar importación ({simulation.summary.new + simulation.summary.updated})
              </PrimaryButton>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Resultado / Previsualización */}
      {activeReport && (
        <SectionCard
          eyebrow={activeReport.dry_run ? "SIMULACIÓN (SIN CAMBIOS EN DB)" : "IMPORTACIÓN APLICADA"}
          title={activeReport.dry_run ? "Previsualización de registros" : "Importación completada con éxito"}
          description={`Nuevos: ${summary.new} · Actualizados: ${summary.updated} · Omitidos: ${summary.skipped} · Rechazados: ${summary.rejected}`}
        >
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
            <StatusBadge tone="success">Nuevos: {summary.new}</StatusBadge>
            <StatusBadge tone="info">Actualizados: {summary.updated}</StatusBadge>
            <StatusBadge tone="neutral">Omitidos: {summary.skipped}</StatusBadge>
            <StatusBadge tone={summary.rejected > 0 ? "danger" : "neutral"}>Rechazados: {summary.rejected}</StatusBadge>
          </div>

          {activeReport.rows?.length > 0 && (
            <div className="au-tscroll" style={{ maxHeight: "340px", overflowY: "auto", border: "1px solid var(--admin-border)", borderRadius: "12px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                <thead>
                  <tr style={{ background: "var(--admin-surface-soft)", textAlign: "left" }}>
                    <th style={{ padding: "8px 12px" }}>Fila</th>
                    <th style={{ padding: "8px 12px" }}>Tipo</th>
                    <th style={{ padding: "8px 12px" }}>SKU</th>
                    <th style={{ padding: "8px 12px" }}>Nombre</th>
                    <th style={{ padding: "8px 12px" }}>Estado</th>
                    <th style={{ padding: "8px 12px" }}>Detalle / Error</th>
                  </tr>
                </thead>
                <tbody>
                  {activeReport.rows.map((r, idx) => (
                    <tr key={idx} style={{ borderTop: "1px solid var(--admin-border)" }}>
                      <td style={{ padding: "8px 12px", fontFamily: "var(--font-mono)" }}>{r.row}</td>
                      <td style={{ padding: "8px 12px" }}>{r.entity}</td>
                      <td style={{ padding: "8px 12px", fontFamily: "var(--font-mono)" }}>{r.sku || "—"}</td>
                      <td style={{ padding: "8px 12px", fontWeight: 600 }}>{r.name}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <StatusBadge tone={
                          r.status === "new" ? "success"
                            : r.status === "updated" ? "info"
                            : r.status === "rejected" ? "danger" : "neutral"
                        }>
                          {r.status}
                        </StatusBadge>
                      </td>
                      <td style={{ padding: "8px 12px", color: r.error ? "#B91C1C" : "var(--admin-text-muted)" }}>
                        {r.error ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <AlertTriangle size={12} /> {r.error}
                          </span>
                        ) : (
                          Object.keys(r.changes || {}).join(", ") || "Sin cambios"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  )
}
