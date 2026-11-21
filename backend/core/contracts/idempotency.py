# backend/core/contracts/idempotency.py
"""
LEVELPRO OS V4.0 — GATE 1.4: BUSINESS CORE CONTRACTS
Contrato Transversal de Idempotencia y Concurrencia.
Previene el procesamiento duplicado de cobros, webhooks, canjes de puntos y órdenes.
Compatible con el cache compartido de base de datos (DatabaseCache) en Cloud Run.
"""

import hashlib
import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional

from django.core.cache import cache

logger = logging.getLogger("levelpro.contracts.idempotency")


class IdempotencyConflictError(Exception):
    """Lanzada cuando otra operación concurrente con la misma clave de idempotencia está en progreso."""
    pass


class IdempotencyExecutionError(Exception):
    """Lanzada cuando la operación protegida por idempotencia falla durante su ejecución."""
    pass


@dataclass(frozen=True)
class IdempotencyResult:
    """Resultado encapsulado de una ejecución idempotente."""
    result: Any
    replayed: bool
    key: str
    scope: str


class IdempotencyContractService:
    """
    Servicio de garantía de idempotencia transaccional.
    Gestiona los tres estados del ciclo de vida:
    1. IN_PROGRESS: Bloquea intentos concurrentes.
    2. COMPLETED: Almacena y reproduce la respuesta sin re-ejecutar lógica de negocio.
    3. FAILED: Limpia el bloqueo para permitir reintentos seguros tras errores transitorios.
    """

    CACHE_PREFIX = "idemp_v4"
    DEFAULT_TTL_SECONDS = 86400  # 24 horas

    @classmethod
    def _cache_key(cls, scope: str, key: str) -> str:
        digest = hashlib.sha256(f"{scope}:{key}".encode("utf-8")).hexdigest()
        return f"{cls.CACHE_PREFIX}:{scope}:{digest}"

    @classmethod
    def execute(
        cls,
        scope: str,
        idempotency_key: str,
        operation: Callable[[], Any],
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
        wait_timeout_seconds: float = 0.0,
    ) -> IdempotencyResult:
        """
        Ejecuta 'operation' con garantía de idempotencia estricta.
        Si la operación ya fue completada exitosamente, devuelve el resultado guardado con replayed=True.
        Si está en progreso y wait_timeout_seconds > 0, espera hasta que concluya; de lo contrario lanza IdempotencyConflictError.
        """
        if not idempotency_key or not str(idempotency_key).strip():
            # Si no se proporciona clave, ejecuta directamente sin cache
            return IdempotencyResult(result=operation(), replayed=False, key="", scope=scope)

        clean_key = str(idempotency_key).strip()
        cache_key = cls._cache_key(scope, clean_key)

        # 1. Comprobar si ya existe un resultado previo
        cached_entry = cache.get(cache_key)
        if cached_entry is not None:
            status = cached_entry.get("status")
            if status == "COMPLETED":
                logger.info("Idempotency replay: scope=%s key=%s", scope, clean_key)
                return IdempotencyResult(
                    result=cached_entry.get("data"),
                    replayed=True,
                    key=clean_key,
                    scope=scope,
                )
            elif status == "IN_PROGRESS":
                if wait_timeout_seconds > 0:
                    start_time = time.monotonic()
                    while time.monotonic() - start_time < wait_timeout_seconds:
                        time.sleep(0.2)
                        cached_entry = cache.get(cache_key)
                        if cached_entry and cached_entry.get("status") == "COMPLETED":
                            return IdempotencyResult(
                                result=cached_entry.get("data"),
                                replayed=True,
                                key=clean_key,
                                scope=scope,
                            )
                raise IdempotencyConflictError(
                    f"Operación concurrente en progreso para la clave de idempotencia '{clean_key}' en el alcance '{scope}'."
                )

        # 2. Adquirir bloqueo atómico en cache
        # cache.add retorna True solo si la clave no existía
        lock_acquired = cache.add(
            cache_key,
            {"status": "IN_PROGRESS", "created_at": time.time()},
            timeout=min(ttl_seconds, 300),  # El bloqueo temporal expira en 5 min si crashea el proceso
        )
        if not lock_acquired:
            raise IdempotencyConflictError(
                f"Carrera detectada: otra petición acaba de adquirir la clave de idempotencia '{clean_key}'."
            )

        # 3. Ejecutar la operación de negocio
        try:
            result_data = operation()
            # 4. Persistir resultado completado
            cache.set(
                cache_key,
                {"status": "COMPLETED", "data": result_data, "completed_at": time.time()},
                timeout=ttl_seconds,
            )
            return IdempotencyResult(
                result=result_data,
                replayed=False,
                key=clean_key,
                scope=scope,
            )
        except Exception as exc:
            # 5. En caso de error, limpiar el bloqueo para permitir reintento
            cache.delete(cache_key)
            logger.warning(
                "Idempotency operation failed; cleared lock: scope=%s key=%s error=%s",
                scope, clean_key, exc
            )
            raise
