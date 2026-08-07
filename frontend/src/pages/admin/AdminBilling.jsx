// pages/admin/AdminBilling.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getBillingDocuments, getBillingConfig, updateBillingConfig,
  generateDocument, downloadDocument, voidDocument,
} from "../../api/admin.api"
import { AdminPageHeader, DataTable, StatusBadge } from "../../components/admin/ui"
import { showToast } from "../../components/ui/ToastNotification"
import { Download, Ban, FileText } from "lucide-react"

const TABS   = ["Documentos","Generar","Configuración"]

const inputSt = {
  width:"100%", padding:"10px 14px",
  background:"var(--surface-2)", border:"1px solid var(--border)",
  borderRadius:"var(--r-md)", color:"var(--text)", fontSize:"13px", outline:"none",
}

export default function AdminBilling() {
  const [tab, setTab]         = useState(0)
  const queryClient           = useQueryClient()

  /* ── Documentos ── */
  const { data:docsData, isLoading:loadingDocs } = useQuery({
    queryKey:["billing-documents"], queryFn:getBillingDocuments,
  })
  const docs = docsData?.results || docsData || []

  /* ── Generar ── */
  const [genForm, setGenForm]     = useState({ order_id:"", tipo:"boleta", notas:"" })
  const [genResult, setGenResult] = useState(null)
  const [genError, setGenError]   = useState("")

  const genMutation = useMutation({
    mutationFn: () => generateDocument({
      order_id: genForm.order_id.trim(),
      tipo:     genForm.tipo,
      ...(genForm.notas && { notas:genForm.notas }),
    }),
    onSuccess: (data) => { setGenResult(data); setGenError("") },
    onError:   (e)    => setGenError(
      e?.response?.data?.error || e?.response?.data?.detail || "Error al generar."
    ),
  })

  const handleDownload = async (id, folio) => {
    const resp = await downloadDocument(id)
    const url  = window.URL.createObjectURL(new Blob([resp.data]))
    const a    = document.createElement("a")
    a.href = url; a.setAttribute("download", `${folio}.pdf`)
    document.body.appendChild(a); a.click(); a.remove()
  }

  /* ── Config ── */
  const { data:config } = useQuery({
    queryKey:["billing-config"], queryFn:getBillingConfig, enabled: tab===2,
  })
  const [cfgForm, setCfgForm]     = useState(null)
  const [savingCfg, setSavingCfg] = useState(false)
  const [cfgOk, setCfgOk]         = useState(false)

  const saveConfig = async () => {
    if (!cfgForm) return
    setSavingCfg(true)
    try {
      await updateBillingConfig(cfgForm)
      queryClient.invalidateQueries(["billing-config"])
      setCfgOk(true); setTimeout(() => setCfgOk(false), 3000)
    } finally { setSavingCfg(false) }
  }

  const voidMutation = useMutation({
    mutationFn: voidDocument,
    onSuccess:  () => queryClient.invalidateQueries(["billing-documents"]),
    onError:    (e) => showToast(e?.response?.data?.detail || "No se pudo anular el documento. Verificá antes de asumir que se anuló.", "error"),
  })

  /* ── UUID validation ── */
  const uuidOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    genForm.order_id.trim()
  )

  return (
    <div className="au-page" style={{ padding:"clamp(24px, 4vw, 40px)" }}>

      <AdminPageHeader eyebrow="Ventas" title="Facturación"
        description="Genera boletas y facturas PDF · Envío por email · Historial completo" />

      {/* Tabs */}
      <div style={{ display:"flex", gap:"0", marginBottom:"28px", borderBottom:"1px solid var(--border)",
        overflowX:"auto", WebkitOverflowScrolling:"touch" }} className="hide-scroll">
        {TABS.map((t,i) => (
          <button key={t} type="button" onClick={() => setTab(i)} style={{
            padding:"9px 20px", fontSize:"13px", cursor:"pointer",
            background:"none", border:"none",
            borderBottom: tab===i ? "2px solid var(--accent)" : "2px solid transparent",
            color:        tab===i ? "var(--accent)"             : "var(--text-3)",
            fontWeight:   tab===i ? 500                         : 400,
            marginBottom:"-1px" }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── DOCUMENTOS ── */}
      {tab===0 && (
        <DataTable
          columns={[
            { key:"folio", header:"Folio", sortable:true, render:doc => (
              <span style={{ fontFamily:"monospace", fontWeight:700,
                color:"var(--admin-primary-text)" }}>{doc.folio}</span>
            )},
            { key:"tipo", header:"Tipo", render:doc => (
              <StatusBadge tone={doc.tipo==="boleta" ? "info" : "neutral"}>
                {doc.tipo==="boleta" ? "Boleta" : "Factura"}
              </StatusBadge>
            )},
            { key:"order_id", header:"Orden", render:doc => (
              <span style={{ fontFamily:"monospace", fontSize:"12px", color:"var(--admin-text-muted)" }}>
                #{doc.order_id?.slice(0,8).toUpperCase()}
              </span>
            )},
            { key:"total", header:"Total", sortable:true, align:"right", render:doc => (
              <span style={{ fontWeight:700 }}>${Number(doc.total).toLocaleString("es-CL")}</span>
            )},
            { key:"estado", header:"Estado", render:doc => (
              <StatusBadge tone={doc.estado==="emitido" ? "success" : "danger"}>
                {doc.estado==="emitido" ? "Emitido" : "Anulado"}
              </StatusBadge>
            )},
          ]}
          data={docs} loading={loadingDocs}
          getRowId={doc => doc.id}
          searchable searchKeys={["folio","order_id"]} searchPlaceholder="Buscar por folio u orden..."
          rowActions={doc => [
            { label:"Descargar PDF", icon:Download, onClick:() => handleDownload(doc.id, doc.folio) },
            ...(doc.estado==="emitido" ? [{
              label:"Anular", icon:Ban, danger:true, onClick:() => {
                if (window.confirm(`¿Anular ${doc.folio}?`)) voidMutation.mutate(doc.id)
              },
            }] : []),
          ]}
          emptyIcon={FileText} emptyTitle="Sin documentos emitidos"
          emptyDesc="Ve a &quot;Generar&quot; para emitir boletas o facturas."
          testId="billing-documents-table" />
      )}

      {/* ── GENERAR ── */}
      {tab===1 && (
        <div style={{ maxWidth:"520px" }}>
          {genResult ? (
            <div style={{ background:"var(--surface)", border:"1px solid rgba(26,255,110,0.2)",
              borderRadius:"var(--r-2xl)", padding:"48px",
              textAlign:"center", animation:"scaleIn 300ms var(--ease)" }}>
              <div style={{ width:"72px", height:"72px", borderRadius:"50%",
                background:"rgba(26,255,110,0.1)", border:"2px solid rgba(26,255,110,0.3)",
                display:"flex", alignItems:"center", justifyContent:"center",
                margin:"0 auto 20px", fontSize:"32px", color:"var(--accent-text)" }}>✓</div>
              <h2 style={{ fontFamily:"var(--font-display)", fontSize:"1.8rem",
                fontWeight:800, marginBottom:"6px" }}>Documento generado</h2>
              <p style={{ fontFamily:"monospace", fontSize:"1.6rem",
                color:"var(--accent-text)", fontWeight:700, marginBottom:"6px" }}>
                {genResult.folio}
              </p>
              <p style={{ fontSize:"14px", color:"var(--text-2)", marginBottom:"28px" }}>
                Total: ${Number(genResult.total).toLocaleString("es-CL")}
              </p>
              <div style={{ display:"flex", gap:"10px", justifyContent:"center" }}>
                <button onClick={() => handleDownload(genResult.id, genResult.folio)}
                  className="btn btn-accent" style={{ padding:"11px 24px", fontSize:"14px" }}>
                  ⬇️ Descargar PDF
                </button>
                <button onClick={() => { setGenResult(null); setGenForm({ order_id:"", tipo:"boleta", notas:"" }) }}
                  className="btn btn-ghost" style={{ padding:"11px 24px", fontSize:"14px" }}>
                  Generar otro
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
              borderRadius:"var(--r-2xl)", overflow:"hidden" }}>
              <div style={{ padding:"16px 24px", borderBottom:"1px solid var(--border)",
                background:"var(--surface-2)" }}>
                <p style={{ fontSize:"14px", fontWeight:500 }}>Emitir documento tributario</p>
                <p style={{ fontSize:"12px", color:"var(--text-3)", marginTop:"3px" }}>
                  Copiá el UUID completo desde la sección Órdenes
                </p>
              </div>
              <div style={{ padding:"24px", display:"flex", flexDirection:"column", gap:"16px" }}>
                {genError && (
                  <div style={{ padding:"10px 14px", borderRadius:"var(--r-md)",
                    background:"rgba(255,77,77,0.08)", border:"1px solid rgba(255,77,77,0.2)",
                    color:"var(--danger)", fontSize:"13px" }}>{genError}</div>
                )}

                <div>
                  <label style={{ display:"block", fontSize:"12px", fontWeight:500,
                    color:"var(--text-2)", marginBottom:"7px" }}>
                    ID de Orden (UUID) *
                  </label>
                  <input value={genForm.order_id}
                    onChange={e => setGenForm(p => ({ ...p, order_id:e.target.value }))}
                    style={inputSt} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    onFocus={e => e.target.style.borderColor="rgba(26,255,110,0.4)"}
                    onBlur={e => e.target.style.borderColor="var(--border)"} />
                  {genForm.order_id && !uuidOk && (
                    <p style={{ fontSize:"11px", color:"#D97706", marginTop:"4px" }}>
                      ⚠️ Formato UUID incorrecto — debe ser completo (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
                    </p>
                  )}
                  {genForm.order_id && uuidOk && (
                    <p style={{ fontSize:"11px", color:"var(--accent-text)", marginTop:"4px" }}>
                      ✓ UUID válido
                    </p>
                  )}
                </div>

                <div>
                  <label style={{ display:"block", fontSize:"12px", fontWeight:500,
                    color:"var(--text-2)", marginBottom:"10px" }}>
                    Tipo de documento
                  </label>
                  <div style={{ display:"grid",
                    gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))",
                    gap:"10px" }}>
                    {[
                      { id:"boleta",     label:"🇨🇱 Boleta",      desc:"Consumidor final (CL)" },
                      { id:"factura",    label:"🇨🇱 Factura",     desc:"Empresa con RUT (CL)" },
                      { id:"factura_a",  label:"🇦🇷 Factura A",   desc:"Resp. Inscripto (AR)" },
                      { id:"factura_b",  label:"🇦🇷 Factura B",   desc:"Consumidor final (AR)" },
                      { id:"factura_c",  label:"🇦🇷 Factura C",   desc:"Monotributista (AR)" },
                    ].map(({ id, label, desc }) => (
                      <button key={id} type="button"
                        data-testid={`tipo-${id}`}
                        onClick={() => setGenForm(p => ({ ...p, tipo:id }))}
                        style={{ padding:"14px", borderRadius:"var(--r-xl)", textAlign:"left",
                          cursor:"pointer",
                          background: genForm.tipo===id ? "rgba(26,255,110,0.05)" : "var(--surface-2)",
                          border:     `1px solid ${genForm.tipo===id ? "rgba(26,255,110,0.3)" : "var(--border)"}`,
                          transition:"all var(--dur) var(--ease)" }}>
                        <p style={{ fontSize:"13px", fontWeight:500, marginBottom:"4px" }}>{label}</p>
                        <p style={{ fontSize:"11px", color:"var(--text-3)" }}>{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display:"block", fontSize:"12px", fontWeight:500,
                    color:"var(--text-2)", marginBottom:"7px" }}>Notas (opcional)</label>
                  <textarea value={genForm.notas} rows={2}
                    onChange={e => setGenForm(p => ({ ...p, notas:e.target.value }))}
                    style={{ ...inputSt, resize:"none" }}
                    placeholder="Ej: Pago con transferencia..."
                    onFocus={e => e.target.style.borderColor="rgba(26,255,110,0.4)"}
                    onBlur={e => e.target.style.borderColor="var(--border)"} />
                </div>

                <button onClick={() => genMutation.mutate()}
                  disabled={genMutation.isPending || !genForm.order_id || !uuidOk}
                  className="btn btn-accent"
                  style={{ justifyContent:"center", fontSize:"14px", padding:"13px",
                    opacity: (genMutation.isPending||!genForm.order_id||!uuidOk) ? 0.6 : 1 }}>
                  {genMutation.isPending ? "Generando PDF..." : "🧾 Generar documento"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CONFIGURACIÓN ── */}
      {tab===2 && (
        !config ? (
          <div style={{ display:"flex", flexDirection:"column", gap:"12px", maxWidth:"520px" }}>
            {[...Array(4)].map((_,i) => <div key={i} className="skeleton" style={{ height:"60px" }} />)}
          </div>
        ) : (
          <div style={{ maxWidth:"520px" }}>
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
              borderRadius:"var(--r-2xl)", overflow:"hidden" }}>
              <div style={{ padding:"16px 24px", borderBottom:"1px solid var(--border)",
                background:"var(--surface-2)" }}>
                <p style={{ fontSize:"14px", fontWeight:500 }}>Datos de la empresa emisora</p>
                <p style={{ fontSize:"12px", color:"var(--text-3)", marginTop:"3px" }}>
                  Aparecen en el encabezado de todas las boletas y facturas
                </p>
              </div>
              <div style={{ padding:"24px", display:"flex", flexDirection:"column", gap:"14px" }}>
                {cfgOk && (
                  <div style={{ padding:"10px 14px", borderRadius:"var(--r-md)",
                    background:"rgba(26,255,110,0.08)", border:"1px solid rgba(26,255,110,0.2)",
                    color:"var(--accent-text)", fontSize:"13px" }}>
                    ✓ Configuración guardada correctamente
                  </div>
                )}

                {/* País */}
                <div>
                  <label style={{ display:"block", fontSize:"12px", fontWeight:500,
                    color:"var(--text-2)", marginBottom:"7px" }}>País emisor *</label>
                  <select data-testid="input-pais"
                    defaultValue={config.pais || "CL"}
                    onChange={e => setCfgForm(p => ({ ...(p||config), pais:e.target.value }))}
                    style={inputSt}>
                    <option value="CL">🇨🇱 Chile — Boletas / Facturas</option>
                    <option value="AR">🇦🇷 Argentina — Facturas A / B / C</option>
                  </select>
                </div>

                {/* Tipo default + IVA */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                  <div>
                    <label style={{ display:"block", fontSize:"12px", fontWeight:500,
                      color:"var(--text-2)", marginBottom:"7px" }}>Documento por defecto</label>
                    <select data-testid="input-tipo-default"
                      defaultValue={config.tipo_default || "boleta"}
                      onChange={e => setCfgForm(p => ({ ...(p||config), tipo_default:e.target.value }))}
                      style={inputSt}>
                      <option value="boleta">Boleta (CL)</option>
                      <option value="factura">Factura (CL)</option>
                      <option value="factura_a">Factura A (AR)</option>
                      <option value="factura_b">Factura B (AR)</option>
                      <option value="factura_c">Factura C (AR)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display:"block", fontSize:"12px", fontWeight:500,
                      color:"var(--text-2)", marginBottom:"7px" }}>IVA %</label>
                    <input type="number" step="0.01" defaultValue={config.iva_porcentaje}
                      onChange={e => setCfgForm(p => ({ ...(p||config), iva_porcentaje:parseFloat(e.target.value) }))}
                      style={inputSt} />
                  </div>
                </div>

                {/* Auto-generar */}
                <label style={{ display:"flex", alignItems:"center", gap:"10px",
                  padding:"12px 14px", background:"var(--surface-2)",
                  border:"1px solid var(--border)", borderRadius:"var(--r-md)",
                  cursor:"pointer" }}>
                  <input type="checkbox" data-testid="input-auto-generar"
                    defaultChecked={config.auto_generar_al_pagar}
                    onChange={e => setCfgForm(p => ({ ...(p||config), auto_generar_al_pagar:e.target.checked }))} />
                  <div>
                    <p style={{ fontSize:"13px", fontWeight:500 }}>
                      Emitir documento automáticamente al confirmar el pago
                    </p>
                    <p style={{ fontSize:"11px", color:"var(--text-3)", marginTop:"2px" }}>
                      Se crea la boleta/factura elegida arriba en cuanto la orden pasa a Pagada.
                    </p>
                  </div>
                </label>

                {[
                  { key:"razon_social", label:"Razón social *",   placeholder:"LevelPro Audio SpA" },
                  { key:"rut",          label:"RUT / CUIT *",     placeholder:"12.345.678-9  ó  30-71234567-9" },
                  { key:"giro",         label:"Giro comercial",   placeholder:"Venta de equipos de audio" },
                  { key:"direccion",    label:"Dirección",        placeholder:"Av. Providencia 1234, Santiago" },
                  { key:"telefono",     label:"Teléfono",         placeholder:"+56 9 1234 5678" },
                  { key:"email",        label:"Email de contacto",placeholder:"ventas@levelproaudio.com" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label style={{ display:"block", fontSize:"12px", fontWeight:500,
                      color:"var(--text-2)", marginBottom:"7px" }}>{label}</label>
                    <input defaultValue={config[key]||""}
                      onChange={e => setCfgForm(p => ({ ...(p||config), [key]:e.target.value }))}
                      style={inputSt} placeholder={placeholder}
                      onFocus={e => e.target.style.borderColor="rgba(26,255,110,0.4)"}
                      onBlur={e => e.target.style.borderColor="var(--border)"} />
                  </div>
                ))}

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                  <div>
                    <label style={{ display:"block", fontSize:"12px", fontWeight:500,
                      color:"var(--text-2)", marginBottom:"7px" }}>Próximo N° boleta</label>
                    <input type="number" value={(config.ultimo_numero_boleta||0)+1}
                      style={{ ...inputSt, opacity:0.5, cursor:"not-allowed" }} disabled />
                  </div>
                  <div>
                    <label style={{ display:"block", fontSize:"12px", fontWeight:500,
                      color:"var(--text-2)", marginBottom:"7px" }}>Próximo N° factura</label>
                    <input type="number" value={(config.ultimo_numero_factura||0)+1}
                      style={{ ...inputSt, opacity:0.5, cursor:"not-allowed" }} disabled />
                  </div>
                </div>

                <button onClick={saveConfig} disabled={savingCfg || !cfgForm}
                  className="btn btn-accent"
                  style={{ justifyContent:"center", marginTop:"4px",
                    opacity: (savingCfg||!cfgForm) ? 0.6 : 1 }}>
                  {savingCfg ? "Guardando..." : "Guardar configuración"}
                </button>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  )
}
