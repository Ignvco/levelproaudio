# tests/test_loyalty_transactions_pagination.py
#
# Antes, my_loyalty() solo devolvía los últimos 10 movimientos, sin forma
# de ver el historial completo. Este endpoint nuevo pagina de verdad.

import pytest
from apps.users.models import User
from apps.loyalty.models import LoyaltyAccount, LoyaltyTransaction
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_transactions_endpoint_paginates_and_is_scoped_to_own_account():
    user_a = User.objects.create_user(email="a@test.com", username="a", password="x")
    user_b = User.objects.create_user(email="b@test.com", username="b", password="x")
    account_a = LoyaltyAccount.objects.create(user=user_a)
    account_b = LoyaltyAccount.objects.create(user=user_b)

    for i in range(25):
        LoyaltyTransaction.objects.create(account=account_a, tipo="earn", puntos=10, descripcion=f"tx {i}")
    LoyaltyTransaction.objects.create(account=account_b, tipo="earn", puntos=999, descripcion="de otro usuario")

    client = APIClient()
    client.force_authenticate(user=user_a)

    resp = client.get("/api/v1/loyalty/transactions/")
    assert resp.status_code == 200
    assert resp.data["count"] == 25          # todas las de user_a, ninguna de user_b
    assert len(resp.data["results"]) == 20    # página 1 (PAGE_SIZE=20)
    assert resp.data["next"] is not None

    resp_page2 = client.get(resp.data["next"])
    assert resp_page2.status_code == 200
    assert len(resp_page2.data["results"]) == 5
    assert resp_page2.data["next"] is None
