// components/admin/ui/Buttons.jsx
import { Link } from "react-router-dom"

function base(variant, size, className) {
  return `au-btn au-btn--${variant} ${size === "sm" ? "au-btn--sm" : ""} ${className || ""}`.trim()
}

function Btn({ variant, size, className, to, href, children, testId, loading, disabled, ...rest }) {
  const cls = base(variant, size, className)
  if (to) return <Link to={to} className={cls} data-testid={testId} {...rest}>{children}</Link>
  if (href) return <a href={href} className={cls} data-testid={testId} {...rest}>{children}</a>
  return <button type="button" className={cls} data-testid={testId} disabled={disabled || Boolean(loading)} aria-busy={Boolean(loading)} {...rest}>{children}</button>
}

export const PrimaryButton   = (p) => <Btn variant="primary" {...p} />
export const SecondaryButton = (p) => <Btn variant="secondary" {...p} />
export const DangerButton     = (p) => <Btn variant="danger" {...p} />

export function IconButton({ children, ghost, danger, className, testId, ...rest }) {
  return (
    <button
      type="button"
      className={`au-iconbtn ${ghost ? "au-iconbtn--ghost" : ""} ${danger ? "au-iconbtn--danger" : ""} ${className || ""}`.trim()}
      data-testid={testId}
      {...rest}
    >
      {children}
    </button>
  )
}
