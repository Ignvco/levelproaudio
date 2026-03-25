// main.jsx
// Punto de entrada de la app
// QueryClientProvider envuelve toda la app para que React Query funcione en cualquier componente

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'

// Configuración global de React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // Datos frescos por 5 minutos
      retry: 1,                    // Reintenta 1 vez si falla
      refetchOnWindowFocus: false, // No recarga al volver a la pestaña
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)