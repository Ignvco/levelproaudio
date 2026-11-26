// components/admin/ui/AdminTabs.jsx
export function AdminTabs({ tabs = [], value, onChange, testId }) {
  return (
    <div className="au-tabs hide-scroll" role="tablist" data-testid={testId || "admin-tabs"}>
      {tabs.map((t) => {
        const key = t.key ?? t
        const label = t.label ?? t
        const isActive = value === key
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-pressed={isActive}
            className={`au-tab ${isActive ? "is-active" : ""}`}
            onClick={() => onChange?.(key)}
            data-testid={`tab-${key}`}
          >
            <span>{label}</span>
            {t.badge != null && (
              <span
                className="au-badge au-badge--neutral"
                style={{ marginLeft: 7, fontVariantNumeric: "tabular-nums" }}
              >
                {t.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
