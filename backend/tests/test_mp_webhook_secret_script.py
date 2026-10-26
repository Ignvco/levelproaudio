"""Ejecuta Bash con gcloud simulado; nunca contacta Google Cloud."""

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

import pytest


SCRIPT = Path(__file__).resolve().parents[2] / "scripts/configure-mp-webhook-secret.sh"
DUMMY_SECRET = "dummy-webhook-value-for-tests"
RESOURCE = "projects/147540000801/secrets/MP_CL_WEBHOOK_SECRET\n"


def step(command, code=0, stdout="", stderr=""):
    return {"command": command.split(), "code": code, "stdout": stdout, "stderr": stderr}


@pytest.fixture
def run_script(tmp_path):
    plan = tmp_path / "plan.json"
    calls_path = tmp_path / "calls.json"
    fake_gcloud = tmp_path / "gcloud"
    fake_gcloud.write_text(f"#!{sys.executable}\n" + '''
import hashlib
import json
import os
from pathlib import Path
import sys

plan = json.loads(Path(os.environ["MP_TEST_PLAN"]).read_text())
calls_path = Path(os.environ["MP_TEST_CALLS"])
calls = json.loads(calls_path.read_text()) if calls_path.exists() else []
args = sys.argv[1:]
if len(calls) >= len(plan) or args[:len(plan[len(calls)]["command"])] != plan[len(calls)]["command"]:
    sys.stderr.write("UNEXPECTED GCLOUD CALL: " + repr(args))
    sys.exit(97)
response = plan[len(calls)]
call = {"args": args, "secret_in_env": "mp_webhook_secret" in os.environ}
if args[:3] == ["secrets", "versions", "add"]:
    call["stdin_sha256"] = hashlib.sha256(sys.stdin.buffer.read()).hexdigest()
calls.append(call)
calls_path.write_text(json.dumps(calls))
sys.stdout.write(response["stdout"])
sys.stderr.write(response["stderr"])
sys.exit(response["code"])
''')
    fake_gcloud.chmod(0o755)

    def run(steps, *, country="cl", secret=DUMMY_SECRET, overrides=None):
        plan.write_text(json.dumps(steps))
        env = {
            key: value for key, value in os.environ.items()
            if key not in {"MP_PROJECT_ID", "MP_RUNTIME_SA", "mp_webhook_secret"}
        }
        env.update({
            "PATH": str(tmp_path) + os.pathsep + os.environ.get("PATH", ""),
            "MP_TEST_PLAN": str(plan), "MP_TEST_CALLS": str(calls_path),
        })
        env.update(overrides or {})
        result = subprocess.run(
            ["bash", str(SCRIPT), country], input=secret + "\n",
            text=True, capture_output=True, env=env, timeout=10,
        )
        calls = json.loads(calls_path.read_text()) if calls_path.exists() else []
        assert "UNEXPECTED GCLOUD" not in result.stderr
        assert len(calls) == len(steps)
        assert DUMMY_SECRET not in result.stdout + result.stderr + json.dumps(calls)
        assert all(not call["secret_in_env"] for call in calls)
        return result, calls

    return run


@pytest.mark.parametrize("country", ["cl", "ar"])
def test_existing_secret_is_reused_after_visible_reauthentication(run_script, country):
    name = f"MP_{country.upper()}_WEBHOOK_SECRET"
    result, calls = run_script([
        step("secrets list", stdout=RESOURCE.replace("MP_CL_WEBHOOK_SECRET", name),
             stderr="Reauthentication successful.\n"),
        step("secrets add-iam-policy-binding"),
        step("secrets versions add"),
    ], country=country)
    assert result.returncode == 0
    assert "Reauthentication successful." in result.stderr
    assert "ya existe" in result.stdout
    assert f"--filter=name~'(^|/){name}$'" in calls[0]["args"]
    assert "--format=value(name)" in calls[0]["args"]
    for call in calls:
        assert "--project=levelproaudio" in call["args"]
    for call in calls[1:]:
        assert name in call["args"]
    assert "--member=serviceAccount:levelproaudio-app@levelproaudio.iam.gserviceaccount.com" in calls[1]["args"]
    assert "--role=roles/secretmanager.secretAccessor" in calls[1]["args"]
    assert "--quiet" in calls[2]["args"]
    assert "--data-file=-" in calls[2]["args"]
    assert calls[2]["stdin_sha256"] == hashlib.sha256(DUMMY_SECRET.encode()).hexdigest()


