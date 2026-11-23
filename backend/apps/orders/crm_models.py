# apps/orders/crm_models.py
"""
LEVELPRO OS V4.0 — GATE 8: CRM & B2B MANAGEMENT MODELS
- BF-21: CustomerOrganization, CustomerProfile, CustomerContact, CustomerTechnicalProfile, CustomerInteraction
- BF-19: B2BPriceList, B2BPriceListItem, B2BPriceTier
- BF-20: B2BQuotePDFSnapshot
- BF-40: CommercialCreditAccount, CommercialCreditDecision
"""

from decimal import Decimal
from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from core.models import TimeStampedModel


class CustomerOrganization(TimeStampedModel):
    """Empresa, estudio de grabación, productora, institución o distribuidor B2B."""

    class CustomerType(models.TextChoices):
        STUDIO             = "studio",             "Estudio de Grabación / Mastering"
        PRODUCTION_COMPANY = "production_company", "Productora Audiovisual / Eventos"
        ENTERPRISE         = "enterprise",         "Empresa / Corporativo"
        INSTITUTION        = "institution",        "Institución Educativa / Pública"
        DISTRIBUTOR        = "distributor",        "Distribuidor / Integrador"
        INDIVIDUAL_PRO     = "individual_pro",     "Profesional Independiente"

    class CommercialSegment(models.TextChoices):
        STANDARD      = "standard",      "Estándar"
        PRO_STUDIO    = "pro_studio",    "Estudio Pro"
        WHOLESALE     = "wholesale",     "Mayorista"
        DISTRIBUTOR   = "distributor",   "Distribuidor"
        INSTITUTIONAL = "institutional", "Institucional"

    code = models.CharField(max_length=32, unique=True, db_index=True)
    legal_name = models.CharField(max_length=220, verbose_name="Razón Social")
    trade_name = models.CharField(max_length=220, blank=True, default="", verbose_name="Nombre Comercial")
    customer_type = models.CharField(max_length=30, choices=CustomerType.choices, default=CustomerType.STUDIO)
    country = models.CharField(max_length=10, default="CL", db_index=True)
    tax_id = models.CharField(max_length=50, blank=True, default="", db_index=True)
    tax_id_validated = models.BooleanField(default=False, help_text="Validación matemática de formato y dígito verificador (RUT/CUIT).")
    commercial_segment = models.CharField(
        max_length=24, choices=CommercialSegment.choices, default=CommercialSegment.STANDARD, db_index=True
    )
    preferred_currencies = models.JSONField(default=list, blank=True)
    commercial_addresses = models.JSONField(default=list, blank=True)
    billing_email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=60, blank=True, default="")
    website = models.URLField(blank=True, default="")
    sales_rep = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_crm_organizations",
    )
    is_active = models.BooleanField(default=True, db_index=True)
    onboarded_at = models.DateTimeField(default=timezone.now)
    authorized_notes = models.TextField(blank=True, default="", help_text="Observaciones comerciales autorizadas.")
    internal_notes = models.TextField(blank=True, default="", help_text="Notas internas confidenciales CRM.")

    class Meta:
        verbose_name = "Organización CRM"
        verbose_name_plural = "Organizaciones CRM"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.code} — {self.trade_name or self.legal_name}"


class CustomerProfile(TimeStampedModel):
    """Ficha CRM de cliente individual o persona vinculada a organización."""

    code = models.CharField(max_length=32, unique=True, db_index=True)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="crm_profile",
    )
    is_company_account = models.BooleanField(default=False)
    primary_organization = models.ForeignKey(
        CustomerOrganization,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="primary_profiles",
    )
    full_name = models.CharField(max_length=180)
    email = models.EmailField(db_index=True)
    phone = models.CharField(max_length=60, blank=True, default="")
    country = models.CharField(max_length=10, default="CL", db_index=True)
    tax_id = models.CharField(max_length=50, blank=True, default="", db_index=True)
    tax_id_validated = models.BooleanField(default=False)
    commercial_segment = models.CharField(
        max_length=24,
        choices=CustomerOrganization.CommercialSegment.choices,
        default=CustomerOrganization.CommercialSegment.STANDARD,
        db_index=True,
    )
    preferred_currency = models.CharField(max_length=10, default="CLP")
    commercial_addresses = models.JSONField(default=list, blank=True)
    sales_rep = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_crm_profiles",
    )
    is_active = models.BooleanField(default=True, db_index=True)
    onboarded_at = models.DateTimeField(default=timezone.now)
    authorized_notes = models.TextField(blank=True, default="")
    internal_notes = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Ficha de Cliente CRM"
        verbose_name_plural = "Fichas de Clientes CRM"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.code} — {self.full_name} ({self.email})"


