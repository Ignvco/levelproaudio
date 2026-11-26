import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Coins,
  Layers,
  Plus,
  ShieldCheck,
  TrendingUp,
} from "lucide-react"
import {
  AdminPageHeader,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
  StatCard,
  StatusBadge,
} from "../../components/admin/ui"
import api from "../../api/client"
import {
  approvePricingProposal,
  createLandedCostAllocation,
  createMarginPolicy,
  finalizeLandedCostAllocation,
  getCostLayersDashboard,
  getPricingMarginsReport,
  listGoodsReceipts,
  listLandedCostAllocations,
  listPricingProposals,
  listPurchaseOrders,
  runPricingSimulation,
} from "../../api/procurement.api"

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid var(--admin-border)",
  background: "#FFFFFF",
  color: "var(--admin-text)",
  fontSize: "13px",
}

const labelStyle = {
  display: "block",
  fontSize: "12px",
  fontWeight: 700,
  color: "var(--admin-text)",
  marginBottom: "4px",
}

const EXPENSE_CATEGORIES = [
  { value: "international_freight", label: "Flete internacional" },
  { value: "domestic_freight", label: "Flete nacional" },
  { value: "insurance", label: "Seguro de transporte" },
  { value: "customs_duty", label: "Aranceles aduaneros" },
  { value: "customs_broker", label: "Gastos de agente de aduana" },
  { value: "warehousing", label: "Almacenaje" },
  { value: "handling", label: "Manipulación" },
  { value: "non_recoverable_tax", label: "Impuesto no recuperable (Capitalizable)" },
  { value: "recoverable_tax", label: "Impuesto recuperable (No capitalizable)" },
  { value: "other_capitalizable", label: "Otros gastos capitalizables" },
]

const PRORATION_METHODS = [
  { value: "by_cif_value", label: "Proporcional al valor CIF" },
  { value: "by_weight", label: "Proporcional al peso" },
  { value: "by_quantity", label: "Proporcional a la cantidad" },
]

