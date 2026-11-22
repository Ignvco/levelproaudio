# apps/products/models.py

from decimal import Decimal
from django.db import models, transaction
from django.conf import settings
from django.core.exceptions import ValidationError
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

    # Precios multi-moneda cargados a mano. price (arriba) es el CLP base.
    # Si price_usd/price_ars quedan vacíos, el frontend cae a la tasa de
    # cambio configurable. El USD es el precio de referencia real para el
    # comprador argentino (es lo que cobra Payoneer); el ARS es informativo.
    price_usd = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(Decimal("0"))],
        verbose_name="Precio USD",
        help_text="Precio en dólares. Si se deja vacío, se calcula con la tasa configurable.",
    )
    price_ars = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(Decimal("0"))],
        verbose_name="Precio ARS",
        help_text="Precio en pesos argentinos (referencial). Si se deja vacío, se calcula con la tasa.",
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

    class SerializationMode(models.TextChoices):
        NONE     = "none",     "Sin serialización"
        OPTIONAL = "optional", "Serialización opcional"
        REQUIRED = "required", "Serialización obligatoria"

    serialization_mode = models.CharField(
        max_length=16,
        choices=SerializationMode.choices,
        default=SerializationMode.NONE,
        db_index=True,
        verbose_name="Modo de serialización",
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

    def clean(self):
        super().clean()
        if self.sku is not None:
            cleaned = str(self.sku).strip()
            self.sku = cleaned or None
        if self.sku:
            if Product.objects.filter(sku=self.sku).exclude(pk=self.pk).exists():
                raise ValidationError({"sku": f"El SKU '{self.sku}' ya pertenece a otro producto."})
            if ProductVariant.objects.filter(sku=self.sku).exists():
                raise ValidationError({"sku": f"El SKU '{self.sku}' ya pertenece a una variante de producto."})
            if SkuRegistry.objects.filter(sku=self.sku).exclude(product_id=self.pk).exists():
                raise ValidationError({"sku": f"El SKU '{self.sku}' ya está registrado en el catálogo."})

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        # Convierte SKU vacío a None para respetar UNIQUE
        if self.sku is not None:
            self.sku = str(self.sku).strip() or None

        update_fields = kwargs.get("update_fields")
        sync_sku = self.pk is None or update_fields is None or "sku" in update_fields
        if not sync_sku:
            super().save(*args, **kwargs)
            return

        with transaction.atomic():
            super().save(*args, **kwargs)
            if self.sku:
                updated = SkuRegistry.objects.filter(product=self).update(sku=self.sku)
                if not updated:
                    SkuRegistry.objects.create(sku=self.sku, product=self)
            else:
                SkuRegistry.objects.filter(product=self).delete()

    

    def prices_by_currency(self, usd_to_clp=None, usd_to_ars=None):
        """
        Devuelve los precios en las 3 monedas. Usa el precio manual si
        está cargado; si no, lo calcula desde el CLP con las tasas dadas.
        CLP es la base. Las tasas se pasan desde SiteSettings (o defaults).
        """
        from decimal import Decimal, ROUND_HALF_UP
        usd_to_clp = usd_to_clp or Decimal("950")
        usd_to_ars = usd_to_ars or Decimal("1000")

        clp = self.price
        # USD: manual o (CLP / tasa_usd_clp)
        if self.price_usd is not None:
            usd = self.price_usd
        else:
            usd = (clp / usd_to_clp).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if usd_to_clp else Decimal("0")
        # ARS: manual o (USD * tasa_usd_ars) — referencial
        if self.price_ars is not None:
            ars = self.price_ars
        else:
            ars = (usd * usd_to_ars).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

        return {
            "CLP": clp,
            "USD": usd,
            "ARS": ars,
        }

    @property
    def has_discount(self):
        return bool(self.compare_price and self.compare_price > self.price)

    @property
    def discount_percentage(self):
        if self.has_discount:
            return round(((self.compare_price - self.price) / self.compare_price) * 100)
        return 0

    @property
    def has_variants(self):
        return self.variants.filter(is_active=True).exists()

    @property
    def effective_stock(self):
        """
        Stock efectivo para vitrina/listado:
        - Si es bundle: calculado desde componentes.
        - Si tiene variantes activas: suma de stock de variantes activas.
        - Si es producto simple legacy: self.stock.
        """
        if self.product_type == self.ProductType.BUNDLE:
            items = self.bundle_components.select_related("component", "variant").all()
            if not items:
                return 0
            counts = []
            for it in items:
                if it.variant_id:
                    if not it.variant.is_active:
                        return 0
                    if it.component.product_type == self.ProductType.STOCK:
                        counts.append(it.variant.stock // max(1, it.quantity))
                else:
                    if it.component.variants.exists():
                        return 0
                    if it.component.product_type == self.ProductType.STOCK:
                        counts.append(it.component.stock // max(1, it.quantity))
            return min(counts) if counts else 99
        if self.variants.exists():
            active_variants = list(self.variants.filter(is_active=True).values_list("stock", flat=True))
            return sum(active_variants)
        return self.stock

    @property
    def in_stock(self):
        if self.product_type == self.ProductType.BUNDLE:
            # Un kit está disponible solo si TODOS sus componentes tienen
            # stock suficiente (y variante explícita si el componente usa variantes).
            items = self.bundle_components.select_related("component", "variant").all()
            if not items:
                return False
            for it in items:
                if it.variant_id:
                    if not it.variant.is_active:
                        return False
                    if it.component.product_type == self.ProductType.STOCK and it.variant.stock < it.quantity:
                        return False
                else:
                    if it.component.variants.exists():
                        return False
                    if it.component.product_type == self.ProductType.STOCK and it.component.stock < it.quantity:
                        return False
            return True
        if self.variants.exists():
            active_variants = self.variants.filter(is_active=True)
            if not active_variants.exists():
                return False
            if self.product_type != self.ProductType.STOCK:
                return True
            return active_variants.filter(stock__gt=0).exists()
        return self.stock > 0


class BundleItem(TimeStampedModel):
    """
    Un componente de un kit/combo, con su cantidad y variante explícita opcional.
    Ej: el kit "Set de grabación" lleva 1 micrófono + 2 cables (variante XLR 3m).
    """
    bundle = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="bundle_components",
        verbose_name="Kit",
    )
    component = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="component_of",
        verbose_name="Producto componente",
    )
    variant = models.ForeignKey(
        "products.ProductVariant",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="in_bundle_items",
        verbose_name="Variante específica del componente",
    )
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["bundle", "component"],
                condition=models.Q(variant__isnull=True),
                name="uniq_bundle_component_no_variant",
            ),
            models.UniqueConstraint(
                fields=["bundle", "component", "variant"],
                condition=models.Q(variant__isnull=False),
                name="uniq_bundle_component_variant",
            ),
        ]
        verbose_name = "Componente de kit"
        verbose_name_plural = "Componentes de kit"

    def clean(self):
        super().clean()
        if self.variant_id and self.variant.product_id != self.component_id:
            raise ValidationError({"variant": "La variante seleccionada no pertenece al producto componente."})
        if not self.variant_id and self.component_id:
            if ProductVariant.objects.filter(product_id=self.component_id).exists():
                raise ValidationError({
                    "variant": f"El componente '{self.component.name}' posee variantes; debe seleccionar una variante explícita."
                })

    def __str__(self):
        var_label = f" ({self.variant.name})" if self.variant_id else ""
        return f"{self.bundle.name}: {self.quantity}× {self.component.name}{var_label}"


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


