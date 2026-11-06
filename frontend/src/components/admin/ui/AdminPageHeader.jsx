// components/admin/ui/AdminPageHeader.jsx
import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"

export function AdminPageHeader({ eyebrow, title, description, subtitle, actions, breadcrumbs, breadcrumb, testId }) {
  const desc = description || subtitle
  const crumbs = breadcrumbs ?? breadcrumb
  return (
    <div className="au-header" data-testid={testId || "admin-page-header"}>
      <div>
        {crumbs?.length > 0 && (
          <nav className="au-header__crumbs" aria-label="Ruta de navegación">
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {c.to ? <Link to={c.to}>{c.label}</Link> : <span aria-current={i === crumbs.length - 1 ? "page" : undefined}>{c.label}</span>}
                {i < crumbs.length - 1 && <ChevronRight size={13} />}
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <p className="au-eyebrow">{eyebrow}</p>}
        <h1 className="au-title">{title}</h1>
        {desc && <p className="au-desc">{desc}</p>}
      </div>
      {actions && <div className="au-header__actions">{actions}</div>}
    </div>
  )
}
