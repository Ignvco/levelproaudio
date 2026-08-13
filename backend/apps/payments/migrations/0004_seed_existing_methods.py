# Siembra los métodos de pago que existían hardcodeados en el checkout
# viejo (MercadoPago, PayPal, Global66) como registros en la tabla nueva,
# para que aparezcan en el panel de admin listos para activar/editar.
#
# Se crean INACTIVOS a propósito: el admin decide cuáles activar. Usa
# get_or_create para no duplicar si ya existen.

from django.db import migrations


METHODS = [
    # (method, label, description, currencies, order)
    ("mercadopago_cl", "MercadoPago",   "Tarjetas, Khipu, efectivo",   "CLP", 1),
    ("mercadopago_ar", "MercadoPago AR", "Tarjetas y medios locales AR", "ARS", 2),
    ("paypal",         "PayPal",        "Tarjetas internacionales",     "",    3),
    ("transfer",       "Transferencia", "Transferencia bancaria",       "",    4),
]


def seed_methods(apps, schema_editor):
    PaymentMethodConfig = apps.get_model("payments", "PaymentMethodConfig")
    for method, label, description, currencies, order in METHODS:
        PaymentMethodConfig.objects.get_or_create(
            method=method,
            defaults={
                "label": label,
                "description": description,
                "currencies": currencies,
                "order": order,
                "is_active": False,  # el admin decide qué activar
            },
        )


def unseed_methods(apps, schema_editor):
    PaymentMethodConfig = apps.get_model("payments", "PaymentMethodConfig")
    PaymentMethodConfig.objects.filter(
        method__in=[m[0] for m in METHODS]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("payments", "0003_bankaccount_paymentmethodconfig"),
    ]
    operations = [
        migrations.RunPython(seed_methods, unseed_methods),
    ]
