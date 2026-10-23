# Correctivo del build del frontend

Base: `30cbb5fd71e2556475b60599542ab84c4c936f15` (patch 02 de CSRF aplicado).

## Problema reproducido

El build fallaba en `npm install`, antes de ejecutar Vite. Se reprodujo
`Cannot read properties of null (reading 'edgesOut')` usando el `package.json`
del repo con Node 20.20.2 y npm 10.8.2. El stack del error apunta a
`@npmcli/arborist`, durante la resolución de peer dependencies.

El repo no versionaba `package-lock.json`: la regla `*.json` de `.gitignore`
también lo excluía. Por eso los rangos de `package.json` se resolvían de nuevo
en cada build. El primer árbol generado también mezclaba el peer opcional
`ajv` 8 de `@hookform/resolvers` con `ajv` 6 de ESLint. El lockfile incluido
mantiene `ajv` 6 dentro de las dependencias de ESLint, sin ocupar el lugar
del peer opcional de `@hookform/resolvers`.

## Cambios

- Node 24.19.0 sobre Alpine 3.24 y npm 11.9.0 explícitos en ambos Dockerfiles.
- `.nvmrc`, `engines` y `packageManager` documentan las mismas versiones locales.
- `package-lock.json` versionado, con integridades de los paquetes y las
  dependencias nativas opcionales de Alpine, generado con npm.
- `npm ci --include=dev` instala el árbol registrado e incluye Vite para
  compilar; el contenedor final sigue sirviendo únicamente `dist` con Nginx.
- `.dockerignore` evita copiar `node_modules`, builds y variables locales
  sobre el contenido del contenedor. Cloud Build conserva sus build args
  `VITE_*` para las variables públicas.
- Los dos deploys esperan `push-backend` y `push-frontend`. Un fallo de tests,
  build o push impide que cualquiera de ellos comience a desplegarse.

Esta dependencia entre pasos no hace atómicos los dos despliegues de Cloud Run:
un fallo durante un deploy aún requiere revisar las revisiones activas.

## Verificación

Validaciones realizadas al preparar este correctivo:

- Error original reproducido con Node 20.20.2 y npm 10.8.2.
- `npm ci` desde una copia limpia y con caché vacía, usando Node 24.19.0 y
  npm 11.9.0; el hash del lockfile no cambia.
- `npm ls --all` sin dependencias inválidas.
- Build de Vite correcto con las seis variables públicas de Cloud Build,
  sin marcadores `VITE_*` pendientes en el HTML generado.
- Diez casos de navegador contra Django y Vite: login, rotación de CSRF,
  escrituras protegidas, refresh, concurrencia, multipart y logout.
- Dependencias de los pasos de Cloud Build revisadas: ambos deploys exigen
  tests y ambos builds/pushes exitosos.

Desde `frontend/`, usando las versiones indicadas:

```bash
npm ci --include=dev --no-audit --no-fund
npm ls --all
npm run build
```

El build debe recibir las variables públicas `VITE_*` de `cloudbuild.yaml`
para que se sustituyan las etiquetas de marca del HTML.

Para comprobar además el contenedor, desde la raíz del repo con Docker:

```bash
docker build --no-cache -f frontend/Dockerfile.prod \
  --build-arg VITE_GOOGLE_CLIENT_ID= \
  --build-arg VITE_SITE_NAME='LevelPro Audio' \
  --build-arg VITE_SITE_TAGLINE='Equipamiento, Academia y Servicios de Audio' \
  --build-arg VITE_SITE_DESCRIPTION='LevelPro Audio' \
  --build-arg VITE_SITE_URL=https://levelproaudio.com \
  --build-arg VITE_GA_ID= \
  -t levelproaudio-frontend:build-fix ./frontend
```

La validación local usa Linux con glibc. No hay Docker disponible en el
entorno de preparación; el build completo de Alpine/Nginx se confirma en
Cloud Build al aplicar y pushear este correctivo.

Referencias: [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/),
[orden de pasos de Cloud Build](https://docs.cloud.google.com/build/docs/configuring-builds/configure-build-step-order).
