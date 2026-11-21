#!/usr/bin/env python3
"""
LEVELPRO OS V4.0 — Atomic Release Coordinator for Cloud Build.

Replaces unconditioned shell locking (`gsutil rm` + `gsutil cp`) and fragmented
release steps with a fail-closed, generation-conditioned distributed mutex
backed by Google Cloud Storage (`gcloud storage`) and active lease renewal.

Key safety guarantees:
1. All GCS lock creations, orphan recoveries, lease renewals, and releases use
   strict `if-generation-match` preconditions via `gcloud storage` (never
   `rm` before `cp`, never overwriting an unknown or newer owner).
2. Active lease heartbeat (`LeaseHeartbeater`) renews `expires_at` periodically
   while the release is running (>15 min builds never lose their lock) and
   aborts the active child process if ownership is lost or unreachable near TTL.
3. Every release stage (`update-migrator-job`, `run-migrations`, `deploy-backend`,
   `deploy-frontend`) explicitly checks live lock ownership and generation
   before executing (`verify_owned`), plus revalidates Cloud Run service SHA.
4. `finally` + POSIX signal handlers (`SIGTERM`/`SIGINT`) guarantee owner- and
   generation-verified lock release on success, failure, and cancellation.
5. Strictly fail-closed when `gcloud`, credentials, GCS bucket/API, Cloud Build
   status API, Cloud Run API, or Git history/ancestry cannot be verified.
"""

from __future__ import annotations

import datetime
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Tuple


DIGEST_REGEX = re.compile(r"^[a-zA-Z0-9._/-]+@sha256:[a-f0-9]{64}$")
COMMIT_SHA_REGEX = re.compile(r"^[a-fA-F0-9]{7,64}$")

TERMINAL_BUILD_STATUSES = {
    "SUCCESS",
    "FAILURE",
    "INTERNAL_ERROR",
    "TIMEOUT",
    "CANCELLED",
    "EXPIRED",
}
ACTIVE_BUILD_STATUSES = {
    "WORKING",
    "QUEUED",
    "PENDING",
    "STATUS_UNKNOWN",
}

_GCS_NOT_FOUND_RE = re.compile(
    r"(?:404|not\s+found|no\s+such\s+object|matched\s+no\s+objects)",
    re.IGNORECASE,
)
_GCS_PRECONDITION_RE = re.compile(
    r"(?:412|precondition|conditionnotmet|at\s+least\s+one\s+of\s+the\s+pre-conditions)",
    re.IGNORECASE,
)


class CoordinatorError(Exception):
    """Base error for release coordination."""


class ConfigurationError(CoordinatorError):
    """Raised when required pipeline environment configuration is invalid."""


class DigestValidationError(CoordinatorError):
    """Raised when an image digest is missing or mutable."""


class CoordinationBackendError(CoordinatorError):
    """Raised when CLI tools, credentials, or GCP APIs fail (fail-closed)."""


class LockAcquisitionTimeoutError(CoordinatorError):
    """Raised when mutual exclusion cannot be acquired within wait timeout."""


class LockOwnershipLostError(CoordinatorError):
    """Raised when the release lock is missing, expired, or stolen."""


class OutOfOrderReleaseError(CoordinatorError):
    """Raised when deploying a commit that regresses active production SHA."""


class GitHistoryError(CoordinatorError):
    """Raised when Git history cannot be inspected or unshallowed reliably."""


class ReleaseCancelledError(CoordinatorError):
    """Raised when SIGTERM/SIGINT cancels an active release."""


class DeploymentStageError(CoordinatorError):
    """Raised when migrator or Cloud Run deployment fails."""


def _log(msg: str) -> None:
    print(msg, flush=True)


def _err_log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def _parse_rfc3339(ts: str) -> float:
    cleaned = ts.strip()
    if cleaned.endswith("Z"):
        cleaned = cleaned[:-1] + "+00:00"
    # Normalize fractional seconds to 6 digits for broad Python compatibility.
    m = re.match(
        r"^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?$",
        cleaned,
    )
    if m:
        base, frac, tz = m.group(1), m.group(2), m.group(3) or "+00:00"
        if frac is not None:
            frac_norm = (frac + "000000")[:6]
            cleaned = f"{base}.{frac_norm}{tz}"
        else:
            cleaned = f"{base}{tz}"
    dt = datetime.datetime.fromisoformat(cleaned)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    return dt.timestamp()


def _opt_float(val: object) -> Optional[float]:
    if val is None or val == "":
        return None
    try:
        return float(val)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _opt_int(val: object) -> Optional[int]:
    if val is None or val == "":
        return None
    try:
        return int(float(val))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _resolve_executable(binary_name: str, label: str) -> str:
    if not binary_name:
        raise CoordinationBackendError(
            f"[FAIL_CLOSED] Ejecutable obligatorio no configurado para {label}."
        )
    if os.path.sep in binary_name:
        if os.path.isfile(binary_name) and os.access(binary_name, os.X_OK):
            return binary_name
        raise CoordinationBackendError(
            f"[FAIL_CLOSED] Ejecutable {label} no encontrado o sin permiso de ejecución: {binary_name}"
        )
    resolved = shutil.which(binary_name)
    if not resolved:
        raise CoordinationBackendError(
            f"[FAIL_CLOSED] Binario '{binary_name}' requerido para {label} no está disponible en PATH."
        )
    return resolved


def validate_immutable_digest(digest: str, service_label: str) -> str:
    cleaned = digest.strip()
    if not cleaned or not DIGEST_REGEX.match(cleaned):
        raise DigestValidationError(
            f"[DIGEST_ERROR] Digest inmutable inválido o ausente para {service_label}: {cleaned!r}. "
            "Formato requerido: imagen@sha256:<64_hex_chars>."
        )
    return cleaned


