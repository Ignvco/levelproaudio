// components/admin/Gate9FinancePanels.jsx
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  CheckCircle2, XCircle, AlertTriangle, Landmark, FileSpreadsheet,
  ArrowLeftRight, Receipt, CreditCard, TrendingUp, Download, FileCheck2, Eye,
} from "lucide-react"
import {
  SectionCard, PrimaryButton, SecondaryButton, FormModal, FormField, formInputStyle,
} from "./ui"
import { showToast } from "../../utils/toast"
import { formatCurrency } from "../../utils/accountingCurrency"
import {
  getFinanceReconciliation, postFinanceReconciliation,
  getTreasuryAccounts, createTreasuryAccount, postInternalTransfer,
  importBankStatement, getBankTransactions,
  getAccountsReceivable, getArAging, allocateReceivable,
  getAccountsPayable, payAccountPayable,
  getCashFlowProjection, downloadAccountingExportCsv,
} from "../../api/admin.api"

const fmt = (n, currency = "CLP") => formatCurrency(n, currency)

const badgeStyle = (bg, color) => ({
  display: "inline-flex", alignItems: "center", gap: "4px",
  padding: "3px 9px", borderRadius: "999px", fontSize: "11px", fontWeight: 700,
  background: bg, color,
})

const STATUS_BADGE = {
  APPROVED: badgeStyle("#dcfce7", "#166534"),
  PAID: badgeStyle("#dcfce7", "#166534"),
  SETTLED: badgeStyle("#dcfce7", "#166534"),
  RECONCILED: badgeStyle("#dcfce7", "#166534"),
  PARTIAL: badgeStyle("#fef9c3", "#854d0e"),
  PARTIALLY_PAID: badgeStyle("#fef9c3", "#854d0e"),
  PARTIALLY_RECONCILED: badgeStyle("#fef9c3", "#854d0e"),
  IN_REVIEW: badgeStyle("#e0f2fe", "#075985"),
  PENDING: badgeStyle("#f1f5f9", "#475569"),
  OPEN: badgeStyle("#e0f2fe", "#075985"),
  OVERDUE: badgeStyle("#fee2e2", "#991b1b"),
  REJECTED: badgeStyle("#fee2e2", "#991b1b"),
  UNRECONCILED: badgeStyle("#f1f5f9", "#475569"),
  INTERNAL_TRANSFER: badgeStyle("#ede9fe", "#5b21b6"),
  APPROVED_FOR_PAYMENT: badgeStyle("#e0f2fe", "#075985"),
}

function StatusPill({ status }) {
  const key = String(status || "").toUpperCase()
  return <span style={STATUS_BADGE[key] || STATUS_BADGE.PENDING}>{status}</span>
}