def test_successful_empty_lookup_creates_secret(run_script):
    result, calls = run_script([
        step("secrets list"), step("secrets create"),
        step("secrets add-iam-policy-binding"), step("secrets versions add"),
    ])
    assert result.returncode == 0
    assert "--replication-policy=automatic" in calls[1]["args"]
    assert "MP_CL_WEBHOOK_SECRET" in calls[1]["args"]


@pytest.mark.parametrize("error", ["Reauthentication required", "PERMISSION_DENIED", "Connection timeout"])
@pytest.mark.parametrize("partial_output", ["", RESOURCE])
def test_lookup_failure_never_creates_or_writes_a_secret(run_script, error, partial_output):
    result, _ = run_script([step("secrets list", code=1, stdout=partial_output, stderr=error)])
    assert result.returncode != 0
    assert error in result.stderr
    assert "no se intentó crear" in result.stderr
    assert "entrada oculta" not in result.stderr


def test_concurrent_creation_is_verified_before_reuse(run_script):
    result, calls = run_script([
        step("secrets list"),
        step("secrets create", code=1, stderr="Secret already exists"),
        step("secrets describe", stdout=RESOURCE),
        step("secrets add-iam-policy-binding"), step("secrets versions add"),
    ])
    assert result.returncode == 0
    assert "ya está disponible" in result.stdout
    assert "MP_CL_WEBHOOK_SECRET" in calls[2]["args"]
    assert "--project=levelproaudio" in calls[2]["args"]


def test_failed_creation_and_verification_stop_before_iam_and_upload(run_script):
    result, _ = run_script([
        step("secrets list"),
        step("secrets create", code=1, stderr="create denied"),
        step("secrets describe", code=1, stderr="describe denied"),
    ])
    assert result.returncode != 0
    assert "No se agregó ninguna versión" in result.stderr
    assert "create denied" in result.stderr
    assert "describe denied" in result.stderr


@pytest.mark.parametrize("failed_command", ["secrets add-iam-policy-binding", "secrets versions add"])
def test_write_failure_does_not_report_success(run_script, failed_command):
    steps = [step("secrets list", stdout=RESOURCE)]
    if failed_command == "secrets versions add":
        steps.append(step("secrets add-iam-policy-binding"))
    steps.append(step(failed_command, code=1, stderr="operation denied"))
    result, _ = run_script(steps)
    assert result.returncode != 0
    assert "operation denied" in result.stderr
    assert "Ahora puedes" not in result.stdout


@pytest.mark.parametrize("secret", ["", " ", "bad value", "bad\tvalue"])
def test_invalid_secret_does_not_mutate_resources(run_script, secret):
    result, _ = run_script([step("secrets list")], secret=secret)
    assert result.returncode != 0
    assert "vacío ni contener espacios" in result.stderr


def test_invalid_country_does_not_call_gcloud(run_script):
    result, _ = run_script([], country="invalid")
    assert result.returncode == 2


def test_custom_project_and_runtime_account_are_respected(run_script):
    result, calls = run_script([
        step("secrets list", stdout="projects/test-project/secrets/MP_CL_WEBHOOK_SECRET\n"),
        step("secrets add-iam-policy-binding"), step("secrets versions add"),
    ], overrides={"MP_PROJECT_ID": "test-project", "MP_RUNTIME_SA": "runtime@test-project.iam.gserviceaccount.com"})
    assert result.returncode == 0
    assert all("--project=test-project" in call["args"] for call in calls)
    assert "--member=serviceAccount:runtime@test-project.iam.gserviceaccount.com" in calls[1]["args"]


def test_lookup_matches_exact_secret_name(run_script):
    _, calls = run_script([
        step("secrets list", stdout=RESOURCE),
        step("secrets add-iam-policy-binding"), step("secrets versions add"),
    ])
    expression = next(arg for arg in calls[0]["args"] if arg.startswith("--filter="))
    regex = expression.split("~", 1)[1].strip("'")
    assert re.search(regex, RESOURCE.strip())
    assert re.search(regex, "MP_CL_WEBHOOK_SECRET")
    assert not re.search(regex, "projects/147540000801/secrets/MP_CL_WEBHOOK_SECRET_BACKUP")
    assert not re.search(regex, "projects/147540000801/secrets/OTHER_MP_CL_WEBHOOK_SECRET")
