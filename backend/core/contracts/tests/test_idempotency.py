# backend/core/contracts/tests/test_idempotency.py
"""
LEVELPRO OS V4.0 — GATE 1.4: PRUEBAS DEL CONTRATO DE IDEMPOTENCIA
Verifica:
- Ejecución idempotente con reproducción de respuestas (replayed=True).
- Detección de colisiones y bloqueo de peticiones concurrentes (IdempotencyConflictError).
- Limpieza de bloqueo tras fallas transitorias para permitir reintentos.
- Compatibilidad multi-instancia vía cache.
"""

import pytest
from core.contracts.idempotency import (
    IdempotencyConflictError,
    IdempotencyContractService,
    IdempotencyResult,
)


def test_idempotent_first_execution_and_replay():
    call_count = 0

    def sample_business_operation():
        nonlocal call_count
        call_count += 1
        return {"status": "success", "order_id": "test-order-123", "call_number": call_count}

    key = "idem-test-key-001"
    scope = "checkout"

    # 1. Primera ejecución: debe ejecutar la función
    res1 = IdempotencyContractService.execute(scope, key, sample_business_operation)
    assert isinstance(res1, IdempotencyResult)
    assert res1.replayed is False
    assert res1.result["call_number"] == 1
    assert call_count == 1

    # 2. Segunda ejecución idéntica: debe devolver el resultado previo sin re-ejecutar
    res2 = IdempotencyContractService.execute(scope, key, sample_business_operation)
    assert res2.replayed is True
    assert res2.result["call_number"] == 1
    assert call_count == 1  # La función NO se volvió a llamar


def test_concurrent_execution_raises_conflict():
    from django.core.cache import cache

    key = "idem-conflict-key"
    scope = "payment_charge"

    # Simular que otra instancia puso la clave en estado IN_PROGRESS
    cache_key = IdempotencyContractService._cache_key(scope, key)
    cache.set(cache_key, {"status": "IN_PROGRESS"}, timeout=60)

    def dummy():
        return "ok"

    with pytest.raises(IdempotencyConflictError, match="en progreso"):
        IdempotencyContractService.execute(scope, key, dummy)


def test_failed_operation_clears_lock_for_retry():
    fail_flag = True
    calls = 0

    def flaky_operation():
        nonlocal calls
        calls += 1
        if fail_flag:
            raise RuntimeError("Falla transitoria de red con el proveedor de pagos")
        return {"status": "recovered"}

    key = "idem-retry-key"
    scope = "webhook"

    # 1. Intento fallido
    with pytest.raises(RuntimeError, match="Falla transitoria"):
        IdempotencyContractService.execute(scope, key, flaky_operation)
    assert calls == 1

    # 2. Reintento una vez recuperado el servicio
    fail_flag = False
    res = IdempotencyContractService.execute(scope, key, flaky_operation)
    assert res.replayed is False
    assert res.result["status"] == "recovered"
    assert calls == 2


def test_empty_key_bypasses_cache():
    calls = 0

    def op():
        nonlocal calls
        calls += 1
        return calls

    res1 = IdempotencyContractService.execute("scope", "", op)
    res2 = IdempotencyContractService.execute("scope", "", op)

    assert res1.result == 1
    assert res2.result == 2
    assert calls == 2
