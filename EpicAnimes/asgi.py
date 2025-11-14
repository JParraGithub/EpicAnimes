"""Configura la interfaz ASGI necesaria para desplegar la aplicación."""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'EpicAnimes.settings')

application = get_asgi_application()
