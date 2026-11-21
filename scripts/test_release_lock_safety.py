#!/usr/bin/env python3
"""
LEVELPRO OS V4.0 — Comprehensive Isolated QA Suite for Release Lock & Pipeline Safety.

Executes the REAL `scripts/release_coordinator.py` and REAL `/usr/local/bin/gcloud storage`
binary over HTTP against the linearizable GCS JSON API v1 emulator (`gcs_emulator.py`),
plus REAL `/usr/bin/git` on temporary bare/shallow clones and a concurrency-safe
Cloud Build / Cloud Run control-plane test shim.
"""

from __future__ import annotations

import contextlib
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
import urllib.error
import urllib.request
from typing import Any, Dict, Iterator, List, Optional, Tuple


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, SCRIPT_DIR)
sys.path.insert(0, os.path.join(SCRIPT_DIR, "tests"))

import release_coordinator as rc  # noqa: E402
from gcs_emulator import GSEmulatorServer  # noqa: E402


VALID_BACKEND_DIGEST = (
    "us-central1-docker.pkg.dev/levelproaudio/levelproaudio-docker/backend"
    "@sha256:1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff"
)
VALID_FRONTEND_DIGEST = (
    "us-central1-docker.pkg.dev/levelproaudio/levelproaudio-docker/frontend"
    "@sha256:aaaabbbbccccddddeeeeffff1111222233334444555566667777888899990000"
)
LOCK_BUCKET = "qa-lock-bucket"
LOCK_OBJECT = "locks/release_coordinator.lock"


CONTROL_PLANE_SHIM_CODE = r'''#!/usr/bin/env python3
"""Concurrency-safe mock shim for `gcloud builds` and `gcloud run`."""
import fcntl
import json
import os
import sys
import time


STATE_FILE = os.environ["MOCK_CP_STATE_FILE"]


def mutate_state(fn):
    lock_path = STATE_FILE + ".flock"
    with open(lock_path, "w", encoding="utf-8") as lfh:
        fcntl.flock(lfh.fileno(), fcntl.LOCK_EX)
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as fh:
                state = json.load(fh)
            res = fn(state)
            tmp = STATE_FILE + ".tmp"
            with open(tmp, "w", encoding="utf-8") as fh:
                json.dump(state, fh, indent=2)
            os.replace(tmp, STATE_FILE)
            return res
        finally:
            fcntl.flock(lfh.fileno(), fcntl.LOCK_UN)


def read_state():
    lock_path = STATE_FILE + ".flock"
    with open(lock_path, "w", encoding="utf-8") as lfh:
        fcntl.flock(lfh.fileno(), fcntl.LOCK_SH)
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as fh:
                return json.load(fh)
        finally:
            fcntl.flock(lfh.fileno(), fcntl.LOCK_UN)


def log_event(event):
    def _add(st):
        st.setdefault("events", []).append(event)
    mutate_state(_add)


def main():
    args = sys.argv[1:]
    build_caller = os.environ.get("BUILD_ID", "unknown")

    if len(args) >= 3 and args[0] == "builds" and args[1] == "describe":
        target_id = args[2]
        st = read_state()
        err = st.get("faults", {}).get("builds_describe_error")
        if err:
            print(err, file=sys.stderr)
            return 1
        status = st.get("builds", {}).get(target_id)
        if status is None:
            print(f"ERROR: (gcloud.builds.describe) NOT_FOUND: Build {target_id} not found.", file=sys.stderr)
            return 1
        print(status)
        return 0

    if len(args) >= 4 and args[0] == "run" and args[1] == "services" and args[2] == "describe":
        svc = args[3]
        st = read_state()
        err = st.get("faults", {}).get("services_describe_error")
        if err:
            print(err, file=sys.stderr)
            return 1
        commit = st.get("services", {}).get(svc, {}).get("commit_sha")
        if commit is None:
            print(f"ERROR: (gcloud.run.services.describe) NOT_FOUND: Cannot find service [{svc}].", file=sys.stderr)
            return 1
        print(commit)
        return 0

    if len(args) >= 4 and args[0] == "run" and args[1] == "jobs" and args[2] == "update":
        job = args[3]
        image = next((a.split("=", 1)[1] for a in args if a.startswith("--image=")), "")
        st = read_state()
        log_event({
            "stage": "update-migrator-job",
            "build_id": build_caller,
            "job": job,
            "image": image,
            "t_start": time.time(),
            "t_end": time.time(),
        })
        if st.get("faults", {}).get("update_migrator_fail"):
            print("ERROR: failed updating migrator job", file=sys.stderr)
            return 1
        return 0

    if len(args) >= 4 and args[0] == "run" and args[1] == "jobs" and args[2] == "execute":
        job = args[3]
        st = read_state()
        delay = float(st.get("delays", {}).get(f"run_migrations:{build_caller}", st.get("delays", {}).get("run_migrations", 0)))
        t0 = time.time()
        log_event({
            "stage": "run-migrations:start",
            "build_id": build_caller,
            "job": job,
            "t": t0,
        })
        if delay > 0:
            time.sleep(delay)
        st = read_state()
        t1 = time.time()
        should_fail = bool(st.get("faults", {}).get(f"migration_fail:{build_caller}", st.get("faults", {}).get("migration_fail", False)))
        log_event({
            "stage": "run-migrations",
            "build_id": build_caller,
            "job": job,
            "t_start": t0,
            "t_end": t1,
            "ok": not should_fail,
        })
        if should_fail:
            print("ERROR: (gcloud.run.jobs.execute) migration SQL failure", file=sys.stderr)
            return 1
        return 0

    if len(args) >= 3 and args[0] == "run" and args[1] == "deploy":
        svc = args[2]
        image = next((a.split("=", 1)[1] for a in args if a.startswith("--image=")), "")
        labels = next((a.split("=", 1)[1] for a in args if a.startswith("--set-labels=")), "")
        commit_sha = ""
        for part in labels.split(","):
            if part.startswith("commit-sha="):
                commit_sha = part.split("=", 1)[1]
        st = read_state()
        delay = float(st.get("delays", {}).get(f"deploy:{svc}:{build_caller}", 0))
        t0 = time.time()
        if delay > 0:
            time.sleep(delay)
        t1 = time.time()

        def _apply(s):
            fail_key = f"deploy_fail:{svc}:{build_caller}"
            if s.get("faults", {}).get(fail_key) or s.get("faults", {}).get(f"deploy_fail:{svc}"):
                s.setdefault("events", []).append({
                    "stage": f"deploy:{svc}",
                    "build_id": build_caller,
                    "service": svc,
                    "image": image,
                    "commit_sha": commit_sha,
                    "t_start": t0,
                    "t_end": t1,
                    "ok": False,
                })
                return False
            s.setdefault("services", {})[svc] = {
                "image": image,
                "commit_sha": commit_sha,
            }
            s.setdefault("events", []).append({
                "stage": f"deploy:{svc}",
                "build_id": build_caller,
                "service": svc,
                "image": image,
                "commit_sha": commit_sha,
                "t_start": t0,
                "t_end": t1,
                "ok": True,
            })
            return True

        ok = mutate_state(_apply)
        if not ok:
            print(f"ERROR: (gcloud.run.deploy) simulated deploy failure for {svc}", file=sys.stderr)
            return 1
        return 0

    print(f"Unsupported control-plane mock invocation: {args}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
'''


