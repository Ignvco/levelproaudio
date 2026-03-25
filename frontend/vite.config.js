// vite.config.js
// El proxy redirige /api/* hacia el backend Django
// Esto evita problemas de CORS durante el desarrollo

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',   // Necesario para Docker
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://backend:8000',  // 'backend' es el nombre del servicio en docker-compose
        changeOrigin: true,
      },
      '/media': {
        target: 'http://backend:8000',  // También proxea archivos de media (imágenes)
        changeOrigin: true,
      },
    },
  },
})