"""
apps/rewards/models.py

Modelos del módulo LevelPro Rewards.
Sistema de campañas promocionales integrado al e-commerce.
Cada compra pagada de un producto participante genera N Entries (participaciones).
"""
from django.db import models
from django.conf import settings
from django.utils.text import slugify

from core.models import TimeStampedModel
from apps.products.models import Product
from apps.orders.models import Order


# ═══════════════════════════════════════════════════════════════
# CAMPAIGN
# ═══════════════════════════════════════════════════════════════

class CampaignStatus(models.TextChoices):
    DRAFT    = "draft",    "Borrador"
    ACTIVE   = "active",   "Activa"
    FINISHED = "finished", "Finalizada"


class Campaign(TimeStampedModel):
    """
    Campaña promocional con sorteo.
    Una campaña agrupa productos participantes y define fechas + premio.
    """
    name          = models.CharField(max_length=200, verbose_name="Nombre")
    slug          = models.SlugField(max_length=220, unique=True, blank=True)
    description   = models.TextField(blank=True, verbose_name="Descripción")

    image         = models.ImageField(
        upload_to="rewards/campaigns/", blank=True, null=True,
        verbose_name="Imagen principal",
        help_text="Imagen destacada del premio (se usa en cards y hero).",
    )
    banner        = models.ImageField(
        upload_to="rewards/campaigns/", blank=True, null=True,
        verbose_name="Banner",
        help_text="Banner ancho para el hero de la página /rewards.",
    )

    main_prize    = models.CharField(
        max_length=200,
        verbose_name="Premio principal",
        help_text="Ej: 'Neumann TLM 103 + Focusrite Scarlett 2i2'",
    )

    start_date    = models.DateTimeField(verbose_name="Fecha de inicio")
    end_date      = models.DateTimeField(verbose_name="Fecha de cierre")
    draw_date     = models.DateTimeField(verbose_name="Fecha del sorteo")

    status        = models.CharField(
        max_length=20,
        choices=CampaignStatus.choices,
        default=CampaignStatus.DRAFT,
    )

    legal_terms   = models.TextField(
        blank=True,
        verbose_name="Bases legales",
        help_text="Bases y condiciones del sorteo (soporta Markdown básico).",
    )

    show_counter  = models.BooleanField(
        default=True,
        verbose_name="Mostrar contador",
        help_text="Muestra la cuenta regresiva en la página pública.",
    )

    backup_winners_count = models.PositiveIntegerField(
        default=0,
        verbose_name="Suplentes",
        help_text="Cantidad de ganadores suplentes a sortear después del principal.",
    )

    drawn_at      = models.DateTimeField(null=True, blank=True)
    drawn_by      = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="campaigns_drawn",
        help_text="Admin que ejecutó el sorteo.",
    )

    class Meta:
        verbose_name        = "Campaña Rewards"
        verbose_name_plural = "Campañas Rewards"
        ordering            = ["-created_at"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    @property
    def is_drawn(self):
        return self.drawn_at is not None

    @property
    def total_entries(self):
        return self.entries.count()

    @property
    def total_participants(self):
        return self.entries.values("user").distinct().count()


# ═══════════════════════════════════════════════════════════════
# REWARD PRODUCT (M2M explícito con extras)
# ═══════════════════════════════════════════════════════════════

class RewardProduct(TimeStampedModel):
    """
    Producto participante en una campaña.
    Define cuántas Entries se generan por cada unidad comprada.
    """
    campaign             = models.ForeignKey(
        Campaign, on_delete=models.CASCADE, related_name="reward_products"
    )
    product              = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="reward_participations"
    )
    entries_per_purchase = models.PositiveIntegerField(
        default=1,
        verbose_name="Participaciones por unidad",
        help_text="Ej: 5 = cada unidad comprada suma 5 participaciones al sorteo.",
    )
    is_active            = models.BooleanField(default=True)

    class Meta:
        verbose_name        = "Producto participante"
        verbose_name_plural = "Productos participantes"
        unique_together     = [("campaign", "product")]

    def __str__(self):
        return f"{self.product.name} → {self.campaign.name}"


# ═══════════════════════════════════════════════════════════════
# ENTRY (participación individual)
# ═══════════════════════════════════════════════════════════════

class Entry(TimeStampedModel):
    """
    Participación individual generada automáticamente al pagar una orden.
    Cada Entry es un 'ticket' con código único.
    """
    campaign     = models.ForeignKey(
        Campaign, on_delete=models.CASCADE, related_name="entries"
    )
    user         = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reward_entries",
    )
    order        = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name="reward_entries"
    )
    product      = models.ForeignKey(
        Product, on_delete=models.SET_NULL, null=True,
        related_name="reward_entries",
    )

    # Cantidad NO es acumulado — cada Entry es 1 ticket, se generan N filas.
    unique_code  = models.CharField(max_length=20, unique=True)

    class Meta:
        verbose_name        = "Participación"
        verbose_name_plural = "Participaciones"
        ordering            = ["-created_at"]
        indexes             = [
            models.Index(fields=["campaign", "user"]),
            models.Index(fields=["campaign", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.unique_code} · {self.user.email}"


# ═══════════════════════════════════════════════════════════════
# WINNER
# ═══════════════════════════════════════════════════════════════

class Winner(TimeStampedModel):
    """
    Historial de ganadores. Persistente incluso si la campaña se elimina.
    Se conserva user/email como snapshot por si el usuario se borra.
    """
    campaign        = models.ForeignKey(
        Campaign, on_delete=models.CASCADE, related_name="winners"
    )
    entry           = models.ForeignKey(
        Entry, on_delete=models.SET_NULL, null=True,
        related_name="winner_of",
    )
    user            = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True,
        related_name="reward_wins",
    )

    # Snapshots para preservar historial aunque se borre el usuario
    user_email      = models.EmailField(blank=True)
    user_name       = models.CharField(max_length=200, blank=True)

    is_backup       = models.BooleanField(default=False, verbose_name="Suplente")
    backup_position = models.PositiveIntegerField(
        default=0,
        help_text="0 = ganador principal; 1..N = suplente en orden.",
    )

    notes           = models.TextField(blank=True, verbose_name="Observaciones")
    delivery_proof  = models.ImageField(
        upload_to="rewards/proofs/", blank=True, null=True,
        verbose_name="Evidencia de entrega",
    )

    class Meta:
        verbose_name        = "Ganador"
        verbose_name_plural = "Ganadores"
        ordering            = ["campaign", "backup_position"]
        unique_together     = [("campaign", "backup_position")]

    def __str__(self):
        role = f"Suplente #{self.backup_position}" if self.is_backup else "Ganador"
        return f"{role} · {self.user_email or 'anónimo'} · {self.campaign.name}"
