// components/admin/ui/Skeletons.jsx
export function SkeletonCard({ height = 148, className }) {
  return <div className={`au-card au-skel ${className || ""}`.trim()} style={{ height }} />
}

export function SkeletonTable({ rows = 6 }) {
  return (
    <div className="au-card au-table-wrap" style={{ padding: 16 }}>
      <div className="au-skel" style={{ height: 40, marginBottom: 12 }} />
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="au-skel" style={{ height: 46, marginBottom: 8, opacity: 1 - i * 0.08 }} />
      ))}
    </div>
  )
}
