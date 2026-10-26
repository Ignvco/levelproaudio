from decimal import Decimal
from unittest.mock import patch

import pytest
from django.core.exceptions import ValidationError
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.orders.inventory import InventoryError
from apps.orders.models import Cart, CartItem, Order, OrderItem
from apps.orders.services import create_order_from_cart
from apps.payments.models import Payment, PaymentProvider, PaymentStatus
from apps.payments.services import process_mercadopago_webhook, capture_paypal_payment
from apps.products.models import Product, BundleItem
from apps.users.models import User


pytestmark = pytest.mark.django_db


@pytest.fixture
def buyer():
    cache.clear()
    return User.objects.create_user(email="inventory@test.com", username="inventory", password="x")


@pytest.fixture
def client(buyer):
    result = APIClient()
    result.force_authenticate(buyer)
    return result


@pytest.fixture
def product():
    return Product.objects.create(name="Mic", slug="inventory-mic", price=Decimal("1000"), stock=5)


def bundle(product, slug="inventory-kit", quantity=2):
    kit = Product.objects.create(name=slug, slug=slug, price=Decimal("1500"), product_type="bundle")
    BundleItem.objects.create(bundle=kit, component=product, quantity=quantity)
    return kit


def checkout(client, *lines, **extra):
    return client.post("/api/v1/orders/", {
        "items": [{"product": str(product.pk), "quantity": quantity} for product, quantity in lines],
        "shipping_address": "Test 123", **extra,
    }, format="json")


def cancel(client, order_id):
    return client.delete(f"/api/v1/orders/{order_id}/")


def test_duplicate_lines_cannot_oversell(client, product):
    response = checkout(client, (product, 3), (product, 3))
    assert response.status_code == 400
    product.refresh_from_db()
    assert product.stock == 5
    assert not Order.objects.exists()


def test_duplicate_lines_are_aggregated_and_restored_once(client, product):
    response = checkout(client, (product, 2), (product, 3))
    assert response.status_code == 201
    order = Order.objects.get(pk=response.data["id"])
    assert order.items.count() == 1
    assert order.items.get().quantity == 5
    assert order.total == Decimal("5000")
    assert order.stock_deductions == {str(product.pk): 5}
    product.refresh_from_db()
    assert product.stock == 0
    assert cancel(client, order.pk).status_code == 200
    assert cancel(client, order.pk).status_code == 400
    product.refresh_from_db()
    assert product.stock == 5


@pytest.mark.parametrize("second_kit", [False, True])
def test_shared_components_are_checked_across_whole_order(client, product, second_kit):
    kit = bundle(product, quantity=3)
    other = bundle(product, slug="second-kit", quantity=3) if second_kit else product
    response = checkout(client, (kit, 1), (other, 1 if second_kit else 3))
    assert response.status_code == 400
    product.refresh_from_db()
    assert product.stock == 5
    assert not Order.objects.exists()


def test_shared_components_deduct_exact_aggregate(client, product):
    first = bundle(product, quantity=2)
    second = bundle(product, slug="second-kit", quantity=1)
    response = checkout(client, (first, 1), (second, 1), (product, 2))
    assert response.status_code == 201
    product.refresh_from_db()
    assert product.stock == 0
    order = Order.objects.get(pk=response.data["id"])
    assert order.stock_deductions == {str(product.pk): 5}
    assert order.items.count() == 3
    assert order.total == Decimal("5000")


def test_cancellation_uses_original_components_even_after_kit_edit(client, product):
    kit = bundle(product)
    response = checkout(client, (kit, 2))
    replacement = Product.objects.create(name="Other", slug="other", price=100, stock=7)
    kit.bundle_components.all().delete()
    BundleItem.objects.create(bundle=kit, component=replacement, quantity=10)
    assert cancel(client, response.data["id"]).status_code == 200
    product.refresh_from_db()
    replacement.refresh_from_db()
    assert product.stock == 5
    assert replacement.stock == 7


def test_cancellation_uses_snapshot_after_type_change_or_kit_deletion(client, product):
    kit = bundle(product)
    response = checkout(client, (kit, 1))
    kit.delete()
    product.product_type = "preorder"
    product.save(update_fields=["product_type"])
    assert cancel(client, response.data["id"]).status_code == 200
    product.refresh_from_db()
    assert product.stock == 5


@pytest.mark.parametrize("kind", ["preorder", "on_demand"])
@pytest.mark.parametrize("as_component", [False, True])
def test_non_stock_products_never_change_physical_stock(client, product, kind, as_component):
    product.product_type = kind
    product.save(update_fields=["product_type"])
    target = bundle(product) if as_component else product
    response = checkout(client, (target, 20))
    assert response.status_code == 201
    order = Order.objects.get(pk=response.data["id"])
    assert order.stock_deductions == {}
    # Cambiar el tipo luego no debe inventar stock al cancelar.
    product.product_type = "stock"
    product.save(update_fields=["product_type"])
    assert cancel(client, order.pk).status_code == 200
    product.refresh_from_db()
    assert product.stock == 5