class CustomerContact(TimeStampedModel):
    """Contacto comercial de una organización; permite asociar un User a múltiples organizaciones."""

    organization = models.ForeignKey(
        CustomerOrganization,
        on_delete=models.CASCADE,
        related_name="contacts",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="organization_contacts",
    )
    full_name = models.CharField(max_length=180)
    role_title = models.CharField(max_length=120, blank=True, default="")
    email = models.EmailField(db_index=True)
    phone = models.CharField(max_length=60, blank=True, default="")
    is_primary = models.BooleanField(default=False)
    can_request_quotes = models.BooleanField(default=True)
    can_approve_orders = models.BooleanField(default=False)
    can_use_credit = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Contacto de Organización"
        verbose_name_plural = "Contactos de Organización"
        ordering = ["-is_primary", "full_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "user"],
                condition=Q(user__isnull=False),
                name="uniq_org_user_contact",
            ),
        ]

    def __str__(self):
        return f"{self.full_name} ({self.organization.code})"


class CustomerTechnicalProfile(TimeStampedModel):
    """Perfil técnico estructurado del estudio, productora o instalación (confidencial CRM)."""

    customer_profile = models.OneToOneField(
        CustomerProfile,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="technical_profile",
    )
    organization = models.OneToOneField(
        CustomerOrganization,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="technical_profile",
    )
    primary_activity = models.CharField(max_length=140, blank=True, default="")
    facility_type = models.CharField(max_length=140, blank=True, default="")
    primary_daw = models.CharField(max_length=120, blank=True, default="")
    audio_interfaces = models.JSONField(default=list, blank=True)
    consoles = models.JSONField(default=list, blank=True)
    microphones = models.JSONField(default=list, blank=True)
    monitors = models.JSONField(default=list, blank=True)
    pa_systems = models.JSONField(default=list, blank=True)
    processors = models.JSONField(default=list, blank=True)
    instruments = models.JSONField(default=list, blank=True)
    brands_of_interest = models.JSONField(default=list, blank=True)
    existing_equipment_notes = models.TextField(blank=True, default="")
    future_needs = models.TextField(blank=True, default="")
    active_projects = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Perfil Técnico CRM"
        verbose_name_plural = "Perfiles Técnicos CRM"

    def __str__(self):
        owner = self.organization or self.customer_profile
        return f"Perfil Técnico — {owner}"


class CustomerInteraction(TimeStampedModel):
    """Registro auditable de seguimiento comercial y oportunidades."""

    class InteractionType(models.TextChoices):
        CALL        = "call",        "Llamada"
        MEETING     = "meeting",     "Reunión"
        INQUIRY     = "inquiry",     "Consulta técnica"
        OPPORTUNITY = "opportunity", "Oportunidad comercial"
        QUOTE_SENT  = "quote_sent",  "Cotización enviada"
        FOLLOW_UP   = "follow_up",   "Seguimiento pendiente"

    customer_profile = models.ForeignKey(
        CustomerProfile,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="interactions",
    )
    organization = models.ForeignKey(
        CustomerOrganization,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="interactions",
    )
    interaction_type = models.CharField(max_length=24, choices=InteractionType.choices, default=InteractionType.CALL)
    subject = models.CharField(max_length=220)
    summary = models.TextField(blank=True, default="")
    outcome = models.CharField(max_length=220, blank=True, default="")
    next_follow_up_at = models.DateTimeField(null=True, blank=True, db_index=True)
    sales_rep = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="crm_interactions",
    )
    related_quote = models.ForeignKey(
        "orders.B2BQuote",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="crm_interactions",
    )

    class Meta:
        verbose_name = "Interacción CRM"
        verbose_name_plural = "Interacciones CRM"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.interaction_type}] {self.subject}"


