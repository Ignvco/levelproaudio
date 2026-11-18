"""
backend/tests/test_audit_remediation_v34.py

Suite de Certificación — Remediación Integral Auditoría 360° (V3.4)
Cubre:
- P1-01: Integración Ualá Bis (Argentina — ARS) reemplazando MercadoPago AR.
- P2-01: Índices compuestos en tabla Order (status, -created_at) y (currency, status).
- P2-02: Soporte multi-moneda (CLP / USD / ARS) en Academia (Cursos) y Servicios.
- P3-01: Registro de extensión OpenAPI para CookieJWTAuthentication.
- P3-02: Configuración SECURE_HSTS_PRELOAD en producción.
"""
import hashlib
import hmac
import importlib
import json
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from apps.academy.models import Course
from apps.orders.models import Order, OrderStatus
from apps.payments.models import Payment, PaymentMethodConfig, PaymentProvider, PaymentStatus, PaymentWebhookEvent
from apps.payments.services import create_uala_checkout
from apps.services.models import Service
from apps.site_settings.models import SiteSettings

User = get_user_model()


@pytest.mark.django_db
class TestAuditRemediationV34:

    @pytest.fixture(autouse=True)
    def setup_env(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="student_v34@levelproaudio.com",
            email="student_v34@levelproaudio.com",
            password="SecurePassword123!",
            first_name="Sofía",
            last_name="Master",
        )
        self.settings_obj = SiteSettings.objects.first()
        if not self.settings_obj:
            self.settings_obj = SiteSettings.objects.create(
                site_name="LevelPro Audio",
                usd_to_clp=Decimal("950.00"),
                usd_to_ars=Decimal("1200.00"),
            )
        else:
            self.settings_obj.usd_to_clp = Decimal("950.00")
            self.settings_obj.usd_to_ars = Decimal("1200.00")
            self.settings_obj.save()

    # ═══════════════════════════════════════════════════════════════
    # P1-01: UALÁ BIS (ARGENTINA — ARS)
    # ═══════════════════════════════════════════════════════════════

    def test_p1_01_uala_seeded_and_mp_ar_disabled(self):
        """Verifica que la migración desactivó MercadoPago AR y sembró Ualá para ARS."""
        uala = PaymentMethodConfig.objects.filter(method=PaymentProvider.UALA).first()
        assert uala is not None
        assert "ARS" in uala.currency_list()

        mp_ar = PaymentMethodConfig.objects.filter(method=PaymentProvider.MERCADOPAGO_AR).first()
        if mp_ar is not None:
            assert mp_ar.is_active is False

    def test_p1_01_uala_checkout_creation_and_intent_reuse(self, settings):
        """Crea intención de pago Ualá Bis en ARS y verifica reutilización idempotente."""
        settings.UALA_USERNAME = "levelpro_ar"
        settings.UALA_CLIENT_ID = "client-123"
        settings.UALA_CLIENT_SECRET = "secret-456"
        settings.UALA_SANDBOX = True

        PaymentMethodConfig.objects.update_or_create(
            method=PaymentProvider.UALA,
            defaults={"is_active": True, "currencies": "ARS", "label": "Ualá"},
        )

        order = Order.objects.create(
            user=self.user,
            email=self.user.email,
            shipping_address="Palermo, Buenos Aires",
            total=Decimal("85000.00"),
            currency="ARS",
            status=OrderStatus.PENDING,
            stock_deductions={},
        )

        auth_resp = MagicMock(status_code=200)
        auth_resp.json.return_value = {"access_token": "uala-bearer-token-xyz"}

        checkout_resp = MagicMock(status_code=201)
        checkout_resp.json.return_value = {
            "uuid": "uala-order-uuid-001",
            "status": "PENDING",
            "amount": 85000.0,
            "links": {
                "checkoutLink": "https://checkout.stage.ua.la/pay/uala-order-uuid-001",
            },
        }

        self.client.force_authenticate(user=self.user)
        with patch("requests.post", side_effect=[auth_resp, checkout_resp]) as mock_post:
            resp1 = self.client.post(
                "/api/v1/payments/create/",
                {"order_id": str(order.id), "provider": "uala"},
                format="json",
            )
            assert resp1.status_code == status.HTTP_200_OK
            assert resp1.data["provider"] == "uala"
            assert resp1.data["uala_order_id"] == "uala-order-uuid-001"
            assert resp1.data["checkout_url"] == "https://checkout.stage.ua.la/pay/uala-order-uuid-001"
            assert mock_post.call_count == 2

            # Segundo llamado debe reutilizar el intent pendiente sin contactar nuevamente a Ualá
            resp2 = self.client.post(
                "/api/v1/payments/create/",
                {"order_id": str(order.id), "provider": "uala"},
                format="json",
            )
            assert resp2.status_code == status.HTTP_200_OK
            assert resp2.data["uala_order_id"] == "uala-order-uuid-001"
            assert mock_post.call_count == 2

        assert Payment.objects.filter(order=order, provider=PaymentProvider.UALA).count() == 1

    def test_p1_01_uala_rejects_non_ars_currency(self):
        """Ualá Bis solo opera en ARS; órdenes CLP/USD son rechazadas."""
        PaymentMethodConfig.objects.update_or_create(
            method=PaymentProvider.UALA,
            defaults={"is_active": True, "currencies": "ARS", "label": "Ualá"},
        )
        order_clp = Order.objects.create(
            user=self.user,
            email=self.user.email,
            shipping_address="Providencia, Santiago",
            total=Decimal("50000"),
            currency="CLP",
            status=OrderStatus.PENDING,
            stock_deductions={},
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            "/api/v1/payments/create/",
            {"order_id": str(order_clp.id), "provider": "uala"},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

        with pytest.raises(ValueError, match="ARS"):
            create_uala_checkout(order_clp)

    def test_p1_01_uala_webhook_security_and_authoritative_approval(self, settings):
        """Verifica fail-closed sin credenciales, firma HMAC, validación de monto e idempotencia."""
        # 1. Sin credenciales -> 503
        settings.UALA_USERNAME = ""
        settings.UALA_CLIENT_ID = ""
        settings.UALA_CLIENT_SECRET = ""
        resp_unavail = self.client.post(
            "/api/v1/payments/webhook/uala/",
            {"uuid": "uala-uuid-999", "status": "APPROVED"},
            format="json",
        )
        assert resp_unavail.status_code == status.HTTP_503_SERVICE_UNAVAILABLE

        # 2. Con credenciales y webhook secret -> rechaza firma inválida (401)
        settings.UALA_USERNAME = "levelpro_ar"
        settings.UALA_CLIENT_ID = "client-123"
        settings.UALA_CLIENT_SECRET = "secret-456"
        settings.UALA_WEBHOOK_SECRET = "uala-hmac-secret-test"

        order = Order.objects.create(
            user=self.user,
            email=self.user.email,
            shipping_address="Córdoba, Argentina",
            total=Decimal("120000.00"),
            currency="ARS",
            status=OrderStatus.PENDING,
            stock_deductions={},
        )
        payment = Payment.objects.create(
            order=order,
            provider=PaymentProvider.UALA,
            status=PaymentStatus.PENDING,
            amount=Decimal("120000.00"),
            currency="ARS",
            preference_id="uala-uuid-999",
        )

        raw_payload = json.dumps({"uuid": "uala-uuid-999", "status": "APPROVED"}).encode("utf-8")
        resp_bad_sig = self.client.post(
            "/api/v1/payments/webhook/uala/",
            data=raw_payload,
            content_type="application/json",
            HTTP_X_UALA_SIGNATURE="invalid-signature",
        )
        assert resp_bad_sig.status_code == status.HTTP_401_UNAUTHORIZED

        # 3. Firma válida + consulta autoritativa de Ualá con monto coincidente -> aprueba orden
        valid_sig = hmac.new(
            settings.UALA_WEBHOOK_SECRET.encode("utf-8"), raw_payload, hashlib.sha256
        ).hexdigest()

        remote_order = {
            "uuid": "uala-uuid-999",
            "status": "APPROVED",
            "amount": 120000.0,
            "external_reference": str(order.id),
        }
        with patch("apps.payments.services.fetch_uala_order", return_value=remote_order) as mock_fetch, \
             patch("apps.payments.services.send_payment_confirmation_email") as mock_email:
            resp_ok = self.client.post(
                "/api/v1/payments/webhook/uala/",
                data=raw_payload,
                content_type="application/json",
                HTTP_X_UALA_SIGNATURE=valid_sig,
            )
            assert resp_ok.status_code == status.HTTP_200_OK
            assert mock_fetch.call_count == 1
            assert mock_email.call_count == 1

            # Reintento duplicado debe ser deduplicado sin volver a consultar la API
            resp_dup = self.client.post(
                "/api/v1/payments/webhook/uala/",
                data=raw_payload,
                content_type="application/json",
                HTTP_X_UALA_SIGNATURE=valid_sig,
            )
            assert resp_dup.status_code == status.HTTP_200_OK
            assert mock_fetch.call_count == 1

        payment.refresh_from_db()
        order.refresh_from_db()
        assert payment.status == PaymentStatus.APPROVED
        assert order.status == OrderStatus.PAID
        assert PaymentWebhookEvent.objects.filter(provider=PaymentProvider.UALA).count() == 1

    def test_p1_01_uala_webhook_mismatched_amount_goes_to_in_review(self, settings):
        """Si Ualá reporta un monto distinto al esperado, el pago pasa a IN_REVIEW y no marca pagado."""
        settings.UALA_USERNAME = "levelpro_ar"
        settings.UALA_CLIENT_ID = "client-123"
        settings.UALA_CLIENT_SECRET = "secret-456"
        settings.UALA_WEBHOOK_SECRET = ""

        order = Order.objects.create(
            user=self.user,
            email=self.user.email,
            shipping_address="Rosario, Argentina",
            total=Decimal("100000.00"),
            currency="ARS",
            status=OrderStatus.PENDING,
            stock_deductions={},
        )
        payment = Payment.objects.create(
            order=order,
            provider=PaymentProvider.UALA,
            status=PaymentStatus.PENDING,
            amount=Decimal("100000.00"),
            currency="ARS",
            preference_id="uala-uuid-mismatch",
        )

        remote_order = {
            "uuid": "uala-uuid-mismatch",
            "status": "APPROVED",
            "amount": 50000.0,  # Monto manipulado / inferior
            "external_reference": str(order.id),
        }
        with patch("apps.payments.services.fetch_uala_order", return_value=remote_order):
            resp = self.client.post(
                "/api/v1/payments/webhook/uala/",
                {"uuid": "uala-uuid-mismatch", "status": "APPROVED"},
                format="json",
            )
            assert resp.status_code == status.HTTP_200_OK

        payment.refresh_from_db()
        order.refresh_from_db()
        assert payment.status == PaymentStatus.IN_REVIEW
        assert order.status == OrderStatus.PENDING

    # ═══════════════════════════════════════════════════════════════
    # P2-01: ÍNDICES DE BASE DE DATOS EN ORDER
    # ═══════════════════════════════════════════════════════════════

    def test_p2_01_order_indexes_configured(self):
        """Verifica db_index en Order.status e índices compuestos en Order._meta.indexes."""
        status_field = Order._meta.get_field("status")
        assert status_field.db_index is True

        index_names = {idx.name for idx in Order._meta.indexes}
        assert "order_status_created_idx" in index_names
        assert "order_currency_status_idx" in index_names

    # ═══════════════════════════════════════════════════════════════
    # P2-02: MULTI-MONEDA EN ACADEMIA Y SERVICIOS
    # ═══════════════════════════════════════════════════════════════

    def test_p2_02_academy_course_multicurrency_and_usd_purchase(self):
        """Cursos exponen precios en CLP/USD/ARS y permiten compra directa en USD (PayPal)."""
        course = Course.objects.create(
            title="Masterización Profesional de Audio",
            slug="masterizacion-pro-v34",
            description="Curso intensivo de mastering analógico y digital.",
            price=Decimal("47500.00"),
            price_usd=Decimal("55.00"),
            is_published=True,
            is_free=False,
        )

        # Listado público expone mapa `prices`
        resp_detail = self.client.get(f"/api/v1/courses/{course.slug}/")
        assert resp_detail.status_code == status.HTTP_200_OK
        assert resp_detail.data["prices"]["CLP"] == "47500.00"
        assert resp_detail.data["prices"]["USD"] == "55.00"
        assert Decimal(resp_detail.data["prices"]["ARS"]) == Decimal("66000")

        # Compra en USD genera orden con currency="USD" y total=55.00
        self.client.force_authenticate(user=self.user)
        resp_buy = self.client.post(
            f"/api/v1/courses/{course.slug}/purchase/",
            {"currency": "USD"},
            format="json",
        )
        assert resp_buy.status_code == status.HTTP_201_CREATED
        assert resp_buy.data["currency"] == "USD"
        assert resp_buy.data["amount"] == 55.0

        order = Order.objects.get(id=resp_buy.data["order_id"])
        assert order.currency == "USD"
        assert order.total == Decimal("55.00")

    def test_p2_02_service_multicurrency_and_usd_checkout(self):
        """Servicios de precio fijo exponen mapa `prices` y crean órdenes en USD/ARS/CLP."""
        service = Service.objects.create(
            name="Mastering Estéreo por Canción",
            slug="mastering-estereo-v34",
            description="Mastering profesional con entrega en WAV 24-bit.",
            price_type=Service.PriceType.FIXED,
            price=Decimal("45000.00"),
            price_usd=Decimal("49.00"),
            is_active=True,
        )

        resp_detail = self.client.get(f"/api/v1/services/{service.slug}/")
        assert resp_detail.status_code == status.HTTP_200_OK
        assert resp_detail.data["prices"]["CLP"] == "45000.00"
        assert resp_detail.data["prices"]["USD"] == "49.00"

        self.client.force_authenticate(user=self.user)
        resp_checkout = self.client.post(
            f"/api/v1/services/{service.slug}/checkout/",
            {"currency": "USD"},
            format="json",
        )
        assert resp_checkout.status_code == status.HTTP_201_CREATED
        assert resp_checkout.data["currency"] == "USD"
        assert resp_checkout.data["total"] == 49.0

        order = Order.objects.get(id=resp_checkout.data["order_id"])
        assert order.currency == "USD"
        assert order.total == Decimal("49.00")

    # ═══════════════════════════════════════════════════════════════
    # P3-01 & P3-02: OPENAPI EXTENSION & HSTS PRELOAD
    # ═══════════════════════════════════════════════════════════════

    def test_p3_01_and_p3_02_openapi_and_hsts_preload(self, monkeypatch):
        """Verifica registro de esquema CookieJWTAuth y SECURE_HSTS_PRELOAD en producción."""
        from core.openapi import CookieJWTAuthenticationScheme
        assert CookieJWTAuthenticationScheme.name == "CookieJWTAuth"

        monkeypatch.setenv("DJANGO_ALLOWED_HOSTS", "levelproaudio.com")
        monkeypatch.setenv("GCS_BUCKET_NAME", "test-bucket")
        monkeypatch.setenv("GCS_PROJECT_ID", "test-project")
        production = importlib.reload(importlib.import_module("config.settings.production"))
        assert production.SECURE_HSTS_PRELOAD is True