export default function AdminCostPricing() {
  const [tab, setTab] = useState("landed")
  const [banner, setBanner] = useState(null)
  const [currencyFilter, setCurrencyFilter] = useState("")
  const [skuSearch, setSkuSearch] = useState("")

  const qc = useQueryClient()

  const { data: landedData, isLoading: loadingLanded } = useQuery({
    queryKey: ["costing-landed-list"],
    queryFn: () => listLandedCostAllocations(),
  })
  const allocations = useMemo(() => landedData?.results || [], [landedData])

  const { data: layersData, isLoading: loadingLayers } = useQuery({
    queryKey: ["costing-layers", skuSearch, currencyFilter],
    queryFn: () =>
      getCostLayersDashboard({
        sku: skuSearch || undefined,
        currency: currencyFilter || undefined,
      }),
  })
  const layers = layersData?.layers || []
  const serialCosts = layersData?.serial_costs || []
  const weightedAverages = layersData?.weighted_averages || []
  const adjustments = layersData?.adjustments || []
  const fxSnapshots = layersData?.fx_snapshots || []

  const { data: marginsData, isLoading: loadingMargins } = useQuery({
    queryKey: ["pricing-margins", currencyFilter],
    queryFn: () => getPricingMarginsReport({ currency: currencyFilter || undefined }),
  })
  const skuMargins = marginsData?.sku_margins || []
  const brandReports = marginsData?.brand_reports || []
  const marginAlerts = marginsData?.margin_alerts || []
  const marginPolicies = marginsData?.policies || []

  const { data: proposalsData } = useQuery({
    queryKey: ["pricing-proposals"],
    queryFn: () => listPricingProposals(),
  })
  const proposals = proposalsData?.results || []

  const { data: poListData } = useQuery({
    queryKey: ["costing-pos"],
    queryFn: () => listPurchaseOrders(),
  })
  const pos = poListData?.results || []

  const { data: grListData } = useQuery({
    queryKey: ["costing-grs"],
    queryFn: () => listGoodsReceipts({ status: "confirmed" }),
  })
  const confirmedGrs = grListData?.results || []

  const { data: productsData } = useQuery({
    queryKey: ["costing-products"],
    queryFn: async () => {
      const res = await api.get("/admin/products/")
      return Array.isArray(res.data) ? res.data : res.data?.results || []
    },
  })
  const products = productsData || []

  // Formulario de asignación Landed Cost sobre recepción real
  const [lcForm, setLcForm] = useState({
    purchase_order_id: "",
    goods_receipt_id: "",
    valuation_currency: "USD",
    fx_rate: "",
    fx_source: "",
    is_late_adjustment: false,
    finalize: true,
    notes: "",
    expenses: [
      {
        category: "international_freight",
        proration_method: "by_weight",
        source_document_type: "BL",
        source_document_number: "BL-2026-001",
        amount: "90.00",
        currency: "USD",
        fx_rate: "",
        fx_source: "",
      },
      {
        category: "insurance",
        proration_method: "by_cif_value",
        source_document_type: "INVOICE",
        source_document_number: "INS-2026-001",
        amount: "40.00",
        currency: "USD",
        fx_rate: "",
        fx_source: "",
      },
      {
        category: "customs_duty",
        proration_method: "by_cif_value",
        source_document_type: "DUS",
        source_document_number: "DUS-2026-001",
        amount: "80.00",
        currency: "USD",
        fx_rate: "",
        fx_source: "",
      },
    ],
  })

  // Simulador de precios
  const [simForm, setSimForm] = useState({
    product_id: "",
    currency: "CLP",
    base_landed_cost: "",
    cost_currency: "CLP",
    fx_scenario_rate: "",
    target_margin_percent: "35.00",
    proposed_net_price: "",
    tax_rate_percent: "19.00",
    save_proposal: false,
    notes: "",
  })
  const [simResult, setSimResult] = useState(null)

  // Política de margen
  const [policyForm, setPolicyForm] = useState({
    name: "Política General Pro Audio",
    min_margin_percent: "20.00",
    target_margin_percent: "35.00",
  })

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["costing-landed-list"] })
    qc.invalidateQueries({ queryKey: ["costing-layers"] })
    qc.invalidateQueries({ queryKey: ["pricing-margins"] })
    qc.invalidateQueries({ queryKey: ["pricing-proposals"] })
  }

  const finalizeMut = useMutation({
    mutationFn: (allocId) => finalizeLandedCostAllocation(allocId),
    onSuccess: () => {
      setBanner({ type: "success", text: "Landed Cost finalizado e integrado en capas de costo, seriales y WAC." })
      refreshAll()
    },
    onError: (err) => {
      setBanner({ type: "error", text: err?.response?.data?.error || err.message })
    },
  })

  const approvePropMut = useMutation({
    mutationFn: (propId) => approvePricingProposal(propId),
    onSuccess: () => {
      setBanner({ type: "success", text: "Propuesta comercial aprobada y aplicada al precio del catálogo." })
      refreshAll()
    },
    onError: (err) => {
      setBanner({ type: "error", text: err?.response?.data?.error || err.message })
    },
  })

  const handleCreateLandedCost = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        purchase_order_id: lcForm.purchase_order_id,
        goods_receipt_id: lcForm.goods_receipt_id || undefined,
        valuation_currency: lcForm.valuation_currency,
        is_late_adjustment: lcForm.is_late_adjustment,
        finalize: lcForm.finalize,
        notes: lcForm.notes,
        po_fx:
          lcForm.fx_rate && lcForm.fx_source
            ? { rate: lcForm.fx_rate, rate_source: lcForm.fx_source }
            : undefined,
        expenses: lcForm.expenses.map((ex) => ({
          category: ex.category,
          proration_method: ex.proration_method,
          source_document_type: ex.source_document_type,
          source_document_number: ex.source_document_number,
          amount: ex.amount,
          currency: ex.currency,
          fx_rate: ex.fx_rate || undefined,
          fx_source: ex.fx_source || undefined,
        })),
      }
      const created = await createLandedCostAllocation(payload)
      setBanner({
        type: "success",
        text: `Asignación ${created.allocation_code} calculada (Total Landed: ${created.total_landed_cost} ${created.valuation_currency}).`,
      })
      refreshAll()
    } catch (err) {
      setBanner({ type: "error", text: err?.response?.data?.error || err.message })
    }
  }

  const handleRunSimulation = async (e) => {
    e.preventDefault()
    try {
      const res = await runPricingSimulation({
        product_id: simForm.product_id,
        currency: simForm.currency,
        base_landed_cost: simForm.base_landed_cost || undefined,
        cost_currency: simForm.cost_currency || simForm.currency,
        fx_scenario_rate: simForm.fx_scenario_rate || undefined,
        target_margin_percent: simForm.target_margin_percent || undefined,
        proposed_net_price: simForm.proposed_net_price || undefined,
        tax_rate_percent: simForm.tax_rate_percent || undefined,
        save_proposal: simForm.save_proposal,
        notes: simForm.notes,
      })
      setSimResult(res)
      setBanner({
        type: "success",
        text: simForm.save_proposal
          ? "Simulación ejecutada y guardada como propuesta comercial (catálogo intacto hasta confirmación)."
          : "Simulación ejecutada exitosamente (sin modificar precios públicos).",
      })
      refreshAll()
    } catch (err) {
      setBanner({ type: "error", text: err?.response?.data?.error || err.message })
    }
  }

  const handleCreatePolicy = async (e) => {
    e.preventDefault()
    try {
      await createMarginPolicy(policyForm)
      setBanner({ type: "success", text: "Política de margen mínimo y objetivo registrada." })
      refreshAll()
    } catch (err) {
      setBanner({ type: "error", text: err?.response?.data?.error || err.message })
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} data-testid="cost-pricing-page">
      <AdminPageHeader
        eyebrow="GATE 6 · BF-09 & BF-18"
        title="Inteligencia de Costos, Landed Cost y Rentabilidad"
        description="Prorrateo contable de internación (CIF / Peso), capas históricas de costos, costeo específico por serial, promedio ponderado móvil (WAC), márgenes reales y simulador de precios."
        actions={
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              style={{ ...inputStyle, width: "130px" }}
              data-testid="costing-currency-filter"
            >
              <option value="">Todas (CLP/USD/ARS)</option>
              <option value="CLP">CLP</option>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
        }
      />

      {banner && (
        <div
          data-testid="costing-banner"
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            background: banner.type === "error" ? "#FEF2F2" : "#ECFDF5",
            border: `1px solid ${banner.type === "error" ? "#FCA5A5" : "#6EE7B7"}`,
            color: banner.type === "error" ? "#991B1B" : "#0F7A38",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          {banner.text}
        </div>
      )}

      {/* Métricas ejecutivas Bento */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "14px" }}>
        <StatCard
          label="Asignaciones Landed Cost"
          value={allocations.length}
          hint={`${allocations.filter((a) => a.status === "finalized").length} finalizadas e inmutables`}
          icon={<Calculator size={16} />}
        />
        <StatCard
          label="Capas de Costo (BF-09)"
          value={layers.length}
          hint={`${serialCosts.length} unidades serializadas valorizadas`}
          icon={<Layers size={16} />}
        />
        <StatCard
          label="Pools Promedio Ponderado"
          value={weightedAverages.length}
          hint="Segregación estricta por SKU y divisa"
          icon={<Coins size={16} />}
        />
        <StatCard
          label="Alertas Margen Mínimo"
          value={marginAlerts.length}
          hint="SKUs bajo umbral de seguridad"
          icon={<AlertTriangle size={16} />}
        />
      </div>

      {/* Navegación por pestañas */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--admin-border)", paddingBottom: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setTab("landed")}
          data-testid="tab-btn-landed"
          className={`au-btn ${tab === "landed" ? "au-btn--primary" : "au-btn--secondary"}`}
        >
          Calculadora Landed Cost (BF-18)
        </button>
        <button
          type="button"
          onClick={() => setTab("layers")}
          data-testid="tab-btn-layers"
          className={`au-btn ${tab === "layers" ? "au-btn--primary" : "au-btn--secondary"}`}
        >
          Capas de Costos, Seriales y WAC (BF-09)
        </button>
        <button
          type="button"
          onClick={() => setTab("margins")}
          data-testid="tab-btn-margins"
          className={`au-btn ${tab === "margins" ? "au-btn--primary" : "au-btn--secondary"}`}
        >
          Rentabilidad por SKU, Marcas y Alertas
        </button>
        <button
          type="button"
          onClick={() => setTab("simulator")}
          data-testid="tab-btn-simulator"
          className={`au-btn ${tab === "simulator" ? "au-btn--primary" : "au-btn--secondary"}`}
        >
          Simulador de Precios y Propuestas
        </button>
      </div>

      {/* TAB 1: CALCULADORA LANDED COST & ASIGNACIONES */}
      {tab === "landed" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: "18px", alignItems: "start" }} data-testid="landed-cost-section">
          <SectionCard
            eyebrow="BF-18 / MOTOR DE INTERNACIÓN"
            title="Calcular y Asignar Landed Cost por Recepción"
          >
            <form onSubmit={handleCreateLandedCost} style={{ display: "flex", flexDirection: "column", gap: "12px" }} data-testid="landed-cost-form">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>Orden de Compra (PO) *</label>
                  <select
                    required
                    value={lcForm.purchase_order_id}
                    onChange={(e) => {
                      const poId = e.target.value
                      const foundPo = pos.find((p) => String(p.id) === String(poId))
                      const matchingGr = confirmedGrs.find((g) => String(g.purchase_order) === String(poId))
                      setLcForm((f) => ({
                        ...f,
                        purchase_order_id: poId,
                        goods_receipt_id: matchingGr ? matchingGr.id : "",
                        valuation_currency: foundPo ? foundPo.currency : f.valuation_currency,
                      }))
                    }}
                    style={inputStyle}
                    data-testid="select-lc-po"
                  >
                    <option value="">Seleccione PO...</option>
                    {pos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.po_number} — {p.supplier_name} ({p.currency})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Recepción Física (GoodsReceipt)</label>
                  <select
                    value={lcForm.goods_receipt_id}
                    onChange={(e) => setLcForm((f) => ({ ...f, goods_receipt_id: e.target.value }))}
                    style={inputStyle}
                    data-testid="select-lc-gr"
                  >
                    <option value="">Toda la orden / Recepción activa</option>
                    {confirmedGrs
                      .filter((g) => !lcForm.purchase_order_id || String(g.purchase_order) === String(lcForm.purchase_order_id))
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.receipt_number} ({g.po_number})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>Moneda Valuación</label>
                  <select
                    value={lcForm.valuation_currency}
                    onChange={(e) => setLcForm((f) => ({ ...f, valuation_currency: e.target.value }))}
                    style={inputStyle}
                    data-testid="select-lc-currency"
                  >
                    <option value="USD">USD</option>
                    <option value="CLP">CLP</option>
                    <option value="ARS">ARS</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tasa FX (si difiere de PO)</label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="Ej: 950.00"
                    value={lcForm.fx_rate}
                    onChange={(e) => setLcForm((f) => ({ ...f, fx_rate: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Fuente Tasa FX</label>
                  <input
                    placeholder="Ej: DUS Aduana #881"
                    value={lcForm.fx_source}
                    onChange={(e) => setLcForm((f) => ({ ...f, fx_source: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12.5px", fontWeight: 800, color: "var(--admin-text)" }}>
                    Gastos de Abastecimiento e Internación
                  </span>
                  <SecondaryButton
                    type="button"
                    size="sm"
                    onClick={() =>
                      setLcForm((f) => ({
                        ...f,
                        expenses: [
                          ...f.expenses,
                          {
                            category: "other_capitalizable",
                            proration_method: "by_cif_value",
                            source_document_type: "INVOICE",
                            source_document_number: `EXP-${f.expenses.length + 1}`,
                            amount: "50.00",
                            currency: f.valuation_currency,
                            fx_rate: "",
                            fx_source: "",
                          },
                        ],
                      }))
                    }
                  >
                    <Plus size={13} /> Agregar Gasto
                  </SecondaryButton>
                </div>

                {lcForm.expenses.map((exp, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
                      gap: "6px",
                      marginBottom: "8px",
                      padding: "8px",
                      background: "#F9FAFB",
                      borderRadius: "8px",
                      border: "1px solid var(--admin-border)",
                    }}
                  >
                    <select
                      value={exp.category}
                      onChange={(e) => {
                        const val = e.target.value
                        setLcForm((f) => ({
                          ...f,
                          expenses: f.expenses.map((x, i) => (i === idx ? { ...x, category: val } : x)),
                        }))
                      }}
                      style={inputStyle}
                    >
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={exp.proration_method}
                      onChange={(e) => {
                        const val = e.target.value
                        setLcForm((f) => ({
                          ...f,
                          expenses: f.expenses.map((x, i) => (i === idx ? { ...x, proration_method: val } : x)),
                        }))
                      }}
                      style={inputStyle}
                    >
                      {PRORATION_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={exp.amount}
                      onChange={(e) => {
                        const val = e.target.value
                        setLcForm((f) => ({
                          ...f,
                          expenses: f.expenses.map((x, i) => (i === idx ? { ...x, amount: val } : x)),
                        }))
                      }}
                      placeholder="Monto"
                      style={inputStyle}
                    />
                    <select
                      value={exp.currency}
                      onChange={(e) => {
                        const val = e.target.value
                        setLcForm((f) => ({
                          ...f,
                          expenses: f.expenses.map((x, i) => (i === idx ? { ...x, currency: val } : x)),
                        }))
                      }}
                      style={inputStyle}
                    >
                      <option value="USD">USD</option>
                      <option value="CLP">CLP</option>
                      <option value="ARS">ARS</option>
                    </select>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", fontWeight: 600, color: "var(--admin-text)" }}>
                  <input
                    type="checkbox"
                    checked={lcForm.finalize}
                    onChange={(e) => setLcForm((f) => ({ ...f, finalize: e.target.checked }))}
                  />
                  Finalizar inmediatamente en Capas y Seriales
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", fontWeight: 600, color: "var(--admin-text)" }}>
                  <input
                    type="checkbox"
                    checked={lcForm.is_late_adjustment}
                    onChange={(e) => setLcForm((f) => ({ ...f, is_late_adjustment: e.target.checked }))}
                  />
                  Gasto tardío posterior a recepción
                </label>
              </div>

              <PrimaryButton type="submit" data-testid="btn-submit-landed-cost">
                <Calculator size={15} /> Calcular y Registrar Landed Cost
              </PrimaryButton>
            </form>
          </SectionCard>

          <SectionCard
            eyebrow="HISTORIAL BF-18"
            title="Asignaciones de Landed Cost y Prorrateo por Partida"
          >
            {loadingLanded ? (
              <p style={{ fontSize: "13px", color: "var(--admin-text-muted)" }}>Cargando asignaciones...</p>
            ) : allocations.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--admin-text-muted)" }}>No hay cálculos de Landed Cost registrados.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }} data-testid="landed-allocations-list">
                {allocations.map((alloc) => (
                  <div
                    key={alloc.id}
                    style={{
                      padding: "14px",
                      borderRadius: "12px",
                      border: "1px solid var(--admin-border)",
                      background: "#FFFFFF",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <div>
                        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: "14px", color: "var(--admin-text)" }}>
                          {alloc.allocation_code}
                        </span>
                        <span style={{ marginLeft: "8px", fontSize: "12.5px", color: "var(--admin-text-muted)" }}>
                          PO: {alloc.po_number} {alloc.receipt_number ? `· Rec: ${alloc.receipt_number}` : ""}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <StatusBadge tone={alloc.status === "finalized" ? "success" : "warning"}>
                          {alloc.status === "finalized" ? "Finalizado" : "Validado"}
                        </StatusBadge>
                        {alloc.status !== "finalized" && (
                          <PrimaryButton
                            size="sm"
                            onClick={() => finalizeMut.mutate(alloc.id)}
                            data-testid={`btn-finalize-lc-${alloc.id}`}
                          >
                            <CheckCircle2 size={13} /> Finalizar
                          </PrimaryButton>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 110px), 1fr))", gap: "8px", fontSize: "12px", marginBottom: "10px", padding: "8px", background: "#F9FAFB", borderRadius: "8px" }}>
                      <div>
                        <strong style={{ color: "var(--admin-text)" }}>Base CIF:</strong>{" "}
                        <span style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>
                          {alloc.total_cif_base} {alloc.valuation_currency}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: "var(--admin-text)" }}>Gastos Cap.:</strong>{" "}
                        <span style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>
                          +{alloc.total_capitalizable_expenses} {alloc.valuation_currency}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: "var(--admin-text)" }}>Imp. Recup.:</strong>{" "}
                        <span style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>
                          {alloc.total_non_capitalizable_taxes} {alloc.valuation_currency}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: "var(--admin-text)" }}>Total Landed:</strong>{" "}
                        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 800, color: "#0F7A38" }}>
                          {alloc.total_landed_cost} {alloc.valuation_currency}
                        </span>
                      </div>
                    </div>

                    <div className="au-tscroll">
                    <table className="au-table" style={{ fontSize: "12px" }}>
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Cant.</th>
                          <th>Peso Total</th>
                          <th>CIF Total</th>
                          <th>Gastos Asignados</th>
                          <th>Landed Unitario</th>
                          <th>Landed Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(alloc.line_allocations || []).map((ln) => (
                          <tr key={ln.id}>
                            <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-text)" }}>{ln.sku_snapshot}</td>
                            <td style={{ color: "var(--admin-text)" }}>{ln.quantity_allocated}</td>
                            <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>{ln.total_weight_snapshot || "—"}</td>
                            <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>{ln.cif_base_total}</td>
                            <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>+{ln.allocated_expenses_total}</td>
                            <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "#0F7A38" }}>{ln.landed_unit_cost}</td>
                            <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-text)" }}>{ln.landed_total_cost}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* TAB 2: CAPAS DE COSTOS, SERIALES Y PROMEDIO PONDERADO */}
      {tab === "layers" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }} data-testid="cost-layers-section">
          <SectionCard
            eyebrow="BF-09 / CAPAS HISTÓRICAS DE COSTOS"
            title="Capas de Costos por Lote y Recepción (CostLayer)"
            action={
              <input
                value={skuSearch}
                onChange={(e) => setSkuSearch(e.target.value)}
                placeholder="Filtrar por SKU o serial..."
                style={{ ...inputStyle, width: "220px" }}
              />
            }
          >
            {loadingLayers ? (
              <p style={{ fontSize: "13px", color: "var(--admin-text-muted)" }}>Cargando capas...</p>
            ) : (
              <div style={{ overflowX: "auto" }} data-testid="cost-layers-table">
                <table className="au-table">
                  <thead>
                    <tr>
                      <th>Código Capa</th>
                      <th>SKU / Producto</th>
                      <th>Recepción / PO</th>
                      <th>Bodega</th>
                      <th>Método</th>
                      <th>Rec. / Disp. / Cons.</th>
                      <th>Costo Base</th>
                      <th>Gastos Unit.</th>
                      <th>Landed Unitario</th>
                      <th>Valor Remanente</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {layers.map((lyr) => (
                      <tr key={lyr.id}>
                        <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-text)" }}>{lyr.layer_code}</td>
                        <td style={{ color: "var(--admin-text)" }}>
                          <strong>{lyr.sku_snapshot}</strong> — {lyr.product_name}
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--admin-text)" }}>
                          {lyr.receipt_number || "—"} ({lyr.po_number || "—"})
                        </td>
                        <td style={{ color: "var(--admin-text)" }}>{lyr.warehouse_code}</td>
                        <td>
                          <StatusBadge tone={lyr.costing_method === "specific_serial" ? "info" : "neutral"}>
                            {lyr.costing_method === "specific_serial" ? "Serial Específico" : "Promedio Ponderado"}
                          </StatusBadge>
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>
                          {lyr.quantity_received} / <strong>{lyr.quantity_available}</strong> / {lyr.quantity_consumed}
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>
                          {lyr.base_unit_cost} {lyr.valuation_currency}
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>
                          +{lyr.unit_allocated_expense} {lyr.valuation_currency}
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", fontWeight: 800, color: "#0F7A38" }}>
                          {lyr.landed_unit_cost} {lyr.valuation_currency}
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>
                          {lyr.remaining_layer_value} {lyr.valuation_currency}
                        </td>
                        <td>
                          <StatusBadge tone={lyr.is_finalized ? "success" : "warning"}>
                            {lyr.status_display}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: "18px" }}>
            <SectionCard
              eyebrow="SECCIÓN 9 / IDENTIFICACIÓN ESPECÍFICA"
              title="Costeo Unitario por Número de Serie (SerialCostUnit)"
            >
              <div style={{ overflowX: "auto" }} data-testid="serial-costs-table">
                <table className="au-table">
                  <thead>
                    <tr>
                      <th>N° Serie</th>
                      <th>SKU</th>
                      <th>Capa</th>
                      <th>Costo Base</th>
                      <th>Gasto Landed</th>
                      <th>Costo Definitivo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serialCosts.map((sc) => (
                      <tr key={sc.id}>
                        <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-text)" }}>
                          {sc.serial_number_snapshot}
                        </td>
                        <td style={{ color: "var(--admin-text)" }}>{sc.product_name}</td>
                        <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>{sc.layer_code}</td>
                        <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>
                          {sc.base_unit_cost} {sc.valuation_currency}
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>
                          +{sc.allocated_expense}
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", fontWeight: 800, color: "#0F7A38" }}>
                          {sc.landed_unit_cost} {sc.valuation_currency}
                        </td>
                        <td>
                          <StatusBadge tone={sc.is_consumed ? "neutral" : sc.is_damaged ? "danger" : "success"}>
                            {sc.is_consumed ? "Consumido (Venta)" : sc.is_damaged ? "Dañado" : "En Stock"}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="SECCIÓN 10 / INVENTARIO FUNGIBLE"
              title="Promedio Ponderado Móvil (WAC) y Ajustes Tardíos"
            >
              <div style={{ overflowX: "auto", marginBottom: "14px" }} data-testid="wac-table">
                <table className="au-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Moneda</th>
                      <th>Vendibles / Dañadas</th>
                      <th>Costo Promedio Unit.</th>
                      <th>Valor Total Pool</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weightedAverages.map((w) => (
                      <tr key={w.id}>
                        <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-text)" }}>{w.sku_snapshot}</td>
                        <td style={{ fontWeight: 700, color: "var(--admin-text)" }}>{w.currency}</td>
                        <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>
                          {w.sellable_quantity} / {w.damaged_quantity} (Total: {w.total_quantity})
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", fontWeight: 800, color: "#0F7A38" }}>
                          {w.average_unit_cost} {w.currency}
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>
                          {w.total_value} {w.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {adjustments.length > 0 && (
                <div data-testid="late-adjustments-table">
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--admin-text)", marginBottom: "6px" }}>
                    Ajustes Versionados por Gastos Tardíos (Sección 11)
                  </div>
                  <table className="au-table" style={{ fontSize: "12px" }}>
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Capa</th>
                        <th>Capitalizado a Stock</th>
                        <th>Variación Consumidas</th>
                        <th>Nuevo Unitario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adjustments.map((adj) => (
                        <tr key={adj.id}>
                          <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{adj.adjustment_code}</td>
                          <td style={{ fontFamily: "var(--font-mono)" }}>{adj.layer_code}</td>
                          <td style={{ fontFamily: "var(--font-mono)" }}>+{adj.capitalized_to_inventory_amount} {adj.currency}</td>
                          <td style={{ fontFamily: "var(--font-mono)" }}>{adj.variance_on_consumed_amount} {adj.currency}</td>
                          <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{adj.new_unit_cost} {adj.currency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {fxSnapshots.length > 0 && (
                <div style={{ marginTop: "12px" }} data-testid="fx-snapshots-table">
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--admin-text)", marginBottom: "6px" }}>
                    Snapshots Multimoneda Congelados (Sección 8)
                  </div>
                  <table className="au-table" style={{ fontSize: "12px" }}>
                    <thead>
                      <tr>
                        <th>Par</th>
                        <th>Tasa</th>
                        <th>Fuente</th>
                        <th>Fecha Efectiva</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fxSnapshots.slice(0, 5).map((fx) => (
                        <tr key={fx.id}>
                          <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{fx.source_currency} → {fx.target_currency}</td>
                          <td style={{ fontFamily: "var(--font-mono)" }}>{fx.rate}</td>
                          <td>{fx.rate_source}</td>
                          <td style={{ fontFamily: "var(--font-mono)" }}>{fx.effective_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {/* TAB 3: RENTABILIDAD POR SKU, REPORTES POR MARCA Y ALERTAS DE MARGEN */}
      {tab === "margins" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }} data-testid="margins-report-section">
          {marginAlerts.length > 0 && (
            <SectionCard
              eyebrow="ALERTAS DE RENTABILIDAD"
              title={`Alertas de Margen Mínimo de Seguridad (${marginAlerts.length})`}
            >
              <div style={{ overflowX: "auto" }} data-testid="margin-alerts-table">
                <table className="au-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Producto</th>
                      <th>Marca</th>
                      <th>Costo Real Unit.</th>
                      <th>Precio Neto</th>
                      <th>Margen s/ Ventas (%)</th>
                      <th>Markup s/ Costo (%)</th>
                      <th>Mínimo Exigido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marginAlerts.map((al, i) => (
                      <tr key={`${al.sku}-${i}`} style={{ background: "#FEF2F2" }}>
                        <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "#991B1B" }}>{al.sku}</td>
                        <td style={{ color: "var(--admin-text)", fontWeight: 600 }}>{al.name}</td>
                        <td style={{ color: "var(--admin-text)" }}>{al.brand_name}</td>
                        <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>{al.unit_cost} {al.currency}</td>
                        <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>{al.sale_price} {al.currency}</td>
                        <td style={{ fontFamily: "var(--font-mono)", fontWeight: 800, color: "#991B1B" }}>{al.margin_on_sales_percent}%</td>
                        <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>{al.markup_on_cost_percent}%</td>
                        <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-text)" }}>{al.min_margin_threshold_percent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: "18px" }}>
            <SectionCard
              eyebrow="REPORTE EJECUTIVO POR MARCA"
              title="Rentabilidad Consolidada por Marca"
            >
              <div style={{ overflowX: "auto" }} data-testid="brand-margins-table">
                <table className="au-table">
                  <thead>
                    <tr>
                      <th>Marca</th>
                      <th>Moneda</th>
                      <th>SKUs Evaluados</th>
                      <th>Margen Promedio s/ Ventas</th>
                      <th>Markup Promedio s/ Costo</th>
                      <th>Alertas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brandReports.map((br, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700, color: "var(--admin-text)" }}>{br.brand_name}</td>
                        <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>{br.currency}</td>
                        <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>{br.sku_count}</td>
                        <td style={{ fontFamily: "var(--font-mono)", fontWeight: 800, color: "#0F7A38" }}>
                          {br.avg_margin_on_sales_percent}%
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>
                          {br.avg_markup_on_cost_percent}%
                        </td>
                        <td>
                          <StatusBadge tone={br.alerts_count > 0 ? "danger" : "success"}>
                            {br.alerts_count} alertas
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="GOBERNANZA DE MÁRGENES"
              title="Políticas de Margen Mínimo y Objetivo"
            >
              <form onSubmit={handleCreatePolicy} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: "8px", alignItems: "end", marginBottom: "12px" }}>
                <div>
                  <label style={labelStyle}>Nombre Política</label>
                  <input
                    required
                    value={policyForm.name}
                    onChange={(e) => setPolicyForm((f) => ({ ...f, name: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Mínimo (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={policyForm.min_margin_percent}
                    onChange={(e) => setPolicyForm((f) => ({ ...f, min_margin_percent: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Objetivo (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={policyForm.target_margin_percent}
                    onChange={(e) => setPolicyForm((f) => ({ ...f, target_margin_percent: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <SecondaryButton type="submit" size="sm">Guardar</SecondaryButton>
              </form>
              <div style={{ fontSize: "12px", color: "var(--admin-text)" }}>
                {marginPolicies.map((p) => (
                  <div key={p.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--admin-border)", display: "flex", justifyContent: "space-between" }}>
                    <strong>{p.name}</strong>
                    <span style={{ fontFamily: "var(--font-mono)" }}>Mín: {p.min_margin_percent}% · Obj: {p.target_margin_percent}%</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <SectionCard
            eyebrow="SECCIÓN 12 / MATRIZ DE RENTABILIDAD REAL"
            title="Rentabilidad por SKU (Margen sobre Ventas vs Markup sobre Costo)"
          >
            {loadingMargins ? (
              <p style={{ fontSize: "13px", color: "var(--admin-text-muted)" }}>Calculando márgenes...</p>
            ) : (
              <div style={{ overflowX: "auto" }} data-testid="sku-margins-table">
                <table className="au-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Producto / Variante</th>
                      <th>Marca</th>
                      <th>Fuente Costo</th>
                      <th>Costo Unitario</th>
                      <th>Precio Venta Neto</th>
                      <th>Margen Bruto ($)</th>
                      <th>Margen s/ Ventas (%)</th>
                      <th>Markup s/ Costo (%)</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skuMargins.map((m, idx) => (
                      <tr key={`${m.sku}-${m.currency}-${idx}`}>
                        <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-text)" }}>{m.sku}</td>
                        <td style={{ color: "var(--admin-text)" }}>{m.name}</td>
                        <td style={{ color: "var(--admin-text)" }}>{m.brand_name}</td>
                        <td style={{ fontSize: "12px", color: "var(--admin-text)" }}>{m.cost_source || "Sin costo"}</td>
                        <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>
                          {m.unit_cost ? `${m.unit_cost} ${m.currency}` : "—"}
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>
                          {m.sale_price ? `${m.sale_price} ${m.currency}` : "—"}
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-text)" }}>
                          {m.gross_margin_unit ? `${m.gross_margin_unit} ${m.currency}` : "—"}
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", fontWeight: 800, color: m.below_min_margin ? "#991B1B" : "#0F7A38" }}>
                          {m.margin_on_sales_percent !== null ? `${m.margin_on_sales_percent}%` : "Pendiente"}
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>
                          {m.markup_on_cost_percent !== null ? `${m.markup_on_cost_percent}%` : "Pendiente"}
                        </td>
                        <td>
                          {m.status === "pending_calculation" ? (
                            <StatusBadge tone="warning">Pendiente de cálculo</StatusBadge>
                          ) : m.below_min_margin ? (
                            <StatusBadge tone="danger">Bajo Margen Mínimo</StatusBadge>
                          ) : (
                            <StatusBadge tone="success">Saludable</StatusBadge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* TAB 4: SIMULADOR DE PRECIOS Y PROPUESTAS COMERCIALES */}
      {tab === "simulator" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: "18px", alignItems: "start" }} data-testid="pricing-simulator-section">
          <SectionCard
            eyebrow="SECCIÓN 14 / SIMULADOR COMERCIAL"
            title="Simulador de Precios, Márgenes y Escenarios FX"
          >
            <form onSubmit={handleRunSimulation} style={{ display: "flex", flexDirection: "column", gap: "12px" }} data-testid="pricing-simulator-form">
              <div>
                <label style={labelStyle}>Producto *</label>
                <select
                  required
                  value={simForm.product_id}
                  onChange={(e) => setSimForm((f) => ({ ...f, product_id: e.target.value }))}
                  style={inputStyle}
                  data-testid="select-sim-product"
                >
                  <option value="">Seleccione producto...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>Moneda Objetivo</label>
                  <select
                    value={simForm.currency}
                    onChange={(e) => setSimForm((f) => ({ ...f, currency: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="CLP">CLP</option>
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Landed Cost Base (opcional)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Usa WAC/Capa si vacío"
                    value={simForm.base_landed_cost}
                    onChange={(e) => setSimForm((f) => ({ ...f, base_landed_cost: e.target.value }))}
                    style={inputStyle}
                    data-testid="input-sim-cost"
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>Margen Objetivo (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={simForm.target_margin_percent}
                    onChange={(e) => setSimForm((f) => ({ ...f, target_margin_percent: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Precio Neto Propuesto</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Auto según objetivo"
                    value={simForm.proposed_net_price}
                    onChange={(e) => setSimForm((f) => ({ ...f, proposed_net_price: e.target.value }))}
                    style={inputStyle}
                    data-testid="input-sim-price"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Escenario Tasa FX</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ej: 960.00"
                    value={simForm.fx_scenario_rate}
                    onChange={(e) => setSimForm((f) => ({ ...f, fx_scenario_rate: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", fontWeight: 600, color: "var(--admin-text)" }}>
                <input
                  type="checkbox"
                  checked={simForm.save_proposal}
                  onChange={(e) => setSimForm((f) => ({ ...f, save_proposal: e.target.checked }))}
                />
                Registrar como Propuesta Comercial formal (requiere aprobación para aplicar al catálogo)
              </label>

              <PrimaryButton type="submit" data-testid="btn-run-simulation">
                <TrendingUp size={15} /> Simular Escenario (Sin mutar catálogo)
              </PrimaryButton>
            </form>

            {simResult && (
              <div
                data-testid="simulation-result-card"
                style={{
                  marginTop: "14px",
                  padding: "14px",
                  borderRadius: "10px",
                  background: "#F0FDF4",
                  border: "1px solid #86EFAC",
                  fontSize: "12.5px",
                  color: "#064E3B",
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: "8px" }}>
                  Resultado Simulación: {simResult.sku} — {simResult.product_name}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  <div>Costo Base Landed: <strong>{simResult.base_landed_cost} {simResult.currency}</strong></div>
                  <div>Precio Catálogo Actual: <strong>{simResult.current_catalog_price} {simResult.currency}</strong></div>
                  <div>Precio Mínimo Seguro: <strong>{simResult.min_safe_net_price} {simResult.currency}</strong></div>
                  <div>Precio Neto Simulado: <strong>{simResult.simulated_net_price} {simResult.currency}</strong></div>
                  <div>Margen s/ Ventas: <strong>{simResult.projected_margin_on_sales_percent}%</strong></div>
                  <div>Markup s/ Costo: <strong>{simResult.projected_markup_on_cost_percent}%</strong></div>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            eyebrow="GOBERNANZA DE PRECIOS"
            title="Propuestas Comerciales de Precios (Confirmación Explícita)"
          >
            <div style={{ overflowX: "auto" }} data-testid="pricing-proposals-table">
              <table className="au-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Costo Landed</th>
                    <th>Precio Actual</th>
                    <th>Precio Propuesto</th>
                    <th>Margen / Markup</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((pr) => (
                    <tr key={pr.id}>
                      <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-text)" }}>{pr.sku}</td>
                      <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>{pr.base_landed_cost} {pr.currency}</td>
                      <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>{pr.current_net_price} {pr.currency}</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontWeight: 800, color: "#0F7A38" }}>{pr.proposed_net_price} {pr.currency}</td>
                      <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>
                        {pr.projected_margin_percent}% / {pr.projected_markup_percent}%
                      </td>
                      <td>
                        <StatusBadge tone={pr.status === "approved_applied" ? "success" : "warning"}>
                          {pr.status_display}
                        </StatusBadge>
                      </td>
                      <td>
                        {pr.status === "proposed" && (
                          <PrimaryButton
                            size="sm"
                            onClick={() => approvePropMut.mutate(pr.id)}
                            data-testid={`btn-approve-proposal-${pr.id}`}
                          >
                            <ShieldCheck size={13} /> Aprobar y Aplicar
                          </PrimaryButton>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  )
}
