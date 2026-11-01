from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("payments", "0005_alter_payment_provider")]
    operations = [
        migrations.AddField(
            model_name="bankaccount", name="payment_method",
            field=models.CharField(
                max_length=30, default="transfer",
                choices=[("transfer", "Transferencia bancaria"), ("payoneer", "Payoneer")],
                help_text="Método que puede usar esta cuenta. La moneda también debe coincidir.",
            ),
        ),
    ]
