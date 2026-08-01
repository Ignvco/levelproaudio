// components/admin/ui/AdminTabs.jsx
export function AdminTabs({ tabs = [], value, onChange, testId }) {
  return (
    <div className="au-tabs" data-testid={testId || "admin-tabs"}>
      {tabs.map((t) => {
        const key = t.key ?? t
        const label = t.label ?? t
        return (
          <button key={key} type="button"
            className={`au-tab ${value === key ? "is-active" : ""}`}
            onClick={() => onChange?.(key)}
            data-testid={`tab-${key}`}>
            {label}{t.badge != null && <span className="au-badge au-badge--neutral" style={{ marginLeft: 8 }}>{t.badge}</span>}
          </button>
        )
      })}
    </div>
  )
}
