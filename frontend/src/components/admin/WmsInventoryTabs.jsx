// components/admin/WmsInventoryTabs.jsx — Interfaces WMS (Gate 4: BF-05, BF-06, BF-07, BF-08, BF-46)
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  getWmsStocks,
  adjustWmsStock,
  getWmsKardex,
  getWmsKardexExportUrl,
  getWmsReservations,
  expireWmsReservations,
  getWmsTransfers,
  createWmsTransfer,
  receiveWmsTransfer,
  getSerials,
  regularizeSerials,
} from "../../api/wms.api"
import { SectionCard, PrimaryButton, SecondaryButton, StatusBadge, StatCard, FormModal, formInputStyle } from "./ui"
import { showToast } from "../../utils/toast"
import {
  Warehouse as WarehouseIcon,
  Boxes,
  ArrowLeftRight,
  Clock,
  Barcode,
  Download,
  Plus,
  CheckCircle2,
  SlidersHorizontal,
  RefreshCw,
} from "lucide-react"

const inputStyle = formInputStyle

const labelStyle = {
  fontSize: "11.5px",
  fontWeight: 600,
  color: "var(--admin-text, #14161A)",
  display: "block",
  marginBottom: "4px",
}

const WH_TYPE_LABELS = {
  central: "Bodega Central",
  showroom: "Showroom",
  transit: "Tránsito",
}

const MOV_LABELS = {
  opening: "Apertura",
  manual_in: "Entrada manual",
  reserve: "Reserva",
  release: "Liberación",
  dispatch: "Despacho",
  return_in: "Devolución física",
  adjust_pos: "Ajuste (+)",
  adjust_neg: "Ajuste (-)",
  transfer_out: "Salida transf.",
  transfer_in: "Entrada transf.",
  regularization: "Regularización",
}

const SER_STATUS_TONE = {
  in_stock: "success",
  reserved: "warning",
  in_transit: "info",
  dispatched: "neutral",
  returned: "warning",
  damaged: "danger",
  decommissioned: "danger",
}

