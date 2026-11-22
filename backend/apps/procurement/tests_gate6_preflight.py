"""
LEVELPRO OS V4.0 — GATE 6 PREFLIGHT TEST SUITE (FIN-PF-01, FIN-PF-02, FIN-PF-03)
Ejecutado sobre PostgreSQL 16 real.
"""

import io
import zipfile
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from apps.analytics.models import AuditEvent
from apps.inventory.services import get_default_warehouse
from apps.procurement.models import (
    CustomsDocument,
    ProductSupplier,
    PurchaseOrder,
    PurchaseOrderItem,
    Supplier,
)
from apps.procurement.po_services import (
    ProcurementServiceError,
    approve_purchase_order,
    create_purchase_order,
    detect_ambiguous_purchase_orders,
    issue_purchase_order,
    update_purchase_order,
)
from apps.products.models import Brand, Category, Product
from core.rbac.constants import ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_WAREHOUSE

User = get_user_model()


def _build_valid_ooxml_bytes(kind="xlsx", extra_entries=None, workbook_xml_override=None) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
        )
        if kind == "xlsx":
            zf.writestr(
                "xl/workbook.xml",
                workbook_xml_override
                or '<?xml version="1.0" encoding="UTF-8"?><workbook></workbook>',
            )
        else:
            zf.writestr(
                "word/document.xml",
                workbook_xml_override
                or '<?xml version="1.0" encoding="UTF-8"?><document></document>',
            )
        for name, content in (extra_entries or {}).items():
            zf.writestr(name, content)
    return buf.getvalue()


