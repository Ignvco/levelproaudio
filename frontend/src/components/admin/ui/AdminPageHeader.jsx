// components/admin/ui/AdminPageHeader.jsx
import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"

export function AdminPageHeader({ eyebrow, title, description, actions, breadcrumbs, testId }) {
  return (
    <div className="au-header" data-testid={testId || "admin-page-header"}>
      <div>
        {breadcrumbs?.length > 0 && (
          <nav className="au-header__crumbs" aria-label="breadcrumb">
            {breadcrumbs.map((c, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
                {i < breadcrumbs.length - 1 && <ChevronRight size={13} />}
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <p className="au-eyebrow">{eyebrow}</p>}
        <h1 className="au-title">{title}</h1>
        {description && <p className="au-desc">{description}</p>}
      </div>
      {actions && <div className="au-header__actions">{actions}</div>}
    </div>
  )
}
