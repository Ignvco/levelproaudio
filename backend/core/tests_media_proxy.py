# core/tests_media_proxy.py
#
# Antes, MediaProxyView cargaba el archivo COMPLETO en memoria con
# blob.download_as_bytes() antes de mandar cualquier byte de respuesta
# — con una imagen chica nunca se notaba, pero con un video real de
# varios cientos de MB tiraba el worker (memoria/timeout) y el cliente
# recibía un 500 vacío. Un pedido típico de reproductor de video
# ("Range: bytes=0-", sin fin) se interpretaba como "el archivo
# completo", así que el bug también se disparaba en el camino "con
# range".
#
# Primer intento de fix (blob.open() + BlobReader) rompió en
# producción con un 500 que ni siquiera quedaba logueado — el error
# pasaba DENTRO del generador, fuera del try/except de la función.
# La versión actual usa download_as_bytes(start=, end=) en un bucle
# — la misma llamada que ya funcionaba antes para imágenes — y
# loguea cualquier error que ocurra durante el streaming.
#
# No se puede probar contra GCS real desde tests unitarios, así que
# se mockea el blob.

from unittest.mock import patch, MagicMock

from django.http import StreamingHttpResponse
from django.test import TestCase, RequestFactory, override_settings

from core.views import MediaProxyView


def _fake_blob(file_size, content_type="video/mp4"):
    """Simula un blob de GCS: download_as_bytes(start=, end=) devuelve
    exactamente los bytes pedidos de un archivo de `file_size` bytes."""
    data = b"x" * file_size
    blob = MagicMock()
    blob.exists.return_value = True
    blob.size = file_size
    blob.content_type = content_type
    blob.download_as_bytes.side_effect = (
        lambda start=0, end=file_size - 1: data[start:end + 1]
    )
    return blob


@override_settings(GS_BUCKET_NAME="fake-bucket-test", DEBUG=False)
class MediaProxyStreamingTest(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.view = MediaProxyView()

    @patch("google.cloud.storage.Client")
    def test_full_file_streams_in_chunks_and_reassembles_correctly(self, mock_client_cls):
        blob = _fake_blob(file_size=10_000_000)  # 10 MB — simula un video real
        mock_client_cls.return_value.bucket.return_value.blob.return_value = blob

        request = self.factory.get("/media/academy/videos/test.mp4")
        response = self.view.get(request, "academy/videos/test.mp4")

        self.assertIsInstance(response, StreamingHttpResponse)
        content = b"".join(response.streaming_content)
        self.assertEqual(len(content), 10_000_000)
        # Nunca debe pedir el archivo entero de una sola llamada
        for call in blob.download_as_bytes.call_args_list:
            start = call.kwargs["start"]
            end = call.kwargs["end"]
            self.assertLessEqual(end - start + 1, MediaProxyView.CHUNK_SIZE)
        self.assertTrue(blob.download_as_bytes.call_count > 1)

    @patch("google.cloud.storage.Client")
    def test_open_ended_range_request_does_not_load_everything_at_once(self, mock_client_cls):
        """El caso real que rompía en el navegador: un reproductor pide
        'bytes=0-' (sin fin) como primer probe."""
        blob = _fake_blob(file_size=50_000_000)  # 50 MB
        mock_client_cls.return_value.bucket.return_value.blob.return_value = blob

        request = self.factory.get(
            "/media/academy/videos/test.mp4", HTTP_RANGE="bytes=0-"
        )
        response = self.view.get(request, "academy/videos/test.mp4")

        self.assertEqual(response.status_code, 206)
        self.assertEqual(response["Content-Range"], "bytes 0-49999999/50000000")
        content = b"".join(response.streaming_content)
        self.assertEqual(len(content), 50_000_000)
        for call in blob.download_as_bytes.call_args_list:
            start = call.kwargs["start"]; end = call.kwargs["end"]
            self.assertLessEqual(end - start + 1, MediaProxyView.CHUNK_SIZE)

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

    @patch("google.cloud.storage.Client")
    def test_error_during_streaming_gets_logged(self, mock_client_cls):
        """Si algo falla mientras se transmite (ya con headers mandados),
        no podemos cambiar el status HTTP, pero SÍ debe quedar logueado
        — antes se perdía en silencio con blob.open()."""
        blob = _fake_blob(file_size=1_000_000)
        blob.download_as_bytes.side_effect = RuntimeError("simulated GCS error mid-stream")
        mock_client_cls.return_value.bucket.return_value.blob.return_value = blob

        request = self.factory.get("/media/academy/videos/test.mp4")
        response = self.view.get(request, "academy/videos/test.mp4")

        with self.assertLogs("core.views", level="ERROR") as log:
            with self.assertRaises(RuntimeError):
                list(response.streaming_content)
        self.assertIn("MediaProxy", log.output[0])
