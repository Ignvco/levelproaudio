// components/admin/ui/Buttons.jsx
import { Link } from "react-router-dom"
import { isValidElement } from "react"

function base(variant, size, className) {
  return `au-btn au-btn--${variant} ${size === "sm" ? "au-btn--sm" : ""} ${className || ""}`.trim()
}

function Btn({ variant, size, className, to, href, children, testId, loading, disabled, icon: Icon, ...rest }) {
  const cls = base(variant, size, className)
  const content = <>{Icon && (isValidElement(Icon) ? Icon : <Icon size={16} aria-hidden="true" />)}{children}</>
  if ((to || href) && (disabled || loading)) {
    return <span className={cls} aria-disabled="true" data-testid={testId}>{content}</span>
  }
  if (to) return <Link to={to} className={cls} data-testid={testId} {...rest}>{content}</Link>
  if (href) return <a href={href} className={cls} data-testid={testId} {...rest}>{content}</a>
  return <button type="button" className={cls} data-testid={testId}
    aria-busy={Boolean(loading)} disabled={disabled || Boolean(loading)} {...rest}>
    {loading && <span className="au-btn__spinner" aria-hidden="true" />}
    {content}
  </button>
}

export const PrimaryButton   = (p) => <Btn variant="primary" {...p} />
export const SecondaryButton = (p) => <Btn variant="secondary" {...p} />
export const DangerButton     = (p) => <Btn variant="danger" {...p} />

export function IconButton({ children, icon: Icon, label, ghost, danger, className, testId, ...rest }) {
  return (
    <button
      type="button"
      className={`au-iconbtn ${ghost ? "au-iconbtn--ghost" : ""} ${danger ? "au-iconbtn--danger" : ""} ${className || ""}`.trim()}
      data-testid={testId}
      aria-label={label}
      title={label}
      {...rest}
    >
      {Icon && <Icon size={16} aria-hidden="true" />}
      {children}
    </button>
  )
}
