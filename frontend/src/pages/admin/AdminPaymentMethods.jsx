// pages/admin/AdminPaymentMethods.jsx — Configuración de métodos de pago
// y cuentas bancarias (antes estaba en el admin de Django).

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  listPaymentMethods, createPaymentMethod, updatePaymentMethod, deletePaymentMethod,
  listBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount,
} from "../../api/admin.api"
import {
  AdminPageHeader, StatusBadge, FormModal, FormField, formInputStyle,
  ConfirmationModal, EmptyState, SectionCard, StatCard, PrimaryButton, IconButton,
} from "../../components/admin/ui"
import { showToast } from "../../components/ui/ToastNotification"
import { CreditCard, Landmark, Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react"

const METHOD_OPTIONS = [
  { value: "transfer",       label: "Transferencia bancaria" },
  { value: "dlocal",         label: "dLocal Go" },
  { value: "payoneer",       label: "Payoneer (USD)" },
  { value: "mercadopago_cl", label: "MercadoPago Chile" },
  { value: "mercadopago_ar", label: "MercadoPago Argentina" },
  { value: "paypal",         label: "PayPal" },
]

// ─────────────────────────── Métodos de pago ───────────────────────────
function MethodModal({ item, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!item?.id
  const [form, setForm] = useState({
    method:      item?.method      || "transfer",
    is_active:   item?.is_active   ?? true,
    label:       item?.label       || "",
    description: item?.description || "",
    currencies:  item?.currencies  || "",
    order:       item?.order       ?? 0,
  })

  const save = useMutation({
    mutationFn: () => isEdit
      ? updatePaymentMethod(item.id, form)
      : createPaymentMethod(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payment-methods"] })
      showToast(isEdit ? "Método actualizado" : "Método agregado")
      onClose()
    },
    onError: (e) => showToast(e?.response?.data?.method?.[0] || e?.response?.data?.detail || "No se pudo guardar.", "error"),
  })

  return (
    <FormModal open title={isEdit ? "Editar método" : "Nuevo método"} onClose={onClose}
      onSave={() => save.mutate()} saving={save.isPending}>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <FormField label="Método">
          <select style={formInputStyle} value={form.method} disabled={isEdit}
            onChange={e => setForm(p => ({ ...p, method: e.target.value }))}>
            {METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </FormField>
        <FormField label="Activo en el checkout">
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <input type="checkbox" checked={form.is_active}
              onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
            <span style={{ fontSize: "13px", color: "var(--text-2)" }}>
              {form.is_active ? "Se muestra en el checkout" : "Oculto"}
            </span>
          </label>
        </FormField>
        <FormField label="Nombre visible (opcional)">
          <input style={formInputStyle} value={form.label}
            onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
            placeholder="Si se deja vacío, usa el nombre por defecto" />
        </FormField>
        <FormField label="Descripción (opcional)">
          <input style={formInputStyle} value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Ej: Tarjetas, Khipu, efectivo" />
        </FormField>
        <FormField label="Monedas (opcional)">
          <input style={formInputStyle} value={form.currencies}
            onChange={e => setForm(p => ({ ...p, currencies: e.target.value }))}
            placeholder="Ej: CLP,USD — vacío = todas las monedas" />
        </FormField>
        <FormField label="Orden">
          <input type="number" style={formInputStyle} value={form.order}
            onChange={e => setForm(p => ({ ...p, order: Number(e.target.value) }))} />
        </FormField>
      </div>
    </FormModal>
  )
}

// ─────────────────────────── Cuentas bancarias ─────────────────────────
function AccountModal({ item, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!item?.id
  const [form, setForm] = useState({
    label:          item?.label          || "",
    payment_method: item?.payment_method || "transfer",
    currency:       item?.currency       || "CLP",
    bank_name:      item?.bank_name       || "",
    account_type:   item?.account_type    || "",
    account_number: item?.account_number  || "",
    holder_name:    item?.holder_name     || "",
    holder_id:      item?.holder_id       || "",
    email:          item?.email           || "",
    instructions:   item?.instructions    || "",
    is_active:      item?.is_active       ?? true,
    order:          item?.order           ?? 0,
  })

  const save = useMutation({
    mutationFn: () => isEdit
      ? updateBankAccount(item.id, form)
      : createBankAccount(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-bank-accounts"] })
      showToast(isEdit ? "Cuenta actualizada" : "Cuenta agregada")
      onClose()
    },
    onError: (e) => showToast(e?.response?.data?.detail || "No se pudo guardar.", "error"),
  })

  const field = (label, key, placeholder = "") => (
    <FormField label={label}>
      <input style={formInputStyle} value={form[key]}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder} />
    </FormField>
  )

  return (
    <FormModal open title={isEdit ? "Editar cuenta" : "Nueva cuenta"} onClose={onClose}
      onSave={() => save.mutate()} saving={save.isPending}>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {field("Etiqueta", "label", "Ej: Cuenta CLP - Banco Estado")}
        <FormField label="Método de esta cuenta">
          <select style={formInputStyle} value={form.payment_method}
            onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))}>
            <option value="transfer">Transferencia bancaria</option>
            <option value="payoneer">Payoneer</option>
          </select>
        </FormField>
        <FormField label="Moneda">
          <select style={formInputStyle} value={form.currency}
            onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}>
            <option value="CLP">CLP</option>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </FormField>
        {field("Banco", "bank_name")}
        {field("Tipo de cuenta", "account_type", "Ej: Cuenta corriente")}
        {field("N° de cuenta", "account_number")}
        {field("Titular", "holder_name")}
        {field("RUT/CUIT del titular", "holder_id")}
        {field("Email (opcional)", "email")}
        <FormField label="Instrucciones (opcional)">
          <textarea style={{ ...formInputStyle, minHeight: "60px" }} value={form.instructions}
            onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))} />
        </FormField>
        <FormField label="Activa">
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <input type="checkbox" checked={form.is_active}
              onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
            <span style={{ fontSize: "13px", color: "var(--text-2)" }}>Visible en el checkout</span>
          </label>
        </FormField>
      </div>
    </FormModal>
  )
}