// ── 1. BF-24: CONCILIACIÓN BANCARIA ───────────────────────────────────────
export function ReconciliationPanel({ currency }) {
  const qc = useQueryClient()
  const [selectedPay, setSelectedPay] = useState(null)
  const [receiptModal, setReceiptModal] = useState(null)
  const [form, setForm] = useState({
    decision: "approved",
    bank_transaction_id: "",
    reconciled_amount: "",
    bank_reference: "",
    manual_exception_reason: "",
  })
  const [saving, setSaving] = useState(false)

  const { data = { pending_payments: [], reconciliations: [] }, isLoading } = useQuery({
    queryKey: ["g9-reconciliation", currency],
    queryFn: () => getFinanceReconciliation({ currency }),
  })
  const { data: txData = { results: [] } } = useQuery({
    queryKey: ["g9-bank-txs-unreconciled", currency],
    queryFn: () => getBankTransactions({ currency }),
  })

  const availableTxs = (txData.results || []).filter(
    t => String(t.direction || "").toLowerCase() === "credit" && Number(t.unallocated_amount) > 0
  )

  const handleOpenReconcile = (p) => {
    setSelectedPay(p)
    setForm({
      decision: "approved",
      bank_transaction_id: availableTxs[0]?.id || "",
      reconciled_amount: p.expected_amount,
      bank_reference: p.provider_reference || "",
      manual_exception_reason: "",
    })
  }

  const handleSubmit = async () => {
    if (!selectedPay) return
    setSaving(true)
    try {
      await postFinanceReconciliation({
        payment_id: selectedPay.payment_id,
        decision: form.decision,
        bank_transaction_id: form.bank_transaction_id || undefined,
        reconciled_amount: form.reconciled_amount ? Number(form.reconciled_amount) : undefined,
        bank_reference: form.bank_reference,
        manual_exception_reason: form.manual_exception_reason,
        idempotency_key: `UI-REC-${selectedPay.payment_id}-${Date.now()}`,
      })
      showToast("Conciliación bancaria registrada", "success")
      qc.invalidateQueries({ queryKey: ["g9-reconciliation"] })
      qc.invalidateQueries({ queryKey: ["g9-bank-txs-unreconciled"] })
      qc.invalidateQueries({ queryKey: ["admin-finance-summary"] })
      setSelectedPay(null)
    } catch (e) {
      showToast(e?.response?.data?.error || "No se pudo conciliar el pago", "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <SectionCard
        eyebrow="BF-24 · CONCILIACIÓN BANCARIA"
        title="Cola de transferencias y pagos por conciliar"
        description={`Validación contra movimientos bancarios reales en ${currency}. Un comprobante por sí solo no aprueba fondos.`}
      >
        {isLoading ? <p>Cargando cola...</p> : (data.pending_payments || []).length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--admin-text-muted)" }}>
            Sin transferencias pendientes de conciliación en {currency}.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="lp-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Orden</th><th>Cliente</th><th>Método</th><th>Monto</th><th>Ref. / Comprobante</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.pending_payments.map(p => (
                  <tr key={p.payment_id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>#{p.order_short}</td>
                    <td>{p.customer_email || "—"}</td>
                    <td>{p.provider}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{fmt(p.expected_amount, p.currency)}</td>
                    <td>
                      <span style={{ fontSize: "12px", marginRight: "8px" }}>{p.provider_reference || "Sin ref."}</span>
                      {p.has_receipt && (
                        <SecondaryButton onClick={() => setReceiptModal(p)} style={{ padding: "3px 8px", fontSize: "11px" }}>
                          <Eye size={12} /> Comprobante
                        </SecondaryButton>
                      )}
                    </td>
                    <td><StatusPill status={p.status} /></td>
                    <td>
                      <PrimaryButton onClick={() => handleOpenReconcile(p)} style={{ padding: "5px 10px", fontSize: "12px" }}>
                        Conciliar
                      </PrimaryButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard eyebrow="TRAZABILIDAD" title="Historial reciente de conciliaciones">
        {(data.reconciliations || []).length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--admin-text-muted)" }}>Sin conciliaciones registradas todavía.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="lp-table" style={{ width: "100%" }}>
              <thead>
                <tr><th>Estado</th><th>Esperado</th><th>Conciliado</th><th>Ref. Bancaria</th><th>Fecha Banco</th><th>Revisado por</th></tr>
              </thead>
              <tbody>
                {data.reconciliations.map(r => (
                  <tr key={r.id}>
                    <td><StatusPill status={r.status} /></td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{fmt(r.expected_amount, r.currency)}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{fmt(r.reconciled_amount, r.currency)}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>{r.bank_reference || "—"}</td>
                    <td>{r.effective_bank_date || "—"}</td>
                    <td style={{ fontSize: "12px" }}>{r.reviewed_by_email || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <FormModal
        open={!!selectedPay}
        title={`Conciliar pago #${selectedPay?.order_short || ""}`}
        onClose={() => setSelectedPay(null)}
        onSave={handleSubmit}
        saving={saving}
        maxWidth="520px"
        testId="reconcile-payment-modal"
      >
        <FormField label="Decisión">
          <select value={form.decision} onChange={e => setForm(p => ({ ...p, decision: e.target.value }))} style={formInputStyle}>
            <option value="approved">Aprobar conciliación total</option>
            <option value="partial">Aprobar abono parcial</option>
            <option value="rejected">Rechazar pago</option>
          </select>
        </FormField>
        {form.decision !== "rejected" && (
          <>
            <FormField label="Movimiento bancario verificado (cartola)">
              <select value={form.bank_transaction_id} onChange={e => setForm(p => ({ ...p, bank_transaction_id: e.target.value }))} style={formInputStyle}>
                <option value="">-- Sin movimiento (requiere excepción manual) --</option>
                {availableTxs.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.effective_date} · {t.account_code} · {fmt(t.unallocated_amount, t.currency)} disp. ({t.reference})
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Monto conciliado">
              <input type="number" value={form.reconciled_amount} onChange={e => setForm(p => ({ ...p, reconciled_amount: e.target.value }))} style={formInputStyle} />
            </FormField>
          </>
        )}
        <FormField label="Referencia bancaria">
          <input value={form.bank_reference} onChange={e => setForm(p => ({ ...p, bank_reference: e.target.value }))} style={formInputStyle} placeholder="Ej: TRF-99812" />
        </FormField>
        {(!form.bank_transaction_id || form.decision === "rejected") && (
          <FormField label="Motivo excepción / rechazo *">
            <textarea rows={2} value={form.manual_exception_reason} onChange={e => setForm(p => ({ ...p, manual_exception_reason: e.target.value }))} style={formInputStyle} />
          </FormField>
        )}
      </FormModal>

      <FormModal
        open={!!receiptModal}
        title={`Comprobante declarado #${receiptModal?.order_short || ""}`}
        onClose={() => setReceiptModal(null)}
        onSave={() => setReceiptModal(null)}
        maxWidth="460px"
      >
        <p style={{ fontSize: "13px", color: "var(--admin-text-secondary)" }}>
          Cliente: <strong>{receiptModal?.customer_email}</strong><br />
          Monto declarado: <strong>{receiptModal ? fmt(receiptModal.expected_amount, receiptModal.currency) : ""}</strong><br />
          Referencia declarada: <code>{receiptModal?.provider_reference || "Sin referencia"}</code>
        </p>
        <div className="lp-callout lp-callout--warning" style={{ marginTop: "10px", fontSize: "12px" }}>
          Solo evidencia declarativa. Verifica el abono real en Tesorería antes de aprobar.
        </div>
      </FormModal>
    </div>
  )
}

// ── 2. BF-38: TESORERÍA MULTI-CUENTA & CARTOLAS ───────────────────────────
export function TreasuryPanel({ currency }) {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [acctForm, setAcctForm] = useState({ code: "", bank_name: "", account_holder: "LevelPro Audio SpA", account_number: "", country: "CL", opening_balance: "0" })
  const [txForm, setTxForm] = useState({ source_account_id: "", target_account_id: "", amount: "", effective_date: new Date().toISOString().slice(0, 10), reference: "" })
  const [importForm, setImportForm] = useState({ financial_account_id: "", file: null })
  const [saving, setSaving] = useState(false)

  const { data: acctsData = { results: [] } } = useQuery({
    queryKey: ["g9-treasury-accounts", currency],
    queryFn: () => getTreasuryAccounts({ currency }),
  })
  const { data: txsData = { results: [] } } = useQuery({
    queryKey: ["g9-bank-txs", currency],
    queryFn: () => getBankTransactions({ currency }),
  })

  const accounts = acctsData.results || []

  const handleCreateAccount = async () => {
    setSaving(true)
    try {
      await createTreasuryAccount({ ...acctForm, currency })
      showToast("Cuenta de tesorería creada", "success")
      qc.invalidateQueries({ queryKey: ["g9-treasury-accounts"] })
      setModal(null)
    } catch (e) {
      showToast(e?.response?.data?.error || "Error creando cuenta", "error")
    } finally { setSaving(false) }
  }

  const handleTransfer = async () => {
    setSaving(true)
    try {
      await postInternalTransfer(txForm)
      showToast("Traspaso interno registrado", "success")
      qc.invalidateQueries({ queryKey: ["g9-treasury-accounts"] })
      qc.invalidateQueries({ queryKey: ["g9-bank-txs"] })
      setModal(null)
    } catch (e) {
      showToast(e?.response?.data?.error || "Error en traspaso interno", "error")
    } finally { setSaving(false) }
  }

  const handleImportCsv = async () => {
    if (!importForm.financial_account_id || !importForm.file) {
      showToast("Selecciona cuenta y archivo CSV", "error")
      return
    }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append("financial_account_id", importForm.financial_account_id)
      fd.append("file", importForm.file)
      await importBankStatement(fd)
      showToast("Cartola CSV importada y validada", "success")
      qc.invalidateQueries({ queryKey: ["g9-treasury-accounts"] })
      qc.invalidateQueries({ queryKey: ["g9-bank-txs"] })
      setModal(null)
    } catch (e) {
      showToast(e?.response?.data?.error || "Error importando cartola", "error")
    } finally { setSaving(false) }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <SectionCard
        eyebrow="BF-38 · TESORERÍA MULTI-CUENTA"
        title={`Cuentas bancarias verificadas (${currency})`}
        description="Aislamiento estricto por moneda. Los saldos reflejan únicamente cartolas y traspasos verificados."
        action={
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <SecondaryButton onClick={() => setModal("import")}><FileSpreadsheet size={14} /> Importar cartola CSV</SecondaryButton>
            <SecondaryButton onClick={() => setModal("transfer")} disabled={accounts.length < 2}><ArrowLeftRight size={14} /> Traspaso interno</SecondaryButton>
            <PrimaryButton onClick={() => setModal("create")}><Landmark size={14} /> Nueva cuenta</PrimaryButton>
          </div>
        }
      >
        {accounts.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--admin-text-muted)" }}>No hay cuentas registradas en {currency}.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px" }}>
            {accounts.map(a => (
              <div key={a.id} style={{ padding: "14px", borderRadius: "12px", border: "1px solid var(--admin-border)", background: "var(--admin-surface-soft)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "14px" }}>{a.code}</strong>
                  <StatusPill status={a.operational_status} />
                </div>
                <p style={{ fontSize: "12px", color: "var(--admin-text-secondary)", margin: "4px 0 10px" }}>
                  {a.bank_name} · {a.account_number_masked}
                </p>
                <div style={{ fontSize: "12px", display: "flex", justifyContent: "space-between" }}>
                  <span>Saldo libro:</span>
                  <strong style={{ fontFamily: "var(--font-mono)" }}>{fmt(a.reported_balance ?? a.ledger_balance ?? 0, a.currency)}</strong>
                </div>
                <div style={{ fontSize: "12px", display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                  <span>Saldo conciliado:</span>
                  <strong style={{ fontFamily: "var(--font-mono)", color: "var(--admin-primary)" }}>{fmt(a.reconciled_balance, a.currency)}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard eyebrow="MOVIMIENTOS" title="Cartola bancaria importada">
        <div style={{ overflowX: "auto" }}>
          <table className="lp-table" style={{ width: "100%" }}>
            <thead>
              <tr><th>Fecha</th><th>Cuenta</th><th>Tipo</th><th>Monto</th><th>Disponible</th><th>Referencia</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {(txsData.results || []).map(tx => (
                <tr key={tx.id}>
                  <td>{tx.effective_date}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{tx.account_code}</td>
                  <td>{tx.direction}</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{fmt(tx.amount, tx.currency)}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{fmt(tx.unallocated_amount, tx.currency)}</td>
                  <td>{tx.reference || tx.description}</td>
                  <td><StatusPill status={tx.reconciliation_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <FormModal open={modal === "create"} title={`Nueva cuenta (${currency})`} onClose={() => setModal(null)} onSave={handleCreateAccount} saving={saving}>
        <FormField label="Código interno *"><input value={acctForm.code} onChange={e => setAcctForm(p => ({ ...p, code: e.target.value }))} style={formInputStyle} placeholder="Ej: BCI-CLP-01" /></FormField>
        <FormField label="Banco *"><input value={acctForm.bank_name} onChange={e => setAcctForm(p => ({ ...p, bank_name: e.target.value }))} style={formInputStyle} placeholder="Banco BCI" /></FormField>
        <FormField label="Número de cuenta"><input value={acctForm.account_number} onChange={e => setAcctForm(p => ({ ...p, account_number: e.target.value }))} style={formInputStyle} /></FormField>
        <FormField label="Saldo inicial verificado"><input type="number" value={acctForm.opening_balance} onChange={e => setAcctForm(p => ({ ...p, opening_balance: e.target.value }))} style={formInputStyle} /></FormField>
      </FormModal>

      <FormModal open={modal === "transfer"} title="Traspaso interno entre cuentas" onClose={() => setModal(null)} onSave={handleTransfer} saving={saving}>
        <FormField label="Cuenta origen">
          <select value={txForm.source_account_id} onChange={e => setTxForm(p => ({ ...p, source_account_id: e.target.value }))} style={formInputStyle}>
            <option value="">-- Seleccionar --</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.code} ({a.bank_name})</option>)}
          </select>
        </FormField>
        <FormField label="Cuenta destino">
          <select value={txForm.target_account_id} onChange={e => setTxForm(p => ({ ...p, target_account_id: e.target.value }))} style={formInputStyle}>
            <option value="">-- Seleccionar --</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.code} ({a.bank_name})</option>)}
          </select>
        </FormField>
        <FormField label="Monto"><input type="number" value={txForm.amount} onChange={e => setTxForm(p => ({ ...p, amount: e.target.value }))} style={formInputStyle} /></FormField>
        <FormField label="Referencia *"><input value={txForm.reference} onChange={e => setTxForm(p => ({ ...p, reference: e.target.value }))} style={formInputStyle} /></FormField>
      </FormModal>

      <FormModal open={modal === "import"} title="Importar cartola CSV (SHA-256)" onClose={() => setModal(null)} onSave={handleImportCsv} saving={saving}>
        <FormField label="Cuenta bancaria">
          <select value={importForm.financial_account_id} onChange={e => setImportForm(p => ({ ...p, financial_account_id: e.target.value }))} style={formInputStyle}>
            <option value="">-- Seleccionar --</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.code} · {a.bank_name}</option>)}
          </select>
        </FormField>
        <FormField label="Archivo CSV (fecha,monto,direccion,referencia,descripcion)">
          <input type="file" accept=".csv" onChange={e => setImportForm(p => ({ ...p, file: e.target.files?.[0] || null }))} style={formInputStyle} />
        </FormField>
      </FormModal>
    </div>
  )
}

// ── 3. BF-36: CUENTAS POR COBRAR (AR) & AGING ────────────────────────────
export function AccountsReceivablePanel({ currency }) {
  const qc = useQueryClient()
  const [allocTarget, setAllocTarget] = useState(null)
  const [allocForm, setAllocForm] = useState({ allocation_type: "payment", amount: "", reference: "" })
  const [saving, setSaving] = useState(false)

  const { data: arData = { results: [] } } = useQuery({
    queryKey: ["g9-ar", currency],
    queryFn: () => getAccountsReceivable({ currency }),
  })
  const { data: aging = { buckets: {} } } = useQuery({
    queryKey: ["g9-ar-aging", currency],
    queryFn: () => getArAging(currency),
  })

  const handleAllocate = async () => {
    if (!allocTarget) return
    setSaving(true)
    try {
      await allocateReceivable(allocTarget.id, { ...allocForm, amount: Number(allocForm.amount) })
      showToast("Abono/ajuste aplicado a CxC", "success")
      qc.invalidateQueries({ queryKey: ["g9-ar"] })
      qc.invalidateQueries({ queryKey: ["g9-ar-aging"] })
      setAllocTarget(null)
    } catch (e) {
      showToast(e?.response?.data?.error || "Error aplicando abono", "error")
    } finally { setSaving(false) }
  }

  const b = aging.buckets || {}

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <SectionCard eyebrow="BF-36 · AGING DE CARTERA" title={`Antigüedad de saldos por cobrar (${currency})`}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px" }}>
          {[
            { k: "upcoming", alt: "current", label: "Vigente" },
            { k: "days_1_30", alt: "1_30", label: "1-30 días" },
            { k: "days_31_60", alt: "31_60", label: "31-60 días" },
            { k: "days_61_90", alt: "61_90", label: "61-90 días" },
            { k: "days_90_plus", alt: "over_90", label: "+90 días" },
          ].map(item => (
            <div key={item.k} style={{ padding: "12px", borderRadius: "10px", border: "1px solid var(--admin-border)", background: "var(--admin-surface-soft)" }}>
              <div style={{ fontSize: "11px", color: "var(--admin-text-muted)", fontWeight: 700 }}>{item.label}</div>
              <div style={{ fontSize: "15px", fontWeight: 700, fontFamily: "var(--font-mono)", marginTop: "4px" }}>
                {fmt(b[item.k] ?? b[item.alt] ?? 0, currency)}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard eyebrow="CARTERA ACTIVA" title="Cuentas por cobrar (AR)">
        <div style={{ overflowX: "auto" }}>
          <table className="lp-table" style={{ width: "100%" }}>
            <thead>
              <tr><th>N° CxC</th><th>Cliente / Org</th><th>Vencimiento</th><th>Original</th><th>Pendiente</th><th>Estado</th><th>Acción</th></tr>
            </thead>
            <tbody>
              {(arData.results || []).map(ar => (
                <tr key={ar.id}>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{ar.ar_number}</td>
                  <td>{ar.organization_name || ar.customer_email || "—"}</td>
                  <td>{ar.due_date}</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{fmt(ar.original_amount, ar.currency)}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{fmt(ar.pending_balance, ar.currency)}</td>
                  <td><StatusPill status={ar.status} /></td>
                  <td>
                    {String(ar.status || "").toUpperCase() !== "SETTLED" && (
                      <SecondaryButton onClick={() => { setAllocTarget(ar); setAllocForm({ allocation_type: "payment", amount: ar.pending_balance, reference: "" }) }} style={{ padding: "4px 10px", fontSize: "12px" }}>
                        Registrar abono
                      </SecondaryButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <FormModal open={!!allocTarget} title={`Abonar ${allocTarget?.ar_number || ""}`} onClose={() => setAllocTarget(null)} onSave={handleAllocate} saving={saving}>
        <FormField label="Tipo de aplicación">
          <select value={allocForm.allocation_type} onChange={e => setAllocForm(p => ({ ...p, allocation_type: e.target.value }))} style={formInputStyle}>
            <option value="payment">Abono / Pago recibido</option>
            <option value="credit_note">Nota de crédito</option>
            <option value="refund_adjustment">Ajuste por reembolso</option>
          </select>
        </FormField>
        <FormField label="Monto"><input type="number" value={allocForm.amount} onChange={e => setAllocForm(p => ({ ...p, amount: e.target.value }))} style={formInputStyle} /></FormField>
        <FormField label="Referencia"><input value={allocForm.reference} onChange={e => setAllocForm(p => ({ ...p, reference: e.target.value }))} style={formInputStyle} /></FormField>
      </FormModal>
    </div>
  )
}

// ── 4. BF-37: CUENTAS POR PAGAR (AP) ──────────────────────────────────────
export function AccountsPayablePanel({ currency }) {
  const qc = useQueryClient()
  const [payTarget, setPayTarget] = useState(null)
  const [payForm, setPayForm] = useState({ amount: "", bank_reference: "" })
  const [saving, setSaving] = useState(false)

  const { data: apData = { results: [] } } = useQuery({
    queryKey: ["g9-ap", currency],
    queryFn: () => getAccountsPayable({ currency }),
  })

  const handlePay = async () => {
    if (!payTarget) return
    setSaving(true)
    try {
      await payAccountPayable(payTarget.id, {
        amount: Number(payForm.amount),
        bank_reference: payForm.bank_reference,
        idempotency_key: `UI-AP-${payTarget.id}-${Date.now()}`,
      })
      showToast("Pago a proveedor registrado", "success")
      qc.invalidateQueries({ queryKey: ["g9-ap"] })
      setPayTarget(null)
    } catch (e) {
      showToast(e?.response?.data?.error || "Error registrando pago", "error")
    } finally { setSaving(false) }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <SectionCard eyebrow="BF-37 · CUENTAS POR PAGAR" title={`Obligaciones con proveedores (${currency})`}>
        <div style={{ overflowX: "auto" }}>
          <table className="lp-table" style={{ width: "100%" }}>
            <thead>
              <tr><th>N° CxP</th><th>Proveedor</th><th>Factura</th><th>OC</th><th>Vencimiento</th><th>Pendiente</th><th>Estado</th><th>Acción</th></tr>
            </thead>
            <tbody>
              {(apData.results || []).map(ap => (
                <tr key={ap.id}>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{ap.ap_number}</td>
                  <td>{ap.supplier_name}</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{ap.supplier_invoice_number}</td>
                  <td>{ap.po_number || "—"}</td>
                  <td>{ap.due_date}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{fmt(ap.pending_balance, ap.currency)}</td>
                  <td><StatusPill status={ap.status} /></td>
                  <td>
                    {ap.status !== "PAID" && (
                      <PrimaryButton onClick={() => { setPayTarget(ap); setPayForm({ amount: ap.pending_balance, bank_reference: "" }) }} style={{ padding: "4px 10px", fontSize: "12px" }}>
                        Pagar
                      </PrimaryButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <FormModal open={!!payTarget} title={`Pagar ${payTarget?.ap_number || ""}`} onClose={() => setPayTarget(null)} onSave={handlePay} saving={saving}>
        <FormField label="Monto a pagar"><input type="number" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} style={formInputStyle} /></FormField>
        <FormField label="Referencia bancaria verificable *"><input value={payForm.bank_reference} onChange={e => setPayForm(p => ({ ...p, bank_reference: e.target.value }))} style={formInputStyle} placeholder="Ej: TRF-PROV-901" /></FormField>
      </FormModal>
    </div>
  )
}

// ── 5. FIN9-PF-04: REGISTRO TRIBUTARIO EXTERNO ────────────────────────────
export function ExternalTaxPanel() {
  return (
    <SectionCard
      eyebrow="FIN9-PF-04 · TRAZABILIDAD FISCAL EXTERNA"
      title="Registro Tributario Externo (SII / AFIP — Modo Asistido)"
      description="LevelPro OS V4.0 registra folios, respaldos PDF/XML y payloads de borrador (api_ready_draft_only=True) sin emitir ni transmitir DTEs oficiales automáticamente."
      action={
        <Link to="/admin/fiscal" style={{ textDecoration: "none" }}>
          <PrimaryButton><FileCheck2 size={14} /> Abrir módulo fiscal</PrimaryButton>
        </Link>
      }
    >
      <div className="lp-callout lp-callout--info" style={{ fontSize: "13px" }}>
        Todos los documentos tributarios registrados conservan moneda explícita, RUT/CUIT emisor y receptor configurado, SHA-256 de respaldo y trazabilidad de usuario.
      </div>
    </SectionCard>
  )
}

// ── 6. BF-39: FLUJO DE CAJA 30/60/90 & EXPORTACIÓN CONTABLE ───────────────
export function CashFlowPanel({ currency }) {
  const [scenario, setScenario] = useState("base")
  const [exporting, setExporting] = useState(false)

  const { data: cf } = useQuery({
    queryKey: ["g9-cash-flow", currency, scenario],
    queryFn: () => getCashFlowProjection(currency, scenario),
  })

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await downloadAccountingExportCsv(currency)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `levelpro_contabilidad_${currency}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showToast("Libro contable CSV descargado", "success")
    } catch {
      showToast("Error exportando libro contable", "error")
    } finally { setExporting(false) }
  }

  return (
    <SectionCard
      eyebrow="BF-39 · PROYECCIÓN DE FLUJO DE CAJA"
      title={`Proyección 30 / 60 / 90 días (${currency})`}
      description={cf?.scenario_label || "Saldo proyectado = Saldo inicial verificado + Entradas AR - Salidas AP"}
      action={
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select value={scenario} onChange={e => setScenario(e.target.value)} style={{ ...formInputStyle, width: "170px" }}>
            <option value="base">Escenario Base</option>
            <option value="conservative">Conservador</option>
            <option value="optimistic">Optimista</option>
          </select>
          <SecondaryButton onClick={handleExport} disabled={exporting}>
            <Download size={14} /> Exportar CSV
          </SecondaryButton>
        </div>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
        {(Array.isArray(cf?.horizons) ? cf.horizons : Object.values(cf?.horizons || {})).map(h => (
          <div key={h.horizon_days || h.days} style={{ padding: "14px", borderRadius: "12px", border: "1px solid var(--admin-border)", background: "var(--admin-surface-soft)" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--admin-text-muted)" }}>HORIZONTE {h.horizon_days || h.days} DÍAS</div>
            <div style={{ fontSize: "12px", marginTop: "8px", display: "flex", justifyContent: "space-between" }}>
              <span>Saldo inicial:</span><strong style={{ fontFamily: "var(--font-mono)" }}>{fmt(cf?.verified_opening_balance ?? cf?.opening_cash_balance ?? 0, currency)}</strong>
            </div>
            <div style={{ fontSize: "12px", marginTop: "4px", display: "flex", justifyContent: "space-between", color: "#166534" }}>
              <span>+ Entradas AR:</span><strong style={{ fontFamily: "var(--font-mono)" }}>{fmt(h.expected_inflows, currency)}</strong>
            </div>
            <div style={{ fontSize: "12px", marginTop: "4px", display: "flex", justifyContent: "space-between", color: "#991b1b" }}>
              <span>- Salidas AP:</span><strong style={{ fontFamily: "var(--font-mono)" }}>{fmt(h.expected_outflows, currency)}</strong>
            </div>
            <hr style={{ margin: "10px 0", border: "none", borderTop: "1px solid var(--admin-border)" }} />
            <div style={{ fontSize: "13px", display: "flex", justifyContent: "space-between" }}>
              <strong>Saldo proyectado:</strong>
              <strong style={{ fontFamily: "var(--font-mono)", color: "var(--admin-primary)" }}>{fmt(h.projected_balance, currency)}</strong>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
