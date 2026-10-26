from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("orders", "0005_order_currency")]

    operations = [
        migrations.AddField(
            model_name="order",
            name="stock_deductions",
            field=models.JSONField(blank=True, editable=False, null=True),
        ),
    ]
