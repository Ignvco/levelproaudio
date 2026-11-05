# Validación del paquete 07–11

Base remota comprobada: `58ee09609cd2b3bfbee5a4b0e97d907331d1f503`.
Su Google Cloud Build terminó con éxito:
https://github.com/Ignvco/levelproaudio/runs/124722686896

El código de esta entrega se preparó en una rama local aislada. No se hizo push,
no se desplegó el paquete y no se ejecutaron pagos reales ni cambios de secretos.

## Resultados

| Comprobación | Resultado |
| --- | --- |
| Suite backend completa del comando de Cloud Build | **656 passed, 12 skipped** |
| Pruebas de lógica frontend | **62 passed** |
| Chromium sobre el build de producción | **56 passed** |
| Integración Nginx con upstream local simulado | **1 passed** |
| Build frontend | Correcto, sin aviso de chunks mayores a 500 kB |
| Presupuesto de JavaScript inicial | 460.501 bytes / 143.198 bytes gzip; dentro del límite |
| Consistencia de migraciones | `makemigrations --check --dry-run`: sin cambios pendientes |
| Sintaxis Python de archivos modificados | Compatible con gramática de Python 3.11 |
| Aplicación acumulada y serie | Mismo árbol final y mismos archivos que el código probado |

La suite backend aporta **66 casos nuevos** frente a los 590 del patch 06.
Las 12 omisiones incluyen pruebas que necesitan servicios/entornos adicionales;
no se presentan como aprobadas. Los tests de concurrencia PostgreSQL existentes
siguen en el paso de Cloud Build; no se ejecutaron aquí en PostgreSQL.

Entorno local: Python 3.12.14, Node 24.22.1, npm 11.9.0, Vite 8.3.5,
Playwright 1.62.1, Chromium 153.0.8010.0 y Nginx 1.28.0.
La imagen completa Docker/Alpine, Safari y Firefox no se ejecutaron localmente.

## Cobertura de navegador

- 29 casos del retorno de pago del patch 06, incluido PayPal sin capturas repetidas.
- 11 de transferencias: recarga, moneda USD, estados finales, error y actualización.
- 1 de JSON-LD con texto que intenta salir del bloque script.
- 2 de SEO: etiquetas únicas, prioridad, navegación y rutas privadas.
- 13 de navegación/carga por ruta, checkout y ausencia de chunks privados en Home.

Nginx usa el `nginx.conf` de producción con upstream sustituido por un servidor
local de pruebas: comprueba ruta/query originales, exclusión de cookies/token,
respuesta HTML inicial, fallback ante 503/timeout y bloqueo del endpoint interno.
Django prueba por separado el contenido real del fragmento con datos sintéticos.

## Integridad y aplicación

Se probaron `git apply --check --index`, aplicación del acumulado y aplicación
secuencial 07–11 sobre copias limpias de la base. Se compararon los árboles Git y
los bytes de todos los archivos afectados. El script verifica además base exacta,
cambios locales, archivos dañados, colisiones y doble aplicación.

El ZIP contiene patches de texto, instrucciones y el script. No contiene
credenciales reales, datos de clientes, node_modules, capturas, instaladores ni bases
de datos. `SHA256SUMS` permite detectar archivos incompletos o modificados.

## Alcance de lo que falta verificar en producción

- Resultado de Cloud Build y despliegue de **esta** entrega.
- Asignación explícita de cuentas Payoneer y revisión de las instrucciones reales.
- Una visita y recarga de un pedido propio, sin necesidad de un nuevo cobro.
- Metadatos e imágenes reales servidos en el dominio final.
- Métricas de campo de rendimiento. La reducción de JavaScript no es una
  puntuación Lighthouse ni una promesa de mejora porcentual de tiempo de carga.

El lint dirigido de los módulos nuevos de SEO/JSON-LD/transferencia pasó. No se
presenta el lint completo del repo como aprobado: conserva incidencias previas.
