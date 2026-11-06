import { ACCOUNTING_CURRENCIES } from "../../../utils/accountingCurrency"

/** Selects reporting denomination, never performs an FX conversion. */
export default function AccountingCurrencySelect({ value, onChange, id = "reporting-currency" }) {
  return (
    <label className="au-currency-select" htmlFor={id}>
      <span>Moneda</span>
      <select id={id} className="au-select" value={value} onChange={e => onChange(e.target.value)}>
        {ACCOUNTING_CURRENCIES.map(code => <option key={code} value={code}>{code}</option>)}
      </select>
    </label>
  )
}
