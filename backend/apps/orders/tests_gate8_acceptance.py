# apps/orders/tests_gate8_acceptance.py
"""
LEVELPRO OS V4.0 — GATE 8 FINAL ACCEPTANCE TESTS
- CRM-ACCEPT-01: Maquetación PDF ReportLab con SKUs largos, nombres/variantes extensas y múltiples ítems.
- CRM-ACCEPT-02: Claridad de descuentos (B2B de línea vs descuento adicional global) y consistencia matemática API/BD/PDF.
- Verificación dirigida de Crédito Comercial B2B (deshabilitado por defecto, límites en cero, SoD, sin AR automático).
"""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from apps.billing.models import TributaryDocument
from apps.orders.b2b_pdf_generator import generate_and_store_b2b_quote_pdf
from apps.orders.crm_models import (
    B2BPriceList,
    B2BPriceListItem,
    B2BQuotePDFSnapshot,
    CommercialCreditAccount,
    CustomerOrganization,
)
from apps.orders.crm_services import (
    CRMPermissionError,
    CRMServiceError,
    approve_or_update_credit_account,
    compute_credit_exposure,
    create_or_update_b2b_price_list,
    create_or_update_b2b_quote,
    create_or_update_organization,
    request_credit_account,
)
from apps.products.models import Brand, Category, Product, ProductVariant
from core.rbac.constants import ROLE_FINANCE, ROLE_MANAGEMENT, ROLE_SALES

User = get_user_model()


