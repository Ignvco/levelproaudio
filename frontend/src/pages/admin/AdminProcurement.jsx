import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CheckCircle2,
  ClipboardCheck,
  FileText,
  PackageCheck,
  Plus,
  Send,
  Upload,
} from "lucide-react"
import {
  AdminPageHeader,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
  StatCard,
  StatusBadge,
  FormModal,
  formInputStyle,
} from "../../components/admin/ui"
import { getAdminSuppliers } from "../../api/suppliers.api"
import { getWarehouses } from "../../api/wms.api"
import api from "../../api/client"
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  closePurchaseOrder,
  confirmGoodsReceipt,
  createGoodsReceipt,
  createPurchaseOrder,
  getCustomsDocumentDownloadUrl,
  getPurchaseOrder,
  getPurchaseOrderPdfUrl,
  issuePurchaseOrder,
  listGoodsReceipts,
  listPurchaseOrders,
  uploadCustomsDocument,
} from "../../api/procurement.api"

const PO_STATUS_MAP = {
  draft: { label: "Borrador", tone: "neutral" },
  approved: { label: "Aprobada", tone: "info" },
  issued: { label: "Emitida", tone: "warning" },
  partially_received: { label: "Recibida parcial", tone: "warning" },
  received: { label: "Recibida completa", tone: "success" },
  closed: { label: "Cerrada", tone: "neutral" },
  cancelled: { label: "Cancelada", tone: "danger" },
}

const inputStyle = formInputStyle

const labelStyle = {
  display: "block",
  fontSize: "12px",
  fontWeight: 700,
  color: "var(--admin-text)",
  marginBottom: "4px",
}