@dataclass(frozen=True)
class CoordinatorConfig:
    build_id: str
    commit_sha: str
    region: str
    backend_service: str
    frontend_service: str
    migrator_job: str
    sql_instance: str
    sa_email: str
    lock_bucket: str
    lock_object: str = "locks/release_coordinator.lock"
    ttl_seconds: int = 900
    renew_interval_seconds: int = 60
    wait_timeout_seconds: int = 600
    poll_interval_seconds: float = 5.0
    backend_digest_file: str = "/workspace/backend_digest.txt"
    frontend_digest_file: str = "/workspace/frontend_digest.txt"
    workspace_dir: str = "."
    storage_bin: str = "gcloud"
    control_plane_bin: str = "gcloud"
    clock_offset_file: str = ""
    allow_qa_mode: bool = False
    command_timeout_seconds: float = 60.0

    def __post_init__(self) -> None:
        if not self.build_id or (not self.allow_qa_mode and self.build_id.lower() == "local"):
            raise ConfigurationError(
                f"[CONFIG_ERROR] BUILD_ID obligatorio e inválido para release coordinado: {self.build_id!r}."
            )
        if not self.commit_sha or not COMMIT_SHA_REGEX.match(self.commit_sha):
            raise ConfigurationError(
                f"[CONFIG_ERROR] COMMIT_SHA inválido o ausente: {self.commit_sha!r}."
            )
        for field_name in (
            "region",
            "backend_service",
            "frontend_service",
            "migrator_job",
            "sql_instance",
            "sa_email",
            "lock_bucket",
            "lock_object",
        ):
            if not getattr(self, field_name):
                raise ConfigurationError(
                    f"[CONFIG_ERROR] Parámetro obligatorio '{field_name}' vacío."
                )
        if self.renew_interval_seconds < 1:
            raise ConfigurationError(
                "[CONFIG_ERROR] renew_interval_seconds debe ser >= 1."
            )
        if self.ttl_seconds < self.renew_interval_seconds * 3:
            raise ConfigurationError(
                f"[CONFIG_ERROR] ttl_seconds ({self.ttl_seconds}) debe ser >= 3x renew_interval_seconds ({self.renew_interval_seconds})."
            )
        if self.wait_timeout_seconds < 1:
            raise ConfigurationError(
                "[CONFIG_ERROR] wait_timeout_seconds debe ser >= 1."
            )
        if self.poll_interval_seconds <= 0:
            raise ConfigurationError(
                "[CONFIG_ERROR] poll_interval_seconds debe ser > 0."
            )

    @property
    def lock_uri(self) -> str:
        obj = self.lock_object.lstrip("/")
        return f"gs://{self.lock_bucket}/{obj}"

    @classmethod
    def from_env(cls) -> "CoordinatorConfig":
        allow_qa = os.environ.get("RELEASE_COORDINATOR_ALLOW_QA_MODE", "") == "1"
        clock_offset_file = (
            os.environ.get("RELEASE_LOCK_CLOCK_OFFSET_FILE", "").strip()
            if allow_qa
            else ""
        )
        return cls(
            build_id=os.environ.get("BUILD_ID", "").strip(),
            commit_sha=os.environ.get("COMMIT_SHA", "").strip(),
            region=os.environ.get("REGION", "").strip(),
            backend_service=os.environ.get("BACKEND_SERVICE", "").strip(),
            frontend_service=os.environ.get("FRONTEND_SERVICE", "").strip(),
            migrator_job=os.environ.get("MIGRATOR_JOB", "").strip(),
            sql_instance=os.environ.get("SQL_INSTANCE", "").strip(),
            sa_email=os.environ.get("SA_EMAIL", "").strip(),
            lock_bucket=os.environ.get("RELEASE_LOCK_BUCKET", "").strip(),
            lock_object=os.environ.get(
                "RELEASE_LOCK_OBJECT", "locks/release_coordinator.lock"
            )
            .strip()
            .lstrip("/"),
            ttl_seconds=int(os.environ.get("RELEASE_LOCK_TTL_SECONDS", "900")),
            renew_interval_seconds=int(
                os.environ.get("RELEASE_LOCK_RENEW_INTERVAL_SECONDS", "60")
            ),
            wait_timeout_seconds=int(
                os.environ.get("RELEASE_LOCK_WAIT_TIMEOUT_SECONDS", "600")
            ),
            poll_interval_seconds=float(
                os.environ.get("RELEASE_LOCK_POLL_INTERVAL_SECONDS", "5")
            ),
            backend_digest_file=os.environ.get(
                "BACKEND_DIGEST_FILE", "/workspace/backend_digest.txt"
            ).strip(),
            frontend_digest_file=os.environ.get(
                "FRONTEND_DIGEST_FILE", "/workspace/frontend_digest.txt"
            ).strip(),
            workspace_dir=os.path.abspath(
                os.environ.get("WORKSPACE_DIR", "").strip() or os.getcwd()
            ),
            storage_bin=(
                os.environ.get("GCLOUD_STORAGE_BIN", "gcloud").strip()
                if allow_qa
                else "gcloud"
            ),
            control_plane_bin=(
                os.environ.get("GCLOUD_CONTROL_PLANE_BIN", "gcloud").strip()
                if allow_qa
                else "gcloud"
            ),
            clock_offset_file=clock_offset_file,
            allow_qa_mode=allow_qa,
            command_timeout_seconds=float(
                os.environ.get("RELEASE_COMMAND_TIMEOUT_SECONDS", "60")
            ),
        )


@dataclass
class LockRecord:
    build_id: str
    lease_id: str
    commit_sha: str
    generation: str
    metageneration: str
    updated_epoch: float
    acquired_at: Optional[float]
    renewed_at: Optional[float]
    expires_at: Optional[float]
    lease_ttl_seconds: Optional[int]


