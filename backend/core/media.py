# core/media.py
#
# Fuente única para armar la URL pública de un FileField/ImageField.
#
# SIEMPRE devuelve la ruta relativa /media/<nombre> (proxeada por Django →
# MediaProxyView → GCS), NUNCA field.url directo — eso rompe con GCS en modo
# privado (403, bucket no público) o filtra el nombre interno del bucket.
#
# Antes vivía copiada y pegada en 4 serializers distintos (academy, products,
# services, site_settings) — eso es justo el riesgo que causó el bug de
# paywall bypass: si alguien edita una copia y no las otras, se reintroduce
# el problema. Ahora hay un solo lugar para arreglarlo.


def media_url(file_field):
    """
    file_field: cualquier FileField/ImageField de un modelo (o None).
    Devuelve "/media/<nombre>" o None si el campo está vacío.
    """
    if not file_field or not getattr(file_field, "name", None):
        return None
    return f"/media/{file_field.name}"
