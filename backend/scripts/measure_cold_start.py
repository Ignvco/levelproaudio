#!/usr/bin/env python3
"""
LEVELPRO OS V4.0 — GATE 1.3: BENCHMARK DE COLD START Y ARRANQUE WSGI
Distingue empíricamente entre:
1. Tiempo de importación de módulos Django WSGI en proceso local.
2. Tiempo completo de cold-start de contenedor (boot, bind, listening y primer HTTP 200).
"""

import time
import subprocess
import urllib.request
import urllib.error
import sys

def measure_wsgi_import():
    print("[BENCHMARK 1] Midiendo tiempo de importación pura de WSGI Django...")
    t0 = time.perf_counter()
    res = subprocess.run(
        [
            "docker", "exec", "levelpro-v32-qa-backend-1",
            "python", "-c", "import time; t=time.perf_counter(); import config.wsgi; print(f'WSGI_INTERNAL:{time.perf_counter()-t:.4f}')"
        ],
        capture_output=True, text=True, check=True
    )
    t_total = time.perf_counter() - t0
    internal_str = [l for l in res.stdout.splitlines() if "WSGI_INTERNAL:" in l][0]
    wsgi_internal = float(internal_str.split(":")[1])
    print(f"  -> Importación interna WSGI (dentro de Python): {wsgi_internal:.3f} s")
    print(f"  -> Invocación exec + arranque Python + WSGI: {t_total:.3f} s")
    return wsgi_internal, t_total

def measure_container_full_cold_start():
    print("\n[BENCHMARK 2] Midiendo cold start completo de contenedor (boot a HTTP 200)...")
    # Lanzar un contenedor efímero con Gunicorn
    container_name = "levelpro-coldstart-benchmark-test"
    # Asegurar que no existe previamente
    subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)

    t0 = time.perf_counter()
    run_cmd = [
        "docker", "run", "-d", "--rm",
        "--name", container_name,
        "--network", "levelpro-v32-qa_qa_isolated",
        "--network-alias", "backend-bench",
        "-e", "DB_HOST=db",
        "-e", "DB_PORT=5432",
        "-e", "DB_NAME=levelpro_v32_qa",
        "-e", "DB_USER=levelpro_qa",
        "-e", "DB_PASSWORD=local-qa-password-only",
        "-e", "DJANGO_SETTINGS_MODULE=config.settings.local_qa",
        "-e", "QA_LOCAL_ONLY=1",
        "-e", "DJANGO_SECRET_KEY=qa-local-very-long-dummy-key-do-not-use-in-production-2026",
        "levelpro-v32-qa-backend:gate1.3-release",
        "gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "30"
    ]
    subprocess.run(run_cmd, capture_output=True, check=True)
    t_container_started = time.perf_counter()

    first_200_time = None
    max_wait = 30.0
    poll_interval = 0.05

    while time.perf_counter() - t0 < max_wait:
        # Ejecutar sondeo vía contenedor backend existente o test
        probe = subprocess.run(
            ["docker", "exec", "levelpro-v32-qa-backend-1", "python", "-c",
             "import urllib.request; req=urllib.request.Request('http://backend-bench:8000/admin/login/', headers={'Host': 'localhost'}); urllib.request.urlopen(req, timeout=1)"],
            capture_output=True
        )
        if probe.returncode == 0:
            first_200_time = time.perf_counter() - t0
            break
        time.sleep(poll_interval)

    # Detener contenedor
    subprocess.run(["docker", "stop", container_name], capture_output=True)

    if first_200_time:
        print(f"  -> Cold start completo de contenedor hasta primer HTTP 200: {first_200_time:.3f} s")
    else:
        print("  -> Timeout esperando HTTP 200.")
    return first_200_time

def main():
    print("=" * 65)
    print("LEVELPRO OS V4.0 — GATE 1.3: MEDICIÓN DE ARRANQUE Y COLD START")
    print("=" * 65)
    wsgi_int, wsgi_tot = measure_wsgi_import()
    full_cs = measure_container_full_cold_start()
    print("\n" + "=" * 65)
    print("RESUMEN DE RESULTADOS:")
    print(f"  * Importación WSGI de Django pura:              {wsgi_int:.3f} s")
    print(f"  * Proceso Python + Carga WSGI:                   {wsgi_tot:.3f} s")
    if full_cs:
        print(f"  * Cold Start Completo (Docker run -> HTTP 200):  {full_cs:.3f} s")
    print("=" * 65)

if __name__ == "__main__":
    main()
