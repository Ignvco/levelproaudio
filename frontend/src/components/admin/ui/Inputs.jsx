// components/admin/ui/Inputs.jsx
import { Search } from "lucide-react"

export function SearchInput({ value, onChange, placeholder = "Buscar...", testId }) {
  return (
    <div className="au-search">
      <Search size={15} strokeWidth={2} />
      <input value={value} onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder} data-testid={testId || "search-input"} />
    </div>
  )
}

export function FilterSelect({ value, onChange, options = [], ariaLabel, testId }) {
  return (
    <select className="au-select" value={value} onChange={(e) => onChange?.(e.target.value)}
      aria-label={ariaLabel} data-testid={testId}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