class B2BPriceList(TimeStampedModel):
    """BF-19: Lista de precios mayorista / contractual por cliente, organización o segmento."""

    class Status(models.TextChoices):
        DRAFT    = "draft",    "Borrador"
        ACTIVE   = "active",   "Activa"
        INACTIVE = "inactive", "Inactiva"
        EXPIRED  = "expired",  "Vencida"

    class Scope(models.TextChoices):
        CUSTOMER_CONTRACT = "customer_contract", "Contrato específico cliente / organización"
        ORGANIZATION      = "organization",      "Lista asignada a organización"
        SEGMENT           = "segment",           "Segmento B2B"

    code = models.CharField(max_length=40, unique=True, db_index=True)
    name = models.CharField(max_length=180)
    currency = models.CharField(max_length=10, default="CLP", db_index=True)
    country = models.CharField(max_length=10, default="CL", db_index=True)
    market = models.CharField(max_length=80, blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    scope = models.CharField(max_length=24, choices=Scope.choices, default=Scope.SEGMENT, db_index=True)
    applicable_segment = models.CharField(max_length=24, blank=True, default="", db_index=True)
    organization = models.ForeignKey(
        CustomerOrganization,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="price_lists",
    )
    customer_profile = models.ForeignKey(
        CustomerProfile,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="price_lists",
    )
    priority = models.PositiveIntegerField(default=100, help_text="Menor valor numérico = mayor precedencia dentro del mismo nivel.")
    valid_from = models.DateTimeField(null=True, blank=True, db_index=True)
    valid_until = models.DateTimeField(null=True, blank=True, db_index=True)
    version = models.PositiveIntegerField(default=1)
    min_margin_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("10.00"))
    responsible_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_b2b_price_lists",
    )
    change_history = models.JSONField(default=list, blank=True)

    class Meta:
        verbose_name = "Lista de Precios B2B"
        verbose_name_plural = "Listas de Precios B2B"
        ordering = ["priority", "-version", "-created_at"]

    def __str__(self):
        return f"{self.code} (v{self.version}) — {self.name} [{self.currency}]"


class B2BPriceListItem(TimeStampedModel):
    """Regla de precio por SKU/variante dentro de una lista B2B."""

    class PricingMode(models.TextChoices):
        FIXED_PRICE      = "fixed_price",      "Precio Fijo"
        PERCENT_DISCOUNT = "percent_discount", "Descuento Porcentual"

    price_list = models.ForeignKey(B2BPriceList, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("products.Product", on_delete=models.CASCADE, related_name="b2b_price_items")
    variant = models.ForeignKey(
        "products.ProductVariant",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="b2b_price_items",
    )
    pricing_mode = models.CharField(max_length=24, choices=PricingMode.choices, default=PricingMode.FIXED_PRICE)
    fixed_price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    min_quantity = models.PositiveIntegerField(default=1)
    max_discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("100.00"))
    min_margin_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    class Meta:
        verbose_name = "Ítem de Lista B2B"
        verbose_name_plural = "Ítems de Lista B2B"
        constraints = [
            models.UniqueConstraint(
                fields=["price_list", "product", "variant"],
                condition=Q(variant__isnull=False),
                name="uniq_b2b_pl_prod_variant",
            ),
            models.UniqueConstraint(
                fields=["price_list", "product"],
                condition=Q(variant__isnull=True),
                name="uniq_b2b_pl_prod_base",
            ),
        ]

    def __str__(self):
        sku = self.variant.sku if self.variant else (self.product.sku or self.product.name)
        return f"{self.price_list.code} | {sku}"


class B2BPriceTier(TimeStampedModel):
    """Escalones de precio por volumen para un ítem de lista B2B."""

    price_list_item = models.ForeignKey(B2BPriceListItem, on_delete=models.CASCADE, related_name="tiers")
    min_quantity = models.PositiveIntegerField()
    max_quantity = models.PositiveIntegerField(null=True, blank=True)
    tier_price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    tier_discount_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    class Meta:
        verbose_name = "Tramo por Volumen B2B"
        verbose_name_plural = "Tramos por Volumen B2B"
        ordering = ["min_quantity"]

    def __str__(self):
        upper = str(self.max_quantity) if self.max_quantity else "+"
        return f"{self.price_list_item} [{self.min_quantity}..{upper}]"