@pytest.mark.parametrize("quantity", [0, -1, 1.5, True, None, "", "1.0", "-1", "NaN", "2_0", [], {}, 2147483648])
def test_invalid_quantities_do_not_create_orders(client, product, quantity):
    response = checkout(client, (product, quantity))
    assert response.status_code == 400
    assert not Order.objects.exists()
    product.refresh_from_db()
    assert product.stock == 5


@pytest.mark.parametrize("items", [None, {}, [], [None], [{}], [{"product": "bad", "quantity": 1}]])
def test_invalid_item_payloads_return_400(client, items):
    response = client.post("/api/v1/orders/", {"items": items}, format="json")
    assert response.status_code == 400
    assert not Order.objects.exists()


def test_numeric_quantity_string_is_accepted(client, product):
    assert checkout(client, (product, "2")).status_code == 201
    product.refresh_from_db()
    assert product.stock == 3


def test_empty_and_nested_kits_are_rejected(client, product):
    kit = Product.objects.create(name="Empty", slug="empty", price=100, product_type="bundle")
    assert checkout(client, (kit, 1)).status_code == 400
    BundleItem.objects.create(bundle=kit, component=bundle(product), quantity=1)
    assert checkout(client, (kit, 1)).status_code == 400
    assert not Order.objects.exists()


def test_stock_failure_rolls_back_order_and_points(client, product, buyer):
    from apps.loyalty.models import LoyaltyAccount, LoyaltyTransaction
    account = LoyaltyAccount.objects.create(user=buyer, puntos_totales=1000)
    with patch("apps.orders.views.deduct_inventory", side_effect=InventoryError("Stock cambió")):
        response = checkout(client, (product, 1), loyalty_points_redeemed=500)
    assert response.status_code == 400
    assert not Order.objects.exists()
    assert not OrderItem.objects.exists()
    assert not LoyaltyTransaction.objects.filter(tipo="redeem").exists()
    account.refresh_from_db()
    product.refresh_from_db()
    assert account.puntos_canjeados == 0
    assert product.stock == 5


def test_order_is_not_cancellable_by_another_user(client, product):
    response = checkout(client, (product, 1))
    stranger = User.objects.create_user(email="other@test.com", username="other")
    client.force_authenticate(stranger)
    assert cancel(client, response.data["id"]).status_code == 404
    product.refresh_from_db()
    assert product.stock == 4


def test_cart_conversion_uses_same_inventory_rules_and_cannot_repeat(buyer, product):
    cart = Cart.objects.get(user=buyer, is_active=True)
    CartItem.objects.create(cart=cart, product=product, quantity=2)
    order = create_order_from_cart(cart, buyer, buyer.email, "Test")
    assert order.stock_deductions == {str(product.pk): 2}
    product.refresh_from_db()
    assert product.stock == 3
    with pytest.raises(InventoryError):
        create_order_from_cart(cart, buyer, buyer.email, "Test")
    assert Order.objects.count() == 1


def test_legacy_order_retains_cancellation_compatibility(client, product, buyer):
    order = Order.objects.create(user=buyer, email=buyer.email, shipping_address="Test", total=1000)
    OrderItem.objects.create(order=order, product=product, product_name=product.name, price=1000, quantity=2)
    assert order.stock_deductions is None
    assert cancel(client, order.pk).status_code == 200
    assert cancel(client, order.pk).status_code == 400
    product.refresh_from_db()
    assert product.stock == 7


@pytest.mark.parametrize("route", ["action", "patch"])
def test_admin_cancellation_restores_once_and_cannot_reopen(client, product, buyer, route):
    response = checkout(client, (product, 2))
    order = Order.objects.get(pk=response.data["id"])
    buyer.is_staff = True
    buyer.save(update_fields=["is_staff"])
    def status_request(value):
        if route == "action":
            return client.post(f"/api/v1/admin/orders/{order.pk}/update_status/", {"status": value}, format="json")
        return client.patch(f"/api/v1/admin/orders/{order.pk}/", {"status": value}, format="json")
    with patch("apps.emails.send_order_status_update"):
        assert status_request("cancelled").status_code == 200
        assert status_request("cancelled").status_code == 200
        assert status_request("paid").status_code == 400
    product.refresh_from_db()
    assert product.stock == 5


def test_paid_order_cannot_be_cancelled_by_customer(client, product):
    response = checkout(client, (product, 1))
    order = Order.objects.get(pk=response.data["id"])
    Payment.objects.create(order=order, provider="transfer", amount=1000, status="approved")
    assert cancel(client, order.pk).status_code == 400
    product.refresh_from_db()
    assert product.stock == 4


def test_late_approval_is_retained_for_review_without_reopening(client, product):
    response = checkout(client, (product, 1))
    order = Order.objects.get(pk=response.data["id"])
    assert cancel(client, order.pk).status_code == 200
    payment = Payment.objects.create(order=order, provider="transfer", amount=1000, status="approved")
    assert payment.status == PaymentStatus.IN_REVIEW
    order.refresh_from_db()
    product.refresh_from_db()
    assert order.status == "cancelled"
    assert product.stock == 5
    from apps.analytics.models import IncomeRecord
    assert not IncomeRecord.objects.filter(order=order).exists()


