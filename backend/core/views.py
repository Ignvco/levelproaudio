# backend/core/views.py
import os
import re
import mimetypes
from django.conf import settings
from django.http import HttpResponse, Http404, FileResponse
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
        file_path = os.path.join(settings.MEDIA_ROOT, path)
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
    def _serve_gcs(self, request, path):
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

            if rng:
                start, end = rng
                data = blob.download_as_bytes(start=start, end=end)  # end inclusive
                resp = HttpResponse(data, status=206, content_type=content_type)
                resp["Content-Range"] = f"bytes {start}-{end}/{file_size}"
                resp["Content-Length"] = str(end - start + 1)
                resp["Accept-Ranges"] = "bytes"
                resp["Cache-Control"] = "public, max-age=86400"
                return resp

            content = blob.download_as_bytes()
            resp = HttpResponse(content, content_type=content_type)
            resp["Content-Length"] = str(file_size)
            resp["Accept-Ranges"] = "bytes"
            resp["Cache-Control"] = "public, max-age=86400"
            return resp

        except Http404:
            raise
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"MediaProxy error '{path}': {e}")
            raise Http404
