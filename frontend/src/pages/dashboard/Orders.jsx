// pages/dashboard/Orders.jsx — tabla con DataTable (búsqueda + orden + paginación) como el admin
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { ShoppingBag } from "lucide-react"
import { getOrders } from "../../api/orders.api"
import { AdminPageHeader, DataTable, StatusBadge } from "../../components/admin/ui"

const statusMap = {
  pending:   { label: "Pendiente",  tone: "warning" },
  paid:      { label: "Pagado",     tone: "success" },
  shipped:   { label: "Enviado",    tone: "info" },
  completed: { label: "Completado", tone: "success" },
  cancelled: { label: "Cancelado",  tone: "danger" },
}

export default function Orders() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({ queryKey: ["orders"], queryFn: getOrders })
  const orders = (data?.results || data || []).map(o => ({
    ...o, short_id: o.id.slice(0, 8).toUpperCase(),
  }))

  const columns = [
    { key: "short_id", header: "Pedido", sortable: true, render: o => (
      <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: 700,
        color: "var(--admin-page-text)" }}>#{o.short_id}</span>
    )},
    { key: "items_count", header: "Productos", sortable: true, render: o => (
      <span style={{ color: "var(--admin-text-muted)" }}>
        {o.items_count} producto{o.items_count !== 1 ? "s" : ""}
      </span>
    )},
    { key: "total", header: "Total", sortable: true, align: "right", render: o => (
      <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        ${Number(o.total).toLocaleString("es-CL")}
      </span>
    )},
    { key: "status", header: "Estado", render: o => {
      const s = statusMap[o.status] || { label: o.status, tone: "neutral" }
      return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
    }},
    { key: "created_at", header: "Fecha", sortable: true, render: o => (
      <span style={{ color: "var(--admin-text-muted)", whiteSpace: "nowrap" }}>
        {new Date(o.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
      </span>
    )},
  ]

  return (
    <div className="au-page" style={{ padding: "clamp(20px, 3vw, 40px) clamp(20px, 4vw, 48px)" }} data-testid="orders-page">
      <AdminPageHeader eyebrow="Mi cuenta" title="Mis pedidos"
        description={`${orders.length} pedido${orders.length !== 1 ? "s" : ""}`} />

      <DataTable
        columns={columns} data={orders} loading={isLoading}
        getRowId={o => o.id}
        searchable searchKeys={["short_id"]} searchPlaceholder="Buscar por N° de pedido..."
        onRowClick={o => navigate(`/dashboard/orders/${o.id}`)}
        emptyIcon={ShoppingBag} emptyTitle="Sin pedidos todavía"
        emptyDesc="Explorá la tienda y realizá tu primer pedido."
        testId="orders-table" />
    </div>
  )
}
