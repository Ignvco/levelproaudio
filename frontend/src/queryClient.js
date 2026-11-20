// queryClient.js — Instancia centralizada de React Query con limpieza y cancelación de seguridad RBAC
import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            1000 * 60 * 5,
      retry:                1,
      refetchOnWindowFocus: false,
    },
  },
})

/**
 * Cancela todas las peticiones en vuelo y purga completamente la caché en memoria
 * cuando cambia el usuario autenticado, expira la sesión (401), se cierra sesión
 * o se detecta una revocación de permisos RBAC (403).
 */
export async function resetAndCancelQueryCache() {
  try {
    await queryClient.cancelQueries()
  } catch { /* noop */ }
  queryClient.clear()
}
