"""Configura la interfaz ASGI para exponer la aplicación de EpicAnimes."""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'EpicAnimes.settings')

application = get_asgi_application()