class Gate6PreflightSuiteTest(TransactionTestCase):
    """Certificación de FIN-PF-01, FIN-PF-02 y FIN-PF-03."""

    def setUp(self):
        call_command("setup_rbac")
        self.wh_user = User.objects.create_user(
            username="pf6_wh",
            email="pf6_wh@levelpro.cl",
            password="TestPassword123!",
            is_staff=True,
        )
        self.wh_user.groups.add(Group.objects.get(name=ROLE_WAREHOUSE))

        self.purch_user = User.objects.create_user(
            username="pf6_purch",
            email="pf6_purch@levelpro.cl",
            password="TestPassword123!",
            is_staff=True,
        )
        self.purch_user.groups.add(Group.objects.get(name=ROLE_PURCHASING))

        self.mgmt_user = User.objects.create_user(
            username="pf6_mgmt",
            email="pf6_mgmt@levelpro.cl",
            password="TestPassword123!",
            is_staff=True,
        )
        self.mgmt_user.groups.add(Group.objects.get(name=ROLE_MANAGEMENT))

        self.wh = get_default_warehouse()
        self.cat = Category.objects.create(name="PF6 Audio", slug="pf6-audio")
        self.brand = Brand.objects.create(name="PF6Brand", slug="pf6-brand")

        self.sup_usd = Supplier.objects.create(
            internal_code="SUP-PF6-USD",
            legal_name="Global Pro Audio LLC",
            country="USA",
            currency="USD",
            is_active=True,
        )
        self.prod_a = Product.objects.create(
            name="Monitor Studio A",
            slug="monitor-studio-a-pf6",
            sku="PF6-MON-A",
            category=self.cat,
            brand=self.brand,
            price=Decimal("500000"),
            stock=0,
        )
        self.prod_b = Product.objects.create(
            name="Preamp Studio B",
            slug="preamp-studio-b-pf6",
            sku="PF6-PRE-B",
            category=self.cat,
            brand=self.brand,
            price=Decimal("700000"),
            stock=0,
        )
        self.ps_a_usd = ProductSupplier.objects.create(
            supplier=self.sup_usd,
            product=self.prod_a,
            supplier_sku="GPA-MON-A",
            unit_cost=Decimal("300.00"),
            currency="USD",
            tax_basis="net",
            is_preferred=True,
        )

    def test_fin_pf01_rejects_direct_mixed_currencies_and_enforces_explicit_fx(self):
        # 1. Rechazo de suma directa CLP + USD en una misma PO sin conversión explícita
        with self.assertRaises(ProcurementServiceError):
            create_purchase_order(
                supplier=self.sup_usd,
                destination_warehouse=self.wh,
                currency="CLP",
                items=[
                    {"product_id": self.prod_b.id, "quantity_ordered": 2, "unit_cost": Decimal("100000"), "currency": "CLP"},
                    {"product_id": self.prod_a.id, "quantity_ordered": 1, "unit_cost": Decimal("300"), "currency": "USD"},
                ],
                actor=self.purch_user,
            )

        # 2. Rechazo de suma directa USD + ARS sin conversión explícita
        with self.assertRaises(ProcurementServiceError):
            create_purchase_order(
                supplier=self.sup_usd,
                destination_warehouse=self.wh,
                currency="USD",
                items=[
                    {"product_id": self.prod_a.id, "quantity_ordered": 1, "unit_cost": Decimal("300"), "currency": "USD"},
                    {"product_id": self.prod_b.id, "quantity_ordered": 1, "unit_cost": Decimal("250000"), "currency": "ARS"},
                ],
                actor=self.purch_user,
            )

        # 3. Rechazo de conversión implícita desde ProductSupplier (ps_a_usd está en USD, PO en CLP)
        with self.assertRaises(ProcurementServiceError):
            create_purchase_order(
                supplier=self.sup_usd,
                destination_warehouse=self.wh,
                currency="CLP",
                items=[
                    {"product_id": self.prod_a.id, "quantity_ordered": 2},
                ],
                actor=self.purch_user,
            )

        # 4. Aceptación únicamente con conversión explícita y documentada compatible con la PO
        po_converted = create_purchase_order(
            supplier=self.sup_usd,
            destination_warehouse=self.wh,
            currency="CLP",
            items=[
                {
                    "product_id": self.prod_a.id,
                    "quantity_ordered": 2,
                    "fx_rate": Decimal("940.50"),
                    "fx_source": "Contrato Forward Banco Central #BC-991",
                },
                {
                    "product_id": self.prod_b.id,
                    "quantity_ordered": 1,
                    "unit_cost": Decimal("150000.00"),
                    "currency": "CLP",
                },
            ],
            actor=self.purch_user,
        )
        # 2 * (300 * 940.50 = 282150) + 150000 = 564300 + 150000 = 714300.00 CLP
        self.assertEqual(po_converted.currency, "CLP")
        self.assertEqual(po_converted.total_amount, Decimal("714300.00"))
        item_a = po_converted.items.get(product=self.prod_a)
        self.assertEqual(item_a.currency, "CLP")
        self.assertEqual(item_a.original_currency_snapshot, "USD")
        self.assertEqual(item_a.original_unit_cost_snapshot, Decimal("300.0000"))
        self.assertEqual(item_a.fx_rate_snapshot, Decimal("940.500000"))
        self.assertEqual(item_a.fx_rate_source, "Contrato Forward Banco Central #BC-991")
        self.assertEqual(item_a.unit_cost_snapshot, Decimal("282150.0000"))

        # 5. No recalcular órdenes históricas emitidas y reportar ambigüedades existentes
        po_hist = create_purchase_order(
            supplier=self.sup_usd,
            destination_warehouse=self.wh,
            currency="USD",
            items=[{"product_id": self.prod_a.id, "quantity_ordered": 1}],
            actor=self.purch_user,
        )
        po_hist = approve_purchase_order(po_hist, actor=self.mgmt_user)
        po_hist = issue_purchase_order(po_hist, actor=self.purch_user)

        # Simular registro histórico ambiguo en BD (ej. pre-Gate 6 con moneda de línea distinta)
        PurchaseOrderItem.objects.filter(purchase_order=po_hist).update(currency="CLP")
        ambiguous = detect_ambiguous_purchase_orders()
        amb_ids = [a["po_id"] for a in ambiguous]
        self.assertIn(str(po_hist.id), amb_ids)
        # Verificar que detect_ambiguous_purchase_orders NO alteró total_amount de la orden histórica
        po_hist.refresh_from_db()
        self.assertEqual(po_hist.total_amount, Decimal("300.00"))

    def test_fin_pf02_customs_file_validation_all_formats_and_negative_controls(self):
        po = create_purchase_order(
            supplier=self.sup_usd,
            destination_warehouse=self.wh,
            items=[{"product_id": self.prod_a.id, "quantity_ordered": 1}],
            actor=self.purch_user,
        )
        client = APIClient()
        client.force_authenticate(user=self.purch_user)
        url = f"/api/v1/admin/purchase-orders/{po.id}/documents/"

        # 1. Formatos válidos: PDF, PNG, JPEG, XML, CSV, XLSX, DOCX
        valid_files = [
            ("invoice.pdf", b"%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF\n", "application/pdf"),
            ("photo.png", b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x00IEND\xaeB`\x82", "image/png"),
            ("scan.jpg", b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\xff\xd9", "image/jpeg"),
            ("dus.xml", b'<?xml version="1.0" encoding="UTF-8"?><dus><id>123</id></dus>', "application/xml"),
            ("packing.csv", b"sku,qty,weight\nPF6-MON-A,2,14.5\n", "text/csv"),
            ("manifest.xlsx", _build_valid_ooxml_bytes("xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            ("cert.docx", _build_valid_ooxml_bytes("docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        ]
        for idx, (fname, fbytes, ctype) in enumerate(valid_files):
            f = SimpleUploadedFile(fname, fbytes, content_type=ctype)
            res = client.post(
                url,
                {"document_type": "packing_list", "document_identifier": f"DOC-OK-{idx}", "file": f},
                format="multipart",
            )
            self.assertEqual(res.status_code, 201, f"Fallo inesperado en archivo válido {fname}: {res.data}")

        # 2. Pruebas negativas obligatorias
        negative_cases = [
            # PDF con JavaScript embebido
            ("evil_js.pdf", b"%PDF-1.4\n/OpenAction << /S /JavaScript /JS (app.alert(1)) >>\n%%EOF", "application/pdf"),
            # PDF con tipo MIME anunciado engañoso
            ("spoof.pdf", b"%PDF-1.4\n%%EOF", "text/html"),
            # PNG falso (texto renombrado a .png)
            ("fake.png", b"not a real png image", "image/png"),
            # JPEG sin marcador EOI / firma inválida
            ("fake.jpg", b"not a real jpeg", "image/jpeg"),
            # XML con ataque XXE / DOCTYPE / ENTITY
            ("xxe.xml", b'<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>', "application/xml"),
            # CSV con formula injection (=CMD, @SUM, +cmd, -cmd)
            ("inject1.csv", b"sku,note\nPF6-MON-A,=cmd|' /C calc'!A0\n", "text/csv"),
            ("inject2.csv", b"sku,note\nPF6-MON-A,@SUM(1+1)*cmd\n", "text/csv"),
            ("inject3.csv", b"sku,note\nPF6-MON-A,+cmd|' /C calc'!A0\n", "text/csv"),
            # XLSX con macro VBA embebida
            ("macro.xlsx", _build_valid_ooxml_bytes("xlsx", extra_entries={"xl/vbaProject.bin": b"VBA_MACRO"}), "application/octet-stream"),
            # XLSX con XXE en workbook.xml
            ("xxe.xlsx", _build_valid_ooxml_bytes("xlsx", workbook_xml_override='<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "http://evil">]><workbook/>'), "application/octet-stream"),
            # Doble extensión peligrosa
            ("invoice.exe.pdf", b"%PDF-1.4\n%%EOF", "application/pdf"),
        ]
        for idx, (fname, fbytes, ctype) in enumerate(negative_cases):
            f = SimpleUploadedFile(fname, fbytes, content_type=ctype)
            res = client.post(
                url,
                {"document_type": "packing_list", "document_identifier": f"DOC-BAD-{idx}", "file": f},
                format="multipart",
            )
            self.assertEqual(res.status_code, 400, f"Debió rechazarse archivo peligroso {fname}")

    def test_fin_pf03_confidentiality_rbac_and_download_audit(self):
        po1 = create_purchase_order(
            supplier=self.sup_usd,
            destination_warehouse=self.wh,
            items=[{"product_id": self.prod_a.id, "quantity_ordered": 1}],
            actor=self.purch_user,
        )
        po2 = create_purchase_order(
            supplier=self.sup_usd,
            destination_warehouse=self.wh,
            items=[{"product_id": self.prod_a.id, "quantity_ordered": 1}],
            actor=self.purch_user,
        )

        client_purch = APIClient()
        client_purch.force_authenticate(user=self.purch_user)

        # Subir factura comercial (sensibilidad financiera) y packing list (operativo)
        f_inv = SimpleUploadedFile("commercial_inv.pdf", b"%PDF-1.4\n%INV\n%%EOF", content_type="application/pdf")
        r_inv = client_purch.post(
            f"/api/v1/admin/purchase-orders/{po1.id}/documents/",
            {"document_type": "commercial_invoice", "document_identifier": "INV-CONF-01", "file": f_inv, "notes": "Costo CIF 300 USD"},
            format="multipart",
        )
        self.assertEqual(r_inv.status_code, 201)
        inv_id = r_inv.data["id"]
        self.assertEqual(r_inv.data["sensitivity_level"], "financial")
        self.assertTrue(r_inv.data["is_financial_sensitive"])

        f_pl = SimpleUploadedFile("packing_list.pdf", b"%PDF-1.4\n%PL\n%%EOF", content_type="application/pdf")
        r_pl = client_purch.post(
            f"/api/v1/admin/purchase-orders/{po1.id}/documents/",
            {"document_type": "packing_list", "document_identifier": "PL-OP-01", "file": f_pl},
            format="multipart",
        )
        self.assertEqual(r_pl.status_code, 201)
        pl_id = r_pl.data["id"]
        self.assertEqual(r_pl.data["sensitivity_level"], "operational")

        # Rol WAREHOUSE (sin view_costs):
        client_wh = APIClient()
        client_wh.force_authenticate(user=self.wh_user)

        # 1. Denegada la descarga de factura comercial (403) + evento de auditoría denied
        dl_inv_wh = client_wh.get(f"/api/v1/admin/purchase-orders/{po1.id}/documents/{inv_id}/download/")
        self.assertEqual(dl_inv_wh.status_code, 403)
        self.assertTrue(
            AuditEvent.objects.filter(
                action="CUSTOMS_DOCUMENT_DOWNLOAD_DENIED",
                resource_id=str(inv_id),
                result="denied",
            ).exists()
        )

        # 2. Permitida la descarga de packing list operativo (200) + headers seguros + auditoría success
        dl_pl_wh = client_wh.get(f"/api/v1/admin/purchase-orders/{po1.id}/documents/{pl_id}/download/")
        self.assertEqual(dl_pl_wh.status_code, 200)
        self.assertEqual(dl_pl_wh["X-Content-Type-Options"], "nosniff")
        self.assertIn("attachment;", dl_pl_wh["Content-Disposition"])
        self.assertTrue(
            AuditEvent.objects.filter(
                action="CUSTOMS_DOCUMENT_DOWNLOADED",
                resource_id=str(pl_id),
                result="success",
            ).exists()
        )

        # 3. Manipulación manual de URL cambiando po_id (po2 con doc de po1) -> 404
        dl_tamper = client_purch.get(f"/api/v1/admin/purchase-orders/{po2.id}/documents/{inv_id}/download/")
        self.assertEqual(dl_tamper.status_code, 404)

        # 4. Rol PURCHASING (con view_costs) sí puede descargar factura comercial
        dl_inv_purch = client_purch.get(f"/api/v1/admin/purchase-orders/{po1.id}/documents/{inv_id}/download/")
        self.assertEqual(dl_inv_purch.status_code, 200)
