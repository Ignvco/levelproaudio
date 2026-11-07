// Browser-visible dev frontend; API and media exclusively to local Docker backend.
import { mergeConfig } from 'vite'
import base from './vite.config.js'
export default mergeConfig(base, {
  server: {
    host: '0.0.0.0', port: 3000, strictPort: true,
    // QA screenshots are deterministic; Vite HMR's dev WebSocket is unnecessary.
    // Disabling it avoids a browser-only teardown error without silencing app exceptions.
    hmr: false,
    proxy: {
      '/api': { target: 'http://backend:8000', changeOrigin: true },
      '/media': { target: 'http://backend:8000', changeOrigin: true },
    },
  },
})