@contextlib.contextmanager
def _scoped_env(env_dict: Dict[str, str]) -> Iterator[None]:
    """Temporarily sets process env vars for in-process gcloud/shim execution."""
    old = os.environ.copy()
    os.environ.update(env_dict)
    try:
        yield
    finally:
        os.environ.clear()
        os.environ.update(old)


def _git(cwd: str, *args: str) -> str:
    res = subprocess.run(
        ["git", "-C", cwd, *args],
        text=True,
        capture_output=True,
        check=True,
    )
    return res.stdout.strip()


def setup_git_history(tmp_dir: str, num_commits: int = 3) -> Tuple[str, str, List[str]]:
    """Creates a local bare origin and working clone with linear commit chain."""
    bare = os.path.join(tmp_dir, "origin.git")
    work = os.path.join(tmp_dir, "work")
    subprocess.run(["git", "init", "--bare", "-b", "main", bare], check=True, capture_output=True)
    subprocess.run(["git", "clone", bare, work], check=True, capture_output=True)
    _git(work, "config", "user.email", "qa@levelproaudio.com")
    _git(work, "config", "user.name", "QA Runner")

    commits: List[str] = []
    for i in range(1, num_commits + 1):
        fpath = os.path.join(work, "version.txt")
        with open(fpath, "w", encoding="utf-8") as fh:
            fh.write(f"v{i}\n")
        _git(work, "add", "version.txt")
        _git(work, "commit", "-m", f"release v{i}")
        commits.append(_git(work, "rev-parse", "HEAD"))

    _git(work, "push", "origin", "main")
    return bare, work, commits


