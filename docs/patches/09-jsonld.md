# Patch 09 — Serialización de JSON-LD

Se centraliza la serialización en `serializeJsonLd`: conserva exactamente los
valores JSON y escapa `<`, `>`, `&`, U+2028 y U+2029. Así un texto que contiene
`</script>` no puede cerrar el bloque al parsear HTML generado o exportado.

Es una medida de defensa para el contexto HTML. No se afirma que se haya
explotado XSS en el renderizado cliente actual de React.

Pruebas: round-trip de JSON con texto Unicode, atributos, cierres de script,
comentarios HTML y claves anidadas; prueba de Chromium parseando HTML con el
payload, que mantiene un solo script JSON-LD y no ejecuta código inyectado.
No cambia los datos comerciales ni sus esquemas, y no requiere migraciones.
