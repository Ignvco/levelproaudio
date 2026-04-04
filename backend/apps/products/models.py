# apps/products/models.py

from django.db import models
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

    price         = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Precio")
    compare_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )

    cost_price = models.DecimalField(
        max_digits=12, decimal_places=2,
        null=True, blank=True,
        help_text="Costo real del producto (capital invertido)"
    )

    product_type = models.CharField(
        max_length=20, choices=ProductType.choices, default=ProductType.STOCK
    )

    # ← declarado UNA sola vez
    stock     = models.PositiveIntegerField(default=0, verbose_name="Stock")
    weight    = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    is_active   = models.BooleanField(default=True,  verbose_name="Activo")
    is_featured = models.BooleanField(default=False, verbose_name="Destacado")

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
        return self.stock > 0


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