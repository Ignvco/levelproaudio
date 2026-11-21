# Generated data migration for LEVELPRO OS V4.0 — GATE 2 (BF-44)
from django.db import migrations


def seed_technical_attributes_and_templates(apps, schema_editor):
    from apps.products.specs_catalog import (
        AUDIO_ATTRIBUTE_DEFINITIONS,
        CATEGORY_FAMILY_TEMPLATES,
        infer_family_for_category_name,
    )

    TechnicalAttributeDefinition = apps.get_model("products", "TechnicalAttributeDefinition")
    Category = apps.get_model("products", "Category")
    CategoryTechnicalTemplate = apps.get_model("products", "CategoryTechnicalTemplate")

    attr_by_key = {}
    for item in AUDIO_ATTRIBUTE_DEFINITIONS:
        obj, _ = TechnicalAttributeDefinition.objects.update_or_create(
            key=item["key"],
            defaults={
                "label": item["label"],
                "data_type": item["data_type"],
                "unit": item.get("unit", ""),
                "options": item.get("options", []),
                "min_value": item.get("min_value"),
                "max_value": item.get("max_value"),
                "is_comparable": item.get("is_comparable", True),
                "is_filterable": item.get("is_filterable", False),
                "is_active": True,
                "order": item.get("order", 0),
            },
        )
        attr_by_key[obj.key] = obj

    for cat in Category.objects.all():
        family = infer_family_for_category_name(f"{cat.slug} {cat.name}")
        keys = CATEGORY_FAMILY_TEMPLATES.get(family, [])
        for idx, k in enumerate(keys):
            attr = attr_by_key.get(k)
            if attr:
                CategoryTechnicalTemplate.objects.get_or_create(
                    category=cat,
                    attribute=attr,
                    defaults={"is_required": False, "order": (idx + 1) * 10},
                )


def rollback_seed(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0016_technicalattributedefinition_productvariant_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_technical_attributes_and_templates, rollback_seed),
    ]
