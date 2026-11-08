"""
backend/tests/test_f5_loyalty_and_rewards.py
Certificación integral de Fase F5:
- #31 (RWD-01): Generación de tickets de sorteo exclusivamente tras confirmación de pago.
- #32 (RWD-02): Ciclo de vida de campañas, sorteos idempotentes y privacidad de ganadores.
- #34 (LYT-01): Reglas de acumulación, canje, reversión/reembolso y ajuste de puntos LevelPro Club.
- #35 (LYT-02): Política comercial de fidelización para compras internacionales (USD / ARS).
"""
from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.users.models import User
from apps.products.models import Category, Product
from apps.orders.models import Order, OrderItem, OrderStatus
from apps.rewards.models import (
    Campaign,
    RewardProduct,
    Entry,
    Winner,
    CampaignStatus,
    StickerPurchase,
)
from apps.rewards.services import generate_entries_for_order, run_draw, DrawError
from apps.rewards.serializers import WinnerPublicSerializer, AdminWinnerSerializer
from apps.loyalty.models import LoyaltyAccount, LoyaltyConfig, LoyaltyTransaction


class Fase5RewardsAndLoyaltyCertificationTests(TestCase):
    def setUp(self):
        # 1. Usuarios de prueba
        self.client_user = User.objects.create_user(
            email="cliente.f5@levelproaudio.test",
            username="cliente_f5",
            password="Password123!",
            first_name="Carlos",
            last_name="Valenzuela Pérez",
        )
        self.staff_admin = User.objects.create_user(
            email="admin.f5@levelproaudio.test",
            username="admin_f5",
            password="Password123!",
            is_staff=True,
            is_superuser=True,
        )

        # 2. Catálogo base
        self.category = Category.objects.create(name="Micrófonos F5", slug="mics-f5")
        self.product_clp = Product.objects.create(
            name="Micrófono Shure SM7B",
            slug="shure-sm7b-f5",
            category=self.category,
            price=Decimal("400000"),
            price_usd=Decimal("450.00"),
            price_ars=Decimal("550000"),
            stock=20,
            is_active=True,
        )

        # 3. Campaña Rewards
        now = timezone.now()
        self.campaign = Campaign.objects.create(
            name="Gran Sorteo LevelPro 2026",
            slug="gran-sorteo-levelpro-2026",
            main_prize="Neumann TLM 103 + Apollo Twin X",
            sticker_price=Decimal("2000"),
            start_date=now - timedelta(days=2),
            end_date=now + timedelta(days=20),
            draw_date=now + timedelta(days=21),
            status=CampaignStatus.ACTIVE,
            backup_winners_count=2,
        )
        self.reward_product = RewardProduct.objects.create(
            campaign=self.campaign,
            product=self.product_clp,
            entries_per_purchase=5,
            is_active=True,
        )

        # 4. Configuración Loyalty (1 pto cada $100 gastados, 1 pto = $1 canje)
        self.loyalty_config = LoyaltyConfig.get()
        self.loyalty_config.puntos_por_peso = Decimal("0.01")
        self.loyalty_config.peso_por_punto = Decimal("1.00")
        self.loyalty_config.minimo_canje = 500
        self.loyalty_config.is_active = True
        self.loyalty_config.save()

        # 5. Clientes API
        self.api_client = APIClient()
        self.api_client.force_authenticate(user=self.client_user)

        self.admin_client = APIClient()
        self.admin_client.force_authenticate(user=self.staff_admin)

    # ═══════════════════════════════════════════════════════════════
    # #31 (RWD-01): GENERACIÓN DE TICKETS EXCLUSIVA TRAS PAGO
    # ═══════════════════════════════════════════════════════════════

    def test_rwd01_tickets_generated_strictly_on_paid_status(self):
        """Los tickets se generan ÚNICAMENTE cuando una orden pasa a paid/shipped/completed."""
        order = Order.objects.create(
            user=self.client_user,
            email=self.client_user.email,
            shipping_address="Av. Providencia 1234",
            total=Decimal("400000"),
            currency="CLP",
            status=OrderStatus.PENDING,
        )
        OrderItem.objects.create(
            order=order,
            product=self.product_clp,
            product_name=self.product_clp.name,
            price=self.product_clp.price,
            quantity=2,
        )
        # 1. Orden pendiente no debe generar tickets
        self.assertEqual(Entry.objects.filter(order=order).count(), 0)

        # 2. Transición a PAID genera tickets: 5 entries x 2 unidades = 10 entries
        order.status = OrderStatus.PAID
        order.save()
        entries = Entry.objects.filter(order=order)
        self.assertEqual(entries.count(), 10)
        for e in entries:
            self.assertTrue(e.unique_code.startswith("LPR-"))
            self.assertEqual(e.campaign, self.campaign)
            self.assertEqual(e.user, self.client_user)
            self.assertEqual(e.product, self.product_clp)

        # 3. Re-save a shipped o completed NO debe duplicar tickets (idempotencia)
        order.status = OrderStatus.SHIPPED
        order.save()
        self.assertEqual(Entry.objects.filter(order=order).count(), 10)

        # Invocación directa repetida tampoco duplica tickets
        generate_entries_for_order(order)
        self.assertEqual(Entry.objects.filter(order=order).count(), 10)

        # 4. Una orden cancelada directamente desde PENDING nunca genera tickets
        order_cancelled = Order.objects.create(
            user=self.client_user,
            email=self.client_user.email,
            shipping_address="Av. Providencia 1234",
            total=Decimal("400000"),
            currency="CLP",
            status=OrderStatus.PENDING,
        )
        OrderItem.objects.create(
            order=order_cancelled,
            product=self.product_clp,
            product_name=self.product_clp.name,
            price=self.product_clp.price,
            quantity=1,
        )
        order_cancelled.status = OrderStatus.CANCELLED
        order_cancelled.save()
        self.assertEqual(Entry.objects.filter(order=order_cancelled).count(), 0)

    def test_rwd01_cancellation_removes_entries_preventing_raffle_win(self):
        """Si una orden pagada es cancelada, sus participaciones se eliminan."""
        order = Order.objects.create(
            user=self.client_user,
            email=self.client_user.email,
            shipping_address="Av. Providencia 1234",
            total=Decimal("400000"),
            currency="CLP",
            status=OrderStatus.PAID,
        )
        OrderItem.objects.create(
            order=order,
            product=self.product_clp,
            product_name=self.product_clp.name,
            price=self.product_clp.price,
            quantity=1,
        )
        order.save()
        self.assertEqual(Entry.objects.filter(order=order).count(), 5)

        # Cancelar la orden
        order.status = OrderStatus.CANCELLED
        order.save()

        # Las participaciones fueron eliminadas para proteger la integridad del sorteo
        self.assertEqual(Entry.objects.filter(order=order).count(), 0)
        self.assertEqual(self.campaign.total_entries, 0)

    def test_rwd01_anonymous_order_does_not_generate_tickets(self):
        """Órdenes sin usuario registrado no deben generar tickets huérfanos."""
        order = Order.objects.create(
            user=None,
            email="invitado@example.com",
            shipping_address="Dirección Anónima",
            total=Decimal("400000"),
            currency="CLP",
            status=OrderStatus.PENDING,
        )
        OrderItem.objects.create(
            order=order,
            product=self.product_clp,
            product_name=self.product_clp.name,
            price=self.product_clp.price,
            quantity=1,
        )
        order.status = OrderStatus.PAID
        order.save()
        self.assertEqual(Entry.objects.filter(order=order).count(), 0)

    def test_rwd01_sticker_purchase_generates_tickets_on_payment(self):
        """Compra de stickers digitales genera exactamente N tickets al confirmarse el pago."""
        resp = self.api_client.post(
            f"/api/v1/rewards/campaigns/{self.campaign.slug}/buy/",
            {"quantity": 4},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        order_id = resp.data["order_id"]
        order = Order.objects.get(id=order_id)
        self.assertEqual(order.currency, "CLP")
        self.assertEqual(order.status, "pending")
        self.assertEqual(Entry.objects.filter(order=order).count(), 0)

        # Al pagarse la orden, se generan 4 tickets
        order.status = OrderStatus.PAID
        order.save()
        entries = Entry.objects.filter(order=order)
        self.assertEqual(entries.count(), 4)
        for e in entries:
            self.assertIsNone(e.product)
            self.assertEqual(e.campaign, self.campaign)

    # ═══════════════════════════════════════════════════════════════
    # #32 (RWD-02): CICLO DE VIDA DE CAMPAÑAS Y SORTEOS IDEMPOTENTES
    # ═══════════════════════════════════════════════════════════════

    def test_rwd02_campaign_lifecycle_and_duplicate(self):
        """Verificación del ciclo de vida de campaña: borrador, clonación y finalización."""
        # 1. Duplicar campaña activa
        resp_dup = self.admin_client.post(
            f"/api/v1/admin/rewards/campaigns/{self.campaign.id}/duplicate/"
        )
        self.assertEqual(resp_dup.status_code, 201)
        dup_id = resp_dup.data["id"]
        dup_campaign = Campaign.objects.get(id=dup_id)
        self.assertEqual(dup_campaign.status, CampaignStatus.DRAFT)
        self.assertIn("(copia)", dup_campaign.name)
        self.assertEqual(dup_campaign.reward_products.count(), 1)

        # 2. Finalizar campaña
        resp_fin = self.admin_client.post(
            f"/api/v1/admin/rewards/campaigns/{self.campaign.id}/finish/"
        )
        self.assertEqual(resp_fin.status_code, 200)
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, CampaignStatus.FINISHED)

    def test_rwd02_run_draw_idempotency_and_cryptographic_selection(self):
        """Ejecución de sorteo criptográfico, 1 ganador + suplentes y prevención de doble sorteo."""
        # Generar participaciones para múltiples usuarios
        other_user = User.objects.create_user(
            email="otro@levelproaudio.test", username="otro_u", password="x"
        )
        third_user = User.objects.create_user(
            email="tercero@levelproaudio.test", username="tercero_u", password="x"
        )

        for u in [self.client_user, other_user, third_user]:
            o = Order.objects.create(
                user=u, email=u.email, shipping_address="dir", total=Decimal("400000"),
                currency="CLP", status=OrderStatus.PENDING,
            )
            OrderItem.objects.create(
                order=o, product=self.product_clp, product_name=self.product_clp.name,
                price=self.product_clp.price, quantity=1,
            )
            o.status = OrderStatus.PAID
            o.save()

        # Ejecutar sorteo vía API admin
        resp = self.admin_client.post(f"/api/v1/admin/rewards/campaigns/{self.campaign.id}/draw/")
        self.assertEqual(resp.status_code, 200)
        winners_data = resp.data["winners"]
        # 1 principal + 2 suplentes = 3 ganadores
        self.assertEqual(len(winners_data), 3)

        self.campaign.refresh_from_db()
        self.assertTrue(self.campaign.is_drawn)
        self.assertEqual(self.campaign.status, CampaignStatus.FINISHED)
        self.assertEqual(self.campaign.drawn_by, self.staff_admin)

        # Intento de repetir sorteo es rechazado
        resp_repeat = self.admin_client.post(f"/api/v1/admin/rewards/campaigns/{self.campaign.id}/draw/")
        self.assertEqual(resp_repeat.status_code, 400)
        self.assertIn("ya fue sorteada", resp_repeat.data["error"])

    def test_rwd02_public_winner_serializer_masks_pii(self):
        """El endpoint público de ganadores anonimiza el apellido y no expone correos ni datos privados."""
        # Crear ganador de prueba
        winner = Winner.objects.create(
            campaign=self.campaign,
            user=self.client_user,
            user_name="Carlos Valenzuela Pérez",
            user_email="carlos.valenzuela@example.com",
            is_backup=False,
            backup_position=0,
        )

        public_data = WinnerPublicSerializer(winner).data
        # Valida que el nombre se trunque con inicial (Carlos P.)
        self.assertEqual(public_data["name"], "Carlos P.")
        # Campos privados nunca deben existir en la respuesta pública
        self.assertNotIn("user_email", public_data)
        self.assertNotIn("email", public_data)
        self.assertNotIn("user", public_data)

        # Serializador admin sí preserva trazabilidad
        admin_data = AdminWinnerSerializer(winner).data
        self.assertEqual(admin_data["user_email"], "carlos.valenzuela@example.com")
        self.assertEqual(admin_data["user_name"], "Carlos Valenzuela Pérez")

    # ═══════════════════════════════════════════════════════════════
    # #34 (LYT-01): REGLAS DE ACUMULACIÓN, CANJE, REVERSIÓN Y AUDITORÍA
    # ═══════════════════════════════════════════════════════════════

    def test_lyt01_point_accrual_and_tier_advancement(self):
        """Acumulación de puntos por compras pagadas en CLP y progreso automático de nivel."""
        order = Order.objects.create(
            user=self.client_user,
            email=self.client_user.email,
            shipping_address="Calle Audio 456",
            total=Decimal("150000"),
            currency="CLP",
            status=OrderStatus.PENDING,
        )
        OrderItem.objects.create(
            order=order, product=self.product_clp, product_name=self.product_clp.name,
            price=Decimal("150000"), quantity=1,
        )
        order.status = OrderStatus.PAID
        order.save()

        account = LoyaltyAccount.objects.get(user=self.client_user)
        # 150.000 * 0.01 = 1500 puntos -> Nivel Silver (>= 1000)
        self.assertEqual(account.puntos_totales, 1500)
        self.assertEqual(account.nivel, "silver")

        # Segunda orden para llegar a Gold (>= 5000)
        order2 = Order.objects.create(
            user=self.client_user, email=self.client_user.email,
            shipping_address="Calle Audio 456", total=Decimal("400000"),
            currency="CLP", status=OrderStatus.PAID,
        )
        OrderItem.objects.create(
            order=order2, product=self.product_clp, product_name=self.product_clp.name,
            price=Decimal("400000"), quantity=1,
        )
        order2.save()

        account.refresh_from_db()
        # 1500 + 4000 = 5500 puntos -> Nivel Gold
        self.assertEqual(account.puntos_totales, 5500)
        self.assertEqual(account.nivel, "gold")

    def test_lyt01_redemption_constraints_and_validation(self):
        """Validación de umbral mínimo de canje y saldo insuficiente en checkout."""
        account = LoyaltyAccount.objects.create(
            user=self.client_user, puntos_totales=2000
        )

        # 1. Canje inferior al mínimo permitido (500 pts)
        resp_below = self.api_client.post(
            "/api/v1/orders/",
            {
                "items": [{"product": str(self.product_clp.id), "quantity": 1}],
                "shipping_address": "Test",
                "currency": "CLP",
                "loyalty_points_redeemed": 300,
            },
            format="json",
        )
        self.assertEqual(resp_below.status_code, 400)
        self.assertIn("Mínimo de canje: 500", resp_below.data["error"])

        # 2. Canje superior al saldo disponible (2500 > 2000)
        resp_over = self.api_client.post(
            "/api/v1/orders/",
            {
                "items": [{"product": str(self.product_clp.id), "quantity": 1}],
                "shipping_address": "Test",
                "currency": "CLP",
                "loyalty_points_redeemed": 2500,
            },
            format="json",
        )
        self.assertEqual(resp_over.status_code, 400)
        self.assertIn("No tenés suficientes puntos", resp_over.data["error"])

        # 3. Canje exitoso de 500 puntos
        resp_ok = self.api_client.post(
            "/api/v1/orders/",
            {
                "items": [{"product": str(self.product_clp.id), "quantity": 1}],
                "shipping_address": "Test",
                "currency": "CLP",
                "loyalty_points_redeemed": 500,
            },
            format="json",
        )
        self.assertEqual(resp_ok.status_code, 201)
        account.refresh_from_db()
        self.assertEqual(account.puntos_canjeados, 500)
        self.assertEqual(account.puntos_disponibles, 1500)

    def test_lyt01_reversal_on_cancellation_both_earned_and_redeemed(self):
        """Cancelación de orden revierte puntos ganados y devuelve puntos canjeados de forma segura."""
        account = LoyaltyAccount.objects.create(
            user=self.client_user, puntos_totales=2000
        )

        # Checkout canjeando 500 puntos
        resp = self.api_client.post(
            "/api/v1/orders/",
            {
                "items": [{"product": str(self.product_clp.id), "quantity": 1}],
                "shipping_address": "Test",
                "currency": "CLP",
                "loyalty_points_redeemed": 500,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        order_id = resp.data["id"]
        order = Order.objects.get(id=order_id)

        # Pagar la orden para que también gane puntos por el saldo pagado (subtotal 400.000 - 500 = 399.500)
        order.status = OrderStatus.PAID
        order.save()

        account.refresh_from_db()
        earned = int(float(order.total) * 0.01)  # 3995 puntos
        self.assertEqual(account.puntos_canjeados, 500)
        self.assertEqual(account.puntos_totales, 2000 + earned)

        # Cancelar la orden
        order.status = OrderStatus.CANCELLED
        order.save()

        account.refresh_from_db()
        # 1. Puntos ganados fueron quitados
        self.assertEqual(account.puntos_totales, 2000)
        # 2. Puntos canjeados fueron devueltos a la cuenta
        self.assertEqual(account.puntos_canjeados, 0)
        self.assertEqual(account.puntos_disponibles, 2000)

        # Re-save idempotente
        order.save()
        account.refresh_from_db()
        self.assertEqual(account.puntos_disponibles, 2000)

    def test_lyt01_admin_adjust_points_auditing(self):
        """Ajustes manuales del administrador registran auditoría y actualizan saldo disponible."""
        account = LoyaltyAccount.objects.create(
            user=self.client_user, puntos_totales=1000
        )

        # Ajuste positivo
        resp_add = self.admin_client.post(
            "/api/v1/loyalty/admin/adjust/",
            {
                "user_id": str(self.client_user.id),
                "puntos": 350,
                "descripcion": "Bonificación concurso aniversario",
            },
            format="json",
        )
        self.assertEqual(resp_add.status_code, 200)
        account.refresh_from_db()
        self.assertEqual(account.puntos_disponibles, 1350)
        self.assertTrue(
            LoyaltyTransaction.objects.filter(
                account=account, tipo="earn", puntos=350
            ).exists()
        )

        # Ajuste negativo
        resp_sub = self.admin_client.post(
            "/api/v1/loyalty/admin/adjust/",
            {
                "user_id": str(self.client_user.id),
                "puntos": -150,
                "descripcion": "Corrección administrativa",
            },
            format="json",
        )
        self.assertEqual(resp_sub.status_code, 200)
        account.refresh_from_db()
        self.assertEqual(account.puntos_disponibles, 1200)
        self.assertTrue(
            LoyaltyTransaction.objects.filter(
                account=account, tipo="adjust", puntos=-150
            ).exists()
        )

    # ═══════════════════════════════════════════════════════════════
    # #35 (LYT-02): GUARD DE DIVISAS Y EXENCIÓN INTERNACIONAL USD/ARS
    # ═══════════════════════════════════════════════════════════════

    def test_lyt02_multicurrency_loyalty_guard(self):
        """Órdenes internacionales USD/ARS no generan puntos ni admiten canjes en CLP."""
        account = LoyaltyAccount.objects.create(
            user=self.client_user, puntos_totales=2000
        )

        # 1. Pago de órdenes en USD y ARS nunca acredita puntos CLP
        for curr, tot in [("USD", Decimal("450.00")), ("ARS", Decimal("550000"))]:
            o = Order.objects.create(
                user=self.client_user, email=self.client_user.email,
                shipping_address="Intl Address", total=tot,
                currency=curr, status=OrderStatus.PENDING,
            )
            o.status = OrderStatus.PAID
            o.save()

        account.refresh_from_db()
        self.assertEqual(account.puntos_totales, 2000)
        self.assertFalse(LoyaltyTransaction.objects.filter(tipo="earn").exists())

        # 2. Checkout en moneda extranjera rechazará canje de puntos con 400
        for foreign_curr in ["USD", "ARS"]:
            resp = self.api_client.post(
                "/api/v1/orders/",
                {
                    "items": [{"product": str(self.product_clp.id), "quantity": 1}],
                    "shipping_address": "Test Intl",
                    "currency": foreign_curr,
                    "loyalty_points_redeemed": 500,
                },
                format="json",
            )
            self.assertEqual(resp.status_code, 400)
            self.assertIn("solo para órdenes CLP", resp.data["error"])

        # 3. Checkout en moneda extranjera SIN canje procede con normalidad
        resp_usd = self.api_client.post(
            "/api/v1/orders/",
            {
                "items": [{"product": str(self.product_clp.id), "quantity": 1}],
                "shipping_address": "Test Intl",
                "currency": "USD",
                "loyalty_points_redeemed": 0,
            },
            format="json",
        )
        self.assertEqual(resp_usd.status_code, 201)
        usd_order = Order.objects.get(id=resp_usd.data["id"])
        self.assertEqual(usd_order.currency, "USD")
        self.assertEqual(usd_order.loyalty_discount, 0)
        account.refresh_from_db()
        self.assertEqual(account.puntos_canjeados, 0)
