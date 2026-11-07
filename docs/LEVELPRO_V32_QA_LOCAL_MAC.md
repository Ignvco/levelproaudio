# LEVELPRO AUDIO · V3.2 — AUDITORÍA LOCAL EN MAC (SIN STAGING)

**Base de código revisada:** `main` en `9f36745a694f69d2be86da71182d569e9c4f6805`, 07-11-2026.

## Política innegociable

- **Staging aplazado indefinidamente** hasta después del Patch 14 o cuando realmente se requiera. **Patch 14 sigue pausado**: este kit no lo implementa.
- No ejecutar `cloudbuild.yaml`, `gcloud run deploy` ni usar `.env` de producción.
- No conectar el laboratorio local a Cloud SQL, GCS ni a las credenciales de PayPal/MP/Resend. El backend va en una red Docker `internal: true` y PostgreSQL no publica puerto al Mac.
- El laboratorio crea exclusivamente registros ficticios en una base nueva `levelpro_v32_qa`, protegida por guardas de settings y del comando `qa_seed_v32`.
- Este kit incluye los scripts de certificación previamente entregados. **No aplicar además el antiguo `LEVELPRO_AUDIO_V3.2_CERTIFICACION_QA_READONLY.patch`** sobre el mismo checkout (archivos repetidos).
- Las contraseñas, archivos de sesión, capturas y reportes de dinero permanecen en el Mac, fuera del repo y fuera de GitHub.

## Requisitos

- Mac con Docker Desktop iniciado (`docker info` debe funcionar), Git y Node **24.19.0 o superior en la rama 24**; npm **11.9.0** recomendado (requisitos del frontend).
- `python`/Postgres no son necesarios en el host para el laboratorio: van en los contenedores.
- Navegador Chromium instalado mediante Playwright (`npx playwright install chromium`).

## Fase 0: aplicar y verificar

Desde la carpeta raíz `levelproaudio-purge`:

```bash
git status --short
git rev-parse --short HEAD
git apply --check ~/Downloads/LEVELPRO_AUDIO_V3.2_QA_LOCAL_MAC.patch
git apply ~/Downloads/LEVELPRO_AUDIO_V3.2_QA_LOCAL_MAC.patch
git diff --check
bash scripts/qa-v32-local.sh doctor
```

No hacer `git push` ni desplegar para ejecutar el kit local. La creación del laboratorio requiere Docker Desktop. El compose de QA **no** reutiliza `docker-compose.yml` ni monta `.env`.

## Fase 1: laboratorios, sesión y auditoría visual

```bash
bash scripts/qa-v32-local.sh up
bash scripts/qa-v32-local.sh seed
```

`seed` crea dos usuarios y datos ficticios (producto CLP/USD/ARS, curso, servicio, reserva, campaña y orden pendiente), **sin cobros aprobados**. Las claves recién generadas se guardan de modo privado en `~/.levelpro-v32-qa/local-seed-credentials.txt`. **No compartir este archivo**. Para verlas, usar en el propio Mac:

```bash
cat "$HOME/.levelpro-v32-qa/local-seed-credentials.txt"
```

Abrir http://127.0.0.1:3000 y confirmar que la tienda carga. En otra terminal:

```bash
cd frontend
npm ci
npx playwright install chromium
export QA_BASE_URL=http://127.0.0.1:3000
cd ..
bash scripts/qa-v32-local.sh capture-admin
bash scripts/qa-v32-local.sh capture-customer
```

Iniciar sesión manualmente en la ventana que abre Chromium, con las credenciales ficticias; luego pulsar ENTER en la terminal. Las cookies se guardan localmente y nunca se imprimen.

Captura rápida inicial:

```bash
QA_WIDTHS='1440,390' bash scripts/qa-v32-local.sh visual
open "$HOME/.levelpro-v32-qa/visual-evidence/index.html"
```

Para cubrir todas las resoluciones cuando la primera corrida funcione:

