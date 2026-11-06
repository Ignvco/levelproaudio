// components/admin/ui/Pagination.jsx
import { ChevronLeft, ChevronRight } from "lucide-react"

export function Pagination({ page, pageCount, onChange, testId }) {
  if (pageCount <= 1) return null
  const pages = []
  const push = (p) => pages.push(p)
  const window = 1
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || (p >= page - window && p <= page + window)) push(p)
    else if (pages[pages.length - 1] !== "…") push("…")
  }
  return (
    <nav className="au-pagination" aria-label="Paginación" data-testid={testId || "pagination"}>
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Anterior">
        <ChevronLeft size={15} />
      </button>
      {pages.map((p, i) =>
        p === "…"
          ? <span key={`e${i}`} style={{ padding: "0 4px", color: "var(--admin-text-muted)" }}>…</span>
          : <button type="button" key={p} className={p === page ? "is-active" : ""} aria-current={p === page ? "page" : undefined} aria-label={`Página ${p}`} onClick={() => onChange(p)}>{p}</button>
      )}
      <button type="button" disabled={page >= pageCount} onClick={() => onChange(page + 1)} aria-label="Siguiente">
        <ChevronRight size={15} />
      </button>
    </nav>
  )
}
