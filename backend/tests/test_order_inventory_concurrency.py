"""Conexiones y bloqueos PostgreSQL reales; SQLite omite estos casos explícitamente."""

from concurrent.futures import ThreadPoolExecutor
from queue import Queue
import time
from unittest.mock import patch

import pytest
from django.core.cache import cache
from django.db import close_old_connections, connection, connections, transaction
from rest_framework.test import APIClient

from apps.orders.models import Order
from apps.payments.models import Payment
from apps.products.models import Product, BundleItem
from apps.users.models import User


pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.skipif(connection.vendor != "postgresql", reason="Requiere PostgreSQL real (test_postgres)."),
]


@pytest.fixture
def data():
    cache.clear()
    user = User.objects.create_user(email="concurrency@test.com", username="concurrency", password="x")
    product = Product.objects.create(name="Última unidad", slug="last-unit", price=1000, stock=1)
    return user, product


def request_for(user):
    client = APIClient()
    client.force_authenticate(User.objects.get(pk=user.pk))
    return client


def purchase(user, *products):
    return request_for(user).post("/api/v1/orders/", {
        "items": [{"product": str(p.pk), "quantity": 1} for p in products],
        "shipping_address": "Test",
    }, format="json").status_code


def race(lock_rows, first, second):
    """Retiene filas hasta que ambas conexiones están esperando un lock real."""
    pids = Queue()
    def worker(action):
        close_old_connections()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SET lock_timeout = '8s'")
                cursor.execute("SET statement_timeout = '12s'")
                cursor.execute("SELECT pg_backend_pid()")
                pids.put(cursor.fetchone()[0])
            return action()
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        with transaction.atomic():
            lock_rows()
            futures = [pool.submit(worker, first), pool.submit(worker, second)]
            worker_pids = [pids.get(timeout=5), pids.get(timeout=5)]
            deadline = time.monotonic() + 5
            waiting = 0
            while time.monotonic() < deadline:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT pg_stat_clear_snapshot()")
                    cursor.execute(
                        "SELECT count(*) FROM pg_stat_activity WHERE pid = ANY(%s) AND wait_event_type = 'Lock'",
                        [worker_pids],
                    )
                    waiting = cursor.fetchone()[0]
                if waiting == 2:
                    break
                time.sleep(0.02)
            assert waiting == 2, "Ambas operaciones deben coincidir bajo bloqueo antes de liberarlo."
        return [future.result(timeout=15) for future in futures]


@pytest.mark.parametrize("kit", [False, True])
def test_only_one_checkout_can_buy_last_unit(data, kit):
    user, product = data
    target = product
    if kit:
        target = Product.objects.create(name="Kit", slug="last-unit-kit", price=1200, product_type="bundle")
        BundleItem.objects.create(bundle=target, component=product, quantity=1)
    results = race(
        lambda: Product.objects.select_for_update().get(pk=product.pk),
        lambda: purchase(user, target), lambda: purchase(user, product),
    )
    assert sorted(results) == [201, 400]
    product.refresh_from_db()
    assert product.stock == 0
    assert Order.objects.count() == 1


def test_carts_with_reverse_product_order_do_not_deadlock(data):
    user, product = data
    other = Product.objects.create(name="Segundo", slug="second", price=1000, stock=1)
    results = race(
        lambda: list(Product.objects.filter(pk__in=[product.pk, other.pk]).order_by("pk").select_for_update()),
        lambda: purchase(user, product, other), lambda: purchase(user, other, product),
    )
    assert sorted(results) == [201, 400]
    assert list(Product.objects.filter(pk__in=[product.pk, other.pk]).values_list("stock", flat=True)) == [0, 0]


def test_two_cancellations_restore_only_once(data):
    user, product = data
    assert purchase(user, product) == 201
    order = Order.objects.get()
    def cancel():
        return request_for(user).delete(f"/api/v1/orders/{order.pk}/").status_code
    results = race(lambda: Order.objects.select_for_update().get(pk=order.pk), cancel, cancel)
    assert sorted(results) == [200, 400]
    product.refresh_from_db()
    order.refresh_from_db()
    assert product.stock == 1
    assert order.status == "cancelled"


def test_payment_and_cancellation_never_release_stock_for_paid_order(data):
    user, product = data
    assert purchase(user, product) == 201
    order = Order.objects.get()
    payment = Payment.objects.create(order=order, provider="transfer", amount=1000)
    def approve():
        current = Payment.objects.get(pk=payment.pk)
        current.status = "approved"
        current.save(update_fields=["status"])
        return current.status
    def cancel():
        return request_for(user).delete(f"/api/v1/orders/{order.pk}/").status_code
    race(lambda: Order.objects.select_for_update().get(pk=order.pk), approve, cancel)
    order.refresh_from_db()
    payment.refresh_from_db()
    product.refresh_from_db()
    assert (order.status, payment.status, product.stock) in {
        ("paid", "approved", 0), ("cancelled", "in_review", 1),
    }


def test_admin_and_customer_cancellation_share_same_guard(data):
    user, product = data
    assert purchase(user, product) == 201
    order = Order.objects.get()
    admin = User.objects.create_superuser(email="stock-admin@test.com", username="stock-admin", password="x")
    def admin_cancel():
        return request_for(admin).post(f"/api/v1/admin/orders/{order.pk}/update_status/", {"status": "cancelled"}, format="json").status_code
    def cancel():
        return request_for(user).delete(f"/api/v1/orders/{order.pk}/").status_code
    with patch("apps.emails.send_order_status_update"):
        results = race(lambda: Order.objects.select_for_update().get(pk=order.pk), admin_cancel, cancel)
    assert results[0] == 200
    assert results[1] in (200, 400)
    product.refresh_from_db()
    assert product.stock == 1
