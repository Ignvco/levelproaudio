# apps/orders/tests_gate8_crm_b2b.py
"""
LEVELPRO OS V4.0 — GATE 8 INTEGRAL QA SUITE (PostgreSQL 16)
Cubre:
- BF-21: CRM Técnico, Organizaciones, Contactos Multi-Org, RUT/CUIT, Ficha 360°, Privacidad RBAC.
- BF-19: Listas B2B, Precedencia Determinista, Escalones por Volumen (bordes 4/5 y 9/10), Margen Gate 6.
- BF-20: Cotizador B2B, Ciclo de Vida, PDF ReportLab (2 diseños + SHA-256), Enlace Seguro, Conversión OMS/WMS.
- BF-40: Crédito Comercial (deshabilitado por defecto, SoD, Exposición, Pago Parcial, Exceso de Límite).
"""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.inventory.models import StockReservation, Warehouse, WarehouseStock
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
    add_organization_contact,
    approve_or_update_credit_account,
    compute_credit_exposure,
    convert_b2b_quote_with_credit_check,
    create_or_update_b2b_price_list,
    create_or_update_b2b_quote,
    create_or_update_customer_profile,
    create_or_update_organization,
    record_customer_interaction,
    request_credit_account,
    resolve_b2b_unit_price,
    transition_b2b_quote_status,
    upsert_technical_profile,
)
from apps.orders.models import B2BQuoteStatus, Order
from apps.orders.oms_services import record_order_payment_attempt, transition_order_dimensions
from apps.products.models import Brand, Category, Product, ProductVariant
from core.contracts.states import CommercialStatus
from core.rbac.constants import (
    ROLE_FINANCE,
    ROLE_MANAGEMENT,
    ROLE_SALES,
    ROLE_SUPPORT,
)

User = get_user_model()