# ═══════════════════════════════════════════════════════════════════════════════
# LEVELPRO OS V4.0 — GATE 2: ADVANCED PIM (VARIANTES & CATÁLOGO TÉCNICO)
# ═══════════════════════════════════════════════════════════════════════════════

class ProductVariant(TimeStampedModel):
    """
    Variante comercial de un producto maestro (BF-14).
    Soporta ejes como impedancia, color, conexión, tamaño y configuración,
    con SKU único, código de barras, precios independientes (o heredados)
    y stock propio compatible con reservas y futuros Gate 3/4.
    """
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="variants",
        verbose_name="Producto maestro",
    )
    sku = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="SKU único de variante",
    )
    barcode = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
        verbose_name="Código de barras (EAN/UPC)",
    )
    name = models.CharField(
        max_length=250,
        verbose_name="Nombre de variante",
        help_text="Ej: 250 Ohm / Negro, XLR 3m",
    )
    # Ejes estructurados: {"impedance": "250 Ohm", "color": "Negro", "connection": "XLR", ...}
    attributes = models.JSONField(default=dict, blank=True)

    # Precios independientes (si son None, heredan del producto maestro)
    price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0"))],
        verbose_name="Precio CLP (opcional, hereda si vacío)",
    )
    compare_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0"))],
    )
    price_usd = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0"))],
    )
    price_ars = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0"))],
    )
    cost_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0"))],
    )

    # Stock y logística por variante
    stock = models.PositiveIntegerField(default=0)
    stock_min = models.PositiveIntegerField(default=3)
    weight = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
    )

    image = models.ForeignKey(
        ProductImage,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="variant_assignments",
    )

    is_active = models.BooleanField(default=True, db_index=True)
    is_default = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Variante de producto"
        verbose_name_plural = "Variantes de producto"
        ordering = ["order", "created_at"]
        indexes = [
            models.Index(fields=["product", "is_active"], name="prod_variant_prod_active_idx"),
        ]

    def __str__(self):
        return f"{self.product.name} — {self.name} ({self.sku})"

    def clean(self):
        super().clean()
        if not self.sku or not str(self.sku).strip():
            raise ValidationError({"sku": "Toda variante requiere un SKU único."})
        self.sku = str(self.sku).strip()

        # Prevenir colisión global de SKU con productos maestros y registro maestro
        if ProductVariant.objects.filter(sku=self.sku).exclude(pk=self.pk).exists():
            raise ValidationError({"sku": f"El SKU '{self.sku}' ya pertenece a otra variante."})
        if Product.objects.filter(sku=self.sku).exists():
            raise ValidationError({"sku": f"El SKU '{self.sku}' ya pertenece a un producto maestro."})
        if SkuRegistry.objects.filter(sku=self.sku).exclude(variant_id=self.pk).exists():
            raise ValidationError({"sku": f"El SKU '{self.sku}' ya está registrado en el catálogo."})

    def save(self, *args, **kwargs):
        if self.sku:
            self.sku = str(self.sku).strip()
        update_fields = kwargs.get("update_fields")
        sync_sku = self.pk is None or update_fields is None or "sku" in update_fields
        with transaction.atomic():
            if self.is_default and self.product_id:
                ProductVariant.objects.filter(
                    product_id=self.product_id, is_default=True
                ).exclude(pk=self.pk).update(is_default=False)
            super().save(*args, **kwargs)
            if sync_sku and self.sku:
                updated = SkuRegistry.objects.filter(variant=self).update(sku=self.sku)
                if not updated:
                    SkuRegistry.objects.create(sku=self.sku, variant=self)

    @property
    def effective_price(self):
        return self.price if self.price is not None else self.product.price

    @property
    def effective_compare_price(self):
        if self.compare_price is not None:
            return self.compare_price
        if self.price is None:
            return self.product.compare_price
        return None

    @property
    def effective_cost_price(self):
        return self.cost_price if self.cost_price is not None else self.product.cost_price

    @property
    def effective_weight(self):
        return self.weight if self.weight is not None else self.product.weight

    @property
    def in_stock(self):
        if not self.is_active:
            return False
        if self.product.product_type != Product.ProductType.STOCK:
            return True
        return self.stock > 0

    def prices_by_currency(self, usd_to_clp=None, usd_to_ars=None):
        """
        Precios CLP/USD/ARS de la variante con herencia controlada:
        - Si la variante define precio propio en la divisa, lo usa.
        - Si la variante NO redefine `price` CLP, hereda `price_usd`/`price_ars` del maestro si existen.
        - En otro caso convierte desde `effective_price` CLP con ROUND_HALF_UP.
        """
        from decimal import ROUND_HALF_UP

        usd_to_clp = usd_to_clp or Decimal("950")
        usd_to_ars = usd_to_ars or Decimal("1000")

        clp = self.effective_price

        if self.price_usd is not None:
            usd = self.price_usd
        elif self.price is None and self.product.price_usd is not None:
            usd = self.product.price_usd
        else:
            usd = (clp / usd_to_clp).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if usd_to_clp else Decimal("0")

        if self.price_ars is not None:
            ars = self.price_ars
        elif self.price is None and self.product.price_ars is not None:
            ars = self.product.price_ars
        else:
            ars = (usd * usd_to_ars).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

        return {
            "CLP": clp,
            "USD": usd,
            "ARS": ars,
        }


