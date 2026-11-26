// pages/admin/AdminAudit.jsx
/**
 * LEVELPRO OS V4.0 — GATE 1.2: Centro de Registro de Actividad y Auditoría Forense
 * Arquitectura inmutable append-only, segregación RBAC, Geist / Geist Mono, verde #1AFF6E.
 */

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  getAuditEvents,
  getAuditEventDetail,
  getAuditSummary,
  getAuditCatalog,
  exportAuditCsv,
} from "../../api/audit.api"
import {
  AdminPageHeader,
  StatCard,
  StatusBadge,
  SideModal,
  PrimaryButton,
  SecondaryButton,
  EmptyState,
  ErrorState,
  SkeletonTable,
  SkeletonCard,
  Pagination,
  formInputStyle,
} from "../../components/admin/ui"
import {
  Activity,
  Shield,
  ShieldAlert,
  Clock,
  Download,
  RefreshCw,
  Search,
  Eye,
  Copy,
  Check,
  Lock,
  User,
  Database,
  AlertTriangle,
} from "lucide-react"

const SEVERITY_TONES = {
  info: "info",
  warning: "warning",
  critical: "error",
}

const RESULT_TONES = {
  success: "success",
  denied: "error",
  error: "warning",
}

const MODULE_DISPLAY_NAMES = {
  catalog: "Catálogo",
  orders: "Órdenes",
  inventory: "Inventario",
  finances: "Finanzas",
  purchases: "Compras",
  logistics: "Logística",
  marketing: "Marketing",
  academy: "Academia",
  services: "Servicios",
  roles: "Roles y RBAC",
  settings: "Configuración",
  audit: "Auditoría",
  dashboard: "Dashboard",
}

const ACTION_DISPLAY_NAMES = {
  PRODUCT_CREATED: "Creación de Producto",
  PRODUCT_UPDATED: "Actualización de Producto",
  PRODUCT_DELETED: "Eliminación de Producto",
  PRICE_CHANGED: "Cambio de Precio",
  COST_CHANGED: "Cambio de Costo",
  STOCK_ADJUSTED: "Ajuste de Stock",
  CATEGORY_CREATED: "Creación de Categoría",
  CATEGORY_UPDATED: "Actualización de Categoría",
  CATEGORY_DELETED: "Eliminación de Categoría",
  BRAND_CREATED: "Creación de Marca",
  BRAND_UPDATED: "Actualización de Marca",
  BRAND_DELETED: "Eliminación de Marca",
  ORDER_STATUS_CHANGED: "Transición de Pedido",
  PAYMENT_APPROVED: "Aprobación de Pago",
  PAYMENT_REJECTED: "Rechazo de Pago",
  PAYMENT_METHOD_CREATED: "Método de Pago Creado",
  PAYMENT_METHOD_UPDATED: "Método de Pago Modificado",
  PAYMENT_METHOD_DELETED: "Método de Pago Eliminado",
  BANK_ACCOUNT_CREATED: "Cuenta Bancaria Creada",
  BANK_ACCOUNT_UPDATED: "Cuenta Bancaria Modificada",
  BANK_ACCOUNT_DELETED: "Cuenta Bancaria Eliminada",
  FINANCIAL_WITHDRAWAL_CREATED: "Retiro Financiero Creado",
  FINANCIAL_WITHDRAWAL_EXECUTED: "Retiro Financiero Ejecutado",
  TRIBUTARY_DOCUMENT_UPSERTED: "Documento Tributario SII",
  TRIBUTARY_DOCUMENT_PDF_UPLOADED: "Carga de PDF Tributario",
  ROLE_ASSIGNED: "Asignación de Rol",
  ROLE_REVOKED: "Revocación de Rol",
  RBAC_ROLE_ASSIGNED: "Rol RBAC Asignado",
  RBAC_ROLE_REVOKED: "Rol RBAC Revocado",
  SECURITY_DENIED_ACCESS: "Acceso Denegado 403",
  PRIVILEGE_ESCALATION_ATTEMPT: "Intento de Escalación",
  CONFIG_CHANGED: "Ajuste de Configuración",
  SITE_SETTINGS_UPDATED: "Configuración Actualizada",
  REWARDS_CAMPAIGN_CREATED: "Campaña Rewards Creada",
  REWARDS_CAMPAIGN_UPDATED: "Campaña Rewards Modificada",
  REWARDS_CAMPAIGN_DELETED: "Campaña Rewards Eliminada",
  REWARDS_CAMPAIGN_DRAWN: "Sorteo Rewards Ejecutado",
  REWARDS_CAMPAIGN_DUPLICATED: "Campaña Rewards Duplicada",
  REWARDS_CAMPAIGN_FINISHED: "Campaña Rewards Finalizada",
  REWARDS_PRODUCT_CREATED: "Premio Rewards Creado",
  REWARDS_PRODUCT_UPDATED: "Premio Rewards Modificado",
  REWARDS_PRODUCT_DELETED: "Premio Rewards Eliminado",
  REWARDS_WINNER_UPDATED: "Ganador Rewards Actualizado",
  LOYALTY_CONFIG_UPDATED: "Configuración Loyalty Modificada",
  LOYALTY_POINTS_ADJUSTED: "Ajuste de Puntos Loyalty",
  B2B_QUOTE_UPDATED: "Cotización B2B Modificada",
  B2B_QUOTE_CONVERTED: "Cotización B2B Convertida",
  COURSE_CREATED: "Curso Creado",
  COURSE_UPDATED: "Curso Modificado",
  COURSE_DELETED: "Curso Eliminado",
  SERVICE_CREATED: "Servicio Creado",
  SERVICE_UPDATED: "Servicio Modificado",
  SERVICE_DELETED: "Servicio Eliminado",
  SENSITIVE_DATA_EXPORTED: "Exportación de Datos Sensibles",
}