class Gate8CRMB2BSuiteTests(TransactionTestCase):
    def setUp(self):
        call_command("setup_rbac")
        self.cat = Category.objects.create(name="Monitores", slug="monitores-g8")
        self.brand = Brand.objects.create(name="Genelec", slug="genelec-g8")

        Warehouse.objects.filter(is_default=True).update(is_default=False)
        self.wh = Warehouse.objects.create(
            code="WH-G8", name="Bodega Central G8", is_default=True, is_active=True
        )

        self.sales_user = User.objects.create_user(
            username="g8_sales", email="g8_sales@levelpro.cl", password="pw", is_staff=True
        )
        self.sales_user.groups.add(Group.objects.get(name=ROLE_SALES))

        self.mgmt_user = User.objects.create_user(
            username="g8_mgmt", email="g8_mgmt@levelpro.cl", password="pw", is_staff=True
        )
        self.mgmt_user.groups.add(Group.objects.get(name=ROLE_MANAGEMENT))

        self.fin_user = User.objects.create_user(
            username="g8_fin", email="g8_fin@levelpro.cl", password="pw", is_staff=True
        )
        self.fin_user.groups.add(Group.objects.get(name=ROLE_FINANCE))

        self.sup_user = User.objects.create_user(
            username="g8_sup", email="g8_sup@levelpro.cl", password="pw", is_staff=True
        )
        self.sup_user.groups.add(Group.objects.get(name=ROLE_SUPPORT))

        self.client_user = User.objects.create_user(
            username="g8_client", email="ingeniero@estudiopro.cl", password="pw", is_staff=False
        )

        self.prod = Product.objects.create(
            name="8030C Studio Monitor",
            slug="8030c-g8",
            sku="GEN-8030C-G8",
            category=self.cat,
            brand=self.brand,
            price=Decimal("100000.00"),
            cost_price=Decimal("60000.00"),
            stock=15,
            product_type=Product.ProductType.STOCK,
            is_active=True,
        )
        self.variant = ProductVariant.objects.create(
            product=self.prod,
            name="Dark Grey",
            sku="GEN-8030C-DG",
            price=Decimal("100000.00"),
            cost_price=Decimal("60000.00"),
            stock=15,
            is_active=True,
        )
        self.ws = WarehouseStock.objects.create(
            warehouse=self.wh,
            product=self.prod,
            variant=self.variant,
            physical_quantity=15,
            reserved_quantity=0,
            non_sellable_quantity=0,
        )

    def test_01_bf21_crm_organizations_multi_org_rut_cuit_technical_and_360(self):
        """BF-21: Organizaciones, contactos multi-org, validación RUT/CUIT, perfil técnico y Ficha 360° con RBAC."""
        # RUT chileno inválido -> rechazado
        with self.assertRaises(CRMServiceError):
            create_or_update_organization(
                legal_name="Estudio Inválido SpA",
                country="CL",
                tax_id="76.123.456-9",
                actor=self.sales_user,
            )

        # RUT chileno válido (76.123.456-7? Verifiquemos: 11111111-1 es válido!)
        org_cl = create_or_update_organization(
            legal_name="Estudio Mastering Sur SpA",
            trade_name="Mastering Sur",
            customer_type=CustomerOrganization.CustomerType.STUDIO,
            country="CL",
            tax_id="11.111.111-1",
            commercial_segment=CustomerOrganization.CommercialSegment.PRO_STUDIO,
            billing_email="pagos@masteringsur.cl",
            internal_notes="Nota confidencial de ventas CL",
            actor=self.sales_user,
        )
        self.assertTrue(org_cl.tax_id_validated)

        # CUIT argentino válido (20-11111111-3: 2*5+0*4+1*3+1*2+1*7+1*6+1*5+1*4+1*3+1*2 = 10+0+3+2+7+6+5+4+3+2=42; 42%11=9; 11-9=2 -> 20-11111111-2)
        org_ar = create_or_update_organization(
            legal_name="Productora Buenos Aires SRL",
            country="AR",
            tax_id="20-11111111-2",
            commercial_segment=CustomerOrganization.CommercialSegment.WHOLESALE,
            actor=self.sales_user,
        )
        self.assertTrue(org_ar.tax_id_validated)

        # Mismo usuario asociado a 2 organizaciones sin duplicar User
        c1 = add_organization_contact(
            org_cl, full_name="Carlos Díaz", email="ingeniero@estudiopro.cl",
            user=self.client_user, is_primary=True, can_use_credit=True, actor=self.sales_user,
        )
        c2 = add_organization_contact(
            org_ar, full_name="Carlos Díaz", email="ingeniero@estudiopro.cl",
            user=self.client_user, is_primary=False, can_approve_orders=True, actor=self.sales_user,
        )
        self.assertNotEqual(c1.id, c2.id)

        prof = create_or_update_customer_profile(
            user=self.client_user,
            primary_organization=org_cl,
            full_name="Carlos Díaz",
            email="ingeniero@estudiopro.cl",
            country="CL",
            tax_id="11.111.111-1",
            internal_notes="Nota interna privada",
            actor=self.sales_user,
        )
        upsert_technical_profile(
            organization=org_cl,
            data={
                "primary_activity": "Mastering & Dolby Atmos",
                "facility_type": "Estudio Comercial",
                "primary_daw": "Pro Tools Ultimate",
                "monitors": ["Genelec 8351B"],
                "brands_of_interest": ["Genelec", "Neumann"],
            },
            actor=self.sales_user,
        )
        record_customer_interaction(
            organization=org_cl,
            interaction_type="opportunity",
            subject="Renovación monitoreo sala B",
            summary="Cotizar par de 8030C",
            outcome="Pendiente de propuesta",
            actor=self.sales_user,
        )

        # Ficha 360° vía API como Ventas (ve notas internas y perfil técnico)
        api_sales = APIClient()
        api_sales.force_authenticate(user=self.sales_user)
        res_360 = api_sales.get(f"/api/v1/admin/crm/customers/{prof.id}/360/")
        self.assertEqual(res_360.status_code, 200)
        d360 = res_360.json()
        self.assertEqual(d360["identity"]["internal_notes"], "Nota interna privada")
        self.assertEqual(d360["technical_profile"]["primary_daw"], "Pro Tools Ultimate")
        self.assertEqual(len(d360["linked_organizations"]), 2)
        self.assertEqual(len(d360["interactions"]), 1)
        self.assertEqual(d360["history_360"]["academy_enrollments"], [])

        # Ficha 360° vía API como Soporte (NO ve notas internas ni perfil técnico confidencial)
        api_sup = APIClient()
        api_sup.force_authenticate(user=self.sup_user)
        res_sup = api_sup.get(f"/api/v1/admin/crm/customers/{prof.id}/360/")
        self.assertEqual(res_sup.status_code, 200)
        self.assertEqual(res_sup.json()["identity"]["internal_notes"], "")
        self.assertIsNone(res_sup.json()["technical_profile"])

    def test_02_bf19_b2b_pricing_precedence_and_volume_tiers(self):
        """BF-19: Precedencia (Contrato > Org > Segmento > Público), tramos 4/5 y 9/10, y margen Gate 6."""
        org = create_or_update_organization(
            legal_name="Productora Tramos SpA",
            country="CL",
            tax_id="11.111.111-1",
            commercial_segment=CustomerOrganization.CommercialSegment.PRO_STUDIO,
            actor=self.sales_user,
        )

        # Lista Segmento (10% dcto -> 90.000)
        create_or_update_b2b_price_list(
            code="PL-SEG-PRO",
            name="Segmento Pro Studio",
            currency="CLP",
            scope=B2BPriceList.Scope.SEGMENT,
            applicable_segment=CustomerOrganization.CommercialSegment.PRO_STUDIO,
            items=[{
                "product_id": str(self.prod.id),
                "variant_id": str(self.variant.id),
                "pricing_mode": B2BPriceListItem.PricingMode.PERCENT_DISCOUNT,
                "discount_percent": "10.00",
            }],
            actor=self.mgmt_user,
        )

        # Lista Organización con tramos 1-4 (95k), 5-9 (90k), 10+ (85k) -> gana sobre Segmento
        create_or_update_b2b_price_list(
            code="PL-ORG-TRAMOS",
            name="Tarifa Especial Productora",
            currency="CLP",
            scope=B2BPriceList.Scope.ORGANIZATION,
            organization=org,
            items=[{
                "product_id": str(self.prod.id),
                "variant_id": str(self.variant.id),
                "pricing_mode": B2BPriceListItem.PricingMode.FIXED_PRICE,
                "fixed_price": "95000.00",
                "tiers": [
                    {"min_quantity": 1, "max_quantity": 4, "tier_price": "95000.00"},
                    {"min_quantity": 5, "max_quantity": 9, "tier_price": "90000.00"},
                    {"min_quantity": 10, "max_quantity": None, "tier_price": "85000.00"},
                ],
            }],
            actor=self.mgmt_user,
        )

        # Verificar bordes exactos 4/5 y 9/10
        r4 = resolve_b2b_unit_price(product=self.prod, variant=self.variant, quantity=4, currency="CLP", organization=org, actor=self.mgmt_user)
        r5 = resolve_b2b_unit_price(product=self.prod, variant=self.variant, quantity=5, currency="CLP", organization=org, actor=self.mgmt_user)
        r9 = resolve_b2b_unit_price(product=self.prod, variant=self.variant, quantity=9, currency="CLP", organization=org, actor=self.mgmt_user)
        r10 = resolve_b2b_unit_price(product=self.prod, variant=self.variant, quantity=10, currency="CLP", organization=org, actor=self.mgmt_user)

        self.assertEqual(r4["b2b_proposed_price"], "95000.00")
        self.assertEqual(r5["b2b_proposed_price"], "90000.00")
        self.assertEqual(r9["b2b_proposed_price"], "90000.00")
        self.assertEqual(r10["b2b_proposed_price"], "85000.00")
        self.assertIn("PL-ORG-TRAMOS", r10["pricing_source"])
        self.assertIsNotNone(r10["gross_margin_percent"])

        # Ventas sin view_costs no ve unit_cost
        r_sales = resolve_b2b_unit_price(product=self.prod, variant=self.variant, quantity=10, currency="CLP", organization=org, actor=self.sales_user)
        self.assertIsNone(r_sales["unit_cost"])

    def test_03_bf20_and_bf40_quote_pdf_credit_sod_exposure_and_oms_wms_conversion(self):
        """BF-20 & BF-40: Cotización + PDF (2 diseños SHA-256) + Crédito (SoD, exposición, exceso) + Conversión OMS/WMS."""
        org = create_or_update_organization(
            legal_name="Canal TV Audio SpA",
            country="CL",
            tax_id="11.111.111-1",
            commercial_segment=CustomerOrganization.CommercialSegment.ENTERPRISE if hasattr(CustomerOrganization.CommercialSegment, "ENTERPRISE") else CustomerOrganization.CommercialSegment.WHOLESALE,
            actor=self.sales_user,
        )

        # 1. Crédito nace deshabilitado pendiente de política
        ca = request_credit_account(
            organization=org,
            currency="CLP",
            proposed_limit=Decimal("2000000.00"),
            payment_terms=CommercialCreditAccount.PaymentTerms.NET_30,
            actor=self.sales_user,
        )
        self.assertEqual(ca.status, CommercialCreditAccount.Status.PENDING_APPROVAL)
        self.assertEqual(ca.credit_limit, Decimal("0.00"))

        # Ventas no puede aprobar su propia solicitud ni aprobar crédito
        with self.assertRaises(CRMPermissionError):
            approve_or_update_credit_account(
                ca, action="approve", credit_limit=Decimal("2000000.00"),
                policy_acknowledged=True, approval_evidence="Acta #1", actor=self.sales_user,
            )

        # Finanzas aprueba con evidencia y política reconocida
        approve_or_update_credit_account(
            ca,
            action="approve",
            credit_limit=Decimal("1000000.00"),
            payment_terms=CommercialCreditAccount.PaymentTerms.NET_30,
            policy_acknowledged=True,
            approval_evidence="Comité Crédito 2026-11",
            actor=self.fin_user,
        )
        ca.refresh_from_db()

        # 2. Crear cotización B2B de 5 unidades (5 * 100.000 = 500.000 + 19% IVA = 595.000) bajo Net-30
        quote = create_or_update_b2b_quote(
            organization=org,
            company_name=org.legal_name,
            tax_id=org.tax_id,
            contact_name="Jefe Técnico",
            email="tecnico@canaltv.cl",
            country="CL",
            currency="CLP",
            payment_terms="net_30",
            items=[{"product_id": str(self.prod.id), "variant_id": str(self.variant.id), "quantity": 5}],
            actor=self.sales_user,
        )
        self.assertEqual(quote.total, Decimal("595000.00"))

        # Aprobar y emitir PDFs (Diseño A y Diseño B)
        transition_b2b_quote_status(quote, target_status=B2BQuoteStatus.APPROVED, actor=self.mgmt_user)
        api_sales = APIClient()
        api_sales.force_authenticate(user=self.sales_user)
        pdf_a = api_sales.get(f"/api/v1/admin/b2b/quotes/{quote.id}/pdf/?design=classic_corporate")
        pdf_b = api_sales.get(f"/api/v1/admin/b2b/quotes/{quote.id}/pdf/?design=modern_technical")
        self.assertEqual(pdf_a.status_code, 200)
        self.assertEqual(pdf_b.status_code, 200)
        self.assertTrue(pdf_a.content.startswith(b"%PDF-"))
        self.assertTrue(pdf_b.content.startswith(b"%PDF-"))
        self.assertNotEqual(pdf_a["X-PDF-SHA256"], pdf_b["X-PDF-SHA256"])
        self.assertEqual(B2BQuotePDFSnapshot.objects.filter(quote=quote).count(), 2)

        # Al generar cotización todavía NO se consume crédito
        self.assertEqual(compute_credit_exposure(ca)["committed_exposure"], "0.00")

        # 3. Convertir cotización a Order -> reserva WMS + compromete 595.000 de crédito
        order, is_replay = convert_b2b_quote_with_credit_check(
            quote, idempotency_key="g8-conv-001", actor=self.sales_user
        )
        self.assertFalse(is_replay)
        self.ws.refresh_from_db()
        self.assertEqual(self.ws.reserved_quantity, 5)
        self.assertEqual(StockReservation.objects.filter(order=order).count(), 1)
        self.assertEqual(compute_credit_exposure(ca)["committed_exposure"], "595000.00")
        self.assertEqual(compute_credit_exposure(ca)["available_credit"], "405000.00")

        # 4. Pago parcial de 200.000 reduce exposición a 395.000 (sin doble contabilización)
        record_order_payment_attempt(
            order,
            provider="transfer",
            amount=Decimal("200000.00"),
            external_id="g8-pay-part-1",
            approve_immediately=True,
            actor=self.fin_user,
        )
        self.assertEqual(compute_credit_exposure(ca)["committed_exposure"], "395000.00")
        self.assertEqual(compute_credit_exposure(ca)["available_credit"], "605000.00")

        # 5. Segunda cotización por 7 unidades (833.000 > 605.000 disponibles) -> bloqueada por exceso de crédito
        quote2 = create_or_update_b2b_quote(
            organization=org,
            company_name=org.legal_name,
            tax_id=org.tax_id,
            contact_name="Jefe Técnico",
            email="tecnico@canaltv.cl",
            country="CL",
            currency="CLP",
            payment_terms="net_30",
            items=[{"product_id": str(self.prod.id), "variant_id": str(self.variant.id), "quantity": 7}],
            actor=self.sales_user,
        )
        transition_b2b_quote_status(quote2, target_status=B2BQuoteStatus.APPROVED, actor=self.mgmt_user)
        with self.assertRaises(CRMServiceError):
            convert_b2b_quote_with_credit_check(quote2, idempotency_key="g8-conv-excess", actor=self.sales_user)

        # 6. Cancelar orden 1 libera su exposición comercial y reserva WMS
        transition_order_dimensions(order, commercial_status=CommercialStatus.CANCELLED.value, actor=self.mgmt_user)
        self.assertEqual(compute_credit_exposure(ca)["committed_exposure"], "0.00")
        self.assertEqual(compute_credit_exposure(ca)["available_credit"], "1000000.00")
