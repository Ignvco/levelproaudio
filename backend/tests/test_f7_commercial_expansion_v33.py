"""
backend/tests/test_f7_commercial_expansion_v33.py

Suite de Certificación Integral — FASE F7: Expansión Comercial V3.3
Cubre los 5 módulos aprobados del Roadmap Oficial V3.3:
- Módulo 1 (#40, V33-01): Comparador técnico de equipamiento de audio profesional.
- Módulo 2 (#41, V33-02): Sistema de cotizaciones B2B mayoristas e institucionales.
- Módulo 3 (#42, V33-03): Logística regional (CL/AR) y validación tributaria transfronteriza (SII / AFIP).
- Módulo 4 (#43, V33-04): Schema.org JSON-LD para Google Search & Shopping.
- Módulo 5 (#44, V33-05): Integración federada SoundMap (SSO HMAC, Webhook y Audio Assets).
"""
import hashlib
import hmac
import json
import time
from decimal import Decimal

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils.encoding import force_bytes
from rest_framework import status
from rest_framework.test import APIClient

from apps.billing.shipping_and_tax import (
    clean_tax_id,
    validate_chilean_rut,
    validate_argentine_cuit,
    generate_sii_dte_payload,
    generate_afip_invoice_payload,
)
from apps.orders.models import Order, B2BQuote, B2BQuoteItem, B2BQuoteStatus
from apps.products.models import Category, Brand, Product
from apps.site_settings.models import SiteSettings
from apps.users.sso_soundmap import (
    generate_soundmap_sso_token,
    verify_soundmap_sso_token,
)

User = get_user_model()


