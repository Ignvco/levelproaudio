# Patch 10 — Metadatos por página en el HTML inicial

## Comportamiento

Nginx incorpora un fragmento HTML público del backend dentro de `index.html`
antes de enviarlo, tanto a visitantes como a bots. El título, descripción,
canonical, Open Graph y Twitter usan la ruta original del pedido HTTP. Productos
activos, cursos publicados y servicios activos toman sus datos reales y su imagen
por el proxy público `/media/`. Home respeta la configuración SEO del panel.

No se hacen consultas de usuarios, pedidos ni pagos para generar metadatos.
Las rutas privadas/desconocidas y contenido no publicado devuelven metadatos
neutros y `noindex`. La búsqueda de tienda es `noindex`; una categoría válida
conserva su canonical, sin tracking ni términos de búsqueda. El sitemap incorpora
`/bajo-pedido` y escapa XML.

El frontend actualiza una sola etiqueta de cada tipo durante la navegación,
sin conservar títulos/descripciones de la página anterior ni duplicar los del
HTML inicial. El fallback de ruta tiene menor prioridad que el contenido cargado.
No se altera el diseño de las páginas.

## Nginx y despliegue

El subrequest interno `/_seo/head` apunta al nuevo endpoint `/api/v1/seo/head/`.
Solo usa GET; no reenvía cookies, Authorization ni cuerpo. El backend ya usa el
mismo origen configurado en el proxy existente. No hace falta un nuevo secreto.
`SITE_URL` del backend y `VITE_SITE_URL` del frontend deben conservar el dominio
canónico actual (`https://levelproaudio.com`).

`index.html` y el fragmento llevan `Cache-Control: no-store`. Los assets con hash
mantienen caché larga. Si el backend no responde (conexión 2 s / lectura 3 s), el
HTML usa un fallback válido con marca y `noindex`. La aplicación sigue cargando.
Durante un despliegue en el que el frontend llegue antes del nuevo backend,
ese fallback cubre la ausencia temporal del endpoint.

## Pruebas

- Django: home configurable, producto/curso/servicio, contenido oculto, rutas
  privadas, categoría, canonical, escape HTML/XML, fallo del backend.
- Chromium: una sola etiqueta por tipo, texto no ejecutable, prioridad de página,
  navegación SPA producto → tienda y `noindex` del retorno de pago.
- Nginx real (compilación local 1.28.0): configuración de producción con upstream
  local simulado; ruta y query originales, credenciales ausentes, inclusión de
  metadatos, fallo 503, timeout y bloqueo del endpoint interno desde afuera.

Comandos del test Nginx (requiere `npm run build` y nginx instalado):

```bash
cd frontend
node --test tests/seo-nginx.test.mjs
```

También acepta `NGINX_TEST_BINARY=/ruta/a/nginx`. El test solo usa servidores
locales y credenciales sintéticas; no prueba llamadas a producción.

## Límites

Es renderizado inicial de metadatos, no SSR completo del contenido de React.
Las rutas SPA inexistentes mantienen el HTTP 200 del fallback existente y usan
`noindex`; no se implementan aquí respuestas HTTP 404 para todo el frontend.
WhatsApp/Facebook pueden conservar previews anteriores hasta volver a rastrear.
Vite dev/preview no procesa SSI: usa el fallback inicial y después los metadatos
del cliente. El comportamiento de producción se prueba con Nginx.

Referencia: https://nginx.org/en/docs/http/ngx_http_ssi_module.html
