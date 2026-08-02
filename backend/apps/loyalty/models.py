# apps/loyalty/models.py

from django.db import models, transaction
from django.conf import settings
from core.models import TimeStampedModel
import uuid


class LoyaltyConfig(TimeStampedModel):
    """
    Configuración global del programa de fidelización.
    Solo existe un registro (singleton).
    """
    puntos_por_peso       = models.DecimalField(
        max_digits=8, decimal_places=4, default=0.01,
        help_text="Puntos ganados por cada $1 gastado. Ej: 0.01 = 1 punto por $100"
    )
    peso_por_punto        = models.DecimalField(
        max_digits=8, decimal_places=2, default=1.0,
        help_text="Valor en pesos de cada punto al canjear. Ej: 1.0 = 1 punto = $1"
    )
    minimo_canje          = models.PositiveIntegerField(
        default=500,
        help_text="Mínimo de puntos para poder canjear"
    )
    expiracion_dias       = models.PositiveIntegerField(
        default=365,
        help_text="Días hasta que expiran los puntos (0 = nunca)"
    )
    is_active             = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Configuración de Fidelización"

    def __str__(self):
        return "Configuración del programa de puntos"

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj


class LoyaltyAccount(TimeStampedModel):
    """Cuenta de puntos de un usuario"""
    user            = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="loyalty_account"
    )
    puntos_totales  = models.PositiveIntegerField(default=0)
    puntos_canjeados = models.PositiveIntegerField(default=0)
    puntos_expirados = models.PositiveIntegerField(default=0)
    nivel           = models.CharField(
        max_length=20,
        choices=[
            ("bronze",   "Bronze"),
            ("silver",   "Silver"),
            ("gold",     "Gold"),
            ("platinum", "Platinum"),
        ],
        default="bronze"
    )

    class Meta:
        verbose_name = "Cuenta de Fidelización"

    def __str__(self):
        return f"{self.user.email} — {self.puntos_disponibles} pts"

    @property
    def puntos_disponibles(self):
        return max(0, self.puntos_totales - self.puntos_canjeados - self.puntos_expirados)

    @property
    def nivel_siguiente(self):
        niveles = {
            "bronze":   ("silver",   1000),
            "silver":   ("gold",     5000),
            "gold":     ("platinum", 15000),
            "platinum": (None, None),
        }
        return niveles.get(self.nivel, (None, None))

    def actualizar_nivel(self):
        """Actualiza el nivel según los puntos totales históricos"""
        total = self.puntos_totales
        if total >= 15000:
            self.nivel = "platinum"
        elif total >= 5000:
            self.nivel = "gold"
        elif total >= 1000:
            self.nivel = "silver"
        else:
            self.nivel = "bronze"
        self.save(update_fields=["nivel"])

    def agregar_puntos(self, puntos, descripcion="", orden=None):
        """Agrega puntos y registra la transacción. Bloquea la fila para
        evitar que dos compras simultáneas del mismo usuario pisen el
        contador de puntos entre sí."""
        if puntos <= 0:
            return
        with transaction.atomic():
            locked = LoyaltyAccount.objects.select_for_update().get(pk=self.pk)
            locked.puntos_totales += puntos
            locked.save(update_fields=["puntos_totales"])
            locked.actualizar_nivel()
            LoyaltyTransaction.objects.create(
                account     = locked,
                tipo        = "earn",
                puntos      = puntos,
                descripcion = descripcion,
                orden       = orden,
            )
        self.refresh_from_db()

    def canjear_puntos(self, puntos, descripcion="", orden=None):
        """
        Canjea puntos si hay suficientes. Bloquea la fila (select_for_update)
        para que dos canjes simultáneos (doble clic, dos pestañas) no puedan
        gastar más puntos de los que la cuenta realmente tiene.
        """
        with transaction.atomic():
            locked = LoyaltyAccount.objects.select_for_update().get(pk=self.pk)
            config = LoyaltyConfig.get()
            if puntos < config.minimo_canje:
                raise ValueError(f"Mínimo de canje: {config.minimo_canje} puntos")
            if puntos > locked.puntos_disponibles:
                raise ValueError("No tenés suficientes puntos")
            locked.puntos_canjeados += puntos
            locked.save(update_fields=["puntos_canjeados"])
            LoyaltyTransaction.objects.create(
                account     = locked,
                tipo        = "redeem",
                puntos      = -puntos,
                descripcion = descripcion,
                orden       = orden,
            )
            descuento = int(puntos * float(config.peso_por_punto))
        self.refresh_from_db()
        return descuento

    def revertir_puntos(self, puntos, descripcion="", orden=None):
        """
        Le quita puntos a la cuenta (nunca por debajo de 0) — se usa cuando
        una orden que ya había dado puntos se cancela o reembolsa. Bloquea
        la fila igual que agregar_puntos/canjear_puntos.
        """
        if puntos <= 0:
            return
        with transaction.atomic():
            locked = LoyaltyAccount.objects.select_for_update().get(pk=self.pk)
            a_quitar = min(puntos, locked.puntos_totales)
            if a_quitar <= 0:
                return
            locked.puntos_totales -= a_quitar
            locked.save(update_fields=["puntos_totales"])
            locked.actualizar_nivel()
            LoyaltyTransaction.objects.create(
                account     = locked,
                tipo        = "adjust",
                puntos      = -a_quitar,
                descripcion = descripcion,
                orden       = orden,
            )
        self.refresh_from_db()


class LoyaltyTransaction(TimeStampedModel):
    """Registro de cada movimiento de puntos"""
    account     = models.ForeignKey(
        LoyaltyAccount, on_delete=models.CASCADE,
        related_name="transactions"
    )
    tipo        = models.CharField(
        max_length=20,
        choices=[
            ("earn",   "Ganados"),
            ("redeem", "Canjeados"),
            ("expire", "Expirados"),
            ("adjust", "Ajuste manual"),
        ]
    )
    puntos      = models.IntegerField()  # positivo o negativo
    descripcion = models.CharField(max_length=300, blank=True)
    orden       = models.ForeignKey(
        "orders.Order", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="loyalty_transactions"
    )

    class Meta:
        verbose_name   = "Transacción de Puntos"
        ordering       = ["-created_at"]

    def __str__(self):
        return f"{self.get_tipo_display()}: {self.puntos} pts — {self.account.user.email}"