export default function AdminAudit() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState("")
  const [selectedModule, setSelectedModule] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedSeverity, setSelectedSeverity] = useState("")
  const [selectedResult, setSelectedResult] = useState("")
  const [selectedEventId, setSelectedEventId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState(null)

  // 1. Catálogo de filtros
  const { data: catalog } = useQuery({
    queryKey: ["audit-catalog"],
    queryFn: getAuditCatalog,
    staleTime: 5 * 60 * 1000,
  })

  // 2. Métricas y KPIs
  const {
    data: summary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ["audit-summary"],
    queryFn: getAuditSummary,
    staleTime: 30 * 1000,
  })

  // 3. Listado paginado de eventos
  const queryParams = {
    page,
    page_size: pageSize,
    ...(search ? { search } : {}),
    ...(selectedModule ? { module: selectedModule } : {}),
    ...(selectedCategory ? { event_category: selectedCategory } : {}),
    ...(selectedSeverity ? { severity: selectedSeverity } : {}),
    ...(selectedResult ? { result: selectedResult } : {}),
  }

  const {
    data: eventsData,
    isLoading: isEventsLoading,
    isError: isEventsError,
    error: eventsError,
    refetch: refetchEvents,
  } = useQuery({
    queryKey: ["audit-events", queryParams],
    queryFn: () => getAuditEvents(queryParams),
    staleTime: 15 * 1000,
  })

  // 4. Detalle de evento seleccionado (Forensic Modal)
  const {
    data: eventDetail,
    isLoading: isDetailLoading,
  } = useQuery({
    queryKey: ["audit-event-detail", selectedEventId],
    queryFn: () => getAuditEventDetail(selectedEventId),
    enabled: Boolean(selectedEventId),
    staleTime: 60 * 1000,
  })

  const handleRefreshAll = () => {
    refetchSummary()
    refetchEvents()
  }

  const handleExportCsv = async () => {
    try {
      setIsExporting(true)
      setExportError(null)
      const exportParams = {
        ...(search ? { search } : {}),
        ...(selectedModule ? { module: selectedModule } : {}),
        ...(selectedCategory ? { event_category: selectedCategory } : {}),
        ...(selectedSeverity ? { severity: selectedSeverity } : {}),
        ...(selectedResult ? { result: selectedResult } : {}),
      }
      const response = await exportAuditCsv(exportParams)
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", `levelpro-audit-${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(
        err.response?.status === 403
          ? "No posee permisos suficientes (export_audit) para descargar registros."
          : "Error al exportar registros de auditoría."
      )
    } finally {
      setIsExporting(false)
    }
  }

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text)
    setCopiedId(label)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return "—"
    try {
      const d = new Date(dateStr)
      return d.toLocaleString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    } catch {
      return dateStr
    }
  }

  const events = eventsData?.results || []
  const totalCount = eventsData?.count || 0
  const totalPages = eventsData?.total_pages || 1

  return (
    <div className="au-page" style={{ maxWidth: 1400, margin: "0 auto" }}>
      {/* ── Encabezado de Página ───────────────────────────────────── */}
      <AdminPageHeader
        title="Registro de Actividad y Auditoría"
        subtitle="Trazabilidad operacional inmutable append-only (ORM + Trigger PostgreSQL) y segregación RBAC de LEVELPRO OS V4.0."
        badge="GATE 1.2"
        badgeTone="success"
        actions={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <SecondaryButton
              icon={<RefreshCw size={15} />}
              onClick={handleRefreshAll}
              disabled={isEventsLoading || isSummaryLoading}
            >
              Actualizar
            </SecondaryButton>
            <PrimaryButton
              icon={<Download size={15} />}
              onClick={handleExportCsv}
              disabled={isExporting}
            >
              {isExporting ? "Exportando..." : "Exportar CSV"}
            </PrimaryButton>
          </div>
        }
      />

      {exportError && (
        <div
          style={{
            marginTop: 16,
            padding: "12px 16px",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 8,
            color: "#B91C1C",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertTriangle size={16} />
          {exportError}
        </div>
      )}

      {/* ── KPIs (LevelPro Precision) ───────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
          marginTop: 24,
          marginBottom: 24,
        }}
      >
        {isSummaryLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              variant="ink"
              label="TOTAL EVENTOS"
              value={summary?.total_events?.toLocaleString("es-CL") || "0"}
              sub="Registros auditados inmutables"
              Icon={Activity}
            />
            <StatCard
              variant="light"
              label="ÚLTIMAS 24 HORAS"
              value={summary?.last_24h_count?.toLocaleString("es-CL") || "0"}
              sub="Operaciones registradas"
              Icon={Clock}
            />
            <StatCard
              variant="light"
              label="ALERTAS Y CRÍTICOS"
              value={(
                (summary?.warning_count || 0) + (summary?.critical_count || 0)
              ).toLocaleString("es-CL")}
              sub="Eventos con severidad warning o critical"
              Icon={ShieldAlert}
            />
            <StatCard
              variant="primary"
              label="MÓDULOS ACTIVOS"
              value={summary?.modules_active_count || "0"}
              sub="Módulos con mutaciones auditadas"
              Icon={Shield}
            />
          </>
        )}
      </div>

      {/* ── Filtros Avanzados (Nimbus Filter Bar) ─────────────────── */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid var(--admin-border, #E4E4F0)",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 24,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, flex: 1, minWidth: 0 }}>
          {/* Búsqueda libre */}
          <div style={{ position: "relative", minWidth: "min(100%, 220px)", flex: "1 1 220px" }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--admin-text-muted)",
              }}
            />
            <input
              type="text"
              placeholder="Buscar por actor, recurso, acción..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              style={{
                ...formInputStyle,
                paddingLeft: 36,
              }}
            />
          </div>

          {/* Filtro Módulo */}
          <select
            value={selectedModule}
            onChange={(e) => {
              setSelectedModule(e.target.value)
              setPage(1)
            }}
            style={{ ...formInputStyle, width: "auto" }}
          >
            <option value="">Todos los Módulos</option>
            {catalog?.modules?.map((m) => (
              <option key={m.key} value={m.key}>
                {MODULE_DISPLAY_NAMES[m.key] || m.label}
              </option>
            ))}
          </select>

          {/* Filtro Categoría */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value)
              setPage(1)
            }}
            style={{ ...formInputStyle, width: "auto" }}
          >
            <option value="">Todas las Categorías</option>
            {catalog?.categories?.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>

          {/* Filtro Severidad */}
          <select
            value={selectedSeverity}
            onChange={(e) => {
              setSelectedSeverity(e.target.value)
              setPage(1)
            }}
            style={{ ...formInputStyle, width: "auto" }}
          >
            <option value="">Todas las Severidades</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>

          {/* Filtro Resultado */}
          <select
            value={selectedResult}
            onChange={(e) => {
              setSelectedResult(e.target.value)
              setPage(1)
            }}
            style={{ ...formInputStyle, width: "auto" }}
          >
            <option value="">Todos los Resultados</option>
            <option value="success">Exitoso</option>
            <option value="denied">Denegado</option>
            <option value="error">Error</option>
          </select>
        </div>

        {(search || selectedModule || selectedCategory || selectedSeverity || selectedResult) && (
          <button
            onClick={() => {
              setSearch("")
              setSelectedModule("")
              setSelectedCategory("")
              setSelectedSeverity("")
              setSelectedResult("")
              setPage(1)
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "#0F7A38",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "underline",
              padding: "4px 8px",
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* ── Tabla Principal de Eventos ─────────────────────────────── */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid var(--admin-border, #E4E4F0)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {isEventsLoading ? (
          <div style={{ padding: 24 }}>
            <SkeletonTable rows={10} />
          </div>
        ) : isEventsError ? (
          <ErrorState
            title="Error al cargar registros de auditoría"
            description={
              eventsError?.response?.status === 403
                ? "No posee la autorización RBAC requerida (view_audit) para consultar el registro de actividad."
                : "No fue posible conectar con el servicio de auditoría."
            }
            onRetry={refetchEvents}
          />
        ) : events.length === 0 ? (
          <EmptyState
            title="Sin eventos de auditoría"
            description="No se encontraron registros que coincidan con los filtros seleccionados."
          />
        ) : (
          <div className="au-tscroll">
            <table className="au-table">
              <thead>
                <tr>
                  <th>Fecha / Hora</th>
                  <th>Actor</th>
                  <th>Módulo</th>
                  <th>Acción</th>
                  <th>Recurso</th>
                  <th>Severidad</th>
                  <th>Resultado</th>
                  <th style={{ textAlign: "right" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr
                    key={ev.id}
                    onClick={() => setSelectedEventId(ev.id)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Fecha / Hora */}
                    <td
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: "var(--admin-text-secondary)",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(ev.created_at)}
                    </td>

                    {/* Actor */}
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ color: "var(--admin-text)", fontWeight: 600 }}>
                          {ev.actor?.email || ev.actor?.username || "Sistema (Automático)"}
                        </span>
                        {ev.actor?.roles?.length > 0 && (
                          <span style={{ fontSize: 11, color: "var(--admin-text-muted)", marginTop: 2 }}>
                            {ev.actor.roles.join(", ")}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Módulo */}
                    <td>
                      <StatusBadge tone="neutral">
                        {MODULE_DISPLAY_NAMES[ev.module] || ev.module}
                      </StatusBadge>
                    </td>

                    {/* Acción */}
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ color: "var(--admin-text)", fontWeight: 600, fontSize: 13 }}>
                          {ACTION_DISPLAY_NAMES[ev.action] || ev.action}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            color: "#0F7A38",
                            fontSize: 11,
                            marginTop: 2,
                          }}
                        >
                          {ev.action}
                        </span>
                      </div>
                    </td>

                    {/* Recurso */}
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", maxWidth: 220 }}>
                        <span style={{ color: "var(--admin-text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ev.resource_repr || ev.resource_type || "—"}
                        </span>
                        {ev.resource_id && (
                          <span
                            style={{
                              fontSize: 11,
                              fontFamily: "var(--font-mono)",
                              color: "var(--admin-text-muted)",
                            }}
                          >
                            {ev.resource_type}: {ev.resource_id.slice(0, 12)}...
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Severidad */}
                    <td>
                      <StatusBadge tone={SEVERITY_TONES[ev.severity] || "neutral"}>
                        {ev.severity_label || ev.severity}
                      </StatusBadge>
                    </td>

                    {/* Resultado */}
                    <td>
                      <StatusBadge tone={RESULT_TONES[ev.result] || "neutral"}>
                        {ev.result_label || ev.result}
                      </StatusBadge>
                    </td>

                    {/* Acciones */}
                    <td style={{ textAlign: "right" }}>
                      <SecondaryButton
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedEventId(ev.id)
                        }}
                      >
                        <Eye size={13} />
                        Detalle
                      </SecondaryButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {totalCount > 0 && (
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid var(--admin-border, #E4E4F0)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              background: "#FAFAFA",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "var(--admin-text-muted)" }}>
              <span>
                Mostrando página <strong style={{ color: "var(--admin-text)" }}>{page}</strong> de{" "}
                <strong style={{ color: "var(--admin-text)" }}>{totalPages}</strong> ({totalCount} eventos)
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                style={{ ...formInputStyle, width: "auto", padding: "4px 8px", fontSize: 12 }}
              >
                <option value={10}>10 por pág.</option>
                <option value={25}>25 por pág.</option>
                <option value={50}>50 por pág.</option>
                <option value={100}>100 por pág.</option>
              </select>
            </div>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </div>

      {/* ── SideModal Forense de Detalle (Forensics View) ──────────────── */}
      <SideModal
        open={Boolean(selectedEventId)}
        onClose={() => setSelectedEventId(null)}
        subtitle="AUDITORÍA FORENSE INMUTABLE · APPEND-ONLY"
        title={
          eventDetail
            ? `Evento: ${ACTION_DISPLAY_NAMES[eventDetail.action] || eventDetail.action}`
            : "Detalle Forense de Auditoría"
        }
        maxWidth={760}
        testId="audit-detail-sidemodal"
      >
        {isDetailLoading || !eventDetail ? (
          <div style={{ padding: 30, textAlign: "center", color: "var(--admin-text-muted)" }}>
            Cargando evidencia forense...
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Encabezado del Evento */}
            <div
              style={{
                background: "#FAFAFA",
                border: "1px solid var(--admin-border, #E4E4F0)",
                borderTop: "2.5px solid #09090B",
                borderRadius: 10,
                padding: "16px 18px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 14,
              }}
            >
              <div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--admin-text-muted)", display: "block" }}>
                  FECHA Y HORA
                </span>
                <span style={{ fontSize: 12.5, fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>
                  {formatDate(eventDetail.created_at)}
                </span>
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--admin-text-muted)", display: "block" }}>
                  MÓDULO & CATEGORÍA
                </span>
                <span style={{ fontSize: 13, color: "var(--admin-text)", fontWeight: 600 }}>
                  {MODULE_DISPLAY_NAMES[eventDetail.module] || eventDetail.module} —{" "}
                  {eventDetail.category_label || eventDetail.event_category}
                </span>
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--admin-text-muted)", display: "block" }}>
                  SEVERIDAD & RESULTADO
                </span>
                <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                  <StatusBadge tone={SEVERITY_TONES[eventDetail.severity] || "neutral"}>
                    {eventDetail.severity_label || eventDetail.severity}
                  </StatusBadge>
                  <StatusBadge tone={RESULT_TONES[eventDetail.result] || "neutral"}>
                    {eventDetail.result_label || eventDetail.result}
                  </StatusBadge>
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--admin-text-muted)", display: "block" }}>
                  CORRELATION ID
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--admin-text-secondary)",
                      background: "#FFFFFF",
                      border: "1px solid var(--admin-border)",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    {eventDetail.correlation_id?.slice(0, 16)}...
                  </span>
                  <button
                    onClick={() => copyToClipboard(eventDetail.correlation_id, "corr")}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: copiedId === "corr" ? "#0F7A38" : "var(--admin-text-muted)",
                      cursor: "pointer",
                    }}
                    title="Copiar Correlation ID"
                  >
                    {copiedId === "corr" ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Tarjeta del Actor y Contexto de Red */}
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid var(--admin-border)",
                borderRadius: 10,
                padding: "16px 18px",
              }}
            >
              <h4
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--admin-text-muted)",
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <User size={14} color="#0F7A38" />
                Contexto de Identidad y Operación
              </h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 12,
                  fontSize: 13,
                }}
              >
                <div>
                  <span style={{ color: "var(--admin-text-muted)", fontSize: 11, fontWeight: 600 }}>ACTOR:</span>
                  <p style={{ color: "var(--admin-text)", fontWeight: 600, margin: "2px 0 0" }}>
                    {eventDetail.actor?.email || eventDetail.actor?.username || "Sistema (Automático)"}
                  </p>
                </div>
                <div>
                  <span style={{ color: "var(--admin-text-muted)", fontSize: 11, fontWeight: 600 }}>ROLES ACTIVOS:</span>
                  <p style={{ color: "#0F7A38", fontWeight: 600, margin: "2px 0 0" }}>
                    {eventDetail.actor?.roles?.length ? eventDetail.actor.roles.join(", ") : "Sin roles asignados"}
                  </p>
                </div>
                <div>
                  <span style={{ color: "var(--admin-text-muted)", fontSize: 11, fontWeight: 600 }}>IP DE ORIGEN:</span>
                  <p style={{ color: "var(--admin-text-secondary)", fontFamily: "var(--font-mono)", margin: "2px 0 0" }}>
                    {eventDetail.ip_address || "127.0.0.1"}
                  </p>
                </div>
                <div>
                  <span style={{ color: "var(--admin-text-muted)", fontSize: 11, fontWeight: 600 }}>ORIGEN / FUENTE:</span>
                  <p style={{ color: "var(--admin-text-secondary)", margin: "2px 0 0" }}>
                    {eventDetail.source || "api"}
                  </p>
                </div>
              </div>
            </div>

            {/* Alerta de Enmascaramiento RBAC si aplica */}
            {eventDetail.financial_masked && (
              <div
                style={{
                  background: "#FFFBEB",
                  border: "1px solid #FDE68A",
                  borderRadius: 8,
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 12,
                  color: "#92400E",
                }}
              >
                <Lock size={15} />
                <span>
                  <strong>Restricción RBAC:</strong> Los campos de costos, márgenes y finanzas han sido enmascarados dinámicamente según las capacidades de su rol actual.
                </span>
              </div>
            )}

            {/* Comparador Visual Forense de Estados (Diff) */}
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid var(--admin-border)",
                borderRadius: 10,
                padding: "16px 18px",
              }}
            >
              <h4
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--admin-text-muted)",
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Database size={14} color="#2563EB" />
                Evidencia Forense y Mutación de Estado
              </h4>

              {eventDetail.changed_fields?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--admin-text-muted)" }}>
                    CAMPOS MODIFICADOS:
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                    {eventDetail.changed_fields.map((f) => (
                      <span
                        key={f}
                        style={{
                          background: "#EFF6FF",
                          border: "1px solid #BFDBFE",
                          borderRadius: 4,
                          padding: "2px 8px",
                          fontSize: 11,
                          fontFamily: "var(--font-mono)",
                          color: "#1D4ED8",
                        }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                }}
              >
                {/* Valores Previos */}
                <div
                  style={{
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#B91C1C",
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    ESTADO ANTERIOR (PREVIOUS)
                  </span>
                  <pre
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--admin-text)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {Object.keys(eventDetail.previous_values || {}).length > 0
                      ? JSON.stringify(eventDetail.previous_values, null, 2)
                      : "— (Creación inicial)"}
                  </pre>
                </div>

                {/* Valores Nuevos */}
                <div
                  style={{
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#0F7A38",
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    NUEVO ESTADO (NEW VALUES)
                  </span>
                  <pre
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--admin-text)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {Object.keys(eventDetail.new_values || {}).length > 0
                      ? JSON.stringify(eventDetail.new_values, null, 2)
                      : "— (Eliminación final)"}
                  </pre>
                </div>
              </div>

              {/* Metadatos adicionales */}
              {eventDetail.metadata && Object.keys(eventDetail.metadata).length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--admin-text-muted)",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    METADATOS DEL EVENTO:
                  </span>
                  <pre
                    style={{
                      margin: 0,
                      background: "#FAFAFA",
                      border: "1px solid var(--admin-border)",
                      borderRadius: 6,
                      padding: 10,
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--admin-text-secondary)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {JSON.stringify(eventDetail.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </SideModal>
    </div>
  )
}
