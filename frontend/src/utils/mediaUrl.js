// src/utils/mediaUrl.js
// Convierte cualquier URL de imagen a una URL funcional.
// El backend devuelve URLs relativas como /media/products/foto.jpg
// En desarrollo Vite las proxea a http://backend:8000/media/...
// En producción se sirven directamente desde el mismo dominio.

export function mediaUrl(url) {
  if (!url) return null

  // Ya es absoluta (http:// o https://) — úsala directo
  // EXCEPTO si apunta a "backend:8000" (nombre Docker interno)
  if (url.startsWith("http://backend:") || url.startsWith("https://backend:")) {
    // Extrae solo el path: /media/products/foto.jpg
    try {
      const path = new URL(url).pathname
      return path  // ← relativa, Vite la proxea correctamente
    } catch {
      return url
    }
  }

  // URL ya absoluta con host real (producción)
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url
  }

  // URL relativa /media/... → correcta para Vite proxy
  return url
}