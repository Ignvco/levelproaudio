// components/admin/ui/EmptyState.jsx
import { Inbox } from "lucide-react"

export function EmptyState({ Icon = Inbox, title = "Sin resultados", description, action, testId }) {
  return (
    <div className="au-empty" data-testid={testId || "empty-state"}>
      {Icon && <span className="au-empty__icon"><Icon size={24} strokeWidth={2} /></span>}
      <p className="au-empty__title">{title}</p>
      {description && <p className="au-empty__desc">{description}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ title = "Ocurrió un error", description = "No pudimos cargar la información. Intenta nuevamente.", action, testId }) {
  return <div role="alert"><EmptyState title={title} description={description} action={action} testId={testId || "error-state"} /></div>
}