// ─────────────────────────── Página ─────────────────────────
export default function AdminPaymentMethods() {
  const qc = useQueryClient()
  const [methodModal, setMethodModal]   = useState(null)
  const [accountModal, setAccountModal] = useState(null)
  const [toDelete, setToDelete]         = useState(null)

  const { data: methods = [] } = useQuery({
    queryKey: ["admin-payment-methods"], queryFn: listPaymentMethods,
  })
  const { data: accounts = [] } = useQuery({
    queryKey: ["admin-bank-accounts"], queryFn: listBankAccounts,
  })

  const delMutation = useMutation({
    mutationFn: () => toDelete.kind === "method"
      ? deletePaymentMethod(toDelete.id)
      : deleteBankAccount(toDelete.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payment-methods"] })
      qc.invalidateQueries({ queryKey: ["admin-bank-accounts"] })
      showToast("Eliminado")
      setToDelete(null)
    },
    onError: () => showToast("No se pudo eliminar.", "error"),
  })

  const activeMethods = methods.filter(m => m.is_active).length
  const activeAccounts = accounts.filter(a => a.is_active).length

  return (
    <div className="au-page">
      <AdminPageHeader
        eyebrow="LEVELPRO / CHECKOUT"
        title="Métodos de pago"
        description="Configurá qué métodos se ofrecen en el checkout y las cuentas bancarias para transferencia."
      />

      {methodModal && <MethodModal item={methodModal === "new" ? null : methodModal} onClose={() => setMethodModal(null)} />}
      {accountModal && <AccountModal item={accountModal === "new" ? null : accountModal} onClose={() => setAccountModal(null)} />}
      {toDelete && (
        <ConfirmationModal
          open
          title="Eliminar"
          description="¿Seguro que querés eliminar esto? No se puede deshacer."
          danger
          onConfirm={() => delMutation.mutate()}
          onCancel={() => setToDelete(null)}
          loading={delMutation.isPending}
        />
      )}

      <div className="lp-kpi-strip">
        <StatCard variant="primary" label="Pasarelas activas" value={activeMethods} sub="Visibles en checkout" Icon={CheckCircle2} />
        <StatCard variant="ink" label="Métodos configurados" value={methods.length} sub="Total registrados" Icon={CreditCard} />
        <StatCard variant="light" label="Cuentas bancarias" value={activeAccounts} sub={`${accounts.length} totales`} Icon={Landmark} />
      </div>

      {/* Sección: métodos */}
      <SectionCard
        title="Métodos activos"
        description="Pasarelas y medios de pago habilitados en el checkout"
        action={
          <PrimaryButton size="sm" onClick={() => setMethodModal("new")}>
            <Plus size={14} /> Agregar método
          </PrimaryButton>
        }
      >
        {methods.length === 0 ? (
          <EmptyState Icon={CreditCard} title="Sin métodos" description="Agregá al menos uno para que el checkout funcione." />
        ) : (
          <div className="au-tscroll" style={{ margin: "0 -24px -22px", width: "calc(100% + 48px)" }}>
            <table className="au-table">
              <thead>
                <tr>
                  <th>Método</th>
                  <th>Estado</th>
                  <th>Monedas</th>
                  <th style={{ width: 96 }} />
                </tr>
              </thead>
              <tbody>
                {methods.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 700, color: "var(--admin-text)" }}>{m.label || m.method_display}</td>
                    <td>
                      <StatusBadge tone={m.is_active ? "success" : "neutral"}>
                        {m.is_active ? "Activo" : "Inactivo"}
                      </StatusBadge>
                    </td>
                    <td>{m.currencies || "Todas"}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <IconButton ghost onClick={() => setMethodModal(m)} aria-label="Editar método"><Pencil size={14} /></IconButton>
                        <IconButton ghost onClick={() => setToDelete({ kind: "method", id: m.id })} aria-label="Eliminar método"><Trash2 size={14} /></IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Sección: cuentas bancarias */}
      <SectionCard
        title="Cuentas bancarias (transferencia)"
        description="Datos bancarios mostrados cuando el cliente elige pago por transferencia"
        action={
          <PrimaryButton size="sm" onClick={() => setAccountModal("new")}>
            <Plus size={14} /> Agregar cuenta
          </PrimaryButton>
        }
      >
        {accounts.length === 0 ? (
          <EmptyState Icon={Landmark} title="Sin cuentas" description="Agregá una para que aparezca en el checkout cuando el cliente elija transferencia." />
        ) : (
          <div className="au-tscroll" style={{ margin: "0 -24px -22px", width: "calc(100% + 48px)" }}>
            <table className="au-table">
              <thead>
                <tr>
                  <th>Etiqueta</th>
                  <th>Método / Moneda</th>
                  <th>Banco</th>
                  <th>Cuenta</th>
                  <th>Estado</th>
                  <th style={{ width: 96 }} />
                </tr>
              </thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 700, color: "var(--admin-text)" }}>{a.label}</td>
                    <td>{a.payment_method === "payoneer" ? "Payoneer" : "Transferencia"} / {a.currency}</td>
                    <td>{a.bank_name}</td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{a.account_number}</td>
                    <td>
                      <StatusBadge tone={a.is_active ? "success" : "neutral"}>
                        {a.is_active ? "Activa" : "Inactiva"}
                      </StatusBadge>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <IconButton ghost onClick={() => setAccountModal(a)} aria-label="Editar cuenta"><Pencil size={14} /></IconButton>
                        <IconButton ghost onClick={() => setToDelete({ kind: "account", id: a.id })} aria-label="Eliminar cuenta"><Trash2 size={14} /></IconButton>
                      </div>
                    </td>
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
