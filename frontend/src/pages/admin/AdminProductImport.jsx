// pages/admin/AdminProductImport.jsx
import { useState, useRef } from "react"
import { useMutation } from "@tanstack/react-query"
import { importProducts, downloadTemplate } from "../../api/admin.api"

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
    <div style={{ padding: "clamp(24px, 4vw, 40px)", maxWidth: "700px" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)",
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 300,
          letterSpacing: "-0.02em", marginBottom: "6px" }}>
          Importar productos
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
          Cargá múltiples productos desde un archivo Excel (.xlsx)
        </p>
      </div>

      {/* Paso 1 — Descargar template */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-2xl)", padding: "24px", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%",
            background: "var(--accent-dim)", border: "1px solid var(--accent-glow)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--accent)", fontSize: "14px", fontWeight: 700, flexShrink: 0 }}>
            1
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>
              Descargá la plantilla
            </p>
            <p style={{ fontSize: "13px", color: "var(--text-3)", marginBottom: "14px",
              lineHeight: 1.6 }}>
              Usá esta plantilla como base. Completá los campos y guardá como .xlsx.
            </p>
            <button onClick={handleDownloadTemplate} className="btn btn-ghost"
              style={{ padding: "9px 18px", fontSize: "13px" }}>
              ⬇ Descargar template
            </button>
          </div>
        </div>
      </div>

      {/* Paso 2 — Subir archivo */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-2xl)", padding: "24px", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%",
            background: "var(--surface-2)", border: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--text-3)", fontSize: "14px", fontWeight: 700, flexShrink: 0 }}>
            2
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>
              Subí el archivo completado
            </p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
              onChange={e => setFile(e.target.files?.[0])}
              style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} style={{
              width: "100%", padding: "36px 24px", borderRadius: "var(--r-xl)",
              background: file ? "rgba(26,255,110,0.04)" : "var(--surface-2)",
              border: `2px dashed ${file ? "var(--accent)" : "var(--border)"}`,
              color: file ? "var(--accent)" : "var(--text-3)",
              fontSize: "14px", cursor: "pointer", marginBottom: "14px",
              transition: "all var(--dur) var(--ease)",
            }}>
              {file ? `✓ ${file.name}` : "Seleccionar archivo .xlsx"}
            </button>

            {error && (
              <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)",
                background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.2)",
                color: "var(--danger)", fontSize: "13px", marginBottom: "12px" }}>
                {error}
              </div>
            )}

            <button
              onClick={() => importMutation.mutate()}
              disabled={!file || importMutation.isPending}
              className="btn btn-accent"
              style={{ justifyContent: "center", fontSize: "14px", padding: "12px 24px",
                opacity: (!file || importMutation.isPending) ? 0.5 : 1 }}>
              {importMutation.isPending ? "⏳ Importando..." : "🚀 Importar productos"}
            </button>
          </div>
        </div>
      </div>

      {/* Resultado */}
      {result && (
        <div style={{ background: "var(--surface)",
          border: "1px solid rgba(26,255,110,0.2)",
          borderRadius: "var(--r-2xl)", padding: "24px",
          animation: "scaleIn 300ms var(--ease)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px",
            marginBottom: "16px" }}>
            <span style={{ fontSize: "28px" }}>✅</span>
            <div>
              <p style={{ fontSize: "15px", fontWeight: 500, color: "var(--accent)" }}>
                Importación completada
              </p>
              <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
                {result.created} creados · {result.updated} actualizados
                {result.errors > 0 && ` · ${result.errors} errores`}
              </p>
            </div>
          </div>

          {result.error_list?.length > 0 && (
            <div style={{ padding: "12px 14px", borderRadius: "var(--r-lg)",
              background: "rgba(255,77,77,0.06)", border: "1px solid rgba(255,77,77,0.2)" }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "#f87171",
                marginBottom: "8px" }}>
                Filas con errores:
              </p>
              {result.error_list.map((err, i) => (
                <p key={i} style={{ fontSize: "12px", color: "var(--text-2)",
                  marginBottom: "4px" }}>
                  Fila {err.row}: {err.message}
                </p>
              ))}
            </div>
          )}

          <button onClick={() => setResult(null)} className="btn btn-ghost"
            style={{ marginTop: "14px", fontSize: "13px", padding: "8px 16px" }}>
            Importar más productos
          </button>
        </div>
      )}
    </div>
  )
}