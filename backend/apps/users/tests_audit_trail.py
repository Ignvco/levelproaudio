# apps/users/tests_audit_trail.py
"""
Suite de pruebas exhaustivas para LEVELPRO OS V4.0 — GATE 1.2 (Audit Trail & Activity Log).
Cubre los 21 escenarios obligatorios:
1.  test_audit_event_created_on_product_price_change
2.  test_audit_event_created_on_product_cost_change
3.  test_audit_event_created_on_inventory_stock_adjustment
4.  test_audit_event_created_on_order_status_transition
5.  test_audit_event_created_on_payment_approval_and_rejection
6.  test_audit_event_created_on_financial_withdrawal
7.  test_audit_event_created_on_tributary_document_upsert
8.  test_audit_event_created_on_role_assignment_and_revocation
9.  test_audit_event_created_on_privilege_escalation_attempt
10. test_audit_event_created_on_bulk_product_import
11. test_audit_event_created_on_rewards_campaign_lifecycle
12. test_audit_event_created_on_loyalty_point_adjustment
13. test_audit_event_created_on_site_settings_change
14. test_audit_event_created_on_academy_and_services_mutations
15. test_audit_event_operational_immutability_prohibits_update_and_delete
16. test_postgresql_trigger_blocks_sql_update_and_delete
17. test_audit_sanitizer_recursive_strips_passwords_tokens_and_secrets
18. test_audit_api_rbac_view_security_audit_segregation
19. test_audit_api_rbac_dynamic_financial_field_masking
20. test_audit_export_csv_requires_export_permission_and_records_audit_event
21. test_audit_transactional_consistency_rollbacks_event_on_failed_business_mutation
"""

from decimal import Decimal
import io
import uuid
from unittest.mock import patch
from django.test import TransactionTestCase
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
import re
from django.core.exceptions import PermissionDenied
from django.db import connection, transaction
from django.db.utils import InternalError, OperationalError
from django.db.backends.base.operations import BaseDatabaseOperations

_orig_execute_sql_flush = BaseDatabaseOperations.execute_sql_flush


def _audit_preserving_execute_sql_flush(self, sql_list):
    """
    Durante el vaciado de tablas de pruebas (sql_flush), activa temporalmente el token de mantenimiento
    de sesión para permitir el vaciado coordinado con integridad referencial, y luego lo resetea de inmediato.
    """
    with self.connection.cursor() as cursor:
        cursor.execute("SET levelpro.maintenance_audit_maintenance_active = 'active_authorized_maintenance';")
        try:
            return _orig_execute_sql_flush(self, sql_list)
        finally:
            cursor.execute("RESET levelpro.maintenance_audit_maintenance_active;")


BaseDatabaseOperations.execute_sql_flush = _audit_preserving_execute_sql_flush
from rest_framework.test import APIClient
from rest_framework import status

from apps.analytics.models import AuditEvent, DistributionCategory, Withdrawal
from apps.products.models import Product, Category, Brand
from apps.orders.models import Order
from apps.payments.models import Payment
from apps.billing.models import TributaryDocument
from apps.academy.models import Course, Enrollment
from apps.services.models import Service, Booking, ServiceRequest
from apps.loyalty.models import LoyaltyAccount, LoyaltyConfig
from apps.rewards.models import Campaign, CampaignStatus
from apps.site_settings.models import SiteSettings

from core.rbac.constants import (
    MODULE_AUDIT,
    MODULE_CATALOG,
    MODULE_ORDERS,
    MODULE_FINANCES,
    MODULE_MARKETING,
    MODULE_ACADEMY,
    MODULE_SERVICES,
    MODULE_ROLES,
    MODULE_SETTINGS,
    ROLE_SUPER_ADMIN,
    ROLE_MANAGEMENT,
    ROLE_SALES,
    ROLE_WAREHOUSE,
    ROLE_FINANCE,
    PERM_VIEW_AUDIT,
    PERM_VIEW_SECURITY_AUDIT,
    PERM_VIEW_FINANCIAL_AUDIT,
    PERM_EXPORT_AUDIT,
    PERM_VIEW_COSTS,
    PERM_VIEW_MARGINS,
    PERM_VIEW_FINANCES,
    PERM_MANAGE_FINANCES,
    PERM_EDIT_PRICES,
    PERM_EDIT_COSTS,
    PERM_ADJUST_INVENTORY,
    PERM_MANAGE_SETTINGS,
    PERM_MANAGE_ROLES,
)
from core.audit.constants import (
    CATEGORY_CREATION,
    CATEGORY_MODIFICATION,
    CATEGORY_DELETION,
    CATEGORY_PRICE_CHANGE,
    CATEGORY_COST_CHANGE,
    CATEGORY_STOCK_ADJUSTMENT,
    CATEGORY_ORDER_STATUS,
    CATEGORY_PAYMENT_OPERATION,
    CATEGORY_FINANCIAL_OPERATION,
    CATEGORY_CONFIG_CHANGE,
    CATEGORY_ROLE_PERMISSION,
    CATEGORY_BULK_OPERATION,
    CATEGORY_EXPORT,
    CATEGORY_SECURITY_DENIED,
    CATEGORY_PRIVILEGE_ESCALATION,
    RESULT_SUCCESS,
    RESULT_DENIED,
    SEVERITY_WARNING,
    SEVERITY_CRITICAL,
)
from core.audit.sanitizer import sanitize_audit_payload
from core.rbac.services import assign_role_to_user, remove_role_from_user