class GCSReleaseLock:
    """
    Atomic generation-conditioned distributed mutex stored in Google Cloud Storage.

    Uses `gcloud storage` exclusively with strict `if-generation-match` preconditions
    for initial creation (`--if-generation-match=0`), orphan recovery, active renewal,
    and ownership-verified deletion (`--if-generation-match=<owned_gen>`).
    """

    def __init__(self, config: CoordinatorConfig) -> None:
        self.config = config
        self.build_id = config.build_id
        self.commit_sha = config.commit_sha
        self.lease_id = uuid.uuid4().hex
        self.lock_uri = config.lock_uri
        self.bucket_uri = f"gs://{config.lock_bucket}"
        self._state_lock = threading.RLock()
        self.lease_lost_event = threading.Event()

        self.owned_generation: Optional[str] = None
        self.acquired_at: Optional[float] = None
        self.expires_at: Optional[float] = None
        self.renewal_count: int = 0

        self._storage_bin: Optional[str] = None
        self._control_plane_bin: Optional[str] = None

    def now(self) -> float:
        base = time.time()
        offset_file = self.config.clock_offset_file
        if self.config.allow_qa_mode and offset_file and os.path.isfile(offset_file):
            try:
                with open(offset_file, "r", encoding="utf-8") as fh:
                    raw = fh.read().strip()
                if raw:
                    return base + float(raw)
            except (OSError, ValueError):
                pass
        return base

    def _run_cmd(
        self, cmd: List[str], timeout: Optional[float] = None
    ) -> subprocess.CompletedProcess[str]:
        effective_timeout = timeout or self.config.command_timeout_seconds
        try:
            return subprocess.run(
                cmd,
                text=True,
                capture_output=True,
                timeout=effective_timeout,
            )
        except subprocess.TimeoutExpired as exc:
            raise CoordinationBackendError(
                f"[FAIL_CLOSED] Timeout ({effective_timeout}s) ejecutando: {' '.join(cmd)}"
            ) from exc
        except OSError as exc:
            raise CoordinationBackendError(
                f"[FAIL_CLOSED] Error OS ejecutando {' '.join(cmd)}: {exc}"
            ) from exc

    def _ensure_bins(self) -> Tuple[str, str]:
        if self._storage_bin is None:
            self._storage_bin = _resolve_executable(
                self.config.storage_bin, "gcloud storage"
            )
        if self._control_plane_bin is None:
            self._control_plane_bin = _resolve_executable(
                self.config.control_plane_bin, "gcloud control-plane"
            )
        _resolve_executable("git", "git")
        return self._storage_bin, self._control_plane_bin

    def preflight(self) -> None:
        """Fail-closed validation of CLI availability, credentials, and lock bucket."""
        storage_bin, _ = self._ensure_bins()
        _log(
            f"[RELEASE_LOCK] Verificando acceso a bucket de coordinación {self.bucket_uri}..."
        )
        res = self._run_cmd(
            [storage_bin, "storage", "buckets", "describe", self.bucket_uri, "--format=json"]
        )
        if res.returncode != 0:
            detail = (res.stderr or res.stdout or "").strip()
            raise CoordinationBackendError(
                f"[FAIL_CLOSED] Servicio/bucket de coordinación GCS inaccesible o sin credenciales "
                f"({self.bucket_uri}): {detail}"
            )
        _log(f"[RELEASE_LOCK] ✓ Preflight GCS verificado en {self.bucket_uri}.")

    def read_lock(self) -> Optional[LockRecord]:
        """Reads current lock metadata and generation from GCS atomically."""
        storage_bin, _ = self._ensure_bins()
        res = self._run_cmd(
            [
                storage_bin,
                "storage",
                "objects",
                "describe",
                self.lock_uri,
                "--raw",
                "--format=json",
            ]
        )
        if res.returncode != 0:
            err_text = f"{res.stderr or ''}\n{res.stdout or ''}".strip()
            if _GCS_NOT_FOUND_RE.search(err_text):
                return None
            raise CoordinationBackendError(
                f"[FAIL_CLOSED] Error leyendo lock GCS {self.lock_uri}: {err_text}"
            )

        try:
            data = json.loads(res.stdout)
        except json.JSONDecodeError as exc:
            raise CoordinationBackendError(
                f"[FAIL_CLOSED] Respuesta JSON inválida desde {self.lock_uri}: {exc}"
            ) from exc

        gen = str(data.get("generation", "")).strip()
        if not gen or not gen.isdigit():
            raise CoordinationBackendError(
                f"[FAIL_CLOSED] Objeto lock sin generation válido en {self.lock_uri}: {gen!r}"
            )
        metagen = str(data.get("metageneration", "1")).strip() or "1"
        updated_str = str(data.get("updated") or data.get("timeCreated") or "").strip()
        if not updated_str:
            raise CoordinationBackendError(
                f"[FAIL_CLOSED] Objeto lock sin timestamp 'updated' en {self.lock_uri}."
            )
        try:
            updated_epoch = _parse_rfc3339(updated_str)
        except ValueError as exc:
            raise CoordinationBackendError(
                f"[FAIL_CLOSED] Timestamp 'updated' inválido en {self.lock_uri}: {updated_str!r}"
            ) from exc

        meta = data.get("metadata")
        if not isinstance(meta, dict):
            meta = data.get("custom_metadata")
        if not isinstance(meta, dict):
            meta = {}

        return LockRecord(
            build_id=str(meta.get("build_id", "")).strip(),
            lease_id=str(meta.get("lease_id", "")).strip(),
            commit_sha=str(meta.get("commit_sha", "")).strip(),
            generation=gen,
            metageneration=metagen,
            updated_epoch=updated_epoch,
            acquired_at=_opt_float(meta.get("acquired_at")),
            renewed_at=_opt_float(meta.get("renewed_at")),
            expires_at=_opt_float(meta.get("expires_at")),
            lease_ttl_seconds=_opt_int(meta.get("lease_ttl_seconds")),
        )

    def _write_conditional(
        self, expected_generation: str, acquired_at: float, now: float
    ) -> Optional[LockRecord]:
        """
        Atomically writes lock payload iff GCS generation == `expected_generation`.

        Returns the verified `LockRecord` on success, or `None` on HTTP 412
        PreconditionFailed (lost atomic race). Raises `CoordinationBackendError`
        on unexpected storage/auth/network errors (fail-closed).
        """
        storage_bin, _ = self._ensure_bins()
        expires_at = now + float(self.config.ttl_seconds)
        payload = {
            "build_id": self.build_id,
            "lease_id": self.lease_id,
            "commit_sha": self.commit_sha,
            "acquired_at": f"{acquired_at:.3f}",
            "renewed_at": f"{now:.3f}",
            "expires_at": f"{expires_at:.3f}",
            "lease_ttl_seconds": str(self.config.ttl_seconds),
            "expected_generation": expected_generation,
        }
        custom_meta = (
            f"build_id={self.build_id},"
            f"lease_id={self.lease_id},"
            f"commit_sha={self.commit_sha},"
            f"acquired_at={acquired_at:.3f},"
            f"renewed_at={now:.3f},"
            f"expires_at={expires_at:.3f},"
            f"lease_ttl_seconds={self.config.ttl_seconds}"
        )

        tmp_path = ""
        try:
            with tempfile.NamedTemporaryFile(
                "w", encoding="utf-8", suffix=".lock.json", delete=False
            ) as tf:
                json.dump(payload, tf, indent=2)
                tmp_path = tf.name

            cmd = [
                storage_bin,
                "storage",
                "cp",
                tmp_path,
                self.lock_uri,
                f"--if-generation-match={expected_generation}",
                "--content-type=application/json",
                f"--custom-metadata={custom_meta}",
            ]
            res = self._run_cmd(cmd)
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

        if res.returncode != 0:
            err_text = f"{res.stderr or ''}\n{res.stdout or ''}".strip()
            if _GCS_PRECONDITION_RE.search(err_text):
                return None
            raise CoordinationBackendError(
                f"[FAIL_CLOSED] Error ejecutando escritura condicional GCS (--if-generation-match={expected_generation}): {err_text}"
            )

        # Read back immediately to confirm generation transition and ownership.
        rec = self.read_lock()
        if (
            rec is None
            or rec.build_id != self.build_id
            or rec.lease_id != self.lease_id
            or rec.generation == expected_generation
        ):
            return None

        with self._state_lock:
            self.owned_generation = rec.generation
            self.acquired_at = acquired_at
            self.expires_at = rec.expires_at
        return rec

    def query_build_status(self, target_build_id: str) -> str:
        _, cp_bin = self._ensure_bins()
        res = self._run_cmd(
            [
                cp_bin,
                "builds",
                "describe",
                target_build_id,
                "--format=value(status)",
            ]
        )
        if res.returncode == 0:
            status = (res.stdout or "").strip().upper()
            if status:
                return status
            raise CoordinationBackendError(
                f"[FAIL_CLOSED] Respuesta vacía consultando estado de Cloud Build '{target_build_id}'."
            )

        err_text = f"{res.stderr or ''}\n{res.stdout or ''}".strip()
        if re.search(r"(?:404|not[\s_]?found)", err_text, re.IGNORECASE):
            return "NOT_FOUND"
        raise CoordinationBackendError(
            f"[FAIL_CLOSED] Error consultando Cloud Build API para '{target_build_id}': {err_text}"
        )

    def is_reclaimable(self, rec: LockRecord, now: float) -> Tuple[bool, str]:
        """Determines strictly whether an existing lock may be reclaimed atomically."""
        if rec.build_id:
            status = self.query_build_status(rec.build_id)
            if status in TERMINAL_BUILD_STATUSES:
                return (
                    True,
                    f"build propietario '{rec.build_id}' está en estado terminal '{status}'",
                )
            if status in ACTIVE_BUILD_STATUSES:
                return (
                    False,
                    f"build propietario '{rec.build_id}' sigue activo ('{status}')",
                )
            if status == "NOT_FOUND":
                if rec.expires_at is not None and now > rec.expires_at:
                    return (
                        True,
                        f"build '{rec.build_id}' no encontrado y TTL expirado ({now:.1f} > {rec.expires_at:.1f})",
                    )
                if rec.expires_at is None and now > rec.updated_epoch + float(
                    self.config.ttl_seconds
                ):
                    return (
                        True,
                        f"build '{rec.build_id}' no encontrado y metadata sin expires_at superó TTL",
                    )
                return (
                    False,
                    f"build '{rec.build_id}' no encontrado pero TTL sigue vigente",
                )
            raise CoordinationBackendError(
                f"[FAIL_CLOSED] Estado desconocido de Cloud Build '{status}' para '{rec.build_id}'."
            )

        # Corrupt lock without build_id metadata: only reclaim once fallback TTL elapsed.
        fallback_expiry = rec.expires_at or (
            rec.updated_epoch + float(self.config.ttl_seconds)
        )
        if now > fallback_expiry:
            return True, "objeto lock sin build_id superó TTL"
        return False, "objeto lock sin build_id aún dentro de TTL"

    def acquire(self) -> LockRecord:
        """Acquires exclusive lock via atomic generation preconditions."""
        start_mono = time.monotonic()
        wait_timeout = float(self.config.wait_timeout_seconds)
        poll_interval = float(self.config.poll_interval_seconds)

        _log(
            f"[RELEASE_LOCK] Solicitando lock exclusivo {self.lock_uri} "
            f"(build_id={self.build_id}, lease_id={self.lease_id}, ttl={self.config.ttl_seconds}s)..."
        )

        attempt = 0
        while True:
            attempt += 1
            now = self.now()
            current = self.read_lock()

            if current is None:
                rec = self._write_conditional("0", now, now)
                if rec is not None:
                    _log(
                        f"[RELEASE_LOCK] ✓ Lock adquirido (--if-generation-match=0 -> gen={rec.generation}, lease={self.lease_id})."
                    )
                    return rec
                _log(
                    "[RELEASE_LOCK] Conflicto 412 al crear lock (otro build ganó --if-generation-match=0). Reintentando..."
                )
            else:
                reclaimable, reason = self.is_reclaimable(current, now)
                if reclaimable:
                    _log(
                        f"[RELEASE_LOCK] ⚠️ Lock huérfano detectado en gen={current.generation} ({reason}). "
                        f"Intentando recuperación atómica --if-generation-match={current.generation}..."
                    )
                    rec = self._write_conditional(current.generation, now, now)
                    if rec is not None:
                        _log(
                            f"[RELEASE_LOCK] ✓ Lock recuperado atómicamente (gen {current.generation} -> {rec.generation}, lease={self.lease_id})."
                        )
                        return rec
                    _log(
                        f"[RELEASE_LOCK] Conflicto 412 recuperando gen={current.generation}: otro competidor ya reclamó el lock."
                    )
                else:
                    elapsed_mono = time.monotonic() - start_mono
                    _log(
                        f"[RELEASE_LOCK] Lock ocupado por build='{current.build_id}' gen={current.generation} "
                        f"({reason}) [intento {attempt}, {elapsed_mono:.1f}s/{wait_timeout:.0f}s]."
                    )

            elapsed_mono = time.monotonic() - start_mono
            if elapsed_mono >= wait_timeout:
                raise LockAcquisitionTimeoutError(
                    f"[RELEASE_LOCK] Timeout ({wait_timeout:.0f}s) esperando liberación del lock {self.lock_uri}."
                )
            remaining = wait_timeout - elapsed_mono
            time.sleep(min(poll_interval, remaining))

    def renew(self) -> LockRecord:
        """Extends TTL of the currently owned lock atomically by generation."""
        with self._state_lock:
            if self.owned_generation is None or self.acquired_at is None:
                raise LockOwnershipLostError(
                    "[HEARTBEAT] No existe una generación de lock activa para renovar."
                )
            expected_gen = self.owned_generation
            now = self.now()
            rec = self._write_conditional(expected_gen, self.acquired_at, now)
            if rec is None:
                self.owned_generation = None
                self.lease_lost_event.set()
                raise LockOwnershipLostError(
                    f"[HEARTBEAT] ❌ Precondition 412 o pérdida de propiedad al renovar gen={expected_gen}."
                )
            self.renewal_count += 1
            _log(
                f"[HEARTBEAT] ✓ Lock renovado (#{self.renewal_count}: gen {expected_gen} -> {rec.generation}, "
                f"expires_at={rec.expires_at:.1f})."
            )
            return rec

    def verify_owned(self, stage: str) -> LockRecord:
        """Strictly asserts that this build still owns an unexpired lock in GCS."""
        with self._state_lock:
            if self.lease_lost_event.is_set() or self.owned_generation is None:
                raise LockOwnershipLostError(
                    f"[{stage}] Abortando: no se posee un lock válido (owned_generation={self.owned_generation})."
                )
            expected_gen = self.owned_generation
            live = self.read_lock()
            now = self.now()

            if live is None:
                self.owned_generation = None
                self.lease_lost_event.set()
                raise LockOwnershipLostError(
                    f"[{stage}] Abortando: el objeto lock desapareció de GCS."
                )
            if (
                live.build_id != self.build_id
                or live.lease_id != self.lease_id
                or live.generation != expected_gen
            ):
                self.owned_generation = None
                self.lease_lost_event.set()
                raise LockOwnershipLostError(
                    f"[{stage}] Abortando: propiedad del lock cambió "
                    f"(esperado build={self.build_id}, lease={self.lease_id}, gen={expected_gen}; "
                    f"actual build={live.build_id}, lease={live.lease_id}, gen={live.generation})."
                )
            if live.expires_at is None or now >= live.expires_at:
                self.owned_generation = None
                self.lease_lost_event.set()
                raise LockOwnershipLostError(
                    f"[{stage}] Abortando: lock expirado (now={now:.1f} >= expires_at={live.expires_at})."
                )
            return live

    def release(self) -> bool:
        """Releases the lock only if owned by this exact build, lease, and generation."""
        with self._state_lock:
            if self.owned_generation is None:
                return False
            expected_gen = self.owned_generation
            storage_bin, _ = self._ensure_bins()

            try:
                live = self.read_lock()
            except CoordinationBackendError as exc:
                self.owned_generation = None
                _err_log(
                    f"[RELEASE_LOCK] ⚠️ Error consultando lock antes de liberar gen={expected_gen}: {exc}"
                )
                raise

            if live is None:
                self.owned_generation = None
                _log("[RELEASE_LOCK] Objeto lock ya no existe al momento de liberar.")
                return False

            if (
                live.build_id != self.build_id
                or live.lease_id != self.lease_id
                or live.generation != expected_gen
            ):
                self.owned_generation = None
                _err_log(
                    "[RELEASE_LOCK] ❌ Bloqueo de liberación insegura: el lock actual pertenece a otro propietario/generación "
                    f"(actual build={live.build_id}, lease={live.lease_id}, gen={live.generation}; "
                    f"propio build={self.build_id}, lease={self.lease_id}, gen={expected_gen}). No se elimina."
                )
                return False

            res = self._run_cmd(
                [
                    storage_bin,
                    "storage",
                    "rm",
                    self.lock_uri,
                    f"--if-generation-match={expected_gen}",
                ]
            )
            self.owned_generation = None

            if res.returncode == 0:
                _log(
                    f"[RELEASE_LOCK] ✓ Lock liberado atómicamente (--if-generation-match={expected_gen})."
                )
                return True

            err_text = f"{res.stderr or ''}\n{res.stdout or ''}".strip()
            if _GCS_PRECONDITION_RE.search(err_text) or _GCS_NOT_FOUND_RE.search(err_text):
                _err_log(
                    f"[RELEASE_LOCK] ⚠️ Precondición 412/404 protegió el lock durante liberación: {err_text}"
                )
                return False
            raise CoordinationBackendError(
                f"[FAIL_CLOSED] Error eliminando lock GCS (--if-generation-match={expected_gen}): {err_text}"
            )