def test_late_mp_notification_does_not_reopen_cancelled_order(client, product):
    response = checkout(client, (product, 1))
    order = Order.objects.get(pk=response.data["id"])
    cancel(client, order.pk)
    with patch("apps.payments.services.get_mp_sdk") as sdk, patch("apps.payments.services.send_payment_confirmation_email") as email:
        sdk.return_value.payment.return_value.get.return_value = {"status": 200, "response": {
            "external_reference": str(order.pk), "status": "approved", "transaction_amount": 1000,
        }}
        process_mercadopago_webhook({"type": "payment", "data": {"id": "late-payment"}}, PaymentProvider.MERCADOPAGO_CL)
    assert Payment.objects.get(external_id="late-payment").status == "in_review"
    email.assert_not_called()
    order.refresh_from_db()
    assert order.status == "cancelled"


def test_cancellation_during_paypal_capture_is_recorded_for_review(client, product, buyer):
    response = checkout(client, (product, 1))
    order = Order.objects.get(pk=response.data["id"])
    payment = Payment.objects.create(order=order, provider="paypal", amount=1, currency="USD", preference_id="pp-race")
    with patch("apps.payments.services.configure_paypal"), patch("apps.payments.services.paypalrestsdk.Payment.find") as find, patch("apps.payments.services.send_payment_confirmation_email") as email:
        captured = find.return_value
        def execute(_):
            assert cancel(client, order.pk).status_code == 200
            return True
        captured.execute.side_effect = execute
        captured.transactions = []
        captured.to_dict.return_value = {"id": "pp-race"}
        assert capture_paypal_payment("pp-race", "payer", buyer) is False
    payment.refresh_from_db()
    assert payment.status == "in_review"
    email.assert_not_called()


def test_repeated_approval_preserves_shipping_status(client, product):
    response = checkout(client, (product, 1))
    order = Order.objects.get(pk=response.data["id"])
    order.status = "shipped"
    order.save(update_fields=["status"])
    Payment.objects.create(order=order, provider="transfer", amount=1000, status="approved")
    order.refresh_from_db()
    assert order.status == "shipped"
    order.status = "pending"
    with pytest.raises(ValidationError):
        order.save(update_fields=["status"])


def test_stale_model_instances_do_not_restore_twice(client, product):
    response = checkout(client, (product, 1))
    stale = Order.objects.get(pk=response.data["id"])
    cancel(client, stale.pk)
    stale.status = "cancelled"
    stale.save(update_fields=["status"])
    product.refresh_from_db()
    assert product.stock == 5


def test_model_form_rejects_reopening_cancelled_order(client, product):
    from django.forms import modelform_factory
    response = checkout(client, (product, 1))
    cancel(client, response.data["id"])
    order = Order.objects.get(pk=response.data["id"])
    form_class = modelform_factory(Order, fields=["status"])
    form = form_class({"status": "paid"}, instance=order)
    assert not form.is_valid()
    assert "status" in form.errors


def test_refund_of_paid_order_does_not_assume_physical_return(client, product):
    response = checkout(client, (product, 1))
    order = Order.objects.get(pk=response.data["id"])
    Payment.objects.create(order=order, provider="transfer", amount=1000, status="approved")
    order.refresh_from_db()
    order.status = "cancelled"
    order.save(update_fields=["status"])
    product.refresh_from_db()
    assert product.stock == 4


def test_rejecting_manual_payment_restores_pending_order_stock(client, product, buyer):
    response = checkout(client, (product, 1))
    order = Order.objects.get(pk=response.data["id"])
    payment = Payment.objects.create(order=order, provider="transfer", amount=1000)
    buyer.is_staff = True
    buyer.save(update_fields=["is_staff"])
    response = client.patch(f"/api/v1/admin/payments/{payment.pk}/status/", {"status": "rejected"}, format="json")
    assert response.status_code == 200
    product.refresh_from_db()
    order.refresh_from_db()
    assert product.stock == 5
    assert order.status == "cancelled"


def test_deleted_component_is_not_recreated_on_cancellation(client, product):
    response = checkout(client, (bundle(product), 1))
    product_id = product.pk
    product.delete()
    assert cancel(client, response.data["id"]).status_code == 200
    assert not Product.objects.filter(pk=product_id).exists()


def test_non_object_order_payload_returns_400(client):
    assert client.post("/api/v1/orders/", [], format="json").status_code == 400


def test_admin_notification_waits_for_commit(client, product, buyer, django_capture_on_commit_callbacks):
    response = checkout(client, (product, 1))
    order = Order.objects.get(pk=response.data["id"])
    buyer.is_staff = True
    buyer.save(update_fields=["is_staff"])
    with patch("apps.emails.send_order_status_update") as notify:
        with django_capture_on_commit_callbacks(execute=True) as callbacks:
            response = client.post(f"/api/v1/admin/orders/{order.pk}/update_status/", {"status": "cancelled"}, format="json")
            assert response.status_code == 200
            notify.assert_not_called()
        assert len(callbacks) == 1
        notify.assert_called_once()
