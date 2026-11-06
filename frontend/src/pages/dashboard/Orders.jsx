// pages/dashboard/Orders.jsx — LevelPro Dashboard Experience V2 (Usuario / Pedidos)
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { ShoppingBag, Package, Clock, CheckCircle2, DollarSign } from "lucide-react"
import { getOrders } from "../../api/orders.api"
import { queryDisplayState, listFromResponse } from "../../utils/queryDisplayState"
import { formatCurrency } from "../../utils/accountingCurrency"
import {
  AdminPageHeader,
  DataTable,
  StatusBadge,
  StatCard,
  PrimaryButton,
} from "../../components/admin/ui"

const STATUS_MAP = {
  pending:   { label: "Pendiente",  tone: "warning" },
  paid:      { label: "En proceso", tone: "success" },
  shipped:   { label: "Enviado",    tone: "info" },
  completed: { label: "Entregado",  tone: "success" },
  cancelled: { label: "Cancelado",  tone: "danger" },
}

export default function Orders() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useQuery({ queryKey: ["orders"], queryFn: getOrders })

  const ready = queryDisplayState({ data, isPending: isLoading, isError }) === "ready"
  const orders = listFromResponse(data).map(o => ({
    ...o,
    short_id: (o.id || "").slice(0, 8).toUpperCase(),
  }))

  const totalOrders = orders.length
  const inProgressCount = orders.filter(o => o.status === "paid" || o.status === "shipped").length
  const pendingCount = orders.filter(o => o.status === "pending").length
  const totalsByCurrency = orders
    .filter(o => ["paid", "shipped", "completed"].includes(o.status))
    .reduce((totals, order) => {
      const currency = ["CLP", "USD", "ARS"].includes(order.currency) ? order.currency : null
      if (currency) totals[currency] += Number(order.total) || 0
      return totals
    }, { CLP: 0, USD: 0, ARS: 0 })
  const spentLabels = Object.entries(totalsByCurrency).filter(([, value]) => value !== 0)
    .map(([currency, total]) => formatCurrency(total, currency))

  const columns = [
    {
      key: "short_id",
      header: "N° Pedido",
      sortable: true,
      render: o => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 700, color: "var(--admin-text)" }}>
          #{o.short_id}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Fecha",
      sortable: true,
      render: o => {
        const raw = o.created_at || o.created
        if (!raw) return <span style={{ color: "var(--admin-text-muted)" }}>—</span>
        const d = new Date(raw)
        const formatted = Number.isNaN(d.getTime())
          ? String(raw)
          : d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })
        return <span style={{ color: "var(--admin-text-secondary)", whiteSpace: "nowrap" }}>{formatted}</span>
      },
    },
    {
      key: "items_count",
      header: "Productos",
      sortable: true,
      render: o => {
        const count = o.items_count ?? o.items?.length ?? 1
        return (
          <span style={{ color: "var(--admin-text-secondary)" }}>
            {count} producto{count !== 1 ? "s" : ""}
          </span>
        )
      },
    },
    {
      key: "total",
      header: "Total",
      sortable: true,
      align: "right",
      render: o => (
        <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--admin-primary-text)" }}>
          {formatCurrency(o.total, o.currency)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      render: o => {
        const s = STATUS_MAP[o.status] || { label: o.status, tone: "neutral" }
        return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: o => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/dashboard/orders/${o.id}`)
          }}
          className="au-pill-btn au-pill-btn--edit"
          style={{ padding: "6px 14px", textDecoration: "none", fontSize: "12px", fontWeight: 600 }}
        >
          Ver detalle →
        </button>
      ),
    },
  ]

  return (
    <div className="au-page" data-testid="orders-page">
      <AdminPageHeader
        eyebrow="LEVELPRO / MI CUENTA"
        title="Mis pedidos"
        description={isLoading || isError ? "Consulta tus compras y su seguimiento" : `${totalOrders} pedido${totalOrders !== 1 ? "s" : ""} registrado${totalOrders !== 1 ? "s" : ""} en tu cuenta`}
        breadcrumbs={[
          { label: "Inicio", to: "/dashboard" },
          { label: "Mis pedidos" },
        ]}
        actions={
          <PrimaryButton to="/shop" size="sm">
            + Explorar tienda
          </PrimaryButton>
        }
      />

      {/* No presentar cero como total comercial durante errores de consulta. */}
      {ready && <div className="lp-grid-kpi">
        <StatCard
          variant="ink"
          Icon={Package}
          label="Total pedidos"
          value={totalOrders}
          sub={`${orders.filter(o => o.status === "completed").length} completados`}
        />
        <StatCard
          variant="primary"
          Icon={CheckCircle2}
          label="En proceso / ruta"
          value={inProgressCount}
          sub="Preparación y despacho"
        />
        <StatCard
          variant="light"
          Icon={Clock}
          label="Pendientes"
          value={pendingCount}
          sub={pendingCount > 0 ? "Requiere pago" : "Al día"}
        />
        <StatCard
          variant="light"
          Icon={DollarSign}
          label="Total compras"
          value={<span style={{ fontSize: 16, lineHeight: 1.4 }}>{spentLabels.length ? spentLabels.join(" · ") : "—"}</span>}
          sub="Compras pagadas, separadas por moneda"
        />
      </div>}

      <DataTable
        columns={columns}
        data={orders}
        loading={isLoading}
        error={isError}
        getRowId={o => o.id}
        searchable
        searchKeys={["short_id"]}
        searchPlaceholder="Buscar por N° de pedido..."
        onRowClick={o => navigate(`/dashboard/orders/${o.id}`)}
        emptyIcon={ShoppingBag}
        emptyTitle="Sin pedidos todavía"
        emptyDesc="Explora nuestro catálogo de equipamiento profesional y realiza tu primer pedido."
        testId="orders-table"
      />
    </div>
  )
}