class B2BQuotePDFSnapshot(TimeStampedModel):
    """BF-20: Snapshot versionado e inmutable de PDF emitido para cotización B2B con checksum SHA-256."""

    class DesignVariant(models.TextChoices):
        CLASSIC_CORPORATE = "classic_corporate", "Diseño A: Corporativo Clásico"
        MODERN_TECHNICAL  = "modern_technical",  "Diseño B: Técnico Pro Audio"

    quote = models.ForeignKey("orders.B2BQuote", on_delete=models.CASCADE, related_name="pdf_snapshots")
    version = models.PositiveIntegerField(default=1)
    design_variant = models.CharField(
        max_length=32, choices=DesignVariant.choices, default=DesignVariant.CLASSIC_CORPORATE
    )
    sha256_checksum = models.CharField(max_length=64, db_index=True)
    file_size_bytes = models.PositiveIntegerField(default=0)
    pdf_bytes = models.BinaryField()
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_b2b_pdfs",
    )

    class Meta:
        verbose_name = "Snapshot PDF de Cotización B2B"
        verbose_name_plural = "Snapshots PDF de Cotizaciones B2B"
        ordering = ["-version", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["quote", "version", "design_variant"],
                name="uniq_b2b_quote_pdf_ver_design",
            ),
        ]

    def __str__(self):
        return f"PDF {self.quote} v{self.version} ({self.design_variant})"


class CommercialCreditAccount(TimeStampedModel):
    """
    BF-40: Cuenta de crédito comercial corporativo (control preventivo, no libro contable AR).
    Por política de seguridad inicial, toda cuenta nueva nace deshabilitada pendiente de política/autorización.
    """

    class Status(models.TextChoices):
        DISABLED_PENDING_POLICY = "disabled_pending_policy", "Deshabilitada (Pendiente de política/aprobación)"
        PENDING_APPROVAL        = "pending_approval",        "Pendiente de aprobación gerencial"
        ACTIVE                  = "active",                  "Activa"
        SUSPENDED               = "suspended",               "Suspendida"
        EXPIRED                 = "expired",                 "Vencida"
        BLOCKED                 = "blocked",                 "Bloqueada por exceso o mora"

    class PaymentTerms(models.TextChoices):
        NET_15 = "net_15", "Net-15 (15 días)"
        NET_30 = "net_30", "Net-30 (30 días)"

    organization = models.ForeignKey(
        CustomerOrganization,
        on_delete=models.CASCADE,
        related_name="credit_accounts",
    )
    currency = models.CharField(max_length=10, default="CLP")
    credit_limit = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    payment_terms = models.CharField(max_length=16, choices=PaymentTerms.choices, default=PaymentTerms.NET_15)
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.DISABLED_PENDING_POLICY,
        db_index=True,
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="requested_credit_accounts",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_credit_accounts",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    approval_evidence = models.TextField(blank=True, default="")
    policy_acknowledged = models.BooleanField(default=False)
    notes = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Cuenta de Crédito Comercial B2B"
        verbose_name_plural = "Cuentas de Crédito Comercial B2B"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "currency"],
                name="uniq_credit_account_org_currency",
            ),
        ]

    def __str__(self):
        return f"Crédito {self.organization.code} [{self.currency}] — {self.status}"


class CommercialCreditDecision(TimeStampedModel):
    """Historial inmutable de solicitudes, aprobaciones, suspensiones y compromisos de crédito."""

    class Action(models.TextChoices):
        REQUESTED          = "requested",          "Solicitud de línea/aumento"
        APPROVED           = "approved",           "Aprobación autorizada"
        REJECTED           = "rejected",           "Solicitud rechazada"
        SUSPENDED          = "suspended",          "Línea suspendida"
        LIMIT_UPDATED      = "limit_updated",      "Límite modificado"
        EXPOSURE_COMMITTED = "exposure_committed", "Compromiso comercial registrado"
        EXPOSURE_RELEASED  = "exposure_released",  "Compromiso comercial liberado"

    credit_account = models.ForeignKey(
        CommercialCreditAccount,
        on_delete=models.CASCADE,
        related_name="decisions",
    )
    action = models.CharField(max_length=24, choices=Action.choices)
    previous_limit = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    new_limit = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    previous_status = models.CharField(max_length=32, blank=True, default="")
    new_status = models.CharField(max_length=32, blank=True, default="")
    evidence = models.TextField(blank=True, default="")
    notes = models.TextField(blank=True, default="")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="credit_decisions",
    )

    class Meta:
        verbose_name = "Decisión de Crédito Comercial"
        verbose_name_plural = "Decisiones de Crédito Comercial"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.credit_account} | {self.action} ({self.previous_limit} -> {self.new_limit})"
