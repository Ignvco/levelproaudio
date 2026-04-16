# core/views.py
"""
MediaProxyView — sirve archivos de media desde GCS en producción
o desde el sistema de archivos local en desarrollo.

En producción (Cloud Run):
  - Lee el archivo desde GCS usando google.cloud.storage con las
    credenciales de Compute Engine (sin necesidad de clave privada)
  - Hace streaming del contenido al cliente
  - No expone credenciales ni requiere bucket público

En desarrollo:
  - Sirve desde MEDIA_ROOT local (como Django siempre hizo)
"""

import mimetypes
from django.conf import settings
from django.http import StreamingHttpResponse, Http404, FileResponse
from django.views import View


class MediaProxyView(View):
    """
    Proxy transparente para archivos de media.
    Compatible con GCS (producción) y filesystem local (desarrollo).
    """

    def get(self, request, path):
        if settings.DEBUG:
            return self._serve_local(path)
        return self._serve_gcs(path)

    def _serve_local(self, path):
        """Desarrollo: sirve desde MEDIA_ROOT."""
        import os
        from django.conf import settings

        file_path = os.path.join(settings.MEDIA_ROOT, path)
        if not os.path.exists(file_path):
            raise Http404(f"Media file not found: {path}")

        content_type, _ = mimetypes.guess_type(file_path)
        return FileResponse(
            open(file_path, "rb"),
            content_type=content_type or "application/octet-stream",
        )

    def _serve_gcs(self, path):
        """
        Producción: lee desde GCS usando Compute Engine credentials.
        Hace streaming para no cargar el archivo completo en memoria.
        """
        try:
            from google.cloud import storage as gcs_storage
        except ImportError:
            raise Http404("google-cloud-storage not installed")

        try:
            client = gcs_storage.Client()  # Usa ADC — Compute Engine credentials automáticamente
            bucket = client.bucket(settings.GS_BUCKET_NAME)
            blob   = bucket.blob(f"media/{path}")

            if not blob.exists():
                raise Http404(f"File not found in GCS: media/{path}")

            content_type = blob.content_type or mimetypes.guess_type(path)[0] or "application/octet-stream"

            def stream_blob():
                with blob.open("rb") as f:
                    while chunk := f.read(8192):
                        yield chunk

            response = StreamingHttpResponse(stream_blob(), content_type=content_type)
            response["Cache-Control"] = "public, max-age=86400"
            response["Content-Length"] = blob.size
            return response

        except Http404:
            raise
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"MediaProxyView GCS error for path '{path}': {e}")
            raise Http404("Media file unavailable")
