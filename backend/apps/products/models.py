# apps/products/models.py

from decimal import Decimal
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator
from django.utils.text import slugify
from core.models import TimeStampedModel


class Category(TimeStampedModel):
    name        = models.CharField(max_length=200)
    slug        = models.SlugField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    image       = models.ImageField(upload_to="categories/", blank=True, null=True)
    parent      = models.ForeignKey(
        "self", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="children"
    )
    is_active = models.BooleanField(default=True)
    order     = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name        = "Categoría"
        verbose_name_plural = "Categorías"
        ordering            = ["order", "name"]

    def __str__(self):
        return f"{self.parent.name} → {self.name}" if self.parent else self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Brand(TimeStampedModel):
    name      = models.CharField(max_length=200)
    slug      = models.SlugField(max_length=200, unique=True)
    logo      = models.ImageField(upload_to="brands/", blank=True, null=True)
    website   = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name        = "Marca"
        verbose_name_plural = "Marcas"
        ordering            = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Product(TimeStampedModel):

    class ProductType(models.TextChoices):
        STOCK     = "stock",     "En Stock"
        PREORDER  = "preorder",  "Preorden"
        ON_DEMAND = "on_demand", "A pedido"
        BUNDLE    = "bundle",    "Kit / Combo"

    name  = models.CharField(max_length=300)
    slug  = models.SlugField(max_length=300, unique=True)

    # ← null=True para que múltiples productos sin SKU no colisionen en UNIQUE
    sku   = models.CharField(
        max_length=100, unique=True, blank=True, null=True, default=None
    )

    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL,
        null=True, related_name="products"
    )
    brand = models.ForeignKey(
        Brand, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="products"
    )

    description       = models.TextField(blank=True)
    short_description = models.CharField(max_length=500, blank=True)

    price         = models.DecimalField(
        max_digits=12, decimal_places=2, verbose_name="Precio",
        validators=[MinValueValidator(Decimal("0"))],
    )
    compare_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(Decimal("0"))],
    )

    cost_price = models.DecimalField(
        max_digits=12, decimal_places=2,
        null=True, blank=True,
        help_text="Costo real del producto (capital invertido)",
        validators=[MinValueValidator(Decimal("0"))],
    )

    product_type = models.CharField(
        max_length=20, choices=ProductType.choices, default=ProductType.STOCK
    )

    # ← declarado UNA sola vez
    stock     = models.PositiveIntegerField(default=0, verbose_name="Stock")
    stock_min = models.PositiveIntegerField(
        default=5,
        verbose_name="Stock mínimo",
        help_text="Alerta cuando el stock baje de este nivel"
    )
    weight    = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    is_active   = models.BooleanField(default=True,  verbose_name="Activo")
    class Badge(models.TextChoices):
        BEST_SELLER = "best_seller", "🔥 Best Seller"
        RECOMMENDED = "recommended", "⭐ LevelPro recomienda"
        PREMIUM     = "premium",     "💎 Profesional"
        BEST_VALUE  = "best_value",  "💰 Mejor relación precio/rendimiento"
        NEW         = "new",         "🆕 Nuevo"

    is_featured = models.BooleanField(default=False, verbose_name="Destacado")
    badge = models.CharField(
        max_length=20, choices=Badge.choices, blank=True, default="",
        verbose_name="Etiqueta destacada",
        help_text="Bajo pedido y Últimas unidades se calculan solos — no hace falta elegirlos acá.",
    )

    related_products = models.ManyToManyField(
        "self", symmetrical=False, blank=True, related_name="+",
        verbose_name="Completá tu setup con",
        help_text="Accesorios o productos complementarios a mostrar en la ficha (cable, soporte, interfaz, etc.)",
    )

    # Componentes de un kit/combo. Solo aplica cuando product_type=bundle.
    # El precio del kit es el propio (price), fijado a mano — NO se calcula
    # de los componentes. Al comprarlo, descuenta stock de cada componente
    # (el kit no tiene stock propio).
    bundle_items = models.ManyToManyField(
        "self", through="BundleItem", symmetrical=False,
        related_name="in_bundles", blank=True,
        verbose_name="Productos que componen el kit",
    )

    seo_title       = models.CharField(max_length=255, blank=True)
    seo_description = models.CharField(max_length=255, blank=True)

    course = models.OneToOneField(
        "academy.Course",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="product",
        help_text="Si este producto es un curso, vincúlalo aquí"
    )

    class Meta:
        verbose_name        = "Producto"
        verbose_name_plural = "Productos"
        ordering            = ["-created_at"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        # Convierte SKU vacío a None para respetar UNIQUE
        if self.sku == "":
            self.sku = None
        super().save(*args, **kwargs)

    

    @property
    def has_discount(self):
        return bool(self.compare_price and self.compare_price > self.price)

    @property
    def discount_percentage(self):
        if self.has_discount:
            return round(((self.compare_price - self.price) / self.compare_price) * 100)
        return 0

    @property
    def in_stock(self):
        if self.product_type == self.ProductType.BUNDLE:
            # Un kit está disponible solo si TODOS sus componentes tienen
            # stock suficiente para la cantidad que el kit requiere.
            items = self.bundle_components.select_related("component").all()
            if not items:
                return False
            return all(
                it.component.product_type != self.ProductType.STOCK
                or it.component.stock >= it.quantity
                for it in items
            )
        return self.stock > 0


class BundleItem(TimeStampedModel):
    """
    Un componente de un kit/combo, con su cantidad. Ej: el kit "Set de
    grabación" lleva 1 micrófono + 2 cables + 1 pedestal.
    """
    bundle = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="bundle_components",
        verbose_name="Kit",
    )
    component = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="component_of",
        verbose_name="Producto componente",
    )
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ("bundle", "component")
        verbose_name = "Componente de kit"
        verbose_name_plural = "Componentes de kit"

    def __str__(self):
        return f"{self.bundle.name}: {self.quantity}× {self.component.name}"


