// pages/admin/AdminUsers.jsx
// LEVELPRO OS V4.0 — GATE 8 (BF-21): CRM Técnico, Organizaciones, Contactos Multi-Org & Ficha 360° + Gestión RBAC
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getAdminUsers } from "../../api/admin.api"
import { getAdminRoles, manageUserRole } from "../../api/rbac.api"
import {
  getCrmCustomers,
  saveCrmCustomer,
  getCrmCustomer360,
  upsertCrmTechnicalProfile,
  logCrmInteraction,
  getCrmOrganizations,
  saveCrmOrganization,
  addCrmOrgContact,
} from "../../api/b2b.api"
import {
  DataTable,
  StatusBadge,
  AdminPageHeader,
  StatCard,
  FormModal,
  FormField,
  formInputStyle,
  SecondaryButton,
  PrimaryButton,
  SideModal,
} from "../../components/admin/ui"
import {
  Users as UsersIcon,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  Key,
  Plus,
  Trash2,
  Building2,
  Eye,
  Sliders,
  MessageSquare,
  X,
} from "lucide-react"
import { listFromResponse, queryDisplayState } from "../../utils/queryDisplayState"
import { adminUserRole } from "../../utils/adminListData"
import { showToast } from "../../utils/toast"
import { formatCurrency } from "../../utils/accountingCurrency"

const ROLE = {
  super: { label: "Super", tone: "info" },
  admin: { label: "Admin", tone: "success" },
  cliente: { label: "Cliente", tone: "neutral" },
  unknown: { label: "Sin datos", tone: "neutral" },
}

const ROLE_TONE_MAP = {
  "Super Admin": "error",
  "Gerencia / Administración": "warning",
  "Ventas": "success",
  "Compras": "info",
  "Bodega": "neutral",
  "Logística": "neutral",
  "Finanzas / Contabilidad": "warning",
  "Marketing": "info",
  "Academia": "success",
  "Soporte Técnico": "neutral",
}

const HIGH_PRIVILEGE_ROLES = new Set([
  "Super Admin",
  "Gerencia / Administración",
  "Finanzas / Contabilidad",
])

const SEGMENT_LABELS = {
  standard: "Estándar",
  pro_studio: "Estudio Pro",
  wholesale: "Mayorista",
  distributor: "Distribuidor",
  institutional: "Institucional",
}

const ORG_TYPE_LABELS = {
  studio: "Estudio de Grabación",
  production_company: "Productora",
  enterprise: "Empresa",
  institution: "Institución",
  distributor: "Distribuidor",
  individual_pro: "Profesional Indep.",
}