export default function AdminProcurement() {
  const [searchParams] = useSearchParams()
  const initialSupplier = searchParams.get("supplier") || ""
  const initialTab = searchParams.get("tab") || "orders"

  const [tab, setTab] = useState(initialTab)
  const [statusFilter, setStatusFilter] = useState("")
  const [supplierFilter] = useState(initialSupplier)
  const [search, setSearch] = useState("")
  const [selectedPoId, setSelectedPoId] = useState(null)
  const [showCreatePo, setShowCreatePo] = useState(false)
  const [showCreateGr, setShowCreateGr] = useState(false)
  const [banner, setBanner] = useState(null)

  const qc = useQueryClient()

  const { data: poListData, isLoading: loadingPos } = useQuery({
    queryKey: ["procurement-pos", statusFilter, supplierFilter, search],
    queryFn: () =>
      listPurchaseOrders({
        status: statusFilter || undefined,
        supplier: supplierFilter || undefined,
        search: search || undefined,
      }),
  })
  const pos = useMemo(() => poListData?.results || [], [poListData])

  const { data: grListData, isLoading: loadingGrs } = useQuery({
    queryKey: ["procurement-grs"],
    queryFn: () => listGoodsReceipts(),
  })
  const grs = grListData?.results || []

  const { data: poDetail } = useQuery({
    queryKey: ["procurement-po-detail", selectedPoId],
    queryFn: () => getPurchaseOrder(selectedPoId),
    enabled: Boolean(selectedPoId),
  })

  const { data: suppliersData } = useQuery({
    queryKey: ["suppliers-for-po"],
    queryFn: () => getAdminSuppliers({ is_active: true }),
  })
  const suppliers = suppliersData?.results || []

  const { data: whData } = useQuery({
    queryKey: ["wms-warehouses-for-po"],
    queryFn: () => getWarehouses(),
  })
  const warehouses = whData?.results || []

  const { data: productsData } = useQuery({
    queryKey: ["products-for-po"],
    queryFn: async () => (await api.get("/admin/products/?page_size=100")).data,
  })
  const products = productsData?.results || []

  useEffect(() => {
    if (!selectedPoId && pos.length > 0) {
      setSelectedPoId(pos[0].id)
    }
  }, [pos, selectedPoId])

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["procurement-pos"] })
    qc.invalidateQueries({ queryKey: ["procurement-grs"] })
    if (selectedPoId) qc.invalidateQueries({ queryKey: ["procurement-po-detail", selectedPoId] })
  }

  const actionMut = useMutation({
    mutationFn: async ({ type, id, reason }) => {
      if (type === "approve") return approvePurchaseOrder(id)
      if (type === "issue") return issuePurchaseOrder(id)
      if (type === "cancel") return cancelPurchaseOrder(id, reason || "")
      if (type === "close") return closePurchaseOrder(id, reason || "")
      if (type === "confirm-gr") return confirmGoodsReceipt(id, `ui-confirm-${id}`)
      return null
    },
    onSuccess: () => {
      setBanner({ type: "success", text: "Operación registrada correctamente." })
      refreshAll()
    },
    onError: (err) => {
      setBanner({ type: "error", text: err?.response?.data?.error || err.message || "Error en operación." })
    },
  })

  // Create PO form state
  const [poForm, setPoForm] = useState({
    supplier_id: "",
    destination_warehouse_id: "",
    currency: "USD",
    incoterm_snapshot: "FOB",
    payment_terms_snapshot: "",
    external_notes: "",
    product_id: "",
    quantity_ordered: "10",
    unit_cost: "100",
  })

  const handleCreatePo = async (e) => {
    e.preventDefault()
    try {
      const created = await createPurchaseOrder({
        supplier_id: poForm.supplier_id,
        destination_warehouse_id: poForm.destination_warehouse_id || undefined,
        currency: poForm.currency,
        incoterm_snapshot: poForm.incoterm_snapshot,
        payment_terms_snapshot: poForm.payment_terms_snapshot || undefined,
        external_notes: poForm.external_notes,
        items: [
          {
            product_id: poForm.product_id,
            quantity_ordered: Number(poForm.quantity_ordered),
            unit_cost: poForm.unit_cost,
          },
        ],
      })
      setShowCreatePo(false)
      setSelectedPoId(created.id)
      setBanner({ type: "success", text: `Orden ${created.po_number} creada en borrador.` })
      refreshAll()
    } catch (err) {
      setBanner({ type: "error", text: err?.response?.data?.error || "Error al crear PO." })
    }
  }

  // Create GoodsReceipt form state
  const [grForm, setGrForm] = useState({
    purchase_order_id: "",
    warehouse_id: "",
    delivery_note_number: "",
    discrepancy_notes: "",
    confirm: true,
    items: [],
  })

  const openReceiptModal = async (poObj = null) => {
    const targetPo = poObj || poDetail || pos.find(p => ["issued", "partially_received"].includes(p.status))
    if (!targetPo) {
      setBanner({ type: "error", text: "No hay órdenes emitidas o parciales disponibles para recepcionar." })
      return
    }
    const fullPo = targetPo.items ? targetPo : await getPurchaseOrder(targetPo.id)
    setGrForm({
      purchase_order_id: fullPo.id,
      warehouse_id: fullPo.destination_warehouse || (warehouses[0]?.id || ""),
      delivery_note_number: "",
      discrepancy_notes: "",
      confirm: true,
      items: (fullPo.items || [])
        .filter(i => i.quantity_pending > 0)
        .map(i => ({
          purchase_order_item_id: i.id,
          sku: i.internal_sku_snapshot,
          description: i.description_snapshot,
          pending: i.quantity_pending,
          serialization_mode: i.serialization_mode,
          quantity_accepted: String(i.quantity_pending),
          quantity_damaged: "0",
          quantity_rejected: "0",
          serials_raw: "",
          damaged_serials_raw: "",
          discrepancy_reason: "",
        })),
    })
    setShowCreateGr(true)
  }

  const handleCreateGr = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        purchase_order_id: grForm.purchase_order_id,
        warehouse_id: grForm.warehouse_id,
        delivery_note_number: grForm.delivery_note_number,
        discrepancy_notes: grForm.discrepancy_notes,
        confirm: grForm.confirm,
        items: grForm.items.map(it => ({
          purchase_order_item_id: it.purchase_order_item_id,
          quantity_accepted: Number(it.quantity_accepted || 0),
          quantity_damaged: Number(it.quantity_damaged || 0),
          quantity_rejected: Number(it.quantity_rejected || 0),
          serial_numbers: it.serials_raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean),
          damaged_serial_numbers: it.damaged_serials_raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean),
          discrepancy_reason: it.discrepancy_reason,
        })),
      }
      const created = await createGoodsReceipt(payload, `ui-gr-${Date.now()}`)
      setShowCreateGr(false)
      setTab("receipts")
      setBanner({
        type: "success",
        text: `Recepción ${created.receipt_number} ${created.status === "confirmed" ? "confirmada en WMS y Kardex" : "guardada como borrador"}.`,
      })
      refreshAll()
    } catch (err) {
      setBanner({ type: "error", text: err?.response?.data?.error || "Error al registrar recepción." })
    }
  }

  // Customs document upload state
  const [docForm, setDocForm] = useState({
    document_type: "bill_of_lading",
    document_identifier: "",
    file: null,
  })

  const handleUploadDoc = async (e) => {
    e.preventDefault()
    if (!poDetail || !docForm.file) return
    try {
      const fd = new FormData()
      fd.append("document_type", docForm.document_type)
      fd.append("document_identifier", docForm.document_identifier || "DOC-01")
      fd.append("file", docForm.file)
      await uploadCustomsDocument(poDetail.id, fd)
      setDocForm({ document_type: "bill_of_lading", document_identifier: "", file: null })
      setBanner({ type: "success", text: "Documento aduanero cargado." })
      refreshAll()
    } catch (err) {
      setBanner({ type: "error", text: err?.response?.data?.error || "Error al subir documento." })
    }
  }

  const issuedCount = pos.filter(p => p.status === "issued").length
  const partialCount = pos.filter(p => p.status === "partially_received").length
  const confirmedGrCount = grs.filter(g => g.status === "confirmed").length

  return (
    <div className="au-page">
      <AdminPageHeader
        eyebrow="GATE 5 / PROCUREMENT MANAGEMENT"
        title="Órdenes de Compra y Recepciones"
        description="Ciclo formal de adquisiciones (BF-03), recepciones físicas desacopladas en WMS/Kardex (BF-04) y repositorio aduanero (BF-42)."
        actions={
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <SecondaryButton onClick={() => openReceiptModal()} data-testid="btn-open-receipt-modal">
              <PackageCheck size={15} /> Registrar Recepción
            </SecondaryButton>
            <PrimaryButton onClick={() => setShowCreatePo(true)} data-testid="btn-open-create-po">
              <Plus size={15} /> Nueva Orden de Compra
            </PrimaryButton>
          </div>
        }
      />

      {banner && (
        <div
          style={{
            marginBottom: "14px",
            padding: "10px 14px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 600,
            background: banner.type === "error" ? "#FEF2F2" : "#ECFDF5",
            color: banner.type === "error" ? "#991B1B" : "#0F7A38",
            border: `1px solid ${banner.type === "error" ? "#FECACA" : "#A7F3D0"}`,
          }}
        >
          {banner.text}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "12px", marginBottom: "16px" }}>
        <StatCard label="Órdenes de Compra" value={pos.length} icon={<FileText size={16} />} />
        <StatCard label="Emitidas (Pendientes)" value={issuedCount} icon={<Send size={16} />} />
        <StatCard label="Parcialmente Recibidas" value={partialCount} icon={<ClipboardCheck size={16} />} />
        <StatCard label="Recepciones Confirmadas" value={confirmedGrCount} icon={<CheckCircle2 size={16} />} />
      </div>

      <div className="lp-seg-tabs" style={{ marginBottom: "16px" }}>
        <button type="button" className={`lp-seg-tab ${tab === "orders" ? "is-active" : ""}`} onClick={() => setTab("orders")}>
          Órdenes de Compra
        </button>
        <button type="button" className={`lp-seg-tab ${tab === "receipts" ? "is-active" : ""}`} onClick={() => setTab("receipts")}>
          Recepciones de Mercadería
        </button>
      </div>

      {tab === "orders" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1.1fr) minmax(360px, 1.3fr)", gap: "16px", alignItems: "start" }}>
          <SectionCard
            eyebrow="BF-03 / DIRECTORIO PO"
            title="Órdenes de Compra"
            action={
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <input
                  placeholder="Buscar OC o proveedor..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ ...inputStyle, width: "160px", padding: "6px 8px" }}
                />
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: "130px", padding: "6px 8px" }}>
                  <option value="">Todos estados</option>
                  {Object.entries(PO_STATUS_MAP).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            }
          >
            {loadingPos ? (
              <p style={{ fontSize: "13px", color: "var(--admin-text-muted)" }}>Cargando órdenes...</p>
            ) : pos.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--admin-text-muted)" }}>No existen órdenes de compra.</p>
            ) : (
              <div style={{ overflowX: "auto" }} data-testid="procurement-po-table">
                <table className="au-table">
                  <thead>
                    <tr>
                      <th>N° Orden</th>
                      <th>Proveedor</th>
                      <th>Estado</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pos.map(p => {
                      const st = PO_STATUS_MAP[p.status] || { label: p.status, tone: "neutral" }
                      const active = selectedPoId === p.id
                      return (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedPoId(p.id)}
                          style={{ cursor: "pointer", background: active ? "#F0FDF4" : undefined }}
                        >
                          <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-text)" }}>{p.po_number}</td>
                          <td style={{ color: "var(--admin-text)" }}>{p.supplier_name}</td>
                          <td><StatusBadge tone={st.tone}>{st.label}</StatusBadge></td>
                          <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>
                            {p.total_amount !== null ? `${p.total_amount} ${p.currency}` : "Restringido"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            eyebrow={poDetail ? `DETALLE / ${poDetail.po_number}` : "DETALLE"}
            title={poDetail ? `${poDetail.po_number} — ${poDetail.supplier_name}` : "Seleccione una orden"}
            action={
              poDetail && (
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {poDetail.status === "draft" && (
                    <SecondaryButton size="sm" onClick={() => actionMut.mutate({ type: "approve", id: poDetail.id })} data-testid="btn-approve-po">
                      Aprobar
                    </SecondaryButton>
                  )}
                  {poDetail.status === "approved" && (
                    <PrimaryButton size="sm" onClick={() => actionMut.mutate({ type: "issue", id: poDetail.id })} data-testid="btn-issue-po">
                      Emitir PO + PDF
                    </PrimaryButton>
                  )}
                  {["issued", "partially_received"].includes(poDetail.status) && (
                    <PrimaryButton size="sm" onClick={() => openReceiptModal(poDetail)} data-testid="btn-receive-po">
                      Recepcionar
                    </PrimaryButton>
                  )}
                  {poDetail.total_amount !== null && (
                    <a
                      href={getPurchaseOrderPdfUrl(poDetail.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="au-btn au-btn--secondary au-btn--sm"
                      style={{ textDecoration: "none" }}
                    >
                      PDF
                    </a>
                  )}
                </div>
              )
            }
          >
            {!poDetail ? (
              <p style={{ fontSize: "13px", color: "var(--admin-text-muted)" }}>Selecciona una orden del listado para ver líneas, recepciones y documentos.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px", fontSize: "12.5px", color: "var(--admin-text)" }}>
                  <div><strong>Bodega:</strong> {poDetail.warehouse_code || "Por definir"}</div>
                  <div><strong>Incoterm:</strong> {poDetail.incoterm_snapshot || "—"}</div>
                  <div><strong>Condición pago:</strong> {poDetail.payment_terms_snapshot || "—"}</div>
                  <div><strong>Revisión:</strong> v{poDetail.revision_number}</div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table className="au-table">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Descripción</th>
                        <th>Pedida</th>
                        <th>Recibida</th>
                        <th>Pendiente</th>
                        <th>Costo Unit.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(poDetail.items || []).map(it => (
                        <tr key={it.id}>
                          <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>{it.internal_sku_snapshot}</td>
                          <td style={{ color: "var(--admin-text)" }}>{it.description_snapshot}</td>
                          <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>{it.quantity_ordered}</td>
                          <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>{it.quantity_received}</td>
                          <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: it.quantity_pending > 0 ? "#D97706" : "#059669" }}>{it.quantity_pending}</td>
                          <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>
                            {it.unit_cost_snapshot !== null ? `${it.unit_cost_snapshot} ${it.currency}` : "Restringido"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* BF-42: Documentación Aduanera */}
                <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: "12px" }} data-testid="customs-docs-section">
                  <h4 style={{ fontSize: "13px", fontWeight: 800, color: "var(--admin-text)", marginBottom: "8px" }}>
                    Repositorio Documental Aduanero (BF-42)
                  </h4>
                  {(poDetail.customs_documents || []).length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
                      {poDetail.customs_documents.map(d => (
                        <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12.5px", padding: "6px 10px", background: "#F9FAFB", borderRadius: "8px", border: "1px solid var(--admin-border)" }}>
                          <span style={{ color: "var(--admin-text)" }}>
                            <strong>{d.document_type_display}</strong> · {d.document_identifier} (v{d.version}) — {d.filename}
                          </span>
                          <a href={getCustomsDocumentDownloadUrl(poDetail.id, d.id)} className="au-btn au-btn--secondary au-btn--sm" style={{ textDecoration: "none" }}>
                            Descargar
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                  <form onSubmit={handleUploadDoc} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "8px", alignItems: "end" }}>
                    <div>
                      <label style={labelStyle}>Tipo</label>
                      <select value={docForm.document_type} onChange={e => setDocForm(f => ({ ...f, document_type: e.target.value }))} style={inputStyle}>
                        <option value="commercial_invoice">Factura comercial</option>
                        <option value="bill_of_lading">Bill of Lading (BL)</option>
                        <option value="air_waybill">Air Waybill (AWB)</option>
                        <option value="customs_dus">Documento Aduanero / DUS</option>
                        <option value="packing_list">Packing List</option>
                        <option value="certificate">Certificado</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>N° Documento</label>
                      <input required value={docForm.document_identifier} onChange={e => setDocForm(f => ({ ...f, document_identifier: e.target.value }))} placeholder="BL-2026-01" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Archivo</label>
                      <input type="file" required onChange={e => setDocForm(f => ({ ...f, file: e.target.files?.[0] || null }))} style={{ fontSize: "12px" }} />
                    </div>
                    <SecondaryButton type="submit" size="sm">
                      <Upload size={13} /> Subir
                    </SecondaryButton>
                  </form>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {tab === "receipts" && (
        <SectionCard eyebrow="BF-04 / CENTRO DE RECEPCIONES" title="Recepciones de Mercadería">
          {loadingGrs ? (
            <p style={{ fontSize: "13px", color: "var(--admin-text-muted)" }}>Cargando recepciones...</p>
          ) : grs.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--admin-text-muted)" }}>No hay recepciones registradas.</p>
          ) : (
            <div style={{ overflowX: "auto" }} data-testid="procurement-gr-table">
              <table className="au-table">
                <thead>
                  <tr>
                    <th>N° Recepción</th>
                    <th>PO</th>
                    <th>Bodega</th>
                    <th>Estado</th>
                    <th>Líneas (Aceptada / Dañada / Rechazada)</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {grs.map(g => (
                    <tr key={g.id}>
                      <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-text)" }}>{g.receipt_number}</td>
                      <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>{g.po_number}</td>
                      <td style={{ color: "var(--admin-text)" }}>{g.warehouse_code}</td>
                      <td>
                        <StatusBadge tone={g.status === "confirmed" ? "success" : "warning"}>
                          {g.status === "confirmed" ? "Confirmada" : "Borrador"}
                        </StatusBadge>
                      </td>
                      <td style={{ fontSize: "12.5px", color: "var(--admin-text)" }}>
                        {(g.items || []).map(it => `${it.internal_sku}: ${it.quantity_accepted}/${it.quantity_damaged}/${it.quantity_rejected}`).join(" · ")}
                      </td>
                      <td>
                        {g.status === "draft" && (
                          <PrimaryButton size="sm" onClick={() => actionMut.mutate({ type: "confirm-gr", id: g.id })}>
                            Confirmar en WMS
                          </PrimaryButton>
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

      {/* Modal Crear PO */}
      <FormModal
        open={showCreatePo}
        title="Nueva Orden de Compra (BF-03)"
        onClose={() => setShowCreatePo(false)}
        maxWidth="540px"
        testId="create-po-modal"
      >
        <form onSubmit={handleCreatePo}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label style={labelStyle}>Proveedor *</label>
              <select required value={poForm.supplier_id} onChange={e => setPoForm(f => ({ ...f, supplier_id: e.target.value }))} style={inputStyle}>
                <option value="">Seleccionar...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.internal_code} — {s.trade_name || s.legal_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Bodega destino</label>
              <select value={poForm.destination_warehouse_id} onChange={e => setPoForm(f => ({ ...f, destination_warehouse_id: e.target.value }))} style={inputStyle}>
                <option value="">Seleccionar...</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Moneda</label>
              <select value={poForm.currency} onChange={e => setPoForm(f => ({ ...f, currency: e.target.value }))} style={inputStyle}>
                <option value="USD">USD</option>
                <option value="CLP">CLP</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Incoterm</label>
              <input value={poForm.incoterm_snapshot} onChange={e => setPoForm(f => ({ ...f, incoterm_snapshot: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Producto *</label>
              <select required value={poForm.product_id} onChange={e => setPoForm(f => ({ ...f, product_id: e.target.value }))} style={inputStyle}>
                <option value="">Seleccionar producto...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.sku || "S/SKU"} — {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Cantidad *</label>
              <input type="number" min="1" required value={poForm.quantity_ordered} onChange={e => setPoForm(f => ({ ...f, quantity_ordered: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Costo unitario *</label>
              <input type="number" step="0.01" min="0" required value={poForm.unit_cost} onChange={e => setPoForm(f => ({ ...f, unit_cost: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "18px" }}>
            <SecondaryButton type="button" onClick={() => setShowCreatePo(false)}>Cancelar</SecondaryButton>
            <PrimaryButton type="submit">Crear Borrador PO</PrimaryButton>
          </div>
        </form>
      </FormModal>

      {/* Modal Registrar Recepción */}
      <FormModal
        open={showCreateGr}
        title="Registrar Recepción Física (BF-04)"
        onClose={() => setShowCreateGr(false)}
        maxWidth="680px"
        scrollableBody
        testId="create-gr-modal"
      >
        <form onSubmit={handleCreateGr}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" }}>
            <div>
              <label style={labelStyle}>Bodega destino *</label>
              <select required value={grForm.warehouse_id} onChange={e => setGrForm(f => ({ ...f, warehouse_id: e.target.value }))} style={inputStyle}>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Guía / Remito</label>
              <input value={grForm.delivery_note_number} onChange={e => setGrForm(f => ({ ...f, delivery_note_number: e.target.value }))} placeholder="GD-00123" style={inputStyle} />
            </div>
          </div>

          {grForm.items.map((it, idx) => (
            <div key={it.purchase_order_item_id} style={{ padding: "12px", borderRadius: "10px", border: "1px solid var(--admin-border)", marginBottom: "10px", background: "#FAFAFA" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--admin-text)", marginBottom: "8px" }}>
                {it.sku} — {it.description} (Pendiente: {it.pending})
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={labelStyle}>Aceptadas (Vendibles)</label>
                  <input
                    type="number"
                    min="0"
                    value={it.quantity_accepted}
                    onChange={e => {
                      const val = e.target.value
                      setGrForm(f => ({
                        ...f,
                        items: f.items.map((x, i) => (i === idx ? { ...x, quantity_accepted: val } : x)),
                      }))
                    }}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Dañadas (No vendibles)</label>
                  <input
                    type="number"
                    min="0"
                    value={it.quantity_damaged}
                    onChange={e => {
                      const val = e.target.value
                      setGrForm(f => ({
                        ...f,
                        items: f.items.map((x, i) => (i === idx ? { ...x, quantity_damaged: val } : x)),
                      }))
                    }}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Rechazadas (Sin ingreso)</label>
                  <input
                    type="number"
                    min="0"
                    value={it.quantity_rejected}
                    onChange={e => {
                      const val = e.target.value
                      setGrForm(f => ({
                        ...f,
                        items: f.items.map((x, i) => (i === idx ? { ...x, quantity_rejected: val } : x)),
                      }))
                    }}
                    style={inputStyle}
                  />
                </div>
              </div>
              {(it.serialization_mode === "required" || it.serialization_mode === "optional") && (
                <div style={{ marginTop: "8px" }}>
                  <label style={labelStyle}>Seriales ({it.serialization_mode.toUpperCase()}) — separados por coma o línea</label>
                  <textarea
                    rows={2}
                    value={it.serials_raw}
                    onChange={e => {
                      const val = e.target.value
                      setGrForm(f => ({
                        ...f,
                        items: f.items.map((x, i) => (i === idx ? { ...x, serials_raw: val } : x)),
                      }))
                    }}
                    placeholder="SN-001, SN-002"
                    style={inputStyle}
                  />
                </div>
              )}
            </div>
          ))}

          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, color: "var(--admin-text)", marginTop: "8px" }}>
            <input type="checkbox" checked={grForm.confirm} onChange={e => setGrForm(f => ({ ...f, confirm: e.target.checked }))} />
            Confirmar inmediatamente en WMS y Kardex
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "18px" }}>
            <SecondaryButton type="button" onClick={() => setShowCreateGr(false)}>Cancelar</SecondaryButton>
            <PrimaryButton type="submit" data-testid="btn-submit-gr">Confirmar Recepción</PrimaryButton>
          </div>
        </form>
      </FormModal>
    </div>
  )
}
