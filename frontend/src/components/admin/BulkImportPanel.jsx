// components/admin/BulkImportPanel.jsx — Panel reutilizable de importación
import { useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import api from "../../api/client"
import { showToast } from "../ui/ToastNotification"

/**
 * <BulkImportPanel
 *    endpoint="/admin/brands/import/"
 *    entityLabel="marcas"
 *    templateColumns={["nombre", "sitio_web", "activo"]}
 *    templateExample={["Neumann", "https://neumann.com", "si"]}
 *    invalidateKey="admin-brands"
 * />
 */
export default function BulkImportPanel({
  endpoint,
  entityLabel        = "registros",
  templateColumns    = [],
  templateExample    = [],
  invalidateKey      = null,
  testId             = "bulk-import",
}) {
  const inputRef  = useRef(null)
  const qc        = useQueryClient()
  const [busy,    setBusy]    = useState(false)
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState("")

  const downloadTemplate = () => {
    const csv = [
      templateColumns.join(","),
      templateExample.join(","),
    ].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href = url
    a.download = `plantilla_${entityLabel}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  const upload = async (file) => {
    if (!file) return
    setBusy(true); setError(""); setResult(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const { data } = await api.post(endpoint, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setResult(data)
      if (invalidateKey) qc.invalidateQueries({ queryKey: [invalidateKey] })
      showToast(`✓ ${data.total_processed} ${entityLabel} procesados`)
    } catch (e) {
      setError(e?.response?.data?.error || "Error al procesar el archivo.")
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div data-testid={testId} style={{
      padding:"18px 22px",
      background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:"var(--r-xl)",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"start", gap:"14px", marginBottom:"14px",
        flexWrap:"wrap" }}>
        <div>
          <p style={{ fontSize:"11px", color:"var(--accent-text)",
            letterSpacing:"0.1em", textTransform:"uppercase",
            fontWeight:600, marginBottom:"4px" }}>
            Importación masiva
          </p>
          <p style={{ fontSize:"13px", color:"var(--text-2)" }}>
            Cargá {entityLabel} en lote desde Excel (.xlsx) o CSV.
          </p>
        </div>
        <button onClick={downloadTemplate}
          data-testid={`${testId}-template`}
          style={{
            padding:"7px 14px", fontSize:"12px",
            background:"transparent", border:"1px solid var(--border)",
            color:"var(--text-2)", borderRadius:"var(--r-full)",
            cursor:"pointer",
          }}>
          ↓ Plantilla CSV
        </button>
      </div>

      <div style={{ display:"flex", gap:"10px", alignItems:"center",
        flexWrap:"wrap" }}>
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv"
          data-testid={`${testId}-input`}
          onChange={(e) => upload(e.target.files?.[0])}
          disabled={busy}
          style={{
            flex:1, minWidth:"240px",
            padding:"9px 12px", fontSize:"12px",
            background:"var(--surface-2)", border:"1px solid var(--border)",
            borderRadius:"var(--r-md)", color:"var(--text-2)",
          }} />
        {busy && <span style={{ fontSize:"12px", color:"var(--text-3)" }}>
          Procesando…
        </span>}
      </div>

      <p style={{ fontSize:"11px", color:"var(--text-3)", marginTop:"8px" }}>
        Columnas: <code style={{ fontFamily:"monospace" }}>
          {templateColumns.join(", ")}
        </code>
      </p>

      {error && (
        <div style={{
          marginTop:"12px", padding:"10px 14px",
          background:"rgba(239,68,68,0.08)",
          border:"1px solid rgba(239,68,68,0.3)",
          borderRadius:"var(--r-md)", fontSize:"12px",
          color:"#ef4444",
        }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop:"12px", padding:"12px 14px",
          background:"var(--surface-2)", border:"1px solid var(--border)",
          borderRadius:"var(--r-md)", fontSize:"12px" }}>
          <div style={{ display:"flex", gap:"14px", flexWrap:"wrap",
            marginBottom: result.errors?.length ? "10px" : 0 }}>
            <span style={{ color:"var(--accent-text)" }}>
              ✓ {result.created?.length || 0} creados
            </span>
            <span style={{ color:"#60a5fa" }}>
              ↻ {result.updated?.length || 0} actualizados
            </span>
            {result.errors?.length > 0 && (
              <span style={{ color:"#D97706" }}>
                ⚠ {result.errors.length} con errores
              </span>
            )}
          </div>
          {result.errors?.length > 0 && (
            <details>
              <summary style={{ cursor:"pointer", color:"#D97706",
                fontSize:"11px" }}>
                Ver errores
              </summary>
              <ul style={{ marginTop:"8px", paddingLeft:"20px",
                color:"var(--text-2)" }}>
                {result.errors.slice(0, 20).map((e, i) => (
                  <li key={i} style={{ fontSize:"11px", marginTop:"3px" }}>
                    Fila {e.row}: {e.name} — {e.error}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
