// pages/admin/AdminLogistics.jsx
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Truck, Package, Tag, FileText, MapPin, AlertTriangle, ShieldCheck, Wrench, Search, Plus, CheckCircle2,
} from "lucide-react"
import {
  AdminPageHeader, SectionCard, StatCard, PrimaryButton, SecondaryButton, FormModal, FormField, formInputStyle,
} from "../../components/admin/ui"
import { showToast } from "../../utils/toast"
import {
  getLogisticsOverview, getLogisticsCarriers, getLogisticsShipments,
  createLogisticsShipment, addShipmentPackage, advanceShipmentStatus, quoteShipmentCarrier,
  getLogisticsLabels, generateShipmentLabels,
  getLogisticsManifests, createLogisticsManifest, addShipmentToManifest, closeLogisticsManifest, handoverLogisticsManifest,
  getLogisticsTracking, recordLogisticsTracking, getLogisticsIncidents,
  getLogisticsWarranties, validateSerialWarranty,
  getLogisticsRepairs, createLogisticsRepair, addRepairDiagnosis, setRepairBudget,
  addRepairTest, deliverRepairOrder,
} from "../../api/admin.api"

const TABS = [
  { key: "overview", label: "Dashboard & Cola" },
  { key: "shipments", label: "Envíos & Bultos" },
  { key: "couriers", label: "Couriers & Tarifas" },
  { key: "labels", label: "Etiquetas" },
  { key: "manifests", label: "Manifiestos" },
  { key: "tracking", label: "Tracking & Incidencias" },
  { key: "warranties", label: "Garantías & Seriales" },
  { key: "workshop", label: "Servicio Técnico" },
]

const pill = (bg, color) => ({
  display: "inline-flex", alignItems: "center", gap: "4px",
  padding: "3px 9px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: bg, color,
})

const STATUS_STYLE = {
  reserved: pill("#e0f2fe", "#075985"),
  preparing: pill("#fef9c3", "#854d0e"),
  packed: pill("#ede9fe", "#5b21b6"),
  ready_for_pickup: pill("#dcfce7", "#166534"),
  handed_over: pill("#dcfce7", "#166534"),
  in_transit: pill("#e0f2fe", "#075985"),
  delivered: pill("#dcfce7", "#166534"),
  closed: pill("#dcfce7", "#166534"),
  incident: pill("#fee2e2", "#991b1b"),
  pending_verification: pill("#fef9c3", "#854d0e"),
  coverage_confirmed: pill("#dcfce7", "#166534"),
  covered: pill("#dcfce7", "#166534"),
  integration_pending: pill("#f1f5f9", "#475569"),
}

function StatusBadge({ value }) {
  return <span style={STATUS_STYLE[value] || pill("#f1f5f9", "#475569")}>{value}</span>
}