// ── 1. Bodegas (BF-05) ─────────────────────────────────────────────────────
export function WmsWarehousesTab({ canManage }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ["wms-warehouses"], queryFn: () => getWarehouses() })
  const warehouses = data?.results || []

  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    code: "",
    name: "",
    warehouse_type: "showroom",
    address: "",
    fulfillment_priority: "20",
    is_sellable_online: true,
    internal_locations: "A-01, A-02",
  })

  const handleCreate = async (e) => {
    e?.preventDefault?.()
    if (!form.code.trim() || !form.name.trim()) {
      showToast("Código y nombre de bodega son obligatorios", "error")
      return
    }
    setSaving(true)
    try {
      const locs = form.internal_locations.split(",").map(s => s.trim()).filter(Boolean)
      await createWarehouse({
        ...form,
        fulfillment_priority: Number(form.fulfillment_priority) || 50,
        is_sellable_online: form.warehouse_type === "transit" ? false : form.is_sellable_online,
        internal_locations: locs,
      })
      showToast("Bodega creada correctamente")
      setShowModal(false)
      setForm({ code: "", name: "", warehouse_type: "showroom", address: "", fulfillment_priority: "20", is_sellable_online: true, internal_locations: "" })
      qc.invalidateQueries({ queryKey: ["wms-warehouses"] })
    } catch (err) {
      showToast(err?.response?.data?.error ? JSON.stringify(err.response.data.error) : "Error al crear bodega", "error")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (wh) => {
    try {
      await updateWarehouse(wh.id, { is_active: !wh.is_active })
      showToast(`Bodega ${wh.code} ${!wh.is_active ? "activada" : "desactivada"}`)
      qc.invalidateQueries({ queryKey: ["wms-warehouses"] })
    } catch {
      showToast("No se pudo actualizar la bodega", "error")
    }
  }

  return (
    <SectionCard
      eyebrow="BF-05 / INFRAESTRUCTURA FÍSICA"
      title="Bodegas y Ubicaciones"
      description="Administración de bodegas Central, Showroom y Tránsito con prioridad de despacho y elegibilidad de venta online."
      action={
        canManage && (
          <PrimaryButton size="sm" onClick={() => setShowModal(true)} data-testid="wms-new-warehouse-btn">
            <Plus size={14} /> Nueva bodega
          </PrimaryButton>
        )
      }
    >
      {isLoading ? (
        <p style={{ color: "var(--admin-text-muted)", fontSize: "13px" }}>Cargando bodegas…</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="au-table" data-testid="wms-warehouses-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre / Dirección</th>
                <th>Tipo</th>
                <th>Venta Online</th>
                <th>Prioridad</th>
                <th>Ubicaciones</th>
                <th>Estado</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {warehouses.map(wh => (
                <tr key={wh.id} style={{ opacity: wh.is_active ? 1 : 0.65 }}>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-primary-text)" }}>{wh.code}</td>
                  <td>
                    <p style={{ fontWeight: 700, color: "var(--admin-text)" }}>{wh.name}</p>
                    <p style={{ fontSize: "11.5px", color: "var(--admin-text-muted)" }}>{wh.address || "Sin dirección informada"}</p>
                  </td>
                  <td style={{ color: "var(--admin-text)", fontWeight: 600 }}>{WH_TYPE_LABELS[wh.warehouse_type] || wh.warehouse_type}</td>
                  <td>
                    <StatusBadge tone={wh.is_sellable_online ? "success" : "neutral"}>
                      {wh.is_sellable_online ? "Elegible" : "No vendible"}
                    </StatusBadge>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)", fontWeight: 700 }}>{wh.fulfillment_priority}</td>
                  <td>
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      {(wh.internal_locations || []).slice(0, 4).map(loc => (
                        <span key={loc} style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "999px", background: "var(--admin-surface-secondary)", border: "1px solid var(--admin-border)", color: "var(--admin-text)" }}>{loc}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <StatusBadge tone={wh.is_active ? "success" : "danger"}>{wh.is_active ? "Activa" : "Inactiva"}</StatusBadge>
                  </td>
                  {canManage && (
                    <td>
                      <SecondaryButton size="sm" onClick={() => handleToggleActive(wh)}>
                        {wh.is_active ? "Desactivar" : "Activar"}
                      </SecondaryButton>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FormModal
        open={showModal}
        title="Nueva Bodega"
        onClose={() => setShowModal(false)}
        onSave={handleCreate}
        saving={saving}
        saveLabel="Crear bodega"
        maxWidth="520px"
        testId="wms-new-warehouse-modal"
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={labelStyle}>Código único *</label>
            <input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="SHOW-SCL" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Tipo *</label>
            <select value={form.warehouse_type} onChange={e => setForm(f => ({ ...f, warehouse_type: e.target.value }))} style={inputStyle}>
              <option value="central">Bodega Central</option>
              <option value="showroom">Showroom</option>
              <option value="transit">Tránsito (No vendible)</option>
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Nombre *</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Showroom Providencia" style={inputStyle} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Ubicaciones internas (separadas por coma)</label>
            <input value={form.internal_locations} onChange={e => setForm(f => ({ ...f, internal_locations: e.target.value }))} placeholder="A-01, B-02" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Prioridad de despacho</label>
            <input type="number" min="1" value={form.fulfillment_priority} onChange={e => setForm(f => ({ ...f, fulfillment_priority: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ display: "flex", alignItems: "center", paddingTop: "18px" }}>
            <label style={{ fontSize: "12.5px", color: "var(--admin-text)", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
              <input type="checkbox" disabled={form.warehouse_type === "transit"} checked={form.warehouse_type === "transit" ? false : form.is_sellable_online} onChange={e => setForm(f => ({ ...f, is_sellable_online: e.target.checked }))} />
              Elegible venta online
            </label>
          </div>
        </div>
      </FormModal>
    </SectionCard>
  )
}

// ── 2. Stock Dimensional & Ajustes ─────────────────────────────────────────
export function WmsDimensionalStockTab({ canAdjust }) {
  const qc = useQueryClient()
  const [whFilter, setWhFilter] = useState("")
  const [search, setSearch] = useState("")
  const [lowOnly, setLowOnly] = useState(false)
  const [adjustRow, setAdjustRow] = useState(null)
  const [deltaPhys, setDeltaPhys] = useState("1")
  const [reason, setReason] = useState("Ajuste operativo de inventario")
  const [saving, setSaving] = useState(false)

  const { data: whData } = useQuery({ queryKey: ["wms-warehouses"], queryFn: () => getWarehouses() })
  const { data: stockData, isLoading } = useQuery({
    queryKey: ["wms-stocks", whFilter, search, lowOnly],
    queryFn: () => getWmsStocks({
      warehouse: whFilter || undefined,
      search: search || undefined,
      low_stock: lowOnly ? "true" : undefined,
    }),
  })

  const warehouses = whData?.results || []
  const rows = stockData?.results || []
  const totals = stockData?.totals || { total_physical: 0, total_reserved: 0, total_non_sellable: 0, total_available: 0 }

  const handleAdjust = async (e) => {
    e?.preventDefault?.()
    if (!adjustRow || !reason.trim()) {
      showToast("Indica el motivo obligatorio del ajuste", "error")
      return
    }
    setSaving(true)
    try {
      await adjustWmsStock({
        warehouse_id: adjustRow.warehouse,
        product_id: adjustRow.product,
        variant_id: adjustRow.variant || null,
        delta_physical: Number(deltaPhys) || 0,
        reason,
      })
      showToast("Stock ajustado y registrado en Kardex")
      setAdjustRow(null)
      qc.invalidateQueries({ queryKey: ["wms-stocks"] })
      qc.invalidateQueries({ queryKey: ["wms-kardex"] })
    } catch (err) {
      showToast(err?.response?.data?.error || "Error al ajustar stock", "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div className="au-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <StatCard variant="light" Icon={Boxes} label="Stock Físico Total" value={totals.total_physical} sub="Unidades reales en bodegas" />
        <StatCard variant="light" Icon={Clock} label="Stock Reservado" value={totals.total_reserved} sub="Bloqueado por checkout / órdenes" />
        <StatCard variant="light" Icon={SlidersHorizontal} label="No Elegible" value={totals.total_non_sellable} sub="Dañado / Cuarentena" />
        <StatCard variant="primary" Icon={CheckCircle2} label="Disponible Online" value={totals.total_available} sub="Físico - No elegible - Reservado" />
      </div>

      <SectionCard
        eyebrow="INVENTARIO DIMENSIONAL"
        title="Existencias por Bodega y SKU"
        action={
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="SKU, barcode o producto…"
              style={{ ...inputStyle, width: "220px" }}
              data-testid="wms-stock-search-input"
            />
            <select value={whFilter} onChange={e => setWhFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
              <option value="">Todas las bodegas</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
            </select>
            <label style={{ fontSize: "12px", color: "var(--admin-text)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} />
              Solo bajo mínimo
            </label>
          </div>
        }
      >
        {isLoading ? (
          <p style={{ color: "var(--admin-text-muted)", fontSize: "13px" }}>Cargando inventario dimensional…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "var(--admin-text-muted)", fontSize: "13px" }}>Sin registros para los filtros seleccionados.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="au-table" data-testid="wms-dimensional-table">
              <thead>
                <tr>
                  <th>Bodega</th>
                  <th>SKU</th>
                  <th>Producto / Variante</th>
                  <th>Serialización</th>
                  <th>Físico</th>
                  <th>Reservado</th>
                  <th>No elegible</th>
                  <th>Disponible</th>
                  <th>Seriales</th>
                  {canAdjust && <th />}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-text)" }}>{r.warehouse_code}</span>
                      {!r.is_sellable_online && <span style={{ display: "block", fontSize: "10.5px", color: "#D97706", fontWeight: 600 }}>No vendible</span>}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-primary-text)" }}>{r.internal_sku}</td>
                    <td>
                      <p style={{ fontWeight: 700, color: "var(--admin-text)" }}>{r.product_name}</p>
                      {r.variant_name && <p style={{ fontSize: "11.5px", color: "var(--admin-text-muted)" }}>{r.variant_name}</p>}
                    </td>
                    <td>
                      <StatusBadge tone={r.serialization_mode === "required" ? "warning" : "neutral"}>
                        {r.serialization_mode.toUpperCase()}
                      </StatusBadge>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-text)" }}>{r.physical_quantity}</td>
                    <td style={{ fontFamily: "var(--font-mono)", color: r.reserved_quantity > 0 ? "#D97706" : "var(--admin-text-muted)", fontWeight: 700 }}>{r.reserved_quantity}</td>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text-muted)" }}>{r.non_sellable_quantity}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 800, color: r.available_quantity <= r.stock_min ? "#DC2626" : "var(--admin-primary-text)" }}>{r.available_quantity}</td>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>{r.serialized_count ?? 0}</td>
                    {canAdjust && (
                      <td>
                        <SecondaryButton size="sm" onClick={() => { setAdjustRow(r); setDeltaPhys("1"); setReason("Ajuste operativo de inventario") }}>
                          Ajustar
                        </SecondaryButton>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <FormModal
        open={!!adjustRow}
        title="Ajuste Atómico de Inventario"
        onClose={() => setAdjustRow(null)}
        onSave={handleAdjust}
        saving={saving}
        saveLabel="Confirmar en Kardex"
        maxWidth="460px"
        testId="wms-adjust-stock-modal"
      >
        {adjustRow && (
          <>
            <p style={{ fontSize: "12.5px", color: "var(--admin-text-muted)", marginBottom: "6px" }}>
              {adjustRow.warehouse_code} · {adjustRow.internal_sku} ({adjustRow.product_name})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Variación stock físico (+ entrada / - salida)</label>
                <input type="number" required value={deltaPhys} onChange={e => setDeltaPhys(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Motivo obligatorio para Kardex *</label>
                <input required value={reason} onChange={e => setReason(e.target.value)} style={inputStyle} />
              </div>
            </div>
          </>
        )}
      </FormModal>
    </div>
  )
}

// ── 3. Kardex Inmutable (BF-06) ────────────────────────────────────────────
export function WmsKardexTab() {
  const [movType, setMovType] = useState("")
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["wms-kardex", movType, search],
    queryFn: () => getWmsKardex({ movement_type: movType || undefined, search: search || undefined }),
  })
  const rows = data?.results || []

  return (
    <SectionCard
      eyebrow="BF-06 / DIARIO APPEND-ONLY INMUTABLE"
      title="Kardex de Movimientos"
      action={
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="SKU, motivo, doc…" style={{ ...inputStyle, width: "180px" }} />
          <select value={movType} onChange={e => setMovType(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
            <option value="">Todos los tipos</option>
            {Object.entries(MOV_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <a href={getWmsKardexExportUrl({ movement_type: movType || undefined, search: search || undefined })} className="au-btn au-btn--secondary au-btn--sm" style={{ textDecoration: "none" }}>
            <Download size={14} /> Exportar CSV
          </a>
        </div>
      }
    >
      {isLoading ? (
        <p style={{ color: "var(--admin-text-muted)", fontSize: "13px" }}>Cargando Kardex…</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="au-table" data-testid="wms-kardex-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Bodega</th>
                <th>SKU / Producto</th>
                <th>Movimiento</th>
                <th>Cant.</th>
                <th>Saldos (Fís · Res · Disp)</th>
                <th>Motivo / Origen</th>
                <th>Seriales</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(m => (
                <tr key={m.id}>
                  <td style={{ fontSize: "12px", color: "var(--admin-text-muted)", whiteSpace: "nowrap" }}>
                    {new Date(m.recorded_at).toLocaleString("es-CL")}
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-text)" }}>{m.warehouse_code}</td>
                  <td>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-primary-text)" }}>{m.sku_snapshot}</span>
                    <p style={{ fontSize: "11.5px", color: "var(--admin-text-muted)" }}>{m.product_name}</p>
                  </td>
                  <td><StatusBadge tone="neutral">{MOV_LABELS[m.movement_type] || m.movement_type}</StatusBadge></td>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 800, color: "var(--admin-text)" }}>{m.quantity}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--admin-text)" }}>
                    {m.physical_before}→{m.physical_after} · {m.reserved_before}→{m.reserved_after} · <strong>{m.available_after}</strong>
                  </td>
                  <td>
                    <p style={{ fontSize: "12.5px", color: "var(--admin-text)", fontWeight: 600 }}>{m.reason}</p>
                    <p style={{ fontSize: "11px", color: "var(--admin-text-muted)" }}>
                      {m.source_document_type === "GOODS_RECEIPT" ? (
                        <a href="/admin/procurement?tab=receipts" style={{ color: "var(--admin-primary-text)", fontWeight: 700, textDecoration: "underline" }}>
                          {m.source_document_type}
                        </a>
                      ) : (
                        m.source_document_type
                      )}{" "}
                      {m.actor_email || "Sistema"}
                    </p>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "11.5px", color: "var(--admin-text)" }}>
                    {(m.serial_numbers || []).join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

// ── 4. Transferencias entre Bodegas ────────────────────────────────────────
export function WmsTransfersTab({ canAdjust }) {
  const qc = useQueryClient()
  const { data: whData } = useQuery({ queryKey: ["wms-warehouses"], queryFn: () => getWarehouses({ active_only: "true" }) })
  const { data: stockData } = useQuery({ queryKey: ["wms-stocks-trf"], queryFn: () => getWmsStocks() })
  const { data: trfData, isLoading } = useQuery({ queryKey: ["wms-transfers"], queryFn: () => getWmsTransfers() })

  const warehouses = whData?.results || []
  const stocks = stockData?.results || []
  const transfers = trfData?.results || []

  const [srcId, setSrcId] = useState("")
  const [dstId, setDstId] = useState("")
  const [stockId, setStockId] = useState("")
  const [qty, setQty] = useState("1")
  const [serialsText, setSerialsText] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const selectedStock = stocks.find(s => s.id === stockId)

  const handleTransfer = async (e) => {
    e.preventDefault()
    if (!srcId || !dstId || !selectedStock) return
    setSubmitting(true)
    try {
      const serials = serialsText.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
      await createWmsTransfer({
        source_warehouse_id: srcId,
        destination_warehouse_id: dstId,
        items: [{
          product_id: selectedStock.product,
          variant_id: selectedStock.variant || null,
          quantity: Number(qty) || 1,
          serial_numbers: serials,
        }],
      })
      showToast("Transferencia despachada a tránsito")
      setSerialsText("")
      qc.invalidateQueries({ queryKey: ["wms-transfers"] })
      qc.invalidateQueries({ queryKey: ["wms-stocks"] })
      qc.invalidateQueries({ queryKey: ["wms-kardex"] })
    } catch (err) {
      showToast(err?.response?.data?.error || "Error al crear transferencia", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const handleReceive = async (id) => {
    try {
      await receiveWmsTransfer(id)
      showToast("Transferencia recibida en bodega destino")
      qc.invalidateQueries({ queryKey: ["wms-transfers"] })
      qc.invalidateQueries({ queryKey: ["wms-stocks"] })
      qc.invalidateQueries({ queryKey: ["wms-kardex"] })
    } catch (err) {
      showToast(err?.response?.data?.error || "Error al recibir transferencia", "error")
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {canAdjust && (
        <SectionCard eyebrow="MOVIMIENTO INTERNO" title="Nueva Transferencia entre Bodegas">
          <form onSubmit={handleTransfer} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", alignItems: "end" }}>
            <div>
              <label style={labelStyle}>Bodega Origen *</label>
              <select required value={srcId} onChange={e => setSrcId(e.target.value)} style={inputStyle}>
                <option value="">Seleccionar…</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Bodega Destino *</label>
              <select required value={dstId} onChange={e => setDstId(e.target.value)} style={inputStyle}>
                <option value="">Seleccionar…</option>
                {warehouses.filter(w => w.id !== srcId).map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>SKU en Origen *</label>
              <select required value={stockId} onChange={e => setStockId(e.target.value)} style={inputStyle}>
                <option value="">Seleccionar…</option>
                {stocks.filter(s => !srcId || s.warehouse === srcId).map(s => (
                  <option key={s.id} value={s.id}>{s.internal_sku} — {s.product_name} (Disp: {s.available_quantity})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Cantidad *</label>
              <input required type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Seriales (opcional)</label>
              <input value={serialsText} onChange={e => setSerialsText(e.target.value)} placeholder="SN-1, SN-2" style={inputStyle} />
            </div>
            <PrimaryButton type="submit" loading={submitting}><ArrowLeftRight size={14} /> Despachar transferencia</PrimaryButton>
          </form>
        </SectionCard>
      )}

      <SectionCard eyebrow="HISTORIAL DE TRANSFERENCIAS" title="Transferencias Registradas">
        {isLoading ? (
          <p style={{ color: "var(--admin-text-muted)", fontSize: "13px" }}>Cargando transferencias…</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="au-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Origen → Destino</th>
                  <th>Ítems</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  {canAdjust && <th />}
                </tr>
              </thead>
              <tbody>
                {transfers.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-primary-text)" }}>{t.code}</td>
                    <td style={{ fontWeight: 700, color: "var(--admin-text)" }}>{t.source_code} → {t.destination_code}</td>
                    <td style={{ color: "var(--admin-text)" }}>
                      {(t.items || []).map(it => `${it.internal_sku} x${it.quantity}`).join(", ")}
                    </td>
                    <td>
                      <StatusBadge tone={t.status === "received" ? "success" : t.status === "in_transit" ? "warning" : "neutral"}>
                        {t.status}
                      </StatusBadge>
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--admin-text-muted)" }}>{new Date(t.created_at).toLocaleString("es-CL")}</td>
                    {canAdjust && (
                      <td>
                        {t.status === "in_transit" && (
                          <PrimaryButton size="sm" onClick={() => handleReceive(t.id)}>Recibir</PrimaryButton>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ── 5. Reservas de Stock (BF-08) ───────────────────────────────────────────
export function WmsReservationsTab({ canAdjust }) {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState("")
  const { data, isLoading } = useQuery({
    queryKey: ["wms-reservations", statusFilter],
    queryFn: () => getWmsReservations({ status: statusFilter || undefined }),
  })
  const rows = data?.results || []

  const handleExpire = async () => {
    try {
      const res = await expireWmsReservations()
      showToast(`Reservas expiradas liberadas: ${res.expired_released_count}`)
      qc.invalidateQueries({ queryKey: ["wms-reservations"] })
      qc.invalidateQueries({ queryKey: ["wms-stocks"] })
    } catch {
      showToast("Error al ejecutar limpieza TTL", "error")
    }
  }

  return (
    <SectionCard
      eyebrow="BF-08 / BLOQUEO TRANSACCIONAL Y TTL"
      title="Reservas de Stock"
      action={
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
            <option value="">Todos los estados</option>
            <option value="temporary">Temporal (Checkout)</option>
            <option value="consolidated">Consolidada (Pagada)</option>
            <option value="consumed">Consumida (Despachada)</option>
            <option value="released">Liberada</option>
            <option value="expired">Expirada</option>
          </select>
          {canAdjust && (
            <SecondaryButton size="sm" onClick={handleExpire}>
              <RefreshCw size={14} /> Liberar expiradas (TTL)
            </SecondaryButton>
          )}
        </div>
      }
    >
      {isLoading ? (
        <p style={{ color: "var(--admin-text-muted)", fontSize: "13px" }}>Cargando reservas…</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="au-table">
            <thead>
              <tr>
                <th>Bodega</th>
                <th>SKU / Producto</th>
                <th>Cant.</th>
                <th>Estado</th>
                <th>Orden</th>
                <th>Expira</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-text)" }}>{r.warehouse_code}</td>
                  <td>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-primary-text)" }}>{r.internal_sku}</span>
                    <p style={{ fontSize: "11.5px", color: "var(--admin-text-muted)" }}>{r.product_name}</p>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-text)" }}>{r.quantity}</td>
                  <td>
                    <StatusBadge tone={r.status === "consolidated" ? "success" : r.status === "temporary" ? "warning" : "neutral"}>
                      {r.status}
                    </StatusBadge>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--admin-text)" }}>
                    {r.order ? `${r.order.slice(0, 8)}… (${r.order_status})` : r.session_key || "—"}
                  </td>
                  <td style={{ fontSize: "12px", color: "var(--admin-text-muted)" }}>
                    {r.expires_at ? new Date(r.expires_at).toLocaleString("es-CL") : "No expira (Consolidada)"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

// ── 6. Seriales & Asistente de Regularización (BF-07 & BF-46) ──────────────
export function WmsSerialsTab({ canAdjust }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState("")
  const { data: stockData } = useQuery({ queryKey: ["wms-stocks-ser"], queryFn: () => getWmsStocks() })
  const { data: serialData, isLoading } = useQuery({
    queryKey: ["wms-serials", search],
    queryFn: () => getSerials({ search: search || undefined }),
  })

  const stocks = stockData?.results || []
  const serials = serialData?.results || []

  const [selectedStockId, setSelectedStockId] = useState("")
  const [scannerInput, setScannerInput] = useState("")
  const [setRequired, setSetRequired] = useState(false)
  const [saving, setSaving] = useState(false)

  const selectedStock = stocks.find(s => s.id === selectedStockId)
  const parsedSerials = scannerInput.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean)

  const handleRegularize = async (e) => {
    e.preventDefault()
    if (!selectedStock) return
    setSaving(true)
    try {
      const res = await regularizeSerials({
        warehouse_id: selectedStock.warehouse,
        product_id: selectedStock.product,
        variant_id: selectedStock.variant || null,
        serial_numbers: parsedSerials,
        set_required: setRequired,
      })
      showToast(`Seriales regularizados: ${res.registered_count}. Modo: ${res.serialization_mode.toUpperCase()}`)
      setScannerInput("")
      qc.invalidateQueries({ queryKey: ["wms-serials"] })
      qc.invalidateQueries({ queryKey: ["wms-stocks"] })
      qc.invalidateQueries({ queryKey: ["wms-kardex"] })
    } catch (err) {
      showToast(err?.response?.data?.error || "Error al regularizar seriales", "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {canAdjust && (
        <SectionCard
          eyebrow="BF-46 / ASISTENTE DE REGULARIZACIÓN"
          title="Registro y Regularización de Números de Serie"
          description="Compatible con lectores de código de barras por teclado (Enter o coma). No crea stock adicional ni altera costos."
        >
          <form onSubmit={handleRegularize} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div>
              <label style={labelStyle}>Unidad Comercial en Bodega *</label>
              <select required value={selectedStockId} onChange={e => setSelectedStockId(e.target.value)} style={inputStyle} data-testid="wms-reg-stock-select">
                <option value="">Seleccionar producto / bodega…</option>
                {stocks.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.warehouse_code} | {s.internal_sku} — {s.product_name} (Fís: {s.physical_quantity} · Seriales: {s.serialized_count ?? 0})
                  </option>
                ))}
              </select>
              {selectedStock && (
                <p style={{ fontSize: "12px", color: "var(--admin-text-muted)", marginTop: "6px" }}>
                  Físico en bodega: <strong>{selectedStock.physical_quantity}</strong> · Serializados: <strong>{selectedStock.serialized_count ?? 0}</strong> · Pendientes: <strong>{Math.max(0, selectedStock.physical_quantity - (selectedStock.serialized_count ?? 0))}</strong>
                </p>
              )}
              <label style={{ fontSize: "12.5px", color: "var(--admin-text)", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px", marginTop: "12px" }}>
                <input type="checkbox" checked={setRequired} onChange={e => setSetRequired(e.target.checked)} />
                Activar serialización obligatoria (REQUIRED) al completar integridad
              </label>
            </div>
            <div>
              <label style={labelStyle}>Escanear o ingresar seriales reales (uno por línea o separados por coma)</label>
              <textarea
                rows={4}
                value={scannerInput}
                onChange={e => setScannerInput(e.target.value)}
                placeholder={"SN-SHURE-0001\nSN-SHURE-0002"}
                style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
                data-testid="wms-serials-textarea"
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                <span style={{ fontSize: "12px", color: "var(--admin-text-muted)" }}>{parsedSerials.length} serial(es) en lote</span>
                <PrimaryButton type="submit" loading={saving} data-testid="wms-regularize-submit-btn">
                  <Barcode size={14} /> Confirmar regularización
                </PrimaryButton>
              </div>
            </div>
          </form>
        </SectionCard>
      )}

      <SectionCard
        eyebrow="BF-07 / TRAZABILIDAD UNITARIA"
        title="Registro Maestro de Seriales"
        action={
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar serial o SKU…" style={{ ...inputStyle, width: "220px" }} data-testid="wms-serial-search-input" />
        }
      >
        {isLoading ? (
          <p style={{ color: "var(--admin-text-muted)", fontSize: "13px" }}>Cargando seriales…</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="au-table" data-testid="wms-serials-table">
              <thead>
                <tr>
                  <th>N° de Serie</th>
                  <th>SKU / Producto</th>
                  <th>Bodega</th>
                  <th>Estado</th>
                  <th>Orden / Cliente</th>
                  <th>Ingreso</th>
                </tr>
              </thead>
              <tbody>
                {serials.map(sn => (
                  <tr key={sn.id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-primary-text)" }}>{sn.serial_number}</td>
                    <td>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-text)" }}>{sn.internal_sku}</span>
                      <p style={{ fontSize: "11.5px", color: "var(--admin-text-muted)" }}>{sn.product_name}</p>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>{sn.warehouse_code || "Despachado"}</td>
                    <td><StatusBadge tone={SER_STATUS_TONE[sn.status] || "neutral"}>{sn.status}</StatusBadge></td>
                    <td style={{ fontSize: "12px", color: "var(--admin-text)" }}>
                      {sn.order ? `Orden ${sn.order.slice(0, 8)}…` : "—"}
                      {sn.customer_email && <span style={{ display: "block", fontSize: "11px", color: "var(--admin-text-muted)" }}>{sn.customer_email}</span>}
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--admin-text-muted)" }}>{new Date(sn.received_at).toLocaleDateString("es-CL")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