class LeaseHeartbeater:
    """Background daemon that renews an active GCS lease until stopped."""

    def __init__(
        self,
        lock: GCSReleaseLock,
        renew_interval_seconds: int,
        on_lease_lost: Callable[[], None],
    ) -> None:
        self._lock = lock
        self._renew_interval = max(1, int(renew_interval_seconds))
        self._on_lease_lost = on_lease_lost
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        if self._thread is not None:
            return
        self._thread = threading.Thread(
            target=self._run_loop, name="release-lease-heartbeat", daemon=True
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread is not None and self._thread.is_alive():
            self._thread.join(timeout=max(5.0, float(self._renew_interval) + 2.0))

    def _run_loop(self) -> None:
        wait_time = float(self._renew_interval)
        while not self._stop_event.wait(wait_time):
            try:
                self._lock.renew()
                wait_time = float(self._renew_interval)
            except LockOwnershipLostError as exc:
                _err_log(f"[HEARTBEAT] ❌ Propiedad perdida: {exc}")
                self._on_lease_lost()
                return
            except CoordinationBackendError as exc:
                _err_log(f"[HEARTBEAT] ⚠️ Error transitorio renovando lease: {exc}")
                expires_at = self._lock.expires_at or 0.0
                safety_margin = max(2.0, float(self._renew_interval))
                if self._lock.now() >= expires_at - safety_margin:
                    _err_log(
                        "[HEARTBEAT] ❌ Imposible renovar antes de margen de expiración; abortando por seguridad."
                    )
                    self._lock.lease_lost_event.set()
                    self._on_lease_lost()
                    return
                wait_time = min(5.0, max(0.5, float(self._renew_interval) / 2.0))


class GitHistoryValidator:
    """
    Validates forward-only release ancestry with safe.directory and shallow-clone unshallowing.
    """

    def __init__(self, workspace_dir: str, timeout_seconds: float = 60.0) -> None:
        self.workspace_dir = os.path.abspath(workspace_dir)
        self.timeout_seconds = timeout_seconds

    def _run_git(self, *git_args: str) -> subprocess.CompletedProcess[str]:
        cmd = [
            "git",
            "-C",
            self.workspace_dir,
            "-c",
            f"safe.directory={self.workspace_dir}",
            *git_args,
        ]
        try:
            return subprocess.run(
                cmd,
                text=True,
                capture_output=True,
                timeout=self.timeout_seconds,
            )
        except subprocess.TimeoutExpired as exc:
            raise GitHistoryError(
                f"[GIT_ERROR] Timeout ejecutando {' '.join(cmd)}"
            ) from exc
        except OSError as exc:
            raise GitHistoryError(f"[GIT_ERROR] Error ejecutando git: {exc}") from exc

    def _commit_exists(self, sha: str) -> bool:
        res = self._run_git("cat-file", "-e", f"{sha}^{{commit}}")
        return res.returncode == 0

    def _ensure_repository_and_commits(self, commits: List[str]) -> None:
        # Best-effort global safe.directory registration (ignore read-only HOME).
        try:
            subprocess.run(
                ["git", "config", "--global", "--add", "safe.directory", self.workspace_dir],
                text=True,
                capture_output=True,
                timeout=10,
            )
        except OSError:
            pass

        inside = self._run_git("rev-parse", "--is-inside-work-tree")
        if inside.returncode != 0 or inside.stdout.strip().lower() != "true":
            raise GitHistoryError(
                f"[GIT_ERROR] El directorio '{self.workspace_dir}' no es un repositorio Git válido: "
                f"{inside.stderr.strip()}"
            )

        missing = [sha for sha in commits if sha and not self._commit_exists(sha)]
        if not missing:
            return

        shallow_res = self._run_git("rev-parse", "--is-shallow-repository")
        is_shallow = shallow_res.returncode == 0 and shallow_res.stdout.strip().lower() == "true"
        if is_shallow:
            _log(
                f"[RELEASE_GUARD] Repositorio shallow detectado con commits ausentes ({missing}). "
                "Ejecutando 'git fetch --unshallow origin'..."
            )
            unshallow_res = self._run_git("fetch", "--unshallow", "--no-tags", "origin")
            if unshallow_res.returncode != 0:
                _err_log(
                    f"[RELEASE_GUARD] Aviso en --unshallow: {unshallow_res.stderr.strip()}. "
                    "Intentando fetch explícito de objetos faltantes..."
                )
                self._run_git("fetch", "--no-tags", "origin", *missing)
        else:
            _log(
                f"[RELEASE_GUARD] Faltan commits locales ({missing}). Intentando 'git fetch origin'..."
            )
            self._run_git("fetch", "--no-tags", "origin", *missing)

        still_missing = [sha for sha in commits if sha and not self._commit_exists(sha)]
        if still_missing:
            raise GitHistoryError(
                f"[GIT_ERROR] Fail-closed: no se pudo resolver el historial completo de commits en '{self.workspace_dir}'. "
                f"Commits faltantes: {still_missing}. Verificar profundidad del clone o acceso al remoto."
            )

    def verify_ancestor(self, active_commit: str, target_commit: str) -> None:
        if not active_commit or active_commit == target_commit:
            _log("[RELEASE_GUARD] ✓ Servicio inicial o re-despliegue del mismo commit.")
            return

        if not COMMIT_SHA_REGEX.match(active_commit):
            raise GitHistoryError(
                f"[GIT_ERROR] Label commit-sha activo en producción tiene formato inválido: {active_commit!r}."
            )

        self._ensure_repository_and_commits([active_commit, target_commit])

        _log(f"[RELEASE_GUARD] Commit en producción activa: {active_commit}")
        _log(f"[RELEASE_GUARD] Commit en este pipeline:     {target_commit}")
        ancestry = self._run_git("merge-base", "--is-ancestor", active_commit, target_commit)
        if ancestry.returncode == 0:
            _log("[RELEASE_GUARD] ✓ Avance válido hacia adelante (ancestro verificado).")
            return
        if ancestry.returncode == 1:
            raise OutOfOrderReleaseError(
                f"[RELEASE_GUARD] ❌ ALERTA: Despliegue fuera de orden detectado. "
                f"El commit activo en producción ({active_commit}) no es ancestro del commit objetivo ({target_commit}). "
                "Abortando para prevenir regresión de código o esquema."
            )
        raise GitHistoryError(
            f"[GIT_ERROR] Error ejecutando 'git merge-base --is-ancestor' (rc={ancestry.returncode}): "
            f"{ancestry.stderr.strip()}"
        )


class ReleaseCoordinator:
    """Orchestrates the full critical section under an atomic GCS lease."""

    def __init__(self, config: CoordinatorConfig) -> None:
        self.config = config
        self.lock = GCSReleaseLock(config)
        self.git_validator = GitHistoryValidator(
            config.workspace_dir, timeout_seconds=config.command_timeout_seconds
        )
        self.cancelled_event = threading.Event()
        self._child_lock = threading.RLock()
        self._active_child: Optional[subprocess.Popen[str]] = None
        self._in_cleanup = False

    def _terminate_active_child(self) -> None:
        with self._child_lock:
            proc = self._active_child
            if proc is None or proc.poll() is not None:
                return
            _err_log(f"[COORDINATOR] Terminando subproceso activo (pid={proc.pid})...")
            try:
                proc.terminate()
            except OSError:
                return
            try:
                proc.wait(timeout=3.0)
            except subprocess.TimeoutExpired:
                _err_log(f"[COORDINATOR] Forzando SIGKILL a subproceso (pid={proc.pid})...")
                try:
                    proc.kill()
                    proc.wait(timeout=2.0)
                except OSError:
                    pass

    def _on_lease_lost(self) -> None:
        self._terminate_active_child()

    def _install_signal_handlers(self) -> Dict[int, object]:
        if threading.current_thread() is not threading.main_thread():
            return {}
        previous: Dict[int, object] = {}

        def _handler(signum: int, _frame: object) -> None:
            sig_name = signal.Signals(signum).name
            _err_log(f"[COORDINATOR] ⚠️ Señal {sig_name} recibida; cancelando release de forma segura...")
            self.cancelled_event.set()
            proc = self._active_child
            if proc is not None and proc.poll() is None:
                try:
                    proc.terminate()
                except OSError:
                    pass
            if not self._in_cleanup:
                raise ReleaseCancelledError(
                    f"[COORDINATOR] Release cancelado por señal {sig_name}."
                )

        for sig in (signal.SIGTERM, signal.SIGINT):
            previous[sig] = signal.getsignal(sig)
            signal.signal(sig, _handler)
        return previous

    @staticmethod
    def _restore_signal_handlers(previous: Dict[int, object]) -> None:
        for sig, handler in previous.items():
            try:
                signal.signal(sig, handler)  # type: ignore[arg-type]
            except (ValueError, OSError):
                pass

    def _read_digest_file(self, path: str, label: str) -> str:
        if not path or not os.path.isfile(path):
            raise DigestValidationError(
                f"[DIGEST_ERROR] Archivo de digest requerido no existe para {label}: {path}"
            )
        with open(path, "r", encoding="utf-8") as fh:
            raw = fh.read().strip()
        return validate_immutable_digest(raw, label)

    def _control_plane(self) -> str:
        _, cp_bin = self.lock._ensure_bins()
        return cp_bin

    def get_active_service_commit(self, service_name: str) -> str:
        cp_bin = self._control_plane()
        res = self.lock._run_cmd(
            [
                cp_bin,
                "run",
                "services",
                "describe",
                service_name,
                f"--region={self.config.region}",
                '--format=value(metadata.labels["commit-sha"])',
            ]
        )
        if res.returncode != 0:
            err_text = f"{res.stderr or ''}\n{res.stdout or ''}".strip()
            if re.search(
                r"(?:not\s+found|404|cannot\s+find\s+service|does\s+not\s+exist)",
                err_text,
                re.IGNORECASE,
            ):
                return ""
            raise CoordinationBackendError(
                f"[FAIL_CLOSED] Error consultando servicio Cloud Run '{service_name}': {err_text}"
            )
        return (res.stdout or "").strip()

    def _run_interruptible(self, cmd: List[str], stage_name: str) -> None:
        if self.cancelled_event.is_set():
            raise ReleaseCancelledError(
                f"[{stage_name}] Release cancelado antes de iniciar."
            )
        self.lock.verify_owned(stage_name)

        _log(f"[{stage_name}] Ejecutando: {' '.join(cmd)}")
        proc = subprocess.Popen(cmd, text=True)
        with self._child_lock:
            self._active_child = proc

        try:
            while True:
                rc = proc.poll()
                if self.cancelled_event.is_set():
                    self._terminate_active_child()
                    raise ReleaseCancelledError(
                        f"[{stage_name}] Ejecución interrumpida por cancelación."
                    )
                if self.lock.lease_lost_event.is_set():
                    self._terminate_active_child()
                    raise LockOwnershipLostError(
                        f"[{stage_name}] Ejecución abortada por pérdida del lock de coordinación."
                    )
                if rc is not None:
                    if rc != 0:
                        raise DeploymentStageError(
                            f"[{stage_name}] Falló con exit code {rc}."
                        )
                    return
                time.sleep(0.2)
        finally:
            with self._child_lock:
                self._active_child = None

    def update_migrator_job(self, backend_digest: str) -> None:
        digest = validate_immutable_digest(backend_digest, "migrador")
        cp_bin = self._control_plane()
        self._run_interruptible(
            [
                cp_bin,
                "run",
                "jobs",
                "update",
                self.config.migrator_job,
                f"--image={digest}",
                f"--region={self.config.region}",
            ],
            "update-migrator-job",
        )

    def run_migrations(self) -> None:
        cp_bin = self._control_plane()
        self._run_interruptible(
            [
                cp_bin,
                "run",
                "jobs",
                "execute",
                self.config.migrator_job,
                f"--region={self.config.region}",
                "--wait",
            ],
            "run-migrations",
        )

    def deploy_backend(self, backend_digest: str, base_commit: str) -> None:
        digest = validate_immutable_digest(backend_digest, "backend")
        self.lock.verify_owned("deploy-backend")

        if base_commit:
            _log("[DEPLOY_GUARD] Revalidando versión activa de backend inmediatamente antes de desplegar...")
            pre_deploy_commit = self.get_active_service_commit(self.config.backend_service)
            if (
                pre_deploy_commit
                and pre_deploy_commit != base_commit
                and pre_deploy_commit != self.config.commit_sha
            ):
                _log(
                    f"[DEPLOY_GUARD] ⚠️ Versión activa cambió a '{pre_deploy_commit}' durante migraciones."
                )
                self.git_validator.verify_ancestor(pre_deploy_commit, self.config.commit_sha)

        cp_bin = self._control_plane()
        cmd = [
            cp_bin,
            "run",
            "deploy",
            self.config.backend_service,
            f"--image={digest}",
            f"--region={self.config.region}",
            "--platform=managed",
            "--allow-unauthenticated",
            f"--set-labels=commit-sha={self.config.commit_sha}",
            "--port=8080",
            "--memory=512Mi",
            "--cpu=1",
            "--min-instances=1",
            "--max-instances=5",
            f"--service-account={self.config.sa_email}",
            f"--set-cloudsql-instances={self.config.sql_instance}",
            "--set-env-vars=DJANGO_SETTINGS_MODULE=config.settings.production",
            f"--set-env-vars=CLOUD_SQL_CONNECTION_NAME={self.config.sql_instance}",
            "--set-env-vars=FRONTEND_URL=https://levelproaudio.com",
            "--set-env-vars=SITE_URL=https://levelproaudio.com",
            "--set-env-vars=BACKEND_URL=https://levelproaudio.com",
            "--set-env-vars=PAYPAL_MODE=live",
            "--set-env-vars=USD_CLP_RATE=950",
            "--update-secrets=DJANGO_SECRET_KEY=DJANGO_SECRET_KEY:latest",
            "--update-secrets=SECRET_KEY=DJANGO_SECRET_KEY:latest",
            "--update-secrets=DB_NAME=DB_NAME:latest",
            "--update-secrets=DB_USER=DB_USER:latest",
            "--update-secrets=DB_PASSWORD=DB_PASSWORD:latest",
            "--update-secrets=GCS_BUCKET_NAME=levelproaudio-gcs-bucket:latest",
            "--update-secrets=GCS_PROJECT_ID=levelproaudio-gcs-project:latest",
            "--update-secrets=DJANGO_ALLOWED_HOSTS=DJANGO_ALLOWED_HOSTS:latest",
            "--update-secrets=MP_CL_ACCESS_TOKEN=MP_CL_ACCESS_TOKEN:latest",
            "--update-secrets=MP_CL_PUBLIC_KEY=MP_CL_PUBLIC_KEY:latest",
            "--update-secrets=MP_CL_WEBHOOK_SECRET=MP_CL_WEBHOOK_SECRET:latest",
            "--update-secrets=PAYPAL_CLIENT_ID=PAYPAL_CLIENT_ID:latest",
            "--update-secrets=PAYPAL_CLIENT_SECRET=PAYPAL_CLIENT_SECRET:latest",
            "--update-secrets=UALA_USERNAME=UALA_USERNAME:latest",
            "--update-secrets=UALA_CLIENT_ID=UALA_CLIENT_ID:latest",
            "--update-secrets=UALA_CLIENT_SECRET=UALA_CLIENT_SECRET:latest",
            "--set-env-vars=RESEND_FROM_EMAIL=LevelPro Audio <no-responder@levelproaudio.com>",
            "--update-secrets=RESEND_API_KEY=RESEND_API_KEY:latest",
        ]
        self._run_interruptible(cmd, "deploy-backend")

    def deploy_frontend(self, frontend_digest: str) -> None:
        digest = validate_immutable_digest(frontend_digest, "frontend")
        self.lock.verify_owned("deploy-frontend")

        _log(
            f"[DEPLOY_FRONTEND] Verificando que backend activo corresponda a {self.config.commit_sha}..."
        )
        backend_active_sha = self.get_active_service_commit(self.config.backend_service)
        if backend_active_sha != self.config.commit_sha:
            raise DeploymentStageError(
                f"[DEPLOY_FRONTEND] Backend activo ('{backend_active_sha}') no coincide con release "
                f"actual ('{self.config.commit_sha}'). Abortando despliegue frontend."
            )

        cp_bin = self._control_plane()
        cmd = [
            cp_bin,
            "run",
            "deploy",
            self.config.frontend_service,
            f"--image={digest}",
            f"--region={self.config.region}",
            "--platform=managed",
            "--allow-unauthenticated",
            f"--set-labels=commit-sha={self.config.commit_sha}",
            "--port=8080",
            "--memory=256Mi",
            "--cpu=1",
            "--min-instances=0",
            "--max-instances=3",
            f"--service-account={self.config.sa_email}",
        ]
        self._run_interruptible(cmd, "deploy-frontend")

    def run(self) -> None:
        prev_signals = self._install_signal_handlers()
        heartbeater: Optional[LeaseHeartbeater] = None
        try:
            backend_digest = self._read_digest_file(
                self.config.backend_digest_file, "backend"
            )
            frontend_digest = self._read_digest_file(
                self.config.frontend_digest_file, "frontend"
            )

            self.lock.preflight()
            self.lock.acquire()

            heartbeater = LeaseHeartbeater(
                self.lock,
                renew_interval_seconds=self.config.renew_interval_seconds,
                on_lease_lost=self._on_lease_lost,
            )
            heartbeater.start()

            base_commit = self.get_active_service_commit(self.config.backend_service)
            self.git_validator.verify_ancestor(base_commit, self.config.commit_sha)

            self.update_migrator_job(backend_digest)
            self.run_migrations()
            self.deploy_backend(backend_digest, base_commit)
            self.deploy_frontend(frontend_digest)

            _log(
                f"[COORDINATOR] ✓ Release completo finalizado exitosamente para commit {self.config.commit_sha}."
            )
        finally:
            self._in_cleanup = True
            self._terminate_active_child()
            if heartbeater is not None:
                heartbeater.stop()
            try:
                self.lock.release()
            except Exception as release_exc:
                _err_log(
                    f"[RELEASE_LOCK] ⚠️ Error al liberar lock durante cleanup: {release_exc}"
                )
            self._restore_signal_handlers(prev_signals)


def main() -> int:
    try:
        config = CoordinatorConfig.from_env()
        coordinator = ReleaseCoordinator(config)
        coordinator.run()
        return 0
    except CoordinatorError as exc:
        _err_log(str(exc))
        return 1
    except Exception as exc:
        _err_log(f"[COORDINATOR_FATAL] Error inesperado: {exc!r}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
