# apps/orders/tests_gate10_preflight.py
"""
LEVELPRO OS V4.0 — GATE 10 PREFLIGHT TESTS (LOG10-PF-01..05)
"""

from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from apps.billing.shipping_and_tax import (
    QUOTE_CLASS_CONFIGURED_TABLE,
    QUOTE_CLASS_QA_SIMULATION,
    compute_shipping_quote_candidates,
)
from apps.inventory.models import SerialNumberTrack
from apps.inventory.services import get_default_warehouse
from apps.orders.logistics_preflight import (
    LEGAL_POLICY_COHERENCE_REPORT,
    OPERATIONAL_DISPATCH_FLOW,
    resolve_serial_warranty_evidence,
)
from apps.orders.models import Order, OrderItem, OrderStatus
from apps.products.models import Category, Product

User = get_user_model()


class Gate10PreflightTests(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="g10pf_u", email="g10pf@levelpro.cl", password="pw")
        self.cat = Category.objects.create(name="Monitores G10PF", slug="monitores-g10pf")
        self.product = Product.objects.create(
            name="Monitor Studio G10PF",
            slug="monitor-studio-g10pf",
            sku="MON-G10PF-01",
            category=self.cat,
            price=Decimal("250000.00"),
            stock=5,
        )

    def test_log10_pf_01_shipping_quotes_no_hardcoded_fx_and_classification(self):
        """LOG10-PF-01: Tarifas versionadas, sin FX hardcoded, y clasificación real/tabla/simulación QA."""
        client = APIClient()
        # USD sin explicit_fx_rate -> rechazado (sin constante FX hardcoded)
        resp_no_fx = client.post(
            "/api/v1/billing/shipping/estimate/",
            {"country": "CL", "city": "Santiago", "weight_kg": 2.0, "currency": "USD"},
            format="json",
        )
        self.assertEqual(resp_no_fx.status_code, 400)

        # CLP nativo -> OK con metadata completa
        resp_clp = client.post(
            "/api/v1/billing/shipping/estimate/",
            {"country": "CL", "city": "Santiago", "weight_kg": 2.0, "currency": "CLP"},
            format="json",
        )
        self.assertEqual(resp_clp.status_code, 200)
        self.assertEqual(resp_clp.data["quote_source"], QUOTE_CLASS_CONFIGURED_TABLE)
        first = resp_clp.data["rates"][0]
        self.assertIn("rate_table_id", first)
        self.assertIn("tariff_version", first)
        self.assertEqual(first["verification_status"], "estimated")

        # Simulación QA -> is_commercial_valid = False
        qa_rates = compute_shipping_quote_candidates(
            country="CL",
            destination="Valparaíso",
            currency="CLP",
            physical_weight_kg=Decimal("2.0"),
            length_cm=Decimal("40"),
            width_cm=Decimal("30"),
            height_cm=Decimal("30"),
            quote_mode=QUOTE_CLASS_QA_SIMULATION,
        )
        self.assertFalse(qa_rates[0]["is_commercial_valid"])
        self.assertEqual(qa_rates[0]["verification_status"], "simulated_qa_only")
        self.assertGreater(qa_rates[0]["volumetric_weight_kg"], qa_rates[0]["physical_weight_kg"])
        self.assertEqual(qa_rates[0]["billable_weight_kg"], qa_rates[0]["volumetric_weight_kg"])

    def test_log10_pf_02_04_05_dispatch_flow_serial_warranty_and_legal_coherence(self):
        """LOG10-PF-02, 04, 05: Flujo de despacho, trazabilidad serial->garantía y coherencia legal."""
        self.assertEqual(OPERATIONAL_DISPATCH_FLOW[0], "reserved")
        self.assertEqual(OPERATIONAL_DISPATCH_FLOW[-1], "delivered")
        self.assertFalse(LEGAL_POLICY_COHERENCE_REPORT["legal_texts_modified"])

        # Serial sin venta -> pending_verification
        res_unlinked = resolve_serial_warranty_evidence(serial_number="SN-NO-EXISTE")
        self.assertEqual(res_unlinked["status"], "pending_verification")

        # Serial vendido con cobertura verificable
        wh = get_default_warehouse()
        order = Order.objects.create(
            user=self.user,
            email=self.user.email,
            status=OrderStatus.PAID,
            total=Decimal("250000.00"),
            currency="CLP",
            shipping_address="Av. Demo 456",
        )
        item = OrderItem.objects.create(
            order=order,
            product=self.product,
            product_name=self.product.name,
            quantity=1,
            price=Decimal("250000.00"),
        )
        SerialNumberTrack.objects.create(
            product=self.product,
            warehouse=wh,
            serial_number="SN-G10PF-0001",
            status=SerialNumberTrack.Status.DISPATCHED,
            order=order,
            customer=self.user,
        )

        # Venta verificada sin plazos documentados -> pending_verification
        res_no_policy = resolve_serial_warranty_evidence(serial_number="SN-G10PF-0001")
        self.assertTrue(res_no_policy["verified_sale"])
        self.assertEqual(res_no_policy["status"], "pending_verification")

        # Venta verificada con garantía legal + fabricante
        res_cov = resolve_serial_warranty_evidence(
            serial_number="SN-G10PF-0001",
            legal_warranty_days=180,
            manufacturer_warranty_days=365,
        )
        self.assertEqual(res_cov["status"], "covered")
        self.assertEqual(len(res_cov["coverages"]), 2)