export default function AdminLogistics() {
  const qc = useQueryClient()
  const [tab, setTab] = useState("overview")
  const [pkgTarget, setPkgTarget] = useState(null)
  const [pkgForm, setPkgForm] = useState({ gross_weight_kg: "2.5", length_cm: "40", width_cm: "30", height_cm: "25", commercial_content: "Equipamiento Audio Pro", is_fragile: true })
  const [quoteTarget, setQuoteTarget] = useState(null)
  const [quoteForm, setQuoteForm] = useState({ carrier_id: "", carrier_service_id: "" })
  const [manifestModal, setManifestModal] = useState(false)
  const [manifestCarrierId, setManifestCarrierId] = useState("")
  const [handoverTarget, setHandoverTarget] = useState(null)
  const [handoverEvidence, setHandoverEvidence] = useState("Retiro confirmado en bodega")
  const [trackModal, setTrackModal] = useState(false)
  const [trackForm, setTrackForm] = useState({ shipment_id: "", original_code: "IN_TRANSIT", location: "Hub Santiago" })
  const [serialQuery, setSerialQuery] = useState("")
  const [serialResult, setSerialResult] = useState(null)
  const [repairModal, setRepairModal] = useState(false)
  const [repairForm, setRepairForm] = useState({ equipment_brand: "Genelec", equipment_model: "8030C", serial_number: "", reported_symptoms: "", service_mode: "in_warranty" })
  const [diagTarget, setDiagTarget] = useState(null)
  const [diagForm, setDiagForm] = useState({ technical_findings: "", proposed_work: "", diagnostic_fee: "0", labor_fee: "0", parts_fee: "0" })
  const [deliverTarget, setDeliverTarget] = useState(null)
  const [deliverForm, setDeliverForm] = useState({ delivered_to_name: "", delivered_to_id: "", delivery_notes: "" })
  const [saving, setSaving] = useState(false)

  const { data: overview = { kpis: {}, ready_orders: [] } } = useQuery({ queryKey: ["g10-overview"], queryFn: getLogisticsOverview })
  const { data: carriersData = { results: [] } } = useQuery({ queryKey: ["g10-carriers"], queryFn: getLogisticsCarriers })
  const { data: shipmentsData = { results: [] } } = useQuery({ queryKey: ["g10-shipments"], queryFn: getLogisticsShipments })
  const { data: labelsData = { results: [] } } = useQuery({ queryKey: ["g10-labels"], queryFn: getLogisticsLabels, enabled: tab === "labels" || tab === "shipments" })
  const { data: manifestsData = { results: [] } } = useQuery({ queryKey: ["g10-manifests"], queryFn: getLogisticsManifests, enabled: tab === "manifests" || tab === "shipments" })
  const { data: trackingData = { results: [] } } = useQuery({ queryKey: ["g10-tracking"], queryFn: getLogisticsTracking, enabled: tab === "tracking" })
  const { data: incidentsData = { results: [] } } = useQuery({ queryKey: ["g10-incidents"], queryFn: getLogisticsIncidents, enabled: tab === "tracking" })
  const { data: warrantiesData = { results: [] } } = useQuery({ queryKey: ["g10-warranties"], queryFn: getLogisticsWarranties, enabled: tab === "warranties" })
  const { data: repairsData = { results: [] } } = useQuery({ queryKey: ["g10-repairs"], queryFn: getLogisticsRepairs, enabled: tab === "workshop" })

  const carriers = carriersData.results || []
  const shipments = shipmentsData.results || []
  const manifests = manifestsData.results || []
  const kpis = overview.kpis || {}

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["g10-overview"] })
    qc.invalidateQueries({ queryKey: ["g10-shipments"] })
    qc.invalidateQueries({ queryKey: ["g10-labels"] })
    qc.invalidateQueries({ queryKey: ["g10-manifests"] })
    qc.invalidateQueries({ queryKey: ["g10-tracking"] })
    qc.invalidateQueries({ queryKey: ["g10-repairs"] })
  }

  const handleCreateShipment = async (orderId) => {
    try {
      await createLogisticsShipment({ order_id: orderId, idempotency_key: `UI-SHP-${orderId}` })
      showToast("Envío creado en cola de preparación", "success")
      refreshAll()
      setTab("shipments")
    } catch (e) {
      showToast(e?.response?.data?.error || "No se pudo crear envío", "error")
    }
  }

  const handleAddPkg = async () => {
    if (!pkgTarget) return
    setSaving(true)
    try {
      await addShipmentPackage(pkgTarget.id, pkgForm)
      showToast("Bulto registrado con peso volumétrico", "success")
      refreshAll()
      setPkgTarget(null)
    } catch (e) {
      showToast(e?.response?.data?.error || "Error agregando bulto", "error")
    } finally { setSaving(false) }
  }

  const handleQuote = async () => {
    if (!quoteTarget) return
    setSaving(true)
    try {
      await quoteShipmentCarrier(quoteTarget.id, quoteForm)
      showToast("Tarifa simulada/configurada asignada", "success")
      refreshAll()
      setQuoteTarget(null)
    } catch (e) {
      showToast(e?.response?.data?.error || "Error cotizando envío", "error")
    } finally { setSaving(false) }
  }

  const handleAdvance = async (shp, next) => {
    try {
      await advanceShipmentStatus(shp.id, next)
      showToast(`Envío actualizado a ${next}`, "success")
      refreshAll()
    } catch (e) {
      showToast(e?.response?.data?.error || "Error avanzando estado", "error")
    }
  }

  const handleLabels = async (shp) => {
    try {
      await generateShipmentLabels(shp.id)
      showToast("Etiquetas PDF generadas (sin descontar WMS)", "success")
      refreshAll()
    } catch (e) {
      showToast(e?.response?.data?.error || "Error generando etiquetas", "error")
    }
  }

  const handleCreateManifest = async () => {
    setSaving(true)
    try {
      await createLogisticsManifest({ carrier_id: manifestCarrierId || carriers[0]?.id })
      showToast("Manifiesto creado", "success")
      refreshAll()
      setManifestModal(false)
    } catch (e) {
      showToast(e?.response?.data?.error || "Error creando manifiesto", "error")
    } finally { setSaving(false) }
  }

  const handleHandover = async () => {
    if (!handoverTarget) return
    setSaving(true)
    try {
      await handoverLogisticsManifest(handoverTarget.id, { handover_evidence: handoverEvidence })
      showToast("Retiro físico confirmado y WMS actualizado", "success")
      refreshAll()
      setHandoverTarget(null)
    } catch (e) {
      showToast(e?.response?.data?.error || "Error confirmando retiro", "error")
    } finally { setSaving(false) }
  }

  const handleValidateSerial = async () => {
    if (!serialQuery.trim()) return
    try {
      const res = await validateSerialWarranty({ serial_number: serialQuery.trim() })
      setSerialResult(res)
    } catch {
      showToast("Error validando serial", "error")
    }
  }

  const handleCreateRepair = async () => {
    setSaving(true)
    try {
      await createLogisticsRepair(repairForm)
      showToast("Orden de taller creada", "success")
      refreshAll()
      setRepairModal(false)
    } catch (e) {
      showToast(e?.response?.data?.error || "Error creando orden de taller", "error")
    } finally { setSaving(false) }
  }

  const handleSaveDiagnosis = async () => {
    if (!diagTarget) return
    setSaving(true)
    try {
      await addRepairDiagnosis(diagTarget.id, { technical_findings: diagForm.technical_findings, proposed_work: diagForm.proposed_work })
      await setRepairBudget(diagTarget.id, { diagnostic_fee: diagForm.diagnostic_fee, labor_fee: diagForm.labor_fee, parts_fee: diagForm.parts_fee })
      showToast("Diagnóstico y presupuesto registrados", "success")
      refreshAll()
      setDiagTarget(null)
    } catch (e) {
      showToast(e?.response?.data?.error || "Error guardando diagnóstico", "error")
    } finally { setSaving(false) }
  }

  const handleDeliverRepair = async () => {
    if (!deliverTarget) return
    setSaving(true)
    try {
      await addRepairTest(deliverTarget.id, { test_category: "final_verification", procedure: "Prueba funcional final", result: "pass" })
      await deliverRepairOrder(deliverTarget.id, deliverForm)
      showToast("Equipo entregado y orden de taller cerrada", "success")
      refreshAll()
      setDeliverTarget(null)
    } catch (e) {
      showToast(e?.response?.data?.error || "Error cerrando reparación", "error")
    } finally { setSaving(false) }
  }

  return (
    <div className="au-page" data-testid="admin-logistics-page">
      <AdminPageHeader
        eyebrow="LEVELPRO / OPERACIONES"
        title="Logística & Posventa"
        description="Centro de despacho, bultos, couriers, manifiestos, tracking, garantías por serial y taller técnico"
      />

      <div className="lp-kpi-strip">
        <StatCard label="Pedidos por preparar" value={kpis.ready_orders_count ?? 0} sub="Con stock asignado" Icon={Package} />
        <StatCard label="Envíos activos" value={kpis.active_shipments_count ?? 0} sub="En preparación o tránsito" Icon={Truck} />
        <StatCard label="Manifiestos abiertos" value={kpis.open_manifests_count ?? 0} sub="Retiro diario de bodega" Icon={FileText} />
        <StatCard label="Garantías / Taller" value={(kpis.open_warranties_count ?? 0) + (kpis.active_repairs_count ?? 0)} sub="Casos de posventa activos" Icon={Wrench} />
      </div>

      <div className="lp-seg-tabs" style={{ flexWrap: "wrap" }}>
        {TABS.map(({ key, label }) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`lp-seg-tab${tab === key ? " is-active" : ""}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <SectionCard eyebrow="COLA DE PREPARACIÓN" title="Pedidos listos para despacho">
          {(overview.ready_orders || []).length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--admin-text-muted)" }}>No hay pedidos pendientes de preparación.</p>
          ) : (
            <table className="lp-table" style={{ width: "100%" }}>
              <thead><tr><th>Pedido</th><th>Cliente</th><th>Estado OMS</th><th>Destino</th><th>Acción</th></tr></thead>
              <tbody>
                {overview.ready_orders.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>#{o.order_short}</td>
                    <td>{o.customer_email}</td>
                    <td><StatusBadge value={o.fulfillment_status} /></td>
                    <td>{o.shipping_address}</td>
                    <td><PrimaryButton onClick={() => handleCreateShipment(o.id)} style={{ padding: "5px 10px", fontSize: "12px" }}>Crear envío</PrimaryButton></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>
      )}

      {tab === "shipments" && (
        <SectionCard eyebrow="BF-25 · EMPAQUE Y DESPACHO" title="Envíos, bultos y estados operativos">
          {shipments.length === 0 ? <p style={{ fontSize: "13px", color: "var(--admin-text-muted)" }}>Sin envíos registrados.</p> : (
            <table className="lp-table" style={{ width: "100%" }}>
              <thead><tr><th>Envío</th><th>Pedido</th><th>Transportista</th><th>Bultos</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {shipments.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{s.shipment_number}</td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>#{s.order_short}</td>
                    <td>{s.carrier_name || "Sin asignar"}</td>
                    <td>{s.packages_count}</td>
                    <td><StatusBadge value={s.status} /></td>
                    <td style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <SecondaryButton onClick={() => setPkgTarget(s)} style={{ padding: "4px 8px", fontSize: "11px" }}>+ Bulto</SecondaryButton>
                      <SecondaryButton onClick={() => { setQuoteTarget(s); setQuoteForm({ carrier_id: carriers[0]?.id || "", carrier_service_id: carriers[0]?.services?.[0]?.id || "" }) }} style={{ padding: "4px 8px", fontSize: "11px" }}>Cotizar</SecondaryButton>
                      {s.status === "reserved" && <SecondaryButton onClick={() => handleAdvance(s, "preparing")} style={{ padding: "4px 8px", fontSize: "11px" }}>Preparar</SecondaryButton>}
                      {s.status === "preparing" && <SecondaryButton onClick={() => handleAdvance(s, "packed")} style={{ padding: "4px 8px", fontSize: "11px" }}>Empacar</SecondaryButton>}
                      {s.status === "packed" && <PrimaryButton onClick={() => handleLabels(s)} style={{ padding: "4px 8px", fontSize: "11px" }}>Etiqueta</PrimaryButton>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>
      )}

      {tab === "couriers" && (
        <SectionCard eyebrow="BF-25 · ADAPTADORES REGIONALES" title="Couriers configurados (CL / AR)">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px" }}>
            {carriers.map(c => (
              <div key={c.id} style={{ padding: "14px", borderRadius: "12px", border: "1px solid var(--admin-border)", background: "var(--admin-surface-soft)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>{c.name} ({c.country})</strong>
                  <StatusBadge value={c.integration_status} />
                </div>
                <p style={{ fontSize: "12px", color: "var(--admin-text-muted)", margin: "6px 0" }}>Divisor volumétrico: {c.volumetric_divisor}</p>
                <div style={{ fontSize: "12px" }}>
                  {(c.services || []).map(sv => <div key={sv.id}>• {sv.name} ({sv.delivery_window})</div>)}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {tab === "labels" && (
        <SectionCard eyebrow="BF-25 · ETIQUETAS IMPRIMIBLES" title="Etiquetas generadas (No equivalen a DTE)">
          <table className="lp-table" style={{ width: "100%" }}>
            <thead><tr><th>Código de barras</th><th>Envío</th><th>Tipo</th><th>Tracking</th><th>SHA-256</th></tr></thead>
            <tbody>
              {(labelsData.results || []).map(l => (
                <tr key={l.id}>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{l.barcode_value}</td>
                  <td>{l.shipment_number}</td>
                  <td>{l.label_type}</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{l.tracking_number}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}>{(l.pdf_sha256 || "").slice(0, 12)}...</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      )}

      {tab === "manifests" && (
        <SectionCard
          eyebrow="BF-25 · MANIFIESTOS DIARIOS"
          title="Manifiestos de retiro"
          action={<PrimaryButton onClick={() => { setManifestCarrierId(carriers[0]?.id || ""); setManifestModal(true) }}><Plus size={14} /> Nuevo manifiesto</PrimaryButton>}
        >
          <table className="lp-table" style={{ width: "100%" }}>
            <thead><tr><th>Manifiesto</th><th>Fecha</th><th>Transportista</th><th>Envíos / Bultos</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {manifests.map(m => (
                <tr key={m.id}>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{m.manifest_number}</td>
                  <td>{m.operational_date}</td>
                  <td>{m.carrier_name}</td>
                  <td>{m.total_shipments} / {m.total_packages}</td>
                  <td><StatusBadge value={m.status} /></td>
                  <td style={{ display: "flex", gap: "6px" }}>
                    {m.status === "draft" && shipments[0] && (
                      <SecondaryButton onClick={() => addShipmentToManifest(m.id, shipments[0].id).then(() => refreshAll())} style={{ padding: "4px 8px", fontSize: "11px" }}>+ Envío</SecondaryButton>
                    )}
                    {(m.status === "draft" || m.status === "ready") && (
                      <SecondaryButton onClick={() => closeLogisticsManifest(m.id).then(() => refreshAll())} style={{ padding: "4px 8px", fontSize: "11px" }}>Cerrar</SecondaryButton>
                    )}
                    {m.status === "closed" && (
                      <PrimaryButton onClick={() => setHandoverTarget(m)} style={{ padding: "4px 8px", fontSize: "11px" }}>Confirmar retiro</PrimaryButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      )}

      {tab === "tracking" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <SectionCard
            eyebrow="BF-25 · SEGUIMIENTO"
            title="Eventos de tracking normalizados"
            action={<PrimaryButton onClick={() => { setTrackForm({ shipment_id: shipments[0]?.id || "", original_code: "DELIVERED", location: "Santiago" }); setTrackModal(true) }}><MapPin size={14} /> Registrar evento</PrimaryButton>}
          >
            <table className="lp-table" style={{ width: "100%" }}>
              <thead><tr><th>Envío</th><th>Estado normalizado</th><th>Código origen</th><th>Ubicación</th><th>Verificación</th></tr></thead>
              <tbody>
                {(trackingData.results || []).map(t => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{t.shipment_number}</td>
                    <td><StatusBadge value={t.normalized_status} /></td>
                    <td>{t.original_code}</td>
                    <td>{t.location || "—"}</td>
                    <td>{t.verification_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
          <SectionCard eyebrow="INCIDENCIAS" title="Incidencias de entrega">
            {(incidentsData.results || []).length === 0 ? <p style={{ fontSize: "13px", color: "var(--admin-text-muted)" }}>Sin incidencias abiertas.</p> : (
              <table className="lp-table" style={{ width: "100%" }}>
                <thead><tr><th>Envío</th><th>Tipo</th><th>Descripción</th><th>Estado</th></tr></thead>
                <tbody>
                  {incidentsData.results.map(i => (
                    <tr key={i.id}><td>{i.shipment_number}</td><td>{i.incident_type}</td><td>{i.description}</td><td><StatusBadge value={i.status} /></td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>
        </div>
      )}

      {tab === "warranties" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <SectionCard eyebrow="BF-22 · VALIDADOR DE SERIALES" title="Verificar cobertura por número de serie">
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input value={serialQuery} onChange={e => setSerialQuery(e.target.value)} placeholder="Ej: SN-G10-WAR-001" style={{ ...formInputStyle, maxWidth: "320px" }} />
              <PrimaryButton onClick={handleValidateSerial}><Search size={14} /> Validar serial</PrimaryButton>
            </div>
            {serialResult && (
              <div style={{ marginTop: "12px", padding: "12px", borderRadius: "10px", border: "1px solid var(--admin-border)", background: "var(--admin-surface-soft)", fontSize: "13px" }}>
                <strong>Resultado:</strong> <StatusBadge value={serialResult.status} /> · Tipo: <strong>{serialResult.warranty_type}</strong> · Venta verificada: <strong>{serialResult.verified_sale ? "Sí" : "No"}</strong>
              </div>
            )}
          </SectionCard>
          <SectionCard eyebrow="BF-22 · RECLAMOS" title="Garantías registradas">
            <table className="lp-table" style={{ width: "100%" }}>
              <thead><tr><th>Reclamo</th><th>Producto</th><th>Serial</th><th>Cobertura</th><th>RMA</th><th>Estado</th></tr></thead>
              <tbody>
                {(warrantiesData.results || []).map(w => (
                  <tr key={w.id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{w.claim_number}</td>
                    <td>{w.product_name}</td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{w.serial_number || "—"}</td>
                    <td><StatusBadge value={w.coverage_status} /></td>
                    <td>{w.rma_number || "—"}</td>
                    <td><StatusBadge value={w.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </div>
      )}

      {tab === "workshop" && (
        <SectionCard
          eyebrow="BF-43 · MESA DE SERVICIO TÉCNICO"
          title="Órdenes de trabajo de taller"
          action={<PrimaryButton onClick={() => setRepairModal(true)}><Plus size={14} /> Nueva orden taller</PrimaryButton>}
        >
          <table className="lp-table" style={{ width: "100%" }}>
            <thead><tr><th>OT</th><th>Equipo</th><th>Serial</th><th>Modalidad</th><th>Presupuesto</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {(repairsData.results || []).map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{r.work_order_number}</td>
                  <td>{r.equipment_brand} {r.equipment_model}</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{r.serial_number || "—"}</td>
                  <td>{r.service_mode}</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{r.budget_total} {r.budget_currency}</td>
                  <td><StatusBadge value={r.status} /></td>
                  <td style={{ display: "flex", gap: "6px" }}>
                    <SecondaryButton onClick={() => setDiagTarget(r)} style={{ padding: "4px 8px", fontSize: "11px" }}>Diagnóstico / Presupuesto</SecondaryButton>
                    {r.status !== "closed" && (
                      <PrimaryButton onClick={() => setDeliverTarget(r)} style={{ padding: "4px 8px", fontSize: "11px" }}><CheckCircle2 size={12} /> Entregar</PrimaryButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      )}

      <FormModal open={!!pkgTarget} title={`Registrar bulto — ${pkgTarget?.shipment_number || ""}`} onClose={() => setPkgTarget(null)} onSave={handleAddPkg} saving={saving}>
        <FormField label="Peso bruto (kg) *"><input type="number" value={pkgForm.gross_weight_kg} onChange={e => setPkgForm(p => ({ ...p, gross_weight_kg: e.target.value }))} style={formInputStyle} /></FormField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          <FormField label="Largo (cm)"><input type="number" value={pkgForm.length_cm} onChange={e => setPkgForm(p => ({ ...p, length_cm: e.target.value }))} style={formInputStyle} /></FormField>
          <FormField label="Ancho (cm)"><input type="number" value={pkgForm.width_cm} onChange={e => setPkgForm(p => ({ ...p, width_cm: e.target.value }))} style={formInputStyle} /></FormField>
          <FormField label="Alto (cm)"><input type="number" value={pkgForm.height_cm} onChange={e => setPkgForm(p => ({ ...p, height_cm: e.target.value }))} style={formInputStyle} /></FormField>
        </div>
        <FormField label="Contenido comercial"><input value={pkgForm.commercial_content} onChange={e => setPkgForm(p => ({ ...p, commercial_content: e.target.value }))} style={formInputStyle} /></FormField>
      </FormModal>

      <FormModal open={!!quoteTarget} title={`Cotizar courier — ${quoteTarget?.shipment_number || ""}`} onClose={() => setQuoteTarget(null)} onSave={handleQuote} saving={saving}>
        <FormField label="Transportista">
          <select value={quoteForm.carrier_id} onChange={e => { const c = carriers.find(x => x.id === e.target.value); setQuoteForm({ carrier_id: e.target.value, carrier_service_id: c?.services?.[0]?.id || "" }) }} style={formInputStyle}>
            {carriers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.country})</option>)}
          </select>
        </FormField>
        <FormField label="Servicio">
          <select value={quoteForm.carrier_service_id} onChange={e => setQuoteForm(p => ({ ...p, carrier_service_id: e.target.value }))} style={formInputStyle}>
            {(carriers.find(c => c.id === quoteForm.carrier_id)?.services || []).map(sv => <option key={sv.id} value={sv.id}>{sv.name}</option>)}
          </select>
        </FormField>
      </FormModal>

      <FormModal open={manifestModal} title="Nuevo manifiesto de despacho" onClose={() => setManifestModal(false)} onSave={handleCreateManifest} saving={saving}>
        <FormField label="Transportista">
          <select value={manifestCarrierId} onChange={e => setManifestCarrierId(e.target.value)} style={formInputStyle}>
            {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </FormField>
      </FormModal>

      <FormModal open={!!handoverTarget} title={`Confirmar retiro — ${handoverTarget?.manifest_number || ""}`} onClose={() => setHandoverTarget(null)} onSave={handleHandover} saving={saving}>
        <FormField label="Evidencia / N° retiro transportista *"><input value={handoverEvidence} onChange={e => setHandoverEvidence(e.target.value)} style={formInputStyle} /></FormField>
      </FormModal>

      <FormModal open={trackModal} title="Registrar evento de tracking" onClose={() => setTrackModal(false)} onSave={async () => { await recordLogisticsTracking(trackForm); refreshAll(); setTrackModal(false) }}>
        <FormField label="Envío">
          <select value={trackForm.shipment_id} onChange={e => setTrackForm(p => ({ ...p, shipment_id: e.target.value }))} style={formInputStyle}>
            {shipments.map(s => <option key={s.id} value={s.id}>{s.shipment_number}</option>)}
          </select>
        </FormField>
        <FormField label="Evento">
          <select value={trackForm.original_code} onChange={e => setTrackForm(p => ({ ...p, original_code: e.target.value }))} style={formInputStyle}>
            <option value="IN_TRANSIT">En tránsito</option>
            <option value="OUT_FOR_DELIVERY">En reparto</option>
            <option value="DELIVERED">Entregado</option>
            <option value="FAILED">Intento fallido</option>
          </select>
        </FormField>
        <FormField label="Ubicación"><input value={trackForm.location} onChange={e => setTrackForm(p => ({ ...p, location: e.target.value }))} style={formInputStyle} /></FormField>
      </FormModal>

      <FormModal open={repairModal} title="Nueva orden de taller" onClose={() => setRepairModal(false)} onSave={handleCreateRepair} saving={saving}>
        <FormField label="Marca"><input value={repairForm.equipment_brand} onChange={e => setRepairForm(p => ({ ...p, equipment_brand: e.target.value }))} style={formInputStyle} /></FormField>
        <FormField label="Modelo *"><input value={repairForm.equipment_model} onChange={e => setRepairForm(p => ({ ...p, equipment_model: e.target.value }))} style={formInputStyle} /></FormField>
        <FormField label="Serial"><input value={repairForm.serial_number} onChange={e => setRepairForm(p => ({ ...p, serial_number: e.target.value }))} style={formInputStyle} /></FormField>
        <FormField label="Síntomas reportados *"><textarea rows={2} value={repairForm.reported_symptoms} onChange={e => setRepairForm(p => ({ ...p, reported_symptoms: e.target.value }))} style={formInputStyle} /></FormField>
      </FormModal>

      <FormModal open={!!diagTarget} title={`Diagnóstico y presupuesto — ${diagTarget?.work_order_number || ""}`} onClose={() => setDiagTarget(null)} onSave={handleSaveDiagnosis} saving={saving}>
        <FormField label="Hallazgos técnicos *"><textarea rows={2} value={diagForm.technical_findings} onChange={e => setDiagForm(p => ({ ...p, technical_findings: e.target.value }))} style={formInputStyle} /></FormField>
        <FormField label="Trabajo propuesto *"><textarea rows={2} value={diagForm.proposed_work} onChange={e => setDiagForm(p => ({ ...p, proposed_work: e.target.value }))} style={formInputStyle} /></FormField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          <FormField label="Diagnóstico"><input type="number" value={diagForm.diagnostic_fee} onChange={e => setDiagForm(p => ({ ...p, diagnostic_fee: e.target.value }))} style={formInputStyle} /></FormField>
          <FormField label="Mano obra"><input type="number" value={diagForm.labor_fee} onChange={e => setDiagForm(p => ({ ...p, labor_fee: e.target.value }))} style={formInputStyle} /></FormField>
          <FormField label="Repuestos"><input type="number" value={diagForm.parts_fee} onChange={e => setDiagForm(p => ({ ...p, parts_fee: e.target.value }))} style={formInputStyle} /></FormField>
        </div>
      </FormModal>

      <FormModal open={!!deliverTarget} title={`Entregar equipo — ${deliverTarget?.work_order_number || ""}`} onClose={() => setDeliverTarget(null)} onSave={handleDeliverRepair} saving={saving}>
        <FormField label="Recibido por *"><input value={deliverForm.delivered_to_name} onChange={e => setDeliverForm(p => ({ ...p, delivered_to_name: e.target.value }))} style={formInputStyle} /></FormField>
        <FormField label="RUT / DNI"><input value={deliverForm.delivered_to_id} onChange={e => setDeliverForm(p => ({ ...p, delivered_to_id: e.target.value }))} style={formInputStyle} /></FormField>
      </FormModal>
    </div>
  )
}
