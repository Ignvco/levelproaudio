# Patch 08 — Errores internos y validación del panel

Los errores inesperados de productos, firma de videos y ajustes de puntos
ahora retornan un mensaje fijo y `error_id`; la excepción queda en logs del
servidor. No se agregan cuerpos, cabeceras, cookies ni tokens al contexto del log.
Esto no constituye un sistema de redacción automática de secretos en excepciones.

El handler global de DRF conserva sus errores de validación, permisos, 404 y
throttling. Solo sustituye excepciones no manejadas por una respuesta segura 500,
también fuera del panel. Las respuestas de negocio explícitas de stock, sorteos
y canje de puntos se conservan: son validaciones conocidas, no excepciones SDK.

El panel valida UUID de inscripciones y usuario/puntos en ajustes. Los errores
inesperados de productos y ajustes revierten las escrituras parciales de la
operación. Una inscripción inexistente devuelve un 404 fijo.

Pruebas: `backend/core/tests_api_errors.py`, más regresiones de analytics y
loyalty. Se verifican respuestas, logs correlacionados, permisos, 400/404/429 y
rollback. No hay migraciones ni nuevos permisos.

Referencia de implementación: https://www.django-rest-framework.org/api-guide/exceptions/
