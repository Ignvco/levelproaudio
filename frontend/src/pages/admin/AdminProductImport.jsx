// pages/admin/AdminProductImport.jsx

import { useState, useRef } from "react"
import { useMutation } from "@tanstack/react-query"
import { importProducts, downloadTemplate } from "../../api/admin.api"

function ResultRow({ icon, label, items, color }) {
  if (!items?.length) return null
  return (
    <div style={{
      background: "var(--surface-2)", border: `1px solid ${color}30`,
      borderRadius: "var(--r-md)", padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
        <span style={{ fontSize: "16px" }}>{icon}</span>
        <span style={{ fontSize: "13px", fontWeight: 500, color }}>
          {label} ({items.length})
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {items.map((item, i) => (
          <span key={i} style={{
            fontSize: "11px", padding: "2px 8px", borderRadius: "100px",
            background: `${color}10`, border: `1px solid ${color}25`,
            color: "var(--text-2)",
          }}>
            {typeof item === "string" ? item : `Fila ${item.row}: ${item.error}`}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function AdminProductImport() {
  const [dragOver, setDragOver]   = useState(false)
  const [file, setFile]           = useState(null)
  const [result, setResult]       = useState(null)
  const inputRef                  = useRef()

  const mutation = useMutation({
    mutationFn: (f) => {
      const fd = new FormData()
      fd.append("file", f)
      return importProducts(fd)
    },
    onSuccess: (data) => setResult(data),
    onError:   (err)  => setResult({ error: err.response?.data?.error || "Error al procesar." }),
  })

  const handleFile = (f) => {
    if (!f) return
    const valid = ["xlsx", "xls", "csv"]
    const ext   = f.name.split(".").pop().toLowerCase()
    if (!valid.includes(ext)) {
      setResult({ error: "Formato no válido. Sube un archivo .xlsx o .csv" })
      return
    }
    setFile(f)
    setResult(null)
    mutation.mutate(f)
  }

  const handleDownloadTemplate = async () => {
    const blob = await downloadTemplate()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href     = url
    a.download = "plantilla_productos_levelproaudio.xlsx"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)", maxWidth: "800px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "32px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px" }}>
            Importar productos
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            Carga tu inventario completo desde Excel o CSV.
          </p>
        </div>
        <button onClick={handleDownloadTemplate}
          className="btn btn-ghost" style={{ fontSize: "13px", gap: "8px" }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Descargar plantilla
        </button>
      </div>

      {/* Instrucciones rápidas */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)", padding: "20px 24px", marginBottom: "24px",
      }}>
        <p style={{ fontSize: "13px", fontWeight: 500, marginBottom: "14px" }}>
          ¿Cómo funciona?
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { n: "1", title: "Descarga la plantilla", desc: "Tiene todas las columnas con ejemplos y una hoja de instrucciones." },
            { n: "2", title: "Completa tu inventario", desc: "Nombre, precio y stock son obligatorios. El resto es opcional." },
            { n: "3", title: "Sube el archivo", desc: "Arrastra o selecciona el archivo. Los productos se crean o actualizan." },
          ].map(({ n, title, desc }) => (
            <div key={n} style={{ display: "flex", gap: "12px" }}>
              <div style={{
                width: "24px", height: "24px", borderRadius: "50%",
                background: "var(--accent-glow)", border: "1px solid rgba(26,255,110,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "11px", fontWeight: 600, color: "var(--accent)", flexShrink: 0,
              }}>
                {n}
              </div>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 500, marginBottom: "3px" }}>{title}</p>
                <p style={{ fontSize: "12px", color: "var(--text-3)", lineHeight: 1.5 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFile(e.dataTransfer.files[0])
        }}
        style={{
          border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
          borderRadius: "var(--r-xl)",
          padding: "56px 32px",
          textAlign: "center",
          cursor: "pointer",
          transition: "all var(--dur) var(--ease)",
          background: dragOver ? "var(--accent-glow)" : "var(--surface)",
          marginBottom: "24px",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files[0])}
        />

        {mutation.isPending ? (
          <div>
            <div style={{
              width: "40px", height: "40px", borderRadius: "50%",
              border: "3px solid var(--border)",
              borderTop: "3px solid var(--accent)",
              margin: "0 auto 16px",
              animation: "spin 0.8s linear infinite",
            }} />
            <p style={{ fontSize: "14px", color: "var(--text-2)" }}>
              Procesando {file?.name}...
            </p>
          </div>
        ) : (
          <>
            <div style={{ fontSize: "40px", marginBottom: "16px" }}>
              {dragOver ? "📂" : "📊"}
            </div>
            <p style={{ fontSize: "15px", fontWeight: 500, marginBottom: "8px" }}>
              {file && !result?.error
                ? `✓ ${file.name}`
                : "Arrastra tu archivo aquí"}
            </p>
            <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
              o <span style={{ color: "var(--accent)" }}>haz clic para seleccionar</span>
              {" "}— .xlsx o .csv
            </p>
          </>
        )}
      </div>

      {/* Spin animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Resultados */}
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

          {/* Error global */}
          {result.error && (
            <div style={{
              padding: "16px 20px", borderRadius: "var(--r-md)",
              background: "rgba(255,59,59,0.08)",
              border: "1px solid rgba(255,59,59,0.2)",
              color: "var(--danger)", fontSize: "14px",
            }}>
              ✕ {result.error}
            </div>
          )}

          {/* Resumen */}
          {result.total_processed > 0 && (
            <div style={{
              padding: "16px 20px", borderRadius: "var(--r-md)",
              background: "var(--accent-glow)",
              border: "1px solid rgba(26,255,110,0.2)",
              display: "flex", alignItems: "center",
              justifyContent: "space-between", flexWrap: "wrap", gap: "8px",
            }}>
              <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--accent)" }}>
                ✓ {result.total_processed} productos procesados
              </span>
              <div style={{ display: "flex", gap: "16px", fontSize: "13px",
                color: "var(--text-2)" }}>
                <span>🆕 {result.created?.length || 0} creados</span>
                <span>✏️ {result.updated?.length || 0} actualizados</span>
                {result.errors?.length > 0 && (
                  <span style={{ color: "#facc15" }}>
                    ⚠️ {result.errors.length} errores
                  </span>
                )}
              </div>
            </div>
          )}

          <ResultRow
            icon="🆕" label="Productos creados"
            items={result.created} color="#4ade80"
          />
          <ResultRow
            icon="✏️" label="Productos actualizados"
            items={result.updated} color="#60a5fa"
          />
          <ResultRow
            icon="⚠️" label="Errores"
            items={result.errors?.map(e => ({ row: e.row, error: e.error }))}
            color="#f87171"
          />

          {/* Volver a subir */}
          {result.total_processed > 0 && (
            <button
              onClick={() => { setFile(null); setResult(null) }}
              className="btn btn-ghost"
              style={{ alignSelf: "flex-start", marginTop: "8px" }}>
              Subir otro archivo
            </button>
          )}
        </div>
      )}
    </div>
  )
}