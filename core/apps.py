"""Declara la configuración de la aplicación Core."""

from django.apps import AppConfig


class CoreConfig(AppConfig):
    """Registra la aplicación Core dentro de Django."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'
