# apps/products/models.py
# Catálogo completo: categorías, marcas y productos

from django.db import models
from django.utils.text import slugify
from core.models import TimeStampedModel


class Category(TimeStampedModel):
    """
    Categorías anidadas (subcategorías).
    Ej: Audio Pro → Parlantes → Monitores
    """
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='categories/', blank=True, null=True)
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children'
    )
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Categoría'
        verbose_name_plural = 'Categorías'
        ordering = ['order', 'name']

    def __str__(self):
        if self.parent:
            return f'{self.parent.name} → {self.name}'
        return self.name

    def save(self, *args, **kwargs):
        # Genera el slug automáticamente desde el nombre
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Brand(TimeStampedModel):
    """
    Marcas de productos.
    Ej: RCF, Shure, Fender, Behringer
    """
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    logo = models.ImageField(upload_to='brands/', blank=True, null=True)
    website = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Marca'
        verbose_name_plural = 'Marcas'
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Product(TimeStampedModel):

    class ProductType(models.TextChoices):
        STOCK = "stock", "En Stock"
        PREORDER = "preorder", "Preorden"
        ON_DEMAND = "on_demand", "A pedido"

    name = models.CharField(max_length=300)
    slug = models.SlugField(max_length=300, unique=True)
    sku = models.CharField(max_length=100, unique=True, blank=True)

    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        related_name="products"
    )

    brand = models.ForeignKey(
        Brand,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products"
    )

    description = models.TextField(blank=True)
    short_description = models.CharField(max_length=500, blank=True)

    compare_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )

    product_type = models.CharField(
        max_length=20,
        choices=ProductType.choices,
        default=ProductType.STOCK
    )

    stock = models.PositiveIntegerField(default=0)

    weight = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)

    is_active   = models.BooleanField(default=True,  verbose_name="Activo")
    is_featured = models.BooleanField(default=False, verbose_name="Destacado")
    stock       = models.PositiveIntegerField(default=0, verbose_name="Stock")
    price       = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Precio")

    seo_title = models.CharField(max_length=255, blank=True)
    seo_description = models.CharField(max_length=255, blank=True)
    
    course = models.OneToOneField(
        'academy.Course',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='product',
        help_text='Si este producto es un curso, vincúlalo aquí'
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
        super().save(*args, **kwargs)

    @property
    def has_discount(self):
        """Retorna True si el producto tiene precio de comparación mayor al actual."""
        return self.compare_price and self.compare_price > self.price

    @property
    def discount_percentage(self):
        """Calcula el % de descuento para mostrar en el frontend."""
        if self.has_discount:
            discount = ((self.compare_price - self.price) / self.compare_price) * 100
            return round(discount)
        return 0

    @property
    def in_stock(self):
        return self.stock > 0


class ProductImage(TimeStampedModel):
    """
    Imágenes de un producto. Un producto puede tener varias fotos.
    """
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='images'
    )
    image = models.ImageField(upload_to='products/')
    alt_text = models.CharField(max_length=200, blank=True)
    order = models.PositiveIntegerField(default=0)
    is_primary = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Imagen de Producto'
        verbose_name_plural = 'Imágenes de Producto'
        ordering = ['order']

    def __str__(self):
        return f'Imagen de {self.product.name} ({self.order})'

    def save(self, *args, **kwargs):
        # Solo puede haber una imagen primaria por producto
        if self.is_primary:
            ProductImage.objects.filter(
                product=self.product,
                is_primary=True
            ).exclude(pk=self.pk).update(is_primary=False)
        super().save(*args, **kwargs)
        
        
        