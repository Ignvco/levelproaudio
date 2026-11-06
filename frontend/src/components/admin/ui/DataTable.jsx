// components/admin/ui/DataTable.jsx
import { useState, useMemo, useRef, useEffect } from "react"
import { MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { SearchInput, FilterSelect } from "./Inputs"
import { EmptyState, ErrorState } from "./EmptyState"
import { Pagination } from "./Pagination"
import { SkeletonTable } from "./Skeletons"

function RowMenu({ actions, row }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const escape = (e) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", h)
    document.addEventListener("keydown", escape)
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", escape) }
  }, [])
  return (
    <div className="au-rowmenu" ref={ref}>
      <button type="button" className="au-iconbtn au-iconbtn--ghost" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        aria-label="Acciones" aria-haspopup="menu" aria-expanded={open} data-testid="row-actions-trigger">
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="au-rowmenu__list" role="menu">
          {actions.map((a, i) => (
            <button type="button" role="menuitem" key={i} className={`au-rowmenu__item ${a.danger ? "au-rowmenu__item--danger" : ""}`}
              onClick={(e) => { e.stopPropagation(); setOpen(false); a.onClick?.(row) }}>
              {a.icon && <a.icon size={14} />}{a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function DataTable({
  columns = [], data = [], loading = false, error = false,
  getRowId = (r) => r.id,
  searchable = true, searchPlaceholder = "Buscar...", searchKeys,
  filters = [], toolbarExtra,
  selectable = false, onSelectionChange,
  rowActions, onRowClick,
  pageSizeOptions = [10, 25, 50], initialPageSize = 10,
  emptyTitle, emptyDesc, emptyIcon,
  testId = "data-table",
}) {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState({ key: null, dir: "asc" })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [selected, setSelected] = useState(() => new Set())

  const keys = useMemo(() => searchKeys || columns.filter((c) => c.key).map((c) => c.key), [searchKeys, columns])

  const filtered = useMemo(() => {
    let rows = data
    if (query.trim()) {
      const q = query.toLowerCase()
      rows = rows.filter((r) => keys.some((k) => String(r[k] ?? "").toLowerCase().includes(q)))
    }
    if (sort.key) {
      rows = [...rows].sort((a, b) => {
        const av = a[sort.key], bv = b[sort.key]
        if (av == null) return 1
        if (bv == null) return -1
        // Numeric strings (DecimalField API values) must sort numerically.
        const numeric = v => typeof v === "number" ? v
          : (typeof v === "string" && /^-?\d+(?:\.\d+)?$/.test(v) ? Number(v) : null)
        const an = numeric(av), bn = numeric(bv)
        const cmp = an != null && bn != null
          ? an - bn : String(av).localeCompare(String(bv), "es", { sensitivity: "base" })
        return sort.dir === "asc" ? cmp : -cmp
      })
    }
    return rows
  }, [data, query, sort, keys])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pageCount)
  const pageRows = filtered.slice((current - 1) * pageSize, current * pageSize)

  const toggleSort = (key) => {
    setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" })
  }
  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      onSelectionChange?.([...next])
      return next
    })
  }
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(getRowId(r)))
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) pageRows.forEach((r) => next.delete(getRowId(r)))
      else pageRows.forEach((r) => next.add(getRowId(r)))
      onSelectionChange?.([...next])
      return next
    })
  }

  if (loading) return <SkeletonTable rows={initialPageSize > 6 ? 6 : initialPageSize} />

  const showToolbar = searchable || filters.length > 0 || toolbarExtra

  return (
    <div className="au-card au-table-wrap" data-testid={testId}>
      {showToolbar && (
        <div className="au-toolbar">
          <div className="au-toolbar__left">
            {searchable && <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(1) }} placeholder={searchPlaceholder} testId={`${testId}-search`} />}
          </div>
          <div className="au-toolbar__right">
            {filters.map((f, i) => (
              <FilterSelect key={i} value={f.value} onChange={(v) => { f.onChange(v); setPage(1) }}
                options={f.options} ariaLabel={f.label} testId={`${testId}-filter-${i}`} />
            ))}
            {toolbarExtra}
          </div>
        </div>
      )}

      {error ? (
        <ErrorState />
      ) : filtered.length === 0 ? (
        <EmptyState Icon={emptyIcon} title={emptyTitle || "Sin resultados"} description={emptyDesc || "Ajusta la búsqueda o los filtros."} />
      ) : (
        <>
          <div className="au-tscroll">
            <table className="au-table">
              <thead>
                <tr>
                  {selectable && (
                    <th scope="col" style={{ width: 40 }}>
                      <input type="checkbox" className="au-checkbox" checked={allOnPageSelected} onChange={toggleAll} aria-label="Seleccionar todo" />
                    </th>
                  )}
                  {columns.map((c) => (
                    <th key={c.key || c.header} className={c.sortable ? "is-sortable" : ""}
                      scope="col"
                      aria-sort={c.sortable && sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                      style={{ width: c.width, textAlign: c.align }}>
                      {c.sortable && c.key ? (
                        <button type="button" className="au-table-sort" onClick={() => toggleSort(c.key)}>
                          {c.header}
                          {sort.key === c.key ? (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)
                            : <ArrowUpDown size={12} style={{ opacity: .4 }} />}
                        </button>
                      ) : <span>{c.header}</span>}
                    </th>
                  ))}
                  {rowActions && <th scope="col" aria-label="Acciones" style={{ width: 56 }} />}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const id = getRowId(row)
                  return (
                    <tr key={id} onClick={() => onRowClick?.(row)}
                      onKeyDown={e => { if (onRowClick && (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); onRowClick(row) } }}
                      tabIndex={onRowClick ? 0 : undefined} style={{ cursor: onRowClick ? "pointer" : "default" }} data-testid={`${testId}-row`}>
                      {selectable && (
                        <td onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" className="au-checkbox" checked={selected.has(id)} onChange={() => toggleRow(id)} aria-label={`Seleccionar fila ${id}`} />
                        </td>
                      )}
                      {columns.map((c) => (
                        <td key={c.key || c.header} style={{ textAlign: c.align }}>
                          {c.render ? c.render(row) : row[c.key]}
                        </td>
                      ))}
                      {rowActions && (
                        <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "right" }}>
                          <RowMenu actions={rowActions(row)} row={row} />
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="au-table__foot">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="au-pageinfo">
                {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, filtered.length)} de {filtered.length}
              </span>
              <FilterSelect value={String(pageSize)} onChange={(v) => { setPageSize(Number(v)); setPage(1) }}
                options={pageSizeOptions.map((n) => ({ value: String(n), label: `${n} / pág.` }))} ariaLabel="Filas por página" testId={`${testId}-pagesize`} />
            </div>
            <Pagination page={current} pageCount={pageCount} onChange={setPage} testId={`${testId}-pagination`} />
          </div>
        </>
      )}
    </div>
  )
}
