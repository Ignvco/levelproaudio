# LevelPro Audio — frontend

## Instalación y build reproducible

Usar Node 24.19.0 y npm 11.9.0, las mismas versiones fijadas en los
Dockerfiles. Desde `frontend/`, con nvm instalado:

```bash
nvm install
nvm use
npm install --global npm@11.9.0
npm ci
npm run build
```

`package-lock.json` debe quedar versionado. Para agregar o actualizar una
dependencia, usar estas versiones de Node/npm, ejecutar `npm install`,
verificar `npm ci && npm run build` y comitear `package.json` junto con
`package-lock.json`. El build de Docker usa `npm ci` y no modifica el lockfile.

`.dockerignore` excluye dependencias y builds locales para que `COPY . .`
no sobrescriba los paquetes instalados dentro del contenedor. Las variables
públicas `VITE_*` de producción se reciben como build args en Cloud Build.

## React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
