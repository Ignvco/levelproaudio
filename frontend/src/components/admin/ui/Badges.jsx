// components/admin/ui/Badges.jsx
const DOT_TONES = {
  success: "#16A34A",
  pos: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",
  neg: "#DC2626",
  info: "#2563EB",
  neutral: "#71717A",
  primary: "#0F7A38",
}

export function StatusBadge({ status, tone = "neutral", dot = true, children, testId }) {
  const dotColor = DOT_TONES[tone] || DOT_TONES.neutral
  return (
    <span className={`au-badge au-badge--${tone}`} data-testid={testId}>
      {dot && (
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: 9999,
            background: dotColor,
            flexShrink: 0,
          }}
        />
      )}
      {children || status}
    </span>
  )
}

export function CountBadge({ count, tone = "neutral", testId, style }) {
  if (count === null || count === undefined) return null
  return (
    <span className={`au-badge au-badge--${tone}`} data-testid={testId} style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {count}
    </span>
  )
}

export { MetricBadge } from "./StatCard"
