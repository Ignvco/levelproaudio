# Patch 11 — Carga por ruta y presupuesto de JavaScript

## Cambios

Home y el layout público siguen disponibles en la entrada inicial. Las demás
páginas públicas, autenticación, checkout y cuenta se cargan por ruta con React
lazy/Suspense; el panel conserva su carga diferida. Un estado accesible indica
la carga de una página. No se cambian URLs, permisos ni lógica de pago.

Las imágenes de tarjetas y secciones inferiores cargan con `loading="lazy"` y
`decoding="async"`. La primera tarjeta del catálogo de tienda/academia/servicios
y la imagen principal del producto reciben prioridad. Los videos de lecciones
usan `preload="metadata"`. Los contenedores existentes conservan sus proporciones.
El archivo `wallpaper.mp4` del repo no era parte del build ni del tráfico inicial;
no se contabiliza como una mejora ni se elimina del código fuente.

## Medición reproducible

Mismo Node, npm, lockfile, variables de branding y Vite 8.3.5. Se comparó el patch
10 con el patch 11. Se suma todo el grafo de imports estáticos de la entrada,
no solo el archivo llamado `index`. Gzip calculado con Node `gzipSync`.

| JavaScript inicial | Antes | Después | Reducción |
| --- | ---: | ---: | ---: |
| Sin comprimir | 890.255 bytes | 460.501 bytes | 48,3% |
| Gzip | 247.284 bytes | 143.198 bytes | 42,1% |

El archivo principal pasó de 818,94 kB a 388,26 kB. El resto del código sigue
existiendo y se solicita al abrir las páginas correspondientes. Ningún chunk de
esta compilación supera el umbral de aviso de 500 kB de Vite.

`npm run check:bundle` verifica el manifest real y limita el grafo inicial a
600.000 bytes / 180.000 bytes gzip. Se ejecuta en el Dockerfile después del build,
y `npm run test:unit` agrega las regresiones de pagos, JSON-LD y selección SEO.
No se actualizaron dependencias ni se regeneró el lockfile.

## Validación y límites

Pruebas Chromium en build de producción: Home no descarga checkout, cursos ni
panel; navegar a tienda sí carga su ruta. Se prueban también acceso directo a
catálogos, producto, curso, servicio, carrito, checkout y páginas legales.
Las suites de retorno de pago, transferencia y SEO se ejecutan junto a ellas.

No es una medición de Core Web Vitals/Lighthouse ni de tiempo de carga real:
las imágenes configuradas en producción, la red y el backend siguen influyendo.
El resultado mide JavaScript local y verifica navegación. No se modifica el
almacenamiento de medios ni se generan nuevas versiones de las imágenes.