export default function AdminUsers() {
  const [activeTab, setActiveTab] = useState("crm") // crm | organizations | rbac
  const [roleFilter, setRoleFilter] = useState("")
  const [selectedUser, setSelectedUser] = useState(null)
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [roleToAssign, setRoleToAssign] = useState("")
  const [actionError, setActionError] = useState(null)
  const [pendingConfirmAction, setPendingConfirmAction] = useState(null)

  // CRM State
  const [selected360Id, setSelected360Id] = useState(null)
  const [orgModalOpen, setOrgModalOpen] = useState(false)
  const [orgForm, setOrgForm] = useState({
    legal_name: "", trade_name: "", customer_type: "studio", country: "CL",
    tax_id: "", commercial_segment: "pro_studio", billing_email: "", phone: "", authorized_notes: "",
  })
  const [cusModalOpen, setCusModalOpen] = useState(false)
  const [cusForm, setCusForm] = useState({
    full_name: "", email: "", phone: "", country: "CL", tax_id: "",
    commercial_segment: "standard", primary_organization_id: "", preferred_currency: "CLP",
  })
  const [contactOrgId, setContactOrgId] = useState(null)
  const [contactForm, setContactForm] = useState({
    full_name: "", email: "", role_title: "", phone: "", is_primary: true, can_use_credit: true,
  })
  const [techForm, setTechForm] = useState({
    primary_activity: "", facility_type: "", primary_daw: "",
    monitors: "", microphones: "", brands_of_interest: "", future_needs: "",
  })
  const [interForm, setInterForm] = useState({
    interaction_type: "call", subject: "", summary: "", outcome: "",
  })

  const queryClient = useQueryClient()

  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: () => getAdminUsers({}) })
  const rolesQuery = useQuery({ queryKey: ["admin-roles-list"], queryFn: getAdminRoles })
  const crmCustomersQuery = useQuery({ queryKey: ["crm-customers"], queryFn: () => getCrmCustomers({}) })
  const crmOrgsQuery = useQuery({ queryKey: ["crm-organizations"], queryFn: getCrmOrganizations })
  const view360Query = useQuery({
    queryKey: ["crm-360", selected360Id],
    queryFn: () => getCrmCustomer360(selected360Id),
    enabled: !!selected360Id,
  })

  const availableRoles = rolesQuery.data?.results || []
  const crmCustomers = crmCustomersQuery.data?.results || []
  const crmOrgs = crmOrgsQuery.data?.results || []

  const roleMutation = useMutation({
    mutationFn: ({ userId, role, action }) => manageUserRole(userId, role, action),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      queryClient.invalidateQueries({ queryKey: ["admin-roles-list"] })
      queryClient.invalidateQueries({ queryKey: ["my-permissions"] })
      if (selectedUser) setSelectedUser({ ...selectedUser, roles: data.roles })
      setActionError(null)
      setPendingConfirmAction(null)
    },
    onError: (err) => setActionError(err.response?.data?.error || "Error al actualizar roles del usuario."),
  })

  const saveOrgMut = useMutation({
    mutationFn: saveCrmOrganization,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["crm-organizations"] })
      setOrgModalOpen(false)
      showToast(`Organización ${res.code} guardada.`)
    },
    onError: (e) => showToast(e?.response?.data?.error || "Error al guardar organización.", "error"),
  })

  const saveCusMut = useMutation({
    mutationFn: saveCrmCustomer,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["crm-customers"] })
      setCusModalOpen(false)
      showToast(`Cliente ${res.code} guardado.`)
    },
    onError: (e) => showToast(e?.response?.data?.error || "Error al guardar cliente.", "error"),
  })

  const addContactMut = useMutation({
    mutationFn: ({ orgId, payload }) => addCrmOrgContact(orgId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-organizations"] })
      if (selected360Id) queryClient.invalidateQueries({ queryKey: ["crm-360", selected360Id] })
      setContactOrgId(null)
      showToast("Contacto agregado a la organización.")
    },
    onError: (e) => showToast(e?.response?.data?.error || "Error al agregar contacto.", "error"),
  })

  const saveTechMut = useMutation({
    mutationFn: ({ id, payload }) => upsertCrmTechnicalProfile(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-360", selected360Id] })
      showToast("Perfil técnico de estudio actualizado.")
    },
    onError: (e) => showToast(e?.response?.data?.error || "Error al guardar perfil técnico.", "error"),
  })

  const logInterMut = useMutation({
    mutationFn: ({ id, payload }) => logCrmInteraction(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-360", selected360Id] })
      setInterForm({ interaction_type: "call", subject: "", summary: "", outcome: "" })
      showToast("Seguimiento comercial registrado.")
    },
    onError: (e) => showToast(e?.response?.data?.error || "Error al registrar seguimiento.", "error"),
  })

  const state = queryDisplayState(usersQuery)
  const allUsers = listFromResponse(usersQuery.data).map(u => ({ ...u, _role: adminUserRole(u) }))
  const users = allUsers.filter(u => {
    if (!roleFilter) return true
    if (roleFilter === "super" || roleFilter === "admin" || roleFilter === "cliente") return u._role === roleFilter
    return u.roles?.includes(roleFilter)
  })

  const totalCount = state === "ready" ? (usersQuery.data?.count ?? allUsers.length) : "—"
  const rolesKnown = state === "ready" && allUsers.every(u => u._role !== "unknown")
  const clientCount = rolesKnown ? allUsers.filter(u => u._role === "cliente").length : "—"
  const staffCount = rolesKnown ? allUsers.filter(u => u._role === "admin" || u._role === "super").length : "—"

  const handleOpenRoleModal = (u) => {
    setSelectedUser(u)
    setRoleToAssign("")
    setActionError(null)
    setPendingConfirmAction(null)
    setRoleModalOpen(true)
  }

  const handleRequestRoleChange = (userId, role, action) => {
    if (HIGH_PRIVILEGE_ROLES.has(role) || action === "remove") {
      setPendingConfirmAction({ userId, role, action })
      return
    }
    roleMutation.mutate({ userId, role, action })
  }

  const columns = [
    {
      key: "first_name", header: "Usuario", sortable: true, render: u => (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
            background: "var(--admin-primary-soft)", color: "var(--admin-primary-text)",
            fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {(u.first_name?.[0] || u.email?.[0] || "U").toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {u.first_name || u.last_name ? `${u.first_name || ""} ${u.last_name || ""}`.trim() : "Sin nombre"}
            </p>
            {u.phone && <p style={{ fontSize: 11, color: "var(--admin-text-muted)" }}>{u.phone}</p>}
          </div>
        </div>
      ),
    },
    { key: "email", header: "Email", sortable: true, render: u => <span style={{ color: "var(--admin-text-secondary)", fontFamily: "var(--font-mono)", fontSize: "12.5px" }}>{u.email}</span> },
    { key: "orders_count", header: "Pedidos", sortable: true, align: "center", render: u => <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{u.orders_count || 0}</span> },
    {
      key: "roles", header: "Roles y Acceso", render: u => {
        const userRoles = u.roles || []
        if (userRoles.length > 0) {
          return (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {userRoles.map(r => <StatusBadge key={r} tone={ROLE_TONE_MAP[r] || "info"}>{r}</StatusBadge>)}
            </div>
          )
        }
        return <StatusBadge tone={ROLE[u._role]?.tone || "neutral"}>{ROLE[u._role]?.label || "Cliente"}</StatusBadge>
      },
    },
    {
      key: "actions", header: "Acciones", align: "right", render: u => (
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <SecondaryButton onClick={() => setSelected360Id(u.id)} style={{ fontSize: 11.5, padding: "4px 8px" }}>
            <Eye size={12} style={{ marginRight: 4 }} /> 360°
          </SecondaryButton>
          <SecondaryButton onClick={() => handleOpenRoleModal(u)} style={{ fontSize: 11.5, padding: "4px 8px" }}>
            <Key size={12} style={{ marginRight: 4 }} /> Roles
          </SecondaryButton>
        </div>
      ),
    },
  ]

  const crmCols = [
    {
      key: "code", header: "Código / Cliente", render: c => (
        <div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--admin-text-muted)" }}>{c.code}</span>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{c.full_name}</div>
          <div style={{ fontSize: 11.5, color: "var(--admin-text-muted)" }}>{c.email}</div>
        </div>
      ),
    },
    {
      key: "tax_id", header: "ID Tributario", render: c => (
        <div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{c.tax_id || "—"}</span>
          {c.tax_id && (
            <div><StatusBadge tone={c.tax_id_validated ? "success" : "warning"}>{c.tax_id_validated ? "Dígito OK" : "Sin validar"}</StatusBadge></div>
          )}
        </div>
      ),
    },
    { key: "commercial_segment", header: "Segmento", render: c => <StatusBadge tone="info">{SEGMENT_LABELS[c.commercial_segment] || c.commercial_segment}</StatusBadge> },
    { key: "organization_name", header: "Organización", render: c => <span style={{ fontSize: 12.5 }}>{c.organization_name || "Cuenta individual"}</span> },
    {
      key: "actions", header: "Ficha 360°", align: "right", render: c => (
        <PrimaryButton size="sm" data-testid={`open-360-${c.id}`} onClick={() => setSelected360Id(c.id)}>
          <Eye size={13} style={{ marginRight: 4 }} /> Ver Ficha 360°
        </PrimaryButton>
      ),
    },
  ]

  const orgCols = [
    {
      key: "code", header: "Organización", render: o => (
        <div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--admin-text-muted)" }}>{o.code}</span>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{o.legal_name}</div>
          {o.trade_name && <div style={{ fontSize: 11.5, color: "var(--admin-text-muted)" }}>{o.trade_name}</div>}
        </div>
      ),
    },
    { key: "customer_type", header: "Tipo", render: o => <span style={{ fontSize: 12.5 }}>{ORG_TYPE_LABELS[o.customer_type] || o.customer_type}</span> },
    {
      key: "tax_id", header: "RUT/CUIT", render: o => (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
          {o.country} · {o.tax_id || "—"}
        </div>
      ),
    },
    { key: "commercial_segment", header: "Segmento", render: o => <StatusBadge tone="success">{SEGMENT_LABELS[o.commercial_segment] || o.commercial_segment}</StatusBadge> },
    { key: "contacts_count", header: "Contactos", align: "center", render: o => <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{o.contacts_count}</span> },
    {
      key: "actions", header: "Acciones", align: "right", render: o => (
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <SecondaryButton size="sm" onClick={() => setContactOrgId(o.id)}>+ Contacto</SecondaryButton>
          <PrimaryButton size="sm" data-testid={`open-org-360-${o.id}`} onClick={() => setSelected360Id(o.id)}>360°</PrimaryButton>
        </div>
      ),
    },
  ]

  const d360 = view360Query.data

  return (
    <div className="au-page" data-testid="admin-users-page">
      <AdminPageHeader
        eyebrow="LEVELPRO OS V4.0 / GATE 8 CRM & RBAC"
        title="CRM 360°, Organizaciones y Usuarios"
        description="Directorio de clientes técnicos, cuentas corporativas B2B, perfilamiento de estudios y control RBAC."
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <SecondaryButton data-testid="crm-new-customer-btn" onClick={() => setCusModalOpen(true)}>
              <Plus size={14} style={{ marginRight: 4 }} /> Nuevo Cliente CRM
            </SecondaryButton>
            <PrimaryButton data-testid="crm-new-org-btn" onClick={() => setOrgModalOpen(true)}>
              <Building2 size={14} style={{ marginRight: 4 }} /> Nueva Organización
            </PrimaryButton>
          </div>
        }
      />

      <div className="lp-kpi-strip">
        <StatCard variant="ink" Icon={UsersIcon} label="Clientes CRM" value={crmCustomers.length} sub="Fichas activas" />
        <StatCard variant="primary" Icon={Building2} label="Organizaciones B2B" value={crmOrgs.length} sub="Estudios y empresas" />
        <StatCard variant="light" Icon={UserCheck} label="Usuarios Registrados" value={totalCount} sub={`Staff: ${staffCount} · Clientes: ${clientCount}`} />
      </div>

      {/* Sub-tabs CRM / Organizaciones / RBAC — Nimbus underline tabs */}
      <div className="au-tabs hide-scroll" role="tablist" aria-label="CRM y RBAC">
        {[
          { id: "crm", label: "Directorio CRM & Ficha 360°" },
          { id: "organizations", label: "Organizaciones y Contactos" },
          { id: "rbac", label: "Usuarios y Roles RBAC" },
        ].map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            data-testid={`crm-tab-${t.id}`}
            onClick={() => setActiveTab(t.id)}
            className={`au-tab ${activeTab === t.id ? "is-active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "crm" && (
        <DataTable
          columns={crmCols}
          data={crmCustomers}
          loading={crmCustomersQuery.isLoading}
          getRowId={c => c.id}
          searchable
          searchKeys={["full_name", "email", "tax_id", "code"]}
          searchPlaceholder="Buscar cliente CRM por nombre, email o RUT/CUIT..."
          emptyIcon={UsersIcon}
          emptyTitle="Sin fichas CRM registradas"
          emptyDesc="Crea tu primera ficha de cliente técnico o vincula una organización."
          testId="crm-customers-table"
        />
      )}

      {activeTab === "organizations" && (
        <DataTable
          columns={orgCols}
          data={crmOrgs}
          loading={crmOrgsQuery.isLoading}
          getRowId={o => o.id}
          searchable
          searchKeys={["legal_name", "trade_name", "tax_id", "code"]}
          searchPlaceholder="Buscar organización por razón social o RUT/CUIT..."
          emptyIcon={Building2}
          emptyTitle="Sin organizaciones B2B"
          emptyDesc="Registra estudios de grabación, productoras, empresas o instituciones."
          testId="crm-organizations-table"
        />
      )}

      {activeTab === "rbac" && (
        <DataTable
          columns={columns}
          data={users}
          loading={state === "loading"}
          error={state === "error" ? "No se pudieron cargar los usuarios." : null}
          onRetry={() => usersQuery.refetch()}
          getRowId={u => u.id}
          searchable
          searchKeys={["first_name", "last_name", "email"]}
          searchPlaceholder="Buscar por nombre o email..."
          filters={[{
            label: "Rol", value: roleFilter, onChange: setRoleFilter,
            options: [
              { value: "", label: "Todos los roles" },
              { value: "cliente", label: "Clientes" },
              { value: "admin", label: "Staff / Admin General" },
              { value: "super", label: "Super Admin" },
              ...availableRoles.map(r => ({ value: r.name, label: `Rol: ${r.name}` })),
            ],
          }]}
          emptyIcon={UsersIcon}
          emptyTitle="No hay usuarios"
          emptyDesc="No hay usuarios con ese término o filtro."
          testId="users-table"
        />
      )}

      {/* PANEL FICHA 360° */}
      <SideModal
        open={!!selected360Id}
        onClose={() => setSelected360Id(null)}
        maxWidth={740}
        testId="crm-360-drawer"
        subtitle={`FICHA INTEGRAL 360° · ${d360?.identity?.code || "..."}`}
        title={d360?.identity?.full_name || "Cargando..."}
        headerExtra={
          <SecondaryButton size="sm" data-testid="close-360-btn" onClick={() => setSelected360Id(null)}>
            <X size={15} />
          </SecondaryButton>
        }
      >
        {view360Query.isLoading || !d360 ? (
          <p style={{ color: "var(--admin-text-muted)" }}>Consolidando historial 360°...</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 10,
              padding: 14, borderRadius: 12, background: "#FAFAFA", border: "1px solid #E4E4F0",
              borderTop: "2.5px solid #09090B",
            }}>
              <div><div style={{ fontSize: 10.5, fontWeight: 600, color: "#71717A" }}>EMAIL</div><div style={{ fontSize: 12.5, fontFamily: "var(--font-mono)", color: "#09090B", wordBreak: "break-word" }}>{d360.identity.email || "—"}</div></div>
              <div><div style={{ fontSize: 10.5, fontWeight: 600, color: "#71717A" }}>ID TRIBUTARIO</div><div style={{ fontSize: 12.5, fontFamily: "var(--font-mono)", color: "#09090B" }}>{d360.identity.country} · {d360.identity.tax_id || "—"}</div></div>
              <div><div style={{ fontSize: 10.5, fontWeight: 600, color: "#71717A" }}>SEGMENTO</div><div style={{ fontSize: 12.5, color: "#0F7A38", fontWeight: 700 }}>{SEGMENT_LABELS[d360.identity.commercial_segment] || d360.identity.commercial_segment}</div></div>
              <div><div style={{ fontSize: 10.5, fontWeight: 600, color: "#71717A" }}>PEDIDOS / COTIZ.</div><div style={{ fontSize: 12.5, fontFamily: "var(--font-mono)", color: "#09090B" }}>{d360.history_360.orders.length} / {d360.history_360.b2b_quotes.length}</div></div>
            </div>

            {/* Perfil Técnico del Estudio */}
            <div style={{ border: "1px solid var(--admin-border)", borderRadius: 12, padding: 14 }} data-testid="crm-technical-profile-card">
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
                <Sliders size={14} /> Perfil Técnico de Estudio / Productora
              </div>
              {d360.technical_profile && (
                <div style={{ fontSize: 12.5, marginBottom: 10, padding: 10, background: "var(--admin-surface-soft)", borderRadius: 8 }}>
                  <strong>Actividad:</strong> {d360.technical_profile.primary_activity || "—"} · <strong>DAW:</strong> {d360.technical_profile.primary_daw || "—"} · <strong>Instalación:</strong> {d360.technical_profile.facility_type || "—"}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  placeholder="Actividad (ej. Mastering / Post)"
                  value={techForm.primary_activity}
                  onChange={e => setTechForm({ ...techForm, primary_activity: e.target.value })}
                  style={formInputStyle}
                />
                <input
                  placeholder="DAW Principal (ej. Pro Tools / Ableton)"
                  value={techForm.primary_daw}
                  onChange={e => setTechForm({ ...techForm, primary_daw: e.target.value })}
                  style={formInputStyle}
                />
                <input
                  placeholder="Monitores (separados por coma)"
                  value={techForm.monitors}
                  onChange={e => setTechForm({ ...techForm, monitors: e.target.value })}
                  style={formInputStyle}
                />
                <input
                  placeholder="Necesidades futuras / Proyecto"
                  value={techForm.future_needs}
                  onChange={e => setTechForm({ ...techForm, future_needs: e.target.value })}
                  style={formInputStyle}
                />
              </div>
              <div style={{ marginTop: 8, textAlign: "right" }}>
                <SecondaryButton
                  size="sm"
                  data-testid="save-tech-profile-btn"
                  onClick={() => saveTechMut.mutate({
                    id: selected360Id,
                    payload: {
                      primary_activity: techForm.primary_activity,
                      primary_daw: techForm.primary_daw,
                      monitors: techForm.monitors.split(",").map(s => s.trim()).filter(Boolean),
                      future_needs: techForm.future_needs,
                    },
                  })}
                >
                  Guardar Perfil Técnico
                </SecondaryButton>
              </div>
            </div>

            {/* Historial 360° */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ border: "1px solid var(--admin-border)", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6 }}>Pedidos OMS ({d360.history_360.orders.length})</div>
                {d360.history_360.orders.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>Sin pedidos registrados.</p>
                ) : d360.history_360.orders.slice(0, 5).map(o => (
                  <div key={o.id} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                    <span style={{ fontFamily: "var(--font-mono)" }}>#{o.id.slice(0, 8)}</span>
                    <span>{formatCurrency(o.total, o.currency)}</span>
                  </div>
                ))}
              </div>
              <div style={{ border: "1px solid var(--admin-border)", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6 }}>Academia / Servicios / Loyalty</div>
                <div style={{ fontSize: 12, color: "var(--admin-text-secondary)" }}>
                  Cursos: {d360.history_360.academy_enrollments.length} · Reservas Serv.: {d360.history_360.service_bookings.length}<br />
                  Loyalty: {d360.history_360.loyalty ? `${d360.history_360.loyalty.points_balance} pts` : "Sin cuenta"} · RMA: {d360.history_360.rmas.length}
                </div>
              </div>
            </div>

            {/* Seguimiento Comercial */}
            <div style={{ border: "1px solid var(--admin-border)", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                <MessageSquare size={14} /> Seguimiento Comercial ({d360.interactions.length})
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <select
                  value={interForm.interaction_type}
                  onChange={e => setInterForm({ ...interForm, interaction_type: e.target.value })}
                  style={{ ...formInputStyle, width: 140 }}
                >
                  <option value="call">Llamada</option>
                  <option value="meeting">Reunión</option>
                  <option value="opportunity">Oportunidad</option>
                  <option value="follow_up">Seguimiento</option>
                </select>
                <input
                  placeholder="Asunto de seguimiento..."
                  value={interForm.subject}
                  onChange={e => setInterForm({ ...interForm, subject: e.target.value })}
                  style={{ ...formInputStyle, flex: 1 }}
                />
                <PrimaryButton
                  size="sm"
                  onClick={() => logInterMut.mutate({ id: selected360Id, payload: interForm })}
                >
                  Registrar
                </PrimaryButton>
              </div>
              {d360.interactions.slice(0, 4).map(it => (
                <div key={it.id} style={{ fontSize: 12, padding: "6px 0", borderTop: "1px solid var(--admin-border)" }}>
                  <strong>[{it.interaction_type}]</strong> {it.subject} <span style={{ color: "var(--admin-text-muted)" }}>({it.sales_rep_email || "staff"})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </SideModal>

      {/* MODAL NUEVA ORGANIZACIÓN */}
      <FormModal
        open={orgModalOpen}
        title="Nueva Organización B2B"
        onClose={() => setOrgModalOpen(false)}
        onSave={() => saveOrgMut.mutate(orgForm)}
        saving={saveOrgMut.isPending}
        saveLabel="Guardar Organización"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FormField label="Razón Social"><input style={formInputStyle} value={orgForm.legal_name} onChange={e => setOrgForm({ ...orgForm, legal_name: e.target.value })} /></FormField>
          <FormField label="Nombre Comercial"><input style={formInputStyle} value={orgForm.trade_name} onChange={e => setOrgForm({ ...orgForm, trade_name: e.target.value })} /></FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <FormField label="País">
              <select style={formInputStyle} value={orgForm.country} onChange={e => setOrgForm({ ...orgForm, country: e.target.value })}>
                <option value="CL">Chile (CL)</option>
                <option value="AR">Argentina (AR)</option>
                <option value="OTHER">Otro</option>
              </select>
            </FormField>
            <FormField label="RUT / CUIT"><input style={formInputStyle} value={orgForm.tax_id} onChange={e => setOrgForm({ ...orgForm, tax_id: e.target.value })} /></FormField>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <FormField label="Tipo de Cuenta">
              <select style={formInputStyle} value={orgForm.customer_type} onChange={e => setOrgForm({ ...orgForm, customer_type: e.target.value })}>
                {Object.entries(ORG_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </FormField>
            <FormField label="Segmento">
              <select style={formInputStyle} value={orgForm.commercial_segment} onChange={e => setOrgForm({ ...orgForm, commercial_segment: e.target.value })}>
                {Object.entries(SEGMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Email Facturación"><input style={formInputStyle} value={orgForm.billing_email} onChange={e => setOrgForm({ ...orgForm, billing_email: e.target.value })} /></FormField>
        </div>
      </FormModal>

      {/* MODAL NUEVO CLIENTE CRM */}
      <FormModal
        open={cusModalOpen}
        title="Nueva Ficha Cliente CRM"
        onClose={() => setCusModalOpen(false)}
        onSave={() => saveCusMut.mutate(cusForm)}
        saving={saveCusMut.isPending}
        saveLabel="Guardar Cliente"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FormField label="Nombre Completo"><input style={formInputStyle} value={cusForm.full_name} onChange={e => setCusForm({ ...cusForm, full_name: e.target.value })} /></FormField>
          <FormField label="Email"><input style={formInputStyle} value={cusForm.email} onChange={e => setCusForm({ ...cusForm, email: e.target.value })} /></FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <FormField label="País">
              <select style={formInputStyle} value={cusForm.country} onChange={e => setCusForm({ ...cusForm, country: e.target.value })}>
                <option value="CL">Chile</option>
                <option value="AR">Argentina</option>
              </select>
            </FormField>
            <FormField label="RUT / CUIT"><input style={formInputStyle} value={cusForm.tax_id} onChange={e => setCusForm({ ...cusForm, tax_id: e.target.value })} /></FormField>
          </div>
          <FormField label="Organización Vinculada">
            <select style={formInputStyle} value={cusForm.primary_organization_id} onChange={e => setCusForm({ ...cusForm, primary_organization_id: e.target.value })}>
              <option value="">Cuenta individual</option>
              {crmOrgs.map(o => <option key={o.id} value={o.id}>{o.code} — {o.legal_name}</option>)}
            </select>
          </FormField>
        </div>
      </FormModal>

      {/* MODAL CONTACTO DE ORGANIZACIÓN */}
      <FormModal
        open={!!contactOrgId}
        title="Agregar Contacto a Organización"
        onClose={() => setContactOrgId(null)}
        onSave={() => addContactMut.mutate({ orgId: contactOrgId, payload: contactForm })}
        saving={addContactMut.isPending}
        saveLabel="Agregar Contacto"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FormField label="Nombre Completo"><input style={formInputStyle} value={contactForm.full_name} onChange={e => setContactForm({ ...contactForm, full_name: e.target.value })} /></FormField>
          <FormField label="Email"><input style={formInputStyle} value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} /></FormField>
          <FormField label="Cargo / Rol"><input style={formInputStyle} value={contactForm.role_title} onChange={e => setContactForm({ ...contactForm, role_title: e.target.value })} /></FormField>
        </div>
      </FormModal>

      {/* MODAL GESTIÓN DE ROLES RBAC (Preservado 100%) */}
      <FormModal
        open={roleModalOpen && !!selectedUser}
        onClose={() => { setRoleModalOpen(false); setPendingConfirmAction(null); setActionError(null) }}
        title={`Gestión de Roles — ${selectedUser?.email || ""}`}
        size="md"
        hideFooter
      >
        {selectedUser && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {actionError && (
              <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--admin-danger-soft)", color: "var(--admin-danger)", fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldAlert size={16} />
                <span>{actionError}</span>
              </div>
            )}
            <div>
              <label style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "var(--admin-text-muted)", display: "block", marginBottom: 8 }}>
                Roles Actuales Asignados
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(selectedUser.roles || []).length === 0 ? (
                  <span style={{ fontSize: 12.5, color: "var(--admin-text-muted)" }}>Usuario sin roles administrativos (Cliente estándar)</span>
                ) : (
                  selectedUser.roles.map(r => (
                    <div key={r} style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "4px 10px", borderRadius: 6, background: "var(--admin-bg)",
                      border: "1px solid var(--admin-border)", fontSize: 12.5, fontWeight: 600,
                    }}>
                      <span>{r}</span>
                      <button
                        onClick={() => handleRequestRoleChange(selectedUser.id, r, "remove")}
                        disabled={roleMutation.isPending}
                        title="Revocar rol"
                        style={{ background: "none", border: "none", color: "var(--admin-danger)", cursor: "pointer", padding: 2 }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {pendingConfirmAction && (
              <div style={{
                padding: "12px 14px", borderRadius: 10,
                background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.35)",
                display: "flex", flexDirection: "column", gap: 10,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--admin-warning, #D97706)", fontSize: 12.5, fontWeight: 700 }}>
                  <ShieldAlert size={16} />
                  <span>Confirmar cambio de privilegios</span>
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--admin-text)" }}>
                  {pendingConfirmAction.action === "remove"
                    ? `¿Confirmas revocar el rol "${pendingConfirmAction.role}" para ${selectedUser.email}?`
                    : `El rol "${pendingConfirmAction.role}" otorga acceso administrativo de alto privilegio. ¿Confirmas asignarlo a ${selectedUser.email}?`}
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <PrimaryButton onClick={() => roleMutation.mutate(pendingConfirmAction)} disabled={roleMutation.isPending} size="sm">
                    Confirmar operación
                  </PrimaryButton>
                  <SecondaryButton onClick={() => setPendingConfirmAction(null)} disabled={roleMutation.isPending} size="sm">
                    Cancelar
                  </SecondaryButton>
                </div>
              </div>
            )}

            <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 14 }}>
              <label style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "var(--admin-text-muted)", display: "block", marginBottom: 6 }}>
                Asignar Nuevo Rol
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={roleToAssign}
                  onChange={(e) => { setRoleToAssign(e.target.value); setPendingConfirmAction(null) }}
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 6, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "var(--admin-text)", fontSize: 13 }}
                >
                  <option value="">Selecciona un rol empresarial...</option>
                  {availableRoles.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                </select>
                <PrimaryButton
                  onClick={() => handleRequestRoleChange(selectedUser.id, roleToAssign, "assign")}
                  disabled={roleMutation.isPending || !roleToAssign || selectedUser.roles?.includes(roleToAssign)}
                >
                  <Plus size={13} style={{ marginRight: 4 }} /> Asignar
                </PrimaryButton>
              </div>
            </div>
          </div>
        )}
      </FormModal>
    </div>
  )
}