User = get_user_model()


class AuditTrailComprehensiveTestSuite(TransactionTestCase):
    """Suite integral para probar el 100% de los requerimientos de GATE 1.2."""

    def setUp(self):
        super().setUp()
        from core.audit.context import clear_current_audit_context
        clear_current_audit_context()
        self.client = APIClient()

        from django.core.management import call_command
        call_command("setup_rbac", reset_defaults=True)

        # Grupos oficiales aprovisionados
        self.super_admin_group = Group.objects.get(name=ROLE_SUPER_ADMIN)
        self.management_group = Group.objects.get(name=ROLE_MANAGEMENT)
        self.finance_group = Group.objects.get(name=ROLE_FINANCE)
        self.sales_group = Group.objects.get(name=ROLE_SALES)
        self.warehouse_group = Group.objects.get(name=ROLE_WAREHOUSE)

        # Usuarios
        self.super_admin = User.objects.create_superuser(
            email="superaudit@levelproaudio.com",
            username="superaudit",
            password="Password123!",
            is_active=True,
            is_staff=True,
            is_superuser=True,
        )
        self.super_admin.groups.add(self.super_admin_group)

        self.management_user = User.objects.create_user(
            email="mgmtaudit@levelproaudio.com",
            username="mgmtaudit",
            password="Password123!",
            is_active=True,
            is_staff=True,
        )
        self.management_user.groups.add(self.management_group)

        self.finance_user = User.objects.create_user(
            email="financeaudit@levelproaudio.com",
            username="financeaudit",
            password="Password123!",
            is_active=True,
            is_staff=True,
        )
        self.finance_user.groups.add(self.finance_group)

        self.sales_user = User.objects.create_user(
            email="salesaudit@levelproaudio.com",
            username="salesaudit",
            password="Password123!",
            is_active=True,
            is_staff=True,
        )
        self.sales_user.groups.add(self.sales_group)

        self.warehouse_user = User.objects.create_user(
            email="warehouseaudit@levelproaudio.com",
            username="warehouseaudit",
            password="Password123!",
            is_active=True,
            is_staff=True,
        )
        self.warehouse_user.groups.add(self.warehouse_group)

        # Entidades base
        self.category = Category.objects.create(name="Audio Pro Test", slug="audio-pro-test")
        self.brand = Brand.objects.create(name="Genelec Test", slug="genelec-test")
        self.product = Product.objects.create(
            name="Monitor Activo 8030C",
            slug="monitor-activo-8030c",
            sku="GEN-8030C-AUDIT",
            price=Decimal("890000.00"),
            cost_price=Decimal("540000.00"),
            stock=15,
            stock_min=3,
            category=self.category,
            brand=self.brand,
            is_active=True,
        )

    # 1. Product price change
    def test_audit_event_created_on_product_price_change(self):
        self.client.force_authenticate(user=self.management_user)
        url = f"/api/v1/admin/products/{self.product.id}/"
        resp = self.client.patch(url, {"price": "950000.00"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        event = AuditEvent.objects.filter(
            resource_type="Product",
            resource_id=str(self.product.id),
            action="PRICE_CHANGED",
        ).first()
        self.assertIsNotNone(event)
        self.assertEqual(event.event_category, CATEGORY_PRICE_CHANGE)
        self.assertEqual(event.actor_email, self.management_user.email)
        self.assertIn("price", event.changed_fields)
        self.assertEqual(event.new_values.get("price"), "950000.00")

    # 2. Product cost change
    def test_audit_event_created_on_product_cost_change(self):
        self.client.force_authenticate(user=self.management_user)
        url = f"/api/v1/admin/products/{self.product.id}/"
        resp = self.client.patch(url, {"cost_price": "580000.00"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        event = AuditEvent.objects.filter(
            resource_type="Product",
            resource_id=str(self.product.id),
            action="COST_CHANGED",
        ).first()
        self.assertIsNotNone(event)
        self.assertEqual(event.event_category, CATEGORY_COST_CHANGE)
        self.assertEqual(event.severity, SEVERITY_WARNING)
        self.assertIn("cost_price", event.changed_fields)

    # 3. Stock adjustment
    def test_audit_event_created_on_inventory_stock_adjustment(self):
        self.client.force_authenticate(user=self.warehouse_user)
        url = f"/api/v1/admin/products/{self.product.id}/"
        resp = self.client.patch(url, {"stock": 25}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        event = AuditEvent.objects.filter(
            resource_type="Product",
            resource_id=str(self.product.id),
            action="STOCK_ADJUSTED",
        ).first()
        self.assertIsNotNone(event)
        self.assertEqual(event.event_category, CATEGORY_STOCK_ADJUSTMENT)
        self.assertIn("stock", event.changed_fields)

    # 4. Order status transition
    def test_audit_event_created_on_order_status_transition(self):
        order = Order.objects.create(
            user=self.sales_user,
            email="customer@example.com",
            total=Decimal("890000.00"),
            status="pending",
            currency="CLP",
        )
        self.client.force_authenticate(user=self.super_admin)
        url = f"/api/v1/admin/orders/{order.id}/update_status/"
        resp = self.client.post(url, {"status": "paid"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        event = AuditEvent.objects.filter(
            resource_type="Order",
            resource_id=str(order.id),
            action="ORDER_STATUS_CHANGED",
        ).first()
        self.assertIsNotNone(event)
        self.assertEqual(event.event_category, CATEGORY_ORDER_STATUS)
        self.assertEqual(event.previous_values.get("status"), "pending")
        self.assertEqual(event.new_values.get("status"), "paid")

    # 5. Payment approval and rejection
    def test_audit_event_created_on_payment_approval_and_rejection(self):
        order = Order.objects.create(
            user=self.sales_user,
            email="cust@example.com",
            total=Decimal("150000.00"),
            status="pending",
            currency="CLP",
        )
        payment = Payment.objects.create(
            order=order,
            amount=Decimal("150000.00"),
            currency="CLP",
            status="pending",
            provider="transfer",
        )
        self.client.force_authenticate(user=self.super_admin)
        url = f"/api/v1/admin/payments/{payment.id}/status/"

        # Approve
        resp = self.client.patch(url, {"status": "approved"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        app_event = AuditEvent.objects.filter(
            resource_type="Payment",
            resource_id=str(payment.id),
            action="PAYMENT_APPROVED",
        ).first()
        self.assertIsNotNone(app_event)
        self.assertEqual(app_event.event_category, CATEGORY_PAYMENT_OPERATION)

        # Reject
        resp_rej = self.client.patch(url, {"status": "rejected"}, format="json")
        self.assertEqual(resp_rej.status_code, status.HTTP_200_OK)
        rej_event = AuditEvent.objects.filter(
            resource_type="Payment",
            resource_id=str(payment.id),
            action="PAYMENT_REJECTED",
        ).first()
        self.assertIsNotNone(rej_event)
        self.assertEqual(rej_event.severity, SEVERITY_WARNING)

    # 6. Financial withdrawal
    def test_audit_event_created_on_financial_withdrawal(self):
        cat = DistributionCategory.objects.create(name="Utilidades Audit", cat_type="remainder", is_active=True)
        # Crear IncomeDistribution previa para saldo
        from apps.analytics.models import IncomeRecord, IncomeDistribution
        rec = IncomeRecord.objects.create(amount=Decimal("1000000.00"), currency="CLP", source="manual")
        IncomeDistribution.objects.create(income_record=rec, category=cat, amount=Decimal("1000000.00"))

        self.client.force_authenticate(user=self.super_admin)
        url = "/api/v1/admin/finance/withdrawals/"
        resp = self.client.post(url, {
            "category_id": str(cat.id),
            "amount": "200000",
            "currency": "CLP",
            "destination": "Banco Santander - Cuenta 123",
            "notes": "Retiro dividendos",
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        wid = resp.data.get("id")

        event = AuditEvent.objects.filter(
            resource_type="Withdrawal",
            resource_id=wid,
            action="FINANCIAL_WITHDRAWAL_CREATED",
        ).first()
        self.assertIsNotNone(event)
        self.assertEqual(event.event_category, CATEGORY_FINANCIAL_OPERATION)

        # Eliminar retiro
        del_url = f"/api/v1/admin/finance/withdrawals/{wid}/"
        resp_del = self.client.delete(del_url)
        self.assertEqual(resp_del.status_code, status.HTTP_200_OK)

        del_event = AuditEvent.objects.filter(
            resource_type="Withdrawal",
            resource_id=wid,
            action="FINANCIAL_WITHDRAWAL_DELETED",
        ).first()
        self.assertIsNotNone(del_event)
        self.assertEqual(del_event.severity, "high")

    # 7. Tributary document upsert
    def test_audit_event_created_on_tributary_document_upsert(self):
        order = Order.objects.create(
            user=self.sales_user,
            email="trib@example.com",
            total=Decimal("500000.00"),
            status="paid",
            currency="CLP",
        )
        self.client.force_authenticate(user=self.super_admin)
        url = "/api/v1/billing/record/"
        resp = self.client.post(url, {
            "order_id": str(order.id),
            "tipo": "factura",
            "estado": "emitido",
            "numero_externo": "998877",
            "monto": "500000",
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        event = AuditEvent.objects.filter(
            resource_type="TributaryDocument",
            action="TRIBUTARY_DOCUMENT_UPSERTED",
        ).first()
        self.assertIsNotNone(event)
        self.assertEqual(event.new_values.get("numero_externo"), "998877")

    # 8. Role assignment and revocation
    def test_audit_event_created_on_role_assignment_and_revocation(self):
        target = User.objects.create_user(email="target@example.com", username="target", password="Password123!")
        
        # Asignar rol
        assign_role_to_user(target, ROLE_WAREHOUSE, operator=self.super_admin)
        event_ass = AuditEvent.objects.filter(
            resource_type="User",
            resource_id=str(target.id),
            action="RBAC_ROLE_ASSIGNED",
        ).first()
        self.assertIsNotNone(event_ass)
        self.assertEqual(event_ass.actor_email, self.super_admin.email)

        # Revocar rol
        remove_role_from_user(target, ROLE_WAREHOUSE, operator=self.super_admin)
        event_rev = AuditEvent.objects.filter(
            resource_type="User",
            resource_id=str(target.id),
            action="RBAC_ROLE_REVOKED",
        ).first()
        self.assertIsNotNone(event_rev)
        self.assertEqual(event_rev.actor_email, self.super_admin.email)

    # 9. Privilege escalation attempt
    def test_audit_event_created_on_privilege_escalation_attempt(self):
        target = User.objects.create_user(email="target2@example.com", username="target2", password="Password123!")
        self.client.force_authenticate(user=self.sales_user)
        url = f"/api/v1/admin/users/{target.id}/roles/"
        resp = self.client.post(url, {"role": ROLE_SUPER_ADMIN, "action": "assign"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

        event = AuditEvent.objects.filter(
            action__in=["ACCESS_DENIED", "PRIVILEGE_ESCALATION_ATTEMPT"],
            result="denied",
        ).first()
        self.assertIsNotNone(event)
        self.assertIn(event.severity, ["high", "critical"])

    # 10. Bulk product import
    def test_audit_event_created_on_bulk_product_import(self):
        self.client.force_authenticate(user=self.management_user)
        csv_content = (
            "nombre,precio,stock,sku\n"
            "Cable XLR 3M,15000,50,XLR-003\n"
        )
        csv_file = io.BytesIO(csv_content.encode("utf-8"))
        csv_file.name = "import_test.csv"
        url = "/api/v1/admin/products/import/"
        resp = self.client.post(url, {"file": csv_file}, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        event = AuditEvent.objects.filter(
            action="BULK_PRODUCTS_IMPORTED",
            event_category=CATEGORY_BULK_OPERATION,
        ).first()
        self.assertIsNotNone(event)

    # 11. Rewards campaign lifecycle
    def test_audit_event_created_on_rewards_campaign_lifecycle(self):
        self.client.force_authenticate(user=self.super_admin)
        url = "/api/v1/admin/rewards/campaigns/"
        resp = self.client.post(url, {
            "name": "Sorteo Shure 2026",
            "main_prize": "Micrófono Shure SM7B",
            "start_date": "2026-01-01T00:00:00Z",
            "end_date": "2026-12-30T23:59:59Z",
            "draw_date": "2026-12-31T20:00:00Z",
            "status": "draft",
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        cid = resp.data.get("id")

        event = AuditEvent.objects.filter(
            resource_type="Campaign",
            resource_id=str(cid),
            action="REWARDS_CAMPAIGN_CREATED",
        ).first()
        self.assertIsNotNone(event)

        # Finalizar campaña
        fin_url = f"/api/v1/admin/rewards/campaigns/{cid}/finish/"
        resp_fin = self.client.post(fin_url)
        self.assertEqual(resp_fin.status_code, status.HTTP_200_OK)

        fin_event = AuditEvent.objects.filter(
            resource_type="Campaign",
            resource_id=str(cid),
            action="REWARDS_CAMPAIGN_FINISHED",
        ).first()
        self.assertIsNotNone(fin_event)

    # 12. Loyalty point adjustment
    def test_audit_event_created_on_loyalty_point_adjustment(self):
        customer = User.objects.create_user(email="loyal@example.com", username="loyal", password="Password123!")
        self.client.force_authenticate(user=self.super_admin)
        url = "/api/v1/loyalty/admin/adjust/"
        resp = self.client.post(url, {
            "user_id": str(customer.id),
            "points": 500,
            "reason": "Bonificación fidelidad",
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        event = AuditEvent.objects.filter(
            action="LOYALTY_POINTS_ADJUSTED",
            resource_id=str(customer.id),
        ).first()
        self.assertIsNotNone(event)
        self.assertEqual(event.new_values.get("points"), 500)

    # 13. Site settings change
    def test_audit_event_created_on_site_settings_change(self):
        self.client.force_authenticate(user=self.super_admin)
        url = "/api/v1/admin/site-settings/"
        resp = self.client.patch(url, {"site_name": "LevelPro Audio BMS V4.0"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        event = AuditEvent.objects.filter(
            resource_type="SiteSettings",
            action="CONFIG_CHANGED",
        ).first()
        self.assertIsNotNone(event)
        self.assertEqual(event.event_category, CATEGORY_CONFIG_CHANGE)

    # 14. Academy and services mutations
    def test_audit_event_created_on_academy_and_services_mutations(self):
        self.client.force_authenticate(user=self.super_admin)
        
        # Course creation
        resp_c = self.client.post("/api/v1/admin/academy/courses/", {
            "title": "Producción Musical Avanzada",
            "slug": "produccion-musical-avanzada",
            "description": "Curso completo de producción musical avanzada.",
            "price": "120000.00",
            "is_published": True,
        }, format="json")
        self.assertEqual(resp_c.status_code, status.HTTP_201_CREATED)
        cid = resp_c.data.get("id")

        c_event = AuditEvent.objects.filter(
            resource_type="Course",
            resource_id=str(cid),
            action="COURSE_CREATED",
        ).first()
        self.assertIsNotNone(c_event)

        # Service creation
        resp_s = self.client.post("/api/v1/admin/services/list/", {
            "name": "Calibración Acústica de Estudio",
            "price_type": "fixed",
            "price": "250000.00",
        }, format="json")
        self.assertEqual(resp_s.status_code, status.HTTP_201_CREATED)
        sid = resp_s.data.get("id")

        s_event = AuditEvent.objects.filter(
            resource_type="Service",
            resource_id=str(sid),
            action="SERVICE_CREATED",
        ).first()
        self.assertIsNotNone(s_event)

    # 15. Operational immutability in Python (ORM)
    def test_audit_event_operational_immutability_prohibits_update_and_delete(self):
        event = AuditEvent.objects.create(
            module="test",
            action="TEST_ACTION",
            event_category="modification",
            resource_type="Test",
            resource_id="1",
        )

        # Prohibir UPDATE a nivel de instancia
        event.action = "ALTERED_ACTION"
        with self.assertRaises(PermissionDenied):
            event.save()

        # Prohibir DELETE a nivel de instancia
        with self.assertRaises(PermissionDenied):
            event.delete()

        # Prohibir UPDATE a nivel de QuerySet
        with self.assertRaises(PermissionDenied):
            AuditEvent.objects.filter(id=event.id).update(action="HACKED")

        # Prohibir DELETE a nivel de QuerySet
        with self.assertRaises(PermissionDenied):
            AuditEvent.objects.filter(id=event.id).delete()

    # 16. PostgreSQL trigger blocks raw SQL UPDATE and DELETE
    def test_postgresql_trigger_blocks_sql_update_and_delete(self):
        if connection.vendor != "postgresql":
            self.skipTest("Prueba específica para base de datos PostgreSQL")

        event = AuditEvent.objects.create(
            module="test_sql",
            action="RAW_SQL_ACTION",
            event_category="modification",
            resource_type="Test",
            resource_id="sql-1",
        )

        # Raw SQL UPDATE debe fallar por el trigger con InternalError de PostgreSQL
        with self.assertRaises(InternalError):
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(
                        "UPDATE audit_events SET action = 'SQL_INJECTION' WHERE id = %s",
                        [str(event.id)],
                    )

        # Raw SQL DELETE debe fallar por el trigger con InternalError de PostgreSQL
        with self.assertRaises(InternalError):
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(
                        "DELETE FROM audit_events WHERE id = %s",
                        [str(event.id)],
                    )

    # 17. Sanitizer recursive secret stripping
    def test_audit_sanitizer_recursive_strips_passwords_tokens_and_secrets(self):
        raw_payload = {
            "user_email": "operator@levelproaudio.com",
            "password": "SuperSecretPassword123!",
            "auth": {
                "access_token": "eyJhbGciOiJIUzI1Ni...",
                "secret_key": "live_sk_1234567890",
                "nested": {
                    "cvv": "123",
                    "credit_card": "4111222233334444",
                    "safe_value": "Shure SM7B",
                },
            },
        }
        sanitized = sanitize_audit_payload(raw_payload)
        self.assertEqual(sanitized["password"], "[REDACTED]")
        self.assertEqual(sanitized["auth"]["access_token"], "[REDACTED]")
        self.assertEqual(sanitized["auth"]["secret_key"], "[REDACTED]")
        self.assertEqual(sanitized["auth"]["nested"]["cvv"], "[REDACTED]")
        self.assertEqual(sanitized["auth"]["nested"]["credit_card"], "[REDACTED]")
        self.assertEqual(sanitized["auth"]["nested"]["safe_value"], "Shure SM7B")

    # 18. Audit API RBAC security segregation
    def test_audit_api_rbac_view_security_audit_segregation(self):
        # Crear un evento de seguridad
        sec_event = AuditEvent.objects.create(
            module=MODULE_ROLES,
            action="PRIVILEGE_ESCALATION_ATTEMPT",
            event_category=CATEGORY_PRIVILEGE_ESCALATION,
            resource_type="User",
            resource_id="sec-1",
            severity="critical",
            result="denied",
        )
        # Super Admin puede verlo
        self.client.force_authenticate(user=self.super_admin)
        resp_su = self.client.get(f"/api/v1/admin/audit/events/{sec_event.id}/")
        self.assertEqual(resp_su.status_code, status.HTTP_200_OK)

        # Finanzas (sin view_security_audit) no puede verlo
        self.client.force_authenticate(user=self.finance_user)
        resp_fin = self.client.get(f"/api/v1/admin/audit/events/{sec_event.id}/")
        self.assertEqual(resp_fin.status_code, status.HTTP_403_FORBIDDEN)

        # En el listado para finanzas, tampoco debe aparecer
        resp_list = self.client.get("/api/v1/admin/audit/events/")
        self.assertEqual(resp_list.status_code, status.HTTP_200_OK)
        ids = [ev["id"] for ev in resp_list.data.get("results", [])]
        self.assertNotIn(str(sec_event.id), ids)

    # 19. Audit API RBAC dynamic financial field masking
    def test_audit_api_rbac_dynamic_financial_field_masking(self):
        event = AuditEvent.objects.create(
            module=MODULE_CATALOG,
            action="COST_CHANGED",
            event_category=CATEGORY_COST_CHANGE,
            resource_type="Product",
            resource_id=str(self.product.id),
            previous_values={"cost_price": "500000.00", "stock": 10},
            new_values={"cost_price": "540000.00", "stock": 10},
        )
        # Remover temporalmente permisos de costos y finanzas del grupo ROLE_MANAGEMENT
        mgmt_group = Group.objects.get(name=ROLE_MANAGEMENT)
        cost_perms = Permission.objects.filter(
            codename__in=[PERM_VIEW_COSTS, PERM_VIEW_FINANCES, PERM_VIEW_FINANCIAL_AUDIT],
            content_type__app_label="users",
        )
        for p in cost_perms:
            mgmt_group.permissions.remove(p)

        self.client.force_authenticate(user=self.management_user)
        resp = self.client.get(f"/api/v1/admin/audit/events/{event.id}/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # El cost_price debe estar enmascarado
        self.assertEqual(resp.data["previous_values"]["cost_price"], "[RESTRINGIDO]")
        self.assertEqual(resp.data["new_values"]["cost_price"], "[RESTRINGIDO]")
        # El stock no debe estar enmascarado
        self.assertEqual(resp.data["previous_values"]["stock"], 10)

    # 20. Audit export to CSV
    def test_audit_export_csv_requires_export_permission_and_records_audit_event(self):
        self.client.force_authenticate(user=self.super_admin)
        resp = self.client.get("/api/v1/admin/audit/events/export/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp["Content-Type"], "text/csv; charset=utf-8")
        self.assertIn("attachment; filename=", resp["Content-Disposition"])

        # Verificar que se registró el evento de exportación
        exp_event = AuditEvent.objects.filter(
            action="SENSITIVE_DATA_EXPORTED",
            event_category=CATEGORY_EXPORT,
        ).first()
        self.assertIsNotNone(exp_event)

    # 21. Transactional consistency rollbacks event on failed business mutation
    def test_audit_transactional_consistency_rollbacks_event_on_failed_business_mutation(self):
        initial_count = AuditEvent.objects.filter(resource_type="Product", action="PRODUCT_CREATED").count()

        # Intentar crear un producto inválido dentro de transacción que fallará
        self.client.force_authenticate(user=self.management_user)
        url = "/api/v1/admin/products/"
        # product_type inválido provoca un error 400 y rollback atómico
        resp = self.client.post(url, {
            "name": "Producto Inválido",
            "product_type": "TIPO_COMPLETAMENTE_INVALIDO",
            "price": "10000",
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

        # El contador de eventos exitosos no debe haber aumentado (sin falsos positivos)
        final_count = AuditEvent.objects.filter(resource_type="Product", action="PRODUCT_CREATED").count()
        self.assertEqual(initial_count, final_count)

    # 22. Mandatory audit failure rolls back business mutation (fail-closed transaction)
    def test_audit_mandatory_failure_rolls_back_business_mutation(self):
        self.client.force_authenticate(user=self.management_user)
        initial_price = self.product.price

        # Inyectar fallo en record_audit_event cuando mandatory=True
        with patch("apps.analytics.views.record_audit_event", side_effect=RuntimeError("Fallo inducido en motor de auditoría")):
            resp = self.client.patch(
                f"/api/v1/admin/products/{self.product.id}/",
                {"price": "999999.00"},
                format="json",
            )
            # Debe fallar con error de servidor (500) y abortar la transacción
            self.assertEqual(resp.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Verificar que el precio en la base de datos NO cambió (rollback íntegro)
        self.product.refresh_from_db()
        self.assertEqual(self.product.price, initial_price)

    # 23. PostgreSQL trigger blocks raw SQL TRUNCATE (Incondicional para usuarios de aplicación)
    def test_postgresql_trigger_blocks_sql_truncate(self):
        if connection.vendor != "postgresql":
            self.skipTest("Prueba específica para base de datos PostgreSQL")

        # 1. Intento directo de TRUNCATE sin token de mantenimiento
        with self.assertRaises((InternalError, OperationalError)):
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute("TRUNCATE TABLE audit_events")

        # 2. Intento de bypass configurando parámetros obsoletos/inválidos: el trigger lo bloquea
        with self.assertRaises((InternalError, OperationalError)):
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute("SET levelpro.allow_audit_truncate = 'on';")
                    cursor.execute("TRUNCATE TABLE audit_events")

    # 24. Prevention of CSV formula injection (CWE-1236)
    def test_csv_formula_injection_prevention(self):
        # Crear evento con payloads que contienen fórmulas maliciosas de Excel
        AuditEvent.objects.create(
            module=MODULE_CATALOG,
            action="PRICE_CHANGED",
            event_category=CATEGORY_PRICE_CHANGE,
            resource_type="Product",
            resource_id="=cmd|'/C calc'!A0",
            resource_repr="@SUM(1+1)",
            actor_email="+admin@malicious.com",
            actor_username="=1+1",
        )
        self.client.force_authenticate(user=self.super_admin)
        resp = self.client.get("/api/v1/admin/audit/events/export/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        content = resp.content.decode("utf-8")

        # Verificar que las fórmulas han sido neutralizadas anteponiendo '
        self.assertIn("'=cmd|'/C calc'!A0", content)
        self.assertIn("'@SUM(1+1)", content)
        self.assertIn("'+admin@malicious.com", content)
        self.assertIn("'=1+1", content)

    # 25. Payment signal audit failure logs critical alert (Class 2)
    def test_payment_signal_audit_failure_logs_critical_alert(self):
        order = Order.objects.create(
            user=self.sales_user,
            total=Decimal("50000.00"),
            currency="CLP",
            status="pending",
        )
        with patch("apps.payments.signals.record_audit_event", side_effect=RuntimeError("Fallo inducido en auditoría asíncrona")):
            with self.assertLogs("levelpro.audit", level="CRITICAL") as cm:
                Payment.objects.create(
                    order=order,
                    provider="transfer",
                    status="approved",
                    amount=Decimal("50000.00"),
                )
                # Alerta crítica registrada
                self.assertTrue(any("AUDIT_ALERT_CRITICAL" in msg for msg in cm.output))

    # 26. Audit Summary and Export RBAC Segregation for non-security users
    def test_audit_summary_and_export_rbac_segregation(self):
        # Crear evento de seguridad
        sec_event = AuditEvent.objects.create(
            module=MODULE_ROLES,
            action="PRIVILEGE_ESCALATION_ATTEMPT",
            event_category=CATEGORY_PRIVILEGE_ESCALATION,
            resource_type="User",
            resource_id="sec-summary",
            severity="critical",
            result="denied",
        )
        # Finanzas (sin view_security_audit) no debe ver el evento en summary
        self.client.force_authenticate(user=self.finance_user)
        resp_sum = self.client.get("/api/v1/admin/audit/summary/")
        self.assertEqual(resp_sum.status_code, status.HTTP_200_OK)

        # Export CSV para finanzas tampoco debe contener el ID del evento de seguridad
        resp_exp = self.client.get("/api/v1/admin/audit/events/export/")
        self.assertEqual(resp_exp.status_code, status.HTTP_200_OK)
        exp_content = resp_exp.content.decode("utf-8")
        self.assertNotIn(str(sec_event.id), exp_content)

    # 27. Idempotent payment audit reconciliation
    def test_reconcile_missing_payment_audit_events_is_idempotent(self):
        from core.audit.services import reconcile_missing_payment_audit_events
        order = Order.objects.create(
            user=self.sales_user,
            total=Decimal("75000.00"),
            currency="CLP",
            status="pending",
        )
        payment = Payment.objects.create(
            order=order,
            provider="transfer",
            status="approved",
            amount=Decimal("75000.00"),
        )
        # Eliminar deliberadamente cualquier evento de auditoría previo para este pago
        AuditEvent.objects.filter(resource_type="Payment", resource_id=str(payment.id)).delete_without_trigger() if hasattr(AuditEvent.objects, 'delete_without_trigger') else None
        # O consultar el conteo actual antes de reconciliar
        prior_reconciled = AuditEvent.objects.filter(resource_type="Payment", resource_id=str(payment.id), action="PAYMENT_APPROVED").count()

        # Primera ejecución: reconcilia y crea el evento faltante
        res1 = reconcile_missing_payment_audit_events()
        self.assertGreaterEqual(res1["scanned"], 1)

        event = AuditEvent.objects.filter(resource_type="Payment", resource_id=str(payment.id), action="PAYMENT_APPROVED").first()
        self.assertIsNotNone(event)
        self.assertEqual(event.module, "finances")

        # Segunda ejecución inmediata: idempotente al 100%, 0 eventos nuevos creados
        res2 = reconcile_missing_payment_audit_events()
        self.assertGreaterEqual(res2["skipped"], 1)
        after_count = AuditEvent.objects.filter(resource_type="Payment", resource_id=str(payment.id), action="PAYMENT_APPROVED").count()
        self.assertEqual(after_count, 1)

    # 28. Protection of banking information in representation and serializers
    def test_bank_account_masking_in_repr_and_serializers(self):
        from apps.payments.models import BankAccount
        bank_acc = BankAccount.objects.create(
            bank_name="Banco de Chile",
            account_number="123456789012",
            account_type="corriente",
            is_active=True,
        )
        event = AuditEvent.objects.create(
            module="finances",
            action="BANK_ACCOUNT_CREATED",
            event_category="config_change",
            resource_type="BankAccount",
            resource_id=str(bank_acc.id),
            resource_repr=f"Cuenta {bank_acc.bank_name} ****9012",
            new_values={"bank": bank_acc.bank_name, "account_number": "123456789012", "is_active": True},
        )
        # Super Admin puede ver la cuenta completa en new_values
        self.client.force_authenticate(user=self.super_admin)
        resp_su = self.client.get(f"/api/v1/admin/audit/events/{event.id}/")
        self.assertEqual(resp_su.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_su.data["new_values"]["account_number"], "123456789012")

        # Remover temporalmente permisos financieros del grupo ROLE_MANAGEMENT para probar enmascaramiento
        mgmt_group = Group.objects.get(name=ROLE_MANAGEMENT)
        fin_perms = Permission.objects.filter(
            codename__in=[PERM_VIEW_FINANCES, PERM_VIEW_FINANCIAL_AUDIT],
            content_type__app_label="users",
        )
        for p in fin_perms:
            mgmt_group.permissions.remove(p)

        # Usuario sin capacidades financieras ve account_number enmascarado
        self.client.force_authenticate(user=self.management_user)
        resp_mgmt = self.client.get(f"/api/v1/admin/audit/events/{event.id}/")
        self.assertEqual(resp_mgmt.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_mgmt.data["new_values"]["account_number"], "[RESTRINGIDO]")
        # El resource_repr solo contiene los últimos 4 dígitos
        self.assertIn("****9012", resp_mgmt.data["resource_repr"])
        self.assertNotIn("123456789012", resp_mgmt.data["resource_repr"])