class TechnicalAttributeDefinition(TimeStampedModel):
    """
    Definición maestra de un atributo técnico estructurado de audio pro (BF-44).
    """
    class DataType(models.TextChoices):
        TEXT = "text", "Texto"
        NUMBER = "number", "Entero"
        DECIMAL = "decimal", "Decimal"
        SELECT = "select", "Selección única"
        MULTISELECT = "multiselect", "Selección múltiple"
        BOOLEAN = "boolean", "Booleano"

    key = models.SlugField(max_length=100, unique=True)
    label = models.CharField(max_length=150)
    data_type = models.CharField(max_length=20, choices=DataType.choices, default=DataType.TEXT)
    unit = models.CharField(max_length=30, blank=True, default="")
    options = models.JSONField(default=list, blank=True)
    min_value = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    max_value = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    is_comparable = models.BooleanField(default=True)
    is_filterable = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Definición de atributo técnico"
        verbose_name_plural = "Definiciones de atributos técnicos"
        ordering = ["order", "label"]

    def __str__(self):
        return f"{self.label} ({self.key})"


class CategoryTechnicalTemplate(TimeStampedModel):
    """
    Asociación de atributos técnicos por categoría sin imponer las mismas
    especificaciones a todo el catálogo.
    """
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name="technical_templates",
    )
    attribute = models.ForeignKey(
        TechnicalAttributeDefinition,
        on_delete=models.CASCADE,
        related_name="category_templates",
    )
    is_required = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("category", "attribute")
        verbose_name = "Plantilla técnica de categoría"
        verbose_name_plural = "Plantillas técnicas de categoría"
        ordering = ["order", "attribute__order"]

    def __str__(self):
        return f"{self.category.name} → {self.attribute.label}"