@pytest.mark.django_db
class TestCommercialExpansionV33:

    @pytest.fixture(autouse=True)
    def setup_env(self):
        self.client = APIClient()

        # SiteSettings para tasas de conversión
        self.settings = SiteSettings.objects.first()
        if not self.settings:
            self.settings = SiteSettings.objects.create(
                site_name="LevelPro Audio",
                usd_to_clp=Decimal("950.00"),
                usd_to_ars=Decimal("1200.00"),
            )
        else:
            self.settings.usd_to_clp = Decimal("950.00")
            self.settings.usd_to_ars = Decimal("1200.00")
            self.settings.save()

        # Usuarios de prueba
        self.admin = User.objects.create_superuser(
            username="admin_v33@levelproaudio.com",
            email="admin_v33@levelproaudio.com",
            password="adminpassword123",
            first_name="Admin",
            last_name="LevelPro",
        )
        self.customer = User.objects.create_user(
            username="customer_v33@client.com",
            email="customer_v33@client.com",
            password="clientpassword123",
            first_name="Estudio",
            last_name="Grabación",
        )

        # Categoría y Marca
        self.category = Category.objects.create(
            name="Micrófonos de Estudio",
            slug="microfonos-de-estudio",
            is_active=True,
        )
        self.brand = Brand.objects.create(
            name="Neumann",
            slug="neumann",
            is_active=True,
        )

        # Productos para tests
        self.prod_a = Product.objects.create(
            name="Neumann U87 Ai",
            slug="neumann-u87-ai",
            sku="NEU-U87-AI",
            price=Decimal("2890000"),
            price_usd=Decimal("3200.00"),
            price_ars=Decimal("3800000.00"),
            stock=5,
            stock_min=2,
            weight=Decimal("0.50"),
            description="Micrófono a condensador diafragma grande con conectividad XLR balanceado y respuesta 20 Hz a 20 kHz.",
            category=self.category,
            brand=self.brand,
            is_active=True,
        )
        self.prod_b = Product.objects.create(
            name="Neumann TLM 103",
            slug="neumann-tlm-103",
            sku="NEU-TLM-103",
            price=Decimal("1150000"),
            price_usd=Decimal("1250.00"),
            price_ars=Decimal("1500000.00"),
            stock=12,
            stock_min=3,
            weight=Decimal("0.45"),
            description="Micrófono de estudio cardioide diafragma grande con salida XLR balanceado.",
            category=self.category,
            brand=self.brand,
            is_active=True,
        )
        self.prod_c = Product.objects.create(
            name="Neumann KM 184",
            slug="neumann-km-184",
            sku="NEU-KM-184",
            price=Decimal("790000"),
            price_usd=Decimal("850.00"),
            price_ars=Decimal("1000000.00"),
            stock=8,
            stock_min=2,
            weight=Decimal("0.20"),
            description="Micrófono diafragma pequeño miniatura XLR.",
            category=self.category,
            brand=self.brand,
            is_active=True,
        )

    # ═══════════════════════════════════════════════════════════════
    # MÓDULO 1 (#40): COMPARADOR TÉCNICO DE PRODUCTOS
    # ═══════════════════════════════════════════════════════════════

    def test_v33_01_product_comparator_validation_bounds(self):
        """Verifica validación de límites (mínimo 2, máximo 4) y productos inválidos."""
        # Sin productos
        resp = self.client.post("/api/v1/products/compare/", {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

        # Menos de 2 productos
        resp = self.client.post("/api/v1/products/compare/", {
            "product_ids": [str(self.prod_a.id)]
        }, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "al menos 2 productos" in resp.data["error"]

        # Más de 4 productos
        resp = self.client.post("/api/v1/products/compare/", {
            "product_ids": ["1", "2", "3", "4", "5"]
        }, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "Máximo 4" in resp.data["error"]

    def test_v33_01_product_comparator_specs_and_advantages(self):
        """Verifica matriz de especificaciones, ventajas competitivas y accesorios compatibles."""
        resp = self.client.post("/api/v1/products/compare/", {
            "product_ids": [str(self.prod_a.id), str(self.prod_b.id)],
            "currency": "CLP",
        }, format="json")

        assert resp.status_code == status.HTTP_200_OK
        data = resp.data
        assert data["count"] == 2
        assert len(data["products"]) == 2

        # Comparación de precios y stock
        prod_data_a = next(p for p in data["products"] if p["id"] == str(self.prod_a.id))
        prod_data_b = next(p for p in data["products"] if p["id"] == str(self.prod_b.id))

        assert prod_data_a["price"] == 2890000.0
        assert prod_data_b["price"] == 1150000.0

        # Ventajas competitivas calculadas dinámicamente
        assert data["advantages"]["best_price"]["product_id"] == str(self.prod_b.id)
        assert data["advantages"]["highest_availability"]["product_id"] == str(self.prod_b.id)

        # Especificaciones extraídas
        assert prod_data_a["specs"]["connectivity"] == "XLR balanceado"
        assert prod_data_a["specs"]["frequency_response"] == "20 Hz – 20 kHz"

        # Accesorios compatibles (en este caso el tercer producto de la categoría)
        assert len(data["compatible_accessories"]) >= 1
        assert any(acc["id"] == str(self.prod_c.id) for acc in data["compatible_accessories"])

    def test_v33_01_product_comparator_multi_currency(self):
        """Verifica que el comparador retorne precios aislados en USD y ARS sin conversión implícita."""
        resp_usd = self.client.post("/api/v1/products/compare/", {
            "slugs": [self.prod_a.slug, self.prod_b.slug],
            "currency": "USD",
        }, format="json")
        assert resp_usd.status_code == status.HTTP_200_OK
        assert resp_usd.data["currency"] == "USD"
        p_a = next(p for p in resp_usd.data["products"] if p["slug"] == self.prod_a.slug)
        assert p_a["price"] == 3200.0

    # ═══════════════════════════════════════════════════════════════
    # MÓDULO 2 (#41): COTIZACIONES B2B MAYORISTAS
    # ═══════════════════════════════════════════════════════════════

    def test_v33_02_b2b_quote_creation_clp_tax(self):
        """Verifica la creación pública de solicitud de cotización B2B con cálculo de IVA chileno (19%)."""
        payload = {
            "company_name": "Estudios del Sur SpA",
            "tax_id": "76.123.456-0",
            "contact_name": "Carlos Mezcla",
            "email": "carlos@estudiosdelsur.cl",
            "phone": "+56912345678",
            "currency": "CLP",
            "items": [
                {"product_id": str(self.prod_a.id), "quantity": 2},
                {"product_id": str(self.prod_b.id), "quantity": 1},
            ],
            "notes": "Requerimos entrega en Providencia con factura electrónica.",
        }

        resp = self.client.post("/api/v1/b2b/quotes/", payload, format="json")
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.data

        # Subtotal: (2890000 * 2) + 1150000 = 5780000 + 1150000 = 6930000
        expected_subtotal = Decimal("6930000.00")
        expected_tax = (expected_subtotal * Decimal("0.19")).quantize(Decimal("0.01"))
        expected_total = expected_subtotal + expected_tax

        assert data["company_name"] == "Estudios del Sur SpA"
        assert Decimal(str(data["subtotal"])) == expected_subtotal
        assert Decimal(str(data["tax_amount"])) == expected_tax
        assert Decimal(str(data["total"])) == expected_total
        assert data["status"] == B2BQuoteStatus.PENDING

    def test_v33_02_b2b_quote_admin_management_and_discount(self):
        """Verifica la revisión administrativa de cotizaciones B2B y la aplicación de descuentos comerciales."""
        # Crear cotización
        quote = B2BQuote.objects.create(
            company_name="Radioemisora Nacional",
            tax_id="761234560",
            contact_name="Pedro Transmisión",
            email="pedro@radionacional.cl",
            currency="CLP",
            subtotal=Decimal("1000000.00"),
            tax_amount=Decimal("190000.00"),
            total=Decimal("1190000.00"),
            status=B2BQuoteStatus.PENDING,
        )
        B2BQuoteItem.objects.create(
            quote=quote,
            product=self.prod_b,
            product_name=self.prod_b.name,
            unit_price=Decimal("1000000.00"),
            quantity=1,
            subtotal=Decimal("1000000.00"),
        )

        # Autenticación Staff
        self.client.force_authenticate(user=self.admin)

        # Listado con filtros
        resp_list = self.client.get("/api/v1/admin/b2b/quotes/?search=Radioemisora")
        assert resp_list.status_code == status.HTTP_200_OK
        assert resp_list.data["count"] >= 1

        # Detalle
        resp_detail = self.client.get(f"/api/v1/admin/b2b/quotes/{quote.id}/")
        assert resp_detail.status_code == status.HTTP_200_OK
        assert len(resp_detail.data["items"]) == 1

        # Aplicar 10% de descuento y aprobar
        patch_payload = {
            "discount_percent": 10.0,
            "status": B2BQuoteStatus.APPROVED,
            "admin_notes": "Descuento institucional por volumen aprobado.",
        }
        resp_patch = self.client.patch(f"/api/v1/admin/b2b/quotes/{quote.id}/", patch_payload, format="json")
        assert resp_patch.status_code == status.HTTP_200_OK

        quote.refresh_from_db()
        assert quote.status == B2BQuoteStatus.APPROVED
        assert quote.discount_percent == Decimal("10.00")
        assert quote.discount_amount == Decimal("100000.00")  # 10% de 1.000.000
        # Net after discount = 900.000 -> Tax 19% = 171.000 -> Total = 1.071.000
        assert quote.tax_amount == Decimal("171000.00")
        assert quote.total == Decimal("1071000.00")

    def test_v33_02_b2b_quote_convert_to_order(self):
        """Verifica la conversión atómica de una cotización aprobada a una Order de compra con precios congelados."""
        quote = B2BQuote.objects.create(
            user=self.customer,
            company_name="Estudio Master Pro",
            tax_id="761234560",
            contact_name="Lorena Acústica",
            email="lorena@masterpro.cl",
            currency="CLP",
            subtotal=Decimal("2000000.00"),
            tax_amount=Decimal("380000.00"),
            total=Decimal("2380000.00"),
            status=B2BQuoteStatus.APPROVED,
        )
        B2BQuoteItem.objects.create(
            quote=quote,
            product=self.prod_a,
            product_name=self.prod_a.name,
            unit_price=Decimal("2000000.00"),
            quantity=1,
            subtotal=Decimal("2000000.00"),
        )

        self.client.force_authenticate(user=self.admin)

        # Conversión
        resp_convert = self.client.post(f"/api/v1/admin/b2b/quotes/{quote.id}/convert/")
        assert resp_convert.status_code == status.HTTP_201_CREATED
        order_id = resp_convert.data["order_id"]

        quote.refresh_from_db()
        assert quote.status == B2BQuoteStatus.CONVERTED
        assert str(quote.converted_order_id) == order_id

        # Verificar la orden creada
        order = Order.objects.get(id=order_id)
        assert order.status == "pending"
        assert order.total == Decimal("2380000.00")
        assert order.currency == "CLP"
        assert order.stock_deductions == {str(self.prod_a.id): 1}
        assert order.items.count() == 1
        assert order.items.first().price == Decimal("2000000.00")

        # Re-conversión debe ser rechazada
        resp_reconvert = self.client.post(f"/api/v1/admin/b2b/quotes/{quote.id}/convert/")
        assert resp_reconvert.status_code == status.HTTP_400_BAD_REQUEST

    # ═══════════════════════════════════════════════════════════════
    # MÓDULO 3 (#42): LOGÍSTICA REGIONAL Y TRIBUTARIA (CL / AR)
    # ═══════════════════════════════════════════════════════════════

    def test_v33_03_shipping_rates_estimation_chile_and_argentina(self):
        """Verifica la estimación de fletes regionalizados y validación de monedas por país."""
        # Chile en CLP
        resp_cl = self.client.post("/api/v1/billing/shipping/estimate/", {
            "country": "CL",
            "city": "Providencia, Santiago",
            "weight_kg": 2.5,
            "currency": "CLP",
        }, format="json")
        assert resp_cl.status_code == status.HTTP_200_OK
        data_cl = resp_cl.data
        assert data_cl["country"] == "CL"
        assert len(data_cl["rates"]) == 3
        carriers_cl = [r["carrier_code"] for r in data_cl["rates"]]
        assert "chilexpress" in carriers_cl
        assert "starken" in carriers_cl

        # Argentina en ARS
        resp_ar = self.client.post("/api/v1/billing/shipping/estimate/", {
            "country": "AR",
            "city": "Palermo, Buenos Aires",
            "weight_kg": 1.5,
            "currency": "ARS",
        }, format="json")
        assert resp_ar.status_code == status.HTTP_200_OK
        data_ar = resp_ar.data
        assert data_ar["country"] == "AR"
        carriers_ar = [r["carrier_code"] for r in data_ar["rates"]]
        assert "andreani" in carriers_ar
        assert "correo_argentino" in carriers_ar

        # Rechazo de moneda cruzada indebida (ej: cotizar Argentina en CLP)
        resp_bad = self.client.post("/api/v1/billing/shipping/estimate/", {
            "country": "AR",
            "currency": "CLP",
        }, format="json")
        assert resp_bad.status_code == status.HTTP_400_BAD_REQUEST

    def test_v33_03_tax_id_validation_modulo_11(self):
        """Verifica algoritmos Módulo 11 para RUT chileno y CUIT argentino."""
        # 1. Chile RUT
        assert validate_chilean_rut("76.123.456-0") is True
        assert validate_chilean_rut("11.111.111-1") is True
        assert validate_chilean_rut("77.890.123-4") is True
        assert validate_chilean_rut("76.123.456-7") is False  # DV incorrecto

        resp_rut_ok = self.client.post("/api/v1/billing/tax/validate/", {
            "country": "CL",
            "tax_id": "761234560",
        }, format="json")
        assert resp_rut_ok.status_code == status.HTTP_200_OK
        assert resp_rut_ok.data["is_valid"] is True
        assert resp_rut_ok.data["formatted"] == "76123456-0"

        # 2. Argentina CUIT
        assert validate_argentine_cuit("30-71890123-1") is True
        assert validate_argentine_cuit("30-71890123-8") is False  # DV incorrecto
        assert validate_argentine_cuit("99-12345678-0") is False  # Prefijo no fiscal

        resp_cuit_ok = self.client.post("/api/v1/billing/tax/validate/", {
            "country": "AR",
            "tax_id": "30718901231",
        }, format="json")
        assert resp_cuit_ok.status_code == status.HTTP_200_OK
        assert resp_cuit_ok.data["is_valid"] is True
        assert resp_cuit_ok.data["formatted"] == "30-71890123-1"

    def test_v33_03_tax_documents_payload_generators_strict_currency(self):
        """Verifica generación de esquemas DTE SII y Factura AFIP con aislamiento monetario estricto."""
        order_clp = Order.objects.create(
            user=self.customer,
            email="cliente@levelproaudio.com",
            total=Decimal("1190000"),
            currency="CLP",
            status="paid",
        )
        order_ars = Order.objects.create(
            user=self.customer,
            email="cliente@levelproaudio.com",
            total=Decimal("121000.00"),
            currency="ARS",
            status="paid",
        )

        # 1. DTE SII Chile (Factura 33 en CLP)
        dte = generate_sii_dte_payload(order_clp, buyer_tax_id="76.123.456-0", buyer_name="Estudios SpA", dte_type="33")
        assert dte["tipo_dte"] == 33
        assert dte["totales"]["moneda"] == "CLP"
        assert dte["totales"]["monto_neto"] == 1000000
        assert dte["totales"]["monto_iva"] == 190000
        assert dte["totales"]["monto_total"] == 1190000

        # Rechazo de DTE chileno si la orden no es en CLP
        with pytest.raises(ValueError, match="exclusivamente en CLP"):
            generate_sii_dte_payload(order_ars, buyer_tax_id="76.123.456-0", buyer_name="Estudios SpA")

        # 2. Factura AFIP Argentina (Factura A en ARS)
        afip = generate_afip_invoice_payload(order_ars, cuit="30-71890123-1", recipient_name="Productora S.A.", invoice_type="A")
        assert afip["tipo_comprobante"] == 1  # Factura A
        assert afip["totales"]["moneda"] == "ARS"
        assert afip["totales"]["monto_neto"] == 100000.0
        assert afip["totales"]["importe_iva"] == 21000.0
        assert afip["totales"]["monto_total"] == 121000.0

        # Rechazo de factura AFIP si la orden está en CLP
        with pytest.raises(ValueError, match="denominarse en ARS o USD"):
            generate_afip_invoice_payload(order_clp, cuit="30-71890123-1", recipient_name="Productora S.A.")

    # ═══════════════════════════════════════════════════════════════
    # MÓDULO 4 (#43): DATOS ESTRUCTURADOS SCHEMA.ORG JSON-LD
    # ═══════════════════════════════════════════════════════════════

    def test_v33_04_schema_org_json_ld_metadata(self):
        """Verifica que el endpoint público de SEO entregue datos Schema.org conformes con Google Shopping."""
        resp = self.client.get(f"/api/v1/seo/schema/product/{self.prod_a.slug}/")
        assert resp.status_code == status.HTTP_200_OK

        schema = resp.json()
        assert schema["@context"] == "https://schema.org/"
        assert schema["@type"] == "Product"
        assert schema["name"] == self.prod_a.name
        assert schema["sku"] == self.prod_a.sku
        assert schema["brand"]["name"] == "Neumann"

        # Oferta agregada multimoneda
        offers = schema["offers"]
        assert offers["@type"] == "AggregateOffer"
        assert offers["offerCount"] == 3
        currencies = [o["priceCurrency"] for o in offers["offers"]]
        assert "CLP" in currencies
        assert "USD" in currencies
        assert "ARS" in currencies

        # Breadcrumbs estructurados
        breadcrumbs = schema["breadcrumb"]
        assert breadcrumbs["@type"] == "BreadcrumbList"
        assert len(breadcrumbs["itemListElement"]) == 4

    # ═══════════════════════════════════════════════════════════════
    # MÓDULO 5 (#44): ECOSISTEMA Y SSO SOUNDMAP
    # ═══════════════════════════════════════════════════════════════

    def test_v33_05_soundmap_sso_jwt_token_generation_and_verification(self):
        """Verifica la emisión de token SSO federado con HMAC-SHA256 y su validación criptográfica."""
        self.client.force_authenticate(user=self.customer)

        resp = self.client.post("/api/v1/auth/sso/soundmap/token/")
        assert resp.status_code == status.HTTP_200_OK
        data = resp.data
        token = data["sso_token"]
        assert token is not None
        assert data["expires_in"] == 900
        assert "soundmap.app/sso/callback" in data["target_url"]

        # Validar token criptográficamente
        payload = verify_soundmap_sso_token(token)
        assert payload["iss"] == "levelproaudio.com"
        assert payload["aud"] == "soundmap.app"
        assert payload["sub"] == str(self.customer.id)
        assert payload["email"] == self.customer.email

        # Manipulación maliciosa del token debe ser rechazada
        tampered_token = token[:-4] + "AAAA"
        with pytest.raises(ValueError, match="Firma HMAC inválida"):
            verify_soundmap_sso_token(tampered_token)

    def test_v33_05_soundmap_webhook_hmac_signature(self):
        """Verifica la recepción segura de webhooks inter-plataforma autenticados con HMAC-SHA256."""
        secret = force_bytes(settings.SECRET_KEY)
        payload_dict = {
            "event": "soundmap.sample_playback_completed",
            "data": {
                "user_id": str(self.customer.id),
                "sample_id": "demo-u87-kick",
                "timestamp": int(time.time()),
            }
        }
        raw_body = json.dumps(payload_dict).encode("utf-8")
        valid_signature = hmac.new(secret, raw_body, hashlib.sha256).hexdigest()

        # 1. Petición con firma correcta
        resp_ok = self.client.post(
            "/api/v1/integrations/soundmap/webhook/",
            data=raw_body,
            content_type="application/json",
            HTTP_X_SOUNDMAP_SIGNATURE=valid_signature,
        )
        assert resp_ok.status_code == status.HTTP_200_OK
        assert resp_ok.data["received"] is True
        assert resp_ok.data["event"] == "soundmap.sample_playback_completed"

        # 2. Petición sin firma (403 Forbidden)
        resp_no_sig = self.client.post(
            "/api/v1/integrations/soundmap/webhook/",
            data=raw_body,
            content_type="application/json",
        )
        assert resp_no_sig.status_code == status.HTTP_403_FORBIDDEN

        # 3. Petición con firma inválida (403 Forbidden)
        resp_bad_sig = self.client.post(
            "/api/v1/integrations/soundmap/webhook/",
            data=raw_body,
            content_type="application/json",
            HTTP_X_SOUNDMAP_SIGNATURE="deadbeefbadsignature123456",
        )
        assert resp_bad_sig.status_code == status.HTTP_403_FORBIDDEN

    def test_v33_05_soundmap_audio_assets_catalog(self):
        """Verifica la exposición del catálogo de activos de audio para SoundMap Player."""
        resp = self.client.get("/api/v1/integrations/soundmap/audio-assets/")
        assert resp.status_code == status.HTTP_200_OK
        data = resp.data
        assert data["platform"] == "LevelPro Audio OS"
        assert data["count"] >= 3

        first_asset = data["assets"][0]
        assert first_asset["format"] == "wav"
        assert first_asset["sample_rate_hz"] == 48000
        assert first_asset["bit_depth"] == 24
        assert "preview_url" in first_asset
        assert "waveform_url" in first_asset
