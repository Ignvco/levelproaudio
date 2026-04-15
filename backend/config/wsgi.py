

# backend/config/wsgi.py
import os
from django.core.wsgi import get_wsgi_application
 
# En producción DJANGO_SETTINGS_MODULE viene del entorno (Cloud Run)
# El default es production para evitar cargar development accidentalmente
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.production')
 
application = get_wsgi_application()