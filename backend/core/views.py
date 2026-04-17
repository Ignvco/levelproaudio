# backend/core/views.py
import mimetypes
from django.conf import settings
from django.http import HttpResponse, Http404, FileResponse
from django.views import View


class MediaProxyView(View):
    """
    Sirve archivos de media desde GCS (producción) o filesystem local (desarrollo).
    Usa las credenciales de Compute Engine — sin clave privada, sin URL firmada.
    """

    def get(self, request, path):
        if settings.DEBUG:
            return self._serve_local(path)
        return self._serve_gcs(path)

    def _serve_local(self, path):
        import os
        file_path = os.path.join(settings.MEDIA_ROOT, path)
        if not os.path.exists(file_path):
            raise Http404
        content_type, _ = mimetypes.guess_type(file_path)
        return FileResponse(
            open(file_path, "rb"),
            content_type=content_type or "application/octet-stream",
        )

    def _serve_gcs(self, path):
        try:
            from google.cloud import storage as gcs
            client = gcs.Client()
            bucket = client.bucket(settings.GS_BUCKET_NAME)
            blob   = bucket.blob(path)

            if not blob.exists():
                raise Http404

            # Descarga el contenido completo en memoria
            content      = blob.download_as_bytes()
            content_type = blob.content_type or mimetypes.guess_type(path)[0] or "application/octet-stream"

            response = HttpResponse(content, content_type=content_type)
            response["Cache-Control"] = "public, max-age=86400"
            return response

        except Http404:
            raise
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"MediaProxy error '{path}': {e}")
            raise Http404