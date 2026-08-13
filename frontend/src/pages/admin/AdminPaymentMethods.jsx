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
  ConfirmationModal, EmptyState,
} from "../../components/admin/ui"
import { showToast } from "../../components/ui/ToastNotification"
import { CreditCard, Landmark, Plus, Pencil, Trash2 } from "lucide-react"

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
    <FormModal title={isEdit ? "Editar método" : "Nuevo método"} onClose={onClose}
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
    <FormModal title={isEdit ? "Editar cuenta" : "Nueva cuenta"} onClose={onClose}
      onSave={() => save.mutate()} saving={save.isPending}>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {field("Etiqueta", "label", "Ej: Cuenta CLP - Banco Estado")}
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

  const btnStyle = {
    display: "inline-flex", alignItems: "center", gap: "6px",
    padding: "7px 12px", borderRadius: "var(--r-md)", cursor: "pointer",
    fontSize: "12px", fontWeight: 600, border: "1px solid var(--border)",
    background: "var(--surface-2)", color: "var(--text)",
  }
  const iconBtn = {
    display: "inline-flex", padding: "6px", borderRadius: "var(--r-md)",
    cursor: "pointer", border: "1px solid var(--border)",
    background: "transparent", color: "var(--text-2)",
  }

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      <AdminPageHeader
        title="Métodos de pago"
        subtitle="Configurá qué métodos se ofrecen en el checkout y las cuentas bancarias para transferencia."
      />

      {methodModal && <MethodModal item={methodModal === "new" ? null : methodModal} onClose={() => setMethodModal(null)} />}
      {accountModal && <AccountModal item={accountModal === "new" ? null : accountModal} onClose={() => setAccountModal(null)} />}
      {toDelete && (
        <ConfirmationModal
          title="Eliminar"
          message="¿Seguro que querés eliminar esto? No se puede deshacer."
          onConfirm={() => delMutation.mutate()}
          onCancel={() => setToDelete(null)}
          confirming={delMutation.isPending}
        />
      )}

      {/* Sección: métodos */}
      <div style={{ marginBottom: "40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "16px",
            fontWeight: 700, color: "var(--text)" }}>
            <CreditCard size={18} /> Métodos activos
          </h2>
          <button style={btnStyle} onClick={() => setMethodModal("new")}>
            <Plus size={14} /> Agregar método
          </button>
        </div>

        {methods.length === 0 ? (
          <EmptyState message="No hay métodos configurados. Agregá al menos uno para que el checkout funcione." />
        ) : (
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left",
                  color: "var(--text-3)", fontSize: "11px", textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 16px" }}>Método</th>
                  <th style={{ padding: "12px 16px" }}>Estado</th>
                  <th style={{ padding: "12px 16px" }}>Monedas</th>
                  <th style={{ padding: "12px 16px" }}></th>
                </tr>
              </thead>
              <tbody>
                {methods.map(m => (
                  <tr key={m.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px" }}>{m.label || m.method_display}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <StatusBadge tone={m.is_active ? "success" : "neutral"}>
                        {m.is_active ? "Activo" : "Inactivo"}
                      </StatusBadge>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-3)" }}>{m.currencies || "Todas"}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <button style={iconBtn} onClick={() => setMethodModal(m)}><Pencil size={13} /></button>
                        <button style={iconBtn} onClick={() => setToDelete({ kind: "method", id: m.id })}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sección: cuentas bancarias */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "16px",
            fontWeight: 700, color: "var(--text)" }}>
            <Landmark size={18} /> Cuentas bancarias (transferencia)
          </h2>
          <button style={btnStyle} onClick={() => setAccountModal("new")}>
            <Plus size={14} /> Agregar cuenta
          </button>
        </div>

        {accounts.length === 0 ? (
          <EmptyState message="No hay cuentas cargadas. Agregá una para que aparezca en el checkout cuando el cliente elija transferencia." />
        ) : (
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left",
                  color: "var(--text-3)", fontSize: "11px", textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 16px" }}>Etiqueta</th>
                  <th style={{ padding: "12px 16px" }}>Moneda</th>
                  <th style={{ padding: "12px 16px" }}>Banco</th>
                  <th style={{ padding: "12px 16px" }}>Cuenta</th>
                  <th style={{ padding: "12px 16px" }}>Estado</th>
                  <th style={{ padding: "12px 16px" }}></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px" }}>{a.label}</td>
                    <td style={{ padding: "12px 16px" }}>{a.currency}</td>
                    <td style={{ padding: "12px 16px" }}>{a.bank_name}</td>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace" }}>{a.account_number}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <StatusBadge tone={a.is_active ? "success" : "neutral"}>
                        {a.is_active ? "Activa" : "Inactiva"}
                      </StatusBadge>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <button style={iconBtn} onClick={() => setAccountModal(a)}><Pencil size={13} /></button>
                        <button style={iconBtn} onClick={() => setToDelete({ kind: "account", id: a.id })}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
