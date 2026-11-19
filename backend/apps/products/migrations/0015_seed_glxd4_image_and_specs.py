# Generated data migration for LevelPro Audio OS V3.5 (Post-Audit Remediation)
from django.db import migrations


def seed_product_data(apps, schema_editor):
    Product = apps.get_model("products", "Product")
    ProductImage = apps.get_model("products", "ProductImage")

    # 1. Asignar imagen a Shure GLXD4/SM58 si carece de ella
    p = Product.objects.filter(slug="shure-glxd4sm58").first()
    if p:
        if not ProductImage.objects.filter(product=p).exists():
            ProductImage.objects.create(
                product=p,
                image="products/Shure_SM58.png",
                is_primary=True,
                order=0,
            )
        if not p.weight:
            p.weight = 1.20
            p.save(update_fields=["weight"])


def rollback_product_data(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0014_product_price_ars_product_price_usd"),
    ]

    operations = [
        migrations.RunPython(seed_product_data, rollback_product_data),
    ]
