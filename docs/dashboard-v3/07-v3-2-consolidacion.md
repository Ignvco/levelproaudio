# LevelPro Audio V3.2 — Consolidación segura de ramas

**Estado:** candidata a QA, no desplegada, no certificada para producción.  
**Base estable:** `ef614c9357675d7fb6a18658eb2e8694e072a38f` (Dashboard V3.1).  
**Rama principal de consolidación:** `feat/v3-2-consolidado`.  
**Patch 14:** absolutamente pausado; no se modifica su alcance.

## 1. Origen del trabajo

Se encontraron dos implementaciones paralelas:
- `feat/v3-2-integral-stabilization` (47 commits frente al V3.1; modelo y migración monetaria de tesorería, UX de interiores, numerosos controles financieros).
- `feat/v3-2-refinamiento-integral` (34 commits frente al V3.1; consultas comerciales segregadas y correcciones adicionales de modales, búsqueda y navegación).

**Decisión:** utilizar la primera como base, porque contiene la migración `analytics.0004_currency_integrity` y la clasificación conservadora de históricos. Incorporar selectivamente de la segunda accesibilidad y controles de integridad. No hacer merges de Git automáticos ni reaplicar archivos completos con implementaciones incompatibles.

## 2. Cambios consolidados

- CLP, USD y ARS independientes para ventas, pagos de pasarela, analytics, finanzas y reportes; nunca se aplica conversión FX implícita.
- Se distingue el total comercial de la orden (moneda del pedido) del monto cobrado por la pasarela (moneda de la transacción). En PayPal, ambos pueden diferir.
- Registros financieros `IncomeRecord` y `Withdrawal` incorporan `currency`. Los registros antiguos sin evidencia suficiente permanecen `NULL` después de migración; no se les atribuye CLP por conveniencia.
- Los ingresos de ventas extranjeras no generan utilidad de productos basada en costos CLP. Ejecutivo muestra utilidad extranjera `null`, no cero falsamente.
- Las categorías con movimientos no clasificados bloquean retiros (HTTP 409) hasta conciliación documentada.
- Una cuenta con histórico incompleto devuelve `net_balance: null` y `reconciliation_required: true`; el panel presenta «Por conciliar», no un saldo supuestamente definitivo. El subtipo `net_balance_identified_only` es informativo y no sustituye un balance conciliado.
- Componentes compartidos de UI: tablas, botones, KPI, diálogos, búsqueda y pestañas con accesibilidad de teclado, estados de carga y etiquetado. Diálogos restauran foco al control anterior y mantienen navegación Tab dentro del modal.
- Dashboard V3 Bento mantiene identidad gráfica; mejorar contraste, navegación y densidad sin sustituir funciones.

## 3. Consideraciones de despliegue críticas

### Migración histórica
`analytics.0004_currency_integrity` es una **migración de esquema y de datos**. Antes de aplicarla en producción:

1. Hacer respaldo verificable de Cloud SQL, con restauración ensayada en entorno aislado.
2. Ejecutar la migración sobre una copia anonimizada, verificar conteos/importes por moneda y los registros dejados en NULL.
3. Verificar que las versiones Django y el esquema anterior correspondan exactamente a la dependencia `analytics.0003`.
4. Confirmar el flujo de migraciones en Cloud Run, ya que `backend/Dockerfile.prod` ejecuta `manage.py migrate` al iniciar. Un despliegue prematuro activará automáticamente `0004`.
5. Comprobar categorías que bloquearían nuevos retiros y diseñar su conciliación real; nunca marcar automáticamente registros históricos desconocidos como CLP.

### Cloud Build de validación sin despliegue

Se incorpora `cloudbuild.v3-2-qa.yaml` para probar desde el Mac SIN instalar
Python y sin publicar una nueva revisión. En una rama local aislada con V3.2:

```bash
gcloud builds submit . --config cloudbuild.v3-2-qa.yaml
```

Este comando sube el código de trabajo a Cloud Build y ejecuta Django,
PostgreSQL, ESLint, pruebas unitarias frontend y el build React, pero **NO**
despliega en Cloud Run ni inicia la migración histórica en Cloud SQL de
producción. El build habitual `cloudbuild.yaml` sí despliega.

### QA obligatoria
En backend, usando el entorno Docker/CI ya configurado:
```bash
python manage.py makemigrations --check --dry-run
python manage.py check
python -m pytest apps/analytics/tests_currency_isolation.py -q
python -m pytest -q
```

En `frontend/`:
```bash
npm ci
npm run lint
npm run test:unit
npm run build
```

QA autenticada: vista Admin Home, Finanzas, Analytics, Tesorería, Pagos, Pedidos, Facturación, Inventario, Academy, Rewards, Servicios, Panel Usuario; escritorio 1440/1280, tablet 768, móvil 390/320; carga/error/vacío; roles, accesibilidad, mantenimiento de identidades de marca y funciones; compras y cobros en sandbox.

**El trabajo en GitHub y la verificación estructural del diff NO equivalen a una ejecución de Cloud Build ni a pruebas de flujo real.**

## 4. Bloqueos abiertos

- Clasificación manual documentada de retirados e ingresos históricos ambiguos en tesorería: no hay tipo de cambio automático ni reconciliación inferida.
- No se ha ejecutado restauración de DB ni migración sobre copia de producción.
- No se ha verificado responsive y UX 1:1 de todas las rutas mediante navegador autenticado.
- La certificación final de V3.2 depende de QA y del resultado de las pruebas automáticas.

## 5. Política de integración

No fusionar las dos ramas antiguas entre sí, no desplegar la rama candidata sin superar los gates indicados, no eliminar las ramas de origen mientras exista trabajo por auditar. Generar un solo patch desde la base estable y verificarlo mediante `git apply --check`. Mantener Patch 14 pausado.
