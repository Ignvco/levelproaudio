# core/tests_media_proxy.py
#
# Antes, MediaProxyView cargaba el archivo COMPLETO en memoria con
# blob.download_as_bytes() antes de mandar cualquier byte de respuesta
# — con una imagen chica nunca se notaba, pero con un video real de
# varios cientos de MB tiraba el worker (memoria/timeout) y el cliente
# recibía un 500 vacío. Además, un pedido típico de reproductor de
# video ("Range: bytes=0-", sin fin) se interpretaba como "el archivo
# completo", así que el bug también se disparaba en el camino "con
# range". Ahora todo se transmite por chunks.
#
# No se puede probar contra GCS real desde tests unitarios, así que se
# mockea el blob — lo que sí se valida de verdad es: que la respuesta
# es un StreamingHttpResponse (nunca carga todo en memoria), que
# nunca se pide más de CHUNK_SIZE de una vez, y que el caso "Range:
# bytes=0-" (sin fin, el que rompía antes) arma correctamente los
# headers de Content-Range/Content-Length.

from io import BytesIO
from unittest.mock import patch, MagicMock

from django.http import StreamingHttpResponse
from django.test import TestCase, RequestFactory, override_settings

from core.views import MediaProxyView


def _fake_blob(file_size, content_type="video/mp4"):
    """Simula un blob de GCS con un archivo en memoria, soportando
    .open('rb') con seek/read igual que el BlobReader real."""
    data = b"x" * file_size
    blob = MagicMock()
    blob.exists.return_value = True
    blob.size = file_size
    blob.content_type = content_type

    def fake_open(mode):
        return BytesIO(data)

    blob.open.side_effect = fake_open
    return blob


@override_settings(GS_BUCKET_NAME="fake-bucket-test", DEBUG=False)
class MediaProxyStreamingTest(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.view = MediaProxyView()

    @patch("google.cloud.storage.Client")
    def test_full_file_uses_streaming_response_not_download_as_bytes(self, mock_client_cls):
        blob = _fake_blob(file_size=10_000_000)  # 10 MB — simula un video real
        mock_client_cls.return_value.bucket.return_value.blob.return_value = blob

        request = self.factory.get("/media/academy/videos/test.mp4")
        response = self.view.get(request, "academy/videos/test.mp4")

        self.assertIsInstance(response, StreamingHttpResponse)
        content = b"".join(response.streaming_content)  # consumir el generador
        self.assertEqual(len(content), 10_000_000)
        # Nunca debe haber usado download_as_bytes (carga todo en memoria)
        blob.download_as_bytes.assert_not_called()
        # Y sí debe haber usado open() para leer en streaming
        blob.open.assert_called()

    @patch("google.cloud.storage.Client")
    def test_open_ended_range_request_does_not_load_everything_at_once(self, mock_client_cls):
        """El caso real que rompía: un reproductor pide 'bytes=0-' (sin
        fin) como primer probe — antes esto se resolvía como pedir el
        archivo COMPLETO de una sola vez vía download_as_bytes()."""
        blob = _fake_blob(file_size=50_000_000)  # 50 MB
        mock_client_cls.return_value.bucket.return_value.blob.return_value = blob

        request = self.factory.get(
            "/media/academy/videos/test.mp4", HTTP_RANGE="bytes=0-"
        )
        response = self.view.get(request, "academy/videos/test.mp4")

        self.assertEqual(response.status_code, 206)
        self.assertEqual(response["Content-Range"], "bytes 0-49999999/50000000")
        self.assertIsInstance(response, StreamingHttpResponse)
        blob.download_as_bytes.assert_not_called()

    @patch("google.cloud.storage.Client")
    def test_streamed_chunks_never_exceed_chunk_size(self, mock_client_cls):
        blob = _fake_blob(file_size=2_000_000)
        mock_client_cls.return_value.bucket.return_value.blob.return_value = blob

        request = self.factory.get("/media/academy/videos/test.mp4")
        response = self.view.get(request, "academy/videos/test.mp4")

        chunks = list(response.streaming_content)
        self.assertTrue(len(chunks) > 1)  # se mandó en más de un pedazo
        for chunk in chunks:
            self.assertLessEqual(len(chunk), MediaProxyView.CHUNK_SIZE)
        self.assertEqual(sum(len(c) for c in chunks), 2_000_000)  # nada se perdió

    @patch("google.cloud.storage.Client")
    def test_partial_range_returns_exact_requested_bytes(self, mock_client_cls):
        blob = _fake_blob(file_size=1_000_000)
        mock_client_cls.return_value.bucket.return_value.blob.return_value = blob

        request = self.factory.get(
            "/media/academy/videos/test.mp4", HTTP_RANGE="bytes=100-199"
        )
        response = self.view.get(request, "academy/videos/test.mp4")

        self.assertEqual(response.status_code, 206)
        content = b"".join(response.streaming_content)
        self.assertEqual(len(content), 100)  # 100 a 199 inclusive = 100 bytes