```bash
QA_WIDTHS='1440,1280,1024,768,430,390,320' bash scripts/qa-v32-local.sh visual
```

El comando `visual` carga automáticamente los identificadores sintéticos del archivo privado de credenciales para probar también las rutas dinámicas. Un `CAPTURED` automático no es una certificación estética: revisar capturas en la galería.

## Fase 2: operativas autenticadas, contratos y pruebas sin pagos externos

```bash
bash scripts/qa-v32-local.sh operational
cd frontend
npm run test:browser
npm run lint
npm run test:unit
npm run build
cd ..
bash scripts/qa-v32-local.sh test-backend
```

Comprobar:
- Cuenta cliente no puede leer endpoints admin (HTTP 401/403).
- Distinción de monedas CLP/USD/ARS en respuestas y visuales.
- Checkout de prueba muestra solo la transferencia **ficticia**; no hay PayPal/MP disponibles.
- Perfil, pedidos, filtros, cursos, servicios, estados error/empty, Rewards, Loyalty e inventario.
- Las pruebas de Playwright integradas usan fixtures y mocks; **NO** prueban el cobro real, la firma real de webhooks ni el proveedor externo.

Ver:

```bash
cat "$HOME/.levelpro-v32-qa/operational-evidence/report.json"
```

**Criterio de prueba de pasarelas:** sin Staging ni sandbox externo conectado, la certificación **end-to-end de PayPal y MercadoPago permanece PENDIENTE**, no se debe reemplazar por pruebas simuladas ni probar un pago de verdad en producción.

## Fase 3: conciliación de históricos en modo de solo lectura

**A. Validar el analizador contra PostgreSQL ficticio**:

```bash
docker compose -f docker-compose.qa-v32.yml exec -T backend python manage.py audit_currency_history
```

Este resultado **NO es el resultado contable de producción**: la base local es ficticia y no contiene históricos reales.

**B. Inventario histórico real**, más adelante y solo después de crear un usuario/credencial PostgreSQL exclusivamente `SELECT` y un canal de conexión autorizado. El comando `audit_currency_history` usa `SET TRANSACTION READ ONLY` si la conexión es PostgreSQL, además de no escribir datos con ORM. Debe ejecutarse con **una configuración de Django que apunte al origen real con usuario de lectura**, nunca con `local_qa.py` ni sobre una base de producción usando credenciales de escritura.

Nunca subir archivos que contengan IDs, correos, pagos o saldos. En el informe real clasificar por evidencia documental: moneda de orden, divisa de captura de PayPal/MP, ingreso comercial, retiros, distribuciones y puntos extranjeros. `NULL` no se convierte por suposición.

## Criterios de salida

| Bloque | Evidencia exigida | Estado inicial |
|---|---|---|
| Visual | Galería de capturas por ruta y tamaño; inspección humana de componentes | PENDIENTE |
| Backend y frontend local | Comandos exitosos; permisos, sesión, errores y flujos con datos ficticios | PENDIENTE |
| Pasarelas reales | Escenarios sandbox + webhooks externos en ambiente aislado | DIFERIDO / NO APROBADO |
| Conciliación histórica | Reporte SELECT-only en datos reales; excepciones documentadas | PENDIENTE |

No declarar certificación de producción completa si falta cualquiera de los requisitos de aceptación aplicables. Un hallazgo de pagos concurrentes puede posponerse al Patch 14 pero entonces debe quedar explícitamente como **riesgo abierto**, no como aprobado.

## Detener y limpiar

```bash
bash scripts/qa-v32-local.sh down
# Opcional: ELIMINA VOLÚMENES DE DATOS SOLO LOCALES, requiere confirmación
bash scripts/qa-v32-local.sh reset
```

No ejecutar `docker compose down -v` sin especificar **`-f docker-compose.qa-v32.yml`**: no se deben tocar otros stacks locales.

Para obtener un **resumen que no revela contraseñas ni importes** y compartir únicamente ese texto en el chat:

```bash
bash scripts/qa-v32-local.sh summary
```
