# backend/core/views.py
import os
import re
import mimetypes
from django.conf import settings
from django.http import HttpResponse, Http404, FileResponse, StreamingHttpResponse
from django.views import View

_RANGE_RE = re.compile(r"bytes=(\d+)-(\d*)")


class MediaProxyView(View):
    """
    Sirve archivos de media desde GCS (producción) o filesystem local (desarrollo).
    Soporta HTTP Range requests (206 Partial Content) para streaming de video/audio.
    """

    def get(self, request, path):
        if settings.DEBUG:
            return self._serve_local(request, path)
        return self._serve_gcs(request, path)

    # ── helpers ───────────────────────────────────────────────
    @staticmethod
    def _parse_range(range_header, file_size):
        """Devuelve (start, end) inclusive o None si no hay range válido."""
        if not range_header or not file_size:
            return None
        m = _RANGE_RE.match(range_header)
        if not m:
            return None
        start = int(m.group(1))
        end = int(m.group(2)) if m.group(2) else file_size - 1
        end = min(end, file_size - 1)
        if start > end or start >= file_size:
            return "invalid"
        return (start, end)

    # ── local (desarrollo) ────────────────────────────────────
    def _serve_local(self, request, path):
        media_root = os.path.realpath(settings.MEDIA_ROOT)
        file_path = os.path.realpath(os.path.join(media_root, path))
        # Evita path traversal (../, rutas absolutas) fuera de MEDIA_ROOT.
        if os.path.commonpath([media_root, file_path]) != media_root:
            raise Http404
        if not os.path.exists(file_path):
            raise Http404
        content_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
        file_size = os.path.getsize(file_path)
        rng = self._parse_range(request.META.get("HTTP_RANGE"), file_size)

        if rng == "invalid":
            resp = HttpResponse(status=416)
            resp["Content-Range"] = f"bytes */{file_size}"
            return resp

        if rng:
            start, end = rng
            length = end - start + 1
            with open(file_path, "rb") as f:
                f.seek(start)
                data = f.read(length)
            resp = HttpResponse(data, status=206, content_type=content_type)
            resp["Content-Range"] = f"bytes {start}-{end}/{file_size}"
            resp["Content-Length"] = str(length)
            resp["Accept-Ranges"] = "bytes"
            return resp

        resp = FileResponse(open(file_path, "rb"), content_type=content_type)
        resp["Accept-Ranges"] = "bytes"
        resp["Content-Length"] = str(file_size)
        return resp

    # ── GCS (producción) ──────────────────────────────────────
    #
    # IMPORTANTE: nunca usar blob.download_as_bytes() SIN start/end para
    # servir el archivo completo — eso carga TODO en memoria de una sola
    # vez antes de mandar ni un byte de respuesta. Con una imagen de
    # unos KB nunca se nota; con un video real de cientos de MB, tira el
    # worker (por timeout o por memoria) y el cliente recibe un 500
    # vacío sin ningún mensaje de error — exactamente lo que pasaba acá.
    #
    # Además: un pedido típico de un reproductor de video pide
    # "Range: bytes=0-" (sin fin) como primer probe — _parse_range ya
    # resolvía eso como "todo el archivo", así que el problema de arriba
    # también se disparaba en el camino "con range", no solo sin range.
    #
    # La solución: transmitir por chunks. Probamos primero con
    # blob.open("rb") (BlobReader con seek/read) pero eso falló en
    # producción con un 500 sin ningún log — el error pasa DENTRO del
    # generador, que Django ejecuta recién cuando el servidor WSGI
    # empieza a mandar la respuesta, ya fuera del try/except de esta
    # función, así que se nos escapaba sin loguearse.
    #
    # Ahora usamos download_as_bytes(start=, end=) en un bucle — la
    # misma llamada que YA funcionaba antes para servir imágenes
    # completas, solo que repetida en pedazos chicos en vez de pedirse
    # entera de una vez. Menos elegante que un BlobReader, pero es la
    # API que sabemos que anda bien contra este bucket.
    CHUNK_SIZE = 256 * 1024  # 256 KB por lectura interna a GCS

    # Cloud Run tiene un límite DURO de 32MB para el tamaño total de
    # CUALQUIER respuesta — no solo de subida. El streaming por chunks
    # de arriba evita cargar todo en memoria, pero si el navegador pide
    # un rango grande (algo que los reproductores de video hacen todo
    # el tiempo, ej. "bytes=0-34000000"), igual armábamos una respuesta
    # de ESE tamaño total, superando el límite igual.
    #
    # La solución: nunca mandar más de MAX_RESPONSE_SIZE en una sola
    # respuesta, sin importar cuánto pida el navegador. Esto es HTTP
    # válido — el servidor puede devolver MENOS de lo pedido en un
    # range request, reflejando en Content-Range lo que realmente
    # mandó. El navegador simplemente pide el resto en la próxima
    # tanda — así funciona cualquier streaming de video real.
    MAX_RESPONSE_SIZE = 16 * 1024 * 1024  # 16 MB — bien por debajo del límite de 32MB

    def _serve_gcs(self, request, path):
        import logging
        logger = logging.getLogger(__name__)
        try:
            from google.cloud import storage as gcs
            client = gcs.Client()
            bucket = client.bucket(settings.GS_BUCKET_NAME)
            blob = bucket.blob(path)

            if not blob.exists():
                raise Http404

            blob.reload()
            file_size = blob.size or 0
            content_type = (blob.content_type
                            or mimetypes.guess_type(path)[0]
                            or "application/octet-stream")
            rng = self._parse_range(request.META.get("HTTP_RANGE"), file_size)

            if rng == "invalid":
                resp = HttpResponse(status=416)
                resp["Content-Range"] = f"bytes */{file_size}"
                return resp

            start, requested_end = rng if rng else (0, file_size - 1)
            # Recortamos el final al tope, sin importar cuánto se pidió.
            end = min(requested_end, start + self.MAX_RESPONSE_SIZE - 1)
            length = end - start + 1
            # Es "parcial" (206) si el cliente pidió un range, O si
            # nuestro propio tope nos obligó a cortar antes del final
            # real del archivo (el navegador va a pedir el resto después).
            is_partial = bool(rng) or (end < file_size - 1)

            def stream_chunks():
                pos = start
                try:
                    while pos <= end:
                        chunk_end = min(pos + self.CHUNK_SIZE - 1, end)
                        yield blob.download_as_bytes(start=pos, end=chunk_end)
                        pos = chunk_end + 1
                except Exception as e:
                    # Ya empezamos a mandar la respuesta — no podemos
                    # cambiar el status acá, pero al menos queda logueado
                    # en vez de perderse en silencio (que es lo que pasaba
                    # con el enfoque anterior de blob.open()).
                    logger.error(f"MediaProxy: error transmitiendo '{path}' en byte {pos}: {e}")
                    raise

            if is_partial:
                resp = StreamingHttpResponse(stream_chunks(), status=206, content_type=content_type)
                resp["Content-Range"] = f"bytes {start}-{end}/{file_size}"
                resp["Content-Length"] = str(length)
                resp["Accept-Ranges"] = "bytes"
                resp["Cache-Control"] = "public, max-age=86400"
                return resp

            # Archivo entero, sin recortar (nunca pasa de MAX_RESPONSE_SIZE)
            resp = StreamingHttpResponse(stream_chunks(), content_type=content_type)
            resp["Content-Length"] = str(length)
            resp["Accept-Ranges"] = "bytes"
            resp["Cache-Control"] = "public, max-age=86400"
            return resp

        except Http404:
            raise
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"MediaProxy error '{path}': {e}")
            raise Http404