class QAHarness:
    def __init__(self, srv: GSEmulatorServer) -> None:
        self.tmp = tempfile.mkdtemp(prefix="levelpro_lock_qa_")
        self.srv = srv
        self.cp_state_file = os.path.join(self.tmp, "cp_state.json")
        self.cp_shim_path = os.path.join(self.tmp, "mock_gcloud_cp")
        self.gcloud_cfg = os.path.join(self.tmp, "gcloud_cfg")
        self.backend_digest_file = os.path.join(self.tmp, "backend_digest.txt")
        self.frontend_digest_file = os.path.join(self.tmp, "frontend_digest.txt")
        self.clock_offset_file = os.path.join(self.tmp, "clock_offset.txt")

        os.makedirs(self.gcloud_cfg, exist_ok=True)
        with open(self.cp_shim_path, "w", encoding="utf-8") as fh:
            fh.write(CONTROL_PLANE_SHIM_CODE)
        os.chmod(self.cp_shim_path, 0o755)
        with open(self.backend_digest_file, "w", encoding="utf-8") as fh:
            fh.write(VALID_BACKEND_DIGEST + "\n")
        with open(self.frontend_digest_file, "w", encoding="utf-8") as fh:
            fh.write(VALID_FRONTEND_DIGEST + "\n")
        self.set_clock_offset(0.0)
        self.write_cp_state({"builds": {}, "services": {}, "faults": {}, "delays": {}, "events": []})

    def cleanup(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)

    def write_cp_state(self, state: Dict[str, Any]) -> None:
        with open(self.cp_state_file, "w", encoding="utf-8") as fh:
            json.dump(state, fh, indent=2)

    def read_cp_state(self) -> Dict[str, Any]:
        with open(self.cp_state_file, "r", encoding="utf-8") as fh:
            return json.load(fh)

    def update_cp_state(self, mutator) -> None:
        st = self.read_cp_state()
        mutator(st)
        self.write_cp_state(st)

    def set_clock_offset(self, seconds: float) -> None:
        with open(self.clock_offset_file, "w", encoding="utf-8") as fh:
            fh.write(f"{seconds}\n")

    def get_clock_offset(self) -> float:
        try:
            with open(self.clock_offset_file, "r", encoding="utf-8") as fh:
                return float(fh.read().strip() or 0)
        except OSError:
            return 0.0

    def build_env(
        self,
        build_id: str,
        commit_sha: str,
        workspace_dir: str,
        ttl: int = 12,
        renew_interval: int = 2,
        wait_timeout: int = 30,
        poll_interval: float = 0.3,
        extra: Optional[Dict[str, str]] = None,
    ) -> Dict[str, str]:
        env = os.environ.copy()
        env.update(
            {
                "RELEASE_COORDINATOR_ALLOW_QA_MODE": "1",
                "BUILD_ID": build_id,
                "COMMIT_SHA": commit_sha,
                "REGION": "us-central1",
                "BACKEND_SERVICE": "levelproaudio-backend",
                "FRONTEND_SERVICE": "levelproaudio-frontend",
                "MIGRATOR_JOB": "levelproaudio-migrator-job",
                "SQL_INSTANCE": "levelproaudio:us-central1:levelproaudio-db",
                "SA_EMAIL": "levelproaudio-app@levelproaudio.iam.gserviceaccount.com",
                "RELEASE_LOCK_BUCKET": LOCK_BUCKET,
                "RELEASE_LOCK_OBJECT": LOCK_OBJECT,
                "RELEASE_LOCK_TTL_SECONDS": str(ttl),
                "RELEASE_LOCK_RENEW_INTERVAL_SECONDS": str(renew_interval),
                "RELEASE_LOCK_WAIT_TIMEOUT_SECONDS": str(wait_timeout),
                "RELEASE_LOCK_POLL_INTERVAL_SECONDS": str(poll_interval),
                "BACKEND_DIGEST_FILE": self.backend_digest_file,
                "FRONTEND_DIGEST_FILE": self.frontend_digest_file,
                "WORKSPACE_DIR": workspace_dir,
                "GCLOUD_STORAGE_BIN": shutil.which("gcloud") or "/usr/local/bin/gcloud",
                "GCLOUD_CONTROL_PLANE_BIN": self.cp_shim_path,
                "MOCK_CP_STATE_FILE": self.cp_state_file,
                "RELEASE_LOCK_CLOCK_OFFSET_FILE": self.clock_offset_file,
                "CLOUDSDK_CONFIG": self.gcloud_cfg,
                "CLOUDSDK_AUTH_DISABLE_CREDENTIALS": "1",
                "CLOUDSDK_API_ENDPOINT_OVERRIDES_STORAGE": self.srv.endpoint_url,
            }
        )
        if extra:
            env.update(extra)
        return env

    def spawn_coordinator(self, env: Dict[str, str]) -> subprocess.Popen[str]:
        return subprocess.Popen(
            [sys.executable, os.path.join(SCRIPT_DIR, "release_coordinator.py")],
            env=env,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

    def wait_for_stage(self, stage_name: str, timeout: float = 45.0) -> None:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if any(e.get("stage") == stage_name for e in self.read_cp_state().get("events", [])):
                return
            time.sleep(0.15)
        raise AssertionError(f"Timeout ({timeout}s) esperando etapa '{stage_name}'")


def test_01_concurrent_lock_acquisition() -> None:
    print("\n[TEST 1/9] Dos builds concurrentes compitiendo por el mismo lock...")
    with GSEmulatorServer([LOCK_BUCKET]) as srv:
        qa = QAHarness(srv)
        try:
            _, repo, commits = setup_git_history(qa.tmp, 3)
            c1, c2, c3 = commits
            qa.write_cp_state(
                {
                    "builds": {"build-1": "WORKING", "build-2": "WORKING"},
                    "services": {"levelproaudio-backend": {"commit_sha": c1, "image": "old"}},
                    "faults": {},
                    "delays": {"run_migrations:build-1": 2.5, "run_migrations:build-2": 0.5},
                    "events": [],
                }
            )

            env1 = qa.build_env("build-1", c2, repo, ttl=30, renew_interval=3, wait_timeout=120, poll_interval=0.5)
            env2 = qa.build_env("build-2", c2, repo, ttl=30, renew_interval=3, wait_timeout=120, poll_interval=0.5)

            p1 = qa.spawn_coordinator(env1)
            p2 = qa.spawn_coordinator(env2)

            out1, err1 = p1.communicate(timeout=180)
            out2, err2 = p2.communicate(timeout=180)

            assert p1.returncode == 0, f"build-1 falló: {out1}\n{err1}"
            assert p2.returncode == 0, f"build-2 falló: {out2}\n{err2}"

            st = qa.read_cp_state()
            b1_events = [e for e in st["events"] if e["build_id"] == "build-1"]
            b2_events = [e for e in st["events"] if e["build_id"] == "build-2"]
            b1_start = min(e.get("t_start", e.get("t")) for e in b1_events)
            b1_end = max(e.get("t_end", e.get("t")) for e in b1_events)
            b2_start = min(e.get("t_start", e.get("t")) for e in b2_events)
            b2_end = max(e.get("t_end", e.get("t")) for e in b2_events)

            assert b1_end <= b2_start or b2_end <= b1_start, (
                f"SOLAPAMIENTO DE SECCIÓN CRÍTICA DETECTADO: b1=({b1_start},{b1_end}) b2=({b2_start},{b2_end})"
            )

            # Assert real HTTP 412 conflict occurred and all mutating GCS requests carried ifGenerationMatch.
            uploads = [a for a in srv.state.audit_log if a.operation == "object_upload"]
            deletes = [a for a in srv.state.audit_log if a.operation == "object_delete"]
            assert any(u.if_generation_match == "0" and u.status_code == 200 for u in uploads), "Falta create con ifGenerationMatch=0"
            assert any(u.if_generation_match == "0" and u.status_code == 412 for u in uploads), (
                f"Debió observarse rechazo HTTP 412 real en competencia inicial: {[(u.if_generation_match, u.status_code) for u in uploads]}"
            )
            assert all(u.if_generation_match is not None for u in uploads), "Upload sin ifGenerationMatch!"
            assert all(d.if_generation_match is not None for d in deletes), "Delete sin ifGenerationMatch!"
            assert srv.state.get_object_snapshot(LOCK_BUCKET, LOCK_OBJECT) is None, "Lock debió quedar libre"
            print("  ✓ Exclusión mutua verificada con HTTP 412 real y cero solapamiento en sección crítica.")
        finally:
            qa.cleanup()


def test_02_orphan_recovery_race_no_overwrite() -> None:
    print("\n[TEST 2/9] Recuperación de lock huérfano con carrera determinística (sin sobrescribir nuevo propietario)...")
    with GSEmulatorServer([LOCK_BUCKET]) as srv:
        qa = QAHarness(srv)
        try:
            _, repo, commits = setup_git_history(qa.tmp, 3)
            c1, c2, c3 = commits
            qa.write_cp_state(
                {
                    "builds": {
                        "dead-build": "FAILURE",
                        "recover-1": "WORKING",
                        "recover-2": "WORKING",
                    },
                    "services": {"levelproaudio-backend": {"commit_sha": c1, "image": "old"}},
                    "faults": {},
                    "delays": {"run_migrations:recover-1": 1.0, "run_migrations:recover-2": 0.5},
                    "events": [],
                }
            )
            # Seed orphan lock at G1 owned by FAILED dead-build.
            seeded = srv.state.seed_object(
                LOCK_BUCKET,
                LOCK_OBJECT,
                json.dumps({"build_id": "dead-build"}).encode("utf-8"),
                metadata={
                    "build_id": "dead-build",
                    "lease_id": "dead-lease",
                    "commit_sha": c1,
                    "acquired_at": str(time.time() - 30),
                    "renewed_at": str(time.time() - 30),
                    "expires_at": str(time.time() + 600),
                    "lease_ttl_seconds": "900",
                },
            )
            g_orphan = str(seeded.generation)

            # Force BOTH competitors to attempt CAS against G1 at the exact same instant!
            barrier = threading.Barrier(2, timeout=15)
            hook_lock = threading.Lock()
            barrier_used = False

            def race_hook(_st, _b, _o, if_gen_match, _meta):
                nonlocal barrier_used
                if if_gen_match == g_orphan:
                    with hook_lock:
                        already = barrier_used
                    if not already:
                        barrier.wait()
                        with hook_lock:
                            barrier_used = True

            srv.state.before_upload_commit_hook = race_hook

            env1 = qa.build_env("recover-1", c2, repo, ttl=35, renew_interval=3, wait_timeout=120, poll_interval=0.5)
            env2 = qa.build_env("recover-2", c2, repo, ttl=35, renew_interval=3, wait_timeout=120, poll_interval=0.5)

            p1 = qa.spawn_coordinator(env1)
            p2 = qa.spawn_coordinator(env2)

            out1, err1 = p1.communicate(timeout=180)
            out2, err2 = p2.communicate(timeout=180)
            assert p1.returncode == 0, f"recover-1 falló: {out1}\n{err1}"
            assert p2.returncode == 0, f"recover-2 falló: {out2}\n{err2}"

            orphan_cas_attempts = [
                a for a in srv.state.audit_log
                if a.operation == "object_upload" and a.if_generation_match == g_orphan
            ]
            winners = [a for a in orphan_cas_attempts if a.status_code == 200]
            losers = [a for a in orphan_cas_attempts if a.status_code == 412]
            assert len(winners) == 1, f"Debió existir exactamente 1 ganador de G1: {orphan_cas_attempts}"
            assert len(losers) == 1, f"El segundo competidor debió recibir HTTP 412 en G1: {orphan_cas_attempts}"

            # Crucial assertion: ZERO DELETE requests executed prior to first takeover (no rm+cp)!
            first_winner_idx = srv.state.audit_log.index(winners[0])
            deletes_before_takeover = [
                a for a in srv.state.audit_log[:first_winner_idx] if a.operation == "object_delete"
            ]
            assert len(deletes_before_takeover) == 0, "Se detectó DELETE antes de recuperación atómica!"
            print(f"  ✓ Carrera atómica en gen={g_orphan}: 1 ganador (200), 1 rechazado (412), 0 DELETEs en recuperación.")
        finally:
            qa.cleanup()


def test_03_active_build_over_15_minutes() -> None:
    print("\n[TEST 3/9] Build activo >15 minutos (renovación HTTP real + reloj controlado >900s)...")
    # 3a: Live multi-process HTTP renewal exceeding initial TTL
    with GSEmulatorServer([LOCK_BUCKET]) as srv:
        qa = QAHarness(srv)
        try:
            _, repo, commits = setup_git_history(qa.tmp, 3)
            c1, c2, c3 = commits
            qa.write_cp_state(
                {
                    "builds": {"long-build": "WORKING", "challenger-build": "WORKING"},
                    "services": {"levelproaudio-backend": {"commit_sha": c1, "image": "old"}},
                    "faults": {},
                    "delays": {"run_migrations:long-build": 25.0, "run_migrations:challenger-build": 0.2},
                    "events": [],
                }
            )
            env1 = qa.build_env("long-build", c2, repo, ttl=18, renew_interval=2, wait_timeout=120, poll_interval=0.5)
            p1 = qa.spawn_coordinator(env1)

            qa.wait_for_stage("run-migrations:start", timeout=45.0)
            init_snap = srv.state.get_object_snapshot(LOCK_BUCKET, LOCK_OBJECT)
            assert init_snap is not None
            init_exp = float(init_snap.metadata["expires_at"])

            # Sleep strictly past initial expires_at so expiry would occur without active heartbeat renewal
            while time.time() < init_exp + 1.5:
                time.sleep(0.25)

            assert p1.poll() is None, "long-build debía seguir ejecutándose al superar el TTL inicial"
            snap_during = srv.state.get_object_snapshot(LOCK_BUCKET, LOCK_OBJECT)
            assert snap_during is not None and snap_during.metadata.get("build_id") == "long-build"
            assert float(snap_during.metadata["expires_at"]) > time.time(), "expires_at debía estar renovado por delante del reloj"

            env2 = qa.build_env("challenger-build", c3, repo, ttl=25, renew_interval=3, wait_timeout=120, poll_interval=0.5)
            p2 = qa.spawn_coordinator(env2)

            out1, err1 = p1.communicate(timeout=180)
            out2, err2 = p2.communicate(timeout=180)
            assert p1.returncode == 0, f"long-build falló: {out1}\n{err1}"
            assert p2.returncode == 0, f"challenger-build falló: {out2}\n{err2}"

            st = qa.read_cp_state()
            long_end = max(e.get("t_end", e.get("t")) for e in st["events"] if e["build_id"] == "long-build")
            chal_start = min(e.get("t_start", e.get("t")) for e in st["events"] if e["build_id"] == "challenger-build")
            assert long_end <= chal_start, "Challenger irrumpió antes de terminar long-build!"

            long_renews = [
                a for a in srv.state.audit_log
                if a.operation == "object_upload"
                and a.owner_after == "long-build"
                and a.if_generation_match != "0"
                and a.status_code == 200
            ]
            assert len(long_renews) >= 3, f"Se esperaban >=3 renovaciones HTTP atómicas, observadas {len(long_renews)}"
        finally:
            qa.cleanup()

    # 3b: Exact 900s (15 min) TTL with deterministic clock offset advancing past 900s to 1080s
    clock_box = {"offset": 0.0}
    with GSEmulatorServer([LOCK_BUCKET], clock_fn=lambda: time.time() + clock_box["offset"]) as srv:
        qa = QAHarness(srv)
        try:
            _, repo, commits = setup_git_history(qa.tmp, 2)
            c1, c2 = commits
            qa.write_cp_state(
                {
                    "builds": {"active-15m": "WORKING", "competitor": "WORKING"},
                    "services": {},
                    "faults": {},
                    "delays": {},
                    "events": [],
                }
            )
            env_a = qa.build_env("active-15m", c2, repo, ttl=900, renew_interval=60, wait_timeout=30, poll_interval=0.5)
            with _scoped_env(env_a):
                cfg_a = rc.CoordinatorConfig.from_env()
                cfg_b = rc.CoordinatorConfig(**{**cfg_a.__dict__, "build_id": "competitor"})

                lock_a = rc.GCSReleaseLock(cfg_a)
                lock_b = rc.GCSReleaseLock(cfg_b)

                lock_a.preflight()
                rec0 = lock_a.acquire()
                assert rec0.expires_at is not None

                # Advance clock to t+500s and renew (new expires_at = +1400s)
                clock_box["offset"] = 500.0
                qa.set_clock_offset(500.0)
                rec1 = lock_a.renew()
                assert rec1.expires_at > lock_a.now()

                # Advance past original 900s TTL (to 16 min = 960s), verify owned & not reclaimable!
                clock_box["offset"] = 960.0
                qa.set_clock_offset(960.0)
                lock_a.verify_owned("mid-migration-16m")
                live_from_b = lock_b.read_lock()
                assert live_from_b is not None
                reclaimable, _ = lock_b.is_reclaimable(live_from_b, lock_b.now())
                assert not reclaimable, "Lock activo no debe ser reclamable en minuto 16"

                # Advance to 18 min = 1080s, renew again and complete release
                clock_box["offset"] = 1080.0
                qa.set_clock_offset(1080.0)
                rec2 = lock_a.renew()
                assert rec2.expires_at > lock_a.now()
                lock_a.verify_owned("deploy-frontend-18m")
                assert lock_a.release() is True
            print("  ✓ Renovación continua HTTP verificada y TTL 900s sostenido hasta minuto 18 sin expiración.")
        finally:
            qa.cleanup()


def test_04_failures_cancellation_and_crash() -> None:
    print("\n[TEST 4/9] Fallo, cancelación SIGTERM y crash duro SIGKILL en sección crítica...")
    # 4a & 4b: Failure in migration & failure in backend deploy
    for fault_name, build_id in [("migration_fail", "fail-mig"), ("deploy_fail:levelproaudio-backend", "fail-be")]:
        with GSEmulatorServer([LOCK_BUCKET]) as srv:
            qa = QAHarness(srv)
            try:
                _, repo, commits = setup_git_history(qa.tmp, 2)
                c1, c2 = commits
                qa.write_cp_state(
                    {
                        "builds": {build_id: "WORKING"},
                        "services": {"levelproaudio-backend": {"commit_sha": c1, "image": "old"}},
                        "faults": {fault_name: True},
                        "delays": {},
                        "events": [],
                    }
                )
                env = qa.build_env(build_id, c2, repo, ttl=35, renew_interval=5)
                p = qa.spawn_coordinator(env)
                out, err = p.communicate(timeout=90)
                assert p.returncode != 0, f"{build_id} debió fallar: {out}\n{err}"
                st = qa.read_cp_state()
                deploys_fe = [e for e in st["events"] if e["stage"] == "deploy:levelproaudio-frontend"]
                assert len(deploys_fe) == 0, f"Frontend se desplegó tras {fault_name}!"
                assert srv.state.get_object_snapshot(LOCK_BUCKET, LOCK_OBJECT) is None, (
                    f"Lock no fue liberado tras {fault_name}!"
                )
            finally:
                qa.cleanup()

    # 4c: SIGTERM cancellation during active migration -> child terminated, 0 deploys, lock deleted cleanly
    with GSEmulatorServer([LOCK_BUCKET]) as srv:
        qa = QAHarness(srv)
        try:
            _, repo, commits = setup_git_history(qa.tmp, 2)
            c1, c2 = commits
            qa.write_cp_state(
                {
                    "builds": {"cancel-me": "WORKING"},
                    "services": {"levelproaudio-backend": {"commit_sha": c1, "image": "old"}},
                    "faults": {},
                    "delays": {"run_migrations:cancel-me": 15.0},
                    "events": [],
                }
            )
            env = qa.build_env("cancel-me", c2, repo, ttl=30, renew_interval=4)
            p = qa.spawn_coordinator(env)

            qa.wait_for_stage("run-migrations:start", timeout=45.0)

            os.kill(p.pid, signal.SIGTERM)
            out, err = p.communicate(timeout=40)
            assert p.returncode != 0, "SIGTERM debía salir con error"
            st = qa.read_cp_state()
            assert not any(e["stage"].startswith("deploy:") for e in st["events"]), "No debió desplegar tras SIGTERM"
            assert srv.state.get_object_snapshot(LOCK_BUCKET, LOCK_OBJECT) is None, "SIGTERM debió liberar el lock GCS"
        finally:
            qa.cleanup()

    # 4d: Hard SIGKILL + TIMEOUT recovery by subsequent build
    with GSEmulatorServer([LOCK_BUCKET]) as srv:
        qa = QAHarness(srv)
        try:
            _, repo, commits = setup_git_history(qa.tmp, 3)
            c1, c2, c3 = commits
            qa.write_cp_state(
                {
                    "builds": {"killed-build": "WORKING", "recovery-build": "WORKING"},
                    "services": {"levelproaudio-backend": {"commit_sha": c1, "image": "old"}},
                    "faults": {},
                    "delays": {"run_migrations:killed-build": 6.0},
                    "events": [],
                }
            )
            env1 = qa.build_env("killed-build", c2, repo, ttl=30, renew_interval=5)
            p1 = qa.spawn_coordinator(env1)
            qa.wait_for_stage("run-migrations:start", timeout=45.0)
            os.kill(p1.pid, signal.SIGKILL)
            p1.wait(timeout=5)
            for pipe in (p1.stdout, p1.stderr):
                if pipe is not None:
                    pipe.close()

            orphan = srv.state.get_object_snapshot(LOCK_BUCKET, LOCK_OBJECT)
            assert orphan is not None and orphan.metadata.get("build_id") == "killed-build"
            orphan_gen = str(orphan.generation)

            # Cloud Build transitions crashed/timed-out build to TIMEOUT
            qa.update_cp_state(lambda s: s["builds"].__setitem__("killed-build", "TIMEOUT"))

            env2 = qa.build_env("recovery-build", c3, repo, ttl=30, renew_interval=5, wait_timeout=60)
            p2 = qa.spawn_coordinator(env2)
            out2, err2 = p2.communicate(timeout=90)
            assert p2.returncode == 0, f"recovery-build falló: {out2}\n{err2}"
            assert any(
                a.operation == "object_upload" and a.if_generation_match == orphan_gen and a.status_code == 200
                for a in srv.state.audit_log
            ), "No se usó CAS --if-generation-match=<orphan_gen> para recuperar TIMEOUT"
            assert srv.state.get_object_snapshot(LOCK_BUCKET, LOCK_OBJECT) is None
            print("  ✓ Fallos, SIGTERM y recuperación tras SIGKILL/TIMEOUT liberaron/reclamaron el lock atómicamente.")
        finally:
            qa.cleanup()


def test_05_fail_closed_missing_cli_creds_and_api_errors() -> None:
    print("\n[TEST 5/9] Ausencia de gcloud/gsutil, credenciales y errores de API (fail-closed)...")
    with GSEmulatorServer([LOCK_BUCKET]) as srv:
        qa = QAHarness(srv)
        try:
            _, repo, commits = setup_git_history(qa.tmp, 2)
            c1, c2 = commits
            empty_path = os.path.join(qa.tmp, "empty_bin")
            os.makedirs(empty_path, exist_ok=True)
            empty_cfg = os.path.join(qa.tmp, "empty_cfg")
            os.makedirs(empty_cfg, exist_ok=True)

            # 5a: Missing CLI binary
            qa.write_cp_state({"builds": {"b5a": "WORKING"}, "services": {"levelproaudio-backend": {"commit_sha": c1}}, "faults": {}, "delays": {}, "events": []})
            env_a = qa.build_env("b5a", c2, repo, extra={"GCLOUD_STORAGE_BIN": "nonexistent_gcloud_bin", "PATH": empty_path})
            pa = qa.spawn_coordinator(env_a)
            pa.communicate(timeout=20)
            assert pa.returncode != 0
            assert qa.read_cp_state()["events"] == []

            # 5b: Missing credentials
            qa.write_cp_state({"builds": {"b5b": "WORKING"}, "services": {"levelproaudio-backend": {"commit_sha": c1}}, "faults": {}, "delays": {}, "events": []})
            env_b = qa.build_env("b5b", c2, repo, extra={"CLOUDSDK_AUTH_DISABLE_CREDENTIALS": "0", "CLOUDSDK_CONFIG": empty_cfg, "RELEASE_COMMAND_TIMEOUT_SECONDS": "15"})
            pb = qa.spawn_coordinator(env_b)
            pb.communicate(timeout=30)
            assert pb.returncode != 0
            assert qa.read_cp_state()["events"] == []

            # 5c: GCS bucket 403 & 500
            for code, reason in [(403, "forbidden"), (500, "internalError")]:
                srv.state.fault_rules["bucket_get"] = (code, reason, f"Injected GCS {code}")
                qa.write_cp_state({"builds": {"b5c": "WORKING"}, "services": {"levelproaudio-backend": {"commit_sha": c1}}, "faults": {}, "delays": {}, "events": []})
                env_c = qa.build_env("b5c", c2, repo, extra={"RELEASE_COMMAND_TIMEOUT_SECONDS": "10"})
                pc = qa.spawn_coordinator(env_c)
                pc.communicate(timeout=25)
                assert pc.returncode != 0
                assert qa.read_cp_state()["events"] == []
            srv.state.fault_rules.pop("bucket_get", None)

            # 5d: Seeded lock + Cloud Build API error -> MUST NOT steal lock!
            seeded = srv.state.seed_object(
                LOCK_BUCKET,
                LOCK_OBJECT,
                b"{}",
                metadata={"build_id": "other-build", "lease_id": "other-lease", "expires_at": str(time.time() - 1000)},
            )
            qa.write_cp_state(
                {
                    "builds": {"b5d": "WORKING"},
                    "services": {"levelproaudio-backend": {"commit_sha": c1}},
                    "faults": {"builds_describe_error": "ERROR: API 503 Unavailable"},
                    "delays": {},
                    "events": [],
                }
            )
            env_d = qa.build_env("b5d", c2, repo, extra={"RELEASE_COMMAND_TIMEOUT_SECONDS": "15"})
            pd = qa.spawn_coordinator(env_d)
            pd.communicate(timeout=30)
            assert pd.returncode != 0
            assert qa.read_cp_state()["events"] == []
            still = srv.state.get_object_snapshot(LOCK_BUCKET, LOCK_OBJECT)
            assert still is not None and still.generation == seeded.generation

            # 5e: Missing BUILD_ID or BUILD_ID=local without QA mode -> fail-closed ConfigurationError
            env_e = qa.build_env("", c2, repo, extra={"RELEASE_COORDINATOR_ALLOW_QA_MODE": "0", "BUILD_ID": ""})
            pe = qa.spawn_coordinator(env_e)
            pe.communicate(timeout=15)
            assert pe.returncode != 0
            env_local = qa.build_env("local", c2, repo, extra={"RELEASE_COORDINATOR_ALLOW_QA_MODE": "0", "BUILD_ID": "local"})
            pl = qa.spawn_coordinator(env_local)
            pl.communicate(timeout=15)
            assert pl.returncode != 0
            print("  ✓ Fail-closed absoluto verificado ante ausencia de CLI, credenciales, errores GCS/API y BUILD_ID inválido.")
        finally:
            qa.cleanup()


def test_06_wrong_owner_release_rejected() -> None:
    print("\n[TEST 6/9] Liberación por propietario incorrecto rechazada + HTTP 412...")
    with GSEmulatorServer([LOCK_BUCKET]) as srv:
        qa = QAHarness(srv)
        try:
            _, repo, commits = setup_git_history(qa.tmp, 2)
            _, c2 = commits
            env_a = qa.build_env("owner-A", c2, repo, ttl=60, renew_interval=15)
            with _scoped_env(env_a):
                cfg_a = rc.CoordinatorConfig.from_env()
                cfg_b = rc.CoordinatorConfig(**{**cfg_a.__dict__, "build_id": "owner-B"})

                lock_a = rc.GCSReleaseLock(cfg_a)
                lock_b = rc.GCSReleaseLock(cfg_b)
                lock_a.preflight()
                rec_a = lock_a.acquire()

                # 6a: Lock B with None owned_generation
                assert lock_b.release() is False
                snap = srv.state.get_object_snapshot(LOCK_BUCKET, LOCK_OBJECT)
                assert snap is not None and snap.generation == int(rec_a.generation)

                # 6b: Lock B artificially given A's generation -> rejected by build_id/lease_id ownership check!
                lock_b.owned_generation = rec_a.generation
                assert lock_b.release() is False
                snap = srv.state.get_object_snapshot(LOCK_BUCKET, LOCK_OBJECT)
                assert snap is not None and snap.metadata["build_id"] == "owner-A"

                # 6c: Direct stale `--if-generation-match` DELETE against GCS fails HTTP 412
                rm_res = subprocess.run(
                    [
                        shutil.which("gcloud") or "/usr/local/bin/gcloud",
                        "storage",
                        "rm",
                        cfg_a.lock_uri,
                        "--if-generation-match=1",
                    ],
                    env=qa.build_env("owner-B", c2, repo),
                    text=True,
                    capture_output=True,
                )
                assert rm_res.returncode != 0
                assert any(
                    a.operation == "object_delete" and a.status_code == 412
                    for a in srv.state.audit_log
                )
                snap = srv.state.get_object_snapshot(LOCK_BUCKET, LOCK_OBJECT)
                assert snap is not None and snap.generation == int(rec_a.generation)
                assert lock_a.release() is True
            print("  ✓ Propietario incorrecto rechazado en coordinador y protegido por HTTP 412 en GCS.")
        finally:
            qa.cleanup()


def test_07_stages_blocked_without_valid_lock() -> None:
    print("\n[TEST 7/9] Migrador y despliegues bloqueados sin lock válido o tras pérdida de propiedad...")
    with GSEmulatorServer([LOCK_BUCKET]) as srv:
        qa = QAHarness(srv)
        try:
            _, repo, commits = setup_git_history(qa.tmp, 2)
            c1, c2 = commits
            env_7 = qa.build_env("no-lock-build", c2, repo, ttl=60, renew_interval=15)
            qa.write_cp_state({"builds": {"no-lock-build": "WORKING"}, "services": {"levelproaudio-backend": {"commit_sha": c1}}, "faults": {}, "delays": {}, "events": []})
            with _scoped_env(env_7):
                cfg = rc.CoordinatorConfig.from_env()

                # 7a: Direct stage execution without acquiring lock MUST raise LockOwnershipLostError
                coord = rc.ReleaseCoordinator(cfg)
                for fn in (
                    lambda: coord.update_migrator_job(VALID_BACKEND_DIGEST),
                    lambda: coord.run_migrations(),
                    lambda: coord.deploy_backend(VALID_BACKEND_DIGEST, c1),
                    lambda: coord.deploy_frontend(VALID_FRONTEND_DIGEST),
                ):
                    raised = False
                    try:
                        fn()
                    except rc.LockOwnershipLostError:
                        raised = True
                    assert raised, "Etapa crítica permitió ejecutarse sin lock válido!"
                assert qa.read_cp_state()["events"] == []

                # 7b: Lock hijacked between run_migrations and deploy_backend -> deploy blocked, hijacker preserved
                coord.lock.preflight()
                coord.lock.acquire()
                coord.update_migrator_job(VALID_BACKEND_DIGEST)
                coord.run_migrations()

                hijack_obj = srv.state.seed_object(
                    LOCK_BUCKET,
                    LOCK_OBJECT,
                    b"{}",
                    metadata={
                        "build_id": "hijacker-build",
                        "lease_id": "hijack-lease",
                        "commit_sha": c2,
                        "expires_at": str(time.time() + 600),
                    },
                )
                hijack_blocked = False
                try:
                    coord.deploy_backend(VALID_BACKEND_DIGEST, c1)
                except rc.LockOwnershipLostError:
                    hijack_blocked = True
                assert hijack_blocked, "deploy_backend debió bloquearse tras pérdida de lock!"
                assert coord.lock.release() is False
                snap = srv.state.get_object_snapshot(LOCK_BUCKET, LOCK_OBJECT)
                assert snap is not None and snap.generation == hijack_obj.generation

            # 7c: Heartbeat detects mid-migration theft and terminates active migrator child!
            qa.write_cp_state(
                {
                    "builds": {"hb-victim": "WORKING"},
                    "services": {"levelproaudio-backend": {"commit_sha": c1}},
                    "faults": {},
                    "delays": {"run_migrations:hb-victim": 30.0},
                    "events": [],
                }
            )
            srv.state.objects.clear()
            env_hb = qa.build_env("hb-victim", c2, repo, ttl=25, renew_interval=1, wait_timeout=45)
            phb = qa.spawn_coordinator(env_hb)
            qa.wait_for_stage("run-migrations:start", timeout=45.0)
            # Hijack lock in GCS while migration is sleeping and heartbeat runs every 1s
            thief = srv.state.seed_object(
                LOCK_BUCKET,
                LOCK_OBJECT,
                b"{}",
                metadata={"build_id": "thief", "lease_id": "thief-lease", "expires_at": str(time.time() + 600)},
            )
            _, _ = phb.communicate(timeout=60)
            assert phb.returncode != 0, "Build debió abortar cuando heartbeat perdió el lock"
            assert not any(e["stage"].startswith("deploy:") for e in qa.read_cp_state()["events"])
            snap_after = srv.state.get_object_snapshot(LOCK_BUCKET, LOCK_OBJECT)
            assert snap_after is not None and snap_after.generation == thief.generation
            print("  ✓ Migrador y despliegues bloqueados sin lock válido; pérdida detectada por heartbeat abortó sin borrar lock ajeno.")
        finally:
            qa.cleanup()


def test_08_cloudbuild_substitutions_and_shallow_git() -> None:
    print("\n[TEST 8/9] Validación Cloud Build YAML/sustituciones + git merge-base en shallow clone...")
    # 8a: Programmatic YAML + Cloud Build substitution validation
    node_script = r'''
const fs = require("fs");
const yaml = require("./frontend/node_modules/js-yaml");
const raw = fs.readFileSync("cloudbuild.yaml", "utf8");
if (raw.includes("gsutil")) {
  throw new Error("cloudbuild.yaml aún contiene referencias a gsutil");
}
const doc = yaml.load(raw);
if (!doc.substitutions || doc.substitutions._RELEASE_LOCK_BUCKET !== "levelproaudio_cloudbuild") {
  throw new Error("_RELEASE_LOCK_BUCKET inválido en cloudbuild.yaml");
}
const secMatch = String(doc.timeout || "").match(/^(\d+)s$/);
if (!secMatch || Number(secMatch[1]) < 1800) {
  throw new Error("timeout global de cloudbuild.yaml debe ser >= 1800s para builds >15m");
}
const declaredSubs = new Set(Object.keys(doc.substitutions));
const builtinSubs = new Set(["BUILD_ID", "COMMIT_SHA", "SHORT_SHA", "PROJECT_ID", "PROJECT_NUMBER", "REPO_NAME", "BRANCH_NAME", "TAG_NAME", "REVISION_ID", "LOCATION"]);
const stepsMap = new Map();
for (const step of doc.steps) {
  stepsMap.set(step.id, step);
  if (Array.isArray(step.env)) {
    for (const item of step.env) {
      if (item.includes(":-")) {
        throw new Error(`Substitución inválida estilo bash ':-' en step ${step.id}: ${item}`);
      }
      const matches = [...item.matchAll(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g)];
      for (const m of matches) {
        const name = m[1];
        if (name.startsWith("_")) {
          if (!declaredSubs.has(name)) {
            throw new Error(`Substitución de usuario no declarada ${name} en step ${step.id}`);
          }
        } else if (!builtinSubs.has(name) && item.indexOf("=" + m[0]) !== -1) {
          throw new Error(`Variable no builtin inesperada en env de ${step.id}: ${name}`);
        }
      }
    }
  }
}
const cr = stepsMap.get("coordinated-release");
if (!cr || cr.entrypoint !== "python3" || !cr.waitFor || !cr.waitFor.includes("push-backend") || !cr.waitFor.includes("push-frontend")) {
  throw new Error("Step coordinated-release mal configurado");
}
console.log("  ✓ cloudbuild.yaml YAML, timeout=2400s, dependencias y sustituciones Cloud Build válidas.");
'''
    res = subprocess.run(["node", "-e", node_script], cwd=ROOT_DIR, text=True, capture_output=True)
    assert res.returncode == 0, f"Validación cloudbuild.yaml falló: {res.stdout}\n{res.stderr}"
    print(res.stdout.rstrip())

    # 8b: Real `git clone --depth=1` shallow repository validation
    tmp = tempfile.mkdtemp(prefix="levelpro_git_qa_")
    try:
        bare, _, commits = setup_git_history(tmp, 3)
        c1, c2, c3 = commits
        shallow_dir = os.path.join(tmp, "shallow_clone")
        subprocess.run(
            ["git", "clone", "--depth=1", f"file://{bare}", shallow_dir],
            check=True,
            capture_output=True,
        )
        # Confirm c1 is missing locally before GitHistoryValidator runs!
        assert subprocess.run(["git", "-C", shallow_dir, "cat-file", "-e", f"{c1}^{{commit}}"], capture_output=True).returncode != 0

        validator = rc.GitHistoryValidator(shallow_dir)
        # Forward release (c1 -> c3) auto-unshallows and succeeds!
        validator.verify_ancestor(c1, c3)
        assert subprocess.run(["git", "-C", shallow_dir, "cat-file", "-e", f"{c1}^{{commit}}"], capture_output=True).returncode == 0

        # Out-of-order regression (active=c3, target=c2) raises OutOfOrderReleaseError!
        out_of_order = False
        try:
            validator.verify_ancestor(c3, c2)
        except rc.OutOfOrderReleaseError:
            out_of_order = True
        assert out_of_order, "Debe rechazar release regresivo c2 sobre activo c3"

        # Shallow clone with broken remote missing c1 raises fail-closed GitHistoryError
        shallow_broken = os.path.join(tmp, "shallow_broken")
        subprocess.run(
            ["git", "clone", "--depth=1", f"file://{bare}", shallow_broken],
            check=True,
            capture_output=True,
        )
        _git(shallow_broken, "remote", "set-url", "origin", "file:///nonexistent_origin.git")
        broken_validator = rc.GitHistoryValidator(shallow_broken)
        broken_failed = False
        try:
            broken_validator.verify_ancestor(c1, c3)
        except rc.GitHistoryError:
            broken_failed = True
        assert broken_failed, "Shallow clone sin historial y remoto inalcanzable debe ser fail-closed!"

        # Non-git directory fails closed
        non_git = os.path.join(tmp, "not_git")
        os.makedirs(non_git, exist_ok=True)
        non_git_failed = False
        try:
            rc.GitHistoryValidator(non_git).verify_ancestor(c1, c3)
        except rc.GitHistoryError:
            non_git_failed = True
        assert non_git_failed, "Directorio sin .git debe fallar cerrado"
        print("  ✓ Historial Git shallow (`--depth=1`) desatascado con unshallow y regresión bloqueada.")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_09_end_to_end_happy_path_with_audit() -> None:
    print("\n[TEST 9/9] Release completo end-to-end con digests inmutables y auditoría GCS...")
    with GSEmulatorServer([LOCK_BUCKET]) as srv:
        qa = QAHarness(srv)
        try:
            _, repo, commits = setup_git_history(qa.tmp, 2)
            c1, c2 = commits
            qa.write_cp_state(
                {
                    "builds": {"happy-build": "WORKING"},
                    "services": {"levelproaudio-backend": {"commit_sha": c1, "image": "old"}},
                    "faults": {},
                    "delays": {"run_migrations:happy-build": 0.2},
                    "events": [],
                }
            )
            env = qa.build_env("happy-build", c2, repo, ttl=45, renew_interval=5)
            p = qa.spawn_coordinator(env)
            out, err = p.communicate(timeout=90)
            assert p.returncode == 0, f"happy-build falló: {out}\n{err}"

            st = qa.read_cp_state()
            stages = [e["stage"] for e in st["events"] if e["stage"] != "run-migrations:start"]
            assert stages == [
                "update-migrator-job",
                "run-migrations",
                "deploy:levelproaudio-backend",
                "deploy:levelproaudio-frontend",
            ], f"Orden incorrecto de etapas: {stages}"

            be = st["services"]["levelproaudio-backend"]
            fe = st["services"]["levelproaudio-frontend"]
            assert be["image"] == VALID_BACKEND_DIGEST and be["commit_sha"] == c2
            assert fe["image"] == VALID_FRONTEND_DIGEST and fe["commit_sha"] == c2
            assert srv.state.get_object_snapshot(LOCK_BUCKET, LOCK_OBJECT) is None

            mutating = [
                a for a in srv.state.audit_log
                if a.operation in ("object_upload", "object_delete")
            ]
            assert mutating and all(a.if_generation_match is not None for a in mutating)
            print("  ✓ Release end-to-end completado con digests inmutables, orden exacto y lock liberado atómicamente.")
        finally:
            qa.cleanup()


def main() -> int:
    tests = [
        test_01_concurrent_lock_acquisition,
        test_02_orphan_recovery_race_no_overwrite,
        test_03_active_build_over_15_minutes,
        test_04_failures_cancellation_and_crash,
        test_05_fail_closed_missing_cli_creds_and_api_errors,
        test_06_wrong_owner_release_rejected,
        test_07_stages_blocked_without_valid_lock,
        test_08_cloudbuild_substitutions_and_shallow_git,
        test_09_end_to_end_happy_path_with_audit,
    ]
    print("==============================================================================")
    print(" LEVELPRO OS V4.0 — PR #46: ATOMIC RELEASE LOCK & COORDINATION QA SUITE")
    print("==============================================================================")
    passed = 0
    for fn in tests:
        fn()
        passed += 1
    print("\n==============================================================================")
    print(f" PRUEBAS APROBADAS: {passed} / {len(tests)} (100% OK)")
    print("==============================================================================")
    return 0


if __name__ == "__main__":
    sys.exit(main())