class ProductTechnicalSpec(TimeStampedModel):
    """
    Valor técnico estructurado de un producto para un atributo dado (BF-44).
    """
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="technical_specs",
    )
    attribute = models.ForeignKey(
        TechnicalAttributeDefinition,
        on_delete=models.PROTECT,
        related_name="product_values",
    )
    value_text = models.CharField(max_length=500, blank=True, default="")
    value_number = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    value_json = models.JSONField(null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        unique_together = ("product", "attribute")
        verbose_name = "Especificación técnica de producto"
        verbose_name_plural = "Especificaciones técnicas de producto"
        ordering = ["attribute__order", "attribute__label"]

    def __str__(self):
        return f"{self.product.name} · {self.attribute.label}: {self.display_value}"

    @property
    def display_value(self):
        unit = (self.attribute.unit or "").strip()
        val = (self.value_text or "").strip()
        if not val:
            return ""
        if unit and self.attribute.data_type in ("number", "decimal"):
            return f"{val} {unit}"
        if unit and unit.lower() not in val.lower() and "hz" not in val.lower():
            return f"{val} {unit}"
        return val


class SkuRegistry(TimeStampedModel):
    """
    Registro maestro único de SKUs a nivel de catálogo (Product + ProductVariant).
    Garantiza unicidad transaccional global en PostgreSQL mediante índice UNIQUE
    sobre `sku`, evitando colisiones en escrituras concurrentes y preparando
    la identidad comercial para relaciones de proveedores e inventario (Gate 3+).
    """
    sku = models.CharField(max_length=100, unique=True)
    product = models.OneToOneField(
        Product,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="sku_registry",
    )
    variant = models.OneToOneField(
        ProductVariant,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="sku_registry",
    )

    class Meta:
        verbose_name = "Registro global de SKU"
        verbose_name_plural = "Registro global de SKUs"
        constraints = [
            models.CheckConstraint(
                condition=(
                    (models.Q(product__isnull=False) & models.Q(variant__isnull=True))
                    | (models.Q(product__isnull=True) & models.Q(variant__isnull=False))
                ),
                name="sku_registry_exactly_one_owner",
            ),
        ]

    def __str__(self):
        owner = self.product or self.variant
        return f"{self.sku} → {owner}"

