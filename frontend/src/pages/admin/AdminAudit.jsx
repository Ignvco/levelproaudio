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
  FormModal,
  PrimaryButton,
  SecondaryButton,
  EmptyState,
  ErrorState,
  SkeletonTable,
  SkeletonCard,
  Pagination,
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
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 20px" }}>
      {/* ── Encabezado de Página ───────────────────────────────────── */}
      <AdminPageHeader
        title="Registro de Actividad y Auditoría"
        subtitle="Trazabilidad operacional inmutable append-only con verificación criptográfica y segregación RBAC de LEVELPRO OS V4.0."
        badge="GATE 1.2"
        badgeTone="success"
        actions={
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: 8,
            color: "#F87171",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertTriangle size={16} />
          {exportError}
        </div>
      )}

      {/* ── KPIs y Bento Stat Cards ─────────────────────────────────── */}
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
              label="TOTAL EVENTOS"
              value={summary?.total_events?.toLocaleString("es-CL") || "0"}
              helperText="Registros auditados inmutables"
              icon={<Activity size={20} color="#1AFF6E" />}
            />
            <StatCard
              label="ÚLTIMAS 24 HORAS"
              value={summary?.last_24h_count?.toLocaleString("es-CL") || "0"}
              helperText="Operaciones registradas"
              icon={<Clock size={20} color="#60A5FA" />}
            />
            <StatCard
              label="ALERTAS Y CRÍTICOS"
              value={(
                (summary?.warning_count || 0) + (summary?.critical_count || 0)
              ).toLocaleString("es-CL")}
              helperText="Eventos con severidad warning o critical"
              icon={<ShieldAlert size={20} color="#F59E0B" />}
            />
            <StatCard
              label="MÓDULOS ACTIVOS"
              value={summary?.modules_active_count || "0"}
              helperText="Módulos con mutaciones auditadas"
              icon={<Shield size={20} color="#A78BFA" />}
            />
          </>
        )}
      </div>

      {/* ── Filtros Avanzados (Editorial Bento Bar) ─────────────────── */}
      <div
        style={{
          background: "#0D0E11",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 24,
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, flex: 1, minWidth: 300 }}>
          {/* Búsqueda libre */}
          <div style={{ position: "relative", minWidth: 260, flex: "1 1 260px" }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "rgba(255, 255, 255, 0.4)",
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
                width: "100%",
                background: "#14161B",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: 8,
                padding: "8px 12px 8px 36px",
                color: "#FFFFFF",
                fontSize: 13,
                outline: "none",
                fontFamily: "Geist, sans-serif",
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
            style={{
              background: "#14161B",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: 8,
              padding: "8px 12px",
              color: "#FFFFFF",
              fontSize: 13,
              outline: "none",
            }}
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
            style={{
              background: "#14161B",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: 8,
              padding: "8px 12px",
              color: "#FFFFFF",
              fontSize: 13,
              outline: "none",
            }}
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
            style={{
              background: "#14161B",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: 8,
              padding: "8px 12px",
              color: "#FFFFFF",
              fontSize: 13,
              outline: "none",
            }}
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
            style={{
              background: "#14161B",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: 8,
              padding: "8px 12px",
              color: "#FFFFFF",
              fontSize: 13,
              outline: "none",
            }}
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
              color: "#1AFF6E",
              fontSize: 12,
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
          background: "#0D0E11",
          border: "1px solid rgba(255, 255, 255, 0.08)",
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
            message={
              eventsError?.response?.status === 403
                ? "No posee la autorización RBAC requerida (view_audit) para consultar el registro de actividad."
                : "No fue posible conectar con el servicio de auditoría."
            }
            onRetry={refetchEvents}
          />
        ) : events.length === 0 ? (
          <EmptyState
            title="Sin eventos de auditoría"
            message="No se encontraron registros que coincidan con los filtros seleccionados."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr
                  style={{
                    background: "rgba(255, 255, 255, 0.02)",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "rgba(255, 255, 255, 0.5)",
                    fontFamily: "Geist Mono, monospace",
                  }}
                >
                  <th style={{ padding: "14px 16px" }}>Fecha / Hora</th>
                  <th style={{ padding: "14px 16px" }}>Actor</th>
                  <th style={{ padding: "14px 16px" }}>Módulo</th>
                  <th style={{ padding: "14px 16px" }}>Acción</th>
                  <th style={{ padding: "14px 16px" }}>Recurso</th>
                  <th style={{ padding: "14px 16px" }}>Severidad</th>
                  <th style={{ padding: "14px 16px" }}>Resultado</th>
                  <th style={{ padding: "14px 16px", textAlign: "right" }}>Acción</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: 13 }}>
                {events.map((ev) => (
                  <tr
                    key={ev.id}
                    onClick={() => setSelectedEventId(ev.id)}
                    style={{
                      borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Fecha / Hora */}
                    <td
                      style={{
                        padding: "14px 16px",
                        fontFamily: "Geist Mono, monospace",
                        color: "rgba(255, 255, 255, 0.8)",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(ev.created_at)}
                    </td>

                    {/* Actor */}
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ color: "#FFFFFF", fontWeight: 500 }}>
                          {ev.actor?.email || ev.actor?.username || "Sistema (Automático)"}
                        </span>
                        {ev.actor?.roles?.length > 0 && (
                          <span
                            style={{
                              fontSize: 11,
                              color: "rgba(255, 255, 255, 0.4)",
                              marginTop: 2,
                            }}
                          >
                            {ev.actor.roles.join(", ")}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Módulo */}
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        style={{
                          background: "rgba(255, 255, 255, 0.06)",
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 12,
                          color: "rgba(255, 255, 255, 0.85)",
                          fontWeight: 500,
                        }}
                      >
                        {MODULE_DISPLAY_NAMES[ev.module] || ev.module}
                      </span>
                    </td>

                    {/* Acción */}
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        style={{
                          fontFamily: "Geist Mono, monospace",
                          color: "#1AFF6E",
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        {ev.action}
                      </span>
                    </td>

                    {/* Recurso */}
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", flexDirection: "column", maxWidth: 220 }}>
                        <span style={{ color: "#FFFFFF", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ev.resource_repr || ev.resource_type || "—"}
                        </span>
                        {ev.resource_id && (
                          <span
                            style={{
                              fontSize: 11,
                              fontFamily: "Geist Mono, monospace",
                              color: "rgba(255, 255, 255, 0.4)",
                            }}
                          >
                            {ev.resource_type}: {ev.resource_id.slice(0, 12)}...
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Severidad */}
                    <td style={{ padding: "14px 16px" }}>
                      <StatusBadge
                        status={SEVERITY_TONES[ev.severity] || "neutral"}
                        text={ev.severity_label || ev.severity}
                      />
                    </td>

                    {/* Resultado */}
                    <td style={{ padding: "14px 16px" }}>
                      <StatusBadge
                        status={RESULT_TONES[ev.result] || "neutral"}
                        text={ev.result_label || ev.result}
                      />
                    </td>

                    {/* Acciones */}
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedEventId(ev.id)
                        }}
                        style={{
                          background: "rgba(26, 255, 110, 0.08)",
                          border: "1px solid rgba(26, 255, 110, 0.25)",
                          borderRadius: 6,
                          padding: "6px 10px",
                          color: "#1AFF6E",
                          fontSize: 12,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontWeight: 500,
                        }}
                      >
                        <Eye size={13} />
                        Detalle
                      </button>
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
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "rgba(255, 255, 255, 0.5)" }}>
              <span>
                Mostrando página <strong style={{ color: "#FFFFFF" }}>{page}</strong> de{" "}
                <strong style={{ color: "#FFFFFF" }}>{totalPages}</strong> ({totalCount} eventos)
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                style={{
                  background: "#14161B",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: 6,
                  padding: "4px 8px",
                  color: "#FFFFFF",
                  fontSize: 12,
                  outline: "none",
                }}
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

      {/* ── Modal Forense de Detalle (Forensics View) ────────────────── */}
      {selectedEventId && (
        <FormModal
          open={Boolean(selectedEventId)}
          isOpen={Boolean(selectedEventId)}
          onClose={() => setSelectedEventId(null)}
          title={`Evento de Auditoría: ${eventDetail?.action || "Cargando..."}`}
          maxWidth="820px"
          scrollableBody={true}
        >
          {isDetailLoading || !eventDetail ? (
            <div style={{ padding: 30, textAlign: "center", color: "rgba(255, 255, 255, 0.5)" }}>
              Cargando evidencia forense...
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Encabezado del Evento */}
              <div
                style={{
                  background: "#14161B",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 10,
                  padding: "16px 20px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 14,
                }}
              >
                <div>
                  <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.4)", display: "block" }}>
                    FECHA Y HORA
                  </span>
                  <span style={{ fontSize: 13, fontFamily: "Geist Mono, monospace", color: "#FFFFFF" }}>
                    {formatDate(eventDetail.created_at)}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.4)", display: "block" }}>
                    MÓDULO & CATEGORÍA
                  </span>
                  <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 500 }}>
                    {MODULE_DISPLAY_NAMES[eventDetail.module] || eventDetail.module} —{" "}
                    {eventDetail.category_label || eventDetail.event_category}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.4)", display: "block" }}>
                    SEVERIDAD & RESULTADO
                  </span>
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <StatusBadge
                      status={SEVERITY_TONES[eventDetail.severity] || "neutral"}
                      text={eventDetail.severity_label || eventDetail.severity}
                    />
                    <StatusBadge
                      status={RESULT_TONES[eventDetail.result] || "neutral"}
                      text={eventDetail.result_label || eventDetail.result}
                    />
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.4)", display: "block" }}>
                    CORRELATION ID (TRAZABILIDAD)
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <span
                      style={{
                        fontFamily: "Geist Mono, monospace",
                        fontSize: 11,
                        color: "rgba(255, 255, 255, 0.7)",
                        background: "rgba(255, 255, 255, 0.05)",
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
                        color: copiedId === "corr" ? "#1AFF6E" : "rgba(255, 255, 255, 0.5)",
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
                  background: "#14161B",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 10,
                  padding: "16px 20px",
                }}
              >
                <h4
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "rgba(255, 255, 255, 0.5)",
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <User size={14} color="#1AFF6E" />
                  Contexto de Identidad y Operación
                </h4>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                    fontSize: 13,
                  }}
                >
                  <div>
                    <span style={{ color: "rgba(255, 255, 255, 0.4)", fontSize: 11 }}>ACTOR:</span>
                    <p style={{ color: "#FFFFFF", fontWeight: 500, margin: "2px 0 0" }}>
                      {eventDetail.actor?.email || eventDetail.actor?.username || "Sistema (Automático)"}
                    </p>
                  </div>
                  <div>
                    <span style={{ color: "rgba(255, 255, 255, 0.4)", fontSize: 11 }}>ROLES ACTIVOS:</span>
                    <p style={{ color: "#1AFF6E", fontWeight: 500, margin: "2px 0 0" }}>
                      {eventDetail.actor?.roles?.length ? eventDetail.actor.roles.join(", ") : "Sin roles asignados"}
                    </p>
                  </div>
                  <div>
                    <span style={{ color: "rgba(255, 255, 255, 0.4)", fontSize: 11 }}>IP DE ORIGEN:</span>
                    <p style={{ color: "rgba(255, 255, 255, 0.8)", fontFamily: "Geist Mono, monospace", margin: "2px 0 0" }}>
                      {eventDetail.ip_address || "127.0.0.1"}
                    </p>
                  </div>
                  <div>
                    <span style={{ color: "rgba(255, 255, 255, 0.4)", fontSize: 11 }}>ORIGEN / FUENTE:</span>
                    <p style={{ color: "rgba(255, 255, 255, 0.8)", margin: "2px 0 0" }}>
                      {eventDetail.source || "api"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Alerta de Enmascaramiento RBAC si aplica */}
              {eventDetail.financial_masked && (
                <div
                  style={{
                    background: "rgba(245, 158, 11, 0.08)",
                    border: "1px solid rgba(245, 158, 11, 0.25)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 12,
                    color: "#FBBF24",
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
                  background: "#14161B",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 10,
                  padding: "16px 20px",
                }}
              >
                <h4
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "rgba(255, 255, 255, 0.5)",
                    marginBottom: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Database size={14} color="#60A5FA" />
                  Evidencia Forense y Mutación de Estado
                </h4>

                {eventDetail.changed_fields?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.4)" }}>
                      CAMPOS MODIFICADOS:
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                      {eventDetail.changed_fields.map((f) => (
                        <span
                          key={f}
                          style={{
                            background: "rgba(96, 165, 250, 0.12)",
                            border: "1px solid rgba(96, 165, 250, 0.3)",
                            borderRadius: 4,
                            padding: "2px 8px",
                            fontSize: 11,
                            fontFamily: "Geist Mono, monospace",
                            color: "#93C5FD",
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
                    gap: 16,
                  }}
                >
                  {/* Valores Previos */}
                  <div
                    style={{
                      background: "rgba(239, 68, 68, 0.04)",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#F87171",
                        display: "block",
                        marginBottom: 8,
                      }}
                    >
                      ESTADO ANTERIOR (PREVIOUS)
                    </span>
                    <pre
                      style={{
                        margin: 0,
                        fontFamily: "Geist Mono, monospace",
                        fontSize: 12,
                        color: "rgba(255, 255, 255, 0.8)",
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
                      background: "rgba(26, 255, 110, 0.04)",
                      border: "1px solid rgba(26, 255, 110, 0.2)",
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#1AFF6E",
                        display: "block",
                        marginBottom: 8,
                      }}
                    >
                      NUEVO ESTADO (NEW VALUES)
                    </span>
                    <pre
                      style={{
                        margin: 0,
                        fontFamily: "Geist Mono, monospace",
                        fontSize: 12,
                        color: "rgba(255, 255, 255, 0.8)",
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
                  <div style={{ marginTop: 16 }}>
                    <span
                      style={{
                        fontSize: 11,
                        color: "rgba(255, 255, 255, 0.4)",
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      METADATOS DEL EVENTO:
                    </span>
                    <pre
                      style={{
                        margin: 0,
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid rgba(255, 255, 255, 0.06)",
                        borderRadius: 6,
                        padding: 10,
                        fontFamily: "Geist Mono, monospace",
                        fontSize: 11,
                        color: "rgba(255, 255, 255, 0.6)",
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
        </FormModal>
      )}
    </div>
  )
}
