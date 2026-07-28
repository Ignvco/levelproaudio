// pages/dashboard/MyDocuments.jsx — Documentos tributarios del cliente
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { getMyDocuments, downloadMyDocument } from "../../api/billing.api"
import { showToast } from "../../components/ui/ToastNotification"

const ESTADO_STYLE = {
  emitido: { color:"var(--accent)", bg:"rgba(26,255,110,0.1)" },
  enviado: { color:"#60a5fa",       bg:"rgba(96,165,250,0.1)" },
  anulado: { color:"#ef4444",       bg:"rgba(239,68,68,0.1)"   },
}

function DocRow({ doc }) {
  const handleDownload = async () => {
    try {
      const { data } = await downloadMyDocument(doc.id)
      const url  = window.URL.createObjectURL(new Blob([data], { type:"application/pdf" }))
      const a    = document.createElement("a")
      a.href = url; a.setAttribute("download", `${doc.folio}.pdf`)
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      showToast("No se pudo descargar el documento")
    }
  }

  const est = ESTADO_STYLE[doc.estado] || ESTADO_STYLE.emitido

  return (
    <div data-testid={`doc-row-${doc.id}`} style={{
      padding:"16px 20px",
      background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:"var(--r-lg)",
      display:"flex", justifyContent:"space-between", alignItems:"center",
      gap:"14px",
    }}>
      <div style={{ minWidth:0, flex:1 }}>
        <div style={{ display:"flex", gap:"10px", alignItems:"center",
          marginBottom:"4px", flexWrap:"wrap" }}>
          <p style={{ fontSize:"14px", fontWeight:500,
            fontFamily:"monospace", color:"var(--text)" }}>
            {doc.folio}
          </p>
          <span style={{
            fontSize:"10px", padding:"3px 9px",
            borderRadius:"var(--r-full)",
            background: est.bg, color: est.color,
            fontWeight:600, letterSpacing:"0.06em",
            textTransform:"uppercase",
          }}>
            {doc.estado_label}
          </span>
        </div>
        <p style={{ fontSize:"12px", color:"var(--text-3)" }}>
          {doc.tipo_label} · Orden #{doc.orden_short} · {doc.fecha}
        </p>
      </div>
      <div style={{ textAlign:"right" }}>
        <p style={{ fontSize:"15px", fontWeight:600, color:"var(--text)",
          fontVariantNumeric:"tabular-nums", marginBottom:"6px" }}>
          ${Number(doc.total).toLocaleString("es-CL")}
        </p>
        {doc.tiene_pdf && (
          <button onClick={handleDownload} data-testid={`btn-download-${doc.id}`}
            style={{
              padding:"6px 14px", fontSize:"12px",
              background:"var(--accent)", color:"#000",
              border:"none", borderRadius:"var(--r-full)",
              cursor:"pointer", fontWeight:600,
            }}>
            Descargar PDF
          </button>
        )}
      </div>
    </div>
  )
}

export default function MyDocuments() {
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["my-documents"],
    queryFn:  getMyDocuments,
  })

  return (
    <div style={{ padding:"clamp(32px, 5vw, 56px)", maxWidth:"820px" }}>
      <div style={{ marginBottom:"32px" }}>
        <p style={{ fontSize:"12px", color:"var(--accent)",
          fontWeight:600, letterSpacing:"0.08em",
          textTransform:"uppercase", marginBottom:"8px" }}>
          Facturación
        </p>
        <h1 style={{ fontFamily:"var(--font-serif)",
          fontSize:"clamp(2rem, 4vw, 3rem)", fontWeight:300,
          letterSpacing:"-0.02em" }}>
          Mis documentos
        </h1>
        <p style={{ fontSize:"14px", color:"var(--text-3)", marginTop:"6px" }}>
          Descargá las boletas y facturas de tus compras.
        </p>
      </div>

      {isLoading && <p style={{ color:"var(--text-3)" }}>Cargando…</p>}

      {!isLoading && docs.length === 0 && (
        <div style={{
          padding:"40px 32px", background:"var(--surface)",
          border:"1px solid var(--border)", borderRadius:"var(--r-2xl)",
          textAlign:"center",
        }}>
          <p style={{ fontSize:"46px", marginBottom:"12px" }}>📄</p>
          <p style={{ fontSize:"15px", color:"var(--text-2)",
            marginBottom:"6px" }}>
            Todavía no tenés documentos emitidos.
          </p>
          <p style={{ fontSize:"13px", color:"var(--text-3)",
            marginBottom:"20px" }}>
            Cuando confirmemos el pago de tu próxima compra, la boleta
            aparecerá acá para descargar.
          </p>
          <Link to="/shop" className="btn btn-accent"
            style={{ padding:"11px 22px", fontSize:"13px" }}>
            Ir a la tienda →
          </Link>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
        {docs.map(d => <DocRow key={d.id} doc={d} />)}
      </div>
    </div>
  )
}