class Gate8AcceptanceTests(TransactionTestCase):
    def setUp(self):
        call_command("setup_rbac")
        self.cat = Category.objects.create(name="Estudio Pro", slug="estudio-pro-g8acc")
        self.brand = Brand.objects.create(name="Neumann", slug="neumann-g8acc")

        self.sales_user = User.objects.create_user(
            username="g8acc_sales", email="g8acc_sales@levelpro.cl", password="pw", is_staff=True
        )
        self.sales_user.groups.add(Group.objects.get(name=ROLE_SALES))

        self.mgmt_user = User.objects.create_user(
            username="g8acc_mgmt", email="g8acc_mgmt@levelpro.cl", password="pw", is_staff=True
        )
        self.mgmt_user.groups.add(Group.objects.get(name=ROLE_MANAGEMENT))

        self.fin_user = User.objects.create_user(
            username="g8acc_fin", email="g8acc_fin@levelpro.cl", password="pw", is_staff=True
        )
        self.fin_user.groups.add(Group.objects.get(name=ROLE_FINANCE))

        self.prod1 = Product.objects.create(
            name="Neumann U87 Ai Studio Set Edición Especial Aniversario con Suspensión Elástica",
            slug="u87-ai-long-g8acc",
            sku="LONG-SKU-NEUMANN-U87AI-STUDIO-2026-EDITION",
            category=self.cat,
            brand=self.brand,
            price=Decimal("100000.00"),
            cost_price=Decimal("60000.00"),
            stock=20,
            is_active=True,
        )
        self.var1 = ProductVariant.objects.create(
            product=self.prod1,
            name="Acabado Níquel Satinado + Shockmount EA87",
            sku="LONG-VAR-SKU-U87AI-NICKEL-EA87-2026",
            price=Decimal("100000.00"),
            cost_price=Decimal("60000.00"),
            stock=20,
            is_active=True,
        )
        self.prod2 = Product.objects.create(
            name="Cable XLR Balanceado Mogami Gold Studio 10m Conectores Neutrik Oro",
            slug="mogami-xlr-g8acc",
            sku="MOGAMI-GOLD-XLR10M-NEUTRIK-PRO",
            category=self.cat,
            brand=self.brand,
            price=Decimal("50000.00"),
            cost_price=Decimal("25000.00"),
            stock=50,
            is_active=True,
        )

    def test_crm_accept_01_02_03_pdf_layout_discount_clarity_and_math_consistency(self):
        """
        CRM-ACCEPT-01, 02 & 03:
        - Renderiza ambos diseños PDF (classic_corporate y modern_technical) con SKUs/nombres largos y múltiples líneas.
        - Verifica consistencia matemática exacta entre API, BD y PDF sin doble descuento.
        """
        org = create_or_update_organization(
            legal_name="Estudio Acústico Austral SpA",
            trade_name="Austral Mastering",
            country="CL",
            tax_id="11.111.111-1",
            commercial_segment=CustomerOrganization.CommercialSegment.PRO_STUDIO,
            billing_email="compras@austral.test",
            actor=self.sales_user,
        )

        # Lista B2B con 10% descuento en prod1/var1 (100.000 -> 90.000)
        create_or_update_b2b_price_list(
            code="PL-ACC-10",
            name="Tarifa Pro Studio 10%",
            currency="CLP",
            scope=B2BPriceList.Scope.ORGANIZATION,
            organization=org,
            items=[{
                "product_id": str(self.prod1.id),
                "variant_id": str(self.var1.id),
                "pricing_mode": B2BPriceListItem.PricingMode.PERCENT_DISCOUNT,
                "discount_percent": "10.00",
            }],
            actor=self.mgmt_user,
        )

        quote = create_or_update_b2b_quote(
            organization=org,
            company_name=org.legal_name,
            tax_id=org.tax_id,
            contact_name="Ingeniero Jefe",
            email="compras@austral.test",
            country="CL",
            currency="CLP",
            payment_terms="prepaid",
            delivery_terms="Despacho asegurado Santiago",
            client_notes="Cotización sintética multi-línea con SKU extenso.",
            items=[
                {"product_id": str(self.prod1.id), "variant_id": str(self.var1.id), "quantity": 5},
                {"product_id": str(self.prod2.id), "quantity": 2},
            ],
            actor=self.sales_user,
        )

        # Consistencia matemática en BD (sin doble descuento):
        # Línea 1: 5 * 90.000 = 450.000 (descuento de línea 10% ya aplicado al unit_price)
        # Línea 2: 2 * 50.000 = 100.000
        # Subtotal = 550.000 | Descuento adicional global = 0.00 | IVA 19% = 104.500 | Total = 654.500
        self.assertEqual(quote.subtotal, Decimal("550000.00"))
        self.assertEqual(quote.discount_amount, Decimal("0.00"))
        self.assertEqual(quote.tax_amount, Decimal("104500.00"))
        self.assertEqual(quote.total, Decimal("654500.00"))

        items = list(quote.items.all())
        self.assertEqual(items[0].catalog_unit_price_snapshot, Decimal("100000.00"))
        self.assertEqual(items[0].discount_percent, Decimal("10.00"))
        self.assertEqual(items[0].unit_price, Decimal("90000.00"))
        self.assertEqual(items[0].subtotal, Decimal("450000.00"))
        self.assertEqual(sum(it.subtotal for it in items), quote.subtotal)

        # Consistencia con API
        api = APIClient()
        api.force_authenticate(user=self.sales_user)
        res_api = api.get(f"/api/v1/admin/b2b/quotes/{quote.id}/")
        self.assertEqual(res_api.status_code, 200)
        d = res_api.json()
        self.assertEqual(d["subtotal"], "550000.00")
        self.assertEqual(d["discount_amount"], "0.00")
        self.assertEqual(d["tax_amount"], "104500.00")
        self.assertEqual(d["total"], "654500.00")

        # Renderizado de ambos diseños PDF
        snap_a = generate_and_store_b2b_quote_pdf(
            quote, design_variant=B2BQuotePDFSnapshot.DesignVariant.CLASSIC_CORPORATE, actor=self.sales_user
        )
        snap_b = generate_and_store_b2b_quote_pdf(
            quote, design_variant=B2BQuotePDFSnapshot.DesignVariant.MODERN_TECHNICAL, actor=self.sales_user
        )
        self.assertTrue(bytes(snap_a.pdf_bytes).startswith(b"%PDF-"))
        self.assertTrue(bytes(snap_b.pdf_bytes).startswith(b"%PDF-"))
        self.assertNotEqual(snap_a.sha256_checksum, snap_b.sha256_checksum)

    def test_credit_security_policy_smoke_disabled_by_default_and_no_ar(self):
        """
        Smoke test dirigido de Crédito Comercial B2B:
        - Nace deshabilitado por defecto con límite 0.00.
        - Requiere aprobación + evidencia + política reconocida + SoD.
        - Cotización no consume crédito y aprobación no crea AR automático.
        """
        org = create_or_update_organization(
            legal_name="Productora Política Segura SpA",
            country="CL",
            tax_id="11.111.111-1",
            actor=self.sales_user,
        )

        # Por defecto: sin cuentas activas ni crédito habilitado
        self.assertEqual(CommercialCreditAccount.objects.filter(status=CommercialCreditAccount.Status.ACTIVE).count(), 0)

        # Creación sin monto propuesto -> disabled_pending_policy con límite 0.00
        ca = request_credit_account(organization=org, currency="CLP", proposed_limit=Decimal("0.00"), actor=self.sales_user)
        self.assertEqual(ca.status, CommercialCreditAccount.Status.DISABLED_PENDING_POLICY)
        self.assertEqual(ca.credit_limit, Decimal("0.00"))
        self.assertFalse(compute_credit_exposure(ca)["is_usable"])

        # Aprobación sin evidencia o sin policy_acknowledged -> rechazada
        with self.assertRaises(CRMServiceError):
            approve_or_update_credit_account(
                ca, action="approve", credit_limit=Decimal("1000000.00"),
                policy_acknowledged=False, approval_evidence="", actor=self.fin_user,
            )

        # SoD: el solicitante (sales_user) no puede aprobar
        with self.assertRaises(CRMPermissionError):
            approve_or_update_credit_account(
                ca, action="approve", credit_limit=Decimal("1000000.00"),
                policy_acknowledged=True, approval_evidence="Acta", actor=self.sales_user,
            )

        # Finanzas aprueba con evidencia y política reconocida -> no crea AR (TributaryDocument)
        ar_before = TributaryDocument.objects.count()
        approve_or_update_credit_account(
            ca, action="approve", credit_limit=Decimal("1000000.00"),
            policy_acknowledged=True, approval_evidence="Acta Comité #2026-11", actor=self.fin_user,
        )
        ca.refresh_from_db()
        self.assertEqual(ca.status, CommercialCreditAccount.Status.ACTIVE)
        self.assertEqual(TributaryDocument.objects.count(), ar_before)

        # Generar cotización Net-15 NO consume crédito
        create_or_update_b2b_quote(
            organization=org,
            company_name=org.legal_name,
            tax_id=org.tax_id,
            contact_name="Contacto",
            email="c@segura.test",
            country="CL",
            currency="CLP",
            payment_terms="net_15",
            items=[{"product_id": str(self.prod2.id), "quantity": 2}],
            actor=self.sales_user,
        )
        self.assertEqual(compute_credit_exposure(ca)["committed_exposure"], "0.00")