class ProductImage(TimeStampedModel):
    product    = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="images"
    )
    image      = models.ImageField(upload_to="products/")
    alt_text   = models.CharField(max_length=200, blank=True)
    order      = models.PositiveIntegerField(default=0)
    is_primary = models.BooleanField(default=False)

    class Meta:
        verbose_name        = "Imagen de Producto"
        verbose_name_plural = "Imágenes de Producto"
        ordering            = ["order"]

    def __str__(self):
        return f"Imagen de {self.product.name} ({self.order})"

    def save(self, *args, **kwargs):
        if self.is_primary:
            ProductImage.objects.filter(
                product=self.product, is_primary=True
            ).exclude(pk=self.pk).update(is_primary=False)
        super().save(*args, **kwargs)


class Favorite(TimeStampedModel):
    """Producto guardado como favorito por un usuario."""
    user    = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="favorites"
    )
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="favorited_by"
    )

    # ── Alertas de precio/stock ──
    # price_when_added nunca cambia (es el precio de referencia "cuando lo
    # guardaste"). lowest_notified_price evita mandar un email cada día por
    # la misma bajada — solo se vuelve a avisar si el precio baja todavía
    # más. was_in_stock detecta el flanco false→true (volvió a stock).
    price_when_added     = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    lowest_notified_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    was_in_stock          = models.BooleanField(default=True)

    class Meta:
        verbose_name        = "Favorito"
        verbose_name_plural = "Favoritos"
        ordering            = ["-created_at"]
        unique_together     = ("user", "product")

    def __str__(self):
        return f"{self.user.email} ♥ {self.product.name}"


class SpecialOrderRequest(TimeStampedModel):
    """
    Solicitud de un cliente para un equipo que no está en el catálogo
    ("bajo pedido"). El cliente describe qué busca; el admin lo gestiona
    (contactar, cotizar, cerrar). Mismo patrón que ServiceRequest.
    """
    class Status(models.TextChoices):
        PENDING   = "pending",   "Pendiente"
        CONTACTED = "contacted", "Contactado"
        QUOTED    = "quoted",    "Cotizado"
        CLOSED    = "closed",    "Cerrado"
        REJECTED  = "rejected",  "Rechazado"

    # Puede ser anónimo (visitante sin cuenta) o de un usuario logueado
    user  = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="special_order_requests",
    )
    name  = models.CharField(max_length=200)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True, default="")

    # Qué equipo busca
    equipment   = models.CharField(
        max_length=300,
        help_text="Qué equipo/producto busca el cliente",
    )
    brand_model = models.CharField(
        max_length=200, blank=True, default="",
        help_text="Marca o modelo específico, si lo sabe",
    )
    quantity    = models.PositiveIntegerField(default=1)
    details     = models.TextField(
        blank=True, default="",
        help_text="Detalles, uso previsto, especificaciones",
    )
    budget      = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text="Presupuesto aproximado (opcional)",
    )

    status      = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING)
    admin_notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Solicitud bajo pedido"
        verbose_name_plural = "Solicitudes bajo pedido"

    def __str__(self):
        return f"{self.name} — {self.equipment}"
