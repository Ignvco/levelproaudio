// components/admin/ui/Badges.jsx
export function StatusBadge({ status, tone = "neutral", children, testId }) {
  return (
    <span className={`au-badge au-badge--${tone}`} data-testid={testId}>
      {children || status}
    </span>
  )
}

export { MetricBadge } from "./StatCard"
