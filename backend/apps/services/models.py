# apps/services/models.py

from decimal import Decimal
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator
from django.utils.text import slugify
from core.models import TimeStampedModel


class ServiceCategory(TimeStampedModel):

    name        = models.CharField(max_length=200)
    slug        = models.SlugField(unique=True, blank=True)
    description = models.TextField(blank=True)
    icon        = models.CharField(
        max_length=10, blank=True,
        help_text="Emoji o ícono representativo"
    )
    order       = models.PositiveIntegerField(default=0)

    class Meta:
        ordering  = ["order", "name"]
        verbose_name = "Categoría de Servicio"
        verbose_name_plural = "Categorías de Servicios"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Service(TimeStampedModel):

    class PriceType(models.TextChoices):
        FIXED   = "fixed",   "Precio fijo"
        QUOTE   = "quote",   "A cotizar"
        HOURLY  = "hourly",  "Por hora"
        PROJECT = "project", "Por proyecto"

    name        = models.CharField(max_length=300)
    slug        = models.SlugField(unique=True, blank=True)
    category    = models.ForeignKey(
        ServiceCategory,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="services"
    )
    description      = models.TextField()
    short_description = models.CharField(max_length=500, blank=True)
    thumbnail        = models.ImageField(
        upload_to="services/", blank=True, null=True
    )
    price       = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
        validators=[MinValueValidator(Decimal("0"))],
    )
    price_usd   = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
        validators=[MinValueValidator(Decimal("0"))],
        verbose_name="Precio USD",
        help_text="Precio en dólares (PayPal / internacional). Vacío = calcula con tasa configurable.",
    )
    price_ars   = models.DecimalField(
        max_digits=12, decimal_places=2,
        null=True, blank=True,
        validators=[MinValueValidator(Decimal("0"))],
        verbose_name="Precio ARS",
        help_text="Precio en pesos argentinos (Ualá). Vacío = calcula con tasa configurable.",
    )
    price_type  = models.CharField(
        max_length=20,
        choices=PriceType.choices,
        default=PriceType.QUOTE
    )
    is_active   = models.BooleanField(default=True,  verbose_name="Activo")
    is_featured = models.BooleanField(default=False, verbose_name="Destacado")
    
    order       = models.PositiveIntegerField(default=0)

    # Detalles adicionales
    duration_hours   = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Duración estimada en horas"
    )
    deliverables     = models.TextField(
        blank=True,
        help_text="Qué incluye el servicio (uno por línea)"
    )

    class Meta:
        ordering = ["order", "name"]
        verbose_name = "Servicio"
        verbose_name_plural = "Servicios"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    @property
    def price_display(self):
        if self.price_type == self.PriceType.FIXED and self.price:
            return f"${self.price:,.0f}"
        if self.price_type == self.PriceType.HOURLY and self.price:
            return f"${self.price:,.0f}/hr"
        return "A cotizar"

    @property
    def deliverables_list(self):
        if not self.deliverables:
            return []
        return [d.strip() for d in self.deliverables.splitlines() if d.strip()]

    def prices_by_currency(self, usd_to_clp=None, usd_to_ars=None):
        """
        Devuelve los precios en CLP, USD y ARS para servicios con precio definido.
        Retorna None por moneda cuando el servicio no tiene precio base.
        """
        from decimal import ROUND_HALF_UP

        if self.price is None and self.price_usd is None and self.price_ars is None:
            return {"CLP": None, "USD": None, "ARS": None}

        usd_to_clp = usd_to_clp or Decimal("950")
        usd_to_ars = usd_to_ars or Decimal("1000")

        clp = self.price
        if self.price_usd is not None:
            usd = self.price_usd
        elif clp is not None and usd_to_clp:
            usd = (clp / usd_to_clp).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        else:
            usd = None

        if self.price_ars is not None:
            ars = self.price_ars
        elif usd is not None:
            ars = (usd * usd_to_ars).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        else:
            ars = None

        return {"CLP": clp, "USD": usd, "ARS": ars}


class Booking(TimeStampedModel):

    class Status(models.TextChoices):
        PENDING   = "pending",   "Pendiente"
        CONFIRMED = "confirmed", "Confirmado"
        COMPLETED = "completed", "Completado"
        CANCELLED = "cancelled", "Cancelado"

    user           = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bookings"
    )
    service        = models.ForeignKey(
        Service,
        on_delete=models.CASCADE,
        related_name="bookings"
    )
    scheduled_date = models.DateTimeField()
    notes          = models.TextField(blank=True)
    status         = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )
    confirmed_at   = models.DateTimeField(null=True, blank=True)
    cancelled_at   = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Reserva"
        verbose_name_plural = "Reservas"

    def __str__(self):
        return f"{self.user.email} → {self.service.name} ({self.scheduled_date.strftime('%d/%m/%Y')})"


class ServiceRequest(TimeStampedModel):

    class Status(models.TextChoices):
        PENDING   = "pending",   "Pendiente"
        CONTACTED = "contacted", "Contactado"
        ACCEPTED  = "accepted",  "Aceptado"
        REJECTED  = "rejected",  "Rechazado"

    user    = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="service_requests"
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="requests"
    )
    # ── Estos campos tienen default para no romper filas existentes ──
    name    = models.CharField(max_length=200, blank=True, default="")
    email   = models.EmailField(blank=True, default="")
    phone   = models.CharField(max_length=30, blank=True, default="")
    message = models.TextField()
    budget  = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True
    )
    preferred_date = models.DateField(null=True, blank=True)
    status  = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )
    admin_notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Solicitud de Servicio"
        verbose_name_plural = "Solicitudes de Servicios"

    def __str__(self):
        return f"{self.name or self.user.email} — {self.service.name if self.service else 'General'}"