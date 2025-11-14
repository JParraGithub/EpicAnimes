"""Configura la interfaz WSGI necesaria para desplegar la aplicación."""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'EpicAnimes.settings')

application = get_wsgi_application()
