from django.db import migrations, models


def classify_legacy_revenue(apps, schema_editor):
    """Classify only rows whose original order denomination is unambiguous.

    An old PayPal USD settlement for a CLP order may be stored at the gateway
    amount instead of the order amount. Leave such rows unclassified rather
    than silently presenting them as CLP revenue.
    """
    IncomeRecord = apps.get_model("analytics", "IncomeRecord")
    for record in IncomeRecord.objects.select_related("order", "payment").iterator(chunk_size=500):
        currency = None
        order = record.order
        payment = record.payment
        if order and order.currency in ("CLP", "USD", "ARS"):
            if record.amount == order.total:
                ambiguous = bool(
                    payment and payment.currency != order.currency
                    and payment.amount == record.amount
                )
                if not ambiguous:
                    currency = order.currency
        elif not order and payment and payment.currency in ("CLP", "USD", "ARS"):
            if record.amount == payment.amount:
                currency = payment.currency
        if currency:
            IncomeRecord.objects.filter(pk=record.pk).update(currency=currency)

    # Historical withdrawals had no currency field, so they deliberately
    # remain NULL until manually reconciled. Do not label them CLP by guess.


class Migration(migrations.Migration):
    dependencies = [("analytics", "0003_withdrawal_created_by_withdrawaldeletionlog")]

    operations = [
        migrations.AddField(
            model_name="incomerecord", name="currency",
            field=models.CharField(max_length=3, null=True, blank=True),
        ),
        migrations.AddField(
            model_name="withdrawal", name="currency",
            field=models.CharField(max_length=3, null=True, blank=True),
        ),
        migrations.AddField(
            model_name="withdrawaldeletionlog", name="currency",
            field=models.CharField(max_length=3, null=True, blank=True),
        ),
        migrations.RunPython(classify_legacy_revenue, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="incomerecord", name="currency",
            field=models.CharField(max_length=3, default="CLP", null=True, blank=True),
        ),
        migrations.AlterField(
            model_name="withdrawal", name="currency",
            field=models.CharField(max_length=3, default="CLP", null=True, blank=True),
        ),
    ]
