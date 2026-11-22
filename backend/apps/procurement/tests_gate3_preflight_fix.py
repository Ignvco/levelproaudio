# apps/procurement/tests_gate3_preflight_fix.py
import uuid
from decimal import Decimal
import pytest
from django.contrib.auth.models import Group
from django.core.exceptions import PermissionDenied
from django.core.management import call_command
from django.db import connection, transaction
from django.db.utils import DatabaseError
from rest_framework.test import APIClient

from apps.analytics.models import AuditEvent
from apps.procurement.models import Supplier, SupplierContact, ProductSupplier, SupplierPriceHistory
from apps.procurement.services import compare_suppliers_for_sku, select_preferred_supplier, upsert_product_supplier
from apps.products.models import Brand, Category, Product
from apps.users.models import User
from core.rbac.constants import ROLE_SUPER_ADMIN, ROLE_WAREHOUSE


@pytest.mark.django_db(transaction=True)
class TestGate3PreflightFixes:
    def _setup_users(self):
        call_command("setup_rbac")
        admin_email = f"sup_admin_{uuid.uuid4().hex[:6]}@test.local"
        admin = User.objects.create_user(
            username=admin_email,
            email=admin_email,
            password="PasswordSegura123!",
            is_staff=True,
            is_superuser=True,
        )
        admin.groups.add(Group.objects.get(name=ROLE_SUPER_ADMIN))

        wh_email = f"sup_wh_{uuid.uuid4().hex[:6]}@test.local"
        warehouse = User.objects.create_user(
            username=wh_email,
            email=wh_email,
            password="PasswordSegura123!",
            is_staff=True,
        )
        warehouse.groups.add(Group.objects.get(name=ROLE_WAREHOUSE))
        return admin, warehouse

    def _setup_catalog(self):
        cat = Category.objects.create(name="Mixers", slug=f"mixers-{uuid.uuid4().hex[:6]}")
        brand = Brand.objects.create(name="AllenTest", slug=f"allentest-{uuid.uuid4().hex[:6]}")
        prod = Product.objects.create(
            name="Mixer Pro 12",
            slug=f"mixer-pro-12-{uuid.uuid4().hex[:6]}",
            sku=f"SKU-{uuid.uuid4().hex[:8].upper()}",
            price=Decimal("500000"),
            stock=5,
            category=cat,
            brand=brand,
            is_active=True,
        )
        sup = Supplier.objects.create(
            internal_code=f"SUP-{uuid.uuid4().hex[:6].upper()}",
            legal_name="Pro Audio Corp",
            trade_name="ProAudio",
            country="Chile",
            currency="USD",
            payment_terms="45 días neto confidencial",
            internal_notes="Descuento secreto 12%",
        )
        return cat, brand, prod, sup

    def test_sup01_price_history_immutable_orm_and_postgres(self):
        admin, _ = self._setup_users()
        _, _, prod, sup = self._setup_catalog()
        link, _ = upsert_product_supplier(
            supplier=sup,
            product=prod,
            unit_cost=Decimal("250.00"),
            currency="USD",
            actor=admin,
        )
        hist = SupplierPriceHistory.objects.get(product_supplier=link)

        # ORM guards
        with pytest.raises(PermissionDenied):
            hist.notes = "tampered"
            hist.save()
        with pytest.raises(PermissionDenied):
            hist.delete()
        with pytest.raises(PermissionDenied):
            SupplierPriceHistory.objects.filter(pk=hist.pk).update(new_cost=Decimal("1.00"))
        with pytest.raises(PermissionDenied):
            SupplierPriceHistory.objects.filter(pk=hist.pk).delete()

        # PostgreSQL trigger guards (UPDATE, DELETE, TRUNCATE)
        if connection.vendor == "postgresql":
            with pytest.raises(DatabaseError):
                with transaction.atomic():
                    with connection.cursor() as cur:
                        cur.execute(
                            "UPDATE procurement_supplierpricehistory SET new_cost = 1.00 WHERE id = %s",
                            [str(hist.id)],
                        )
            with pytest.raises(DatabaseError):
                with transaction.atomic():
                    with connection.cursor() as cur:
                        cur.execute(
                            "DELETE FROM procurement_supplierpricehistory WHERE id = %s",
                            [str(hist.id)],
                        )
            with pytest.raises(DatabaseError):
                with transaction.atomic():
                    with connection.cursor() as cur:
                        cur.execute("TRUNCATE TABLE procurement_supplierpricehistory")

    def test_sup02_compare_suppliers_masks_commercial_terms_and_order(self):
        admin, _ = self._setup_users()
        _, _, prod, sup1 = self._setup_catalog()
        sup2 = Supplier.objects.create(
            internal_code=f"SUP-{uuid.uuid4().hex[:6].upper()}",
            legal_name="Second Audio SpA",
            trade_name="SecondAudio",
            country="Chile",
            currency="USD",
            payment_terms="Contado 5% desc",
        )
        # sup2 es más barato pero tiene mayor lead_time
        upsert_product_supplier(
            supplier=sup1, product=prod, unit_cost=Decimal("300.00"),
            currency="USD", lead_time_days=3, actor=admin,
        )
        upsert_product_supplier(
            supplier=sup2, product=prod, unit_cost=Decimal("200.00"),
            currency="USD", lead_time_days=20, actor=admin,
        )

        masked = compare_suppliers_for_sku(prod, include_costs=False)
        assert masked["comparable_groups_count"] is None
        assert masked["has_mixed_currencies"] is None
        assert masked["has_mixed_tax_basis"] is None
        assert masked["referential_meta"] is None
        # Sin permisos de costo, ordena por preferente / lead_time, NO por unit_cost
        assert masked["alternatives"][0]["supplier_code"] == sup1.internal_code
        for alt in masked["alternatives"]:
            assert "payment_terms" not in alt
            assert "unit_cost" not in alt
            assert "currency" not in alt
            assert "tax_basis" not in alt
            assert "comparable_group" not in alt
            assert "comparable_group_size" not in alt

    def test_sup03_complete_audit_and_preferred_deactivation_patch(self):
        admin, _ = self._setup_users()
        _, _, prod, sup = self._setup_catalog()
        link, _ = upsert_product_supplier(
            supplier=sup, product=prod, unit_cost=Decimal("250.00"),
            currency="USD", actor=admin,
        )
        select_preferred_supplier(link.id, admin)

        # Cambio de disponibilidad sin cambiar costo debe auditarse
        upsert_product_supplier(
            supplier=sup, product=prod, unit_cost=Decimal("250.00"),
            currency="USD", reported_availability=ProductSupplier.AvailabilityStatus.LOW_STOCK,
            reported_available_qty=4, actor=admin,
        )
        assert AuditEvent.objects.filter(
            resource_type="ProductSupplier", action="PRODUCT_SUPPLIER_UPDATED"
        ).exists()

        client = APIClient()
        client.force_authenticate(user=admin)

        # Contactos POST / PATCH / DELETE auditados
        res_c = client.post(
            f"/api/v1/admin/suppliers/{sup.id}/contacts/",
            {"full_name": "Ana Torres", "role_title": "Ejecutiva", "email": "ana@test.local"},
            format="json",
        )
        assert res_c.status_code == 201
        cid = res_c.data["id"]
        assert AuditEvent.objects.filter(action="SUPPLIER_CONTACT_CREATED", resource_id=cid).exists()

        res_p = client.patch(
            f"/api/v1/admin/suppliers/{sup.id}/contacts/{cid}/",
            {"role_title": "Key Account"},
            format="json",
        )
        assert res_p.status_code == 200
        assert AuditEvent.objects.filter(action="SUPPLIER_CONTACT_UPDATED", resource_id=cid).exists()

        res_d = client.delete(f"/api/v1/admin/suppliers/{sup.id}/contacts/{cid}/")
        assert res_d.status_code == 204
        assert AuditEvent.objects.filter(action="SUPPLIER_CONTACT_DELETED", resource_id=cid).exists()

        # PATCH proveedor a is_active=False debe limpiar is_preferred y no exponer internal_notes en log
        res_sup = client.patch(
            f"/api/v1/admin/suppliers/{sup.id}/",
            {"is_active": False, "internal_notes": "Texto ultra confidencial"},
            format="json",
        )
        assert res_sup.status_code == 200
        link.refresh_from_db()
        assert link.is_preferred is False
        ev = AuditEvent.objects.filter(action="SUPPLIER_UPDATED", resource_id=str(sup.id)).first()
        assert ev is not None
        assert "Texto ultra confidencial" not in str(ev.new_values)

    def test_sup04_product_delete_with_procurement_refs_no_500(self):
        admin, _ = self._setup_users()
        _, _, prod, sup = self._setup_catalog()
        upsert_product_supplier(
            supplier=sup, product=prod, unit_cost=Decimal("250.00"),
            currency="USD", actor=admin,
        )

        client = APIClient()
        client.force_authenticate(user=admin)
        res = client.delete(f"/api/v1/admin/products/{prod.id}/")
        assert res.status_code == 200
        assert res.data["deactivated"] is True
        prod.refresh_from_db()
        assert prod.is_active is False
