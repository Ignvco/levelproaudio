# Patch 02: CSRF para autenticación con cookies

Base: `75606e710d651c4b7ccb932be2be4e9f7cb24ab7`, con PayPal 01 y su correctivo de tests aplicados.

## Comportamiento

- Django valida el token CSRF y el origen de las escrituras autenticadas mediante cookies JWT.
- Login normal, login de Google, renovación y logout exigen CSRF, incluso antes de que exista una sesión. La renovación enviada en el body también crea cookies y requiere la misma comprobación.
- `GET /api/v1/auth/csrf/` inicializa la cookie `csrftoken` y devuelve un token enmascarado como `csrfToken`. La respuesta no se almacena en caché y admite cookies de acceso vencidas.
- Después de un login correcto, Django rota el token CSRF. Los JWT siguen en cookies HttpOnly; `csrftoken` es una cookie distinta, legible por Axios.
- Los dos clientes del frontend obtienen la cookie cuando falta y envían `X-CSRFToken` al mismo origen. Comparten una única inicialización cuando coinciden varias escrituras. La renovación automática usa el mismo mecanismo.
- Los errores CSRF devuelven HTTP 403 y `code: csrf_failed`. El cliente no repite automáticamente una escritura rechazada por CSRF.
- La autenticación explícita mediante `Authorization: Bearer` en recursos de la API sigue disponible. Los webhooks de proveedores conservan su verificación propia.

## Configuración y despliegue

En producción están permitidos `https://levelproaudio.com` y `https://www.levelproaudio.com`: el proxy Nginx cambia el host de destino al host interno de Cloud Run, pero el navegador conserva el origen público.

Para otros dominios o previews, configurar `CSRF_TRUSTED_ORIGINS` como una lista separada por comas, con esquema y puerto cuando corresponda. No usar comodines para autorizar previews indiscriminadamente. La configuración CORS es independiente.

Los settings `development` y `local` permiten localhost/127.0.0.1 en los puertos 3000 y 5173. Allí las cookies usan HTTP por defecto; `AUTH_COOKIE_SECURE` permite cambiarlo explícitamente. Producción conserva `CSRF_COOKIE_SECURE=True`.

Desplegar backend y frontend juntos. Tras finalizar el despliegue, recargar las pestañas abiertas para cargar el cliente actualizado. Las sesiones existentes obtienen la nueva cookie CSRF antes de su primera escritura.

Los consumidores externos de los endpoints que crean o borran cookies deben obtener primero `/auth/csrf/`, conservar su cookie y enviar el token en `X-CSRFToken`.

## Verificación

Validación local de esta entrega: 336 tests del backend aprobados y 6 omitidos; build de Vite correcto; linter de los JavaScript modificados correcto; 10 escenarios en Chromium contra Django y los clientes Axios reales. Las pruebas locales no confirman el estado del despliegue en Cloud Build.

Los tests nuevos usan `APIClient(enforce_csrf_checks=True)` y cookies JWT reales. Cubren tokens faltantes o incorrectos, orígenes ajenos, rotación en login, acceso vencido, refresh, logout, Google, formularios multipart, Bearer, dominios públicos detrás del proxy y webhooks.

Desde `backend/`, con las dependencias de desarrollo y las variables de CI configuradas:

```bash
DJANGO_SETTINGS_MODULE=config.settings.test python -m pytest tests/test_cookie_csrf.py -q
```

El comando completo de `cloudbuild.yaml` también incluye este archivo dentro de `tests/`.

Referencias: [CSRF en Django 5.2](https://docs.djangoproject.com/en/5.2/howto/csrf/) y [autenticación y CSRF en DRF](https://www.django-rest-framework.org/api-guide/authentication/#sessionauthentication).
